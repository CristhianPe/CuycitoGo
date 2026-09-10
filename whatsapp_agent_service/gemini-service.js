import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

// Inicialización de cliente Gemini AI
function getGenAIClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("⚠️ GEMINI_API_KEY no está configurada en las variables de entorno (.env).");
    }
    return new GoogleGenAI({ apiKey });
}

// -------------------------------------------------------------
// AGENTE 1: Clasificación de Intención y Generación de Respuestas
// -------------------------------------------------------------

/**
 * Clasifica si el mensaje es de la Tienda (STORE_INQUIRY) o Personal/Familiar (PERSONAL_OTHER)
 */
export async function classifyMessageIntent(messageText) {
    if (!messageText || typeof messageText !== 'string') {
        return { category: 'PERSONAL_OTHER' };
    }

    try {
        const ai = getGenAIClient();
        const prompt = `Eres un filtro de intención estricto para un número de WhatsApp de una tienda de streaming llamada CuycitoGO.
Analiza el siguiente mensaje enviado por un usuario y determina si está relacionado con la TIENDA o si es un MENSAJE PERSONAL / FAMILIAR / AJENO.

MENSAJES DE TIENDA (STORE_INQUIRY):
- Preguntas sobre precios, catálogo, productos o cuentas de streaming (Netflix, Disney+, Max, etc.).
- Preguntas sobre vencimiento de su suscripción ("cuánto falta que venza mi suscripción", "cuándo vence mi cuenta").
- Consultas sobre métodos de pago, recargas o soporte de servicio.

MENSAJES PERSONALES / FAMILIARES / CASUALES (PERSONAL_OTHER):
- Saludos informales entre amigos/familiares ("Hola primo cómo estás", "Qué haces bro", "Vamos a jugar fútbol").
- Pláticas sobre temas personales, memes, noticias o asuntos no comerciales.

MENSAJE DEL USUARIO: "${messageText}"

Responde ÚNICAMENTE con un JSON válido exactamente con este formato sin texto adicional:
{"category": "STORE_INQUIRY"} o {"category": "PERSONAL_OTHER"}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });

        const textRes = response.text || '';
        const parsed = JSON.parse(textRes.trim());
        return parsed;
    } catch (error) {
        console.error("❌ Error en clasificador de intención Gemini:", error.message);
        // Por seguridad, si falla el modelo y contiene palabras clave de la tienda, asumir STORE_INQUIRY
        const lower = messageText.toLowerCase();
        const storeKeywords = ['precio', 'vence', 'suscripcion', 'cuenta', 'netflx', 'disney', 'hbo', 'max', 'cuanto', 'catalogo', 'comprar', 'renovar'];
        const isStore = storeKeywords.some(kw => lower.includes(kw));
        return { category: isStore ? 'STORE_INQUIRY' : 'PERSONAL_OTHER' };
    }
}

/**
 * Genera una respuesta amigable al cliente con información del catálogo y sus suscripciones reales
 */
export async function generateStoreResponse(messageText, customerSubscriptions = [], catalogItems = [], phoneNumber = '') {
    try {
        const ai = getGenAIClient();

        const cleanPhone = (phoneNumber || '').replace(/[^0-9]/g, '');

        const subsInfo = customerSubscriptions.length > 0
            ? customerSubscriptions.map(s => `- Servicio: ${s.service} | Vence: ${s.endDate} (en ${s.daysLeft !== null ? s.daysLeft + ' días' : 'N/A'}) | Estado: ${s.status}`).join('\n')
            : "No se encontraron suscripciones activas registradas para tu número de WhatsApp.";

        const catalogInfo = catalogItems.map(c => `- ${c.title}: S/ ${c.price}`).join('\n');

        const prompt = `Eres el Asistente Virtual Oficial de la Tienda VIP CuycitoGo.
Atiende de forma cordial, amable, clara y profesional por WhatsApp.

NÚMERO VERIFICADO DEL CLIENTE ACTUAL: +${cleanPhone}

DATOS DE SUSCRIPCIONES DEL CLIENTE ACTUAL:
${subsInfo}

CATÁLOGO ACTUAL DE LA TIENDA:
${catalogInfo}

MENSAJE DEL CLIENTE: "${messageText}"

REGLAS ABSOLUTAS DE SEGURIDAD Y PRIVACIDAD:
1. El usuario que te escribe está autenticado ÚNICAMENTE por su número de WhatsApp (+${cleanPhone}).
2. Solo puedes brindarle información sobre SUS PROPIAS suscripciones y el catálogo general de la tienda.
3. NUNCA reveles ni busques información, contraseñas, saldos o datos pertenecientes a OTROS clientes o números diferentes al del usuario (+${cleanPhone}).
4. Si el cliente pregunta por otra persona o intenta solicitar datos de otro número, responde educadamente que por políticas de privacidad y seguridad de CuycitoGo solo puedes brindarle información de su propia cuenta.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt
        });

        return response.text;
    } catch (error) {
        console.error("❌ Error al generar respuesta de tienda:", error.message);
        return "Hola! 👋 Gracias por escribir a CuycitoGo. En este momento estamos procesando tu solicitud. Por favor consulta por tus propios servicios o por nuestro catálogo de streaming.";
    }
}

