# 🧩 Guía de Configuración en Activepieces (Integración WhatsApp + Agentes IA)

Esta guía explica paso a paso cómo conectar **Activepieces** (tu alternativa a n8n) con el servicio de agentes IA de WhatsApp (`whatsapp_agent_service`) y tu proveedor de WhatsApp (ejemplo: Evolution API, Baileys, WPPConnect o Meta WhatsApp Cloud API).

---

## 🚀 Requisitos Previos

1. **Iniciar el Servicio de Agentes**:
   Navega a la carpeta `whatsapp_agent_service` en tu consola o ejecuta:
   ```bash
   cd whatsapp_agent_service
   npm install
   npm start
   ```
   El servicio arrancará en el puerto `5001` (o el puerto configurado en `.env`).

2. **Probar el Healthcheck**:
   Abre en tu navegador o Postman:
   `GET http://localhost:5001/health`

---

## 📱 FLUJO 1: AGENTE 1 - Atención al Cliente & Filtro de Mensajes de Tienda

Este flujo intercepta todos los mensajes de los clientes de WhatsApp, los filtra (para no responder a familiares ni temas ajenos) y responde únicamente dudas relativas a tu catálogo o vencimiento de suscripciones.

### Configuración del Flujo en Activepieces:

1. **Trigger (Disparador)**: `Catch Webhook` o Conector de WhatsApp (ej. *Evolution API / WhatsApp Message Received*).
   - Captura los campos:
     - `phoneNumber` (Número de teléfono del remitente).
     - `messageText` (Texto del mensaje).

2. **Paso 2 (HTTP Request - Enviar al Agente 1)**:
   - **Method**: `POST`
   - **URL**: `http://localhost:5001/api/agent/customer-support` *(O la URL pública/ngrok de tu servidor)*
   - **Headers**: `Content-Type: application/json`
   - **Body (JSON)**:
     ```json
     {
       "phoneNumber": "{{ trigger.payload.from }}",
       "messageText": "{{ trigger.payload.body }}"
     }
     ```

3. **Paso 3 (Condicional / Branching)**:
   - **Condición**: `{{ step_2.body.shouldReply }}` EQUALS `true`
   - **Si es FALSE**: Terminar flujo (El mensaje es de un familiar o asunto personal y el bot lo ignora automáticamente).
   - **Si es TRUE**: Continuar al Paso 4.

4. **Paso 4 (Enviar Respuesta por WhatsApp)**:
   - Utiliza la pieza/conector de WhatsApp en Activepieces (*Send Text Message*).
   - **Recipient**: `{{ trigger.payload.from }}`
   - **Message**: `{{ step_2.body.replyText }}`

---

## 🛍️ FLUJO 2: AGENTE 2 - Chat Privado de Registro de Ventas por WhatsApp

Este flujo te permite a ti (como Administrador) enviar fotos de comprobantes de pago (Yape/Plin/Banco/Lemon) o textos con los detalles de una venta al WhatsApp del Bot para que la IA extraiga los campos, valide duplicados y registre todo directamente en tu **Firebase Firestore**.

### Configuración del Flujo en Activepieces:

1. **Trigger (Disparador)**: `Catch Webhook` o Conector de WhatsApp para tu chat de administración.
   - Captura:
     - `adminPhone` (Tu número de teléfono).
     - `text` (Texto del mensaje).
     - `mediaUrl` o `imageBase64` (Si enviaste una foto/comprobante).

2. **Paso 2 (HTTP Request - Enviar al Agente 2)**:
   - **Method**: `POST`
   - **URL**: `http://localhost:5001/api/agent/register-sale`
   - **Headers**: `Content-Type: application/json`
   - **Body (JSON)**:
     ```json
     {
       "adminPhone": "{{ trigger.payload.from }}",
       "text": "{{ trigger.payload.body }}",
       "imageBase64": "{{ trigger.payload.image_base64 }}",
       "mimeType": "image/jpeg"
     }
     ```

3. **Paso 3 (Enviar Confirmación por WhatsApp al Admin)**:
   - Utiliza la pieza de WhatsApp (*Send Text Message*).
   - **Recipient**: `{{ trigger.payload.from }}`
   - **Message**: `{{ step_2.body.replyText }}`

---

## 🔒 Ventajas de esta Arquitectura

- ✅ **Cero riesgo para tu proyecto base**: No modifica ningún archivo del proyecto principal CuycitoGO V5.0.
- ✅ **Anti-Duplicados garantizado**: Verifica antes de insertar si la transacción o suscripción ya existe.
- ✅ **Multimodal**: Procesa capturas de pantalla de pagos con Gemini Vision.
- ✅ **Aislado y Escalable**: Si deseas apagar o modificar los agentes, tu tienda y dashboard seguirán funcionando al 100%.
