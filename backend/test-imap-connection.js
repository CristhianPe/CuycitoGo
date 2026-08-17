import imaps from 'imap-simple';
import { config } from './config.js';

async function testConnection() {
    console.log("🔍 Probando conexión IMAP con Gmail...");
    console.log(`   Host: ${config.imap.host}:${config.imap.port}`);
    console.log(`   Usuario: ${config.imap.user}`);

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

        const connection = await imaps.connect(imapConfig);
        await connection.openBox('INBOX');
        console.log("✅ ¡CONEXIÓN EXITOSA CON GMAIL!");
        console.log("   La bandeja de entrada (INBOX) está lista para escuchar transferencias de Lemon Cash.");
        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error de autenticación IMAP:", error.message);
        process.exit(1);
    }
}

testConnection();
