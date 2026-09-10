// =============================================================
// MÓDULO: payment-verification-service.js
// Servicio de Verificación de Pagos, Centavos Únicos, Tickets y Recargas
// =============================================================

import {
    initFirestore,
    adminDb,
    useRestFallback,
    restGetCollection,
    restUpdateDocument,
    cleanPhoneNumber,
    collectionCache
} from './firestore-store-service.js';

const activeCentReservations = new Map();
const usedAmountLocks24h = new Map();
const activeTicketsMap = new Map();

/**
 * Cuenta cuántos tickets de recarga ha creado el cliente en las últimas 24 horas (Límite: Máximo 3).
 */
export async function countUserTicketsIn24h(clientId) {
    initFirestore();
    const cleanId = (clientId || '').toLowerCase().trim();
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    let count = 0;

    // Conteo en memoria
    activeTicketsMap.forEach(t => {
        if ((t.clientId === cleanId || t.senderNumber === cleanId) && t.createdAtTimestamp > twentyFourHoursAgo) {
            count++;
        }
    });

    try {
        let allTickets = [];
        if (useRestFallback) {
            allTickets = await restGetCollection('topup_tickets');
        } else if (adminDb) {
            const snap = await adminDb.collection('topup_tickets').get();
            snap.forEach(d => allTickets.push({ id: d.id, ...d.data() }));
        }

        allTickets.forEach(t => {
            const tTime = t.createdAtTimestamp || t.timestamp || 0;
            if ((t.clientId === cleanId || t.senderNumber === cleanId) && tTime > twentyFourHoursAgo) {
                count++;
            }
        });
    } catch (e) {
        console.error("⚠️ Error consultando tickets de recarga:", e.message);
    }

    return count;
}

/**
 * Crea un ticket de recarga de 15 minutos con ID único y monto con centavos aleatorios.
 * Aplica la regla anti-spam de máximo 3 tickets por cliente cada 24 horas.
 */
export async function createTopupTicket({ clientId, senderNumber, baseAmountInput }) {
    initFirestore();
    const cleanId = clientId || senderNumber;
    const baseAmount = Math.floor(parseFloat(baseAmountInput));

    if (isNaN(baseAmount) || baseAmount <= 0) {
        throw new Error("El monto base debe ser un número positivo.");
    }

    // Verificar límite anti-spam de 3 tickets en 24 horas
    const userTicketCount = await countUserTicketsIn24h(cleanId);
    if (userTicketCount >= 3) {
        return {
            error: true,
            reason: "LIMIT_REACHED",
            message: "⚠️ *LÍMITE ALCANZADO:* Has alcanzado el límite máximo de 3 solicitudes de recarga en 24 horas. Intenta más tarde o escribe a @CuycitoSupport para asistencia."
        };
    }

    const unique = await generateUniqueAmount(baseAmount, cleanId);
    const now = Date.now();
    const ticketId = `TCK-${Math.floor(1000 + Math.random() * 9000)}`;
    const expiresAt = now + (15 * 60 * 1000); // Expiración en 15 minutos exactamente

    const ticket = {
        ticketId,
        clientId: cleanId,
        senderNumber: senderNumber || cleanId,
        baseAmount,
        totalAmount: unique.totalAmount,
        totalAmountStr: unique.totalAmountStr,
        createdAtTimestamp: now,
        expiresAtTimestamp: expiresAt,
        status: 'OPEN', // OPEN, EXPIRED, VERIFIED
        createdAt: new Date().toISOString()
    };

    activeTicketsMap.set(ticketId, ticket);

    try {
        if (useRestFallback) {
            await restUpdateDocument('topup_tickets', ticketId, ticket);
        } else if (adminDb) {
            await adminDb.collection('topup_tickets').doc(ticketId).set(ticket);
        }
    } catch (e) {
        console.error("Error guardando ticket en Firestore:", e.message);
    }

    return {
        error: false,
        ticketId,
        ticket,
        unique
    };
}

/**
 * Busca un ticket válido no expirado (< 15 minutos) para un monto y cliente especificados.
 */
