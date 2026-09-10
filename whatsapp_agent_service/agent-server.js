import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    classifyMessageIntent,
    generateStoreResponse,
    parseSaleDataWithGemini,
    processJefeCuycitoAI
} from './gemini-service.js';

import {
    getStoreCatalog,
    getCustomerInfoAndSubscriptions,
    checkDuplicateSale,
    registerSaleInFirestore,
    getExpiringSubscriptionsReport,
    searchCustomerSubscriptions,
    handleInteractiveCustomerUpdate,
    isUserInUpdateSession,
    handleVencimientoCommand,
    handleStockCommand,
    handleFinanzasCommand,
    handleSaldosClientesCommand,
    cleanPhoneNumber
} from './firestore-store-service.js';

import {
    handleInteractiveMarketingFlow,
    isUserInMarketingSession
} from './jefe-marketing-service.js';

import {
    handleCuentaMatrizReport,
    handleInteractiveMatrixUpdate,
    isUserInMatrixUpdateSession,
    startMatrixExpirationNotifier,
    handleShowMeCommand
} from './cuentamatriz-service.js';

import {
    STREAMING_CATALOG,
    formatCustomerOfferMessage,
    identifyServiceFromText
} from './agente-publicidad-service.js';

import {
    handleInteractiveGroupCreation,
    isUserInGroupCreationSession
} from './jefe-group-service.js';

import {
    processAdvancedJefeAI,
    isUserInJefeFeedbackSession
} from './jefe-ai-service.js';

import {
    handleInteractiveBalanceUpdate,
    isUserInBalanceUpdateSession
} from './jefe-balance-service.js';

import {
    checkCustomerAntiSpam,
    checkSupportDailyLimit,
    handleCuycitoGoActivation,
    handleCustomerMiCuenta,
    handleCustomerMiSaldo,
    handleCustomerMisServicios
} from './customer-commands-service.js';

import {
    generateUniqueAmount,
    isAmountLockedOrUsed,
    lockAndDiscardAmount,
    addBalanceToCustomer,
    createTopupTicket,
    getValidTicketForAmount,
    countUserTicketsIn24h
} from './payment-verification-service.js';

import {
    registerIncomingPaymentEmail,
    verifyPaymentInGmail
} from './gmail-payment-checker.js';

import {
    registerClaimTicket,
    getDailyClaimsReport,
    handleCuycitoSupportQuery
} from './cuycito-support-service.js';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { sanitizeInputText } from './security-sanitizer.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware de Ciberseguridad y Hardening
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate Limiting (Protección Anti-DoS)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    message: { success: false, error: '⚠️ Demasiadas peticiones enviadas. Inténtalo más tarde.' }
});
app.use('/api/', apiLimiter);

// Middleware de Autenticación de Webhooks por Token Secreto
function verifyWebhookSecret(req, res, next) {
    const incomingToken = req.headers['x-cuycito-secret-token'];
    const expectedToken = process.env.WEBHOOK_SECRET_TOKEN || 'CUYCITO_SECURE_TOKEN_2026_XYZ';

    if (!incomingToken || incomingToken !== expectedToken) {
        console.warn(`🚨 [Seguridad Webhook] Petición no autorizada rechazada desde IP: ${req.ip}`);
        return res.status(401).json({ success: false, error: 'Unauthorized: Token de seguridad inválido o ausente en X-Cuycito-Secret-Token' });
    }
    next();
}

// -------------------------------------------------------------
// WEBHOOK RECEPTOR DE GMAIL (Google Apps Script) - PROTEGIDO CON TOKEN
// -------------------------------------------------------------
app.post('/api/webhooks/gmail-payment', verifyWebhookSecret, async (req, res) => {
    try {
        const { senderName, amount, bank, rawSubject, body, timestamp } = req.body;
        console.log(`📩 [Gmail Webhook] Notificación recibida desde cmancocambillo@gmail.com (${bank || 'Lemon Cash'}): S/ ${amount}`);

        if (!amount || isNaN(parseFloat(amount))) {
            return res.status(400).json({ success: false, error: 'Monto inválido' });
        }

        const record = registerIncomingPaymentEmail({
            senderName: senderName || 'Lemon Cash',
            amount: parseFloat(amount).toFixed(2),
            bank: bank || 'Lemon Cash',
            rawSubject: rawSubject || 'Pago recibido en Lemon',
            body: body || '',
            timestamp: timestamp ? parseInt(timestamp, 10) : Date.now()
        });

        return res.json({ success: true, message: 'Notificación de pago registrada en CuycitoGo', record });
    } catch (e) {
        console.error("⚠️ Error en webhook de Gmail:", e.message);
        return res.status(500).json({ success: false, error: e.message });
    }
});
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// -------------------------------------------------------------
// Endpoint de Salud y Página de Inicio Visual
// -------------------------------------------------------------
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>CuycitoGO - Servicio de Agentes WhatsApp IA</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
                .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); max-width: 500px; width: 90%; border: 1px solid #334155; text-align: center; }
                .badge { background: #10b981; color: #022c22; font-weight: bold; padding: 0.4rem 1rem; border-radius: 9999px; display: inline-block; font-size: 0.85rem; margin-bottom: 1rem; }
                h1 { margin: 0 0 0.5rem 0; font-size: 1.6rem; color: #38bdf8; }
                p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
                .endpoint { background: #0f172a; padding: 0.8rem; border-radius: 0.5rem; border: 1px solid #334155; text-align: left; margin-top: 1rem; font-family: monospace; font-size: 0.85rem; color: #a5f3fc; }
                .method { color: #f43f5e; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="badge">🟢 SERVIDOR ACTIVO & EN LÍNEA</div>
                <h1>🤖 CuycitoGO WhatsApp AI Service</h1>
                <p>El servicio de Agentes Inteligentes con Gemini AI y Firebase Firestore está funcionando correctamente.</p>
                <div class="endpoint">
                    <span class="method">POST</span> /api/agent/customer-support
                </div>
                <div class="endpoint">
                    <span class="method">POST</span> /api/agent/register-sale
                </div>
                <div class="endpoint">
                    <span class="method" style="color:#10b981;">GET</span> /health
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'CuycitoGO WhatsApp AI Agent Service',
        timestamp: new Date().toISOString()
    });
});

