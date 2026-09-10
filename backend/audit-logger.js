import { db } from './firebase-admin.js';

export class SecurityAuditLogger {
    /**
     * Registra un evento de seguridad o anomalía en Firestore.
     * @param {Object} event - Datos del evento sospechoso
     */
    static async logSecurityAnomaly({
        eventType,
        severity = 'WARNING', // 'INFO' | 'WARNING' | 'CRITICAL'
        userId = null,
        userName = null,
        ip = null,
        endpoint = null,
        details = {}
    }) {
        const logId = `sec_log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const logRecord = {
            id: logId,
            eventType, // ej. 'HMAC_SIGNATURE_MISMATCH', 'REPLAY_ATTACK', 'RATE_LIMIT_BREACH', 'CLIENT_TAMPER_DETECTED'
            severity,
            userId: userId || 'ANONYMOUS',
            userName: userName || 'Desconocido',
            ip: ip || '0.0.0.0',
            endpoint: endpoint || 'UNKNOWN',
            details,
            timestamp: new Date().toISOString()
        };

        try {
            console.warn(`🚨 [SECURITY EVENT - ${severity}] ${eventType} | User: ${logRecord.userName} (${logRecord.userId}) | IP: ${logRecord.ip}`);
            await db.collection('security_audit_logs').doc(logId).set(logRecord);
        } catch (err) {
            console.error("❌ Error al guardar log de seguridad en Firestore:", err);
        }

        return logRecord;
    }
}
