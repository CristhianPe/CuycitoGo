import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    clientUrls: (process.env.CLIENT_URL || 'http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000').split(','),

    // IMAP Configuration
    imap: {
        host: process.env.IMAP_HOST || 'imap.gmail.com',
        port: parseInt(process.env.IMAP_PORT, 10) || 993,
        tls: process.env.IMAP_TLS !== 'false',
        user: process.env.IMAP_USER || '',
        password: process.env.IMAP_APP_PASSWORD || '',
        pollIntervalMs: parseInt(process.env.IMAP_POLL_INTERVAL_MS, 10) || 15000,
        allowedSenders: (process.env.LEMON_ALLOWED_SENDERS || 'no-reply@lemon.me,notificaciones@lemoncash.com,lemon.me,lemoncash.io').split(',').map(s => s.trim().toLowerCase())
    },

    // Lemon Cash Merchant Data
    lemon: {
        tag: process.env.LEMON_TAG || '$cuycitogo',
        cvu: process.env.LEMON_CVU || '0000123400005678901234',
        alias: process.env.LEMON_ALIAS || 'cuycitogo.lemon',
        holder: process.env.LEMON_ACCOUNT_HOLDER || 'CuycitoGO Streaming VIP'
    },

    // Order Expiration in Minutes
    expirationMinutes: parseInt(process.env.RECHARGE_EXPIRATION_MINUTES, 10) || 30,

    // Firebase Service Account
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json'
};
