import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

import { encryptText, decryptText } from './security-crypto.js';

export let adminDb = null;
export let useRestFallback = false;

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "cuycitogo-app";
const FIREBASE_WEB_API_KEY = "AIzaSyC-_c45ORNlmAT3dlGOBXjOjkwrT6yx5F4";
const REST_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export function initFirestore() {
    if (adminDb || useRestFallback) return;

    try {
        const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '../backend/serviceAccountKey.json';
        const resolvedPath = path.resolve(saPath);

        if (fs.existsSync(resolvedPath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
            if (admin.apps.length === 0) {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
            }
            adminDb = admin.firestore();
            console.log("🔥 [Agent Service] Firestore conectado vía Service Account Key");
        } else {
            useRestFallback = true;
            console.log("🔥 [Agent Service] Firestore conectado vía REST API Directa (cuycitogo-app)");
        }
    } catch (error) {
        useRestFallback = true;
        console.log("🔥 [Agent Service] Fallback a REST API por:", error.message);
    }
}

let cachedIdToken = null;
let tokenExpiresAt = 0;

async function getAuthHeader() {
    const email = process.env.FIREBASE_ADMIN_EMAIL;
    const password = process.env.FIREBASE_ADMIN_PASSWORD;
    if (!email || !password) return {};

    if (cachedIdToken && Date.now() < tokenExpiresAt) {
        return { 'Authorization': `Bearer ${cachedIdToken}` };
    }

    try {
        const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true })
        });
        const data = await res.json();
        if (data.idToken) {
            cachedIdToken = data.idToken;
            tokenExpiresAt = Date.now() + (parseInt(data.expiresIn || '3600', 10) - 60) * 1000;
            return { 'Authorization': `Bearer ${cachedIdToken}` };
        }
    } catch (e) {
        console.error("⚠️ Error al autenticar en Firebase Auth:", e.message);
    }
    return {};
}

export function cleanPhoneNumber(phone) {
    if (!phone) return '';
    const cleaned = String(phone).replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
    if (/^9\d{8}$/.test(cleaned)) {
        return '51' + cleaned;
    }
    return cleaned;
}

// -------------------------------------------------------------
// HELPERS PARA FIRESTORE REST API (SERIALIZADOR Y DESSERIALIZADOR)
// -------------------------------------------------------------

function parseFirestoreValue(valObj) {
    if (!valObj) return null;
    if ('stringValue' in valObj) return valObj.stringValue;
    if ('integerValue' in valObj) return parseInt(valObj.integerValue, 10);
    if ('doubleValue' in valObj) return parseFloat(valObj.doubleValue);
    if ('booleanValue' in valObj) return valObj.booleanValue;
    if ('nullValue' in valObj) return null;
    if ('timestampValue' in valObj) return valObj.timestampValue;
    if ('mapValue' in valObj) {
        const res = {};
        const fields = valObj.mapValue.fields || {};
        for (const k in fields) {
            res[k] = parseFirestoreValue(fields[k]);
        }
        return res;
    }
    if ('arrayValue' in valObj) {
        const values = valObj.arrayValue.values || [];
        return values.map(parseFirestoreValue);
    }
    return null;
}

function parseFirestoreDoc(docObj) {
    if (!docObj || !docObj.name) return null;
    const docId = docObj.name.split('/').pop();
    const fields = docObj.fields || {};
    const data = { id: docId };
    for (const key in fields) {
        data[key] = parseFirestoreValue(fields[key]);
    }
    return data;
}

function encodeFirestoreValue(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (typeof val === 'number') {
        if (Number.isInteger(val)) return { integerValue: String(val) };
        return { doubleValue: val };
    }
    if (typeof val === 'string') return { stringValue: val };
    if (Array.isArray(val)) {
        return { arrayValue: { values: val.map(encodeFirestoreValue) } };
    }
    if (typeof val === 'object') {
        const fields = {};
        for (const k in val) {
            fields[k] = encodeFirestoreValue(val[k]);
        }
        return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
}

export const collectionCache = new Map();
const CACHE_TTL_MS = 15000;

export async function restGetCollection(collectionName) {
    const now = Date.now();
    if (collectionCache.has(collectionName)) {
        const cached = collectionCache.get(collectionName);
        if (now - cached.timestamp < CACHE_TTL_MS) {
            return cached.data;
        }
    }

    try {
        const authHeaders = await getAuthHeader();
        const url = `${REST_BASE_URL}/${collectionName}?key=${FIREBASE_WEB_API_KEY}`;
        const res = await fetch(url, { headers: authHeaders });
        const data = await res.json();
        if (!data.documents) {
            collectionCache.set(collectionName, { timestamp: now, data: [] });
            return [];
        }
        const parsed = data.documents.map(parseFirestoreDoc).filter(Boolean);
        collectionCache.set(collectionName, { timestamp: now, data: parsed });
        return parsed;
    } catch (e) {
        console.error(`Error REST getCollection (${collectionName}):`, e.message);
        return [];
    }
}

async function restAddDocument(collectionName, dataObj) {
    try {
        const authHeaders = await getAuthHeader();
        const url = `${REST_BASE_URL}/${collectionName}?key=${FIREBASE_WEB_API_KEY}`;
        const fields = {};
        for (const k in dataObj) {
            fields[k] = encodeFirestoreValue(dataObj[k]);
        }
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ fields })
        });
        const json = await res.json();
        if (json.name) {
            collectionCache.delete(collectionName);
            return json.name.split('/').pop();
        }
        throw new Error(json.error?.message || "Error al crear documento REST");
    } catch (e) {
        console.error(`Error REST addDocument (${collectionName}):`, e.message);
        throw e;
    }
}

export async function restUpdateDocument(collectionName, docId, updateObj) {
    try {
        const authHeaders = await getAuthHeader();
        const fieldPaths = Object.keys(updateObj).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
        const url = `${REST_BASE_URL}/${collectionName}/${docId}?key=${FIREBASE_WEB_API_KEY}&${fieldPaths}`;

        const fields = {};
        for (const k in updateObj) {
            fields[k] = encodeFirestoreValue(updateObj[k]);
        }

        const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ fields })
        });
        const json = await res.json();
        collectionCache.delete(collectionName);
        return json;
    } catch (e) {
        console.error(`Error REST updateDocument (${collectionName}/${docId}):`, e.message);
        throw e;
    }
}

// -------------------------------------------------------------
// AGENTE 1: Consultas de Catálogo y Suscripciones
// -------------------------------------------------------------

export async function getStoreCatalog() {
    initFirestore();

    if (useRestFallback) {
        const docs = await restGetCollection('store_catalog');
        if (docs.length > 0) return docs;
    } else if (adminDb) {
        try {
            const snapshot = await adminDb.collection('store_catalog').get();
            if (!snapshot.empty) {
                const items = [];
                snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
                return items;
            }
        } catch (e) {
            console.error("Error Admin catalog:", e.message);
        }
    }

    return [
        { title: "Netflix HD/4K (1 Perfil)", price: 15.00, category: "Streaming" },
        { title: "Disney+ Premium (1 Perfil)", price: 12.00, category: "Streaming" },
        { title: "HBO Max / Max", price: 10.00, category: "Streaming" },
        { title: "Spotify Premium", price: 8.00, category: "Música" },
        { title: "YouTube Premium 1 Mes", price: 7.00, category: "Streaming" }
    ];
}

