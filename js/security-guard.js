/**
 * 🛡️ CuycitoGO Client Security Guard & Anti-Cheat Module
 * Provee firma criptográfica HMAC-SHA256 en cliente, prevención anti-replay,
 * inmutabilidad de variables y telemetría de anomalías.
 */

(function(global) {
    'use strict';

    // Clave de integridad para firma de peticiones (se comparte con el backend)
    const CLIENT_INTEGRITY_KEY = 'CuycitoGO_SecKey_2026_x99F4A87B2C1';
    
    // Almacén de última petición de giro para telemetría de ráfagas
    let lastSpinTimestamp = 0;

    /**
     * Convierte un string a ArrayBuffer para Web Crypto API
     */
    function stringToArrayBuffer(str) {
        const enc = new TextEncoder();
        return enc.encode(str);
    }

    /**
     * Convierte un ArrayBuffer a string hexadecimal
     */
    function bufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Genera un identificador Nonce criptográficamente seguro
     */
    function generateSecureNonce() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Calcula una firma HMAC-SHA256 utilizando la Web Crypto API nativa del navegador.
     */
    async function generateHmacSha256(message, secret) {
        if (!crypto || !crypto.subtle) {
            // Fallback si SubtleCrypto no está disponible (ej. entornos inseguros no https)
            return 'fallback_crypto_unavailable';
        }

        const keyData = stringToArrayBuffer(secret);
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const messageBuffer = stringToArrayBuffer(message);
        const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageBuffer);
        return bufferToHex(signatureBuffer);
    }

    const SecurityGuard = {
        /**
         * Firma una petición HTTP saliente con cabeceras de integridad criptográfica.
         * @param {Object} payload - Cuerpo de la petición en formato objeto
         * @returns {Promise<Object>} Cabeceras HTTP firmadas
         */
        async signPayload(payload = {}) {
            const timestamp = Date.now().toString();
            const nonce = generateSecureNonce();
            const payloadString = JSON.stringify(payload);
            const message = `${timestamp}.${nonce}.${payloadString}`;

            const signature = await generateHmacSha256(message, CLIENT_INTEGRITY_KEY);

            return {
                'Content-Type': 'application/json',
                'X-Cuycito-Timestamp': timestamp,
                'X-Cuycito-Nonce': nonce,
                'X-Cuycito-Signature': signature
            };
        },

        /**
         * Valida el intervalo de tiempo entre giros para prevenir ráfagas o llamadas desde consola.
         * @param {number} minIntervalMs - Tiempo mínimo en milisegundos
         * @returns {boolean}
         */
        checkSpinInterval(minIntervalMs = 4500) {
            const now = Date.now();
            const timeSinceLast = now - lastSpinTimestamp;

            if (lastSpinTimestamp > 0 && timeSinceLast < minIntervalMs) {
                this.reportTamper('RAPID_SPIN_BURST_ATTEMPT', {
                    timeSinceLastMs: timeSinceLast,
                    minExpectedMs: minIntervalMs
                });
                return false;
            }

            lastSpinTimestamp = now;
            return true;
        },

        /**
         * Envía un reporte de telemetría de anomalía o intento de alteración al servidor.
         */
        async reportTamper(anomalyType, details = {}) {
            try {
                const user = (typeof global.getCurrentUser === 'function') ? global.getCurrentUser() : null;
                const apiBase = global.BACKEND_API_BASE || 'http://localhost:3000';

                await fetch(`${apiBase}/api/security/report-tamper`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user?.id || 'ANONYMOUS',
                        userName: user?.name || 'Desconocido',
                        anomalyType,
                        details
                    })
                });
            } catch (e) {
                // Silencioso
            }
        },

        /**
         * Aplica congelamiento profundo (Deep Freeze) para evitar que variables críticas sean modificadas en consola.
         */
        deepFreeze(obj) {
            if (!obj || typeof obj !== 'object') return obj;
            Object.keys(obj).forEach(prop => {
                if (typeof obj[prop] === 'object' && obj[prop] !== null && !Object.isFrozen(obj[prop])) {
                    this.deepFreeze(obj[prop]);
                }
            });
            return Object.freeze(obj);
        }
    };

    // Congelar el módulo para prevenir modificaciones en tiempo de ejecución
    global.SecurityGuard = Object.freeze(SecurityGuard);

})(typeof window !== 'undefined' ? window : this);
