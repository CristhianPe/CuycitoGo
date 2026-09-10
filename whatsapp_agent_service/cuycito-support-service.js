// =============================================================
// MÓDULO: cuycito-support-service.js
// Agente @CuycitoSupport - Registro de Reclamos y Notificación a JefeCuycito
// =============================================================

import {
    initFirestore,
    adminDb,
    useRestFallback,
    restGetCollection,
    restUpdateDocument,
    cleanPhoneNumber,
    collectionCache
} from './firestore-store-service.js';

import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const ai = new GoogleGenAI({ apiKey });

/**
 * Resume el motivo de un reclamo a un máximo de 30 palabras usando Gemini.
 */
async function condenseClaimSummary(rawReason) {
    if (!rawReason || typeof rawReason !== 'string') return "Reclamo por verificación de pago/servicio.";
    if (rawReason.split(' ').length <= 25) return rawReason.trim();

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Eres un asistente de soporte técnico. Resume el siguiente motivo de reclamo de un cliente en un resumen claro y conciso de MÁXIMO 30 PALABRAS:\n\nMotivo: "${rawReason}"`,
            config: {
                maxOutputTokens: 60,
                temperature: 0.2
            }
        });
        const text = response.text ? response.text.trim() : rawReason;
        return text;
    } catch (e) {
        console.error("⚠️ Error resumiendo motivo de reclamo con Gemini:", e.message);
        return rawReason.slice(0, 150) + '...';
    }
}

/**
 * Registra un ticket de reclamo y genera la notificación formateada para enviar a JefeCuycito.
 */
const activeClaimsMap = new Map();

/**
 * Cuenta cuántos tickets de reclamo/soporte ha registrado el cliente en 24h.
 */
export async function countUserClaimTicketsIn24h(clientId) {
    initFirestore();
    const cleanId = (clientId || '').toLowerCase().trim();
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    let count = 0;

    activeClaimsMap.forEach(c => {
        if ((c.clientId === cleanId || cleanPhoneNumber(c.clientPhone) === cleanPhoneNumber(cleanId)) && (c.timestamp || 0) > twentyFourHoursAgo) {
            count++;
        }
    });

    try {
        let allClaims = [];
        if (useRestFallback) {
            allClaims = await restGetCollection('claims_tickets');
        } else if (adminDb) {
            const snap = await adminDb.collection('claims_tickets').get();
            snap.forEach(d => allClaims.push({ id: d.id, ...d.data() }));
        }

        allClaims.forEach(c => {
            const cTime = c.timestamp || (c.createdAt ? new Date(c.createdAt).getTime() : 0);
            const isMatch = c.clientId === cleanId || cleanPhoneNumber(c.clientPhone) === cleanPhoneNumber(cleanId);
            if (isMatch && cTime > twentyFourHoursAgo) {
                count++;
            }
        });
    } catch (e) {
        console.error("⚠️ Error contando tickets de reclamo:", e.message);
    }

    return count;
}

/**
 * Base de Conocimiento Oficial de @CuycitoSupport
 * Estrictamente delimitada. No responde temas fuera de la base alimentada.
 */
export async function handleCuycitoSupportQuery({ clientId, clientName, clientPhone, rawReason }) {
    const cleanMsg = (rawReason || '').toLowerCase().trim();

    // 1. TEMA ALIMENTADO: ¿Por qué se agregan centavos al monto a recargar?
    if (cleanMsg.includes('centavo') || cleanMsg.includes('decimal') || cleanMsg.includes('por que me cobr') || cleanMsg.includes('por qué me cobr') || cleanMsg.includes('por que se agreg') || cleanMsg.includes('por qué se agreg') || cleanMsg.includes('monto extra') || cleanMsg.includes('centimos') || cleanMsg.includes('céntimos')) {
        return `🛠️ *@CuycitoSupport - INFORMACIÓN DE RECARGAS* 💡\n` +
               `━━━━━━━━━━━━━━━\n\n` +
               `❓ *¿Por qué se agregan centavos a mi monto a recargar?*\n\n` +
               `👉 Agregamos unos centavos aleatorios (entre S/ 0.10 y S/ 0.50) a tu monto para **identificar y verificar tu pago de forma instantánea y 100% automática** a través de nuestro sistema.\n\n` +
               `✅ *¡Pierde cuidado y quédate completamente tranquilo!*\n` +
               `En **CuycitoGo** siempre mejoramos tu atención. **El total exacto transferido (monto base + centavos) se acreditará en su totalidad a tu saldo disponible**. No nos quedamos con nada, todo pasa a tu saldo para tu uso exclusivo. 🚀\n\n` +
               `━━━━━━━━━━━━━━━\n` +
               `📌 *¿Tienes alguna otra duda o consulta?*\n` +
               `Escribe tu mensaje y con gusto te asistiremos.`;
    }

    // Verificar límite anti-spam de máximo 2 tickets de soporte en 24h
    const claimCount = await countUserClaimTicketsIn24h(clientId);
    if (claimCount >= 2) {
        return `⚠️ *LÍMITE DE SOPORTE ALCANZADO* 📋\n` +
               `━━━━━━━━━━━━━━━\n\n` +
               `¡Hola! Has alcanzado el límite máximo de **2 tickets de soporte en 24 horas**.\n\n` +
               `📌 Tus solicitudes anteriores ya fueron derivadas y están siendo revisadas prioritariamente por el Director **JefeCuycitoGo**. Te responderemos muy pronto. ¡Gracias por tu paciencia!`;
    }

    // 2. TEMAS NO ALIMENTADOS: Registrar ticket y derivar al Director JefeCuycitoGo sin inventar respuestas
    const claimRes = await registerClaimTicket({
        clientId,
        clientName,
        clientPhone,
        rawReason
    });

    try {
        await fetch('http://localhost:5001/api/agent/jefe-cuycito', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageText: claimRes.jefeNotification, senderNumber: 'CUYCITO_SUPPORT' })
        });
    } catch (err) {
        console.error("⚠️ Error notificando a JefeCuycito sobre reclamo derivado:", err.message);
    }

    return claimRes.clientReply;
}

export async function registerClaimTicket({ clientId, clientName, clientPhone, rawReason }) {
    initFirestore();
    const now = Date.now();
    const claimTicketId = `REC-CLAIM-${Math.floor(1000 + Math.random() * 9000)}`;

    const shortSummary = await condenseClaimSummary(rawReason);

    const record = {
        claimTicketId,
        clientId: clientId || clientPhone || 'DESCONOCIDO',
        clientName: clientName || 'Cliente',
        clientPhone: clientPhone ? cleanPhoneNumber(clientPhone) : 'Sin teléfono',
        summary: shortSummary,
        rawReason: rawReason || shortSummary,
        timestamp: now,
        dateStr: new Date().toISOString().split('T')[0],
        status: 'PENDING',
        createdAt: new Date().toISOString()
    };

    activeClaimsMap.set(claimTicketId, record);

    try {
        if (useRestFallback) {
            await restUpdateDocument('claims_tickets', claimTicketId, record);
        } else if (adminDb) {
            await adminDb.collection('claims_tickets').doc(claimTicketId).set(record);
        }
        collectionCache.delete('claims_tickets');
        console.log(`🚨 [CuycitoSupport] Ticket de reclamo registrado: ${claimTicketId}`);
    } catch (e) {
        console.error("Error guardando reclamo en Firestore:", e.message);
    }

    const formattedTime = new Date().toLocaleString("es-PE", { timeZone: "America/Lima" });

    const jefeNotification = `🚨 *NUEVO RECLAMO REGISTRADO POR @CuycitoSupport* 🚨\n\n` +
                              `🆔 *Ticket Reclamo:* \`${claimTicketId}\`\n` +
                              `👤 *Cliente:* ${record.clientName} (+${record.clientPhone})\n` +
                              `📝 *Motivo (Resumen <= 30 palabras):*\n"${shortSummary}"\n\n` +
                              `🕒 *Fecha/Hora:* ${formattedTime}\n` +
                              `📌 *Estado:* 🟡 PENDIENTE DE REVISIÓN`;

    const clientReply = `🛠️ *@CuycitoSupport - TICKET DE RECLAMO REGISTRADO* 📋\n\n` +
                        `Hemos registrado tu reclamo con el ticket: \`${claimTicketId}\`.\n\n` +
                        `📝 *Motivo registrado:* "${shortSummary}"\n\n` +
                        `El Director *JefeCuycitoGo* ya ha recibido la notificación inmediata con los detalles de tu caso para darte solución prioritaria.`;

    return {
        claimTicketId,
        record,
        jefeNotification,
        clientReply
    };
}