export async function getValidTicketForAmount(clientId, amountInput) {
    initFirestore();
    const amountStr = parseFloat(amountInput).toFixed(2);
    const now = Date.now();
    const cleanId = (clientId || '').toLowerCase().trim();

    // 1. Buscar en memoria
    for (const [id, t] of activeTicketsMap.entries()) {
        if (t.totalAmountStr === amountStr && t.status === 'OPEN') {
            if (now > t.expiresAtTimestamp) {
                t.status = 'EXPIRED';
                return { valid: false, expired: true, ticket: t, reason: "El ticket de recarga expiró después de 15 minutos." };
            }
            return { valid: true, expired: false, ticket: t };
        }
    }

    // 2. Buscar en Firestore
    try {
        let allTickets = [];
        if (useRestFallback) {
            allTickets = await restGetCollection('topup_tickets');
        } else if (adminDb) {
            const snap = await adminDb.collection('topup_tickets').get();
            snap.forEach(d => allTickets.push({ id: d.id, ...d.data() }));
        }

        const matched = allTickets.find(t => t.totalAmountStr === amountStr && t.status === 'OPEN');
        if (matched) {
            if (now > (matched.expiresAtTimestamp || 0)) {
                matched.status = 'EXPIRED';
                return { valid: false, expired: true, ticket: matched, reason: "El ticket de recarga expiró después de 15 minutos." };
            }
            return { valid: true, expired: false, ticket: matched };
        }
    } catch (e) {
        console.error("Error buscando ticket:", e.message);
    }

    return { valid: true, expired: false, ticket: null }; // Permite si no había ticket previo registrado
}

/**
 * Genera un monto único con centavos aleatorios (ej: 8.17, 8.15, 8.10) para un cliente.
 */
export async function generateUniqueAmount(baseAmountInput, clientId) {
    initFirestore();
    const baseAmount = Math.floor(parseFloat(baseAmountInput));
    if (isNaN(baseAmount) || baseAmount <= 0) {
        throw new Error("El monto base debe ser un número entero positivo mayor a 0.");
    }

    const now = Date.now();
    const baseKey = `BASE_${baseAmount}`;

    if (!activeCentReservations.has(baseKey)) {
        activeCentReservations.set(baseKey, new Map());
    }
    const centMap = activeCentReservations.get(baseKey);

    const lockedCents = await getLockedCentsForBase(baseAmount);
    const availableCents = [];

    for (let c = 10; c <= 50; c++) {
        const centStr = c < 10 ? `0${c}` : `${c}`;
        const totalAmountStr = `${baseAmount}.${centStr}`;

        const isReserved = centMap.has(centStr) && centMap.get(centStr).expiresAt > now;
        const isLocked24h = lockedCents.has(centStr) || usedAmountLocks24h.has(totalAmountStr);

        if (!isReserved && !isLocked24h) {
            availableCents.push(centStr);
        }
    }

    if (availableCents.length === 0) {
        for (let c = 1; c <= 9; c++) {
            const centStr = `0${c}`;
            const totalAmountStr = `${baseAmount}.${centStr}`;
            if (!usedAmountLocks24h.has(totalAmountStr)) {
                availableCents.push(centStr);
            }
        }
    }

    if (availableCents.length === 0) {
        throw new Error(`No hay combinaciones de centavos disponibles para S/ ${baseAmount} en las últimas 24 horas.`);
    }

    const randomIndex = Math.floor(Math.random() * availableCents.length);
    const selectedCent = availableCents[randomIndex];

    const totalAmount = parseFloat(`${baseAmount}.${selectedCent}`);
    const totalAmountStr = totalAmount.toFixed(2);
    const expiresAt = now + (15 * 60 * 1000);

    centMap.set(selectedCent, {
        clientId,
        baseAmount,
        totalAmount,
        totalAmountStr,
        expiresAt
    });

    return {
        baseAmount,
        cent: selectedCent,
        totalAmount,
        totalAmountStr,
        expiresAt
    };
}

async function getLockedCentsForBase(baseAmount) {
    const lockedCents = new Set();
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);

    try {
        let allUsedPayments = [];
        if (useRestFallback) {
            allUsedPayments = await restGetCollection('used_payments');
        } else if (adminDb) {
            const snap = await adminDb.collection('used_payments').get();
            snap.forEach(d => allUsedPayments.push({ id: d.id, ...d.data() }));
        }

        allUsedPayments.forEach(p => {
            const pTime = p.timestamp || p.createdAt || 0;
            if (pTime > twentyFourHoursAgo && Math.floor(p.baseAmount || p.amount) === baseAmount) {
                const amtStr = parseFloat(p.amount).toFixed(2);
                const centStr = amtStr.split('.')[1];
                if (centStr) lockedCents.add(centStr);
            }
        });
    } catch (e) {
        console.error("⚠️ Error consultando centavos bloqueados:", e.message);
    }

    return lockedCents;
}

