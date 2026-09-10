import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers, downloadMediaMessage } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import dns from 'dns';
import fs from 'fs';
import path from 'path';
import pino from 'pino';

// Forzar resolución IPv4 primero (Esencial para Android Termux / Redes móviles)
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

import {
  initFirestore,
  isUserInUpdateSession,
  cleanPhoneNumber
} from './firestore-store-service.js';

import { isUserInMarketingSession } from './jefe-marketing-service.js';
import { isUserInMatrixUpdateSession } from './cuentamatriz-service.js';
import { isUserInGroupCreationSession } from './jefe-group-service.js';
import { isUserInJefeFeedbackSession } from './jefe-ai-service.js';
import { isUserInBalanceUpdateSession } from './jefe-balance-service.js';
import {
  processCustomerMessage,
  notifyPaymentCompleted,
  isDirectorInAtencionSession,
  startAtencionSession,
  handleDirectorAtencionStep,
  activePaymentTickets
} from './atencion-cliente-agent-service.js';
import {
  isUserInActSession,
  startActSession,
  handleActStep
} from './actualizacion-cuentamatriz-service.js';
import {
  isUserInRenewalSession,
  handleRenewalResponse,
  runProactiveRenewalScan
} from './renovacion-proactiva-service.js';
import {
  analyzeVoucherWithGemini,
  verifyVoucherAgainstTicket
} from './voucher-ocr-service.js';
import {
  isUserInComunicadoSession,
  startComunicadoSession,
  handleComunicadoStep
} from './comunicado-service.js';
import {
  handleCustomerMiCuenta,
  handleCustomerMiSaldo,
  handleCustomerMisServicios,
  handleCuycitoGoActivation,
  checkCustomerAntiSpam
} from './customer-commands-service.js';
import { STREAMING_CATALOG } from './agente-publicidad-service.js';

import express from 'express';

const PHONE_NUMBER = process.env.PHONE_NUMBER || (process.env.ADMIN_WHATSAPP_NUMBERS || '51900000000').split(',')[0].trim();
const ACTIVEPIECES_WEBHOOK_URL = process.env.ACTIVEPIECES_WEBHOOK_URL || 'http://localhost:8080/api/v1/webhooks/demo-webhook';
const LOCAL_AGENT_URL = 'http://localhost:5001/api/agent/customer-support';
const JEFE_CUYCITO_URL = 'http://localhost:5001/api/agent/jefe-cuycito';

const processedMsgIds = new Set();
const botSentMsgIds = new Set();
const recentBotTexts = new Set();
const groupNameCache = new Map();
const recentClientChats = new Map(); // key: remoteJid -> Array<{ text, fromMe, timestamp }>

let globalSock = null;
let alertGroupJid = null;

const bridgeApp = express();
bridgeApp.use(express.json());

export async function findOrCreateAlertsGroup(sock) {
    if (!sock) return null;
    try {
        const groups = await sock.groupFetchAllParticipating();
        for (const [jid, group] of Object.entries(groups)) {
            if (group.subject && group.subject.toLowerCase().trim() === 'alertas') {
                alertGroupJid = jid;
                return alertGroupJid;
            }
        }

        const cleanPhone = PHONE_NUMBER.replace(/[^0-9]/g, '');
        const senderJid = `${cleanPhone}@s.whatsapp.net`;
        const newGroup = await sock.groupCreate('Alertas', [senderJid]);
        alertGroupJid = newGroup.id;
        console.log(`✅ Grupo "Alertas" creado automáticamente con JID: ${alertGroupJid}`);
        return alertGroupJid;
    } catch (e) {
        console.error("⚠️ Error buscando o creando grupo Alertas:", e.message);
        return null;
    }
}

