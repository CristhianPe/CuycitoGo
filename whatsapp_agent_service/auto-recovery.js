// =============================================================
// MÓDULO DE AUTORRECUPERACIÓN Y AUTO-RESUMEN: auto-recovery.js
// Reinicia automáticamente los servicios si detecta caídas o bugs
// =============================================================

import http from 'http';
import { exec } from 'child_process';

const CHECK_INTERVAL_MS = 30000; // Revisar cada 30 segundos
const HEALTH_URL = 'http://localhost:5001/health';

function checkHealth() {
    http.get(HEALTH_URL, (res) => {
        if (res.statusCode !== 200) {
            console.warn(`⚠️ [Watchdog] Estado anómalo detectado (${res.statusCode}). Reiniciando servidor...`);
            restartServices();
        }
    }).on('error', (err) => {
        console.error(`🚨 [Watchdog] Servidor caído o no responde: ${err.message}. Reiniciando en PM2...`);
        restartServices();
    });
}

function restartServices() {
    exec('pm2 restart cuycito-server', (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Error ejecutando PM2 restart: ${error.message}`);
            return;
        }
        console.log(`✅ [Watchdog] Servidor reactivado exitosamente por autorrecuperación.`);
    });
}

// Iniciar monitoreo continuo
setInterval(checkHealth, CHECK_INTERVAL_MS);
console.log("🛡️ [Watchdog CuycitoGo] Sistema de Autorrecuperación Anti-Caídas activado.");