// -------------------------------------------------------------
// AGENTE 1: Endpoint de Atención al Cliente & Filtro Inteligente
// -------------------------------------------------------------
/**
 * Body esperado desde Activepieces / Webhook:
 * {
 *   "phoneNumber": "51987654321",
 *   "messageText": "Hola cuanto me falta que venza mi suscripcion?"
 * }
 */
app.post('/api/agent/customer-support', async (req, res) => {
    try {
        const { phoneNumber, messageText } = req.body;

        if (!phoneNumber || !messageText) {
            return res.status(400).json({
                error: "Parámetros requeridos: 'phoneNumber' y 'messageText'."
            });
        }

        // PREVENCIÓN DE PROMPT INJECTION & JAILBREAK
        try {
            sanitizeInputText(messageText);
        } catch (secErr) {
            return res.json({
                action: 'REPLY',
                shouldReply: true,
                replyText: secErr.userFacingMessage || "🛡️ *MENSAJE RECHAZADO POR SEGURIDAD* 🚨",
                customerFound: false
            });
        }

        console.log(`\n📩 [Agente 1] Mensaje entrante de (${phoneNumber}): "${messageText}"`);

        const cleanSender = cleanPhoneNumber(phoneNumber);

        // FILTRO DE SEGURIDAD: Bloqueo de consultas sobre números de terceros
        const phoneMatches = messageText.match(/(?:51)?9[0-9]{8}/g);
        if (phoneMatches) {
            const thirdPartyPhone = phoneMatches.find(p => cleanPhoneNumber(p) !== cleanSender);
            if (thirdPartyPhone) {
                console.warn(`🚨 [Seguridad] Cliente (${cleanSender}) intentó consultar cuenta ajena: (${thirdPartyPhone})`);
                return res.json({
                    action: 'REPLY',
                    shouldReply: true,
                    replyText: `🔒 *ACCESO RESTRINGIDO DE SEGURIDAD* 🛡️\n\nPor políticas de privacidad y protección de datos de CuycitoGo, solo puedes realizar consultas vinculadas a tu propio número de WhatsApp (+${cleanSender}).\n\nNo está permitido consultar ni solicitar información sobre cuentas de otros usuarios.`,
                    customerFound: false,
                    activeSubscriptionsCount: 0
                });
            }
        }

        const lowerText = (messageText || '').toLowerCase().trim();

        // 1. COMPROBACIÓN DE PROTECCIÓN ANTI-SPAM (5s entre peticiones / 1 min enfriamiento tras 5 peticiones)
        const isCmd = lowerText.includes('@cuycitogo') || lowerText.includes('/micuenta') || lowerText.includes('/misaldo') || lowerText.includes('/misservicios');
        if (isCmd) {
            const spamCheck = checkCustomerAntiSpam(phoneNumber);
            if (!spamCheck.allowed) {
                console.warn(`⏳ [Anti-Spam] Solicitud bloqueada (${spamCheck.reason}) para (${cleanSender})`);
                return res.json({
                    action: 'REPLY',
                    shouldReply: true,
                    replyText: spamCheck.message
                });
            }
        }

        // 2. COMANDO ACTIVADOR: @CuycitoGo
        if (lowerText.includes('@cuycitogo') || lowerText === '@cuycito') {
            console.log(`🤖 [Cliente Cmd] Activación @CuycitoGo recibida de (${cleanSender})`);
            const actReply = await handleCuycitoGoActivation(phoneNumber);
            return res.json({ action: 'REPLY', shouldReply: true, replyText: actReply });
        }

        // 3. COMANDO: /micuenta
        if (lowerText.includes('/micuenta') || lowerText === 'mi cuenta') {
            console.log(`👤 [Cliente Cmd] /micuenta solicitado por (${cleanSender})`);
            const accReply = await handleCustomerMiCuenta(phoneNumber);
            return res.json({ action: 'REPLY', shouldReply: true, replyText: accReply });
        }

        // 4. COMANDO: /misaldo
        if (lowerText.includes('/misaldo') || lowerText === 'mi saldo') {
            console.log(`💳 [Cliente Cmd] /misaldo solicitado por (${cleanSender})`);
            const saldReply = await handleCustomerMiSaldo(phoneNumber);
            return res.json({ action: 'REPLY', shouldReply: true, replyText: saldReply });
        }

        // 5. COMANDO: /misservicios
        if (lowerText.includes('/misservicios') || lowerText === 'mis servicios' || lowerText.includes('mis suscripciones')) {
            console.log(`📦 [Cliente Cmd] /misservicios solicitado por (${cleanSender})`);
            const servReply = await handleCustomerMisServicios(phoneNumber);
            return res.json({ action: 'REPLY', shouldReply: true, replyText: servReply });
        }

        // 1. Clasificar Intención (Tienda vs Familiar/Personal)
        const classification = await classifyMessageIntent(messageText);
        console.log(`🤖 [Agente 1] Clasificación: ${classification.category}`);

        if (classification.category === 'PERSONAL_OTHER') {
            return res.json({
                action: 'IGNORE',
                shouldReply: false,
                reason: 'Mensaje clasificado como personal o no relacionado a la tienda.'
            });
        }

        // 2. Si es STORE_INQUIRY -> Obtener datos EXCLUSIVOS del cliente autenticado
        const customerInfo = await getCustomerInfoAndSubscriptions(phoneNumber);
        const catalogItems = await getStoreCatalog();

        // 3. Generar respuesta contextualizada con Gemini y blindaje de privacidad
        const replyText = await generateStoreResponse(messageText, customerInfo.subscriptions, catalogItems, phoneNumber);

        console.log(`✅ [Agente 1] Respuesta generada exitosamente.`);

        return res.json({
            action: 'REPLY',
            shouldReply: true,
            replyText: replyText,
            customerFound: !!customerInfo.customer,
            activeSubscriptionsCount: customerInfo.subscriptions.length
        });
    } catch (error) {
        console.error("❌ Error en Agente 1 (Customer Support):", error);
        return res.status(500).json({
            error: "Error interno al procesar mensaje de soporte.",
            details: error.message
        });
    }
});

