// =============================================================
// MÓDULO: cuentamatriz-service.js
// Agente @cuentamatriz y Wizard @cuentamatrizeditar para CuycitoGo
// =============================================================

import { initFirestore, useRestFallback, adminDb, restGetCollection } from './firestore-store-service.js';

// Memoria volátil de sesiones de edición para @cuentamatrizeditar
const matrixUpdateSessions = new Map();

// Cuentas Matriz de demostración (Plantilla para entorno de pruebas / Showcase)
let localMatrixAccounts = [
    { code: 'MAT-7308', service: 'SPOTIFY', email: 'spotify.demo@cuzcitogo.pe', pass: 'DemoSpot#2026', provider: 'Proveedor Demo 1', providerPhone: '+51900000001', endDate: '01/09/2026', totalSlots: 5, occupiedSlots: 2, cost: 25.00, income: 15.00 },
    { code: 'MAT-6748', service: 'DISNEY+', email: 'disney.demo@cuzcitogo.pe', pass: 'DemoDisney#2026', provider: 'Proveedor Demo 2', providerPhone: '+51900000002', endDate: '05/09/2026', totalSlots: 5, occupiedSlots: 3, cost: 28.00, income: 24.40 },
    { code: 'MAT-0214', service: 'CRUNCHYROLL', email: 'crunchyroll.demo@cuzcitogo.pe', pass: 'DemoCrunchy#2026', provider: 'Proveedor Demo 3', providerPhone: '+51900000003', endDate: '11/09/2026', totalSlots: 5, occupiedSlots: 4, cost: 11.85, income: 20.00 },
    { code: 'MAT-4634', service: 'DISNEY+ ESPN CUENTA COMPLETA', email: 'espn.demo@cuzcitogo.pe', pass: 'DemoEspn#2026', provider: 'Proveedor Demo 2', providerPhone: '+51900000002', endDate: '09/10/2026', totalSlots: 1, occupiedSlots: 1, cost: 28.00, income: 37.50 },
    { code: 'MAT-1139', service: 'GOOGLE PRO', email: 'googlepro.demo@cuzcitogo.pe', pass: 'DemoGpro#2026', provider: 'Proveedor Demo 4', providerPhone: '+51900000004', endDate: '08/02/2028', totalSlots: 5, occupiedSlots: 3, cost: 11.25, income: 95.00 },
    { code: 'MAT-3885', service: 'CANVAS PRO', email: 'canvas.demo@cuzcitogo.pe', pass: 'DemoCanvas#2026', provider: 'Proveedor Demo 5', providerPhone: '+51900000005', endDate: '14/08/2028', totalSlots: 5, occupiedSlots: 1, cost: 0.00, income: 10.00 }
];

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
 * Obtiene todas las Cuentas Matriz desde Firestore o fallback local.
 */
export async function getMatrixAccountsList() {
    initFirestore();
    try {
        let dbAccounts = [];
        if (useRestFallback) {
            dbAccounts = await restGetCollection('masterAccounts');
            if (!dbAccounts || dbAccounts.length === 0) {
                dbAccounts = await restGetCollection('accounts');
            }
        } else if (adminDb) {
            let snap = await adminDb.collection('masterAccounts').get();
            if (snap.empty) {
                snap = await adminDb.collection('accounts').get();
            }
            snap.forEach(d => dbAccounts.push({ id: d.id, ...d.data() }));
        }

        if (dbAccounts && dbAccounts.length > 0) {
            return dbAccounts.map(a => ({
                id: a.id,
                code: a.masterCode || a.code || a.id || 'MAT-0000',
                service: a.service || a.name || 'Servicio Streaming',
                email: a.email || a.user || a.username || 'Sin correo',
                pass: a.pass || a.password || a.clave || 'Sin contraseña',
                provider: a.provider || a.supplier || 'Sin proveedor',
                providerPhone: a.providerPhone || a.supplierPhone || 'Sin registrar',
                endDate: a.endDate || a.expirationDate || a.end_date || a.fechaFin || 'N/A',
                cost: parseFloat(a.cost || 0),
                income: parseFloat(a.income || 0),
                totalSlots: parseInt(a.totalSlots || a.slots || 5, 10),
                occupiedSlots: parseInt(a.occupiedSlots || 0, 10)
            }));
        }
    } catch (e) {
        console.error("⚠️ Error obteniendo cuentas matriz de DB, usando locales:", e.message);
    }
    return localMatrixAccounts;
}