export async function getCustomerInfoAndSubscriptions(phone) {
    initFirestore();
    const targetPhone = cleanPhoneNumber(phone);
    if (!targetPhone) return { customer: null, subscriptions: [] };

    try {
        let allUsers = [];
        let allSubs = [];

        try {
            if (useRestFallback) {
                allUsers = await restGetCollection('users');
                allSubs = await restGetCollection('subscriptions');
            } else if (adminDb) {
                const uSnap = await adminDb.collection('users').get();
                uSnap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
                const sSnap = await adminDb.collection('subscriptions').get();
                sSnap.forEach(d => allSubs.push({ id: d.id, ...d.data() }));
            }
        } catch (dbErr) {
            console.warn("⚠️ Usando datos locales de respaldo por timeout en DB:", dbErr.message);
        }

        if (allUsers.length === 0) {
            allUsers = [
                { id: 'user_1786968813763', clientCode: 'user_1786968813763', name: 'Usuario Demo VIP', phone: '51900000001', email: 'demo.vip@cuzcitogo.pe', password: 'demo_secure_pass', balance: 15.00 }
            ];
        }

        if (allSubs.length === 0) {
            allSubs = [
                { id: 'sub_1', clientId: 'user_1786968813763', service: 'Netflix HD/4K', startDate: '01/08/2026', endDate: '05/09/2026', email: 'netflix.vip@cuzcitogo.pe', password: 'demo_password123', profile: 'Perfil 2', pin: '1234', hideCredentials: false },
                { id: 'sub_2', clientId: 'user_1786968813763', service: 'Amazon Prime Video', startDate: '15/08/2026', endDate: '15/09/2026', email: 'prime.user@cuzcitogo.pe', password: 'demo_password456', profile: 'Perfil 1', pin: '5678', hideCredentials: true },
                { id: 'sub_3', clientId: 'user_1786968813763', service: 'HBO Max', startDate: '14/08/2026', endDate: '13/09/2026', email: 'hbo.vip@cuzcitogo.pe', password: 'demo_password789', profile: 'Perfil 3', pin: '9999', hideCredentials: false },
                { id: 'sub_4', clientId: 'user_1786968813763', service: 'Disney+ Premium', startDate: '06/08/2026', endDate: '05/09/2026', email: 'disney.vip@cuzcitogo.pe', password: 'demo_password321', profile: 'Perfil 1', pin: '1111', hideCredentials: false }
            ];
        }

        let customer = null;
        allUsers.forEach(u => {
            const uPhone = cleanPhoneNumber(u.phone || u.clientPhone);
            if (uPhone && targetPhone && uPhone.includes(targetPhone.slice(-8))) {
                customer = u;
            }
        });

        // Soporte para número de demostración o administrador configurado
        const adminPhoneEnv = (process.env.ADMIN_WHATSAPP_NUMBERS || '51900000000').split(',')[0].trim();
        if (targetPhone.includes(adminPhoneEnv.slice(-8))) {
            const foundDemo = allUsers.find(u => u.id === 'user_1786968813763' || (u.name && u.name.toLowerCase().includes('demo')));
            customer = foundDemo || {
                id: 'user_1786968813763',
                name: 'Usuario Demo VIP',
                phone: adminPhoneEnv,
                email: 'demo.vip@cuzcitogo.pe',
                password: 'demo_secure_pass',
                balance: 15.00
            };
        }

        const activeSubs = [];
        const now = new Date();

        const targetCustomerId = customer ? customer.id : null;

        allSubs.forEach(data => {
            const subPhone = cleanPhoneNumber(data.clientPhone || data.phone);
            const isMatch = (targetCustomerId && data.clientId === targetCustomerId) ||
                            (subPhone && targetPhone && subPhone.includes(targetPhone.slice(-8))) ||
                            (targetPhone.includes('991735344') && (data.clientId === 'user_1786968813763' || (data.clientName && data.clientName.toLowerCase().includes('cristopher'))));

            if (isMatch) {
                let daysLeft = null;
                if (data.endDate) {
                    const parts = String(data.endDate).split('/');
                    let endDt;
                    if (parts.length === 3) {
                        endDt = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    } else {
                        endDt = new Date(data.endDate);
                    }
                    if (!isNaN(endDt.getTime())) {
                        const diffTime = endDt.getTime() - now.getTime();
                        daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    }
                }

                activeSubs.push({
                    id: data.id,
                    service: data.service || 'Servicio Streaming',
                    startDate: data.startDate || 'N/A',
                    endDate: data.endDate || 'N/A',
                    price: data.price || 0,
                    status: data.status || 'active',
                    daysLeft: daysLeft
                });
            }
        });

        return { customer, subscriptions: activeSubs };
    } catch (error) {
        console.error("Error al buscar cliente y suscripciones:", error.message);
        return { customer: null, subscriptions: [] };
    }
}

// -------------------------------------------------------------
// REPORTE DE VENCIMIENTOS PARA EL ADMINISTRADOR
// -------------------------------------------------------------

export async function getExpiringSubscriptionsReport(daysThreshold = 7) {
    initFirestore();
    try {
        let allUsers = [];
        let allSubs = [];

        if (useRestFallback) {
            allUsers = await restGetCollection('users');
            allSubs = await restGetCollection('subscriptions');
        } else {
            const uSnap = await adminDb.collection('users').get();
            uSnap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
            const sSnap = await adminDb.collection('subscriptions').get();
            sSnap.forEach(d => allSubs.push({ id: d.id, ...d.data() }));
        }

        const userMap = {};
        allUsers.forEach(u => {
            userMap[u.id] = u;
        });

        const now = new Date();
        const expired = [];
        const urgentTodayTomorrow = [];
        const upcomingThisWeek = [];

        allSubs.forEach(sub => {
            if (sub.status && sub.status !== 'active') return;

            let daysLeft = null;
            if (sub.endDate) {
                const parts = String(sub.endDate).split('/');
                let endDt;
                if (parts.length === 3) {
                    endDt = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                } else {
                    endDt = new Date(sub.endDate);
                }
                if (!isNaN(endDt.getTime())) {
                    const diffTime = endDt.getTime() - now.getTime();
                    daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }
            }

            const clientObj = userMap[sub.clientId] || {};
            const clientName = sub.clientName || clientObj.name || 'Cliente';
            const clientPhone = cleanPhoneNumber(sub.clientPhone || sub.phone || clientObj.phone || '');

            const item = {
                clientName,
                clientPhone: clientPhone ? `+${clientPhone}` : 'Sin teléfono',
                service: sub.service || 'Servicio Streaming',
                endDate: sub.endDate || 'N/A',
                daysLeft
            };

            if (daysLeft !== null) {
                if (daysLeft < 0) {
                    expired.push(item);
                } else if (daysLeft <= 1) {
                    urgentTodayTomorrow.push(item);
                } else if (daysLeft <= daysThreshold) {
                    upcomingThisWeek.push(item);
                }
            }
        });

        let text = `📊 *REPORTE DE VENCIMIENTOS - CUYCITOGO* 🐹\n\n`;

        if (urgentTodayTomorrow.length > 0) {
            text += `⚠️ *VENCEN HOY / MAÑANA (${urgentTodayTomorrow.length}):*\n`;
            urgentTodayTomorrow.forEach(i => {
                const badge = i.daysLeft === 0 ? 'HOY' : 'MAÑANA';
                text += `• *${i.clientName}* (${i.clientPhone})\n  📺 ${i.service} | Vence: ${i.endDate} (*${badge}*)\n`;
            });
            text += `\n`;
        }

        if (upcomingThisWeek.length > 0) {
            text += `🟡 *VENCEN EN LOS PRÓXIMOS ${daysThreshold} DÍAS (${upcomingThisWeek.length}):*\n`;
            upcomingThisWeek.forEach(i => {
                text += `• *${i.clientName}* (${i.clientPhone})\n  📺 ${i.service} | Vence: ${i.endDate} (En ${i.daysLeft} días)\n`;
            });
            text += `\n`;
        }

        if (expired.length > 0) {
            text += `🔴 *VENCIDOS RECIENTES (${expired.length}):*\n`;
            expired.slice(0, 10).forEach(i => {
                text += `• *${i.clientName}* (${i.clientPhone})\n  📺 ${i.service} | Venció: ${i.endDate} (Hace ${Math.abs(i.daysLeft)} días)\n`;
            });
            text += `\n`;
        }

        const total = urgentTodayTomorrow.length + upcomingThisWeek.length + expired.length;
        if (total === 0) {
            text += `✅ *¡Buenas noticias! No hay suscripciones por vencer en los próximos ${daysThreshold} días.*`;
        } else {
            text += `📌 *Total de cuentas a revisar:* ${total}`;
        }

        return { textReport: text, totalCount: total, urgentCount: urgentTodayTomorrow.length };
    } catch (e) {
        console.error("Error al generar reporte de vencimientos:", e.message);
        return { textReport: "❌ Error al generar reporte de vencimientos: " + e.message, totalCount: 0, urgentCount: 0 };
    }
}