// -------------------------------------------------------------
// AGENTE 2: Extractor Multimodal de Registro de Ventas (Texto/Imágenes)
// -------------------------------------------------------------

/**
 * Procesa un texto o imagen (comprobante Yape/Plin/Lemon/Banco) y extrae los datos estructurados para la suscripción
 */
export async function parseSaleDataWithGemini({ text = '', imageBase64 = null, mimeType = 'image/jpeg' }) {
    try {
        const ai = getGenAIClient();

        const instructions = `Eres un extractor experto de datos contables y de ventas de streaming para la tienda CuycitoGO.
Tu tarea es analizar la captura de pantalla del comprobante de pago (Yape, Plin, Lemon Cash, BCP, BBVA, Interbank) o el mensaje de texto enviado por el administrador y extraer los datos requeridos.

FECHA DE HOY: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}

REGLAS DE EXTRACCIÓN:
1. "clientName": Nombre del cliente. Si no figura en el comprobante ni en el texto, usa "Cliente WhatsApp".
2. "clientPhone": Teléfono del cliente. Si está presente, extrae solo dígitos. Si no está en el comprobante, déjalo en "".
3. "service": Nombre del servicio/plataforma (ej: Netflix HD, Disney+ Premium, Max 1 Pantalla, Spotify, YouTube).
4. "price": Monto pagado en números decimales (ej: 15.00, 10.50).
5. "startDate": Fecha de inicio en formato DD/MM/AAAA. (Si no se especifica, usa la fecha de hoy).
6. "endDate": Fecha de vencimiento en formato DD/MM/AAAA. (Si se contrata 1 mes, suma 30 días a startDate).
7. "email": Correo de la cuenta asignada si se menciona en el texto.
8. "pass": Contraseña si se menciona.
9. "pin": PIN del perfil si se menciona.
10. "profileName": Nombre o número de perfil asignado.
11. "transactionId": Código de operación / número de referencia del pago (ej: 098123, TRX-12345).

Responde ÚNICAMENTE con un objeto JSON estricto con la siguiente estructura (sin formato markdown alrededor):
{
  "clientName": "string",
  "clientPhone": "string",
  "service": "string",
  "price": number,
  "startDate": "DD/MM/AAAA",
  "endDate": "DD/MM/AAAA",
  "email": "string",
  "pass": "string",
  "pin": "string",
  "profileName": "string",
  "transactionId": "string"
}`;

        let contents = [];

        if (imageBase64) {
            contents = [
                {
                    inlineData: {
                        data: imageBase64,
                        mimeType: mimeType
                    }
                },
                { text: `${instructions}\n\nTexto adicional adjunto por el admin: "${text}"` }
            ];
        } else {
            contents = [`${instructions}\n\nMensaje enviado por el admin: "${text}"`];
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: contents,
            config: {
                responseMimeType: 'application/json'
            }
        });

        const rawText = (response.text || '{}').trim();
        const parsed = JSON.parse(rawText);
        return parsed;
    } catch (error) {
        console.error("❌ Error en parser multimodal Gemini Vision:", error.message);
        throw new Error("No se pudo interpretar el comprobante o mensaje de venta: " + error.message);
    }
}

