import { db, admin } from './firebase-admin.js';

export const DEFAULT_ROULETTE_SETTINGS = {
    enabled: true,
    spinCost: 1.00,
    minActiveServicesRequired: 3,
    services: [
        { id: 'netflix', serviceName: 'Netflix', title: 'Netflix 4K VIP 👑', cost: 13.00, stock: 2, color: '#dc2626', textColor: '#ffffff', baseProbability: 0.005 },
        { id: 'hbo', serviceName: 'HBO Max', title: 'HBO Max VIP 🎬', cost: 8.00, stock: 3, color: '#7c3aed', textColor: '#ffffff', baseProbability: 0.01 },
        { id: 'crunchyroll', serviceName: 'Crunchyroll', title: 'Crunchyroll Fan 🍿', cost: 5.00, stock: 5, color: '#ea580c', textColor: '#ffffff', baseProbability: 0.03 },
        { id: 'paramount', serviceName: 'Paramount+', title: 'Paramount+ 📺', cost: 6.00, stock: 2, color: '#2563eb', textColor: '#ffffff', baseProbability: 0.01 }
    ],
    updatedAt: new Date().toISOString()
};

export class GameController {
    
    /**
     * Obtiene la configuración de la Ruleta (Servicios, Stock, Estado Habilitado/Deshabilitado).
     */
    static async getRouletteSettings() {
        const docRef = db.collection('game_settings').doc('roulette');
        const snap = await docRef.get();
        if (!snap.exists) {
            await docRef.set(DEFAULT_ROULETTE_SETTINGS);
            return DEFAULT_ROULETTE_SETTINGS;
        }
        return snap.data();
    }

    /**
     * Guarda la configuración de la Ruleta (Servicios, Stock, Habilitar/Deshabilitar).
     */
    static async saveRouletteSettings(newSettings) {
        const docRef = db.collection('game_settings').doc('roulette');
        const dataToSave = {
            ...newSettings,
            updatedAt: new Date().toISOString()
        };
        await docRef.set(dataToSave, { merge: true });
        return dataToSave;
    }

    /**
     * Valida si un usuario tiene al menos 3 servicios activos.
     */
    static async validateActiveServices(userName, userId, minRequired = 3) {
        if (!userName) return { hasAccess: false, activeCount: 0 };

        const normalizedName = userName.trim().toLowerCase();
        const subsSnap = await db.collection('subscriptions').get();
        
        let activeCount = 0;
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        subsSnap.forEach(doc => {
            const sub = doc.data();
            if (sub.person && sub.person.trim().toLowerCase() === normalizedName) {
                if (sub.endDate) {
                    const end = new Date(sub.endDate);
                    if (end >= now) {
                        activeCount++;
                    }
                }
            }
        });

        return {
            hasAccess: activeCount >= minRequired,
            activeCount: activeCount,
            minRequired: minRequired
        };
    }

    /**
     * Obtiene las métricas financieras globales de la Ruleta (Caja de la Casa).
     */
    static async getHouseMetrics() {
        const statsRef = db.collection('game_house_stats').doc('roulette_global');
        const docSnap = await statsRef.get();

        if (!docSnap.exists) {
            const initialStats = {
                totalSpins: 0,
                totalRevenue: 0.00,    // Total recaudado (1 sol por giro)
                totalPrizesCost: 0.00, // Costo total de premios entregados
                houseProfit: 0.00,     // Ganancia neta de la casa
                profitMarginPercent: 100.00, // Margen de ganancia de la casa
                lastUpdated: new Date().toISOString()
            };
            await statsRef.set(initialStats);
            return initialStats;
        }

        return docSnap.data();
    }