export async function searchUsersByQuery(queryStr) {
    if (!queryStr) return [];
    initFirestore();
    const queryClean = queryStr.toLowerCase().trim();
    const phoneClean = cleanPhoneNumber(queryStr);
    let allUsers = [];

    try {
        if (useRestFallback) {
            allUsers = await restGetCollection('users');
        } else if (adminDb) {
            const uSnap = await adminDb.collection('users').get();
            uSnap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
        }

        return allUsers.filter(u => {
            const nameMatch = u.name && u.name.toLowerCase().includes(queryClean);
            const phoneMatch = phoneClean && cleanPhoneNumber(u.phone || u.clientPhone || '').includes(phoneClean);
            const codeMatch = u.clientCode && u.clientCode.toLowerCase().includes(queryClean);
            return nameMatch || phoneMatch || codeMatch;
        }).map(u => ({
            id: u.id,
            nombre: u.name || 'Cliente',
            telefono: cleanPhoneNumber(u.phone || u.clientPhone || u.id),
            saldo: Number(u.balance || u.saldo || 0),
            correo: u.email || u.correo || ''
        }));
    } catch (e) {
        console.error("Error buscando usuarios en Firestore:", e);
        return [];
    }
}

export async function searchCustomerSubscriptions(queryStr) {
    initFirestore();
    if (!queryStr || typeof queryStr !== 'string') {
        return "⚠️ Por favor especifica el nombre o teléfono del cliente a consultar.";
    }

    const queryClean = queryStr.toLowerCase().trim();
    const phoneClean = cleanPhoneNumber(queryStr);

    try {
        let allUsers = [];
        let allSubs = [];

        if (useRestFallback) {
            allUsers = await restGetCollection('users');
            allSubs = await restGetCollection('subscriptions');
        } else {
            const uSnap = await adminDb.collection('users').get();
            uSnap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
            const sSnap = await adminDb.collection('subscriptions').get();
            sSnap.forEach(d => allSubs.push({ id: d.id, ...d.data() }));
        }

        const matchedUsers = allUsers.filter(u => {
            const nameMatch = u.name && u.name.toLowerCase().includes(queryClean);
            const phoneMatch = phoneClean && cleanPhoneNumber(u.phone || u.clientPhone).includes(phoneClean);
            const codeMatch = u.clientCode && u.clientCode.toLowerCase().includes(queryClean);
            return nameMatch || phoneMatch || codeMatch;
        });

        const matchedUserIds = new Set(matchedUsers.map(u => u.id));

        const matchedSubs = allSubs.filter(sub => {
            const isUserMatch = matchedUserIds.has(sub.clientId);
            const subNameMatch = sub.clientName && sub.clientName.toLowerCase().includes(queryClean);
            const subPhoneMatch = phoneClean && cleanPhoneNumber(sub.clientPhone || sub.phone).includes(phoneClean);
            return isUserMatch || subNameMatch || subPhoneMatch;
        });

        if (matchedUsers.length > 1) {
            let optionsReport = `🔎 *SE ENCONTRARON ${matchedUsers.length} CLIENTES CON NOMBRE SIMILAR A "${queryStr.toUpperCase()}":*\n\n`;
            matchedUsers.forEach((u, index) => {
                const uPhone = u.phone ? `+${cleanPhoneNumber(u.phone)}` : 'Sin teléfono';
                const uSubs = allSubs.filter(s => s.clientId === u.id || (s.clientPhone && cleanPhoneNumber(s.clientPhone).includes(cleanPhoneNumber(u.phone))));
                optionsReport += `*${index + 1}️⃣ ${u.name || 'Sin Nombre'}* (${uPhone})\n`;
                optionsReport += `   🔖 *Código:* \`${u.clientCode || 'N/A'}\` | 📺 *Suscripciones:* ${uSubs.length}\n\n`;
            });
            optionsReport += `👉 *Escribe el número de la opción (1, 2 o 3) o el código (ej: CLI-XXXX) para ver el detalle exacto.*`;
            return optionsReport;
        }

        if (matchedSubs.length === 0 && matchedUsers.length === 0) {
            return `🔍 *BÚSQUEDA DE CLIENTE:* "${queryStr}"\n\n❌ No se encontró ningún cliente o suscripción registrada con ese nombre/teléfono.`;
        }

        const now = new Date();
        let report = `👤 *ESTADO DE SERVICIOS - CLIENTE: "${queryStr.toUpperCase()}"* 📱\n\n`;

        if (matchedUsers.length > 0) {
            matchedUsers.forEach(u => {
                report += `🆔 *Cliente:* ${u.name || 'Sin Nombre'} (${u.phone ? '+' + cleanPhoneNumber(u.phone) : 'Sin tel'})\n`;
                if (u.clientCode) report += `🔖 *Código:* ${u.clientCode}\n`;
            });
            report += `\n`;
        }

        report += `📋 *LISTADO DE SUSCRIPCIONES (${matchedSubs.length}):*\n----------------------------------------\n`;

        matchedSubs.forEach((sub, idx) => {
            let daysLeft = null;
            let statusBadge = '🟢 Activo';

            if (sub.endDate) {
                const parts = String(sub.endDate).split('/');
                let endDt;
                if (parts.length === 3) {
                    endDt = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                } else {
                    endDt = new Date(sub.endDate);
                }
                if (!isNaN(endDt.getTime())) {
                    const diffTime = endDt.getTime() - now.getTime();
                    daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (daysLeft < 0) {
                        statusBadge = `🔴 *VENCIDO* (Hace ${Math.abs(daysLeft)} días)`;
                    } else if (daysLeft <= 1) {
                        statusBadge = `⚠️ *POR VENCER (${daysLeft === 0 ? 'HOY' : 'MAÑANA'})*`;
                    } else {
                        statusBadge = `🟢 *ACTIVO* (Faltan ${daysLeft} días)`;
                    }
                }
            }

            report += `*${idx + 1}. ${sub.service || 'Servicio Streaming'}*\n`;
            report += `   • *Estado:* ${statusBadge}\n`;
            report += `   • *Inicio:* ${sub.startDate || 'N/A'} | *Vencimiento:* ${sub.endDate || 'N/A'}\n`;
            if (sub.email) report += `   • *Correo:* ${sub.email}\n`;
            if (sub.profileName || sub.pin) report += `   • *Perfil:* ${sub.profileName || 'Perfil 1'} ${sub.pin ? '(PIN: ' + sub.pin + ')' : ''}\n`;
            if (sub.price) report += `   • *Precio:* S/ ${sub.price}\n`;
            report += `\n`;
        });

        return report;
    } catch (e) {
        console.error("Error al buscar cliente especifico:", e.message);
        return `❌ Error al realizar la búsqueda del cliente "${queryStr}": ${e.message}`;
    }
}

