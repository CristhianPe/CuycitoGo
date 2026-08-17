import { db, admin } from './firebase-admin.js';
import { config } from './config.js';

export class RechargeController {

    /**
     * Crea una orden de recarga generando céntimos aleatorios únicos para identificar la transferencia.
     * @param {string} userId - ID del usuario en Firestore (users)
     * @param {number} baseAmount - Monto base solicitado (ej. 10.00)
     * @param {string} currency - Moneda (USD o ARS)
     * @param {object} userInfo - Datos adicionales (nombre, teléfono, nickname)
     */
    static async createRechargeOrder(userId, baseAmount, currency = 'USD', userInfo = {}) {
        if (!userId) throw new Error("userId es obligatorio.");
        const parsedBase = Math.floor(parseFloat(baseAmount) || 0);
        if (parsedBase <= 0) throw new Error("El monto a recargar debe ser mayor a 0.");

        const now = new Date();
        const expirationDate = new Date(now.getTime() + (config.expirationMinutes * 60 * 1000));

        // 1. Obtener órdenes pendientes actuales para evitar colisiones de céntimos
        const pendingSnap = await db.collection('recharge_orders')
            .where('status', '==', 'pending')
            .where('baseAmount', '==', parsedBase)
            .where('currency', '==', currency)
            .get();

        const usedCents = new Set();
        pendingSnap.forEach(doc => {
            const data = doc.data();
            const exp = new Date(data.expiresAt);
            if (exp > now) {
                usedCents.add(data.cents);
            }
        });

        // 2. Generar un céntimo único entre 01 y 99
        let randomCents = null;
        for (let attempt = 0; attempt < 100; attempt++) {
            const candidate = Math.floor(Math.random() * 90) + 10; // entre 10 y 99
            if (!usedCents.has(candidate)) {
                randomCents = candidate;
                break;
            }
        }

        if (randomCents === null) {
            // Si todos los céntimos de dos dígitos estuvieran ocupados (caso extremo), usar un decimal aleatorio
            randomCents = Math.floor(Math.random() * 99) + 1;
        }

        const exactAmount = parseFloat(`${parsedBase}.${randomCents < 10 ? '0' + randomCents : randomCents}`);
        const orderId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const orderData = {
            id: orderId,
            userId,
            userName: userInfo.name || userInfo.nickname || 'Cliente VIP',
            userPhone: userInfo.phone || '',
            userNickname: userInfo.nickname || '',
            baseAmount: parsedBase,
            cents: randomCents,
            exactAmount: exactAmount,
            currency: currency.toUpperCase(),
            status: 'pending', // 'pending' | 'completed' | 'expired' | 'canceled'
            paymentMethod: 'Lemon Cash',
            lemonTag: config.lemon.tag,
            lemonCVU: config.lemon.cvu,
            lemonAlias: config.lemon.alias,
            lemonHolder: config.lemon.holder,
            createdAt: now.toISOString(),
            expiresAt: expirationDate.toISOString(),
            transferReference: null,
            completedAt: null
        };

        await db.collection('recharge_orders').doc(orderId).set(orderData);
        console.log(`📝 [Orden Creada] ID: ${orderId} | Usuario: ${userId} | Monto Exacto Requerido: $${exactAmount} ${currency}`);

        return {
            success: true,
            order: orderData,
            instructions: {
                message: `Transfiere exactamente $${exactAmount.toFixed(2)} desde tu App Lemon Cash a ${config.lemon.tag} o al alias ${config.lemon.alias}.`,
                exactAmount,
                currency,
                lemonTag: config.lemon.tag,
                lemonAlias: config.lemon.alias,
                lemonCVU: config.lemon.cvu,
                expiresInMinutes: config.lemon.expirationMinutes || 30
            }
        };
    }

