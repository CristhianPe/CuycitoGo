/**
 * atencion-cliente-agent-service.js
 * Agente @Atencionalcliente para atención directa y automatizada a clientes por WhatsApp.
 * 
 * Flujo:
 * 1. Saluda al cliente y lo valida automáticamente por su número de teléfono.
 * 2. Entiende el servicio que consulta (Netflix, HBO, Disney, etc.), entrega precio y condiciones.
 * 3. Envía la imagen del catálogo oficial (catalogo_oficial_cuycitogo.jpg).
 * 4. Pregunta: ¿Deseas proceder con el pago? 1. Sí / 2. No.
 * 5. Si responde 1 (Sí): Genera ticket de pago con QR, métodos y aviso estricto de 5 minutos.
 * 6. Si responde 2 (No): Envía mensaje cordial de agradecimiento y disponibilidad.
 * 7. Temporizador de 5 minutos: cancela si expira o notifica al Director si paga.
 */

import {
  STREAMING_CATALOG,
  identifyServiceFromText,
  isGeneralStreamingInquiry,
  formatCustomerOfferMessage
} from './agente-publicidad-service.js';
import { searchUsersByQuery, cleanPhoneNumber } from './firestore-store-service.js';
import { generateUniqueAmount } from './payment-verification-service.js';
import path from 'path';
import fs from 'fs';

// Rotación dinámica de saludos cordiales para simulación humana anti-ban
export function getRandomGreeting(name) {
  const n = name ? `*${name}*` : 'amigo';
  const greetings = [
    `¡Hola ${n}! 👋`,
    `¿Cómo estás ${n}? ✨`,
    `¡Buen día ${n}! 🍿`,
    `¡Hola qué tal ${n}! 🚀`
  ];
  return greetings[Math.floor(Math.random() * greetings.length)];
}

// Sesiones de atención de clientes (key: cleanPhone -> sessionData)
export const customerSessions = new Map();
const directorSessions = new Map();

// Registro de tickets de pago temporizados (5 minutos)
// key: cleanPhone -> { ticketId, serviceKey, amount, customerName, timer, createdAt, status }
export const activePaymentTickets = new Map();

/**
 * Verifica si el Director está en una sesión activa con @Atencionalcliente
 */
export function isDirectorInAtencionSession(senderPhone) {
  return directorSessions.has(cleanPhoneNumber(senderPhone));
}

/**
 * Inicia la sesión de @Atencionalcliente cuando el Director escribe @Atencionalcliente
 */
