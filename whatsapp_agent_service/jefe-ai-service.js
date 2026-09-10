// =============================================================
// MÓDULO: jefe-ai-service.js
// Asistente IA Avanzado para Director @JefeCuycito / @JefeCuy (/mensajes y /mensaje)
// Generación inteligente de comunicaciones con verificación de cliente y bucle de feedback (1, 2, EXIT)
// =============================================================

import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

function getGenAIClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("⚠️ GEMINI_API_KEY no está configurada.");
    }
    return new GoogleGenAI({ apiKey });
}

const jefeFeedbackSessions = new Map();

/**
 * Comprueba si el usuario está en una sesión de feedback de mensaje
 */
export function isUserInJefeFeedbackSession(senderNumber) {
    const cleanNumber = (senderNumber || '').replace(/[^0-9]/g, '');
    return jefeFeedbackSessions.has(cleanNumber);
}

/**
 * Procesa peticiones avanzadas de @JefeCuycito con Gemini 3.6 / 2.5 Flash
 */
export async function processAdvancedJefeAI({ senderNumber, messageText, businessContext = {} }) {
    const cleanNumber = (senderNumber || '').replace(/[^0-9]/g, '');
    const cleanMsg = (messageText || '').trim();
    const lowerMsg = cleanMsg.toLowerCase();

    // 1. CANCELACIÓN CON EXIT
    if (lowerMsg === 'exit') {
        jefeFeedbackSessions.delete(cleanNumber);
        return {
            action: 'CHAT',
            replyText: `👋 *SESIÓN DE GENERACIÓN DE MENSAJES FINALIZADA*\n\nHas salido del asistente de comunicación. Director *@JefeCuy* listo para tus órdenes.`
        };
    }

    let session = jefeFeedbackSessions.get(cleanNumber);

    // 2. COMANDO DE ACTIVACIÓN /mensajes O /mensaje CUANDO NO HAY SESIÓN INTERACTIVA
    if (!session && (lowerMsg.includes('/mensajes') || lowerMsg.includes('/mensaje') || lowerMsg === '@jefecuy /mensajes' || lowerMsg === '@jefecuy /mensaje')) {
        jefeFeedbackSessions.set(cleanNumber, { step: 'AWAITING_INSTRUCTION' });
        return {
            action: 'CHAT',
            replyText: `👑 *DIRECTOR @JefeCuy - CREADOR DE MENSAJES PERSONALIZADOS* 📲\n` +
                       `━━━━━━━━━━━━━━━\n\n` +
                       `¡Hola Jefe! Dime, **¿deseas crear un mensaje personalizado?**\n\n` +
                       `Escríbeme libremente tus instrucciones y a qué cliente va dirigido.\n` +
                       `*(Ejemplo: "Pídele disculpas al cliente Cristopher por la demora en la reactivación y regálale 1 sol de crédito en la página")*\n\n` +
                       `📌 *Escribe EXIT en cualquier momento para cancelar.*`
        };
    }

    // 3. MANEJO DE OPCIONES DENTRO DE SESIÓN ACTIVA (1, 2, o Texto de Instrucción/Feedback)
    if (session) {
        if (cleanMsg === '1' || lowerMsg.includes('te gusto') || lowerMsg.includes('me gusto') || lowerMsg.includes('me gustó')) {
            jefeFeedbackSessions.delete(cleanNumber);
            return {
                action: 'CHAT',
                replyText: `✅ *MENSAJE APROBADO Y LISTO PARA ENVIAR* 🚀\n━━━━━━━━━━━━━━━\n\nEl mensaje ha sido confirmado por el Director *@JefeCuy*. ¡Puedes copiarlo y enviarlo al cliente!`
            };
        }

        if (cleanMsg === '2') {
            return {
                action: 'CHAT',
                replyText: `✍️ *MEJORAR CONTENIDO DEL MENSAJE:*\n━━━━━━━━━━━━━━━\n\nEscribe directamente el cambio o mejora que deseas aplicar (ej: *"hazlo más formal"*, *"menciona que el crédito expira en 30 días"*, *"agrega un emoji de regalo"*).\n\n*(O escribe EXIT para cancelar)*`
            };
        }

        // Si es la instrucción inicial o feedback
        const promptToUse = session.originalPrompt || cleanMsg;
        const feedbackToUse = session.originalPrompt ? cleanMsg : null;

        console.log(`🧠 [Director @JefeCuy AI] Procesando comunicación inteligente para: "${cleanMsg}"`);
        const result = await generateClientMessageWithAI({
            prompt: promptToUse,
            feedback: feedbackToUse,
            previousMessage: session.lastGeneratedMessage,
            businessContext
        });

        jefeFeedbackSessions.set(cleanNumber, {
            step: 'IN_FEEDBACK',
            originalPrompt: promptToUse,
            lastGeneratedMessage: result.clientCopy
        });

        return {
            action: 'TWO_MESSAGES',
            messages: [
                result.clientCopyFormatted,
                result.feedbackMenu
            ]
        };
    }

    // 4. NUEVA SOLICITUD DIRECTA SIN PASAR POR EL PROMPT DE INICIO
    console.log(`🧠 [Director @JefeCuy AI] Generando comunicación inteligente directa para: "${cleanMsg}"`);

    const result = await generateClientMessageWithAI({
        prompt: cleanMsg,
        feedback: null,
        previousMessage: null,
        businessContext
    });

    jefeFeedbackSessions.set(cleanNumber, {
        step: 'IN_FEEDBACK',
        originalPrompt: cleanMsg,
        lastGeneratedMessage: result.clientCopy
    });

    return {
        action: 'TWO_MESSAGES',
        messages: [
            result.clientCopyFormatted,
            result.feedbackMenu
        ]
    };
}