/**
 * AGENTE @cuentamatriz: Genera el reporte de Cuentas Matriz ORDENADAS POR VENCIMIENTO.
 */
export async function handleCuentaMatrizReport() {
    const accounts = await getMatrixAccountsList();

    // Ordenar cronológicamente por fecha de vencimiento (más cercanas primero)
    accounts.sort((a, b) => parseDate(a.endDate) - parseDate(b.endDate));

    let report = `🔑 *REPORTE DE CUENTAS MATRIZ - ORDENADAS POR VENCIMIENTO* 🗓️\n` +
                 `━━━━━━━━━━━━━━━\n\n`;

    accounts.forEach((acc, idx) => {
        const daysLeft = getDaysRemaining(acc.endDate);
        let alertBadge = "🟢 (Vigente)";
        if (daysLeft < 0) alertBadge = "❌ (VENCIDA)";
        else if (daysLeft === 0) alertBadge = "🚨 (VENCE HOY)";
        else if (daysLeft <= 3) alertBadge = `⚠️ (VENCE EN ${daysLeft} DÍAS - ALERTA URGENTE)`;
        else if (daysLeft <= 7) alertBadge = `📌 (Vence en ${daysLeft} días)`;

        report += `${idx + 1}. *[${acc.code}] ${acc.service}* ${alertBadge}\n` +
                  `   • 📦 *Proveedor:* ${acc.provider}\n` +
                  `   • 📱 *Tel. Proveedor:* ${acc.providerPhone}\n` +
                  `   • ⏳ *Vencimiento:* ${acc.endDate} (*${daysLeft < 0 ? 'Vencida hace ' + Math.abs(daysLeft) : daysLeft + ' días restantes'}*)\n` +
                  `   • 📧 *Correo:* \`${acc.email}\`\n` +
                  `   • 🔑 *Contraseña:* \`${acc.pass}\`\n\n`;
    });

    report += `━━━━━━━━━━━━━━━\n` +
              `💡 *Nota:* Para actualizar el proveedor, teléfono, correo, clave o vencimiento de una cuenta, escribe *@cuentamatrizeditar*.`;

    return report;
}

/**
 * WIZARD INTERACTIVO @cuentamatrizeditar
 * Permite buscar una Cuenta Matriz y editar sus campos manteniendo su código MAT-XXXX.
 */
export function isUserInMatrixUpdateSession(senderNumber) {
    const cleanNum = (senderNumber || '').replace(/[^0-9]/g, '');
    return matrixUpdateSessions.has(cleanNum);
}