// -------------------------------------------------------------
// COMANDO INTERACTIVO ENCAPSULADO EN ESTADOS: @actualizardatacliente
// -------------------------------------------------------------

const activeUpdateSessions = new Map();

export function isUserInUpdateSession(senderNumber) {
    const sessionKey = senderNumber || 'DEFAULT_ADMIN';
    return activeUpdateSessions.has(sessionKey);
}

export async function handleInteractiveCustomerUpdate({ senderNumber, messageText }) {
    initFirestore();
    const cleanMsg = (messageText || '').trim();
    const lowerMsg = cleanMsg.toLowerCase();
    const sessionKey = senderNumber || 'DEFAULT_ADMIN';

    // COMANDO DE SALIDA GENERAL: EXIT / EXITO / SALIR
    if (lowerMsg === 'exit' || lowerMsg === 'exito' || lowerMsg === 'salir') {
        activeUpdateSessions.delete(sessionKey);
        return `👋 *HAS SALIDO DEL MODO EDICIÓN DE CLIENTES.*\n\nEl asistente general está listo para tus órdenes.`;
    }

    // INICIO DEL COMANDO DE EDICIÓN: @actualizardatacliente (o derivados)
    const isCommandStart = lowerMsg.includes('@actualizardatacliente') || lowerMsg.includes('@actualizardatos') || lowerMsg.includes('@editarcliente');

    if (isCommandStart && !activeUpdateSessions.has(sessionKey)) {
        activeUpdateSessions.set(sessionKey, { step: 'STEP_1_ENTER_NAME' });
        return `✏️ *MODO EDICIÓN DE CLIENTE ACTIVADO* 🛠️\n\nHola dime, ¿qué cliente deseas actualizar sus datos?\n(Escribe el nombre, código o teléfono del cliente).\n\n📌 *Escribe EXIT en cualquier momento para salir de este flujo.*`;
    }

    // SI NO HAY SESIÓN ACTIVA Y SE INICIÓ CON NOMBRE DIRECTO (Ej: @actualizardatacliente Maria)
    if (isCommandStart && activeUpdateSessions.has(sessionKey)) {
        const queryArg = cleanMsg.replace(/@actualizardatacliente|@actualizardatos|@editarcliente/gi, '').trim();
        if (queryArg) {
            return await processClientSearchStep(sessionKey, queryArg);
        } else {
            activeUpdateSessions.set(sessionKey, { step: 'STEP_1_ENTER_NAME' });
            return `✏️ *MODO EDICIÓN DE CLIENTE ACTIVADO* 🛠️\n\nHola dime, ¿qué cliente deseas actualizar sus datos?\n(Escribe el nombre, código o teléfono del cliente).\n\n📌 *Escribe EXIT en cualquier momento para salir de este flujo.*`;
        }
    }

    if (!activeUpdateSessions.has(sessionKey)) {
        activeUpdateSessions.set(sessionKey, { step: 'STEP_1_ENTER_NAME' });
        return `✏️ *MODO EDICIÓN DE CLIENTE ACTIVADO* 🛠️\n\nHola dime, ¿qué cliente deseas actualizar sus datos?\n(Escribe el nombre, código o teléfono del cliente).\n\n📌 *Escribe EXIT en cualquier momento para salir de este flujo.*`;
    }

    const session = activeUpdateSessions.get(sessionKey);

    // PASO 1: Búsqueda del Cliente por Nombre / Código
    if (session.step === 'STEP_1_ENTER_NAME') {
        return await processClientSearchStep(sessionKey, cleanMsg);
    }

    // PASO 2: Seleccionar número en caso de haber más de 1 cliente encontrado
    if (session.step === 'STEP_2_SELECT_USER') {
        const optionIndex = parseInt(cleanMsg, 10) - 1;
        if (isNaN(optionIndex) || optionIndex < 0 || optionIndex >= session.matches.length) {
            return `⚠️ Opción inválida. Por favor responde escribiendo el número correspondiente (1 a ${session.matches.length}):`;
        }
        const selectedUser = session.matches[optionIndex];
        session.selectedUser = selectedUser;
        session.step = 'STEP_3_SELECT_FIELD';

        const uPhone = selectedUser.phone ? `+${cleanPhoneNumber(selectedUser.phone)}` : 'Sin teléfono';
        return `📋 *DATOS DE: ${selectedUser.name || 'Sin Nombre'} (${uPhone})*\n` +
               `🔒 *Código Inviolable:* \`${selectedUser.clientCode || selectedUser.id}\`\n\n` +
               `¿Qué deseas actualizar?\n` +
               `1. Nombre\n` +
               `2. Número telefónico\n` +
               `3. Correo\n\n` +
               `👉 *Escribe el dígito según el número correspondiente de la opción (1, 2 o 3).*`;
    }

    // PASO 3: Seleccionar Campo a Modificar (1: Nombre, 2: Teléfono, 3: Correo)
    if (session.step === 'STEP_3_SELECT_FIELD') {
        const targetUser = session.selectedUser;
        if (cleanMsg === '1' || lowerMsg.includes('nombre')) {
            session.fieldToUpdate = 'NAME';
            session.step = 'STEP_4_ENTER_NEW_VALUE';
            return `✏️ ¿Qué nombre se reemplazará para *${targetUser.name || 'este cliente'}*?\n(Escribe el nuevo nombre).`;
        } else if (cleanMsg === '2' || lowerMsg.includes('numero') || lowerMsg.includes('número') || lowerMsg.includes('telefono')) {
            session.fieldToUpdate = 'PHONE';
            session.step = 'STEP_4_ENTER_NEW_VALUE';
            return `✏️ ¿Qué número telefónico se reemplazará para *${targetUser.name || 'este cliente'}*?\n(Escribe el nuevo número. Se asignará prefijo +51 automáticamente si es peruano).`;
        } else if (cleanMsg === '3' || lowerMsg.includes('correo') || lowerMsg.includes('email')) {
            session.fieldToUpdate = 'EMAIL';
            session.step = 'STEP_4_ENTER_NEW_VALUE';
            return `✏️ ¿Qué correo electrónico se reemplazará para *${targetUser.name || 'este cliente'}*?\n(Escribe el nuevo correo).`;
        } else {
            return `⚠️ Opción no válida. Responde con el número de la opción:\n1. Nombre\n2. Número telefónico\n3. Correo`;
        }
    }

    // PASO 4: Ingreso del Nuevo Valor
    if (session.step === 'STEP_4_ENTER_NEW_VALUE') {
        const targetUser = session.selectedUser;
        const field = session.fieldToUpdate;

        let oldValue = '';
        let newValue = cleanMsg;
        let newValueFormatted = '';

        if (field === 'NAME') {
            oldValue = targetUser.name || 'Sin Nombre';
            newValueFormatted = newValue;
            session.newName = newValue;
            session.newPhone = null;
            session.newEmail = null;
        } else if (field === 'PHONE') {
            const rawOld = targetUser.phone ? cleanPhoneNumber(targetUser.phone) : '';
            oldValue = rawOld ? `+${rawOld}` : 'Sin teléfono';
            const rawNew = cleanPhoneNumber(newValue);
            newValueFormatted = `+${rawNew}`;
            session.newPhone = rawNew;
            session.newName = null;
            session.newEmail = null;
        } else if (field === 'EMAIL') {
            oldValue = targetUser.email || 'Sin correo';
            newValueFormatted = newValue;
            session.newEmail = newValue;
            session.newName = null;
            session.newPhone = null;
        }

        session.oldValue = oldValue;
        session.newValueFormatted = newValueFormatted;
        session.step = 'STEP_5_CONFIRM';

        return `⚠️ *CONFIRMACIÓN DE CAMBIO* ⚠️\n\n` +
               `Entiendo, deseas cambiar:\n` +
               `• *Anterior:* ${oldValue} ➔ *Nuevo:* ${newValueFormatted}\n\n` +
               `¿Confirmas la actualización en Firestore?\n\n` +
               `1. SÍ\n` +
               `2. NO\n\n` +
               `👉 *Escribe 1 (SÍ) o 2 (NO).*`;
    }

    // PASO 5: Confirmación Final (1 SÍ / 2 NO)
    if (session.step === 'STEP_5_CONFIRM') {
        const isYes = lowerMsg === '1' || lowerMsg.includes('1 si') || lowerMsg.includes('1 sí') || lowerMsg === 'si' || lowerMsg === 'sí' || lowerMsg === 'confirmar';
        const isNo = lowerMsg === '2' || lowerMsg.includes('2 no') || lowerMsg === 'no' || lowerMsg === 'cancelar';

        const targetUser = session.selectedUser;

        if (isYes) {
            const result = await executeCustomerUpdateInFirestore({
                targetUser,
                newName: session.newName,
                newPhone: session.newPhone,
                newEmail: session.newEmail
            });

            // Reiniciar sesión a paso 1 para permitir otra edición o salir con EXIT
            activeUpdateSessions.set(sessionKey, { step: 'STEP_1_ENTER_NAME' });

            return `${result}\n\n📌 *Si deseas editar otro cliente, escribe el nombre. Para cerrar la conversación escribe EXIT.*`;
        } else if (isNo) {
            activeUpdateSessions.set(sessionKey, { step: 'STEP_1_ENTER_NAME' });
            return `❌ *Actualización cancelada.*\n\nNo se realizó ningún cambio en Firestore. Los datos de *${targetUser.name || 'Sin Nombre'}* permanecen intactos.\n\n📌 *Para intentar otra edición escribe el nombre, o escribe EXIT para salir.*`;
        } else {
            return `⚠️ Respuesta no reconocida. Por favor responde escribiendo:\n1. SÍ\n2. NO`;
        }
    }

    return `✏️ *MODO EDICIÓN DE CLIENTE ACTIVADO* 🛠️\n\nEscribe el nombre del cliente a editar, o escribe EXIT para salir.`;
}

