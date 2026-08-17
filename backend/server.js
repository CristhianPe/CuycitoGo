import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { RechargeController } from './recharge-controller.js';
import { lemonImapService } from './lemon-imap-service.js';
import { GameController, DEFAULT_ROULETTE_SETTINGS } from './game-controller.js';
import { verifyRequestIntegrity, createRateLimiter } from './security-middleware.js';
import { SecurityAuditLogger } from './audit-logger.js';

const app = express();

// Middlewares
app.use(cors({
    origin: '*', // Permitir conexión desde frontend local y en producción
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Cuycito-Timestamp', 'X-Cuycito-Nonce', 'X-Cuycito-Signature']
}));
app.use(express.json());

// Limitadores de Tasa
const spinRateLimiter = createRateLimiter(6, 60000); // Max 6 giros/minuto
const rechargeRateLimiter = createRateLimiter(5, 60000); // Max 5 órdenes de recarga/minuto

// ==============================================================================
// RUTAS DE SEGURIDAD Y TELEMETRÍA ANTI-CHEAT
// ==============================================================================
app.post('/api/security/report-tamper', async (req, res) => {
    try {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
        const { userId, userName, anomalyType, details } = req.body;

        await SecurityAuditLogger.logSecurityAnomaly({
            eventType: anomalyType || 'CLIENT_SIDE_ANOMALY',
            severity: 'CRITICAL',
            userId,
            userName,
            ip: clientIp,
            endpoint: '/api/security/report-tamper',
            details: details || {}
        });

        res.json({ success: true, acknowledged: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==============================================================================
// RUTAS DE LA API DE RECARGAS
// ==============================================================================

// 1. Healthcheck
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'CuycitoGO Lemon Cash Recharge API',
        timestamp: new Date().toISOString(),
        imapListening: lemonImapService.isRunning
    });
});

// 2. Crear nueva solicitud de recarga (Protegido con Integridad Criptográfica y Rate Limiter)
app.post('/api/recharges/create', rechargeRateLimiter, verifyRequestIntegrity, async (req, res) => {
    try {
        const { userId, amount, currency = 'PEN', userInfo = {} } = req.body;
        if (!userId || !amount) {
            return res.status(400).json({ error: "userId y amount son requeridos." });
        }

        const result = await RechargeController.createRechargeOrder(userId, amount, currency, userInfo);
        res.status(201).json(result);
    } catch (error) {
        console.error("❌ Error en /api/recharges/create:", error);
        res.status(500).json({ error: error.message });
    }
});

// 3. Consultar estado de una orden de recarga
app.get('/api/recharges/status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await RechargeController.getOrderStatus(orderId);
        if (!order) {
            return res.status(404).json({ error: "Orden de recarga no encontrada." });
        }
        res.json({ success: true, order });
    } catch (error) {
        console.error("❌ Error en /api/recharges/status:", error);
        res.status(500).json({ error: error.message });
    }
});

// 4. Historial de recargas de un usuario
app.get('/api/recharges/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const history = await RechargeController.getUserRecharges(userId);
        res.json({ success: true, history });
    } catch (error) {
        console.error("❌ Error en /api/recharges/user:", error);
        res.status(500).json({ error: error.message });
    }
});

// 5. Endpoint de Simulación para Pruebas de Conciliación
app.post('/api/recharges/simulate-transfer', async (req, res) => {
    try {
        const { amount, sender = '$usuario_prueba', reference = `TEST_${Date.now()}` } = req.body;
        if (!amount) {
            return res.status(400).json({ error: "amount es requerido para la simulación." });
        }

        console.log(`🧪 [Simulación de Correo Lemon] Recibido monto: $${amount} de ${sender}`);

        const result = await RechargeController.processLemonTransfer({
            amount: parseFloat(amount),
            sender,
            reference,
            date: new Date(),
            emailMessageId: `sim_${Date.now()}`,
            rawSnippet: `Simulación manual: Recibiste $${amount} de ${sender}`
        });

        res.json(result);
    } catch (error) {
        console.error("❌ Error en /api/recharges/simulate-transfer:", error);
        res.status(500).json({ error: error.message });
    }
});

// 6. Forzar verificación manual inmediata de IMAP
app.post('/api/recharges/force-check-imap', async (req, res) => {
    try {
        await lemonImapService.checkInbox();
        res.json({ success: true, message: "Verificación de IMAP completada." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==============================================================================
// RUTAS DE LA API DEL MÓDULO DE JUEGOS (RULETA VIP)
// ==============================================================================

// 7. Obtener configuración de la Ruleta (Servicios, Stock, Estado Habilitado)
app.get('/api/games/roulette/settings', async (req, res) => {
    try {
        const settings = await GameController.getRouletteSettings();
        res.json({ success: true, settings });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 7.1 Guardar configuración de la Ruleta
app.post('/api/games/roulette/settings', async (req, res) => {
    try {
        const updated = await GameController.saveRouletteSettings(req.body);
        res.json({ success: true, settings: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 8. Girar la Ruleta (Protegido con Integridad Criptográfica, Rate Limiter y Estado Autoritativo)
app.post('/api/games/spin', spinRateLimiter, verifyRequestIntegrity, async (req, res) => {
    try {
        const { userId, userName } = req.body;
        if (!userId) {
            return res.status(400).json({ error: "userId es requerido." });
        }

        const result = await GameController.spinRoulette(userId, userName);
        if (!result.success && result.reason === 'INSUFFICIENT_SERVICES') {
            return res.status(403).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error("❌ Error en /api/games/spin:", error);
        res.status(400).json({ error: error.message });
    }
});

// 9. Resumen financiero personal e historial del cliente
app.get('/api/games/stats/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const stats = await GameController.getUserGameStats(userId);
        res.json({ success: true, stats });
    } catch (error) {
        console.error("❌ Error en /api/games/stats:", error);
        res.status(500).json({ error: error.message });
    }
});

// 10. Métricas globales de la casa (Para el Dashboard del Admin)
app.get('/api/games/house-stats', async (req, res) => {
    try {
        const houseStats = await GameController.getHouseMetrics();
        res.json({ success: true, houseStats });
    } catch (error) {
        console.error("❌ Error en /api/games/house-stats:", error);
        res.status(500).json({ error: error.message });
    }
});

// ==============================================================================
// INICIALIZACIÓN DEL SERVIDOR & WORKER IMAP
// ==============================================================================
const PORT = config.port;
app.listen(PORT, () => {
    console.log(`\n========================================================`);
    console.log(`🐹 [CuycitoGO Backend] Servidor activo en http://localhost:${PORT}`);
    console.log(`========================================================`);

    // Iniciar servicio IMAP en segundo plano
    lemonImapService.start();
});