bridgeApp.post('/api/send-alert', async (req, res) => {
    try {
        const { messageText } = req.body;
        if (!messageText) return res.status(400).json({ error: 'messageText es requerido' });

        if (globalSock) {
            const groupJid = await findOrCreateAlertsGroup(globalSock);
            if (groupJid) {
                await globalSock.sendMessage(groupJid, { text: messageText });
                console.log(`🚨 [Alertas Group] Notificación automática enviada al grupo "Alertas" (${groupJid})`);
                return res.json({ success: true, sentTo: 'Alertas Group', groupJid });
            }
        }
        res.status(500).json({ success: false, error: 'Socket no conectado o grupo Alertas no disponible' });
    } catch (e) {
        console.error("⚠️ Error enviando alerta al grupo Alertas:", e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

bridgeApp.get('/api/status', (req, res) => {
    const isConnected = Boolean(globalSock && globalSock.user);
    let pairingCode = null;
    const pPath = path.join(process.cwd(), 'pairing_code.txt');
    if (fs.existsSync(pPath)) {
        try {
            pairingCode = fs.readFileSync(pPath, 'utf8').trim();
        } catch (e) {}
    }
    res.json({
        connected: isConnected,
        user: globalSock?.user || null,
        pairingCode
    });
});

bridgeApp.listen(5002, () => {
    console.log("📡 Bridge Alert Server escuchando en puerto 5002 para notificaciones automáticas al grupo Alertas");
});

async function getChatName(sock, remoteJid) {
  if (!remoteJid) return '';
  if (groupNameCache.has(remoteJid)) return groupNameCache.get(remoteJid);
  
  if (remoteJid.endsWith('@g.us')) {
    try {
      const meta = await sock.groupMetadata(remoteJid);
      const name = meta.subject || '';
      groupNameCache.set(remoteJid, name);
      return name;
    } catch (e) {
      return '';
    }
  }
  return '';
}

async function sendBotReply(sock, remoteJid, text) {
  if (!text) return;
  recentBotTexts.add(text.trim());
  if (recentBotTexts.size > 200) recentBotTexts.clear();

  let chatHistory = recentClientChats.get(remoteJid) || [];
  chatHistory.push({ text: text.trim(), fromMe: true, timestamp: Date.now() });
  if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);
  recentClientChats.set(remoteJid, chatHistory);

  try {
    // 🛡️ Simulación Humana (Typing Indicator) Anti-Ban
    await sock.sendPresenceUpdate('composing', remoteJid);
    const typingDelay = Math.min(Math.max(text.length * 10, 1000), 2200);
    await new Promise(r => setTimeout(r, typingDelay));
    await sock.sendPresenceUpdate('paused', remoteJid);
  } catch (presenceErr) {}

  const sent = await sock.sendMessage(remoteJid, { text });
  if (sent && sent.key && sent.key.id) {
    botSentMsgIds.add(sent.key.id);
    if (botSentMsgIds.size > 1000) botSentMsgIds.clear();
  }
}

async function connectToWhatsApp() {
  const authStateDir = path.join(process.cwd(), 'baileys_auth_info');
  const { state, saveCreds } = await useMultiFileAuthState(authStateDir);

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    browser: Browsers.ubuntu('Chrome'),
    auth: state,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    retryRequestOptions: {
      maxRetries: 5
    }
  });

  globalSock = sock;

  sock.ev.on('creds.update', saveCreds);

  if (!sock.authState.creds.registered && process.env.USE_PAIRING_CODE === 'true') {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(PHONE_NUMBER);
        const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log('\n========================================');
        console.log(`🔑 CÓDIGO DE VINCULACIÓN NATIVO: ${formattedCode}`);
        console.log('========================================\n');
        fs.writeFileSync(path.join(process.cwd(), 'pairing_code.txt'), formattedCode);
      } catch (err) {
        console.error('Error al generar código de vinculación:', err);
      }
    }, 4000);
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n========================================');
      console.log('📱 ESCANEA ESTE CÓDIGO QR CON WHATSAPP:');
      console.log('========================================\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      console.log('Conexión cerrada. Reconectando...', shouldReconnect);
      if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 3000);
      }
    } else if (connection === 'open') {
      console.log('🎉 ¡WHATSAPP CONECTADO Y EN LÍNEA EXITOSAMENTE!');
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    try {
      // 1. REGLA DE ORO 1: Procesar SOLO mensajes en vivo (notify), ignorar historial (append)
      if (m.type !== 'notify') return;

      const msg = m.messages[0];
      if (!msg || !msg.message) return;

      const msgId = msg.key.id;
      // 2. REGLA DE ORO 2: Ignorar si el ID ya fue procesado o si fue enviado por el bot
      if (processedMsgIds.has(msgId) || botSentMsgIds.has(msgId)) return;
      processedMsgIds.add(msgId);
      const remoteJid = msg.key.remoteJid;
      const isFromMe = msg.key.fromMe;
      const senderNumber = remoteJid.replace('@s.whatsapp.net', '');
      const isImageMsg = Boolean(msg.message?.imageMessage);
      const textMessage = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '').trim();

      // -------------------------------------------------------------
      // DETECCIÓN Y VALIDACIÓN AUTOMÁTICA DE VOUCHERS (OCR CON GEMINI)
      // -------------------------------------------------------------
      if (isImageMsg && activePaymentTickets.has(senderNumber)) {
        try {
          console.log(`📸 [OCR Voucher] Imagen recibida de cliente +${senderNumber}. Analizando con Gemini Vision...`);
          const chatName = await getChatName(sock, remoteJid);
          const buffer = await downloadMediaMessage(msg, 'buffer', {});
          const voucherData = await analyzeVoucherWithGemini(buffer, 'image/jpeg');
          const verification = verifyVoucherAgainstTicket(voucherData, senderNumber, chatName);

          if (verification.matched) {
            const ticket = verification.ticket;
            if (ticket.timer) clearTimeout(ticket.timer);
            if (ticket.reminderTimer) clearTimeout(ticket.reminderTimer);
            ticket.status = 'COMPLETED';
            activePaymentTickets.delete(senderNumber);

            const isCrunchy = (ticket.serviceKey === 'crunchyroll' || (ticket.serviceName || '').toLowerCase().includes('crunchy'));

            const clientConfirmation = `✅ *¡COMPROBANTE VERIFICADO CON ÉXITO!* 🎉\n` +
                                       `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                       `Hola *${ticket.clientName}*, hemos validado tu pago por el total exacto de *S/ ${ticket.amount}*.\n\n` +
                                       `🍿 *Servicio:* ${ticket.serviceName}\n` +
                                       (isCrunchy 
                                         ? `⚡ *Nota de entrega:* Tu cuenta de Crunchyroll está siendo preparada por el Director para su entrega manual inmediata. ✨`
                                         : `⚡ *Estado:* Activación registrada con entrega inmediata. ¡A disfrutar! 🚀`) +
                                       `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                       `¡Muchas gracias por tu preferencia con *CuycitoGo*! 🙌`;

            await sendBotReply(sock, remoteJid, clientConfirmation);

            // Alerta urgente y formal al Director
            const directorJid = `${PHONE_NUMBER}@s.whatsapp.net`;
            const directorAlert = `🚨 *¡NUEVO PAGO VERIFICADO AUTOMÁTICAMENTE (OCR)!* 💵\n` +
                                  `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                  `• 👤 *Cliente:* +${senderNumber} (${ticket.clientName})\n` +
                                  `• 🍿 *Servicio:* ${ticket.serviceName}\n` +
                                  `• 💵 *Monto:* *S/ ${ticket.amount}* (Validado por centavos exactos)\n` +
                                  `• 🏦 *App / Banco:* ${voucherData.app || 'Yape/Plin'}\n` +
                                  `• 👤 *Titular en Voucher:* ${voucherData.senderName || 'No detectado'}\n` +
                                  `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                  `⚡ *Acción:* ${isCrunchy ? '👉 Entregar credenciales manuales de Crunchyroll al cliente.' : '✅ Servicio listo y confirmado.'}`;

            await sendBotReply(sock, directorJid, directorAlert);
            return;
          } else {
            console.log(`⚠️ Voucher no coincidió con ticket: ${verification.reason}`);
          }
        } catch (ocrErr) {
          console.error("⚠️ Error en procesamiento OCR del voucher:", ocrErr.message);
        }
      }

      if (!textMessage) return;

      // 3. REGLA DE ORO 3: Ignorar si el texto coincide con cualquier respuesta enviada previamente por el bot
      if (recentBotTexts.has(textMessage)) return;

      // 4. REGLA DE ORO 4: Ignorar si contiene marcadores distintivos de respuestas del bot
      if (textMessage.includes('🎩') ||
          textMessage.includes('🤖') ||
          textMessage.includes('🛠️') ||
          textMessage.includes('REPORTE DE VENCIMIENTOS') ||
          textMessage.includes('Asistente Virtual') ||
          textMessage.includes('VENTA REGISTRADA') ||
          textMessage.includes('Total de cuentas a revisar') ||
          textMessage.includes('¿Le gustaría que') ||
          textMessage.includes('Estoy a su completa disposición')) {
        return;
      }

      const chatName = await getChatName(sock, remoteJid);
      const lowerText = textMessage.toLowerCase();

      // Guardar en historial de memoria de chats recientes (últimos 10 mensajes)
      let clientHistory = recentClientChats.get(remoteJid) || [];
      clientHistory.push({ text: textMessage, fromMe: isFromMe, timestamp: Date.now() });
      if (clientHistory.length > 10) clientHistory = clientHistory.slice(-10);
      recentClientChats.set(remoteJid, clientHistory);

      const isExplicitJefeCommand = lowerText.startsWith('@jefecuy') ||
                                    lowerText.startsWith('#jefe') ||
                                    lowerText.startsWith('jefecuy') ||
                                    lowerText.includes('@act') ||
                                    lowerText.includes('/act') ||
                                    lowerText.includes('comunicado') ||
                                    lowerText.includes('@atencionalcliente') ||
                                    lowerText.includes('@atencion') ||
                                    lowerText.includes('@publicidad') ||
                                    lowerText.includes('/showme') ||
                                    lowerText.includes('showme') ||
                                    lowerText.includes('/mensajes') ||
                                    lowerText.includes('/mensaje') ||
                                    lowerText.includes('/saldosclientes') ||
                                    lowerText.includes('/saldos') ||
                                    lowerText.includes('@creargrupo') ||
                                    lowerText.includes('@agentes') ||
                                    lowerText.includes('@directorio') ||
                                    lowerText.includes('@listaagentes') ||
                                    lowerText.includes('@cuentamatrizeditar') ||
                                    lowerText.includes('@cuentamatriz') ||
                                    lowerText.includes('@actualizardatacliente') ||
                                    lowerText.includes('@actualizardatos') ||
                                    lowerText.includes('@editarcliente') ||
                                    lowerText.includes('@vencimiento') ||
                                    lowerText.includes('@stock') ||
                                    lowerText.includes('@finanzas') ||
                                    lowerText.includes('@marketing') ||
                                    lowerText.includes('programa la alerta') ||
                                    lowerText.includes('programar alerta') ||
                                    lowerText.includes('@agregarsaldo') ||
                                    lowerText.includes('@restarsaldo') ||
                                    lowerText.includes('@modificarsaldo') ||
                                    lowerText.includes('@saldo') ||
                                    isUserInUpdateSession(senderNumber) ||
                                    isUserInMarketingSession(senderNumber) ||
                                    isUserInMatrixUpdateSession(senderNumber) ||
                                    isUserInGroupCreationSession(senderNumber) ||
                                    isUserInJefeFeedbackSession(senderNumber) ||
                                    isUserInBalanceUpdateSession(senderNumber) ||
                                    isDirectorInAtencionSession(senderNumber) ||
                                    isUserInActSession(senderNumber) ||
                                    isUserInComunicadoSession(remoteJid) ||
                                    isUserInComunicadoSession(senderNumber);

      const isJefeChat = isExplicitJefeCommand ||
                         chatName.toLowerCase().includes('jefecuy') ||
                         chatName.toLowerCase().includes('jefecuycito');

      // -------------------------------------------------------------
      // MODO AUTO-SERVICIO CLIENTES: /micuenta, /misaldo, /misservicios, @cuycitogo
      // -------------------------------------------------------------
      const isCustomerSelfService = lowerText.includes('/micuenta') || lowerText === 'mi cuenta' ||
                                    lowerText.includes('/misaldo') || lowerText === 'mi saldo' ||
                                    lowerText.includes('/misservicios') || lowerText === 'mis servicios' ||
                                    lowerText.includes('@cuycitogo') || lowerText.includes('@cuycito') ||
                                    lowerText === '/ayuda' || lowerText === '/comandos';

      if (isCustomerSelfService) {
        const antiSpam = checkCustomerAntiSpam(senderNumber);
        if (!antiSpam.allowed) {
          await sendBotReply(sock, remoteJid, antiSpam.message);
          return;
        }

        if (lowerText.includes('/micuenta') || lowerText === 'mi cuenta') {
          const res = await handleCustomerMiCuenta(senderNumber);
          await sendBotReply(sock, remoteJid, res);
          return;
        }
        if (lowerText.includes('/misaldo') || lowerText === 'mi saldo') {
          const res = await handleCustomerMiSaldo(senderNumber);
          await sendBotReply(sock, remoteJid, res);
          return;
        }
        if (lowerText.includes('/misservicios') || lowerText === 'mis servicios') {
          const res = await handleCustomerMisServicios(senderNumber);
          await sendBotReply(sock, remoteJid, res);
          return;
        }
        if (lowerText.includes('@cuycitogo') || lowerText.includes('@cuycito') || lowerText === '/ayuda' || lowerText === '/comandos') {
          const res = await handleCuycitoGoActivation(senderNumber);
          await sendBotReply(sock, remoteJid, res);
          return;
        }
      }

      const isTopupMsg = lowerText.includes('/recargar') ||
                         lowerText.includes('recargar') ||
                         lowerText.includes('recarga') ||
                         lowerText.includes('aplique una recarga') ||
                         lowerText.includes('yapear') ||
                         lowerText.includes('yapee') ||
                         lowerText.includes('yapeé') ||
                         lowerText.includes('plin') ||
                         lowerText.includes('@cuycitosupport') ||
                         lowerText.includes('reclamo') ||
                         lowerText.includes('reclamar') ||
                         (lowerText.includes('saldo') && lowerText.includes('quiero recargar'));

      // -------------------------------------------------------------
      // MODO RECARGAS Y VERIFICACIÓN DE PAGOS (CUYCITO AI)
      // -------------------------------------------------------------
      if (isTopupMsg) {
        console.log(`💳 [CuycitoAI Payments] Mensaje de recarga recibido: "${textMessage}" de (${senderNumber})`);

        const topupRes = await fetch('http://localhost:5001/api/agent/payment-topup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageText: textMessage, senderNumber })
        });

        const topupData = await topupRes.json();

        if (topupData && topupData.replyText) {
          let sentMsg;
          if (topupData.sendQrImage) {
            try {
              const localQrPath = path.join(process.cwd(), 'qr_pago_oficial.png');
              const qrSource = fs.existsSync(localQrPath) ? { url: localQrPath } : { url: topupData.qrImageUrl };
              sentMsg = await sock.sendMessage(remoteJid, {
                image: qrSource,
                caption: topupData.replyText
              });
            } catch (imgErr) {
              console.error("⚠️ Error enviando imagen QR por WhatsApp:", imgErr.message);
              sentMsg = await sock.sendMessage(remoteJid, { text: topupData.replyText });
            }
          } else {
            sentMsg = await sock.sendMessage(remoteJid, { text: topupData.replyText });
          }
          if (sentMsg && sentMsg.key) botSentMsgIds.add(sentMsg.key.id);
        }
        return;
      }

      const isDeveloperChat = chatName.toLowerCase().includes('developer') ||
                              lowerText.startsWith('developer');

      // -------------------------------------------------------------
      // MODO 1: ROL JEFE CUYCITO (DIRECTOR GENERAL VIRTUAL CON GEMINI AI)
      // -------------------------------------------------------------
      if (isJefeChat) {
        console.log(`🎩 [JefeCuycito AI] Consulta humana recibida: "${textMessage}"`);

        // Intercepción: Comando /act (Actualización de Cuenta Matriz y Difusión)
        if (lowerText.includes('/act') || lowerText.includes('@act')) {
          const welcomeAct = startActSession(senderNumber);
          await sendBotReply(sock, remoteJid, welcomeAct);
          return;
        }

        if (isUserInActSession(senderNumber)) {
          const actReply = await handleActStep(
            senderNumber,
            textMessage,
            (targetJid, text) => sendBotReply(sock, targetJid, text)
          );
          if (actReply) {
            await sendBotReply(sock, remoteJid, actReply);
          }
          return;
        }

        // Intercepción: Comando /comunicado o /comunicados (Difusión a ocupantes de Cuenta Matriz)
        const comunicadoKey = isUserInComunicadoSession(remoteJid) ? remoteJid : senderNumber;

        if (isUserInComunicadoSession(comunicadoKey)) {
          const comunicadoReply = await handleComunicadoStep(
            comunicadoKey,
            textMessage,
            (targetJid, text) => sendBotReply(sock, targetJid, text)
          );
          if (comunicadoReply) {
            await sendBotReply(sock, remoteJid, comunicadoReply);
          }
          return;
        }

        if (lowerText.includes('comunicado')) {
          const welcomeComunicado = startComunicadoSession(comunicadoKey);
          await sendBotReply(sock, remoteJid, welcomeComunicado);
          return;
        }

        // Intercepción: Agente @Atencionalcliente
        if (lowerText.includes('@atencionalcliente') || lowerText.includes('@atencion')) {
          const welcomeAtencion = startAtencionSession(senderNumber);
          await sendBotReply(sock, remoteJid, welcomeAtencion);
          return;
        }

        if (isDirectorInAtencionSession(senderNumber)) {
          const atencionReply = await handleDirectorAtencionStep(
            senderNumber,
            textMessage,
            recentClientChats,
            (targetJid, text) => sendBotReply(sock, targetJid, text)
          );
          if (atencionReply) {
            await sendBotReply(sock, remoteJid, atencionReply);
          }
          return;
        }

        // Intercepción: Agente @Publicidad
        if (lowerText.includes('@publicidad')) {
          let pubMsg = `📢 *AGENTE @Publicidad - CATÁLOGO Y CONDICIONES OFICIALES* ✨\n`;
          pubMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          Object.values(STREAMING_CATALOG).forEach(serv => {
            pubMsg += `\n${serv.badge}\n`;
            pubMsg += `💰 *Precio Base:* S/ ${serv.defaultPrice.toFixed(2)}\n`;
            serv.specs.forEach(s => pubMsg += `  • ${s}\n`);
          });
          pubMsg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          pubMsg += `🤝 *Trabajo en equipo:* @Atencionalcliente utiliza este catálogo para redactar ofertas personalizadas a cada cliente. 🚀`;
          await sendBotReply(sock, remoteJid, pubMsg);
          return;
        }

        const jefeAiRes = await fetch(JEFE_CUYCITO_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageText: textMessage, senderNumber })
        });
        const jefeData = await jefeAiRes.json();

        if (jefeData.action === 'CREATE_GROUP' && jefeData.groupName) {
          try {
            const cleanPhone = senderNumber.replace(/[^0-9]/g, '');
            const senderJid = cleanPhone ? `${cleanPhone}@s.whatsapp.net` : sock.user.id.split(':')[0] + '@s.whatsapp.net';
            
            // Crear el grupo agregando ÚNICAMENTE al usuario solicitante (nadie más)
            const groupInfo = await sock.groupCreate(jefeData.groupName, [senderJid]);

            const confirmMsg = 
              `👑 *DIRECTOR @JefeCuy - GRUPO CREADO CON ÉXITO* 📱\n` +
              `━━━━━━━━━━━━━━━\n\n` +
              `✅ Se ha creado el grupo exclusivo: *"${jefeData.groupName}"*\n` +
              `👤 *Participante:* Solo tú (+${cleanPhone || 'Dueño'})\n` +
              `🆔 *ID de Grupo:* \`${groupInfo.id}\`\n\n` +
              `🔒 *Garantía de Privacidad:* Nadie más ha sido agregado a este grupo (0 miembros externos).\n` +
              `📌 *Uso:* Asignado para recibir notificaciones del área de ${jefeData.groupName}. 🚀`;

            await sendBotReply(sock, remoteJid, confirmMsg);
            console.log(`✅ Grupo 100% privado "${jefeData.groupName}" creado por orden de Director @JefeCuy`);
          } catch (createErr) {
            console.error('Error al crear grupo:', createErr);
            await sendBotReply(sock, remoteJid, `❌ Error al crear grupo "${jefeData.groupName}": ${createErr.message}`);
          }
          return;
        }

        if ((jefeData.action === 'SHOWME' || jefeData.action === 'TWO_MESSAGES') && Array.isArray(jefeData.messages)) {
          for (let i = 0; i < jefeData.messages.length; i++) {
            await sendBotReply(sock, remoteJid, jefeData.messages[i]);
            if (i < jefeData.messages.length - 1) {
              await new Promise(r => setTimeout(r, 800));
            }
          }
          console.log(`📊 Mensajes secuenciales de @JefeCuy enviadas con éxito.`);
          return;
        }

        if (jefeData.replyText) {
          await sendBotReply(sock, remoteJid, jefeData.replyText);
          console.log(`🧠 Respuesta conversacional de JefeCuycito enviada al Jefe`);
        }
        return;
      }

      // -------------------------------------------------------------
      // MODO 2: ROL DEVELOPER (LABORATORIO & PRUEBAS DE CÓDIGO)
      // -------------------------------------------------------------
      if (isDeveloperChat) {
        console.log(`🛠️ [Agente Developer] Instrucción recibida: "${textMessage}"`);
        const devReply = `🛠️ *AGENTE DEVELOPER (ENTORNO DE PRUEBAS & DEPURACIÓN)* 💻\n\nRecibí tu instrucción de desarrollo: "${textMessage}"\n\n✅ **Estado:** Módulo activo.\n📡 **API Status:** OK (Servidor 5001 & Firestore)\n🤖 **Gemini AI:** v3.6 Flash activo.`;
        await sendBotReply(sock, remoteJid, devReply);
        return;
      }

      // -------------------------------------------------------------
      // MODO 3: ATENCIÓN A CLIENTES EXTERNOS / PRUEBAS EN CHAT PROPIO
      // -------------------------------------------------------------
      const myJid = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : `${PHONE_NUMBER}@s.whatsapp.net`;
      const isSelfChat = remoteJid === myJid || senderNumber.includes(PHONE_NUMBER);

      // Ignorar mensajes enviados por mí hacia TERCEROS (evita loops en chats ajenos)
      if (isFromMe && !isSelfChat) return;

      // REGLA DE ORO: Responder SOLO en chats privados individuales, NUNCA en grupos
      if (remoteJid.endsWith('@g.us')) {
        return;
      }

      console.log(`📩 Mensaje de Cliente / Prueba (${senderNumber}): "${textMessage}"`);

      // 0. Si el cliente está respondiendo a una oferta de Renovación Proactiva (Opción 1 o 2)
      if (isUserInRenewalSession(senderNumber)) {
        const renewalRes = await handleRenewalResponse(
          senderNumber,
          textMessage,
          (jid, txt) => sendBotReply(sock, jid, txt)
        );

        if (renewalRes) {
          if (typeof renewalRes === 'object' && renewalRes.replyText) {
            if (renewalRes.sendPaymentQr) {
              const qrPath = path.join(process.cwd(), 'qr_pago_oficial.png');
              if (fs.existsSync(qrPath)) {
                const sentMsg = await sock.sendMessage(remoteJid, {
                  image: { url: qrPath },
                  caption: renewalRes.replyText
                });
                if (sentMsg?.key) botSentMsgIds.add(sentMsg.key.id);
                return;
              }
            }
            await sendBotReply(sock, remoteJid, renewalRes.replyText);
            return;
          }
          return;
        }
      }

      // 1. Procesar con el Agente @Atencionalcliente (Catálogo con imagen, precios y flujo de 5 minutos)
      const atencionResult = await processCustomerMessage(
        senderNumber,
        textMessage,
        (jid, txt) => sendBotReply(sock, jid, txt)
      );

      if (atencionResult && atencionResult.replyText) {
        if (atencionResult.sendCatalogImage) {
          const catalogImagePath = path.join(process.cwd(), 'catalogo_oficial_cuycitogo.jpg');
          if (fs.existsSync(catalogImagePath)) {
            const sentMsg = await sock.sendMessage(remoteJid, {
              image: { url: catalogImagePath },
              caption: atencionResult.replyText
            });
            if (sentMsg && sentMsg.key) botSentMsgIds.add(sentMsg.key.id);
            console.log(`🖼️ Catálogo oficial con propuesta enviado a Cliente (${senderNumber})`);
            return;
          }
        }

        if (atencionResult.sendPaymentQr) {
          const qrPath = path.join(process.cwd(), 'qr_pago_oficial.png');
          if (fs.existsSync(qrPath)) {
            const sentMsg = await sock.sendMessage(remoteJid, {
              image: { url: qrPath },
              caption: atencionResult.replyText
            });
            if (sentMsg && sentMsg.key) botSentMsgIds.add(sentMsg.key.id);
            console.log(`🎟️ Ticket de pago con QR enviado a Cliente (${senderNumber})`);
            return;
          }
        }

        await sendBotReply(sock, remoteJid, atencionResult.replyText);
        console.log(`🤖 Respuesta de @Atencionalcliente enviada a Cliente (${senderNumber})`);
        return;
      }

      // Fallback a Activepieces / Local Agent
      try {
        await fetch(ACTIVEPIECES_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: senderNumber, messageText: textMessage })
        });
      } catch (e) {}

      const agentRes = await fetch(LOCAL_AGENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: senderNumber, messageText: textMessage })
      });
      const data = await agentRes.json();

      if (data && data.shouldReply && data.replyText) {
        await sendBotReply(sock, remoteJid, data.replyText);
        console.log(`🤖 Respuesta de Agente enviada a Cliente (${senderNumber})`);
      }
    } catch (err) {
      console.error('Error en puente de WhatsApp:', err);
    }
  });
}

connectToWhatsApp();