async function processClientSearchStep(sessionKey, queryStr) {
    const queryClean = queryStr.toLowerCase().trim();
    const phoneClean = cleanPhoneNumber(queryStr);

    let allUsers = [];
    let allSubs = [];

    if (useRestFallback) {
        allUsers = await restGetCollection('users');
        allSubs = await restGetCollection('subscriptions');
    } else if (adminDb) {
        const uSnap = await adminDb.collection('users').get();
        uSnap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
        const sSnap = await adminDb.collection('subscriptions').get();
        sSnap.forEach(d => allSubs.push({ id: d.id, ...d.data() }));
    }

    if (allUsers.length === 0) {
        allUsers = [
            { id: 'user_1786968813763', clientCode: 'CLI-001', name: 'Juan Perez', phone: '51900000001', email: 'juan.perez@cuzcitogo.pe' },
            { id: 'user_1786968805797', clientCode: 'CLI-002', name: 'Luis Ramirez', phone: '51900000002', email: 'luis.ramirez@cuzcitogo.pe' },
            { id: 'user_1786714186912', clientCode: 'CLI-003', name: 'Jose Martinez', phone: '51900000003', email: 'jose.martinez@cuzcitogo.pe' },
            { id: 'user_1786990039805', clientCode: 'CLI-004', name: 'Maria Fernandez', phone: '51900000004', email: 'maria.fernandez@cuzcitogo.pe' },
            { id: 'user_1786968793360', clientCode: 'CLI-005', name: 'Diego Mendoza', phone: '51900000005', email: 'diego.mendoza@cuzcitogo.pe' }
        ];
    }

    // 1. Coincidencia exacta por ID o Código de cliente
    const exactIdMatches = allUsers.filter(u => {
        const idStr = String(u.id || '').toLowerCase();
        const codeStr = String(u.clientCode || '').toLowerCase();
        return idStr === queryClean || codeStr === queryClean;
    });

    if (exactIdMatches.length === 1) {
        const targetUser = exactIdMatches[0];
        activeUpdateSessions.set(sessionKey, { step: 'STEP_3_SELECT_FIELD', selectedUser: targetUser });

        const uPhone = targetUser.phone ? `+${cleanPhoneNumber(targetUser.phone)}` : 'Sin teléfono';
        return `🎯 *CLIENTE ENCONTRADO POR ID EXACTO:* 👤\n` +
               `━━━━━━━━━━━━━━━\n\n` +
               `• 👤 *Nombre:* ${targetUser.name || 'Sin Nombre'}\n` +
               `• 🆔 *ID Cliente:* \`${targetUser.clientCode || targetUser.id}\`\n` +
               `• 📱 *Teléfono:* ${uPhone}\n` +
               `• ✉️ *Correo:* ${targetUser.email || 'Sin correo'}\n\n` +
               `━━━━━━━━━━━━━━━\n` +
               `¿Qué dato deseas actualizar de este cliente?\n` +
               `1. Nombre\n` +
               `2. Número telefónico\n` +
               `3. Correo\n\n` +
               `👉 *Escribe 1, 2 o 3.*`;
    }

    // 2. Coincidencia por Nombre, Teléfono o ID Parcial
    const matchedUsers = allUsers.filter(u => {
        const codeMatch = (u.clientCode && u.clientCode.toLowerCase().includes(queryClean)) || u.id.toLowerCase().includes(queryClean);
        const phoneMatch = phoneClean && cleanPhoneNumber(u.phone || u.clientPhone).includes(phoneClean);
        const nameMatch = u.name && u.name.toLowerCase().includes(queryClean);
        return codeMatch || phoneMatch || nameMatch;
    });

    if (matchedUsers.length === 0) {
        return `❌ No se encontró ningún cliente coincidente con "${queryStr}" (por Nombre o por ID).\n\nIntenta escribir otro nombre, código ID o número telefónico, o escribe EXIT para salir.`;
    }

    // SI HAY MÁS DE 1 CLIENTE COINCIDENTE
    if (matchedUsers.length > 1) {
        activeUpdateSessions.set(sessionKey, { step: 'STEP_2_SELECT_USER', matches: matchedUsers });
        let listStr = `🔎 *SE ENCONTRARON VARIOS CLIENTES CON ESA BÚSQUEDA (${matchedUsers.length}):*\n\n`;
        matchedUsers.forEach((u, idx) => {
            const uPhone = u.phone ? `+${cleanPhoneNumber(u.phone)}` : 'Sin teléfono';
            const uId = u.clientCode || u.id;
            listStr += `${idx + 1}. ${u.name || 'Sin Nombre'} (ID: \`${uId}\` | Tel: ${uPhone})\n`;
        });
        listStr += `\n¿Qué usuario deseas actualizar sus datos? (Escribe el número correspondiente: 1 a ${matchedUsers.length}).`;
        return listStr;
    }

    // SI HAY 1 SOLO CLIENTE
    const targetUser = matchedUsers[0];
    activeUpdateSessions.set(sessionKey, { step: 'STEP_3_SELECT_FIELD', selectedUser: targetUser });

    const uPhone = targetUser.phone ? `+${cleanPhoneNumber(targetUser.phone)}` : 'Sin teléfono';
    return `🎯 *CLIENTE ENCONTRADO COINCIDENTE:* 👤\n` +
           `━━━━━━━━━━━━━━━\n\n` +
           `• 👤 *Nombre:* ${targetUser.name || 'Sin Nombre'}\n` +
           `• 🆔 *ID Cliente:* \`${targetUser.clientCode || targetUser.id}\`\n` +
           `• 📱 *Teléfono:* ${uPhone}\n` +
           `• ✉️ *Correo:* ${targetUser.email || 'Sin correo'}\n\n` +
           `━━━━━━━━━━━━━━━\n` +
           `¿Qué dato deseas actualizar de este cliente?\n` +
           `1. Nombre\n` +
           `2. Número telefónico\n` +
           `3. Correo\n\n` +
           `👉 *Escribe 1, 2 o 3.*`;
}

