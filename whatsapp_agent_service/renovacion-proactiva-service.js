/**
 * renovacion-proactiva-service.js
 * Módulo de Renovaciones Proactivas a 1 Clic (3 días antes del vencimiento).
 */

import {
  initFirestore,
  useRestFallback,
  adminDb,
  restGetCollection,
  restUpdateDocument,
  cleanPhoneNumber
} from './firestore-store-service.js';

import {
  STREAMING_CATALOG,
  identifyServiceFromText,
  formatCustomerOfferMessage
} from './agente-publicidad-service.js';

import {
  activePaymentTickets,
  getRandomGreeting,
  customerSessions
} from './atencion-cliente-agent-service.js';

import { generateUniqueAmount } from './payment-verification-service.js';
import path from 'path';
import fs from 'fs';

// Memoria de notificaciones enviadas hoy (key: cleanPhone_service -> timestamp)
const notifiedRenewalsToday = new Map();

// Sesiones activas de renovación proactiva (key: cleanPhone -> sessionData)
const renewalSessions = new Map();

/**
 * Parsea fechas en formato DD/MM/YYYY o ISO a un objeto Date.
 */
function parseDate(dateStr) {
  if (!dateStr) return new Date(8640000000000000);
  const parts = String(dateStr).split('/');
  if (parts.length === 3) {
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  }
  const dt = new Date(dateStr);
  return isNaN(dt.getTime()) ? new Date(8640000000000000) : dt;
}

/**
 * Calcula los días restantes hasta la fecha de expiración.
 */
function getDaysRemaining(endDateStr) {
  const endDt = parseDate(endDateStr);
  const now = new Date();
  const diffTime = endDt.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Suma +30 días a una fecha DD/MM/YYYY
 */
function add30Days(dateStr) {
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const dt = new Date(year, month, day);
    dt.setDate(dt.getDate() + 30);
    const resDay = String(dt.getDate()).padStart(2, '0');
    const resMonth = String(dt.getMonth() + 1).padStart(2, '0');
    const resYear = dt.getFullYear();
    return `${resDay}/${resMonth}/${resYear}`;
  }
  return dateStr;
}

/**
 * Verifica si un cliente está en una sesión de renovación proactiva
 */
export function isUserInRenewalSession(clientPhone) {
  const clean = cleanPhoneNumber(clientPhone);
  return renewalSessions.has(clean);
}

/**
 * Procesa la respuesta (1 o 2) de un cliente a la alerta de renovación proactiva
 */
