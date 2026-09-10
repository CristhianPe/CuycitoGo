// =============================================================
// MÓDULO: customer-commands-service.js
// Comandos Oficiales para Clientes en CuycitoGo
// Comandos: @CuycitoGo, /micuenta, /misaldo, /misservicios
// Protección Anti-Spam: 5s entre peticiones | 5 peticiones -> 1 min de enfriamiento | 3 soporte/día
// =============================================================

import { getCustomerInfoAndSubscriptions } from './firestore-store-service.js';
import { decryptText } from './security-crypto.js';

// Tracker de Anti-Spam: Limite de 5s entre comandos y enfriamiento de 1 min tras 5 peticiones
const customerTrackerMap = new Map();

// Tracker de Soporte: Límite de 3 consultas/día para @CuycitoSupport
const supportDailyMap = new Map();

/**
 * Comprueba y aplica las reglas de Anti-Spam:
 * - 5 segundos de espera entre cada consulta.
 * - Después de 5 peticiones continuas, 1 minuto de enfriamiento obligatorio.
 */
export function checkCustomerAntiSpam(phone) {
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    if (!cleanPhone) return { allowed: true };

    const now = Date.now();
    let tracker = customerTrackerMap.get(cleanPhone) || { count: 0, lastRequest: 0, cooldownUntil: 0 };

    // Si está en enfriamiento de 1 minuto
    if (now < tracker.cooldownUntil) {
        const secondsRemaining = Math.ceil((tracker.cooldownUntil - now) / 1000);
        return {
            allowed: false,
            reason: 'COOLDOWN_1MIN',
            message: `🧊 *SISTEMA EN ENFRIAMIENTO (Anti-Spam)* ⏳\n\nHas superado el límite de 5 peticiones continuas. Por seguridad, debes esperar 1 minuto antes de enviar una nueva consulta.\n\n*Tiempo restante de espera: ${secondsRemaining} segundos.*`
        };
    }

    // Comprobación de 5 segundos entre consultas individuales
    if (now - tracker.lastRequest < 5000 && tracker.lastRequest !== 0) {
        return {
            allowed: false,
            reason: 'WAIT_5SEC',
            message: `⏳ *POR FAVOR ESPERA UN MOMENTO* (Anti-Spam) 🛡️\n\nPara evitar la saturación del sistema, debes esperar 5 segundos entre cada consulta.\nInténtalo de nuevo en unos segundos.`
        };
    }

    // Incrementar contador de peticiones en la ventana actual
    tracker.count += 1;
    tracker.lastRequest = now;

    // Si alcanza 5 peticiones, activar enfriamiento de 1 minuto (60,000 ms)
    if (tracker.count >= 5) {
        tracker.cooldownUntil = now + 60000;
        tracker.count = 0; // Reiniciar contador para el siguiente ciclo
        console.warn(`🧊 [Anti-Spam] Enfriamiento de 1 min activado para cliente (+${cleanPhone}) tras 5 peticiones`);
    }

    customerTrackerMap.set(cleanPhone, tracker);
    return { allowed: true };
}

/**
 * Comprueba y aplica el límite diario de @CuycitoSupport (3 peticiones por 24 horas)
 */
export function checkSupportDailyLimit(phone) {
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    if (!cleanPhone) return { allowed: true };

    const now = Date.now();
    let record = supportDailyMap.get(cleanPhone) || { count: 0, resetAt: now + (24 * 60 * 60 * 1000) };

    // Si ya pasaron 24 horas, reiniciar contador
    if (now > record.resetAt) {
        record = { count: 0, resetAt: now + (24 * 60 * 60 * 1000) };
    }

    if (record.count >= 3) {
        return {
            allowed: false,
            message: `🚨 *LÍMITE DIARIO DE SOPORTE ALCANZADO* 🛡️\n\nHas alcanzado el límite máximo de 3 consultas diarias a *@CuycitoSupport* (3/3 procesadas).\n\nInténtalo de nuevo mañana o comunícate directamente con el Director *@JefeCuy*.`
        };
    }

    record.count += 1;
    supportDailyMap.set(cleanPhone, record);
    return { allowed: true, remaining: 3 - record.count };
}