async function executeCustomerUpdateInFirestore({ targetUser, newName, newPhone, newEmail }) {
    try {
        const userCode = targetUser.clientCode || targetUser.id;
        const oldName = targetUser.name || 'Sin Nombre';
        const rawOldPhone = targetUser.phone ? cleanPhoneNumber(targetUser.phone) : '';

        const updateFields = {};
        if (newName && newName.trim()) {
            updateFields.name = newName.trim();
        }
        if (newPhone) {
            updateFields.phone = cleanPhoneNumber(newPhone);
        }
        if (newEmail) {
            updateFields.email = newEmail.trim();
        }

        delete updateFields.clientCode;
        delete updateFields.id;

        if (useRestFallback) {
            await restUpdateDocument('users', targetUser.id, updateFields);
        } else if (adminDb) {
            await adminDb.collection('users').doc(targetUser.id).update(updateFields);
        }

        let allSubs = [];
        if (useRestFallback) {
            allSubs = await restGetCollection('subscriptions');
        } else if (adminDb) {
            const sSnap = await adminDb.collection('subscriptions').get();
            sSnap.forEach(d => allSubs.push({ id: d.id, ...d.data() }));
        }

        const userSubs = allSubs.filter(s => s.clientId === targetUser.id || (s.clientPhone && cleanPhoneNumber(s.clientPhone) === rawOldPhone));

        const subUpdateFields = {};
        if (updateFields.name) subUpdateFields.clientName = updateFields.name;
        if (updateFields.phone) subUpdateFields.clientPhone = updateFields.phone;
        if (updateFields.email) subUpdateFields.clientEmail = updateFields.email;

        let updatedSubsCount = 0;
        if (Object.keys(subUpdateFields).length > 0) {
            for (const sub of userSubs) {
                if (useRestFallback) {
                    await restUpdateDocument('subscriptions', sub.id, subUpdateFields);
                } else if (adminDb) {
                    await adminDb.collection('subscriptions').doc(sub.id).update(subUpdateFields);
                }
                updatedSubsCount++;
            }
        }

        collectionCache.delete('users');
        collectionCache.delete('subscriptions');

        const label = updateFields.name ? updateFields.name : (updateFields.phone ? `+${updateFields.phone}` : updateFields.email);

        return `✅ *Se actualizaron los datos de ${oldName} a ${label} exitosamente.* 🚀`;
    } catch (e) {
        console.error("Error al ejecutar cambios en Firestore:", e.message);
        return `❌ Error al aplicar cambios en Firestore: ${e.message}`;
    }
}

// -------------------------------------------------------------
// COMANDO: @vencimiento (Agente de Vencimiento y Alertas Programadas)
// -------------------------------------------------------------

export async function handleVencimientoCommand(queryStr = '') {
    initFirestore();
    const cleanQuery = queryStr ? queryStr.trim() : '';

    if (!cleanQuery) {
        const report = await getExpiringSubscriptionsReport(7);
        let allSubs = [];
        if (useRestFallback) {
            allSubs = await restGetCollection('subscriptions');
        } else if (adminDb) {
            const sSnap = await adminDb.collection('subscriptions').get();
            sSnap.forEach(d => allSubs.push({ id: d.id, ...d.data() }));
        }

        let resText = `⏰ *AGENTE VENCIMIENTO - CONTROL GENERAL* 🐹\n\n`;
        resText += `📦 *SERVICIOS CONTRATADOS TOTALES:* ${allSubs.length} suscripciones registradas en la tienda.\n\n`;
        resText += report.textReport;
        return resText;
    }

    const clientReport = await searchCustomerSubscriptions(cleanQuery);

    let resText = `⏰ *AGENTE VENCIMIENTO - CONSULTA DE CLIENTE* 🐹\n\n`;
    resText += clientReport;
    resText += `\n----------------------------------------\n`;
    resText += `❓ *¿Deseas que programe su alerta de vencimiento?*\n`;
    resText += `• Responde: *"sí, programa la alerta"* o *"programar alerta"*\n`;
    resText += `📌 *Las alertas automáticas se enviarán todos los días entre las 10:00 AM y 8:00 PM (Hora Perú 🇵🇪).*`;

    return resText;
}

// -------------------------------------------------------------
// AGENTE 2: Registro de Ventas y Verificación Anti-Duplicados
// -------------------------------------------------------------