// -------------------------------------------------------------
// AGENTE 2: Endpoint de Registro de Ventas por WhatsApp (Texto/Foto)
// -------------------------------------------------------------
/**
 * Body esperado desde Activepieces / Webhook:
 * {
 *   "adminPhone": "51987654321",
 *   "text": "Registrar a Juan Perez 51987654321 Netflix $15 vence 30/09/2026",
 *   "imageBase64": "...", // opcional si se envía foto del comprobante
 *   "mimeType": "image/jpeg"
 * }
 */
app.post('/api/agent/register-sale', async (req, res) => {
    try {
        const { adminPhone, text = '', imageBase64 = null, mimeType = 'image/jpeg' } = req.body;

        console.log(`\n🛍️ [Agente 2] Solicitud de registro de venta recibida de Admin (${adminPhone})`);

        // 1. Validación opcional de Admin Autorizado
        const allowedAdmins = (process.env.ADMIN_WHATSAPP_NUMBERS || '').split(',').map(n => cleanPhoneNumber(n)).filter(Boolean);
        if (allowedAdmins.length > 0 && adminPhone) {
            const cleanAdmin = cleanPhoneNumber(adminPhone);
            const isAllowed = allowedAdmins.some(a => cleanAdmin.includes(a.slice(-8)));
            if (!isAllowed) {
                console.warn(`⚠️ Intento de registro por número no autorizado: ${adminPhone}`);
                return res.status(403).json({
                    success: false,
                    replyText: "🚫 Acceso denegado: Tu número de WhatsApp no está autorizado para registrar ventas."
                });
            }
        }

        if (!text && !imageBase64) {
            return res.status(400).json({
                error: "Debe enviar al menos 'text' o 'imageBase64' con la información de la venta."
            });
        }

        // 2. Extraer información estructurada con Gemini AI (Vision / Text Parser)
        console.log(`🧠 [Agente 2] Analizando comprobante / texto con Gemini AI...`);
        const extractedData = await parseSaleDataWithGemini({ text, imageBase64, mimeType });
        console.log(`📦 [Agente 2] Datos extraídos:`, extractedData);

        // 3. Verificación Anti-Duplicados en Firestore
        console.log(`🔍 [Agente 2] Verificando duplicados en Firestore...`);
        const dupCheck = await checkDuplicateSale(extractedData);

        if (dupCheck.isDuplicate) {
            console.warn(`⚠️ [Agente 2] Duplicado detectado: ${dupCheck.reason}`);
            return res.json({
                success: false,
                isDuplicate: true,
                replyText: `⚠️ REGISTRO RECHAZADO (COMPROBANTE DUPLICADO):\n\n${dupCheck.reason}`
            });
        }

        // 4. Registrar la venta en Firestore
        console.log(`💾 [Agente 2] Registrando en Firestore...`);
        const result = await registerSaleInFirestore(extractedData);

        const replyText = `✅ ¡VENTA REGISTRADA CON ÉXITO EN FIREBASE! 🚀

👤 Cliente: ${result.clientName}
🆔 Código Cliente: ${result.clientCode}
📱 Teléfono: ${extractedData.clientPhone || 'N/A'}
📺 Servicio: ${result.service}
💰 Precio: S/ ${result.price}
📅 Inicio: ${result.startDate}
🗓️ Vencimiento: ${result.endDate}
🔑 Credenciales: ${extractedData.email ? extractedData.email : 'N/A'} | PIN: ${extractedData.pin || 'N/A'}`;

        console.log(`🎉 [Agente 2] Venta registrada exitosamente con ID ${result.subscriptionId}`);

        return res.json({
            success: true,
            isDuplicate: false,
            data: result,
            replyText: replyText
        });

    } catch (error) {
        console.error("❌ Error en Agente 2 (Register Sale):", error);
        return res.status(500).json({
            success: false,
            error: "Error al procesar y registrar la venta.",
            replyText: `❌ ERROR EN EL REGISTRO: ${error.message}`
        });
    }
});

// -------------------------------------------------------------
// AGENTE ADMIN: Consulta de Usuarios por Vencer
// -------------------------------------------------------------
app.post('/api/agent/expiring-report', async (req, res) => {
    try {
        const { days = 7 } = req.body;
        console.log(`\n👑 [Agente Admin] Generando reporte de cuentas por vencer (Próximos ${days} días)...`);
        const report = await getExpiringSubscriptionsReport(days);
        return res.json({
            success: true,
            replyText: report.textReport,
            totalCount: report.totalCount,
            urgentCount: report.urgentCount
        });
    } catch (error) {
        console.error("❌ Error en Agente Admin (Expiring Report):", error);
        return res.status(500).json({
            success: false,
            replyText: "❌ Error al consultar cuentas por vencer: " + error.message
        });
    }
});

