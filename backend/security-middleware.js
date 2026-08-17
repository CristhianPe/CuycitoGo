import crypto from 'crypto';
import { SecurityAuditLogger } from './audit-logger.js';

// Clave secreta compartida de integridad (se puede configurar por variable de entorno)
const APP_INTEGRITY_SECRET = process.env.APP_INTEGRITY_SECRET || 'CuycitoGO_SecKey_2026_x99F4A87B2C1';

// Cache en memoria para prevención de ataques de repetición (Anti-Replay)
// Almacena: nonce -> timestamp de expiración
const usedNoncesCache = new Map();

// Limpieza periódica de nonces expirados cada 2 minutos
setInterval(() => {
    const now = Date.now();
    for (const [nonce, expiresAt] of usedNoncesCache.entries()) {
        if (now > expiresAt) {
            usedNoncesCache.delete(nonce);
        }
    }
}, 120000);

// Cache en memoria para Limitación de Tasa (Sliding Window Rate Limiter)
// Almacena: clientKey -> Array de timestamps de peticiones recientes
const rateLimitWindows = new Map();

// Limpieza periódica de rate limits inactivos cada 5 minutos
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of rateLimitWindows.entries()) {
        const active = timestamps.filter(t => now - t < 60000);
        if (active.length === 0) {
            rateLimitWindows.delete(key);
        } else {
            rateLimitWindows.set(key, active);
        }
    }
}, 300000);

/**
 * Calcula la firma HMAC-SHA256 esperada para validar la integridad del mensaje.
 */
function calculateHmacSignature(payloadString, timestamp, nonce, secret) {
    const message = `${timestamp}.${nonce}.${payloadString}`;
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

/**
 * Middleware para validar la integridad criptográfica de la petición (Anti-Postman / Anti-Replay).
 */
export async function verifyRequestIntegrity(req, res, next) {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
    const timestampHeader = req.headers['x-cuycito-timestamp'];
    const nonceHeader = req.headers['x-cuycito-nonce'];
    const signatureHeader = req.headers['x-cuycito-signature'];

    // 1. Verificar presencia de cabeceras obligatorias de integridad
    if (!timestampHeader || !nonceHeader || !signatureHeader) {
        await SecurityAuditLogger.logSecurityAnomaly({
            eventType: 'MISSING_INTEGRITY_HEADERS',
            severity: 'WARNING',
            userId: req.body?.userId || null,
            userName: req.body?.userInfo?.name || null,
            ip: clientIp,
            endpoint: req.originalUrl,
            details: { missing: { timestamp: !timestampHeader, nonce: !nonceHeader, signature: !signatureHeader } }
        });

        return res.status(401).json({
            success: false,
            error: 'Acceso Denegado: Cabeceras de integridad criptográfica ausentes (X-Cuycito-*).'
        });
    }

    const timestamp = parseInt(timestampHeader, 10);
    const now = Date.now();
    const MAX_TIME_DRIFT_MS = 60000; // Ventana de tolerancia de 60 segundos

    // 2. Verificar ventana de tiempo válida (Anti-Desfase temporal y Anti-Repetición tardía)
    if (isNaN(timestamp) || Math.abs(now - timestamp) > MAX_TIME_DRIFT_MS) {
        await SecurityAuditLogger.logSecurityAnomaly({
            eventType: 'EXPIRED_OR_DRIFTED_TIMESTAMP',
            severity: 'WARNING',
            userId: req.body?.userId || null,
            ip: clientIp,
            endpoint: req.originalUrl,
            details: { clientTimestamp: timestamp, serverTimestamp: now, driftMs: Math.abs(now - timestamp) }
        });

        return res.status(403).json({
            success: false,
            error: 'Acceso Denegado: La petición ha expirado o el reloj del dispositivo está desfasado.'
        });
    }

    // 3. Verificar Anti-Replay (Reutilización de Nonce de un solo uso)
    if (usedNoncesCache.has(nonceHeader)) {
        await SecurityAuditLogger.logSecurityAnomaly({
            eventType: 'REPLAY_ATTACK_DETECTED',
            severity: 'CRITICAL',
            userId: req.body?.userId || null,
            ip: clientIp,
            endpoint: req.originalUrl,
            details: { nonce: nonceHeader, originalRequestTimestamp: timestamp }
        });

        return res.status(403).json({
            success: false,
            error: 'Acceso Denegado: Ataque de repetición detectado (Nonce ya utilizado).'
        });
    }

    // Registrar nonce en caché con expiración de 2 minutos
    usedNoncesCache.set(nonceHeader, now + 120000);

    // 4. Verificar Firma HMAC-SHA256
    const payloadString = JSON.stringify(req.body || {});
    const expectedSignature = calculateHmacSignature(payloadString, timestampHeader, nonceHeader, APP_INTEGRITY_SECRET);

    const isMatch = crypto.timingSafeEqual(
        Buffer.from(signatureHeader, 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
    );

    if (!isMatch) {
        await SecurityAuditLogger.logSecurityAnomaly({
            eventType: 'HMAC_SIGNATURE_MISMATCH',
            severity: 'CRITICAL',
            userId: req.body?.userId || null,
            ip: clientIp,
            endpoint: req.originalUrl,
            details: { receivedSignature: signatureHeader, expectedSignature }
        });

        return res.status(403).json({
            success: false,
            error: 'Acceso Denegado: Firma de integridad inválida. Petición adulterada.'
        });
    }

    // Petición íntegra y verificada
    next();
}

/**
 * Middleware de Rate Limiting por Ventana Deslizante (Anti-Bot / Anti-Spam).
 * @param {number} maxRequests - Máximo de peticiones permitidas en la ventana
 * @param {number} windowMs - Duración de la ventana en milisegundos (default 60s)
 */
export function createRateLimiter(maxRequests = 6, windowMs = 60000) {
    return async (req, res, next) => {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
        const userId = req.body?.userId || clientIp;
        const key = `${userId}:${req.path}`;
        const now = Date.now();

        const timestamps = rateLimitWindows.get(key) || [];
        const validTimestamps = timestamps.filter(t => now - t < windowMs);

        if (validTimestamps.length >= maxRequests) {
            await SecurityAuditLogger.logSecurityAnomaly({
                eventType: 'RATE_LIMIT_BREACH',
                severity: 'WARNING',
                userId: req.body?.userId || null,
                ip: clientIp,
                endpoint: req.originalUrl,
                details: { recentAttempts: validTimestamps.length, maxAllowed: maxRequests, windowMs }
            });

            return res.status(429).json({
                success: false,
                error: `Demasiadas peticiones. Por seguridad, espera unos segundos antes de volver a intentar.`
            });
        }

        validTimestamps.push(now);
        rateLimitWindows.set(key, validTimestamps);
        next();
    };
}