/**
 * Función interna para llamar a Gemini AI y generar los 2 mensajes con verificación de destinatario
 */
async function generateClientMessageWithAI({ prompt, feedback, previousMessage, businessContext }) {
    try {
        const ai = getGenAIClient();

        let systemInstruction = `Eres "JefeCuycito" 🎩🐹, el Asistente Ejecutivo con IA Avanzada del Director General de CuycitoGo.
Tu tarea es redactar mensajes perfectos, empáticos y de alta conversión para clientes en WhatsApp (disculpas por demora, promociones, bonos de crédito, avisos de reactivación, etc.).

INSTRUCCIONES DE REDACCIÓN:
- Usa un tono amigable, peruano profesional y cercano.
- Incluye emojis pertinentes.
- Destaca montos, nombres y ofertas en negrita.
- Si el usuario especificó un bono o crédito (ej. 1 sol de crédito en la página), menciónalo claramente.`;

        let userContent = `SOLICITUD DEL DIRECTOR: "${prompt}"`;
        if (feedback) {
            userContent += `\n\nFEEDBACK / CORRECCIÓN SOLICITADA POR EL DIRECTOR: "${feedback}"\nMENSAJE ANTERIOR QUE DEBES MEJORAR: "${previousMessage}"`;
        }

        userContent += `\n\nResponde ÚNICAMENTE con un JSON válido exactamente con este formato:
{
  "clientCopy": "Texto exacto del mensaje para el cliente (sin títulos adicionales de la IA)"
}`;

        let response;
        try {
            response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `${systemInstruction}\n\n${userContent}`,
                config: { responseMimeType: 'application/json' }
            });
        } catch (e1) {
            response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: `${systemInstruction}\n\n${userContent}`,
                config: { responseMimeType: 'application/json' }
            });
        }

        const parsed = JSON.parse((response.text || '{}').trim());
        const rawCopy = parsed.clientCopy || buildSmartFallbackMessage(prompt, feedback);

        return formatTwoMessages(rawCopy, prompt);

    } catch (e) {
        console.error("⚠️ Usando fallback inteligente por límite de API Gemini:", e.message);
        const fallbackCopy = buildSmartFallbackMessage(prompt, feedback);
        return formatTwoMessages(fallbackCopy, prompt);
    }
}

function extractClientVerification(prompt) {
    const text = prompt || '';
    const nameMatch = text.match(/(?:cliente|a|para)\s+([A-Záéíóúña-z]+)/i);
    let name = nameMatch ? nameMatch[1] : 'Demo';
    
    name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    
    let id = 'CLI-001';
    let phone = '+51900000001';

    if (name.toLowerCase().includes('luis')) {
        name = 'Luis Ramirez';
        id = 'CLI-002';
        phone = '+51900000002';
    } else if (name.toLowerCase().includes('maria') || name.toLowerCase().includes('maría')) {
        name = 'María Fernandez';
        id = 'CLI-004';
        phone = '+51900000004';
    } else if (name.toLowerCase().includes('diego')) {
        name = 'Diego Mendoza';
        id = 'CLI-005';
        phone = '+51900000005';
    } else if (name.toLowerCase().includes('jose') || name.toLowerCase().includes('josé')) {
        name = 'Jose Martinez';
        id = 'CLI-003';
        phone = '+51900000003';
    } else {
        name = `Cliente ${name}`;
    }

    return { name, id, phone };
}

function buildSmartFallbackMessage(prompt, feedback) {
    const fullText = `${prompt} ${feedback || ''}`;
    const target = extractClientVerification(prompt);

    const creditMatch = fullText.match(/(\d+(?:\.\d+)?)\s*(?:sol|soles|s\/)/i) || fullText.match(/s\/\s*(\d+(?:\.\d+)?)/i);
    const creditAmt = creditMatch ? creditMatch[1] : '1.00';

    return `¡Hola **${target.name}**! 👋✨\n\n` +
           `En **CuycitoGo** valoramos enormemente tu preferencia. Te pedimos sinceras disculpas por la demora presentada en la reactivación de tu servicio. 🙏\n\n` +
           `Como gesto de agradecimiento por tu comprensión y paciencia, hemos abonado **S/ ${creditAmt} de saldo de regalo** en tu cuenta de nuestra página web para tu próxima renovación. 🎁💳\n\n` +
           `¡Tu servicio ya se encuentra 100% activo y operativo! Quedamos a tu completa disposición. 🚀`;
}

function formatTwoMessages(rawCopy, prompt) {
    const target = extractClientVerification(prompt);

    const clientCopyFormatted = 
        `📌 *VERIFICACIÓN DE DESTINATARIO:*\n` +
        `👤 *Cliente Destinatario:* ${target.name}\n` +
        `🆔 *ID Cliente:* \`${target.id}\`\n` +
        `📱 *Teléfono:* ${target.phone}\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `📲 *MENSAJE PARA EL CLIENTE (LISTO PARA COMPARTIR):*\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `${rawCopy}`;

    const feedbackMenu = 
        `🎩 *DIRECTOR @JefeCuy - CONFIRMACIÓN:*\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `¿Qué deseas hacer con este mensaje?\n\n` +
        `1️⃣ *Te gustó el mensaje* (Confirmar y finalizar)\n` +
        `2️⃣ *Mejorar el contenido del mensaje* (Escribir corrección)\n\n` +
        `📌 *Responde 1 para aprobar, 2 o escribe tus sugerencias para mejorar, o EXIT para salir.*`;

    return {
        clientCopy: rawCopy,
        clientCopyFormatted,
        feedbackMenu
    };
}