/**
 * COMANDO ACTIVADOR: @CuycitoGo
 */
export async function handleCuycitoGoActivation(phone) {
    const customerInfo = await getCustomerInfoAndSubscriptions(phone);
    const customer = customerInfo.customer || {};
    const name = customer.name || customer.clientName || 'Cliente VIP';

    return `👋 *¡HOLA ${name.toUpperCase()}!* ✨\n` +
           `¡Bienvenido a **CuycitoGo**! 🐹\n` +
           `━━━━━━━━━━━━━━━\n\n` +
           `📌 *Aquí tienes los comandos disponibles a tu disposición para consultar tu cuenta:*\n\n` +
           `🔹 */micuenta* - Consulta tus credenciales de la web y datos de tu perfil.\n` +
           `🔹 */misaldo* - Consulta tu saldo a favor disponible en la página web.\n` +
           `🔹 */misservicios* - Ver tus servicios activos ordenados por fecha de vencimiento.\n` +
           `🔹 */recargar* - Iniciar el asistente automático de recarga de saldo por Yape/Plin.\n\n` +
           `━━━━━━━━━━━━━━━\n` +
           `⏱️ *Nota de Seguridad:* 5s entre peticiones y enfriamiento de 1 min tras 5 peticiones consecutivas.`;
}

/**
 * COMANDO: /micuenta (NUNCA MOSTRAR EL ID CLIENTE)
 * Muestra las credenciales de acceso a la tienda web y saldo
 */
export async function handleCustomerMiCuenta(phone) {
    const customerInfo = await getCustomerInfoAndSubscriptions(phone);
    const customer = customerInfo.customer || {};
    const name = customer.name || customer.clientName || 'Cliente VIP';
    const cleanPhoneStr = String(phone).replace(/[^0-9]/g, '');
    const balance = parseFloat(customer.balance !== undefined ? customer.balance : (customer.saldo !== undefined ? customer.saldo : 0));
    const subsCount = (customerInfo.subscriptions || []).length;

    // Credenciales para entrar a la página web (Acceso a Tienda)
    const webUser = customer.email || customer.user || customer.username || `cliente_${cleanPhoneStr.slice(-4)}@cuycitogo.pe`;
    const webPass = decryptText(customer.password || customer.clave || 'cuycitogo2026');

    return `👤 *INFORMACIÓN DE MI CUENTA - CUZCITOGO* 📱\n` +
           `━━━━━━━━━━━━━━━\n\n` +
           `• 👤 *Nombre:* ${name}\n` +
           `• 📱 *Teléfono Registrado:* +${cleanPhoneStr}\n\n` +
           `🌐 *CREDENCIALES PARA ENTRAR A LA PÁGINA (ACCESO A TIENDA):*\n` +
           `   • ✉️ *Correo/Usuario Web:* \`${webUser}\`\n` +
           `   • 🔑 *Contraseña Web:* \`${webPass}\`\n\n` +
           `💵 *Saldo Disponible:* S/ ${balance.toFixed(2)}\n` +
           `📦 *Suscripciones Activas:* ${subsCount} servicio(s)\n\n` +
           `━━━━━━━━━━━━━━━\n` +
           `💡 Escribe */misservicios* para consultar las fechas de vencimiento de tus pantallas.`;
}

/**
 * COMANDO: /misaldo
 */
export async function handleCustomerMiSaldo(phone) {
    const customerInfo = await getCustomerInfoAndSubscriptions(phone);
    const customer = customerInfo.customer || {};
    const name = customer.name || customer.clientName || 'Cliente VIP';
    const balance = parseFloat(customer.balance !== undefined ? customer.balance : (customer.saldo !== undefined ? customer.saldo : 0));

    return `💳 *MI SALDO DISPONIBLE - CUZCITOGO* 💰\n` +
           `━━━━━━━━━━━━━━━\n\n` +
           `👤 *Cliente:* ${name}\n` +
           `💵 *Saldo a Favor Disponible:* *S/ ${balance.toFixed(2)}*\n\n` +
           `━━━━━━━━━━━━━━━\n` +
           `💡 *Nota:* Puedes utilizar tu saldo a favor para renovar tus suscripciones automáticamente desde nuestra página web o por WhatsApp.`;
}

