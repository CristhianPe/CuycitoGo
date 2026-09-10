/**
 * actualizacion-cuentamatriz-service.js
 * Módulo para el comando @atencionalcliente /act
 * Permite al Director actualizar credenciales (correo, contraseña, ciclo)
 * de una Cuenta Matriz y notificar masivamente a los clientes asignados.
 */

import {
  initFirestore,
  useRestFallback,
  adminDb,
  restGetCollection,
  restUpdateDocument,
  cleanPhoneNumber
} from './firestore-store-service.js';

import { getMatrixAccountsList } from './cuentamatriz-service.js';

// Sesiones de actualización activas (key: senderPhone -> sessionData)
const actSessions = new Map();

/**
 * Verifica si el usuario está en una sesión de /act
 */
export function isUserInActSession(senderPhone) {
  const clean = cleanPhoneNumber(senderPhone);
  return actSessions.has(clean);
}

/**
 * Inicia la sesión de @atencionalcliente /act
 */
export function startActSession(senderPhone) {
  const clean = cleanPhoneNumber(senderPhone);
  actSessions.set(clean, {
    step: 'SELECT_TYPE',
    selectedType: null,
    keyword: null,
    matchingAccounts: [],
    selectedAccount: null,
    newEmail: null,
    newPass: null,
    isSameCycle: true,
    newStartDate: null,
    newEndDate: null
  });

  return `🔄 *AGENTE @Atencionalcliente - PANEL DE ACTUALIZACIÓN (/act)* 🛠️\n` +
         `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
         `¡Hola Jefe! Selecciona el tipo de instrucción que deseas ejecutar:\n\n` +
         `1️⃣ *1* ➔ *Actualización de Credenciales (Correo y Contraseña) de Cuenta Matriz*\n` +
         `   _(Actualiza la base de datos web y notifica por WhatsApp a todos los clientes asignados)_\n\n` +
         `2️⃣ *2* ➔ *Difusión de Ofertas y Promociones*\n` +
         `   _(Próximamente disponible)_\n\n` +
         `👉 *Responde con el número de opción (1 o 2)* o escribe *cancelar* para salir.`;
}

/**
 * Procesa el paso a paso conversacional de /act
 */
export async function handleActStep(senderPhone, textMessage, sendMsgCallback) {
  const clean = cleanPhoneNumber(senderPhone);
  const session = actSessions.get(clean);
  if (!session) return null;

  const t = textMessage.trim();

  // Opción de cancelar
  if (t.toLowerCase() === 'cancelar' || t.toLowerCase() === 'salir') {
    actSessions.delete(clean);
    return `❌ *Sesión de actualización (/act) cancelada.* No se realizaron cambios.`;
  }

  // PASO 1: SELECCIONAR TIPO DE INSTRUCCIÓN
  if (session.step === 'SELECT_TYPE') {
    if (t === '1' || t.toLowerCase().includes('credencial') || t.toLowerCase().includes('cuenta')) {
      session.selectedType = 'CREDENTIALS_UPDATE';
      session.step = 'SEARCH_KEYWORD';

      return `✍️ *ACTUALIZACIÓN DE CUENTA MATRIZ*\n` +
             `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
             `Por favor escribe el servicio o palabra clave de la Cuenta Matriz que deseas actualizar:\n` +
             `_(Ejemplos: *HBO, Netflix, Disney, Crunchyroll, Spotify, Canva, Google, Paramount, Prime*...)_`;
    }

    if (t === '2' || t.toLowerCase().includes('oferta')) {
      actSessions.delete(clean);
      return `📢 *MÓDULO DE OFERTAS*: Esta función estará disponible en la siguiente actualización. ¡Mantente al tanto! ✨`;
    }

    return `⚠️ Opción no válida. Por favor responde *1* (Actualizar credenciales) o *2* (Ofertas).`;
  }

  // PASO 2: BÚSQUEDA DE CUENTA MATRIZ POR PALABRA CLAVE
  if (session.step === 'SEARCH_KEYWORD') {
    const keyword = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    session.keyword = keyword;

    const allAccounts = await getMatrixAccountsList();
    const matches = allAccounts.filter(acc => {
      const s = (acc.service || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const c = (acc.code || '').toLowerCase();
      const e = (acc.email || '').toLowerCase();
      return s.includes(keyword) || c.includes(keyword) || e.includes(keyword);
    });

    if (matches.length === 0) {
      return `🔍 No encontré ninguna Cuenta Matriz con la palabra *"${t}"*.\n\n` +
             `Por favor escribe otra palabra clave (ej: *Netflix, Disney, HBO, Spotify*) o escribe *cancelar*.`;
    }

    session.matchingAccounts = matches;

    if (matches.length === 1) {
      session.selectedAccount = matches[0];
      session.step = 'CONFIRM_MATRIX';

      const acc = matches[0];
      return `📋 *CUENTA MATRIZ ENCONTRADA:*\n` +
             `━━━━━━━━━━━━━━━━━━━━━\n` +
             `🏷️ *Código:* \`${acc.code}\`\n` +
             `🍿 *Servicio:* ${acc.service}\n` +
             `📧 *Correo Actual:* \`${acc.email}\`\n` +
             `🔑 *Clave Actual:* \`${acc.pass}\`\n` +
             `⏳ *Vencimiento:* ${acc.endDate}\n` +
             `━━━━━━━━━━━━━━━━━━━━━\n` +
             `¿Deseas actualizar esta cuenta matriz?\n\n` +
             `1️⃣ *1* ➔ *Sí, es esta cuenta*\n` +
             `2️⃣ *2* ➔ *No, buscar otra*`;
    }

    // Múltiples cuentas matrices encontradas
    session.step = 'SELECT_FROM_LIST';
    let listMsg = `🔍 *SE ENCONTRARON ${matches.length} CUENTAS MATRICES PARA "${t.toUpperCase()}":*\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    matches.forEach((acc, idx) => {
      listMsg += `*${idx + 1}️⃣ [${acc.code}] ${acc.service}*\n` +
                 `   • 📧 Correo: \`${acc.email}\`\n` +
                 `   • ⏳ Vence: ${acc.endDate}\n\n`;
    });

    listMsg += `👉 *Escribe el número de la opción (1 al ${matches.length})* para seleccionar la cuenta correcta.`;
    return listMsg;
  }

  // PASO 2.5: SELECCIÓN DE LISTA MULTIPLE
  if (session.step === 'SELECT_FROM_LIST') {
    const idx = parseInt(t) - 1;
    if (isNaN(idx) || idx < 0 || idx >= session.matchingAccounts.length) {
      return `⚠️ Opción no válida. Por favor escribe un número del 1 al ${session.matchingAccounts.length}.`;
    }

    session.selectedAccount = session.matchingAccounts[idx];
    session.step = 'CONFIRM_MATRIX';

    const acc = session.selectedAccount;
    return `📋 *CUENTA MATRIZ SELECCIONADA:*\n` +
           `━━━━━━━━━━━━━━━━━━━━━\n` +
           `🏷️ *Código:* \`${acc.code}\`\n` +
           `🍿 *Servicio:* ${acc.service}\n` +
           `📧 *Correo Actual:* \`${acc.email}\`\n` +
           `🔑 *Clave Actual:* \`${acc.pass}\`\n` +
           `⏳ *Vencimiento:* ${acc.endDate}\n` +
           `━━━━━━━━━━━━━━━━━━━━━\n` +
           `¿Confirmas que deseas actualizar esta cuenta matriz?\n\n` +
           `1️⃣ *1* ➔ *Sí, continuar*\n` +
           `2️⃣ *2* ➔ *No, volver a la lista*`;
  }

  // PASO 3: CONFIRMACIÓN DE CUENTA SELECCIONADA
  if (session.step === 'CONFIRM_MATRIX') {
    if (t === '1' || t.toLowerCase().includes('si') || t.toLowerCase().includes('sí')) {
      session.step = 'INPUT_CREDENTIALS';
      return `🔑 *INGRESO DE NUEVAS CREDENCIALES*\n` +
             `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
             `Escribe el **Nuevo Correo** y la **Nueva Contraseña** para la cuenta *[${session.selectedAccount.code}]*:\n\n` +
             `👉 _Puedes enviarlo en un solo mensaje (ej: "nuevo@correo.com Clave2026#") o en 2 mensajes separados._`;
    }

    if (t === '2' || t.toLowerCase().includes('no')) {
      session.step = 'SEARCH_KEYWORD';
      return `✍️ Escribe nuevamente la palabra clave del servicio para buscar:`;
    }

    return `⚠️ Por favor responde *1* (Sí) o *2* (No).`;
  }

  // PASO 4: PARSEO DE CORREO Y CONTRASEÑA
  if (session.step === 'INPUT_CREDENTIALS') {
    const parsed = parseEmailAndPass(t);

    if (parsed.email && parsed.pass) {
      session.newEmail = parsed.email;
      session.newPass = parsed.pass;
      session.step = 'CONFIRM_CREDENTIALS';

      return `📋 *VERIFICACIÓN DE CREDENCIALES EXTRAÍDAS:*\n` +
             `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
             `📧 *Nuevo Correo:* \`${session.newEmail}\`\n` +
             `🔑 *Nueva Contraseña:* \`${session.newPass}\`\n` +
             `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
             `¿Están correctos estos datos?\n\n` +
             `1️⃣ *1* ➔ *Sí, continuar al ciclo de facturación*\n` +
             `2️⃣ *2* ➔ *No, volver a escribir*`;
    }

    // Si solo envió el correo
    if (parsed.email && !parsed.pass) {
      session.newEmail = parsed.email;
      session.step = 'INPUT_ONLY_PASS';
      return `✅ Correo registrado: \`${session.newEmail}\`\n\n👉 Ahora escribe la **Nueva Contraseña**:`;
    }

    return `⚠️ No logré identificar un correo y contraseña válidos en tu mensaje.\n\n` +
           `Por favor envíalo así:\n*correo@ejemplo.com TuContraseña123*`;
  }

  // PASO 4.5: INGRESO SOLO DE CONTRASEÑA (SI ENVIÓ EN 2 MENSAJES)
  if (session.step === 'INPUT_ONLY_PASS') {
    session.newPass = t;
    session.step = 'CONFIRM_CREDENTIALS';

    return `📋 *VERIFICACIÓN DE CREDENCIALES EXTRAÍDAS:*\n` +
           `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
           `📧 *Nuevo Correo:* \`${session.newEmail}\`\n` +
           `🔑 *Nueva Contraseña:* \`${session.newPass}\`\n` +
           `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
           `¿Están correctos estos datos?\n\n` +
           `1️⃣ *1* ➔ *Sí, continuar al ciclo de facturación*\n` +
           `2️⃣ *2* ➔ *No, volver a escribir*`;
  }

  // PASO 5: CONFIRMACIÓN DE CREDENCIALES
  if (session.step === 'CONFIRM_CREDENTIALS') {
    if (t === '1' || t.toLowerCase().includes('si') || t.toLowerCase().includes('sí')) {
      session.step = 'CHECK_BILLING_CYCLE';

      return `📅 *VERIFICACIÓN DEL CICLO DE FACTURACIÓN*\n` +
             `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
             `La fecha de vencimiento actual de esta cuenta es: *${session.selectedAccount.endDate}*.\n\n` +
             `¿Sigue manteniendo el **mismo ciclo de facturación** o cambió la fecha de inicio?\n\n` +
             `1️⃣ *1* ➔ *Sí, mantener misma fecha de vencimiento*\n` +
             `2️⃣ *2* ➔ *No, cambió (ingresar nueva fecha de inicio)*`;
    }

    if (t === '2' || t.toLowerCase().includes('no')) {
      session.step = 'INPUT_CREDENTIALS';
      return `✍️ Escribe nuevamente el correo y la contraseña:`;
    }

    return `⚠️ Por favor responde *1* (Sí) o *2* (No).`;
  }

  // PASO 6: VERIFICACIÓN DEL CICLO DE FACTURACIÓN
  if (session.step === 'CHECK_BILLING_CYCLE') {
    if (t === '1' || t.toLowerCase().includes('si') || t.toLowerCase().includes('sí')) {
      session.isSameCycle = true;
      session.newEndDate = session.selectedAccount.endDate;
      return await executeMatrixUpdateAndBroadcast(session, clean, sendMsgCallback);
    }

    if (t === '2' || t.toLowerCase().includes('no')) {
      session.isSameCycle = false;
      session.step = 'INPUT_START_DATE';

      return `📅 *NUEVA FECHA DE INICIO*\n` +
             `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
             `Por favor escribe la **fecha de inicio** en formato día/mes/año (ej: *02/09/2026* o *2/9/2026*):\n\n` +
             `_(El sistema calculará automáticamente la fecha de culminación sumándole **+30 días**)._`;
    }

    return `⚠️ Por favor responde *1* (Mismo ciclo) o *2* (Cambió fecha).`;
  }

  // PASO 7: INGRESO DE FECHA DE INICIO Y CÁLCULO DE +30 DÍAS
  if (session.step === 'INPUT_START_DATE') {
    const parts = t.split('/');
    if (parts.length !== 3) {
      return `⚠️ Formato de fecha incorrecto. Debe ser día/mes/año (ejemplo: *15/09/2026*). Intenta nuevamente:`;
    }

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year) || day < 1 || day > 31 || month < 1 || month > 12) {
      return `⚠️ Fecha no válida. Por favor escribe una fecha real (ejemplo: *02/09/2026*):`;
    }

    const startDateStr = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    const calculatedEndDate = add30Days(startDateStr);

    session.newStartDate = startDateStr;
    session.newEndDate = calculatedEndDate;

    return await executeMatrixUpdateAndBroadcast(session, clean, sendMsgCallback);
  }

  return null;
}

/**
 * Ejecuta la actualización en Firestore y el envío masivo por WhatsApp a los clientes
 */
async function executeMatrixUpdateAndBroadcast(session, directorPhone, sendMsgCallback) {
  const acc = session.selectedAccount;
  const newEmail = session.newEmail;
  const newPass = session.newPass;
  const newEndDate = session.newEndDate || acc.endDate;

  initFirestore();

  // 1. Actualizar en Firestore (accounts collection)
  try {
    const updateObj = {
      email: newEmail,
      pass: newPass,
      endDate: newEndDate,
      updatedAt: new Date().toISOString()
    };

    if (useRestFallback) {
      await restUpdateDocument('accounts', acc.code || acc.id, updateObj);
    } else if (adminDb) {
      await adminDb.collection('accounts').doc(acc.code || acc.id).set(updateObj, { merge: true });
    }
    console.log(`✅ [Actualización Matriz] Cuenta ${acc.code} actualizada en Firestore con éxito.`);
  } catch (dbErr) {
    console.error("⚠️ Error actualizando cuenta matriz en DB:", dbErr.message);
  }

  // 2. Buscar clientes asignados a esta cuenta matriz / servicio en Firestore
  let assignedClients = [];
  try {
    let allSubs = [];
    if (useRestFallback) {
      allSubs = await restGetCollection('subscriptions');
    } else if (adminDb) {
      const snap = await adminDb.collection('subscriptions').get();
      snap.forEach(d => allSubs.push({ id: d.id, ...d.data() }));
    }

    const accCodeClean = (acc.code || '').toLowerCase();
    const serviceClean = (acc.service || '').toLowerCase();

    assignedClients = allSubs.filter(sub => {
      const subAcc = (sub.accountId || sub.matrixCode || '').toLowerCase();
      const subServ = (sub.service || '').toLowerCase();
      return (subAcc && subAcc === accCodeClean) || (subServ && serviceClean.includes(subServ));
    });
  } catch (err) {
    console.error("⚠️ Error buscando clientes asignados:", err.message);
  }

  // 3. Notificar masivamente por WhatsApp a los clientes asignados
  let notifiedCount = 0;
  if (sendMsgCallback && assignedClients.length > 0) {
    for (const clientSub of assignedClients) {
      const phone = cleanPhoneNumber(clientSub.clientPhone || clientSub.phone);
      if (phone) {
        const clientJid = `${phone}@s.whatsapp.net`;
        const clientName = clientSub.clientName || clientSub.name || 'Estimado Cliente';

        const clientNotice = `📢 *ACTUALIZACIÓN DE CREDENCIALES - CUYCITOGO* 🍿\n` +
                             `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                             `Hola *${clientName}*, te informamos que por mantenimiento y seguridad se han actualizado las credenciales de acceso a tu servicio de *${acc.service}*:\n\n` +
                             `📧 *Nuevo Correo:* \`${newEmail}\`\n` +
                             `🔑 *Nueva Contraseña:* \`${newPass}\`\n\n` +
                             `🔒 *Importante:* _Recuerda ingresar únicamente a tu perfil asignado y no modificar la contraseña de la cuenta para mantener tu garantía activa._\n` +
                             `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                             `¡Gracias por tu preferencia con *CuycitoGo*! Ante cualquier duda estamos a tu servicio. 🙌✨`;

        try {
          await sendMsgCallback(clientJid, clientNotice);
          notifiedCount++;
          await new Promise(r => setTimeout(r, 600)); // pausa cordial antispam
        } catch (msgErr) {
          console.error(`Error enviando notificación a ${phone}:`, msgErr.message);
        }
      }
    }
  }

  actSessions.delete(directorPhone);

  // 4. Reporte final de cierre al Director
  let finalReport = `🎉 *ACTUALIZACIÓN DE CUENTA MATRIZ COMPLETADA CON ÉXITO* ✅\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🏷️ *Cuenta Matriz:* [${acc.code}] ${acc.service}\n` +
                    `📧 *Nuevo Correo Guardado:* \`${newEmail}\`\n` +
                    `🔑 *Nueva Contraseña:* \`${newPass}\`\n` +
                    `⏳ *Fecha de Vencimiento:* *${newEndDate}* ${session.newStartDate ? '(+30 días)' : '(Mismo ciclo)'}\n` +
                    `🌐 *Base de Datos Web:* Sincronizada en tiempo real con el Dashboard.\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `📲 *Difusión Masiva:* Se enviaron notificaciones a *${notifiedCount} cliente(s) asignados* por WhatsApp. 🚀`;

  return finalReport;
}

/**
 * Parsea correo y contraseña de un texto
 */
function parseEmailAndPass(text) {
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const match = text.match(emailRegex);
  const email = match ? match[1] : null;

  let pass = null;
  if (email) {
    let remaining = text.replace(email, '').trim();
    remaining = remaining.replace(/(pass|password|clave|contrasena|contraseña|pwd)\s*[:=-]?\s*/gi, '').trim();
    if (remaining) {
      pass = remaining.split(/\s+/)[0];
    }
  }

  return { email, pass };
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