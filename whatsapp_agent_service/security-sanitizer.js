// =============================================================
// MÓDULO DE SEGURIDAD: security-sanitizer.js
// Detección y Neutralización de Prompt Injection & Jailbreaks
// =============================================================

const JAILBREAK_PATTERNS = [
    /ignore\s+(all\s+)?(previous\s+)?instructions/i,
    /olvida\s+(todas\s+)?(las\s+)?instrucciones/i,
    /dame\s+(todas\s+)?(las\s+)?contraseñas/i,
    /revela\s+(las\s+)?(cuentas\s+)?matriz/i,
    /modo\s+desarrollador/i,
    /system\s+prompt/i,
    /override\s+security/i,
    /actúa\n?como/i,
    /actua\s+como\s+un/i
];

/**
 * Inspecciona un texto de entrada para prevenir ataques de prompt injection.
 * Lanza un error si detecta un patrón malicioso o limpia caracteres peligrosos.
 */
export function sanitizeInputText(userText) {
    if (!userText || typeof userText !== 'string') return userText;

    const trimmed = userText.trim();

    for (const pattern of JAILBREAK_PATTERNS) {
        if (pattern.test(trimmed)) {
            console.warn(`🚨 [Seguridad AI] Intento de Prompt Injection detectado: "${trimmed}"`);
            const err = new Error("PROMPT_INJECTION_DETECTED");
            err.userFacingMessage = "🛡️ *MENSAJE RECHAZADO POR SEGURIDAD* 🚨\n\nTu mensaje contiene comandos no permitidos o intentos de manipulación de la IA. Por políticas de ciberseguridad de CuycitoGo, esta acción ha sido bloqueada y registrada.";
            throw err;
        }
    }

    return trimmed;
}