export async function getDailyClaimsReport() {
    initFirestore();
    const todayStr = new Date().toISOString().split('T')[0];

    try {
        let allClaims = Array.from(activeClaimsMap.values());
        if (useRestFallback) {
            const restClaims = await restGetCollection('claims_tickets');
            restClaims.forEach(c => {
                if (!allClaims.some(a => a.claimTicketId === c.claimTicketId)) {
                    allClaims.push(c);
                }
            });
        } else if (adminDb) {
            const snap = await adminDb.collection('claims_tickets').get();
            snap.forEach(d => {
                const cData = { id: d.id, ...d.data() };
                if (!allClaims.some(a => a.claimTicketId === cData.claimTicketId)) {
                    allClaims.push(cData);
                }
            });
        }

        const todayClaims = allClaims.filter(c => {
            const cDate = c.dateStr || (c.createdAt ? c.createdAt.split('T')[0] : '');
            return cDate === todayStr || (Date.now() - (c.timestamp || 0) < (24 * 60 * 60 * 1000));
        });

        if (todayClaims.length === 0) {
            return `✅ *REPORTE DE RECLAMOS DE HOY (${todayStr})*\n\n¡Buenas noticias Jefe! No se ha registrado ningún reclamo en el día de hoy. Todo marcha excelente.`;
        }

        let report = `🚨 *REPORTE DE RECLAMOS DE HOY (${todayClaims.length} REGISTRADOS)* 🚨\n\n`;
        todayClaims.forEach((c, idx) => {
            const phoneStr = c.clientPhone ? `+${c.clientPhone}` : 'Sin teléfono';
            report += `*${idx + 1}. Ticket:* \`${c.claimTicketId}\` | Status: *${c.status || 'PENDIENTE'}*\n`;
            report += `   👤 *Cliente:* ${c.clientName || 'Cliente'} (${phoneStr})\n`;
            report += `   📝 *Motivo:* "${c.summary || c.rawReason}"\n\n`;
        });

        return report;
    } catch (e) {
        console.error("Error al obtener reporte diario de reclamos:", e.message);
        return `❌ Error al consultar reclamos del día: ${e.message}`;
    }
}
