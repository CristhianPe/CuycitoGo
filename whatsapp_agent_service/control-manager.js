/**
 * control-manager.js
 * Servidor del Panel de Control Dinámico de CuycitoGo.
 * Permite:
 * 1. Encender y Apagar el servidor y bot con 1 solo clic.
 * 2. Generar el Código de Vinculación de 8 dígitos para WhatsApp.
 * 3. Ver logs y estado en tiempo real.
 */

import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5005;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public_manager')));

let apiProcess = null;
let whatsappProcess = null;
let logs = [];

function addLog(source, text) {
  const timestamp = new Date().toLocaleTimeString();
  const line = `[${timestamp}] [${source}] ${text.trim()}`;
  logs.push(line);
  if (logs.length > 500) logs.shift();
  console.log(line);
}

// Iniciar procesos
function startServices(pairingPhone = null) {
  if (apiProcess || whatsappProcess) {
    return { success: false, message: 'Los servicios ya están encendidos.' };
  }

  addLog('MANAGER', '🟢 Encendiendo Servidor API de CuycitoGo...');
  apiProcess = spawn('node', ['agent-server.js'], {
    cwd: __dirname,
    shell: true
  });

  apiProcess.stdout.on('data', data => addLog('API', data.toString()));
  apiProcess.stderr.on('data', data => addLog('API-ERR', data.toString()));
  apiProcess.on('close', code => {
    addLog('API', `Servidor API detenido (código ${code})`);
    apiProcess = null;
  });

  const env = { ...process.env };
  if (pairingPhone) {
    env.PHONE_NUMBER = pairingPhone.replace(/[^0-9]/g, '');
    env.USE_PAIRING_CODE = 'true';
  }

  addLog('MANAGER', '🟢 Encendiendo Pasarela WhatsApp Baileys...');
  whatsappProcess = spawn('node', ['whatsapp-bridge.js'], {
    cwd: __dirname,
    shell: true,
    env
  });

  whatsappProcess.stdout.on('data', data => addLog('WHATSAPP', data.toString()));
  whatsappProcess.stderr.on('data', data => addLog('WHATSAPP-ERR', data.toString()));
  whatsappProcess.on('close', code => {
    addLog('WHATSAPP', `Pasarela WhatsApp detenida (código ${code})`);
    whatsappProcess = null;
  });

  return { success: true, message: 'Servicios iniciados correctamente.' };
}

// Detener procesos
function stopServices() {
  addLog('MANAGER', '🔴 Apagando todos los servicios...');

  if (apiProcess) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', apiProcess.pid, '/f', '/t']);
      } else {
        apiProcess.kill('SIGTERM');
      }
    } catch (e) {}
    apiProcess = null;
  }

  if (whatsappProcess) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', whatsappProcess.pid, '/f', '/t']);
      } else {
        whatsappProcess.kill('SIGTERM');
      }
    } catch (e) {}
    whatsappProcess = null;
  }

  return { success: true, message: 'Todos los servicios han sido detenidos.' };
}

// Endpoints
app.get('/api/status', async (req, res) => {
  let pairingCode = null;
  const pairingFile = path.join(__dirname, 'pairing_code.txt');
  if (fs.existsSync(pairingFile)) {
    try {
      pairingCode = fs.readFileSync(pairingFile, 'utf8').trim();
    } catch (e) {}
  }

  let bridgeStatus = { connected: false, user: null };
  let bridgeLatency = null;
  const startBridge = Date.now();
  try {
    const bRes = await fetch('http://localhost:5002/api/status');
    bridgeStatus = await bRes.json();
    bridgeLatency = `${Date.now() - startBridge}ms`;
  } catch (e) {}

  let apiStatus = { online: false };
  let apiLatency = null;
  const startApi = Date.now();
  try {
    const aRes = await fetch('http://localhost:5001/api/store/catalog');
    if (aRes.ok) {
      apiStatus.online = true;
      apiLatency = `${Date.now() - startApi}ms`;
    }
  } catch (e) {}

  res.json({
    isRunning: Boolean(apiProcess || whatsappProcess),
    apiOnline: Boolean(apiProcess) && apiStatus.online,
    apiProcessRunning: Boolean(apiProcess),
    apiLatency,
    whatsappProcessRunning: Boolean(whatsappProcess),
    whatsappConnected: bridgeStatus.connected || false,
    whatsappUser: bridgeStatus.user || null,
    whatsappLatency: bridgeLatency,
    pairingCode: pairingCode || bridgeStatus.pairingCode || null,
    logs: logs.slice(-70)
  });
});

app.post('/api/start', (req, res) => {
  const { phone } = req.body || {};
  const result = startServices(phone);
  res.json(result);
});

app.post('/api/stop', (req, res) => {
  const result = stopServices();
  res.json(result);
});

app.post('/api/restart', (req, res) => {
  stopServices();
  setTimeout(() => {
    const result = startServices();
    res.json(result);
  }, 2000);
});

app.post('/api/request-pairing-code', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, error: 'Número de teléfono requerido' });
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '');

  // Limpiar sesión previa para forzar nuevo emparejamiento
  const authPath = path.join(__dirname, 'baileys_auth_info');
  if (fs.existsSync(authPath)) {
    try {
      fs.rmSync(authPath, { recursive: true, force: true });
      addLog('MANAGER', '🧹 Sesión previa eliminada para nuevo enlace por código.');
    } catch (e) {}
  }

  // Reiniciar con la variable de pairing code activa
  stopServices();
  setTimeout(() => {
    startServices(cleanPhone);
    addLog('MANAGER', `🔑 Solicitando Código de Vinculación para +${cleanPhone}...`);

    // Esperar a que el archivo pairing_code.txt se genere
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const pairingFile = path.join(__dirname, 'pairing_code.txt');
      if (fs.existsSync(pairingFile)) {
        const code = fs.readFileSync(pairingFile, 'utf8').trim();
        if (code) {
          clearInterval(interval);
          return res.json({ success: true, code, phone: cleanPhone });
        }
      }
      if (attempts >= 15) {
        clearInterval(interval);
        return res.json({ success: true, message: 'Iniciando generación de código, revisa el panel en unos segundos.', phone: cleanPhone });
      }
    }, 1000);
  }, 1500);
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🐹 CUYCITOGO CONTROL MANAGER INICIADO`);
  console.log(`🌐 Panel de Control: http://localhost:${PORT}`);
  console.log(`====================================================`);
});