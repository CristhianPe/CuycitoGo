// =============================================================
// MÓDULO DE SEGURIDAD: security-crypto.js
// Cifrado y Descifrado Simétrico AES-256-GCM
// =============================================================

import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const ALGORITHM = 'aes-256-gcm';
const SECRET_RAW = process.env.ENCRYPTION_KEY || 'cuycitogo_super_secret_master_key_2026_x789';
const SECRET_KEY = crypto.scryptSync(SECRET_RAW, 'cuycitogo_salt_2026', 32);

/**
 * Cifra un texto plano utilizando AES-256-GCM.
 * Si ya está cifrado o es nulo, lo retorna tal cual.
 */
export function encryptText(plainText) {
    if (!plainText || typeof plainText !== 'string') return plainText;
    if (plainText.startsWith('enc_v1:')) return plainText; // Ya cifrado

    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
        let encrypted = cipher.update(plainText, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        return `enc_v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (e) {
        console.error("⚠️ Error cifrando texto:", e.message);
        return plainText;
    }
}

/**
 * Descifra un texto cifrado con enc_v1:IV:TAG:ENCRYPTED
 * Si no está cifrado, retorna el texto original.
 */
export function decryptText(cipherText) {
    if (!cipherText || typeof cipherText !== 'string' || !cipherText.startsWith('enc_v1:')) {
        return cipherText;
    }

    try {
        const parts = cipherText.split(':');
        if (parts.length !== 4) return cipherText;

        const [, ivHex, authTagHex, encryptedHex] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        console.error("⚠️ Error descifrando texto:", e.message);
        return cipherText;
    }
}