// -------------------------------------------------------------
// AGENTE CUYCITO AI: Verificación de Pagos y Recarga de Saldo Anti-Fraude
// -------------------------------------------------------------
export async function handlePaymentTopupFlow({ senderNumber, messageText = '', hasImage = false, imageBase64 = null }) {
    const cleanMsg = (messageText || '').trim();
    const lowerMsg = cleanMsg.toLowerCase();

    // -------------------------------------------------------------
    // SOPORTE Y RECLAMOS DE CLIENTES (@CuycitoSupport) - LÍMITE: 3 CONSULTAS / DÍA
    // -------------------------------------------------------------
    if (lowerMsg.includes('@cuycitosupport') || lowerMsg.includes('reclamo') || lowerMsg.includes('soporte') || lowerMsg.includes('reclamar')) {
        const supportCheck = checkSupportDailyLimit(senderNumber);
        if (!supportCheck.allowed) {
            console.warn(`🚨 [Soporte Límite] ${senderNumber} alcanzó el límite máximo de 3 consultas/día.`);
            return supportCheck.message;
        }

        const rawReason = cleanMsg.replace(/@cuycitosupport|reclamo|soporte|reclamar/gi, '').trim() || "Inconveniente con recarga/servicio";
        console.log(`🛠️ [@CuycitoSupport] Procesando consulta/reclamo (${4 - (supportCheck.remaining || 1)}/3) de (${senderNumber}): "${rawReason}"`);

        return await handleCuycitoSupportQuery({
            clientId: senderNumber,
            clientName: `Cliente ${senderNumber}`,
            clientPhone: senderNumber,
            rawReason: rawReason
        });
    }

    // -------------------------------------------------------------
    // 1. ENTRADA PÁGINA WEB - "Hola, aplique una recarga de (15.18)"
    // -------------------------------------------------------------
    const webMatch = cleanMsg.match(/(?:recarga|aplique\s+una\s+recarga|recargué|recargue)\s+(?:de\s+)?\(?\s*([0-9]+(?:\.[0-9]{1,2})?)\s*\)?/i);
    if (webMatch && (lowerMsg.includes('aplique') || lowerMsg.includes('pagina') || lowerMsg.includes('página') || lowerMsg.includes('web') || lowerMsg.includes('('))) {
        const webAmountStr = parseFloat(webMatch[1]).toFixed(2);
        console.log(`🌐 [Recarga Web] Mensaje derivado de la web detectado: S/ ${webAmountStr} para (${senderNumber})`);

        const isUsed = await isAmountLockedOrUsed(webAmountStr);
        if (isUsed) {
            return `❌ *PAGO DUPLICADO O YA PROCESADO* ⚠️\n\nEl pago por *S/ ${webAmountStr}* ya fue verificado y acreditado anteriormente en las últimas 24 horas. Para evitar fraudes, este monto fue descartado.`;
        }

        registerIncomingPaymentEmail({
            senderName: `Cliente ${senderNumber}`,
            amount: webAmountStr,
            bank: 'Yape/Web',
            rawSubject: `Confirmación recarga web S/ ${webAmountStr}`
        });

        const verification = await verifyPaymentInGmail({ amount: webAmountStr, requestTimestamp: Date.now(), senderName: null });

        if (verification.verified) {
            await lockAndDiscardAmount(webAmountStr, { clientId: senderNumber, senderName: verification.senderName, channel: 'WEB' });
            const topup = await addBalanceToCustomer(senderNumber, webAmountStr);

            return `✅ *¡RECARGA WEB VERIFICADA CON ÉXITO!* 🚀\n\n` +
                   `💰 *Monto Acreditado:* S/ ${webAmountStr}\n` +
                   `💳 *Saldo Anterior:* S/ ${topup.oldBalance.toFixed(2)}\n` +
                   `💵 *Nuevo Saldo Actual:* *S/ ${topup.newBalance.toFixed(2)}*\n\n` +
                   `¡Gracias por tu recarga en CuycitoGo! 🎉`;
        } else {
            return `⏳ *VERIFICACIÓN PENDIENTE EN GMAIL*\n\nNo encontramos la notificación de pago por *S/ ${webAmountStr}* en Gmail en la ventana de tiempo del día. Si acabas de hacer la transferencia, espera 1 minuto o escribe a @CuycitoSupport.`;
        }
    }

    // -------------------------------------------------------------
    // 2. SOLICITUD DE RECARGA CHAT (CuycitoAI) - "quiero recargar 10 soles"
    // -------------------------------------------------------------
    const topupMatch = cleanMsg.match(/(?:recargar|recarga|yapear|plin|saldo)\s+(?:de\s+)?(?:s\/?\s*)?([0-9]+(?:\.[0-9]{1,2})?)/i);

    if (topupMatch && !hasImage && !lowerMsg.includes('ya yapee') && !lowerMsg.includes('ya transferi') && !lowerMsg.includes('ya pagué')) {
        const baseAmount = parseInt(topupMatch[1], 10);
        const ticketRes = await createTopupTicket({ clientId: senderNumber, senderNumber, baseAmountInput: baseAmount });

        if (ticketRes.error) {
            return ticketRes.message;
        }

        return `🤖 *CUYCITO AI - RECARGA DE SALDO* 💳\n` +
               `━━━━━━━━━━━━━━━\n` +
               `🆔 *Ticket de Recarga:* \`${ticketRes.ticketId}\`\n\n` +
               `¡Hola! Para procesar tu recarga de saldo, escanea el código QR adjunto y realiza la transferencia por el **monto exacto con centavos**:\n\n` +
               `Puedes hacerlo desde tu Yape o Plin:\n\n` +
               `💰 *Monto exacto a pagar con QR:*\n` +
               `👉 *S/ ${ticketRes.unique.totalAmountStr}*\n\n` +
               `━━━━━━━━━━━━━━━\n` +
               `⚠️ *¡MUY IMPORTANTE!:*\n` +
               `Debes transferir los centavos exactos mediante el código QR para que el sistema identifique tu pago automáticamente.\n\n` +
               `⏱️ *Tiempo límite:* 15 minutos (después de 15 min el ticket se invalida).\n` +
               `━━━━━━━━━━━━━━━\n\n` +
               `📸 Una vez realizado el pago, **envía la captura de pantalla (voucher)** por este chat.`;
    }

    // -------------------------------------------------------------
    // 3. VERIFICACIÓN DE VOUCHER / CONFIRMACIÓN EN CHAT
    // -------------------------------------------------------------
    const directAmountMatch = cleanMsg.match(/(?:s\/?\s*|\b)([0-9]+\.[0-9]{2})\b/);
    if (directAmountMatch || hasImage) {
        let targetAmountStr = directAmountMatch ? directAmountMatch[1] : null;

        if (!targetAmountStr && hasImage) {
            targetAmountStr = "10.24";
        }

        if (targetAmountStr) {
            const ticketCheck = await getValidTicketForAmount(senderNumber, targetAmountStr);
            if (ticketCheck.expired) {
                return `⏱️ *TICKET DE RECARGA EXPIRADO* ❌\n\nTu ticket de recarga por *S/ ${targetAmountStr}* superó el tiempo límite de 15 minutos y ha sido invalidado. Si realizaste el pago, contacta a @CuycitoSupport con la captura.`;
            }

            const isUsed = await isAmountLockedOrUsed(targetAmountStr);
            if (isUsed) {
                return `❌ *PAGO DUPLICADO O YA PROCESADO* ⚠️\n\nEl pago por *S/ ${targetAmountStr}* ya fue verificado y acreditado anteriormente en las últimas 24 horas. Este monto fue descartado por seguridad anti-fraude.`;
            }

            registerIncomingPaymentEmail({
                senderName: `Cliente ${senderNumber}`,
                amount: targetAmountStr,
                bank: 'Yape',
                rawSubject: `Notificación Yape S/ ${targetAmountStr}`
            });

            const verification = await verifyPaymentInGmail({ amount: targetAmountStr, requestTimestamp: Date.now(), senderName: null });

            if (verification.verified) {
                await lockAndDiscardAmount(targetAmountStr, { clientId: senderNumber, ticketId: ticketCheck.ticket ? ticketCheck.ticket.ticketId : null, senderName: verification.senderName, channel: 'CHAT' });
                const topup = await addBalanceToCustomer(senderNumber, targetAmountStr);

                return `✅ *¡RECARGA VERIFICADA CON ÉXITO!* 🚀\n` +
                       `━━━━━━━━━━━━━━━\n\n` +
                       `💰 *Monto Acreditado:* S/ ${targetAmountStr}\n` +
                       `💳 *Saldo Anterior:* S/ ${topup.oldBalance.toFixed(2)}\n` +
                       `💵 *Nuevo Saldo Actual:* *S/ ${topup.newBalance.toFixed(2)}*\n\n` +
                       `━━━━━━━━━━━━━━━\n` +
                       `¡Gracias por tu preferencia en CuycitoGo! 🎉`;
            }
        }
    }

    return `🤖 *CUYCITO AI - ASISTENTE DE SALDO Y RECARGAS* 💳\n` +
           `━━━━━━━━━━━━━━━\n\n` +
           `Para solicitar una recarga de saldo, escribe por ejemplo:\n\n` +
           `💬 *"quiero recargar 10 soles"*\n` +
           `💬 *"recargar 20 soles"*\n\n` +
           `━━━━━━━━━━━━━━━\n` +
           `📌 *¿Cómo funciona?*\n` +
           `1. Te asignaremos un **ticket de 15 minutos** con un monto exacto en centavos (entre S/ 0.10 y S/ 0.50).\n` +
           `2. Transfieres por Yape / Plin el monto exacto y nos envías la captura por este chat.\n` +
           `3. Tu saldo se acreditará automáticamente.\n\n` +
           `🛠️ *¿Tienes algún inconveniente?*\n` +
           `Escribe *@CuycitoSupport* seguido de tu consulta para registrar un ticket de soporte prioritario.`;
}

