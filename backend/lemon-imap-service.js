import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { config } from './config.js';
import { RechargeController } from './recharge-controller.js';

export class LemonImapService {
    constructor() {
        this.isRunning = false;
        this.timer = null;
    }

    /**
     * Inicia el proceso de monitoreo continuo de la bandeja de entrada IMAP.
     */
    async start() {
        if (!config.imap.user || !config.imap.password) {
            console.warn("⚠️ [IMAP Lemon] Faltan configurar IMAP_USER o IMAP_APP_PASSWORD en el archivo .env.");
            console.warn("   El servicio IMAP no iniciará la escucha automática hasta que se completen las credenciales.");
            return;
        }

        this.isRunning = true;
        console.log(`🚀 [IMAP Lemon] Iniciando servicio de lectura de correos Lemon Cash...`);
        console.log(`   Host: ${config.imap.host}:${config.imap.port} | Usuario: ${config.imap.user}`);
        console.log(`   Intervalo de sondeo: ${config.imap.pollIntervalMs / 1000}s`);

        // Ejecutar primera verificación inmediata
        await this.checkInbox();

        // Configurar ciclo continuo de sondeo
        this.timer = setInterval(async () => {
            if (this.isRunning) {
                await this.checkInbox();
            }
        }, config.imap.pollIntervalMs);
    }

    /**
     * Detiene el servicio de escucha.
     */
    stop() {
        this.isRunning = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        console.log("🛑 [IMAP Lemon] Servicio de lectura IMAP detenido.");
    }

    /**
     * Conecta a la bandeja de entrada, busca correos no leídos de Lemon Cash y los procesa.
     */
    async checkInbox() {
        let connection = null;
        try {
            const imapConfig = {
                imap: {
                    user: config.imap.user,
                    password: config.imap.password,
                    host: config.imap.host,
                    port: config.imap.port,
                    tls: config.imap.tls,
                    authTimeout: 10000,
                    tlsOptions: { rejectUnauthorized: false }
                }
            };

            connection = await imaps.connect(imapConfig);
            await connection.openBox('INBOX');

            // Buscar correos de los últimos 2 días para garantizar que no se pierda ninguno
            const delayDays = 2;
            const searchDate = new Date();
            searchDate.setDate(searchDate.getDate() - delayDays);
            const searchCriteria = [
                ['SINCE', searchDate]
            ];

            const fetchOptions = {
                bodies: ['HEADER', 'TEXT', ''],
                markSeen: false
            };

            const messages = await connection.search(searchCriteria, fetchOptions);
            // console.log(`📬 [IMAP Lemon] Mensajes encontrados en INBOX: ${messages.length}`);

            for (const item of messages) {
                try {
                    const all = item.parts.find(p => p.which === '');
                    const id = item.attributes.uid;
                    const messageIdHeader = item.parts.find(p => p.which === 'HEADER')?.body?.['message-id']?.[0] || `uid_${id}`;

                    if (!all || !all.body) continue;

                    // Parsear el contenido completo del correo
                    const parsed = await simpleParser(all.body);
                    const senderEmail = (parsed.from?.value?.[0]?.address || '').toLowerCase();
                    const senderName = parsed.from?.value?.[0]?.name || '';
                    const subject = parsed.subject || '';
                    const bodyText = parsed.text || '';
                    const bodyHtml = parsed.html || '';

                    // 1. Filtrar remitente: ¿Pertenece al dominio oficial de Lemon Cash?
                    const isLemonSender = config.imap.allowedSenders.some(allowed => 
                        senderEmail.includes(allowed) || 
                        senderName.toLowerCase().includes('lemon') || 
                        subject.toLowerCase().includes('lemon')
                    );

                    if (!isLemonSender) {
                        continue; // No es un correo de Lemon Cash, ignorar
                    }

                    console.log(`🍋 [Correo Lemon Detectado] De: ${senderEmail} | Asunto: "${subject}" | UID: ${id}`);

                    // 2. Extraer datos con el analizador robusto de expresiones regulares
                    const extraction = this.parseLemonEmailContent(bodyText, bodyHtml, subject);

                    if (extraction && extraction.amount) {
                        console.log(`💎 [Datos Extraídos] Monto: $${extraction.amount} | Ref: ${extraction.reference || 'N/A'} | De: ${extraction.sender || 'N/A'}`);

                        // 3. Procesar acreditación y conciliación
                        const result = await RechargeController.processLemonTransfer({
                            amount: extraction.amount,
                            sender: extraction.sender || senderName || senderEmail,
                            reference: extraction.reference,
                            date: parsed.date || new Date(),
                            emailMessageId: messageIdHeader,
                            rawSnippet: bodyText.substring(0, 300)
                        });

                        if (result.success) {
                            console.log(`✅ [Procesado y Conciliado] Correo UID ${id} acreditado exitosamente.`);
                            // Marcar correo como leído / visto en IMAP
                            await connection.addFlags(id, '\\Seen');
                        }
                    }
                } catch (msgErr) {
                    console.error("⚠️ [Error procesando correo individual]:", msgErr.message);
                }
            }

        } catch (error) {
            console.error("❌ [Error en Conexión IMAP]:", error.message);
        } finally {
            if (connection) {
                try {
                    await connection.end();
                } catch (e) {}
            }
        }
    }