export async function isAmountLockedOrUsed(amountInput) {
    initFirestore();
    const targetAmount = parseFloat(amountInput).toFixed(2);

    if (usedAmountLocks24h.has(targetAmount)) {
        const lockTime = usedAmountLocks24h.get(targetAmount);
        if (Date.now() - lockTime < (24 * 60 * 60 * 1000)) {
            return true;
        }
    }

    try {
        let allUsedPayments = [];
        if (useRestFallback) {
            allUsedPayments = await restGetCollection('used_payments');
        } else if (adminDb) {
            const snap = await adminDb.collection('used_payments').get();
            snap.forEach(d => allUsedPayments.push({ id: d.id, ...d.data() }));
        }

        const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
        const matched = allUsedPayments.find(p => {
            const amtStr = parseFloat(p.amount).toFixed(2);
            const pTime = p.timestamp || p.createdAt || 0;
            return amtStr === targetAmount && pTime > twentyFourHoursAgo;
        });

        if (matched) {
            usedAmountLocks24h.set(targetAmount, matched.timestamp || Date.now());
            return true;
        }
    } catch (e) {
        console.error("⚠️ Error comprobando seguro de monto usado:", e.message);
    }

    return false;
}

export async function lockAndDiscardAmount(totalAmountInput, transactionData = {}) {
    initFirestore();
    const totalAmount = parseFloat(totalAmountInput);
    const amountStr = totalAmount.toFixed(2);
    const now = Date.now();

    usedAmountLocks24h.set(amountStr, now);

    const record = {
        amount: totalAmount,
        amountStr,
        baseAmount: Math.floor(totalAmount),
        clientId: transactionData.clientId || 'UNKNOWN',
        ticketId: transactionData.ticketId || null,
        senderName: transactionData.senderName || 'DESCONOCIDO',
        channel: transactionData.channel || 'CHAT',
        timestamp: now,
        createdAt: new Date().toISOString()
    };

    try {
        if (useRestFallback) {
            await restUpdateDocument('used_payments', `pay_${now}_${Math.floor(Math.random()*1000)}`, record);
        } else if (adminDb) {
            await adminDb.collection('used_payments').add(record);
        }
        console.log(`🔒 [Anti-Fraude] Monto S/ ${amountStr} BLOQUEADO por 24h (Ticket ${record.ticketId || 'N/A'}).`);
    } catch (e) {
        console.error("Error al guardar bloqueo de pago en Firestore:", e.message);
    }

    return record;
}

export async function addBalanceToCustomer(queryOrClientId, amountToAdd) {
    initFirestore();
    const numericAmount = parseFloat(amountToAdd);
    if (isNaN(numericAmount) || numericAmount <= 0) {
        throw new Error("El monto a recargar debe ser un número positivo.");
    }

    const queryClean = (queryOrClientId || '').toLowerCase().trim();
    const phoneClean = cleanPhoneNumber(queryOrClientId);

    let allUsers = [];
    if (useRestFallback) {
        allUsers = await restGetCollection('users');
    } else if (adminDb) {
        const snap = await adminDb.collection('users').get();
        snap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
    }

    let targetUser = allUsers.find(u => {
        const codeMatch = (u.clientCode && u.clientCode.toLowerCase() === queryClean) || u.id === queryClean || u.id.toLowerCase() === queryClean;
        const phoneMatch = phoneClean && cleanPhoneNumber(u.phone || u.clientPhone) === phoneClean;
        const nameMatch = u.name && u.name.toLowerCase().includes(queryClean);
        return codeMatch || phoneMatch || nameMatch;
    });

        const demoPhone = (process.env.ADMIN_WHATSAPP_NUMBERS || '51900000000').split(',')[0].trim();
        const testUserDoc = {
            id: `user_${phoneClean || demoPhone}`,
            clientCode: `CLI-${(phoneClean || demoPhone).slice(-4)}`,
            name: 'Administrador Demo',
            phone: phoneClean || demoPhone,
            balance: 0,
            createdAt: new Date().toISOString()
        };
        try {
            if (useRestFallback) {
                await restUpdateDocument('users', testUserDoc.id, testUserDoc);
            } else if (adminDb) {
                await adminDb.collection('users').doc(testUserDoc.id).set(testUserDoc);
            }
            targetUser = testUserDoc;
            console.log(`👤 [Chat de Prueba] Registrado cliente de prueba para (${phoneClean})`);
        } catch (err) {
            throw new Error(`No se encontró al cliente "${queryOrClientId}" para acreditar el saldo.`);
        }
    }

    const currentBalance = parseFloat(targetUser.balance || 0);
    const newBalance = parseFloat((currentBalance + numericAmount).toFixed(2));

    const updateFields = {
        balance: newBalance,
        lastTopupAt: new Date().toISOString(),
        lastTopupAmount: numericAmount
    };

    if (useRestFallback) {
        await restUpdateDocument('users', targetUser.id, updateFields);
    } else if (adminDb) {
        await adminDb.collection('users').doc(targetUser.id).update(updateFields);
    }

    collectionCache.delete('users');

    console.log(`💰 [Saldo Acreditado] Cliente ${targetUser.name} (${targetUser.id}): S/ ${currentBalance} ➔ S/ ${newBalance}`);

    return {
        user: targetUser,
        oldBalance: currentBalance,
        newBalance: newBalance,
        addedAmount: numericAmount
    };
}