export async function handleRenewalResponse(clientPhone, textMessage, sendMsgCallback) {
  const clean = cleanPhoneNumber(clientPhone);
  const session = renewalSessions.get(clean);
  if (!session) return null;

  const t = textMessage.trim().toLowerCase();
  const clientJid = `${clean}@s.whatsapp.net`;
  const adminPhone = (process.env.ADMIN_WHATSAPP_NUMBERS || '51900000000').split(',')[0].trim();
  const directorJid = `${adminPhone}@s.whatsapp.net`;

  const isOption1 = t === '1' || t === '1.' || t.includes('saldo') || t.includes('renovar con saldo');
  const isOption2 = t === '2' || t === '2.' || t.includes('yape') || t.includes('plin') || t.includes('ticket') || t.includes('pagar');

  // -------------------------------------------------------------
  // OPCIÓN 1: RENOVAR CON SALDO DISPONIBLE
  // -------------------------------------------------------------
  if (isOption1) {
    initFirestore();
    let currentBalance = 0;
    let targetUserDoc = null;

    try {
      let allUsers = [];
      if (useRestFallback) {
        allUsers = await restGetCollection('users');
      } else if (adminDb) {
        const uSnap = await adminDb.collection('users').get();
        uSnap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
      }

      targetUserDoc = allUsers.find(u => {
        const uPhone = cleanPhoneNumber(u.phone || u.phoneNumber || u.whatsapp || '');
        return uPhone && uPhone.includes(clean);
      });

      if (targetUserDoc) {
        currentBalance = parseFloat(targetUserDoc.balance || targetUserDoc.saldo || 0);
      }
    } catch (e) {
      console.error("⚠️ Error consultando saldo para renovación:", e.message);
    }

    const servicePrice = session.servicePrice || 10.00;

    // Caso A: Saldo suficiente
    if (currentBalance >= servicePrice) {
      const newBalance = currentBalance - servicePrice;
      const newEndDate = add30Days(session.endDate);

      // Actualizar saldo y suscripción en Firestore
      try {
        if (targetUserDoc) {
          if (useRestFallback) {
            await restUpdateDocument('users', targetUserDoc.id, { balance: newBalance });
          } else if (adminDb) {
            await adminDb.collection('users').doc(targetUserDoc.id).set({ balance: newBalance }, { merge: true });
          }
        }

        if (session.subId) {
          if (useRestFallback) {
            await restUpdateDocument('subscriptions', session.subId, { endDate: newEndDate, status: 'active' });
          } else if (adminDb) {
            await adminDb.collection('subscriptions').doc(session.subId).set({ endDate: newEndDate, status: 'active' }, { merge: true });
          }
        }
      } catch (dbErr) {
        console.error("⚠️ Error actualizando renovación en DB:", dbErr.message);
      }

      renewalSessions.delete(clean);

      const successMsg = `🎉 *¡RENOVACIÓN EXITOSA CON SALDO!* ✨\n` +
                         `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                         `Hola *${session.clientName}*, tu servicio de *${session.serviceName}* ha sido renovado exitosamente por 30 días más.\n\n` +
                         `📅 *Nueva Fecha de Vencimiento:* *${newEndDate}*\n` +
                         `💰 *Saldo descontado:* S/ ${servicePrice.toFixed(2)}\n` +
                         `💵 *Tu Saldo Restante:* *S/ ${newBalance.toFixed(2)}*\n` +
                         `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                         `¡Gracias por seguir disfrutando del mejor entretenimiento con *CuycitoGo*! 🍿🚀`;

      await sendMsgCallback(clientJid, successMsg);

      await sendMsgCallback(
        directorJid,
        `🔔 *RENOVACIÓN AUTOMÁTICA CON SALDO:*\n` +
        `• 👤 *Cliente:* +${clean} (${session.clientName})\n` +
        `• 🍿 *Servicio:* ${session.serviceName}\n` +
        `• 📅 *Nuevo Vencimiento:* ${newEndDate}\n` +
        `• 💵 *Saldo Restante:* S/ ${newBalance.toFixed(2)}`
      );

      return successMsg;
    }

    // Caso B: Saldo insuficiente -> Notificar y ofrecer Opción 2
    const insufficientMsg = `⚠️ *SALDO INSUFICIENTE PARA RENOVAR*\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `Hola *${session.clientName}*, tu saldo actual es de *S/ ${currentBalance.toFixed(2)}*, insuficiente para cubrir el costo de renovación de *${session.serviceName}* (S/ ${servicePrice.toFixed(2)}).\n\n` +
                            `👉 *Generando tu Ticket de Pago con Yape / Plin a continuación...* 🚀`;

    await sendMsgCallback(clientJid, insufficientMsg);
    // Pasa automáticamente a la opción 2
  }

  // -------------------------------------------------------------
  // OPCIÓN 2: GENERAR TICKET DE PAGO CON CENTAVOS DECIMALES
  // -------------------------------------------------------------
  const serviceKey = session.serviceKey || 'netflix';
  const service = STREAMING_CATALOG[serviceKey] || { name: session.serviceName || 'Suscripción', price: session.servicePrice || 10.00, planType: 'Renovación' };

  let formattedAmount = '';
  try {
    const uniqueObj = await generateUniqueAmount(service.price, clean);
    formattedAmount = uniqueObj.totalAmountStr;
  } catch (err) {
    const randomCents = Math.floor(Math.random() * 41) + 10;
    const base = Math.floor(service.price);
    formattedAmount = (base + (randomCents / 100)).toFixed(2);
  }

  renewalSessions.delete(clean);

  // Cancelar ticket previo si existía
  if (activePaymentTickets.has(clean)) {
    const prev = activePaymentTickets.get(clean);
    if (prev.timer) clearTimeout(prev.timer);
    if (prev.reminderTimer) clearTimeout(prev.reminderTimer);
    activePaymentTickets.delete(clean);
  }

  let ticketMsg = `🎫 *TICKET DE RENOVACIÓN OFICIAL CUYCITOGO*\n`;
  ticketMsg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  ticketMsg += `👤 *Cliente:* ${session.clientName}\n`;
  ticketMsg += `🍿 *Servicio a Renovar:* ${service.name}\n`;
  ticketMsg += `💵 *Total a Transferir:* *S/ ${formattedAmount}* 👈 *(Monto exacto con decimales)*\n\n`;
  ticketMsg += `💡 *PROTOCOLO DE RECARGA AUTOMÁTICA:*\n`;
  ticketMsg += `_Debes transferir el monto con los **centavos exactos (S/ ${formattedAmount})** para que el sistema identifique y acredite tu pago al instante._\n\n`;
  ticketMsg += `💳 *MÉTODOS DE PAGO DISPONIBLES:*\n`;
  ticketMsg += `• *YAPE / PLIN:* Escaneando el código QR oficial adjunto o al número autorizado.\n`;
  ticketMsg += `• *BINANCE PAY / PAYPAL / LEMON CASH:* Disponibles.\n\n`;
  ticketMsg += `⏱️ *TIEMPO LÍMITE DE PAGO:* *5 MINUTOS*\n`;
  ticketMsg += `⚠️ *IMPORTANTE:* _El pago se debe efectuar en un plazo no mayor a los **5 minutos** para asegurar tu cupo y mantener tu cuenta activa._\n`;
  ticketMsg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  ticketMsg += `📸 Una vez realizado el pago, envía tu comprobante aquí para procesar tu renovación al instante. 🚀`;

  // 1. Recordatorio a los 3 minutos (quedando 2 min)
  const reminderTimer = setTimeout(async () => {
    const currentTicket = activePaymentTickets.get(clean);
    if (currentTicket && currentTicket.status === 'PENDING') {
      const reminderMsg = `⏳ *RECORDATORIO DE COMPRA - CUYCITOGO* 🍿\n` +
                          `━━━━━━━━━━━━━━━━━━━━━\n` +
                          `Hola *${session.clientName}*, te quedan **2 minutos** para asegurar tu renovación de *${service.name}* por *S/ ${formattedAmount}*.\n\n` +
                          `💡 _¿Tuviste algún inconveniente con tu transferencia? Escríbenos si necesitas ayuda con los métodos de pago._ ✨`;
      if (sendMsgCallback) {
        await sendMsgCallback(clientJid, reminderMsg);
      }
    }
  }, 3 * 60 * 1000);

  // 2. Expiración a los 5 minutos
  const timer = setTimeout(async () => {
    const currentTicket = activePaymentTickets.get(clean);
    if (currentTicket && currentTicket.status === 'PENDING') {
      currentTicket.status = 'EXPIRED';
      activePaymentTickets.delete(clean);

      const expiredMsg = `⏳ *TICKET DE PAGO CANCELADO*\n` +
                         `━━━━━━━━━━━━━━━━━━━━━\n` +
                         `Hola *${session.clientName}*, no recibimos la confirmación de pago dentro del plazo de *5 minutos*.\n\n` +
                         `🔒 Si aún deseas renovar tu cuenta, escríbenos nuevamente y con gusto te generaremos un nuevo ticket. 🙌`;

      if (sendMsgCallback) {
        await sendMsgCallback(clientJid, expiredMsg);
        await sendMsgCallback(
          directorJid,
          `⚠️ *TICKET DE RENOVACIÓN EXPIRADO:* El cliente +${clean} (${session.clientName}) no realizó el pago de *S/ ${formattedAmount}* por *${service.name}* en los 5 minutos establecidos.`
        );
      }
    }
  }, 5 * 60 * 1000);

  activePaymentTickets.set(clean, {
    clientPhone: clean,
    clientName: session.clientName,
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

/**
 * Monitor diario que escanea clientes cuyas suscripciones vencen en exactamente 3 días
 */
export async function runProactiveRenewalScan(sendMsgCallback) {
  initFirestore();
  const now = Date.now();

  try {
    let allSubs = [];
    if (useRestFallback) {
      allSubs = await restGetCollection('subscriptions');
    } else if (adminDb) {
      const snap = await adminDb.collection('subscriptions').get();
      snap.forEach(d => allSubs.push({ id: d.id, ...d.data() }));
    }

    for (const sub of allSubs) {
      const phone = cleanPhoneNumber(sub.clientPhone || sub.phone || '');
      if (!phone) continue;

      const daysLeft = getDaysRemaining(sub.endDate);

      // Si vence en exactamente 3 días
      if (daysLeft === 3) {
        const notifKey = `${phone}_${sub.service || sub.name || 'sub'}`;
        const lastNotif = notifiedRenewalsToday.get(notifKey);

        // Evitar enviar más de 1 vez en 24 horas
        if (lastNotif && (now - lastNotif) < 24 * 60 * 60 * 1000) {
          continue;
        }

        const clientName = sub.clientName || sub.name || 'Estimado Cliente';
        const serviceName = sub.service || sub.name || 'Suscripción Digital';
        const serviceKey = identifyServiceFromText(serviceName) || 'netflix';
        const serviceData = STREAMING_CATALOG[serviceKey] || { price: 10.00 };

        renewalSessions.set(phone, {
          clientName,
          serviceName,
          serviceKey,
          servicePrice: serviceData.price,
          endDate: sub.endDate,
          subId: sub.id
        });

        notifiedRenewalsToday.set(notifKey, now);

        const greeting = getRandomGreeting(clientName);
        const renewalAlertMsg = `${greeting}\n` +
                                `Tu servicio de *${serviceName}* vence el *${sub.endDate}* (en 3 días). 🗓️\n\n` +
                                `Para evitar cortes en tus series, películas y partidos favoritos, ¿deseas renovar tu servicio ahora?\n\n` +
                                `1️⃣ *1* ➔ Renovar con saldo disponible (S/ ${serviceData.price.toFixed(2)})\n` +
                                `2️⃣ *2* ➔ Generar ticket de pago Yape / Plin\n\n` +
                                `👉 _Responde con el número *1* o *2* y te atenderemos al instante._ ✨`;

        const clientJid = `${phone}@s.whatsapp.net`;
        if (sendMsgCallback) {
          await sendMsgCallback(clientJid, renewalAlertMsg);
          console.log(`📢 [Renovación Proactiva] Notificación enviada a +${phone} (${clientName}) para ${serviceName}.`);
          await new Promise(r => setTimeout(r, Math.floor(Math.random() * 2000) + 1500)); // pausa anti-spam
        }
      }
    }
  } catch (err) {
    console.error("⚠️ Error en escaneo de renovaciones proactivas:", err.message);
  }
}