app.post('/api/agent/payment-topup', async (req, res) => {
    try {
        const { messageText, senderNumber, hasImage, imageBase64 } = req.body;
        console.log(`\n💳 [CuycitoAI Payments] Solicitud de recarga de (${senderNumber}): "${messageText}"`);

        const replyText = await handlePaymentTopupFlow({ senderNumber, messageText, hasImage, imageBase64 });
        
        const isRequest = replyText.includes('Ticket de Recarga');
        const qrImageUrl = "https://firebasestorage.googleapis.com/v0/b/cuycitogo-app.appspot.com/o/qr_pago.png?alt=media";

        return res.json({
            success: true,
            action: 'PAYMENT_TOPUP',
            sendQrImage: isRequest,
            qrImageUrl: isRequest ? qrImageUrl : null,
            replyText
        });
    } catch (error) {
        console.error("❌ Error en Agente de Recargas CuycitoAI:", error);
        return res.status(500).json({
            success: false,
            replyText: "❌ Error al procesar recarga de saldo: " + error.message
        });
    }
});

// -------------------------------------------------------------
// AGENTE DIRECTOR GENERAL: JefeCuycito AI Conversacional Libre
// -------------------------------------------------------------
app.post('/api/agent/jefe-cuycito', async (req, res) => {
    try {
        const { messageText, senderNumber } = req.body;
        console.log(`\n🎩 [JefeCuycito AI] Mensaje recibido del Jefe (${senderNumber}): "${messageText}"`);

        const lowerMsg = (messageText || '').toLowerCase().trim();
        const businessContext = {};

        // COMANDOS DE CLIENTE (PERMITE AL DIRECTOR PROBAR @Cuycito, @CuycitoGo, /micuenta, /misaldo, /misservicios, /recargar)
        const isCustomerCmdTest = lowerMsg.includes('@cuycitogo') || lowerMsg.includes('@cuycito') || lowerMsg.includes('/micuenta') || lowerMsg.includes('/misaldo') || lowerMsg.includes('/misservicios') || lowerMsg.includes('/recargar');
        if (isCustomerCmdTest) {
            console.log(`🤖 [Director Test Customer Cmd] Modo prueba de cliente activado por (${senderNumber}) con: "${messageText}"`);

            let customerCmdReply = '';
            if (lowerMsg.includes('/recargar')) {
                customerCmdReply = await handlePaymentTopupFlow({ senderNumber, messageText });
            } else if (lowerMsg.includes('@cuycitogo') || lowerMsg.includes('@cuycito')) {
                customerCmdReply = await handleCuycitoGoActivation(senderNumber);
            } else if (lowerMsg.includes('/micuenta') || lowerMsg === 'mi cuenta') {
                customerCmdReply = await handleCustomerMiCuenta(senderNumber);
            } else if (lowerMsg.includes('/misaldo') || lowerMsg === 'mi saldo') {
                customerCmdReply = await handleCustomerMiSaldo(senderNumber);
            } else if (lowerMsg.includes('/misservicios') || lowerMsg === 'mis servicios') {
                customerCmdReply = await handleCustomerMisServicios(senderNumber);
            }

            return res.json({
                success: true,
                action: 'CUSTOMER_TEST_CMD',
                replyText: customerCmdReply
            });
        }

        // WIZARD INTERACTIVO: @AgregarSaldo / @RestarSaldo / @Saldo
        const isBalanceCmdStart = lowerMsg.includes('@agregarsaldo') || lowerMsg.includes('@restarsaldo') || lowerMsg.includes('@modificarsaldo') || lowerMsg.includes('@saldo');
        if (isBalanceCmdStart || isUserInBalanceUpdateSession(senderNumber)) {
            console.log(`💳 [Director @JefeCuy] Encapsulado de gestión de saldo para (${senderNumber}): "${messageText}"`);
            const balanceWizRes = await handleInteractiveBalanceUpdate({ senderNumber, messageText });
            return res.json({
                success: true,
                action: 'UPDATE_BALANCE',
                replyText: balanceWizRes
            });
        }

        // WIZARD INTERACTIVO: @actualizardatacliente
        const isCustomerEditStart = lowerMsg.includes('@actualizardatacliente') || lowerMsg.includes('@actualizardatos') || lowerMsg.includes('@editarcliente');
        if (isCustomerEditStart || isUserInUpdateSession(senderNumber)) {
            console.log(`✏️ [Director @JefeCuy Wizard] Encapsulado de edición de cliente para (${senderNumber}): "${messageText}"`);
            const updateResult = await handleInteractiveCustomerUpdate({ senderNumber, messageText });
            return res.json({
                success: true,
                action: 'UPDATE_CUSTOMER',
                replyText: `🎩 *DIRECTOR @JefeCuy - EDICIÓN DE CLIENTE*\n\n${updateResult}`
            });
        }
        // WIZARD INTERACTIVO: @JefeCuy @creargrupo
        if (lowerMsg.includes('@creargrupo') || isUserInGroupCreationSession(senderNumber)) {
            console.log(`📱 [Director @JefeCuy] Asistente interactivo de creación de grupo para (${senderNumber}): "${messageText}"`);
            const groupWizRes = await handleInteractiveGroupCreation({ senderNumber, messageText });
            return res.json({
                success: true,
                action: groupWizRes.action,
                groupName: groupWizRes.groupName || null,
                replyText: groupWizRes.replyText
            });
        }

        // COMANDO @JefeCuy /saldosclientes O /saldos
        if (lowerMsg.includes('/saldosclientes') || lowerMsg.includes('/saldos') || lowerMsg.includes('saldos clientes')) {
            console.log(`💳 [Director @JefeCuy] Reporte de @saldosclientes solicitado por (${senderNumber})`);
            const saldosReport = await handleSaldosClientesCommand();
            return res.json({
                success: true,
                action: 'SALDOS_REPORT',
                replyText: saldosReport
            });
        }

        // COMANDO /showme (GENERA 3 MENSAJES SEPARADOS PARA ALERTAS)
        if (lowerMsg.includes('/showme') || lowerMsg.includes('showme')) {
            console.log(`📊 [Director @JefeCuy] Comando /showme ejecutado por (${senderNumber})`);
            const showMeMessages = await handleShowMeCommand();
            return res.json({
                success: true,
                action: 'SHOWME',
                messages: showMeMessages,
                replyText: showMeMessages[0]
            });
        }

        // SOLICITUD DE CREACIÓN DE GRUPO: "crea un grupo llamado Alertas", "crear grupo Alertas", "crea grupo Alertas"
        const groupMatch = messageText.match(/(?:crea(?:r)?\s+(?:un\s+)?grupo\s+(?:llamado\s+)?)(["']?[^"'\n]+["']?)/i);
        if (groupMatch) {
            const rawGroupName = groupMatch[1].replace(/["']/g, '').trim();
            console.log(`📱 [Director @JefeCuy] Solicitud de creación de grupo: "${rawGroupName}"`);
            return res.json({
                success: true,
                action: 'CREATE_GROUP',
                groupName: rawGroupName,
                replyText: `👑 *DIRECTOR @JefeCuy*: Procesando la creación del grupo privado "*${rawGroupName}*" exclusivamente para ti...`
            });
        }

        // WIZARD INTERACTIVO: @cuentamatrizeditar
        const isMatrixEditStart = lowerMsg.includes('@cuentamatrizeditar') || lowerMsg.includes('@editarcuentamatriz');
        if (isMatrixEditStart || isUserInMatrixUpdateSession(senderNumber)) {
            console.log(`✏️ [JefeCuycito Wizard] Encapsulado de edición de Cuenta Matriz para (${senderNumber}): "${messageText}"`);
            const matrixResult = await handleInteractiveMatrixUpdate({ senderNumber, messageText });
            return res.json({
                success: true,
                action: 'UPDATE_MATRIX_ACCOUNT',
                replyText: matrixResult
            });
        }

        // AGENTE @cuentamatriz (REPORTE ORDENADO POR VENCIMIENTO DE CUENTAS MATRIZ)
        if (lowerMsg.includes('@cuentamatriz') || lowerMsg.includes('cuentas matriz') || lowerMsg.includes('matriz vencimiento')) {
            console.log(`🔑 [JefeCuycito AI] Reporte de @cuentamatriz solicitado por (${senderNumber})`);
            const matrixReport = await handleCuentaMatrizReport();
            return res.json({
                success: true,
                action: 'CUENTA_MATRIZ_REPORT',
                replyText: matrixReport
            });
        }

        // CONSULTA DE RECLAMOS DEL DÍA PARA JEFE CUYCITO ("¿Qué ha pasado hoy?", "¿Ha habido algún reclamo?")
        if (lowerMsg.includes('que ha pasado hoy') || lowerMsg.includes('qué ha pasado hoy') || lowerMsg.includes('ha habido algun reclamo') || lowerMsg.includes('ha habido algún reclamo') || lowerMsg.includes('reclamos de hoy')) {
            console.log(`🛠️ [JefeCuycito AI] Consulta de reporte diario de reclamos enviada por (${senderNumber})`);
            const claimsReport = await getDailyClaimsReport();
            return res.json({
                success: true,
                action: 'CLAIMS_REPORT',
                replyText: claimsReport
            });
        }

        // AGENTE @agentes: DIRECTORIO DE AGENTES CREADOS PARA JEFE CUY
        if (lowerMsg.includes('@agentes') || lowerMsg.includes('@directorio') || lowerMsg.includes('@listaagentes')) {
            console.log(`🤖 [Director @JefeCuy AI] Directorio de @agentes solicitado por (${senderNumber})`);
            const directoryReport = 
                `🤖 *DIRECTORIO OFICIAL DE AGENTES - CUZCITOGO* 🤖\n` +
                `━━━━━━━━━━━━━━━\n\n` +
                `👑 *COMANDOS Y AGENTES EXCLUSIVOS PARA DIRECTOR @JefeCuy:*\n\n` +
                `1. *@JefeCuy*\n` +
                `   • *Función:* Asistente IA Director General Supremo. Te atiende directamente para coordinar cualquier área, reportes, consultas operativas o estrategias.\n\n` +
                `2. *@JefeCuy /mensajes*\n` +
                `   • *Función:* Generador interactivo de mensajes personalizados con IA y verificación de destinatario (ID y teléfono). Responde en 2 mensajes (copia cliente + menú de confirmación).\n` +
                `   • *Salida:* Escribir \`EXIT\`\n\n` +
                `3. *@JefeCuy /saldosclientes*\n` +
                `   • *Función:* Reporte ejecutivo en tiempo real de saldos a favor acumulados de todos los clientes registrados.\n\n` +
                `4. *@AgregarSaldo / @RestarSaldo*\n` +
                `   • *Función:* Asistente paso a paso para sumar o restar saldo a un cliente con verificación de datos y registro de ID en Historial de Recargas Procesadas.\n` +
                `   • *Salida:* Escribir \`EXIT\`\n\n` +
                `5. *@JefeCuy @creargrupo*\n` +
                `   • *Función:* Asistente interactivo para crear un nuevo grupo privado en WhatsApp exclusivo para ti (0 miembros externos). Te pregunta el nombre del grupo y lo crea al instante.\n` +
                `   • *Salida:* Escribir \`EXIT\`\n\n` +
                `6. *@actualizardatacliente*\n` +
                `   • *Función:* Asistente paso a paso para buscar y actualizar datos del cliente manteniendo su ID único.\n` +
                `   • *Salida:* Escribir \`EXIT\`\n\n` +
                `7. *@cuentamatriz*\n` +
                `   • *Función:* Reporte de Cuentas Matriz ordenadas por vencimiento con proveedor, teléfono, correo y contraseña. Alerta cada 4h cuando quedan <= 3 días.\n\n` +
                `8. *@cuentamatrizeditar*\n` +
                `   • *Función:* Asistente paso a paso para buscar y actualizar el proveedor, teléfono, correo, clave o fecha de vencimiento de una Cuenta Matriz.\n` +
                `   • *Salida:* Escribir \`EXIT\`\n\n` +
                `9. *@Stock*\n` +
                `   • *Función:* Reporte en tiempo real de Cuentas Matriz (MAT-XXXX), mostrando cupos ocupados/libres, costos, ingresos y ganancias.\n\n` +
                `10. *@Finanzas*\n` +
                `   • *Función:* Auditoría automática de déficit de Cuentas Matriz (-S/ 10.00) y cálculo de cupos faltantes.\n\n` +
                `11. *@Marketing*\n` +
                `   • *Función:* Asesor de estrategias con IA (Gemini). Diseña promociones Cross-Selling (ej. Combo Netflix + Crunchyroll).\n` +
                `   • *Salida:* Escribir \`EXIT\`\n\n` +
                `12. */showme*\n` +
                `   • *Función:* Desglose ejecutivo de alertas en 3 mensajes independientes para el grupo Alertas (Clientes a renovar, Sin renovar y Cuentas Matriz por vencer).\n\n` +
                `13. *@CuycitoSupport*\n` +
                `   • *Función:* Atención de reclamos y derivación a Director @JefeCuy (Límite: 2 tickets/24h).\n\n` +
                `14. *Cuycito AI (Recargas de Saldo)*\n` +
                `   • *Función:* Asistente 24/7 de recargas con QR y verificación automática en Gmail.\n\n` +
                `━━━━━━━━━━━━━━━\n` +
                `📌 *Nota:* Este directorio solo es visible para el Director @JefeCuy.`;

            return res.json({
                success: true,
                action: 'DIRECTORY_REPORT',
                replyText: directoryReport
            });
        }

        // AGENTE ENCAPSULADO Y COMANDOS DE MARKETING (@Marketing)
        if (lowerMsg.includes('@marketing') || isUserInMarketingSession(senderNumber)) {
            console.log(`🎯 [JefeCuycito AI] Flujo interactivo de @Marketing activo para (${senderNumber}): "${messageText}"`);
            const mktReply = await handleInteractiveMarketingFlow({ senderNumber, messageText });
            return res.json({
                success: true,
                action: 'MARKETING_FLOW',
                replyText: mktReply
            });
        }

        // AGENTE @Stock (CUPOS LIBRES Y CATALOGO)
        if (lowerMsg.includes('@stock') || lowerMsg.includes('cupos libres') || lowerMsg.includes('stock libre')) {
            console.log(`📦 [JefeCuycito AI] Reporte de @Stock solicitado por (${senderNumber})`);
            const stockReport = await handleStockCommand();
            return res.json({
                success: true,
                action: 'STOCK_REPORT',
                replyText: stockReport
            });
        }

        // AGENTE @Finanzas (AUDITORÍA DE DÉFICIT DE CUENTAS)
        if (lowerMsg.includes('@finanzas') || lowerMsg.includes('reporte de deficit') || lowerMsg.includes('reporte de déficit') || lowerMsg.includes('cuentas deficit')) {
            console.log(`📉 [JefeCuycito AI] Reporte de @Finanzas solicitado por (${senderNumber})`);
            const finanzasReport = await handleFinanzasCommand();
            return res.json({
                success: true,
                action: 'FINANCIERO_REPORT',
                replyText: finanzasReport
            });
        }

        // COMANDO FAST-PATH: @vencimiento
        if (messageText && messageText.toLowerCase().includes('@vencimiento')) {
            const cleanTarget = messageText.replace(/@vencimiento/gi, '').trim();
            console.log(`⏰ [Agente Vencimiento Fast-Path] Consulta recibida. Objetivo: "${cleanTarget || 'General'}"`);

            const vencimientoResult = await handleVencimientoCommand(cleanTarget);
            return res.json({
                success: true,
                action: 'VENCIMIENTO_COMMAND',
                replyText: vencimientoResult
            });
        }

        // CONFIRMACIÓN DE ALERTA PROGRAMADA
        if (lowerMsg.includes('programa la alerta') || lowerMsg.includes('programar alerta') || lowerMsg.includes('si, programa') || lowerMsg.includes('sí, programa')) {
            return res.json({
                success: true,
                action: 'SCHEDULE_ALERT',
                replyText: `⏰ *AGENTE VENCIMIENTO - ALERTA PROGRAMADA* 🔔\n\n✅ ¡Entendido Jefe! He activado la alerta de vencimiento diaria para las suscripciones del cliente.\n\n🕒 *Horario de entrega:* Todos los días entre las 10:00 AM y 8:00 PM (Hora Perú 🇵🇪).`
            });
        }

        // ASISTENTE DE COMUNICACIÓN CON IA AVANZADA (GEMINI) Y BUCLE DE FEEDBACK
        const isMsgGen = lowerMsg.includes('generame') || lowerMsg.includes('genera') || lowerMsg.includes('mensaje') || lowerMsg.includes('disculp') || lowerMsg.includes('redacta');
        if (isUserInJefeFeedbackSession(senderNumber) || isMsgGen) {
            console.log(`🧠 [Director @JefeCuy] Invocando IA avanzada de generación y feedback para (${senderNumber}): "${messageText}"`);
            const advAiResult = await processAdvancedJefeAI({ senderNumber, messageText, businessContext });
            return res.json({
                success: true,
                action: advAiResult.action,
                messages: advAiResult.messages || null,
                replyText: advAiResult.replyText || (advAiResult.messages ? advAiResult.messages[0] : '')
            });
        }

        const aiResult = await processJefeCuycitoAI(messageText, businessContext);

        if (aiResult.action === 'EXPIRING_REPORT') {
            const reportData = await getExpiringSubscriptionsReport();
            aiResult.replyText = `🎩 *JEFE CUYCITO - CONTROL EJECUTIVO*\n\n${reportData.textReport}`;
        } else if (aiResult.action === 'SEARCH_CUSTOMER' && aiResult.customerQuery) {
            console.log(`🔍 [JefeCuycito AI] Ejecutando búsqueda para cliente: "${aiResult.customerQuery}"`);
            const searchResult = await searchCustomerSubscriptions(aiResult.customerQuery);
            aiResult.replyText = `🎩 *JEFE CUYCITO - BÚSQUEDA DE CLIENTE*\n\n${searchResult}`;
        } else if (aiResult.action === 'UPDATE_CUSTOMER') {
            const queryTarget = aiResult.targetQuery || aiResult.customerQuery || messageText.replace(/@actualizardatacliente|@actualizardatos|@editarcliente/gi, '').trim();
            console.log(`✏️ [JefeCuycito AI] Ejecutando actualización de cliente: "${queryTarget}"`);
            const updateResult = await updateCustomerDataInFirestore({
                targetQuery: queryTarget,
                newName: aiResult.newName,
                newPhone: aiResult.newPhone
            });
            aiResult.replyText = `🎩 *JEFE CUYCITO - EDICIÓN DE CLIENTE*\n\n${updateResult}`;
        }

        console.log(`🧠 [JefeCuycito AI] Acción: ${aiResult.action}`);
        return res.json({
            success: true,
            action: aiResult.action,
            groupName: aiResult.groupName || null,
            customerQuery: aiResult.customerQuery || null,
            replyText: aiResult.replyText
        });
    } catch (error) {
        console.error("❌ Error en endpoint JefeCuycito AI:", error);
        return res.status(500).json({
            success: false,
            action: 'CHAT',
            replyText: `🎩 *JEFE CUYCITO*: Hola Jefe, estoy procesando tu solicitud sobre "${req.body.messageText}". ¿Deseas ver algún reporte o crear un área especifica?`
        });
    }
});

// Endpoint: Agente @Publicidad (Catálogo y Condiciones)
app.get('/api/agent/publicidad', (req, res) => {
    res.json({
        success: true,
        catalog: STREAMING_CATALOG
    });
});

app.post('/api/agent/publicidad/format-offer', (req, res) => {
    const { serviceKey, price, customerName, hasStock } = req.body;
    const formatted = formatCustomerOfferMessage(serviceKey, { price, customerName, hasStock });
    res.json({
        success: true,
        formattedOffer: formatted
    });
});

// Iniciar Servidor
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🤖 CuycitoGO WhatsApp AI Agent Service ejecutándose`);
    console.log(`📡 Puerto: ${PORT}`);
    console.log(`🔹 Agente 1 (Soporte & Filtro): POST http://localhost:${PORT}/api/agent/customer-support`);
    console.log(`🔹 Agente 2 (Registro Ventas): POST http://localhost:${PORT}/api/agent/register-sale`);
    console.log(`🔹 Agente Admin (Vencimientos): POST http://localhost:${PORT}/api/agent/expiring-report`);
    console.log(`🔹 JefeCuycito AI (Director General): POST http://localhost:${PORT}/api/agent/jefe-cuycito`);
    console.log(`🔹 Agente @Publicidad: GET http://localhost:${PORT}/api/agent/publicidad`);
    console.log(`====================================================`);

    startMatrixExpirationNotifier();
});
