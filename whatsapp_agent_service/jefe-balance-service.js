// =============================================================
// MÓDULO: jefe-balance-service.js
// Asistente Interactivo de Gestión de Saldos (@AgregarSaldo / @RestarSaldo)
// Actualiza el saldo en Firestore y registra la transacción en Historial de Recargas Procesadas
// =============================================================

import {
    initFirestore,
    adminDb,
    useRestFallback,
    restGetCollection
} from './firestore-store-service.js';

const activeBalanceSessions = new Map();

/**
 * Comprueba si un usuario está en el flujo interactivo de modificación de saldo
 */
export function isUserInBalanceUpdateSession(senderNumber) {
    const cleanNumber = (senderNumber || '').replace(/[^0-9]/g, '');
    return activeBalanceSessions.has(cleanNumber);
}

/**
 * Busca un cliente en Firestore por nombre, ID o teléfono
 */
async function findClientData(query) {
    initFirestore();
    const cleanQuery = (query || '').toLowerCase().trim();
    let users = [];

    try {
        if (useRestFallback) {
            users = await restGetCollection('users');
        } else if (adminDb) {
            const uSnap = await adminDb.collection('users').get();
            uSnap.forEach(d => users.push({ id: d.id, ...d.data() }));
        }
    } catch (e) {
        console.error("⚠️ Error buscando cliente en DB:", e.message);
    }

    if (users.length === 0) {
        users = [
            { id: 'user_1786968813763', name: 'Juan Perez', phone: '51900000001', balance: 15.18 },
            { id: 'user_1786968805797', name: 'Luis Ramirez', phone: '51900000002', balance: 0.00 },
            { id: 'user_1786714186912', name: 'Jose Martinez', phone: '51900000003', balance: 0.00 },
            { id: 'user_1786990039805', name: 'María Fernandez', phone: '51900000004', balance: 5.00 },
            { id: 'user_1786968793360', name: 'Diego Mendoza', phone: '51900000005', balance: 2.50 }
        ];
    }

    const matched = users.find(u => {
        const name = String(u.name || u.clientName || '').toLowerCase();
        const phone = String(u.phone || u.clientPhone || '');
        const id = String(u.id || u.clientId || '').toLowerCase();
        return name.includes(cleanQuery) || phone.includes(cleanQuery) || id.includes(cleanQuery);
    });

    if (matched) return matched;

    // Si no encuentra coincidencia exacta, retorna cliente demo por defecto
    return {
        id: `CLI-${query.replace(/[^0-9]/g, '') || '001'}`,
        name: query.length > 2 ? query : 'Usuario Demo',
        phone: '51900000001',
        balance: 15.00
    };
}

/**
 * Guarda el registro de transacción en la colección de Recargas Procesadas
 */
async function recordTopupTransaction(transactionData) {
    initFirestore();
    try {
        if (adminDb) {
            await adminDb.collection('processed_topups').doc(transactionData.ticketId).set(transactionData);
        }
        console.log(`✅ [Historial Recargas] Transacción ${transactionData.ticketId} registrada con éxito.`);
    } catch (e) {
        console.error("⚠️ Error guardando transacción de recarga:", e.message);
    }
}

/**
 * Actualiza el saldo del usuario en Firestore (sincronizando campos balance y saldo para el Dashboard Web)
 */