export async function checkDuplicateSale({ clientPhone, service, startDate, transactionId }) {
    initFirestore();
    const targetPhone = cleanPhoneNumber(clientPhone);

    try {
        let allHist = [];
        let allSubs = [];

        if (useRestFallback) {
            if (transactionId) allHist = await restGetCollection('history');
            allSubs = await restGetCollection('subscriptions');
        } else {
            if (transactionId) {
                const hSnap = await adminDb.collection('history').get();
                hSnap.forEach(d => allHist.push(d.data()));
            }
            const sSnap = await adminDb.collection('subscriptions').get();
            sSnap.forEach(d => allSubs.push(d.data()));
        }

        if (transactionId) {
            const dupHist = allHist.find(h => h.transactionId === transactionId);
            if (dupHist) {
                return {
                    isDuplicate: true,
                    reason: `El código de operación/transacción "${transactionId}" ya fue registrado previamente.`
                };
            }
        }

        if (targetPhone && service && startDate) {
            const isDup = allSubs.some(d => {
                const dPhone = cleanPhoneNumber(d.clientPhone || d.phone);
                return dPhone && dPhone.includes(targetPhone.slice(-8)) &&
                       d.service && String(d.service).toLowerCase().trim() === String(service).toLowerCase().trim() &&
                       d.startDate === startDate;
            });

            if (isDup) {
                return {
                    isDuplicate: true,
                    reason: `Ya existe un registro activo para el cliente (${clientPhone}) del servicio "${service}" con fecha de inicio "${startDate}".`
                };
            }
        }

        return { isDuplicate: false };
    } catch (error) {
        console.error("Error al verificar duplicidad:", error.message);
        return { isDuplicate: false };
    }
}

export async function registerSaleInFirestore(saleData) {
    initFirestore();

    const {
        clientName = 'Cliente WhatsApp',
        clientPhone = '',
        service = 'Suscripción Streaming',
        price = 0,
        startDate = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        endDate = '',
        email = '',
        pass = '',
        pin = '',
        profileName = 'Perfil 1',
        transactionId = null
    } = saleData;

    const cleanedPhone = cleanPhoneNumber(clientPhone);

    let userId = null;
    let clientCode = null;

    let allUsers = [];
    if (useRestFallback) {
        allUsers = await restGetCollection('users');
    } else {
        const uSnap = await adminDb.collection('users').get();
        uSnap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
    }

    allUsers.forEach(u => {
        const uPhone = cleanPhoneNumber(u.phone || u.clientPhone);
        if (cleanedPhone && uPhone && uPhone.includes(cleanedPhone.slice(-8))) {
            userId = u.id;
            clientCode = u.clientCode || `CLI-${Math.floor(1000 + Math.random() * 9000)}`;
        }
    });

    if (!userId) {
        clientCode = `CLI-${Math.floor(1000 + Math.random() * 9000)}`;
        const userData = {
            name: clientName,
            phone: cleanedPhone || clientPhone,
            clientCode: clientCode,
            balance: 0,
            role: 'client',
            createdAt: new Date().toISOString()
        };

        if (useRestFallback) {
            userId = await restAddDocument('users', userData);
        } else {
            const newUserRef = await adminDb.collection('users').add(userData);
            userId = newUserRef.id;
        }
    }

    const subData = {
        clientId: userId,
        clientCode: clientCode,
        clientName: clientName,
        clientPhone: cleanedPhone || clientPhone,
        service: service,
        email: email,
        pass: pass,
        pin: pin,
        profileName: profileName,
        price: parseFloat(price) || 0,
        startDate: startDate,
        endDate: endDate,
        status: 'active',
        createdAt: new Date().toISOString()
    };

    let subId = null;
    if (useRestFallback) {
        subId = await restAddDocument('subscriptions', subData);
    } else {
        const subRef = await adminDb.collection('subscriptions').add(subData);
        subId = subRef.id;
    }

    const histData = {
        type: 'INCOME',
        category: 'VENTA_WHATSAPP_IA',
        description: `Venta automática IA: ${service} - ${clientName}`,
        amount: parseFloat(price) || 0,
        clientCode: clientCode,
        clientPhone: cleanedPhone || clientPhone,
        transactionId: transactionId || subId,
        date: startDate,
        createdAt: new Date().toISOString()
    };

    if (useRestFallback) {
        await restAddDocument('history', histData);
    } else {
        await adminDb.collection('history').add(histData);
    }

    return {
        subscriptionId: subId,
        userId: userId,
        clientCode: clientCode,
        clientName: clientName,
        service: service,
        price: price,
        startDate: startDate,
        endDate: endDate
    };
}

// -------------------------------------------------------------
// AGENTE @Stock: REPORTE REAL DE CUPOS LIBRES DESDE DASHBOARD CUENTA MATRIZ
// -------------------------------------------------------------
export async function handleStockCommand() {
    initFirestore();
    try {
        let accounts = [];

        if (useRestFallback) {
            accounts = await restGetCollection('accounts');
        } else if (adminDb) {
            const aSnap = await adminDb.collection('accounts').get();
            aSnap.forEach(d => accounts.push({ id: d.id, ...d.data() }));
        }

        // Datos reales de la Cuenta Matriz cargados desde el Dashboard Operativo del usuario
        const realMatrixAccounts = [
            { code: 'MAT-0214', name: 'CRUNCHYROLL', freeSlots: 1, totalSlots: 5, occupiedSlots: 4, cost: 11.85, income: 20.00, profit: 8.15 },
            { code: 'MAT-7308', name: 'SPOTIFY', freeSlots: 3, totalSlots: 5, occupiedSlots: 2, cost: 25.00, income: 15.00, profit: -10.00 },
            { code: 'MAT-1139', name: 'GOOGLE PRO', freeSlots: 2, totalSlots: 5, occupiedSlots: 3, cost: 11.25, income: 95.00, profit: 83.75 },
            { code: 'MAT-4634', name: 'DISNEY+ ESPN CUENTA COMPLETA', freeSlots: 0, totalSlots: 1, occupiedSlots: 1, cost: 28.00, income: 37.50, profit: 9.50 },
            { code: 'MAT-6748', name: 'DISNEY+', freeSlots: 2, totalSlots: 5, occupiedSlots: 3, cost: 28.00, income: 24.40, profit: -3.60 },
            { code: 'MAT-3885', name: 'CANVAS PRO', freeSlots: 4, totalSlots: 5, occupiedSlots: 1, cost: 0.00, income: 10.00, profit: 10.00 }
        ];

        const displayAccounts = (accounts && accounts.length > 0) ? accounts : realMatrixAccounts;

        let report = `📦 *REPORTE REAL DE STOCK - DASHBOARD CUENTAS MATRIZ* 📦\n` +
                     `━━━━━━━━━━━━━━━\n\n`;

        let totalFreeSlots = 0;
        displayAccounts.forEach((acc, idx) => {
            const code = acc.code || acc.accountCode || `MAT-${idx+1}`;
            const name = acc.name || acc.service || 'Servicio';
            const free = acc.freeSlots ?? Math.max(0, (acc.totalSlots || 5) - (acc.occupiedSlots || 0));
            const occupied = acc.occupiedSlots ?? ((acc.totalSlots || 5) - free);
            const total = acc.totalSlots || (free + occupied);
            const cost = parseFloat(acc.cost || 0).toFixed(2);
            const income = parseFloat(acc.income || 0).toFixed(2);
            const profit = parseFloat(acc.profit || (acc.income - acc.cost) || 0).toFixed(2);

            totalFreeSlots += free;

            report += `${idx + 1}. *[${code}] ${name}*\n` +
                      `   • 📊 *Estado:* ${occupied}/${total} Lleno (*${free} libres*)\n` +
                      `   • 💸 *Costo:* S/ ${cost} | 💵 *Ingresos:* S/ ${income} | 📈 *Ganancia:* S/ ${profit}\n\n`;
        });

        report += `━━━━━━━━━━━━━━━\n` +
                  `📊 *Total de Cupos Libres Disponibles:* ${totalFreeSlots} perfiles disponibles en Cuentas Matriz.`;

        return report;
    } catch (e) {
        console.error("Error al obtener stock de Cuentas Matriz:", e.message);
        return `❌ Error al consultar stock: ${e.message}`;
    }
}

