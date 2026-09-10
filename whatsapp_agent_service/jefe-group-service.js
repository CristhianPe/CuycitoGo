// =============================================================
// MÓDULO: jefe-group-service.js
// Asistente Interactivo de Creación de Grupos Privados para @JefeCuy
// =============================================================

const activeGroupCreationSessions = new Map();

/**
 * Comprueba si un usuario está en medio del flujo de creación de grupo
 */
export function isUserInGroupCreationSession(senderNumber) {
    const cleanNumber = (senderNumber || '').replace(/[^0-9]/g, '');
    return activeGroupCreationSessions.has(cleanNumber);
}

/**
 * Maneja la interacción paso a paso para @JefeCuy @creargrupo
 */
export async function handleInteractiveGroupCreation({ senderNumber, messageText = '' }) {
    const cleanNumber = (senderNumber || '').replace(/[^0-9]/g, '');
    const cleanMsg = (messageText || '').trim();
    const lowerMsg = cleanMsg.toLowerCase();

    // CANCELACIÓN CON EXIT
    if (lowerMsg === 'exit') {
        activeGroupCreationSessions.delete(cleanNumber);
        return {
            action: 'CHAT',
            replyText: `👋 *CREACIÓN DE GRUPO CANCELADA*\n\nHas salido del asistente de creación de grupos. Puedes volver a escribir *@JefeCuy @creargrupo* cuando desees.`
        };
    }

    let session = activeGroupCreationSessions.get(cleanNumber);

    // INICIO DEL WIZARD: Si el usuario escribe @creargrupo o @jefecuy @creargrupo
    if (!session || lowerMsg.includes('@creargrupo')) {
        activeGroupCreationSessions.set(cleanNumber, { step: 1 });
        return {
            action: 'WIZARD_STEP',
            replyText: `👑 *DIRECTOR @JefeCuy - CREACIÓN DE GRUPOS PRIVADOS* 📱\n` +
                       `━━━━━━━━━━━━━━━\n\n` +
                       `¡Hola Jefe! Dime, **¿qué nombre llevará el nuevo grupo privado que deseas crear?**\n\n` +
                       `*(Escribe el nombre deseado o responde EXIT para cancelar)*`
        };
    }

    // PASO 1: RECEPCIÓN DEL NOMBRE DEL GRUPO Y EJECUCIÓN
    if (session.step === 1) {
        const groupName = cleanMsg;
        activeGroupCreationSessions.delete(cleanNumber);

        return {
            action: 'CREATE_GROUP',
            groupName: groupName,
            replyText: `👑 *DIRECTOR @JefeCuy*: Procesando la creación del grupo privado "*${groupName}*" exclusivamente para ti...`
        };
    }
}