    /**
     * Construye los sectores de la Ruleta a partir de los servicios configurados por el Admin.
     */
    static buildRouletteSlices(services = []) {
        const slices = [
            {
                id: 'TRY_AGAIN_1',
                title: 'Más suerte para la próxima 🍀',
                type: 'NO_PRIZE',
                sliceIndex: 0,
                color: '#1e293b',
                textColor: '#94a3b8',
                cost: 0,
                baseProbability: 0.40
            },
            {
                id: 'FREE_SPIN_1',
                title: 'Repite la Jugada 🔄',
                type: 'FREE_SPIN',
                sliceIndex: 1,
                color: '#0284c7',
                textColor: '#ffffff',
                cost: 0,
                baseProbability: 0.15
            }
        ];

        let indexCounter = 2;
        services.forEach(s => {
            slices.push({
                id: `SERVICE_${s.id || s.serviceName}`,
                serviceId: s.id,
                title: s.title || `${s.serviceName} VIP 🎁`,
                type: 'SERVICE',
                serviceName: s.serviceName,
                sliceIndex: indexCounter++,
                color: s.color || '#dc2626',
                textColor: s.textColor || '#ffffff',
                cost: parseFloat(s.cost || 0),
                stock: parseInt(s.stock || 0),
                baseProbability: parseFloat(s.baseProbability || 0.01)
            });
        });

        // Añadir sector de relleno "Sigue intentando"
        slices.push({
            id: 'TRY_AGAIN_2',
            title: 'Sigue intentando ⚡',
            type: 'NO_PRIZE',
            sliceIndex: indexCounter,
            color: '#0f172a',
            textColor: '#64748b',
            cost: 0,
            baseProbability: 0.395
        });

        return slices;
    }

    /**
     * Algoritmo de Distribución Ponderada con Control Estricto de Stock y Ganancia de la Casa >= 30%.
     */
    static calculatePrizeWithStockAndHouseEdge(houseStats, slices, services) {
        const totalRevenue = parseFloat(houseStats.totalRevenue || 0) + 1.00;
        const totalPrizesCost = parseFloat(houseStats.totalPrizesCost || 0);
        
        const currentMargin = totalRevenue > 0 
            ? ((totalRevenue - totalPrizesCost) / totalRevenue) * 100 
            : 100;

        console.log(`🎰 [Ruleta Algoritmo] Ingresos: S/ ${totalRevenue} | Costo Premios: S/ ${totalPrizesCost} | Margen Casa: ${currentMargin.toFixed(2)}%`);

        let workingSlices = slices.map(s => {
            // Verificar si tiene stock disponible
            if (s.type === 'SERVICE') {
                const sObj = services.find(srv => srv.serviceName === s.serviceName || srv.id === s.serviceId);
                const availableStock = sObj ? parseInt(sObj.stock || 0) : 0;
                if (availableStock <= 0) {
                    console.log(`⚠️ [Sin Stock] Servicio "${s.serviceName}" agotado (Stock: 0). Probabilidad asignada: 0.`);
                    return { ...s, probability: 0, stock: 0 };
                }
            }
            return { ...s, probability: s.baseProbability || 0.01 };
        });

        // REGLA DE PROTECCIÓN DE LA CASA:
        // Si el margen cae por debajo del 30% o la caja está en fase inicial, anular premios con costo
        if (currentMargin < 30 || totalRevenue < 20) {
            console.warn("🛡️ [Protección Casa Activada] Margen menor a 30%. Bloqueando premios con costo.");
            workingSlices = workingSlices.map(s => {
                if (s.cost > 0) return { ...s, probability: 0 };
                if (s.type === 'FREE_SPIN') return { ...s, probability: 0.15 };
                return { ...s, probability: 0.85 / 2 };
            });
        }

        // Selección ponderada
        const rand = Math.random();
        let cumulative = 0;
        let selected = workingSlices[0];

        for (const item of workingSlices) {
            cumulative += item.probability;
            if (rand <= cumulative) {
                selected = item;
                break;
            }
        }

        // Verificación de margen proyectado
        if (selected.cost > 0) {
            const projectedPrizesCost = totalPrizesCost + selected.cost;
            const projectedMargin = ((totalRevenue - projectedPrizesCost) / totalRevenue) * 100;
            if (projectedMargin < 30) {
                console.warn(`🛡️ [Bloqueo Preventivo] Premio "${selected.title}" dejaría margen en ${projectedMargin.toFixed(2)}% (< 30%). Cambiando a intento gratuito.`);
                selected = workingSlices.find(s => s.id === 'FREE_SPIN_1') || workingSlices[0];
            }
        }

        return selected;
    }