export async function handleInteractiveMatrixUpdate({ senderNumber, messageText }) {
    const cleanNum = (senderNumber || '').replace(/[^0-9]/g, '');
    const text = (messageText || '').trim();

    if (text.toLowerCase() === 'exit') {
        matrixUpdateSessions.delete(cleanNum);
        return `👋 Has salido del modo de edición de Cuentas Matriz (*@cuentamatrizeditar*).`;
    }

    let session = matrixUpdateSessions.get(cleanNum);

    // INICIO DEL WIZARD
    if (!session) {
        session = { step: 1, searchResults: [], selectedAccount: null, fieldToEdit: null, oldValue: null, newValue: null };
        matrixUpdateSessions.set(cleanNum, session);
        return `🎩 *@cuentamatrizeditar - ASISTENTE DE EDICIÓN DE CUENTA MATRIZ* ✏️\n` +
               `━━━━━━━━━━━━━━━\n\n` +
               `Escribe el **Nombre del Servicio** (ej. *Spotify*, *Disney*, *Crunchyroll*) o el **Código de la Cuenta Matriz** (ej. *MAT-7308*) que deseas actualizar:\n\n` +
               `*(Escribe EXIT en cualquier momento para cancelar)*`;
    }

    const accounts = await getMatrixAccountsList();

    // PASO 1: BÚSQUEDA DE CUENTA MATRIZ
    if (session.step === 1) {
        const query = text.toLowerCase();
        const matches = accounts.filter(a => 
            a.code.toLowerCase().includes(query) || 
            a.service.toLowerCase().includes(query) || 
            a.email.toLowerCase().includes(query) ||
            a.provider.toLowerCase().includes(query)
        );

        if (matches.length === 0) {
            return `❌ No se encontraron Cuentas Matriz coincidentes con "*${text}*".\n\nPor favor, intenta nuevamente escribiendo el nombre del servicio o código (ej: *MAT-7308* o *Spotify*):`;
        }

        session.searchResults = matches;
        session.step = 2;

        let reply = `🔍 *CUENTAS MATRIZ ENCONTRADAS (${matches.length}):*\n` +
                    `━━━━━━━━━━━━━━━\n\n`;

        matches.forEach((acc, idx) => {
            reply += `${idx + 1}. *[${acc.code}] ${acc.service}*\n` +
                     `   • Correo: \`${acc.email}\` | Proveedor: ${acc.provider} (${acc.providerPhone})\n\n`;
        });

        reply += `━━━━━━━━━━━━━━━\n` +
                 `Escribe el **número correspondiente (1 al ${matches.length})** de la Cuenta Matriz que deseas editar:`;

        return reply;
    }

    // PASO 2: SELECCIÓN DE CUENTA MATRIZ
    if (session.step === 2) {
        const selIdx = parseInt(text) - 1;
        if (isNaN(selIdx) || selIdx < 0 || selIdx >= session.searchResults.length) {
            return `⚠️ Opción inválida. Por favor escribe un número entre **1 y ${session.searchResults.length}**:`;
        }

        session.selectedAccount = session.searchResults[selIdx];
        session.step = 3;

        const acc = session.selectedAccount;
        return `📋 *DATOS ACTUALES DE [${acc.code}] ${acc.service}:*\n` +
               `━━━━━━━━━━━━━━━\n` +
               `1. Proveedor: *${acc.provider}*\n` +
               `2. Número del Proveedor: *${acc.providerPhone}*\n` +
               `3. Correo: *${acc.email}*\n` +
               `4. Contraseña: *${acc.pass}*\n` +
               `5. Fecha de Vencimiento: *${acc.endDate}*\n\n` +
               `━━━━━━━━━━━━━━━\n` +
               `¿Qué dato deseas actualizar?\n` +
               `Escribe el **dígito (1 al 5)** de la opción correspondiente:`;
    }

    // PASO 3: SELECCIÓN DE CAMPO A EDITAR
    if (session.step === 3) {
        const fieldOpt = parseInt(text);
        const fieldsMap = {
            1: { key: 'provider', label: 'Proveedor' },
            2: { key: 'providerPhone', label: 'Número del Proveedor' },
            3: { key: 'email', label: 'Correo' },
            4: { key: 'pass', label: 'Contraseña' },
            5: { key: 'endDate', label: 'Fecha de Vencimiento' }
        };

        if (!fieldsMap[fieldOpt]) {
            return `⚠️ Opción inválida. Por favor escribe un dígito del **1 al 5**:`;
        }

        session.fieldToEdit = fieldsMap[fieldOpt];
        session.oldValue = session.selectedAccount[fieldsMap[fieldOpt].key] || 'N/A';
        session.step = 4;

        return `✏️ ¿Por qué nuevo **${session.fieldToEdit.label}** se reemplazará? Escribe el valor a ingresar:`;
    }

    // PASO 4: CONFIRMACIÓN DE CAMBIO
    if (session.step === 4) {
        session.newValue = text;
        session.step = 5;

        return `⚠️ *CONFIRMACIÓN DE ACTUALIZACIÓN:*\n` +
               `━━━━━━━━━━━━━━━\n\n` +
               `Deseas cambiar el **${session.fieldToEdit.label}** de la Cuenta Matriz *[${session.selectedAccount.code}] ${session.selectedAccount.service}*:\n\n` +
               `👉 \`${session.oldValue}\` ➔ *${session.newValue}*\n\n` +
               `¿Confirmas los cambios?\n` +
               `1. Sí\n` +
               `2. No`;
    }

    // PASO 5: EJECUCIÓN DEL CAMBIO
    if (session.step === 5) {
        if (text === '1' || text.toLowerCase().includes('si') || text.toLowerCase().includes('sí')) {
            const accCode = session.selectedAccount.code;
            const fieldKey = session.fieldToEdit.key;
            const newVal = session.newValue;

            // Actualizar arreglo local
            const localTarget = localMatrixAccounts.find(a => a.code === accCode);
            if (localTarget) {
                localTarget[fieldKey] = newVal;
            }

            matrixUpdateSessions.delete(cleanNum);

            return `✅ *¡DATOS ACTUALIZADOS CON ÉXITO!* 🎉\n` +
                   `━━━━━━━━━━━━━━━\n\n` +
                   `Se actualizó el **${session.fieldToEdit.label}** de la Cuenta Matriz *[${accCode}]* a:\n` +
                   `👉 *${newVal}*\n\n` +
                   `El ID *${accCode}* se mantiene fijo. Para realizar otra actualización escribe *@cuentamatrizeditar*.`;
        } else {
            matrixUpdateSessions.delete(cleanNum);
            return `❌ Actualización cancelada. Los datos de la Cuenta Matriz *[${session.selectedAccount.code}]* no sufrieron cambios.`;
        }
    }
}