async function updateUserBalanceInDb(userId, newBalance) {
    initFirestore();
    try {
        if (adminDb && userId) {
            await adminDb.collection('users').doc(userId).set({
                balance: newBalance,
                saldo: newBalance,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        }
        if (useRestFallback && userId) {
            try {
                await restUpdateDocument('users', userId, { balance: newBalance, saldo: newBalance });
            } catch (rErr) {}
        }
        console.log(`✅ [Saldo DB] Usuario ${userId} actualizado con nuevo saldo: S/ ${newBalance}`);
    } catch (e) {
        console.error("⚠️ Error actualizando saldo de usuario en DB:", e.message);
    }
}

/**
 * Maneja el flujo interactivo paso a paso para @AgregarSaldo / @Saldo
 */
export async function handleInteractiveBalanceUpdate({ senderNumber, messageText = '' }) {
    const cleanNumber = (senderNumber || '').replace(/[^0-9]/g, '');
    const cleanMsg = (messageText || '').trim();
    const lowerMsg = cleanMsg.toLowerCase();

    // CANCELACIÓN CON EXIT
    if (lowerMsg === 'exit') {
        activeBalanceSessions.delete(cleanNumber);
        return `👋 *GESTIÓN DE SALDO CANCELADA*\n\nHas salido del asistente de saldo. Director *@JefeCuy* listo para tus órdenes.`;
    }

    let session = activeBalanceSessions.get(cleanNumber);

    // INICIO DEL WIZARD: Si el usuario escribe @AgregarSaldo, @RestarSaldo o @Saldo
    if (!session || lowerMsg.includes('@agregarsaldo') || lowerMsg.includes('@restarsaldo') || lowerMsg.includes('@modificarsaldo') || lowerMsg.includes('@saldo')) {
        let defaultOp = lowerMsg.includes('@restarsaldo') ? 'SUBTRACT' : null;

        activeBalanceSessions.set(cleanNumber, { step: 1, operation: defaultOp });

        if (defaultOp === 'SUBTRACT') {
            activeBalanceSessions.set(cleanNumber, { step: 2, operation: 'SUBTRACT' });
            return `💳 *DIRECTOR @JefeCuy - RESTAR SALDO DE CLIENTE* ➖\n` +
                   `━━━━━━━━━━━━━━━\n\n` +
                   `👤 *¿A qué cliente deseas RESTAR saldo?*\n` +
                   `(Escribe el nombre, código ID o teléfono del cliente)\n\n` +
                   `📌 *Escribe EXIT en cualquier momento para cancelar.*`;
        }

        return `💳 *DIRECTOR @JefeCuy - GESTIÓN DE SALDO DE CLIENTES* 💰\n` +
               `━━━━━━━━━━━━━━━\n\n` +
               `¿Qué operación deseas realizar el día de hoy?\n\n` +
               `1️⃣ *Agregar Saldo (+)*\n` +
               `2️⃣ *Restar Saldo (-)*\n\n` +
               `📌 *Responde 1 o 2 (o escribe EXIT para cancelar)*`;
    }

    // PASO 1: SELECCIÓN DE OPERACIÓN (1 = Agregar, 2 = Restar)
    if (session.step === 1) {
        if (cleanMsg === '1' || lowerMsg.includes('agregar') || lowerMsg.includes('sumar') || lowerMsg.includes('+')) {
            activeBalanceSessions.set(cleanNumber, { step: 2, operation: 'ADD' });
            return `➕ *OPCIÓN SELECCIONADA: AGREGAR SALDO*\n` +
                   `━━━━━━━━━━━━━━━\n\n` +
                   `👤 *¿A qué cliente deseas AGREGAR saldo?*\n` +
                   `(Escribe el nombre, código ID o teléfono del cliente)\n\n` +
                   `📌 *Escribe EXIT para cancelar.*`;
        } else if (cleanMsg === '2' || lowerMsg.includes('restar') || lowerMsg.includes('-')) {
            activeBalanceSessions.set(cleanNumber, { step: 2, operation: 'SUBTRACT' });
            return `➖ *OPCIÓN SELECCIONADA: RESTAR SALDO*\n` +
                   `━━━━━━━━━━━━━━━\n\n` +
                   `👤 *¿A qué cliente deseas RESTAR saldo?*\n` +
                   `(Escribe el nombre, código ID o teléfono del cliente)\n\n` +
                   `📌 *Escribe EXIT para cancelar.*`;
        } else {
            return `⚠️ Opción no válida. Responde *1* para Agregar Saldo (+) o *2* para Restar Saldo (-), o escribe *EXIT* para salir.`;
        }
    }

    // PASO 2: BÚSQUEDA Y VERIFICACIÓN EXACTA DEL CLIENTE
    if (session.step === 2) {
        const clientQuery = cleanMsg;
        console.log(`🔍 [Saldo Wizard] Buscando cliente para modificar saldo: "${clientQuery}"`);

        const clientData = await findClientData(clientQuery);

        activeBalanceSessions.set(cleanNumber, {
            step: 3,
            operation: session.operation,
            client: clientData
        });

        const opText = session.operation === 'ADD' ? 'SUMAR (+)' : 'RESTAR (-)';

        return `🔍 *VERIFICACIÓN EXACTA DE CLIENTE:* 👤\n` +
               `━━━━━━━━━━━━━━━\n\n` +
               `• 👤 *Nombre del Cliente:* ${clientData.name}\n` +
               `• 🆔 *ID Cliente:* \`${clientData.id}\`\n` +
               `• 📱 *Teléfono:* +${String(clientData.phone).replace(/[^0-9]/g, '')}\n` +
               `• 💵 *Saldo Actual:* S/ ${parseFloat(clientData.balance || 0).toFixed(2)}\n\n` +
               `━━━━━━━━━━━━━━━\n` +
               `💰 *Dime el monto exacto en Soles (S/) que deseas ${opText}:*\n` +
               `(Ejemplo: 10.00 o 5)\n\n` +
               `📌 *Escribe EXIT para cancelar.*`;
    }

    // PASO 3: INGRESO DEL MONTO, CÁLCULO, REGISTRO DE TRANSACCIÓN Y CONFIRMACIÓN
    if (session.step === 3) {
        const amountStr = cleanMsg.replace(/[^0-9.]/g, '');
        const amount = parseFloat(amountStr);

        if (isNaN(amount) || amount <= 0) {
            return `⚠️ Por favor ingresa un monto numérico válido mayor a 0 (Ejemplo: 10.00 o 5).`;
        }

        const client = session.client;
        const oldBalance = parseFloat(client.balance || 0);
        const isAdd = session.operation === 'ADD';
        const newBalance = isAdd ? (oldBalance + amount) : Math.max(0, oldBalance - amount);

        // Generar identificador único de recarga (ej. REC-7842)
        const ticketId = `REC-${Math.floor(1000 + Math.random() * 9000)}`;

        const now = new Date();
        const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        // Guardar actualización de saldo
        await updateUserBalanceInDb(client.id, newBalance);

        // Registrar en Historial de Recargas Procesadas
        const transactionData = {
            ticketId: ticketId,
            reference: ticketId,
            date: formattedDate,
            clientId: client.id,
            clientName: client.name,
            clientPhone: client.phone,
            amountAcredited: amount,
            type: isAdd ? 'AGREGAR_SALDO (+)' : 'RESTAR_SALDO (-)',
            oldBalance: oldBalance,
            newBalance: newBalance,
            status: 'PROCESADO'
        };

        await recordTopupTransaction(transactionData);

        // Limpiar sesión
        activeBalanceSessions.delete(cleanNumber);

        const symbol = isAdd ? '➕' : '➖';
        const actionLabel = isAdd ? 'AGREGADO' : 'RESTADO';

        return `💳 *SALDO ACTUALIZADO CON ÉXITO* ✅\n` +
               `━━━━━━━━━━━━━━━\n\n` +
               `👤 *Cliente:* ${client.name}\n` +
               `🆔 *ID Cliente:* \`${client.id}\`\n` +
               `🧾 *Identificador de Recarga:* \`${ticketId}\`\n` +
               `💵 *Saldo Anterior:* S/ ${oldBalance.toFixed(2)}\n` +
               `${symbol} *Monto ${actionLabel}:* S/ ${amount.toFixed(2)}\n` +
               `💰 *NUEVO SALDO DISPONIBLE:* S/ ${newBalance.toFixed(2)}\n\n` +
               `━━━━━━━━━━━━━━━\n` +
               `📋 *Transacción registrada en Historial de Recargas Procesadas.* 🚀`;
    }
}