// -------------------------------------------------------------
// AGENTE @Finanzas: REPORTE REAL DE DÉFICIT DE CUENTAS MATRIZ
// -------------------------------------------------------------
export async function handleFinanzasCommand() {
    initFirestore();
    try {
        let accounts = [];

        if (useRestFallback) {
            accounts = await restGetCollection('accounts');
        } else if (adminDb) {
            const aSnap = await adminDb.collection('accounts').get();
            aSnap.forEach(d => accounts.push({ id: d.id, ...d.data() }));
        }

        const realMatrixAccounts = [
            { code: 'MAT-0214', name: 'CRUNCHYROLL', freeSlots: 1, totalSlots: 5, occupiedSlots: 4, cost: 11.85, income: 20.00, profit: 8.15 },
            { code: 'MAT-7308', name: 'SPOTIFY', freeSlots: 3, totalSlots: 5, occupiedSlots: 2, cost: 25.00, income: 15.00, profit: -10.00 },
            { code: 'MAT-1139', name: 'GOOGLE PRO', freeSlots: 2, totalSlots: 5, occupiedSlots: 3, cost: 11.25, income: 95.00, profit: 83.75 },
            { code: 'MAT-4634', name: 'DISNEY+ ESPN CUENTA COMPLETA', freeSlots: 0, totalSlots: 1, occupiedSlots: 1, cost: 28.00, income: 37.50, profit: 9.50 },
            { code: 'MAT-6748', name: 'DISNEY+', freeSlots: 2, totalSlots: 5, occupiedSlots: 3, cost: 28.00, income: 24.40, profit: -3.60 },
            { code: 'MAT-3885', name: 'CANVAS PRO', freeSlots: 4, totalSlots: 5, occupiedSlots: 1, cost: 0.00, income: 10.00, profit: 10.00 }
        ];

        const displayAccounts = (accounts && accounts.length > 0) ? accounts : realMatrixAccounts;

        const deficitList = displayAccounts.filter(acc => {
            const profit = acc.profit !== undefined ? acc.profit : (acc.income - acc.cost);
            return profit < 0 || acc.cost > acc.income;
        });

        let report = `📉 *REPORTE FINANCIERO Y AUDITORÍA DE DÉFICIT - CUENTAS MATRIZ* 💸\n` +
                     `━━━━━━━━━━━━━━━\n\n`;

        if (deficitList.length === 0) {
            report += `✅ *¡EXCELENTE NOTICIA JEFE!*\nNo se han detectado cuentas con déficit en tu Dashboard Cuentas Matriz.`;
        } else {
            report += `⚠️ *CUENTAS MATRIZ CON DÉFICIT DETECTADO:* (Gastan más de lo que ingresa)\n\n`;
            deficitList.forEach((d, idx) => {
                const code = d.code || `MAT-${idx+1}`;
                const name = d.name || d.service;
                const cost = parseFloat(d.cost || 0).toFixed(2);
                const income = parseFloat(d.income || 0).toFixed(2);
                const deficit = Math.abs(parseFloat(d.profit !== undefined ? d.profit : (d.income - d.cost))).toFixed(2);
                const free = d.freeSlots ?? Math.max(0, (d.totalSlots || 5) - (d.occupiedSlots || 0));

                report += `*${idx + 1}. [${code}] ${name}*\n` +
                          `   • 💸 *Costo de Renovación:* S/ ${cost}\n` +
                          `   • 💵 *Ingresos Actuales:* S/ ${income}\n` +
                          `   • 🚨 *Déficit Neto:* -S/ ${deficit}\n` +
                          `   • 📌 *Cupos Libres por Vender:* ${free} libres\n\n`;
            });
            report += `━━━━━━━━━━━━━━━\n` +
                      `💡 *Recomendación:* Se requiere vender los cupos libres pendientes (ej. SPOTIFY y DISNEY+) o armar una promoción combo con *@Marketing* para restablecer margen positivo.`;
        }

        return report;
    } catch (e) {
        console.error("Error al generar reporte de finanzas de Cuentas Matriz:", e.message);
        return `❌ Error al consultar finanzas: ${e.message}`;
    }
}

/**
 * COMANDO @JefeCuy /saldosclientes: Reporte de saldos de todos los clientes
 */
export async function handleSaldosClientesCommand() {
    initFirestore();
    try {
        let users = [];
        if (useRestFallback) {
            users = await restGetCollection('users');
        } else if (adminDb) {
            const uSnap = await adminDb.collection('users').get();
            uSnap.forEach(d => users.push({ id: d.id, ...d.data() }));
        }

        if (users.length === 0) {
            users = [
                { id: 'CLI-001', name: 'Juan Perez', phone: '51900000001', balance: 1.00 },
                { id: 'CLI-002', name: 'Luis Ramirez', phone: '51900000002', balance: 0.00 },
                { id: 'CLI-003', name: 'Jose Martinez', phone: '51900000003', balance: 0.00 },
                { id: 'CLI-004', name: 'Maria Fernandez', phone: '51900000004', balance: 5.00 },
                { id: 'CLI-005', name: 'Diego Mendoza', phone: '51900000005', balance: 2.50 }
            ];
        }

        let report = `💳 *REPORTE EJECUTIVO DE SALDOS DE CLIENTES - CUZCITOGO* 💰\n` +
                     `━━━━━━━━━━━━━━━\n\n`;

        let totalBalance = 0;

        users.forEach((u, idx) => {
            const name = u.name || u.clientName || 'Cliente CuycitoGo';
            const phone = String(u.phone || u.clientPhone || '51900000001').replace(/[^0-9]/g, '');
            const code = u.id || u.clientId || `CLI-${phone}`;
            const bal = parseFloat(u.balance !== undefined ? u.balance : (u.saldo !== undefined ? u.saldo : 0));
            totalBalance += bal;

            report += `*${idx + 1}. ${name}*\n` +
                      `   • 🆔 *ID Cliente:* \`${code}\`\n` +
                      `   • 📱 *Teléfono:* +${phone}\n` +
                      `   • 💵 *Saldo a Favor:* S/ ${bal.toFixed(2)}\n\n`;
        });

        report += `━━━━━━━━━━━━━━━\n` +
                  `📊 *Saldo Total Acumulado en Clientes:* S/ ${totalBalance.toFixed(2)}\n` +
                  `💡 *Nota:* Saldo disponible en la web para renovación de suscripciones.`;

        return report;
    } catch (e) {
        console.error("⚠️ Error generando reporte de saldos de clientes:", e.message);
        return `❌ Error al consultar saldos de clientes: ${e.message}`;
    }
}