    /**
     * Analizador de correo para extraer el monto exacto con céntimos y los datos de la transferencia.
     * @param {string} text - Texto plano del correo
     * @param {string} html - HTML del correo
     * @param {string} subject - Asunto del correo
     */
    parseLemonEmailContent(text, html, subject) {
        const cleanSubj = subject || '';
        
        // 1. Ignorar transferencias salientes (ej. "Enviaste S/ 11.27 💸")
        if (/^enviaste\b/i.test(cleanSubj.trim()) || /has enviado/i.test(text)) {
            // console.log(`⏩ [Ignorado: Transferencia Saliente] Asunto: "${cleanSubj}"`);
            return null;
        }

        const fullContent = `${cleanSubj}\n${text}\n${(html || '').replace(/<[^>]*>?/gm, ' ')}`;

        let amount = null;
        let reference = null;
        let sender = null;

        // =========================================================================
        // REGEX 1: Extracción de Monto (ej. Recibiste S/ 7, Recibiste S/ 10.43, Recibiste $10.43)
        // =========================================================================
        const amountPatterns = [
            // "Recibiste S/ 10.43" o "Recibiste S/ 10" o "Recibiste $10.43"
            /(?:recibiste|te transfirieron|ingresaron|transferencia recibida|recibido)\s*(?:de)?\s*[:]?\s*(?:[$sS/|ARS|USD|USDT]+)?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i,
            
            // "Monto: $10.42" o "Importe: S/ 10.42"
            /(?:monto|importe|total|dinero recibido)\s*[:]?\s*(?:[$sS/|ARS|USD|USDT]+)?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i,
            
            // "$ 10.42 de @usuario" o "S/ 10.42 de..."
            /(?:[$sS/|ARS|USD])\s*([0-9]+(?:[.,][0-9]{1,2})?)\s*(?:de|desde|por)/i,

            // Patrón genérico con símbolo de moneda
            /(?:[$|USD|ARS|USDT]|S\/)\s*([0-9]+(?:[.,][0-9]{1,2})?)/i
        ];

        for (const pattern of amountPatterns) {
            const match = fullContent.match(pattern);
            if (match && match[1]) {
                const rawNum = match[1].replace(',', '.');
                const parsed = parseFloat(rawNum);
                if (parsed > 0) {
                    amount = parseFloat(parsed.toFixed(2));
                    break;
                }
            }
        }

        // =========================================================================
        // REGEX 2: Extracción de Referencia o ID de Operación
        // =========================================================================
        const refPatterns = [
            /(?:id de operaci[oó]n|operaci[oó]n|referencia|comprobante|c[oó]digo|transacci[oó]n)\s*[:#]?\s*([a-zA-Z0-9_-]{6,40})/i,
            /#([a-zA-Z0-9_-]{8,30})/
        ];

        for (const pattern of refPatterns) {
            const match = fullContent.match(pattern);
            if (match && match[1]) {
                reference = match[1].trim();
                break;
            }
        }

        // =========================================================================
        // REGEX 3: Extracción de Remitente ($lemontag o Nombre)
        // =========================================================================
        const senderPatterns = [
            /(?:de|desde|usuario|titular)\s*[:]?\s*(\$[a-zA-Z0-9_.-]+|[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{3,30})/i,
            /(\$[a-zA-Z0-9_.-]{3,25})\s*(?:te envi[oó]|te transfiri[oó])/i
        ];

        for (const pattern of senderPatterns) {
            const match = fullContent.match(pattern);
            if (match && match[1]) {
                sender = match[1].trim();
                break;
            }
        }

        return {
            amount,
            reference: reference || null,
            sender: sender || null
        };
    }
}

export const lemonImapService = new LemonImapService();
