/**
 * voucher-ocr-service.js
 * Módulo de validación de comprobantes y vouchers con Gemini Vision.
 * 
 * Regla de Oro:
 * - Valida PRINCIPALMENTE por los DECIMALES EXACTOS (ej: S/ 15.24)
 * - Valida la similitud del nombre del remitente con el cliente.
 * - NO depende del número de operación (compatible con Yape -> LemonCash).
 */

import { GoogleGenAI } from '@google/genai';
import { cleanPhoneNumber } from './firestore-store-service.js';
import { activePaymentTickets } from './atencion-cliente-agent-service.js';
import dotenv from 'dotenv';
dotenv.config();

function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no configurada.");
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Analiza un voucher/comprobante de pago con Gemini Vision y extrae datos clave.
 */
export async function analyzeVoucherWithGemini(imageBuffer, mimeType = 'image/jpeg') {
  try {
    const ai = getGenAIClient();
    const base64Data = imageBuffer.toString('base64');

    const prompt = `Eres un auditor bancario experto en comprobantes de transferencias peruanas e internacionales (Yape, Plin, LemonCash, BCP, Interbank, BBVA, etc.).
Analiza esta imagen y determina con alta precisión si es un comprobante de pago/transferencia.
Extrae los datos en formato JSON estricto:
{
  "isVoucher": true/false,
  "amount": número decimal con centavos (ejemplo: 15.24, 10.37, 6.18, 19.42),
  "senderName": "nombre completo o parcial del remitente o titular que realizó el pago",
  "receiverName": "nombre del destinatario si figura",
  "app": "Yape / Plin / LemonCash / BCP / Interbank / etc",
  "dateStr": "fecha y hora que figura en el comprobante",
  "confidence": "HIGH / MEDIUM / LOW"
}
Si la imagen no es un comprobante de pago, coloca "isVoucher": false.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType
          }
        },
        prompt
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const resText = response.text || '{}';
    return JSON.parse(resText.trim());
  } catch (error) {
    console.error("⚠️ Error analizando voucher con Gemini Vision:", error.message);
    return { isVoucher: false, error: error.message };
  }
}

/**
 * Comprueba si el voucher coincide con el ticket activo del cliente.
 */
export function verifyVoucherAgainstTicket(voucherData, clientPhone, clientName = '') {
  const cleanPhone = cleanPhoneNumber(clientPhone);
  const ticket = activePaymentTickets.get(cleanPhone);

  if (!ticket || ticket.status !== 'PENDING') {
    return {
      matched: false,
      reason: 'NO_ACTIVE_TICKET',
      message: 'No se encontró un ticket de pago pendiente para este número.'
    };
  }

  if (!voucherData || !voucherData.isVoucher) {
    return {
      matched: false,
      reason: 'NOT_A_VOUCHER',
      message: 'La imagen enviada no parece ser un comprobante de transferencia bancaria válido.'
    };
  }

  const voucherAmount = parseFloat(voucherData.amount || 0);
  const ticketAmount = parseFloat(ticket.amount || 0);

  // 1. Verificación de los DECIMALES EXACTOS (tolerancia máxima de 0.01 por redondeo)
  const amountDiff = Math.abs(voucherAmount - ticketAmount);
  const isAmountMatch = amountDiff < 0.05;

  if (!isAmountMatch) {
    return {
      matched: false,
      reason: 'AMOUNT_MISMATCH',
      voucherAmount,
      ticketAmount,
      message: `El monto del comprobante (S/ ${voucherAmount.toFixed(2)}) no coincide con el total exacto del ticket (S/ ${ticketAmount.toFixed(2)}).`
    };
  }

  // 2. Verificación de similitud de nombre
  let nameMatchScore = 'MEDIUM';
  if (voucherData.senderName && clientName) {
    const vName = voucherData.senderName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cName = clientName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const parts = cName.split(' ');
    const hasNameWord = parts.some(p => p.length > 2 && vName.includes(p));
    if (hasNameWord) nameMatchScore = 'HIGH';
  }

  return {
    matched: true,
    ticket,
    voucherData,
    nameMatchScore,
    serviceName: ticket.serviceName,
    serviceKey: ticket.serviceKey,
    amount: ticket.amount
  };
}