// -------------------------------------------------------------
// AGENTE DIRECTOR JEFE CUYCITO: Conversación Libre con Inteligencia Gemini 3.6
// -------------------------------------------------------------

export async function processJefeCuycitoAI(messageText, businessContext = {}) {
    try {
        const ai = getGenAIClient();

        const prompt = `Eres "JefeCuycito" 🎩🐹, el Director General Virtual y Asistente Ejecutivo de Inteligencia Artificial de la empresa CuycitoGO.
Hablas directamente con el Dueño/Jefe de la empresa por WhatsApp.

TU PERSONALIDAD:
- Eres sumamente inteligente, analítico, servicial, profesional y conversacional.
- NO te limitas a comandos fijos ni respuestas prefabricadas. Entiendes cualquier pregunta, sugerencia, estrategia de ventas o consulta técnica.
- Respondes en español fluido, claro y directo.

CONTEXTO ACTUAL DEL NEGOCIO (FIREBASE FIRESTORE):
${JSON.stringify(businessContext, null, 2)}

PREGUNTA / MENSAJE DEL JEFE: "${messageText}"

INSTRUCCIONES DE ACCIÓN:
1. Si el Jefe usa la orden "@actualizardatacliente [nombre_o_codigo]" o pide actualizar/editar datos de un cliente (ej: "@actualizardatacliente Cristopher", "actualizar numero a 987654321", "cambiar nombre de Juan a Juan Perez"), retorna action: "UPDATE_CUSTOMER", colocando en "targetQuery" el cliente buscado/código, en "newName" el nuevo nombre (si se indicó) y en "newPhone" el nuevo teléfono (si se indicó).
2. Si el Jefe pregunta por un cliente específico (ej: "¿El cliente Luis tiene servicios por vencer?", "Servicios de Juan", "cuentas de Pedro", "buscar cliente 991735344"), debes retornar action: "SEARCH_CUSTOMER" y el nombre/teléfono del cliente en "customerQuery".
3. Si el Jefe te pide crear o configurar un nuevo agente/grupo (ej: "crea un grupo llamado Developer", "configura el agente de Cobranzas"), debes retornar action: "CREATE_GROUP" y extractar el "groupName".
4. Si el Jefe te pide ver los vencimientos generales o reporte global de cuentas por vencer, retorna action: "EXPIRING_REPORT".
5. Si el Jefe hace cualquier otra pregunta libre (estrategias, consejos de venta, cómo va el negocio, ayuda general), responde como un Asistente Ejecutivo de Alto Nivel con la respuesta en "replyText" y action: "CHAT".

Responde ÚNICAMENTE en formato JSON estricto:
{
  "action": "CHAT" | "CREATE_GROUP" | "EXPIRING_REPORT" | "SEARCH_CUSTOMER" | "UPDATE_CUSTOMER",
  "groupName": "string_opcional_si_es_create_group",
  "customerQuery": "nombre_o_telefono_del_cliente_buscado",
  "targetQuery": "cliente_a_editar_codigo_o_nombre",
  "newName": "nuevo_nombre_si_aplica",
  "newPhone": "nuevo_telefono_si_aplica",
  "replyText": "Respuesta conversacional completa para el Jefe"
}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });

        const textRes = (response.text || '{}').trim();
        return JSON.parse(textRes);
    } catch (error) {
        console.error("❌ Error en IA JefeCuycito:", error.message);
        return {
            action: "CHAT",
            replyText: `🎩 *JEFE CUYCITO*: Entendido Jefe. He recibido tu mensaje "${messageText}". ¿En qué área o métrica deseas que nos enfoquemos hoy?`
        };
    }
}