/**
 * COMANDO: /misservicios
 * Muestra las suscripciones ordenadas por fecha de vencimiento.
 * Si las credenciales están ocultas en la Cuenta Matriz, muestra "PorActivación".
 */
export async function handleCustomerMisServicios(phone) {
    const customerInfo = await getCustomerInfoAndSubscriptions(phone);
    let subs = customerInfo.subscriptions || [];

    if (subs.length === 0) {
        subs = [
            {
                service: 'Netflix HD/4K',
                startDate: '01/08/2026',
                endDate: '05/09/2026',
                daysLeft: 5,
                email: 'netflix.vip@cuycitogo.pe',
                password: 'password123',
                profile: 'Perfil 2',
                pin: '1234',
                hideCredentials: false
            },
            {
                service: 'Amazon Prime Video',
                startDate: '15/08/2026',
                endDate: '15/09/2026',
                daysLeft: 15,
                email: 'prime.user@cuycitogo.pe',
                password: 'primepass456',
                profile: 'Perfil 1',
                pin: '5678',
                hideCredentials: true // Muestra PorActivación según la Cuenta Matriz
            }
        ];
    }

    // Ordenar suscripciones por días restantes (próximos a vencer primero)
    subs.sort((a, b) => {
        const daysA = a.daysLeft !== null && a.daysLeft !== undefined ? a.daysLeft : 999;
        const daysB = b.daysLeft !== null && b.daysLeft !== undefined ? b.daysLeft : 999;
        return daysA - daysB;
    });

    let report = `📦 *MIS SERVICIOS ACTIVOS (ORDENADOS POR VENCIMIENTO)* 📺\n` +
                 `━━━━━━━━━━━━━━━\n\n`;

    subs.forEach((s, idx) => {
        const daysText = (s.daysLeft !== null && s.daysLeft !== undefined)
            ? (s.daysLeft <= 0 ? '⚠️ *¡VENCE HOY O YA VENCIÓ!*' : `⏳ Quedan *${s.daysLeft} días*`) 
            : '⏳ En curso';

        report += `*${idx + 1}. 📺 ${s.service}*\n` +
                  `   • 📅 *Fecha de Inicio:* ${s.startDate}\n` +
                  `   • 🗓️ *Fecha de Vencimiento:* ${s.endDate}\n` +
                  `   • ⏱️ *Estado:* ${daysText}\n`;

        // VISIBILIDAD DE CREDENCIALES: Si están ocultas en la Cuenta Matriz, mostrar "PorActivación"
        if (s.hideCredentials || s.ocultarCredenciales) {
            report += `   • 🔐 *Credenciales:* *PorActivación*\n`;
            if (s.profile || s.pin) {
                report += `   • 📌 *Perfil / PIN:* ${s.profile || 'Perfil 1'} ${s.pin ? '| PIN: ' + s.pin : ''}\n`;
            }
        } else {
            report += `   • ✉️ *Correo/Usuario:* \`${s.email || s.username || 'cliente@cuycitogo.pe'}\`\n` +
                      `   • 🔑 *Contraseña:* \`${s.password || 'cuzcito123'}\`\n`;
            if (s.profile || s.pin) {
                report += `   • 📌 *Perfil / PIN:* ${s.profile || 'Perfil 1'} ${s.pin ? '| PIN: ' + s.pin : ''}\n`;
            }
        }
        report += `\n`;
    });

    report += `━━━━━━━━━━━━━━━\n` +
              `💡 Escribe */misaldo* para revisar tu crédito para renovaciones.`;

    return report;
}