    /**
     * Ejecuta una jugada de la Ruleta:
     * 1. Valida si el juego está habilitado.
     * 2. Valida los 3 servicios activos.
     * 3. Valida y descuenta S/ 1.00 de saldo.
     * 4. Calcula premio respetando stock y margen >= 30%.
     * 5. Si ganó servicio: descuenta stock en 1; si el stock total llega a 0, inhabilita el juego automáticamente.
     */
    static async spinRoulette(userId, userName) {
        if (!userId) throw new Error("userId es requerido.");

        const spinCost = 1.00;

        // 1. Obtener configuración
        const settingsRef = db.collection('game_settings').doc('roulette');
        const settingsSnap = await settingsRef.get();
        const settings = settingsSnap.exists ? settingsSnap.data() : DEFAULT_ROULETTE_SETTINGS;

        if (settings.enabled === false) {
            return {
                success: false,
                reason: 'GAME_DISABLED',
                message: 'El juego de Ruleta se encuentra temporalmente deshabilitado por mantenimiento o stock de premios en reposición.'
            };
        }

        // 2. Validar 3 o más servicios activos
        const minReq = settings.minActiveServicesRequired || 3;
        const accessCheck = await this.validateActiveServices(userName, userId, minReq);
        if (!accessCheck.hasAccess) {
            return {
                success: false,
                reason: 'INSUFFICIENT_SERVICES',
                message: `El Módulo de Juegos es exclusivo para clientes VIP con ${minReq} o más servicios activos. Actualmente tienes ${accessCheck.activeCount} servicio(s).`,
                activeCount: accessCheck.activeCount,
                minRequired: minReq
            };
        }

        // MODO DEMO / PRUEBAS: Simulación realista sin afectar finanzas ni stock real
        if (userId === 'demo_cuycito_user' || (userName && userName.toLowerCase().includes('demo'))) {
            const slices = GameController.buildRouletteSlices(settings.services || []);
            const randIndex = Math.floor(Math.random() * slices.length);
            const prize = slices[randIndex];

            const spinId = `spin_demo_${Date.now()}`;
            const spinRecord = {
                id: spinId,
                userId: 'demo_cuycito_user',
                userName: 'Cuycito Demo VIP 🐹',
                userNickname: 'cuycitogodemo',
                userPhone: 'cuycitogodemo',
                cost: 1.00,
                prizeId: prize.id,
                prizeTitle: prize.title,
                prizeType: prize.type,
                prizeService: prize.serviceName || null,
                prizeCostForHouse: prize.cost,
                sliceIndex: randIndex,
                won: prize.type === 'SERVICE',
                isDemo: true,
                timestamp: new Date().toISOString()
            };

            await db.collection('game_spins').doc(spinId).set(spinRecord);

            return {
                success: true,
                spinId,
                prize,
                sliceIndex: randIndex,
                newBalance: 999999.00,
                cost: 1.00,
                isDemo: true
            };
        }

        const userRef = db.collection('users').doc(userId);
        const houseStatsRef = db.collection('game_house_stats').doc('roulette_global');
        const spinId = `spin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const spinRef = db.collection('game_spins').doc(spinId);

        let spinResult = null;

        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new Error("Usuario no encontrado.");

            const userData = userDoc.data();
            const currentBalance = parseFloat(userData.balance || 0);

            if (currentBalance < spinCost) {
                throw new Error(`Saldo insuficiente. Necesitas al menos S/ 1.00 para jugar. Saldo actual: S/ ${currentBalance.toFixed(2)}`);
            }

            const currentSettingsDoc = await transaction.get(settingsRef);
            const currentSettings = currentSettingsDoc.exists ? currentSettingsDoc.data() : DEFAULT_ROULETTE_SETTINGS;

            if (currentSettings.enabled === false) {
                throw new Error("El juego ha sido deshabilitado recientemente.");
            }

            const houseDoc = await transaction.get(houseStatsRef);
            let houseData = houseDoc.exists ? houseDoc.data() : {
                totalSpins: 0,
                totalRevenue: 0.00,
                totalPrizesCost: 0.00,
                houseProfit: 0.00,
                profitMarginPercent: 100.00
            };

            const slices = GameController.buildRouletteSlices(currentSettings.services || []);
            const prize = GameController.calculatePrizeWithStockAndHouseEdge(houseData, slices, currentSettings.services || []);

            let newBalance = parseFloat((currentBalance - spinCost).toFixed(2));
            if (prize.type === 'FREE_SPIN') {
                newBalance = parseFloat((newBalance + spinCost).toFixed(2));
            }

            // Si ganó un servicio, descontar 1 unidad de su stock
            let updatedServices = [...(currentSettings.services || [])];
            let autoDisabledNotice = false;

            if (prize.type === 'SERVICE') {
                updatedServices = updatedServices.map(srv => {
                    if (srv.serviceName === prize.serviceName || srv.id === prize.serviceId) {
                        const newStock = Math.max(0, parseInt(srv.stock || 0) - 1);
                        console.log(`📦 [Stock Actualizado] ${srv.serviceName}: Stock anterior ${srv.stock} ➔ Nuevo stock: ${newStock}`);
                        return { ...srv, stock: newStock };
                    }
                    return srv;
                });

                // Verificar si todos los servicios se quedaron sin stock
                const totalStockRemaining = updatedServices.reduce((sum, s) => sum + parseInt(s.stock || 0), 0);
                if (totalStockRemaining <= 0) {
                    console.warn("🛑 [Stock Agotado Global] Todos los servicios de la ruleta llegaron a 0 stock. Inhabilitando juego automáticamente.");
                    currentSettings.enabled = false;
                    autoDisabledNotice = true;
                }
            }

            // Actualizar métricas globales de la casa
            const newTotalSpins = (houseData.totalSpins || 0) + 1;
            const newTotalRevenue = parseFloat(((houseData.totalRevenue || 0) + spinCost).toFixed(2));
            const newTotalPrizesCost = parseFloat(((houseData.totalPrizesCost || 0) + prize.cost).toFixed(2));
            const newHouseProfit = parseFloat((newTotalRevenue - newTotalPrizesCost).toFixed(2));
            const newProfitMargin = newTotalRevenue > 0 ? parseFloat(((newHouseProfit / newTotalRevenue) * 100).toFixed(2)) : 100;

            const updatedHouseStats = {
                totalSpins: newTotalSpins,
                totalRevenue: newTotalRevenue,
                totalPrizesCost: newTotalPrizesCost,
                houseProfit: newHouseProfit,
                profitMarginPercent: newProfitMargin,
                lastUpdated: new Date().toISOString()
            };

            // Guardar transacción
            transaction.update(userRef, {
                balance: newBalance,
                lastGameSpinAt: new Date().toISOString()
            });

            transaction.set(houseStatsRef, updatedHouseStats);

            transaction.set(settingsRef, {
                ...currentSettings,
                services: updatedServices,
                enabled: currentSettings.enabled,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            const spinRecord = {
                id: spinId,
                userId: userId,
                userName: userName || userData.name || 'Cliente VIP',
                userNickname: userData.nickname || userData.name || '',
                userPhone: userData.phone || '',
                cost: spinCost,
                prizeId: prize.id,
                prizeTitle: prize.title,
                prizeType: prize.type,
                prizeService: prize.serviceName || null,
                prizeCostForHouse: prize.cost,
                sliceIndex: prize.sliceIndex,
                won: prize.type === 'SERVICE',
                timestamp: new Date().toISOString()
            };

            transaction.set(spinRef, spinRecord);

            if (prize.type === 'SERVICE') {
                const rewardId = `rew_${Date.now()}`;
                transaction.set(db.collection('user_rewards').doc(rewardId), {
                    id: rewardId,
                    userId,
                    userName: userData.name || userName,
                    userPhone: userData.phone || '',
                    service: prize.serviceName,
                    claimed: false,
                    wonAt: new Date().toISOString(),
                    spinId: spinId
                });
            }

            spinResult = {
                spinId,
                prize,
                sliceIndex: prize.sliceIndex,
                newBalance,
                cost: spinCost,
                autoDisabledNotice
            };
        });

        console.log(`🎉 [Resultado Jugada] Usuario: ${userName} | Premio: "${spinResult.prize.title}" | Índice: ${spinResult.sliceIndex}`);
        return {
            success: true,
            ...spinResult
        };
    }

    /**
     * Obtiene el resumen financiero personal del cliente en el juego.
     */
    static async getUserGameStats(userId) {
        if (!userId) return null;

        const spinsSnap = await db.collection('game_spins')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();

        let totalSpent = 0;
        let totalWonValue = 0;
        let spinsHistory = [];

        spinsSnap.forEach(doc => {
            const spin = doc.data();
            totalSpent += parseFloat(spin.cost || 1.00);
            totalWonValue += parseFloat(spin.prizeCostForHouse || 0);
            spinsHistory.push(spin);
        });

        return {
            userId,
            totalSpins: spinsHistory.length,
            totalSpent: parseFloat(totalSpent.toFixed(2)),
            totalWonValue: parseFloat(totalWonValue.toFixed(2)),
            netDifference: parseFloat((totalWonValue - totalSpent).toFixed(2)),
            history: spinsHistory
        };
    }
}