/**
 * MONITOR AUTOMÁTICO DE RECORDATORIOS CADA 4 HORAS (SI DÍAS RESTANTES <= 3)
 */
export function startMatrixExpirationNotifier() {
    console.log("⏰ [Notifier Matriz] Inicializando monitor de vencimientos de Cuentas Matriz (Notificaciones cada 4h cuando <= 3 días)...");

    // Verificar cada 4 horas (14,400,000 ms)
    setInterval(async () => {
        try {
            const accounts = await getMatrixAccountsList();
            const urgent = accounts.filter(a => {
                const days = getDaysRemaining(a.endDate);
                return days <= 3;
            });

            if (urgent.length > 0) {
                let alertText = `🚨 *ALERTA URGENTE DE VENCIMIENTO DE CUENTAS MATRIZ* 🚨\n` +
                                `━━━━━━━━━━━━━━━\n\n` +
                                `¡Atención Director **JefeCuycitoGo**! Las siguientes Cuentas Matriz vencen en menos de 3 días y requieren pago prioritario para evitar corte del servicio a clientes:\n\n`;

                urgent.forEach(a => {
                    const days = getDaysRemaining(a.endDate);
                    alertText += `• *[${a.code}] ${a.service}*\n` +
                                 `  • ⏳ *Vence:* ${a.endDate} (${days < 0 ? 'VENCIDA' : 'Quedan ' + days + ' días'})\n` +
                                 `  • 📱 *Proveedor:* ${a.provider} (${a.providerPhone})\n` +
                                 `  • 📧 *Correo:* \`${a.email}\`\n\n`;
                });

                alertText += `━━━━━━━━━━━━━━━\n` +
                             `💡 *Acción recomendada:* Contacta a los proveedores registrados para renovar el pago.`;

                // Notificar directamente al grupo "Alertas" de WhatsApp en puerto 5002
                try {
                    await fetch('http://localhost:5002/api/send-alert', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messageText: alertText })
                    });
                    console.log(`🔔 [Notifier Matriz] Alerta enviada exitosamente al grupo "Alertas" para ${urgent.length} cuentas en vencimiento.`);
                } catch (sendErr) {
                    console.error("⚠️ Error enviando notificación de matriz al grupo Alertas:", sendErr.message);
                }
            }
        } catch (e) {
            console.error("⚠️ Error en monitor de vencimiento de Cuentas Matriz:", e.message);
        }
    }, 4 * 60 * 60 * 1000);
}

/**
 * COMANDO /showme: Genera los 3 mensajes consecutivos requeridos para el grupo Alertas.
 */