export function startAtencionSession(senderPhone) {
  directorSessions.set(cleanPhoneNumber(senderPhone), {
    step: 'AWAITING_CLIENT_SEARCH'
  });

  return `🤝 *AGENTE @Atencionalcliente ACTIVADO*\n` +
         `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
         `¡Hola Jefe! Dime a quién quieres que le haga seguimiento de su compra:\n\n` +
         `✍️ *Escribe el Nombre o Teléfono del cliente* para buscarlo en la base de datos.`;
}

/**
 * Procesa el paso del Director en @Atencionalcliente
 */
export async function handleDirectorAtencionStep(senderPhone, text, recentClientChatsMap, sendMsgCallback) {
  const cleanPhone = cleanPhoneNumber(senderPhone);
  const session = directorSessions.get(cleanPhone);
  if (!session) return null;

  const t = text.trim();
  if (t.toLowerCase() === 'cancelar' || t.toLowerCase() === 'salir') {
    directorSessions.delete(cleanPhone);
    return `❌ Sesión de *@Atencionalcliente* cancelada con éxito.`;
  }

  const clients = await searchUsersByQuery(t);
  if (clients.length === 0) {
    return `🔍 No encontré clientes con *"${t}"*.\nEscribe otro nombre/teléfono o *cancelar*.`;
  }

  const client = clients[0];
  directorSessions.delete(cleanPhone);
  return `👤 *Cliente:* ${client.nombre} (+${client.telefono})\n💰 *Saldo:* S/ ${client.saldo.toFixed(2)}\n📧 *Correo:* ${client.correo || 'N/A'}`;
}

/**
 * Verifica si el cliente está en una sesión de atención activa
 */
export function isCustomerInAtencionSession(phoneNumber) {
  const cleanPhone = cleanPhoneNumber(phoneNumber);
  return customerSessions.has(cleanPhone);
}

/**
 * Procesa el mensaje del cliente en el agente @Atencionalcliente
 */
export async function processCustomerMessage(phoneNumber, textMessage, sendMsgCallback) {
  const cleanPhone = cleanPhoneNumber(phoneNumber);
  const t = textMessage.trim().toLowerCase();

  // 1. Obtener o inicializar sesión del cliente
  let session = customerSessions.get(cleanPhone);
  if (!session) {
    // Validar si el cliente está registrado en la base de datos
    const userMatches = await searchUsersByQuery(cleanPhone);
    const clientName = (userMatches.length > 0 && userMatches[0].nombre) ? userMatches[0].nombre : null;

    session = {
      phone: cleanPhone,
      clientName: clientName,
      step: 'AWAITING_SERVICE_INQUIRY',
      selectedService: null,
      lastInteraction: Date.now()
    };
    customerSessions.set(cleanPhone, session);
  } else {
    session.lastInteraction = Date.now();
  }

  const clientJid = `${cleanPhone}@s.whatsapp.net`;
  const adminPhone = (process.env.ADMIN_WHATSAPP_NUMBERS || '51900000000').split(',')[0].trim();
  const directorJid = `${adminPhone}@s.whatsapp.net`;

  // 2. Si el cliente está respondiendo a la pregunta de pago (Opción 1 o 2)
  if (session.step === 'AWAITING_PAYMENT_CONFIRMATION') {
    const isYes = t === '1' || t === '1.' || t.includes('si') || t.includes('sí') || t.includes('quiero') || t.includes('pagar') || t.includes('proceder');
    const isNo = t === '2' || t === '2.' || t.includes('no') || t.includes('despues') || t.includes('después') || t.includes('luego') || t.includes('gracias');

    // OPCIÓN 1: SÍ, QUIERE PAGAR
    if (isYes) {
      const serviceKey = session.selectedService || 'netflix';
      const service = STREAMING_CATALOG[serviceKey] || STREAMING_CATALOG.netflix;
      let formattedAmount = '';

      try {
        const uniqueAmountObj = await generateUniqueAmount(service.price, cleanPhone);
        formattedAmount = uniqueAmountObj.totalAmountStr;
      } catch (err) {
        // Fallback protocolo: centavos aleatorios entre 0.10 y 0.50
        const randomCents = Math.floor(Math.random() * 41) + 10;
        const base = Math.floor(service.price);
        formattedAmount = (base + (randomCents / 100)).toFixed(2);
      }

      session.step = 'TICKET_ACTIVE_WAITING_PAYMENT';

      // Cancelar ticket previo si existía uno
      if (activePaymentTickets.has(cleanPhone)) {
        const prev = activePaymentTickets.get(cleanPhone);
        if (prev.timer) clearTimeout(prev.timer);
        activePaymentTickets.delete(cleanPhone);
      }

      // Mensaje de Ticket con protocolo de centavos exactos y advertencia de 5 minutos
      let ticketMsg = `🎫 *TICKET DE PAGO OFICIAL CUYCITOGO*\n`;
      ticketMsg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      ticketMsg += `👤 *Cliente:* ${session.clientName || 'Cliente CuycitoGo'}\n`;
      ticketMsg += `🍿 *Servicio:* ${service.name} (${service.planType})\n`;
      ticketMsg += `💵 *Total a Transferir:* *S/ ${formattedAmount}* 👈 *(Monto con decimales)*\n\n`;
      ticketMsg += `💡 *PROTOCOLO DE RECARGA AUTOMÁTICA:*\n`;
      ticketMsg += `_Debes transferir el monto con los **centavos exactos (S/ ${formattedAmount})** para que el sistema identifique y acredite tu pago al instante de forma 100% automática._\n\n`;
      ticketMsg += `💳 *MÉTODOS DE PAGO DISPONIBLES:*\n`;
      ticketMsg += `• *YAPE / PLIN:* Escaneando el código QR oficial adjunto o al número autorizado.\n`;
      ticketMsg += `• *BINANCE PAY / PAYPAL / LEMON CASH:* Disponibles.\n\n`;
      ticketMsg += `⏱️ *TIEMPO LÍMITE DE PAGO:* *5 MINUTOS*\n`;
      ticketMsg += `📸 Una vez realizado el pago, envía tu comprobante aquí para procesar tu activación al instante. 🚀`;

      // 1. Recordatorio a los 3 minutos (quedando 2 min)
      const reminderTimer = setTimeout(async () => {
        const currentTicket = activePaymentTickets.get(cleanPhone);
        if (currentTicket && currentTicket.status === 'PENDING') {
          const reminderMsg = `⏳ *RECORDATORIO DE COMPRA - CUYCITOGO* 🍿\n` +
                              `━━━━━━━━━━━━━━━━━━━━━\n` +
                              `Hola *${session.clientName || 'amigo'}*, te quedan **2 minutos** para asegurar tu cupo de *${service.name}* por *S/ ${formattedAmount}* con entrega inmediata.\n\n` +
                              `💡 _¿Tuviste algún inconveniente con tu transferencia o necesitas ayuda con los métodos de pago? Escríbenos y te asistimos al instante._ ✨`;
          if (sendMsgCallback) {
            await sendMsgCallback(clientJid, reminderMsg);
          }
        }
      }, 3 * 60 * 1000);

      // 2. Configurar temporizador de 5 minutos (300,000 ms)
      const timer = setTimeout(async () => {
        const currentTicket = activePaymentTickets.get(cleanPhone);
        if (currentTicket && currentTicket.status === 'PENDING') {
          currentTicket.status = 'EXPIRED';
          activePaymentTickets.delete(cleanPhone);
          customerSessions.delete(cleanPhone);

          const expiredMsg = `⏳ *TICKET DE PAGO CANCELADO*\n` +
                             `━━━━━━━━━━━━━━━━━━━━━\n` +
                             `Hola *${session.clientName || 'estimado cliente'}*, no recibimos la confirmación de pago dentro del plazo de *5 minutos*.\n\n` +
                             `🔒 Por seguridad y liberación de stock, el ticket ha sido cerrado. Si aún deseas tu cuenta, escríbenos nuevamente y con gusto te generaremos un nuevo ticket. 🙌`;

          if (sendMsgCallback) {
            await sendMsgCallback(clientJid, expiredMsg);
            await sendMsgCallback(
              directorJid,
              `⚠️ *TICKET EXPIRADO:* El cliente +${cleanPhone} (${session.clientName || 'Cliente'}) no realizó el pago de *S/ ${formattedAmount}* por *${service.name}* en los 5 minutos establecidos.`
            );
          }
        }
      }, 5 * 60 * 1000);

      activePaymentTickets.set(cleanPhone, {
        clientPhone: cleanPhone,
        clientName: session.clientName || 'Cliente',
        serviceKey,
        serviceName: service.name,
        amount: formattedAmount,
        timer,
        reminderTimer,
        createdAt: Date.now(),
        status: 'PENDING'
      });

      return {
        replyText: ticketMsg,
        sendPaymentQr: true
      };
    }

    // OPCIÓN 2: NO, EN OTRO MOMENTO
    if (isNo) {
      customerSessions.delete(cleanPhone);
      const thankYouMsg = `¡Muchas gracias por contactarnos! 🙌\n\n` +
                          `Estaremos muy atentos a atenderte en cualquier momento que desees disfrutar del mejor entretenimiento con *CuycitoGo*. ¡Que tengas un excelente día! ✨🍿`;
      return {
        replyText: thankYouMsg,
        sendCatalogImage: false
      };
    }
  }

  // 3. Detectar qué servicio específico consulta el cliente (Netflix, Disney, HBO, Prime, etc.)
  const detectedKey = identifyServiceFromText(textMessage);

  if (detectedKey) {
    session.selectedService = detectedKey;
    session.step = 'AWAITING_PAYMENT_CONFIRMATION';

    let offerText = formatCustomerOfferMessage(detectedKey, {
      customerName: session.clientName
    });

    // Upselling / Cross-selling coordinado con promociones activas
    if (detectedKey === 'netflix') {
      offerText += `\n\n💡 *¡SÚPER PROMO EXCLUSIVA!* Lleva el *Combo Dúo (Netflix 4K + Disney con 7 canales ESPN)* por solo *S/ 19.00* (¡Ahorras S/ 6.00!). Escribe *"quiero el combo"* si deseas aprovecharlo. 🚀`;
    } else if (detectedKey === 'disney') {
      offerText += `\n\n💡 *¡SÚPER PROMO EXCLUSIVA!* Agrega Netflix 4K llevando el *Combo Dúo* por solo *S/ 19.00* en total. Escribe *"quiero el combo"* si deseas aprovecharlo. 🚀`;
    }

    return {
      replyText: offerText,
      sendCatalogImage: true
    };
  }

  // 4. Si es consulta general ("cuentas", "pantallas", "streaming", "precios", "catálogo", etc.)
  const isGeneralQuery = isGeneralStreamingInquiry(textMessage);
  if (isGeneralQuery) {
    session.step = 'AWAITING_SERVICE_INQUIRY';
    const nameGreeting = getRandomGreeting(session.clientName);

    let welcomeCatalogMsg = `${nameGreeting}\n` +
                            `¡Sí, claro que sí! En *CuycitoGo* seguimos 100% activos atendiendo las 24 horas con las mejores cuentas y pantallas de streaming con entrega inmediata. 🍿🚀\n\n` +
                            `📸 *Te adjuntamos nuestro Catálogo Oficial con todos los precios actualizados:*\n\n` +
                            `• *Netflix 4K* (Con PIN) ➔ *S/ 15.00*\n` +
                            `• *Disney+ ESPN* (7 canales) ➔ *S/ 10.00*\n` +
                            `• *HBO Max* (4K Platino) ➔ *S/ 10.00*\n` +
                            `• *Spotify Premium* ➔ *S/ 8.00*\n` +
                            `• *Prime Video 4K* ➔ *S/ 6.00*\n` +
                            `• *Crunchyroll Mega Fan* ➔ *S/ 5.00*\n` +
                            `• *Combo Dúo (Netflix+Disney)* ➔ *S/ 19.00*\n` +
                            `• *Canva PRO / Google 2TB / VPN*\n\n` +
                            `💬 *¿Qué servicio o pantalla deseas activar hoy?*\n` +
                            `_Escríbenos el nombre de la plataforma y te mandamos los datos para tu activación al instante._ ✨`;

    return {
      replyText: welcomeCatalogMsg,
      sendCatalogImage: true
    };
  }

  // 5. Si no coincide con ninguna palabra clave de streaming ni servicios, no responder para no interferir
  return null;
}

/**
 * Notifica la confirmación de pago recibido y activa la alerta al Director y al Cliente
 */
export async function notifyPaymentCompleted(clientPhone, amountPaid, sendMsgCallback) {
  const cleanPhone = cleanPhoneNumber(clientPhone);
  const ticket = activePaymentTickets.get(cleanPhone);

  const clientJid = `${cleanPhone}@s.whatsapp.net`;
  const adminPhone = (process.env.ADMIN_WHATSAPP_NUMBERS || '51900000000').split(',')[0].trim();
  const directorJid = `${adminPhone}@s.whatsapp.net`;
  const serviceName = ticket ? ticket.serviceName : 'Suscripción Digital';
  const clientName = ticket ? ticket.clientName : 'Cliente';

  if (ticket) {
    if (ticket.timer) clearTimeout(ticket.timer);
    ticket.status = 'COMPLETED';
    activePaymentTickets.delete(cleanPhone);
  }
  customerSessions.delete(cleanPhone);

  // 1. Mensaje de confirmación y espera al cliente
  const clientSuccessMsg = `🎉 *¡PAGO CONFIRMADO CON ÉXITO!* 🎉\n` +
                           `━━━━━━━━━━━━━━━━━━━━━\n` +
                           `Hemos recibido correctamente tu pago de *S/ ${Number(amountPaid).toFixed(2)}* por tu suscripción de *${serviceName}*.\n\n` +
                           `⚡ *Manténgase al tanto que ahora nuestro equipo le atenderá con su activación.* 🍿📺`;

  // 2. Notificación de alerta inmediata al Director
  const directorAlertMsg = `🚨 *¡NUEVA COMPRA PAGADA Y LISTA PARA ACTIVACIÓN!* 🚨\n` +
                           `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                           `👤 *Cliente:* ${clientName}\n` +
                           `📱 *Teléfono:* +${cleanPhone}\n` +
                           `🍿 *Servicio:* ${serviceName}\n` +
                           `💵 *Monto Recibido:* *S/ ${Number(amountPaid).toFixed(2)}*\n` +
                           `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                           `👉 Por favor procede a entregar las credenciales o activar en TV.`;

  if (sendMsgCallback) {
    await sendMsgCallback(clientJid, clientSuccessMsg);
    await sendMsgCallback(directorJid, directorAlertMsg);
  }

  return true;
}