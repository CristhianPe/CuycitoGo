// =============================================================
// MÓDULO: jefe-marketing-service.js
// Agente @Marketing - Asesor Autónomo de Promociones y Estrategias
// =============================================================

import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const ai = new GoogleGenAI({ apiKey });

const activeMarketingSessions = new Set();

/**
 * Comprueba si un usuario está en una sesión interactiva de @Marketing
 */
export function isUserInMarketingSession(senderNumber) {
    const cleanNumber = (senderNumber || '').replace(/[^0-9]/g, '');
    return activeMarketingSessions.has(cleanNumber);
}

/**
 * Inicia o cierra la sesión de @Marketing
 */
export function setMarketingSession(senderNumber, active = true) {
    const cleanNumber = (senderNumber || '').replace(/[^0-9]/g, '');
    if (active) {
        activeMarketingSessions.add(cleanNumber);
    } else {
        activeMarketingSessions.delete(cleanNumber);
    }
}

/**
 * Procesa mensajes y genera auditorías de marketing con IA Gemini
 */
export async function handleInteractiveMarketingFlow({ senderNumber, messageText = '' }) {
    const cleanMsg = (messageText || '').trim();
    const lowerMsg = cleanMsg.toLowerCase();

    // COMANDO DE SALIDA DE ENCAPSULADO
    if (lowerMsg === 'exit') {
        setMarketingSession(senderNumber, false);
        return `👋 *SESIÓN DE @Marketing FINALIZADA*\n\nHas salido del flujo de trabajo de Marketing. Puedes volver a escribir *@Marketing* cuando desees consultar nuevas estrategias o auditorías.`;
    }

    // SI ES EL INICIO DE LA SESIÓN CON @Marketing
    if (lowerMsg.includes('@marketing')) {
        setMarketingSession(senderNumber, true);
    }

    const systemPrompt = `Eres el Agente Director de Marketing y Ventas de CuycitoGo (Tienda de servicios de streaming: Netflix, Disney+, Max, Prime Video, Spotify, Crunchyroll, IPTV).

Tus responsabilidades son:
1. Analizar el inventario y proponer ESTRATEGIAS DE VENTA y PROMOCIONES TRACTIVAS.
2. Aplicar la estrategia de CROSS-SELLING / COMBO DÚO: Combinar SIEMPRE un servicio de BAJA VENTA o con exceso de stock (ej. Crunchyroll, Max, IPTV) con un servicio de ALTA VENTA (ej. Netflix, Disney+) para rotar el inventario estancado.
3. Brindar recomendaciones concretas para WhatsApp y redes sociales (copywriter, gatillos mentales de urgencia/escasez, descuentos por combo).
4. Ofrecer una auditoría de estrategia diaria cuando el usuario la solicite.
5. Recordarle amablemente al usuario que para salir del flujo interactivo solo debe escribir la palabra EXIT.

Formatea siempre tu respuesta con emojis, separadores de línea (━━━━━━━━━━━━━━━) y viñetas claras para WhatsApp. Mantén un tono ejecutivo, enfocado en maximizar ganancias y liquidar cupos libres.`;

    try {
        const userPrompt = cleanMsg.replace(/@marketing/gi, '').trim() || "Dame una auditoría de estrategia de marketing para hoy y una promoción combo para acelerar ventas.";

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${systemPrompt}\n\nConsulta del Jefe/Administrador: "${userPrompt}"`,
            config: {
                maxOutputTokens: 600,
                temperature: 0.4
            }
        });

        const reply = response.text ? response.text.trim() : "Estrategia de Marketing lista para aplicar.";

        return `🎯 *@Marketing - AUDITORÍA Y ESTRATEGIA DE VENTAS* 📢\n` +
               `━━━━━━━━━━━━━━━\n\n` +
               `${reply}\n\n` +
               `━━━━━━━━━━━━━━━\n` +
               `📌 *Para salir del flujo de trabajo de Marketing escribe:* \`EXIT\``;
    } catch (e) {
        console.error("⚠️ Error en Agente @Marketing:", e.message);
        return `🎯 *@Marketing - PROMOCIÓN RECOMENDADA* 📢\n` +
               `━━━━━━━━━━━━━━━\n\n` +
               `🔥 *COMBO EXPLOSIVO DEL DÍA (CROSS-SELLING)*\n` +
               `• *Servicio Top Venta:* Netflix Premium 4K (S/ 10.00)\n` +
               `• *Servicio en Oferta:* Crunchyroll Fan (S/ 5.00 ➔ *S/ 3.00*)\n` +
               `👉 *Llévalos juntos por S/ 13.00* (Ahorras S/ 2.00)\n\n` +
               `💡 *Estrategia:* Publicar este combo en estados de WhatsApp durante las 5:00 PM y 8:00 PM con cupos limitados.\n\n` +
               `━━━━━━━━━━━━━━━\n` +
               `📌 *Para salir del flujo de trabajo de Marketing escribe:* \`EXIT\``;
    }
}