    /**
     * Procesa una transferencia leída desde el correo de Lemon Cash y realiza la acreditación atómica.
     * @param {object} transferData - Datos extraídos del correo
     */
    static async processLemonTransfer({ amount, sender = '', reference = '', date = new Date(), emailMessageId = '', rawSnippet = '' }) {
        const normalizedAmount = parseFloat(parseFloat(amount).toFixed(2));
        if (!normalizedAmount || normalizedAmount <= 0) {
            console.warn("⚠️ [Procesador Lemon] Monto inválido recibido:", amount);
            return { success: false, reason: "Monto inválido" };
        }

        const safeEmailId = emailMessageId ? emailMessageId.replace(/[^a-zA-Z0-9_-]/g, '_') : `email_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        // 1. Verificación de Idempotencia: ¿Ya se procesó este correo o ID de transacción?
        const emailRef = db.collection('processed_emails').doc(safeEmailId);
        const emailDoc = await emailRef.get();
        if (emailDoc.exists) {
            console.log(`ℹ️ [Anti-Duplicación] El correo ID ${safeEmailId} ya fue procesado anteriormente. Omitiendo.`);
            return { success: false, reason: "already_processed", emailId: safeEmailId };
        }

        if (reference) {
            const refQuery = await db.collection('recharge_orders').where('transferReference', '==', reference).get();
            if (!refQuery.empty) {
                console.log(`ℹ️ [Anti-Duplicación] La referencia Lemon Cash ${reference} ya fue acreditada. Omitiendo.`);
                return { success: false, reason: "reference_already_credited", reference };
            }
        }

        // 2. Buscar orden pendiente que coincida EXACTAMENTE con el monto con céntimos
        console.log(`🔍 [Búsqueda de Coincidencia] Buscando orden pendiente con monto exacto: ${normalizedAmount}`);
        const ordersQuery = await db.collection('recharge_orders')
            .where('status', '==', 'pending')
            .where('exactAmount', '==', normalizedAmount)
            .get();

        if (ordersQuery.empty) {
            console.warn(`⚠️ [Sin Coincidencia] No se encontró ninguna orden pendiente con el monto exacto: $${normalizedAmount}`);
            
            // Guardar en transferencias no conciliadas para revisión del administrador
            const unmatchedId = `unmatched_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            await db.collection('unmatched_transfers').doc(unmatchedId).set({
                id: unmatchedId,
                amount: normalizedAmount,
                sender,
                reference,
                date: new Date(date).toISOString(),
                emailMessageId: safeEmailId,
                rawSnippet,
                recordedAt: new Date().toISOString(),
                resolved: false
            });

            await emailRef.set({
                emailMessageId: safeEmailId,
                amount: normalizedAmount,
                status: 'unmatched',
                processedAt: new Date().toISOString()
            });

            return { success: false, reason: "no_matching_order_found", amount: normalizedAmount };
        }

        // Tomar la orden más reciente si hubiera más de una coincidencia
        const matchingDoc = ordersQuery.docs[0];
        const order = matchingDoc.data();
        const orderRef = matchingDoc.ref;
        const userRef = db.collection('users').doc(order.userId);

        // 3. Ejecutar Transacción Atómica de Acreditación
        try {
            await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) {
                    throw new Error(`Usuario ${order.userId} no encontrado en la base de datos.`);
                }

                const userData = userDoc.data();
                const currentBalance = parseFloat(userData.balance || 0);
                const newBalance = parseFloat((currentBalance + normalizedAmount).toFixed(2));

                const completedTimestamp = new Date().toISOString();

                // a. Actualizar orden a 'completed'
                transaction.update(orderRef, {
                    status: 'completed',
                    completedAt: completedTimestamp,
                    transferReference: reference || `LEMON_${Date.now()}`,
                    senderInfo: sender || 'Transferencia Lemon Cash',
                    creditedAmount: normalizedAmount
                });

                // b. Acreditar saldo atómicamente al usuario
                transaction.update(userRef, {
                    balance: newBalance,
                    lastRechargeAt: completedTimestamp
                });

                // c. Registrar en processed_emails para evitar duplicaciones
                transaction.set(emailRef, {
                    emailMessageId: safeEmailId,
                    orderId: order.id,
                    userId: order.userId,
                    amount: normalizedAmount,
                    status: 'credited',
                    processedAt: completedTimestamp
                });

                // d. Registrar en historial contable
                const txHistoryId = `tx_rec_${Date.now()}`;
                const historyRef = db.collection('history').doc(txHistoryId);
                transaction.set(historyRef, {
                    id: txHistoryId,
                    date: completedTimestamp.split('T')[0],
                    type: 'RECARGA_LEMON',
                    person: order.userName || order.userId,
                    service: 'Recarga Lemon Cash',
                    amount: normalizedAmount,
                    currency: order.currency || 'USD',
                    orderId: order.id,
                    reference: reference || null
                });
            });

            console.log(`🎉 [ACREDITACIÓN EXITOSA] Orden ${order.id} acreditada al usuario ${order.userId} por $${normalizedAmount} ${order.currency}`);
            return {
                success: true,
                orderId: order.id,
                userId: order.userId,
                creditedAmount: normalizedAmount,
                currency: order.currency
            };

        } catch (txError) {
            console.error("❌ [Error en Transacción Atómica de Recarga]:", txError);
            throw txError;
        }
    }

    /**
     * Consulta el estado de una orden de recarga.
     */
    static async getOrderStatus(orderId) {
        if (!orderId) throw new Error("orderId es requerido.");
        const docSnap = await db.collection('recharge_orders').doc(orderId).get();
        if (!docSnap.exists) return null;
        
        const data = docSnap.data();
        const isExpired = data.status === 'pending' && new Date(data.expiresAt) < new Date();
        if (isExpired) {
            data.status = 'expired';
            await db.collection('recharge_orders').doc(orderId).update({ status: 'expired' });
        }
        return data;
    }

    /**
     * Lista el historial de recargas de un usuario.
     */
    static async getUserRecharges(userId) {
        if (!userId) return [];
        const snap = await db.collection('recharge_orders')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();

        const list = [];
        snap.forEach(doc => list.push(doc.data()));
        return list;
    }
}
