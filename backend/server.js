import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { RechargeController } from './recharge-controller.js';
import { lemonImapService } from './lemon-imap-service.js';

const app = express();

// Middlewares
app.use(cors({
    origin: '*', // Permitir conexión desde frontend local y en producción
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

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

// 2. Crear nueva solicitud de recarga con céntimos únicos
app.post('/api/recharges/create', async (req, res) => {
    try {
        const { userId, amount, currency = 'USD', userInfo = {} } = req.body;
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
