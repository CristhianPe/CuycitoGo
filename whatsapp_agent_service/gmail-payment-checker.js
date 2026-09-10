// =============================================================
// MÓDULO: gmail-payment-checker.js
// Verificador de Notificaciones de Pagos de Gmail (Ventana: 2h antes a 5min después en el mismo día)
// =============================================================

import dotenv from 'dotenv';
dotenv.config();

const recentPaymentEmails = [];

/**
 * Registra una notificación de correo de pago en el sistema
 */
export function registerIncomingPaymentEmail({ senderName, amount, currency = 'PEN', bank = 'Yape', rawSubject = '', body = '', timestamp = Date.now() }) {
    const numericAmount = parseFloat(amount);
    const amountStr = numericAmount.toFixed(2);

    const record = {
        id: `email_${timestamp}_${Math.floor(Math.random() * 1000)}`,
        senderName: senderName || 'DESCONOCIDO',
        amount: numericAmount,
        amountStr,
        currency,
        bank,
        rawSubject,
        body,
        timestamp,
        receivedAt: new Date().toISOString()
    };

    recentPaymentEmails.unshift(record);

    if (recentPaymentEmails.length > 200) {
        recentPaymentEmails.pop();
    }

    console.log(`📧 [GmailChecker] Notificación de pago registrada: S/ ${amountStr} de "${senderName}" (${bank})`);
    return record;
}

/**
 * Verifica si existe un pago en Gmail con las restricciones exactas pedidas:
 * 1. Mismo día calendario.
 * 2. Ventana de tiempo: MÁXIMO 2 horas antes de la petición y MÁXIMO 5 minutos después.
 */
export async function verifyPaymentInGmail({ amount, requestTimestamp = Date.now(), senderName = null }) {
    const targetAmount = parseFloat(amount);
    if (isNaN(targetAmount) || targetAmount <= 0) {
        return { verified: false, reason: "Monto inválido para verificación." };
    }

    const targetAmountStr = targetAmount.toFixed(2);

    // Ventana de tiempo pedida: 2 horas ANTES y 5 minutos DESPUÉS
    const minTimestamp = requestTimestamp - (2 * 60 * 60 * 1000); // 2 horas antes
    const maxTimestamp = requestTimestamp + (5 * 60 * 1000);    // 5 minutos después

    const reqDate = new Date(requestTimestamp);
    const reqDayStr = reqDate.toISOString().split('T')[0]; // "YYYY-MM-DD" del mismo día

    // Filtrar por mismo día calendario y ventana de 2h antes a 5min después
    const validEmails = recentPaymentEmails.filter(e => {
        const eDate = new Date(e.timestamp);
        const eDayStr = eDate.toISOString().split('T')[0];

        const isSameDay = eDayStr === reqDayStr;
        const isInWindow = e.timestamp >= minTimestamp && e.timestamp <= maxTimestamp;

        return isSameDay && isInWindow;
    });

    // Coincidencia exacta por monto con decimales (ej: 8.17 o 15.18)
    const matched = validEmails.find(e => {
        const isAmountMatch = e.amountStr === targetAmountStr || Math.abs(e.amount - targetAmount) < 0.009;
        if (!isAmountMatch) return false;

        if (senderName && senderName.trim()) {
            const cleanTargetSender = senderName.toLowerCase().trim();
            const cleanEmailSender = (e.senderName || '').toLowerCase().trim();
            return cleanEmailSender.includes(cleanTargetSender) || cleanTargetSender.includes(cleanEmailSender);
        }

        return true;
    });

    if (matched) {
        console.log(`✅ [GmailChecker] Pago VERIFICADO en Gmail (Mismo día, ventana 2h/5m): S/ ${targetAmountStr} de "${matched.senderName}" (${matched.bank})`);
        return {
            verified: true,
            emailRecord: matched,
            amount: matched.amount,
            amountStr: matched.amountStr,
            senderName: matched.senderName,
            bank: matched.bank,
            timestamp: matched.timestamp
        };
    }

    return {
        verified: false,
        reason: `No se encontró notificación en Gmail por S/ ${targetAmountStr} en el mismo día (ventana de 2h antes a 5min después).`
    };
}