export async function handleShowMeCommand() {
    initFirestore();
    const now = new Date();

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
    } catch (e) {
        console.error("⚠️ Error obteniendo datos de DB para /showme:", e.message);
    }

    if (allSubs.length === 0) {
        allSubs = [
            { clientName: 'Cliente Demo A', clientPhone: '51900000001', service: 'Crunchyroll Fan', endDate: '28/08/2026', status: 'expired' },
            { clientName: 'Cliente Demo B', clientPhone: '51900000002', service: 'Crunchyroll Fan', endDate: '01/09/2026', status: 'active' },
            { clientName: 'Cliente Demo C', clientPhone: '51900000003', service: 'Spotify Individual', endDate: '25/09/2026', status: 'active' },
            { clientName: 'Cliente Demo D', clientPhone: '51900000004', service: 'Spotify Individual', endDate: '30/09/2026', status: 'active' },
            { clientName: 'Cliente Demo E', clientPhone: '51900000005', service: 'Disney+', endDate: '05/09/2026', status: 'active' }
        ];
    }

    const userMap = {};
    allUsers.forEach(u => { userMap[u.id] = u; });

    const toRenew = [];
    const notRenewed = [];

    allSubs.forEach(sub => {
        const u = userMap[sub.userId || sub.clientId] || {};
        const clientName = sub.clientName || u.name || 'Cliente CuycitoGo';
        const clientPhone = sub.clientPhone || u.phone || 'Sin número';
        const service = sub.service || sub.serviceName || 'Servicio Streaming';

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

        const item = { clientName, clientPhone, service, endDate: sub.endDate || 'N/A', daysLeft };

        if (sub.status === 'expired' || sub.status === 'inactive' || (daysLeft !== null && daysLeft < 0)) {
            notRenewed.push(item);
        } else if (daysLeft !== null && daysLeft <= 7) {
            toRenew.push(item);
        }
    });

    // M1: CLIENTES Y SERVICIOS A RENOVAR
    let msg1 = `📌 *MENSAJE 1/3: CLIENTES Y SERVICIOS A RENOVAR* ⏳\n` +
               `━━━━━━━━━━━━━━━\n\n`;
    if (toRenew.length === 0) {
        msg1 += `✅ *No hay servicios de clientes por vencer en los próximos 7 días.*`;
    } else {
        toRenew.forEach((c, i) => {
            const daysText = c.daysLeft === 0 ? "Vence HOY 🚨" : `Quedan ${c.daysLeft} días`;
            msg1 += `${i + 1}. *${c.clientName}* (+${c.clientPhone.replace(/[^0-9]/g, '')})\n` +
                    `   • 📺 *Servicio:* ${c.service}\n` +
                    `   • ⏳ *Vencimiento:* ${c.endDate} (*${daysText}*)\n\n`;
        });
        msg1 += `━━━━━━━━━━━━━━━\n💬 *Acción:* Notificar al cliente para gestionar su pago de renovación.`;
    }

    // M2: PERSONAS QUE NO RENOVARON Y SUS SERVICIOS
    let msg2 = `❌ *MENSAJE 2/3: PERSONAS QUE NO RENOVARON Y SUS SERVICIOS* 🚫\n` +
               `━━━━━━━━━━━━━━━\n\n`;
    if (notRenewed.length === 0) {
        msg2 += `✅ *No hay registros de clientes sin renovar recientemente.*`;
    } else {
        notRenewed.forEach((c, i) => {
            const agoText = c.daysLeft !== null ? `Vencido hace ${Math.abs(c.daysLeft)} días` : "Vencido";
            msg2 += `${i + 1}. *${c.clientName}* (+${c.clientPhone.replace(/[^0-9]/g, '')})\n` +
                    `   • 📺 *Servicio Anterior:* ${c.service}\n` +
                    `   • 📅 *Fecha de Vencimiento:* ${c.endDate} (*${agoText}*)\n\n`;
        });
        msg2 += `━━━━━━━━━━━━━━━\n💡 *Acción:* Liberar perfiles en Cuenta Matriz o enviar oferta de reactivación.`;
    }

    // M3: CUENTAS MATRICES A PUNTO DE VENCER
    const matrixAccounts = await getMatrixAccountsList();
    matrixAccounts.sort((a, b) => parseDate(a.endDate) - parseDate(b.endDate));

    const urgentMatrix = matrixAccounts.filter(a => {
        const days = getDaysRemaining(a.endDate);
        return days <= 7;
    });

    let msg3 = `🔑 *MENSAJE 3/3: CUENTAS MATRICES A PUNTO DE VENCER* ⚠️\n` +
               `━━━━━━━━━━━━━━━\n\n`;
    if (urgentMatrix.length === 0) {
        msg3 += `✅ *Todas tus Cuentas Matriz tienen más de 7 días de vigencia.*`;
    } else {
        urgentMatrix.forEach((a, i) => {
            const days = getDaysRemaining(a.endDate);
            let badge = days <= 3 ? "🚨 ALERTA URGENTE" : "📌 Próximo Vencimiento";
            msg3 += `${i + 1}. *[${a.code}] ${a.service}* (${badge})\n` +
                    `   • ⏳ *Vencimiento:* ${a.endDate} (*${days < 0 ? 'VENCIDA' : 'Quedan ' + days + ' días'}*)\n` +
                    `   • 📦 *Proveedor:* ${a.provider} (${a.providerPhone})\n` +
                    `   • 📧 *Correo:* \`${a.email}\`\n\n`;
        });
        msg3 += `━━━━━━━━━━━━━━━\n💳 *Acción:* Transferir al proveedor correspondiente para renovar la cuenta matriz.`;
    }

    return [msg1, msg2, msg3];
}
