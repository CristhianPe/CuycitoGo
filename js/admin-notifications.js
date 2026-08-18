// ==========================================================================
// CUZCITOGO VIP - MOTOR DE NOTIFICACIONES NATIVAS DE GOOGLE CHROME & AUDIO
// Alertas para: Recargas Manuales, Script Lemon Cash Inactivo, Clientes y Compras
// ==========================================================================

class CuzcitoNotificationEngine {
    constructor() {
        this.audioCtx = null;
        this.knownRechargeIds = new Set();
        this.knownRegistrationIds = new Set();
        this.knownSubscriptionIds = new Set();
        this.isInitialized = false;
        this.isMonitoring = false;
        this.initStorageCache();
    }

    initStorageCache() {
        try {
            const cachedRecs = JSON.parse(localStorage.getItem("cuycito_known_recharge_ids") || "[]");
            cachedRecs.forEach(id => this.knownRechargeIds.add(id));

            const cachedRegs = JSON.parse(localStorage.getItem("cuycito_known_reg_ids") || "[]");
            cachedRegs.forEach(id => this.knownRegistrationIds.add(id));

            const cachedSubs = JSON.parse(localStorage.getItem("cuycito_known_sub_ids") || "[]");
            cachedSubs.forEach(id => this.knownSubscriptionIds.add(id));
        } catch(e) {}
    }

    saveStorageCache() {
        try {
            localStorage.setItem("cuycito_known_recharge_ids", JSON.stringify([...this.knownRechargeIds]));
            localStorage.setItem("cuycito_known_reg_ids", JSON.stringify([...this.knownRegistrationIds]));
            localStorage.setItem("cuycito_known_sub_ids", JSON.stringify([...this.knownSubscriptionIds]));
        } catch(e) {}
    }

    getAudioContext() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        return this.audioCtx;
    }

    playChime(type = 'default') {
        try {
            const ctx = this.getAudioContext();
            if (!ctx) return;

            const now = ctx.currentTime;
            
            let freqs = [587.33, 880.00];
            if (type === 'recharge') freqs = [659.25, 987.77, 1318.51];
            if (type === 'purchase') freqs = [523.25, 659.25, 783.99, 1046.50];
            if (type === 'client') freqs = [440.00, 554.37, 659.25];
            if (type === 'warning') freqs = [880.00, 440.00, 880.00];

            freqs.forEach((f, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, now + (i * 0.08));

                gain.gain.setValueAtTime(0.001, now + (i * 0.08));
                gain.gain.exponentialRampToValueAtTime(0.3, now + (i * 0.08) + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + (i * 0.08) + 0.9);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now + (i * 0.08));
                osc.stop(now + (i * 0.08) + 0.95);
            });
        } catch(e) {
            console.warn("Audio chime error:", e);
        }
    }

    async requestPermission() {
        if (!("Notification" in window)) {
            alert("⚠️ Tu navegador no soporta notificaciones de escritorio de Chrome.");
            return false;
        }

        this.getAudioContext();

        if (Notification.permission === "granted") {
            this.updateUiBadge("granted");
            this.playChime('recharge');
            this.showNativeNotification({
                title: "🔔 Notificaciones Chrome Activas",
                body: "¡Listo! Recibirás alertas inmediatas de recargas, nuevos clientes y compras.",
                tag: "cuycito-perm-ok"
            });
            return true;
        }

        if (Notification.permission !== "denied") {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                this.updateUiBadge("granted");
                this.playChime('recharge');
                this.showNativeNotification({
                    title: "✅ Notificaciones Chrome Habilitadas",
                    body: "CuzcitoGo VIP te avisará de cada evento en segundo plano.",
                    tag: "cuycito-perm-granted"
                });
                return true;
            } else {
                this.updateUiBadge("denied");
                return false;
            }
        } else {
            alert("⚠️ Las notificaciones están bloqueadas en tu Chrome.\n\nHaz clic en el icono del candado 🔒 a la izquierda de la URL y activa 'Notificaciones: Permitir'.");
            this.updateUiBadge("denied");
            return false;
        }
    }

    showNativeNotification({ title, body, icon, tag, tabToOpen, soundType = 'default' }) {
        this.playChime(soundType);
        this.showToastBanner(title, body, tabToOpen);

        if ("Notification" in window && Notification.permission === "granted") {
            try {
                const notif = new Notification(title, {
                    body: body,
                    icon: icon || "assets/img/cuycito_logo.png",
                    badge: "assets/img/cuycito_logo.png",
                    tag: tag || ("cuycito-alert-" + Date.now()),
                    requireInteraction: true
                });

                notif.onclick = () => {
                    window.focus();
                    if (tabToOpen && typeof window.switchTab === 'function') {
                        window.switchTab(tabToOpen);
                    }
                    notif.close();
                };
            } catch(e) {
                console.warn("Error mostrando notificación Chrome:", e);
            }
        }
    }

    showToastBanner(title, body, tabToOpen) {
        let container = document.getElementById('cuycitoToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'cuycitoToastContainer';
            container.className = 'fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm pointer-events-none';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'pointer-events-auto bg-[#141414] border-2 border-cuycito-gold/80 rounded-2xl p-4 shadow-2xl glow-gold flex items-start gap-3 transform translate-x-full transition-all duration-300 cursor-pointer group';
        
        toast.innerHTML = `
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-400 text-black flex items-center justify-center text-lg font-black shrink-0 shadow">
                🔔
            </div>
            <div class="flex-1 space-y-1">
                <div class="flex items-center justify-between">
                    <h5 class="text-xs font-black text-white group-hover:text-cuycito-gold transition">${title}</h5>
                    <span class="text-[9px] text-gray-500 font-mono">Ahora</span>
                </div>
                <p class="text-[11px] text-gray-300 leading-snug">${body}</p>
                <div class="text-[10px] text-cuycito-gold font-black uppercase tracking-wider pt-1 flex items-center gap-1">
                    <span>Ver detalle</span> <i class="fa-solid fa-arrow-right text-[9px]"></i>
                </div>
            </div>
            <button onclick="event.stopPropagation(); this.parentElement.remove();" class="text-gray-500 hover:text-white text-xs p-1">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;

        toast.onclick = () => {
            if (tabToOpen && typeof window.switchTab === 'function') {
                window.switchTab(tabToOpen);
            }
            toast.remove();
        };

        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full');
        });

        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('translate-x-full', 'opacity-0');
                setTimeout(() => toast.remove(), 400);
            }
        }, 9000);
    }

    updateUiBadge(status) {
        const btn = document.getElementById('btnChromeNotifStatus');
        if (!btn) return;

        if (status === 'granted' || (("Notification" in window) && Notification.permission === 'granted')) {
            btn.innerHTML = `
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                <i class="fa-solid fa-bell text-emerald-400 text-sm"></i>
                <span class="text-emerald-400 font-bold hidden sm:inline">Alertas Chrome Activas</span>
            `;
            btn.className = "bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/50 text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-2 shadow";
            btn.title = "Notificaciones de Chrome 100% activas y funcionando.";
        } else if (status === 'denied' || (("Notification" in window) && Notification.permission === 'denied')) {
            btn.innerHTML = `
                <i class="fa-solid fa-bell-slash text-red-400 text-sm"></i>
                <span class="text-red-400 font-bold hidden sm:inline">Alertas Bloqueadas</span>
            `;
            btn.className = "bg-red-950/80 hover:bg-red-900/80 border border-red-500/50 text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-2 shadow cursor-pointer";
            btn.title = "Haz clic para ver cómo desbloquear notificaciones en Chrome.";
        } else {
            btn.innerHTML = `
                <i class="fa-solid fa-bell text-yellow-400 text-sm animate-pulse"></i>
                <span class="text-yellow-300 font-bold hidden sm:inline">Activar Alertas Chrome</span>
            `;
            btn.className = "bg-yellow-950/80 hover:bg-yellow-900/80 border border-yellow-500/50 text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-2 shadow glow-gold cursor-pointer";
            btn.title = "Haz clic para activar alertas de escritorio en Google Chrome.";
        }
    }

    startMonitoring() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;

        setInterval(() => {
            this.checkPendingRecharges();
            this.checkPendingRegistrations();
            this.checkNewSubscriptions();
            this.checkLemonCashHealth();
        }, 3500);
    }

    // 1. REVISIÓN DE RECARGAS DE SALDO (ALERTA PARA ACTIVACIÓN MANUAL)
    checkPendingRecharges() {
        if (typeof appState === 'undefined' || !Array.isArray(appState.recharges)) return;

        const pending = appState.recharges.filter(r => r.status === 'pending' || r.status === 'pending_manual');

        pending.forEach(rec => {
            const recKey = `rec_${rec.id}_${rec.createdAt || ''}`;
            if (!this.knownRechargeIds.has(recKey)) {
                this.knownRechargeIds.add(recKey);
                this.saveStorageCache();

                if (this.isInitialized) {
                    const clientObj = (appState.clients || []).find(c => c.id === rec.userId || c.email === rec.userEmail || c.name === rec.userName);
                    const currentBal = clientObj ? parseFloat(clientObj.balance || 0).toFixed(2) : (rec.currentBalance !== undefined ? parseFloat(rec.currentBalance).toFixed(2) : "0.00");
                    const amount = parseFloat(rec.exactAmount || rec.amount || rec.baseAmount || 0).toFixed(2);
                    const projectedBal = (parseFloat(currentBal) + parseFloat(amount)).toFixed(2);
                    const clientName = rec.userName || rec.userNickname || rec.userEmail || "Cliente VIP";

                    this.showNativeNotification({
                        title: `⚡ [CuzcitoGo] Recarga: ${clientName} (+S/ ${amount})`,
                        body: `👤 Cliente: ${clientName}\n💵 Recarga: S/ ${amount} | 💰 Saldo Actual: S/ ${currentBal}\n📈 Saldo Proyectado: S/ ${projectedBal}`,
                        tag: `recharge-${rec.id}`,
                        tabToOpen: 'recharges',
                        soundType: 'recharge'
                    });
                }
            }
        });

        // ALARMA RECURRENTE CADA 5 MINUTOS MIENTRAS HAYA RECARGAS PENDIENTES
        if (pending.length > 0) {
            const now = Date.now();
            if (!this.lastRecurringAlarmTime) {
                this.lastRecurringAlarmTime = now;
            } else if (now - this.lastRecurringAlarmTime >= 5 * 60 * 1000) {
                this.lastRecurringAlarmTime = now;
                const first = pending[0];
                const clientObj = (appState.clients || []).find(c => c.id === first.userId || c.email === first.userEmail || c.name === first.userName);
                const currentBal = clientObj ? parseFloat(clientObj.balance || 0).toFixed(2) : (first.currentBalance !== undefined ? parseFloat(first.currentBalance).toFixed(2) : "0.00");
                const amount = parseFloat(first.exactAmount || first.amount || first.baseAmount || 0).toFixed(2);
                const clientName = first.userName || first.userNickname || first.userEmail || "Cliente VIP";

                this.showNativeNotification({
                    title: `⏰ [Alarma 5 min] Recarga Pendiente: ${clientName} (+S/ ${amount})`,
                    body: `👤 Cliente: ${clientName}\n💵 Monto a Acreditar: S/ ${amount}\n💰 Saldo Actual en Cuenta: S/ ${currentBal}\n👉 Haz clic para abrir la tabla y acreditar.`,
                    tag: `recharge-recurring-${now}`,
                    tabToOpen: 'recharges',
                    soundType: 'warning'
                });
            }
        } else {
            this.lastRecurringAlarmTime = null;
        }

        const badge = document.getElementById('pendingRechargesBadge');
        if (badge) {
            if (pending.length > 0) {
                badge.textContent = pending.length;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }

    // 2. REVISIÓN DE REGISTROS DE CLIENTES NUEVOS
    checkPendingRegistrations() {
        if (typeof appState === 'undefined') return;

        const regs = Array.isArray(appState.pendingRegistrations) ? appState.pendingRegistrations : [];

        regs.forEach(reg => {
            const regKey = `reg_${reg.id}_${reg.createdAt || reg.email || ''}`;
            if (!this.knownRegistrationIds.has(regKey)) {
                this.knownRegistrationIds.add(regKey);
                this.saveStorageCache();

                if (this.isInitialized) {
                    const name = reg.name || reg.nickname || "Nueva Persona";
                    const email = reg.email || reg.phone || "Sin correo";
                    const refInfo = reg.referralCode || reg.referredBy || 'Directo (Sin Referido)';

                    this.showNativeNotification({
                        title: `👤 [CuzcitoGo] Solicitud de Cuenta: ${name}`,
                        body: `👤 Persona: ${name} (${email})\n🎁 Referido por: ${refInfo}\n📝 Solicita crear una cuenta VIP\n👉 Haz clic para aprobar acceso.`,
                        tag: `reg-${reg.id}`,
                        tabToOpen: 'clients',
                        soundType: 'client'
                    });
                }
            }
        });

        const badge = document.getElementById('pendingRegistrationsBadge');
        if (badge) {
            if (regs.length > 0) {
                badge.textContent = regs.length;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }

    // 3. REVISIÓN DE COMPRAS Y VENTAS REALIZADAS
    checkNewSubscriptions() {
        if (typeof appState === 'undefined' || !Array.isArray(appState.subscriptions)) return;

        appState.subscriptions.forEach(sub => {
            const subKey = `sub_${sub.id}_${sub.createdAt || sub.startDate || ''}`;
            if (!this.knownSubscriptionIds.has(subKey)) {
                this.knownSubscriptionIds.add(subKey);
                this.saveStorageCache();

                if (this.isInitialized) {
                    const client = sub.personName || sub.person || sub.clientEmail || "Cliente VIP";
                    const service = sub.service || "Streaming";
                    const amount = parseFloat(sub.price || sub.amount || 0).toFixed(2);

                    this.showNativeNotification({
                        title: `🛒 [CuzcitoGo] Nueva Compra: ${service} (S/ ${amount})`,
                        body: `👤 Cliente: ${client}\n📺 Servicio: ${service} | 💵 Monto: S/ ${amount}\n⏳ Estado: Pendiente de activación\n👉 Haz clic para asignar credenciales y activar.`,
                        tag: `sub-${sub.id}`,
                        tabToOpen: 'subs',
                        soundType: 'purchase'
                    });
                }
            }
        });
    }

    // 4. REVISIÓN DEL ESTADO DEL SCRIPT LEMON CASH (VERIFICADOR AUTOMÁTICO)
    async checkLemonCashHealth() {
        if (typeof appState === 'undefined' || !Array.isArray(appState.recharges)) return;

        const pending = appState.recharges.filter(r => r.status === 'pending' || r.status === 'pending_manual');
        if (pending.length === 0) return;

        const now = Date.now();
        pending.forEach(rec => {
            const createdAt = new Date(rec.createdAt || now).getTime();
            const elapsedMinutes = (now - createdAt) / 60000;

            const lemonKey = `lemon_down_${rec.id}`;
            if (elapsedMinutes >= 2 && !this.knownRechargeIds.has(lemonKey)) {
                this.knownRechargeIds.add(lemonKey);
                this.saveStorageCache();

                if (this.isInitialized) {
                    const amount = parseFloat(rec.exactAmount || rec.amount || 0).toFixed(2);
                    const clientName = rec.userName || rec.userNickname || "Cliente VIP";
                    this.showNativeNotification({
                        title: "⚠️ [Alerta Lemon Cash] Script Automático Inactivo",
                        body: `Orden de S/ ${amount} de ${clientName} no se verificó en automático. Requiere atención y activación manual.`,
                        tag: `lemon-down-${rec.id}`,
                        tabToOpen: 'recharges',
                        soundType: 'warning'
                    });
                }
            }
        });
    }

    init() {
        this.updateUiBadge();
        setTimeout(() => {
            this.checkPendingRecharges();
            this.checkPendingRegistrations();
            this.checkNewSubscriptions();
            this.isInitialized = true;
            this.startMonitoring();
        }, 1500);
    }
}

window.cuzcitoNotifier = new CuzcitoNotificationEngine();

window.requestChromeNotificationPermission = () => {
    window.cuzcitoNotifier.requestPermission();
};

window.testChromeNotification = (type = 'recharge') => {
    window.cuzcitoNotifier.getAudioContext();
    if (type === 'recharge') {
        window.cuzcitoNotifier.showNativeNotification({
            title: "⚡ [TEST] Recarga: Juan Pérez (+S/ 25.00)",
            body: "👤 Cliente: Juan Pérez\n💵 Monto Recargado: S/ 25.00 | 💰 Saldo Actual: S/ 4.50\n📈 Nuevo Saldo: S/ 29.50 (Yape/Plin)",
            tabToOpen: 'recharges',
            soundType: 'recharge'
        });
    } else if (type === 'client') {
        window.cuzcitoNotifier.showNativeNotification({
            title: "👤 [TEST] Solicitud de Cuenta: Mateo Rojas",
            body: "👤 Persona: Mateo Rojas (mateo@gmail.com)\n🎁 Referido por: VIP-JUAN-9842 (Juan Pérez)\n📝 Solicita crear una cuenta VIP\n👉 Haz clic para aprobar acceso.",
            tabToOpen: 'clients',
            soundType: 'client'
        });
    } else if (type === 'purchase') {
        window.cuzcitoNotifier.showNativeNotification({
            title: "🛒 [TEST] Nueva Compra: Netflix 4K (S/ 13.00)",
            body: "👤 Cliente: María López\n📺 Servicio: Netflix 4K UHD | 💵 Monto: S/ 13.00\n⏳ Estado: Pendiente de activación\n👉 Haz clic para asignar credenciales y activar.",
            tabToOpen: 'subs',
            soundType: 'purchase'
        });
    } else if (type === 'lemon_down') {
        window.cuzcitoNotifier.showNativeNotification({
            title: "⚠️ [TEST] Script Lemon Cash Inactivo",
            body: "Prueba: El verificador automático de Lemon Cash está desconectado. Orden de S/ 20.00 (Juan Pérez) requiere acreditación manual.",
            tabToOpen: 'recharges',
            soundType: 'warning'
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.cuzcitoNotifier.init();

    // ESCUCHADOR INSTANTÁNEO ENTRE PESTAÑAS (CROSS-TAB STORAGE EVENT)
    window.addEventListener('storage', (e) => {
        // 1. Alerta Instantánea de Recarga
        if (e.key === 'cuycito_recharge_alert_trigger' && e.newValue) {
            try {
                const order = JSON.parse(e.newValue);
                const clientName = order.userName || order.userNickname || "Cliente VIP";
                const amount = parseFloat(order.amount || 0).toFixed(2);
                const currentBal = parseFloat(order.currentBalance || 0).toFixed(2);
                const projectedBal = parseFloat(order.projectedBalance || (parseFloat(currentBal) + parseFloat(amount))).toFixed(2);
                const method = order.method || "Manual (Yape/Plin)";

                window.cuzcitoNotifier.showNativeNotification({
                    title: `⚡ [CuzcitoGo] Recarga: ${clientName} (+S/ ${amount})`,
                    body: `👤 Cliente: ${clientName}\n💵 Recarga: S/ ${amount} | 💰 Saldo Actual: S/ ${currentBal}\n📈 Nuevo Saldo: S/ ${projectedBal} (${method})`,
                    tag: `recharge-${order.id || Date.now()}`,
                    tabToOpen: 'recharges',
                    soundType: 'recharge'
                });

                if (typeof window.renderRechargesTable === 'function') {
                    window.renderRechargesTable();
                }
            } catch(err) {
                console.warn("Error procesando alerta de recarga:", err);
            }
        }

        // 2. Alerta Instantánea de Nueva Compra
        if (e.key === 'cuycito_purchase_alert_trigger' && e.newValue) {
            try {
                const purchase = JSON.parse(e.newValue);
                const clientName = purchase.userName || purchase.userNickname || "Cliente VIP";
                const serviceName = purchase.serviceName || "Servicio Streaming";
                const amount = parseFloat(purchase.amount || 0).toFixed(2);

                window.cuzcitoNotifier.showNativeNotification({
                    title: `🛒 [CuzcitoGo] Nueva Compra: ${serviceName} (S/ ${amount})`,
                    body: `👤 Cliente: ${clientName}\n📺 Servicio: ${serviceName} | 💵 Monto: S/ ${amount}\n⏳ Estado: Pendiente de activación\n👉 Haz clic para asignar credenciales y activar.`,
                    tag: `purchase-${Date.now()}`,
                    tabToOpen: 'subs',
                    soundType: 'purchase'
                });

                if (typeof window.renderSubscriptionsTable === 'function') {
                    window.renderSubscriptionsTable();
                }
            } catch(err) {
                console.warn("Error procesando alerta de compra:", err);
            }
        }

        // 3. Alerta Instantánea de Solicitud de Cuenta Nueva
        if (e.key === 'cuycito_registration_alert_trigger' && e.newValue) {
            try {
                const reg = JSON.parse(e.newValue);
                const name = reg.name || "Nueva Persona";
                const email = reg.email || reg.phone || "Sin correo";
                const ref = reg.referralCode || "Directo (Sin referido)";

                window.cuzcitoNotifier.showNativeNotification({
                    title: `👤 [CuzcitoGo] Solicitud de Cuenta: ${name}`,
                    body: `👤 Persona: ${name} (${email})\n🎁 Referido por: ${ref}\n📝 Solicita crear una cuenta VIP\n👉 Haz clic para aprobar acceso.`,
                    tag: `reg-${reg.id || Date.now()}`,
                    tabToOpen: 'clients',
                    soundType: 'client'
                });

                if (typeof window.renderPendingRegistrationsTable === 'function') {
                    window.renderPendingRegistrationsTable();
                }
            } catch(err) {
                console.warn("Error procesando alerta de registro:", err);
            }
        }

        // 4. Alerta Instantánea de Solicitud de Activación de Servicio
        if (e.key === 'cuycito_activation_request_trigger' && e.newValue) {
            try {
                const act = JSON.parse(e.newValue);
                const name = act.userName || "Cliente VIP";
                const service = act.serviceName || "Servicio";

                window.cuzcitoNotifier.showNativeNotification({
                    title: `⚡ [CuzcitoGo] Solicitud de Activación: ${service}`,
                    body: `👤 Cliente: ${name}\n📺 Servicio: ${service}\n⏳ El cliente solicita activación inmediata de sus credenciales.\n👉 Haz clic para abrir suscripciones y asignar cuenta.`,
                    tag: `act-${act.subId || Date.now()}`,
                    tabToOpen: 'subs',
                    soundType: 'warning'
                });

                if (typeof window.renderActiveTable === 'function') {
                    window.renderActiveTable();
                }
            } catch(err) {
                console.warn("Error procesando alerta de activación:", err);
            }
        }

        // 5. Alerta Instantánea de Captura QR de TV Subida por el Cliente
        if (e.key === 'cuycito_tv_qr_alert_trigger' && e.newValue) {
            try {
                const qrData = JSON.parse(e.newValue);
                const name = qrData.userName || "Cliente VIP";
                const service = qrData.serviceName || "Servicio TV";

                window.cuzcitoNotifier.showNativeNotification({
                    title: `📺 [CuzcitoGo] Foto QR de TV Recibida: ${service}`,
                    body: `👤 Cliente: ${name}\n📺 Servicio: ${service}\n📸 ¡El cliente envió la captura del código QR de su televisor!\n👉 Haz clic para abrir y escanear el QR en pantalla grande.`,
                    tag: `tvqr-${qrData.subId || Date.now()}`,
                    tabToOpen: 'subs',
                    soundType: 'purchase'
                });

                if (typeof window.renderActiveTable === 'function') {
                    window.renderActiveTable();
                }
            } catch(err) {
                console.warn("Error procesando alerta de foto QR de TV:", err);
            }
        }

        // 6. Alerta Instantánea de Renovación Automática con Saldo VIP
        if (e.key === 'cuycito_admin_notification_trigger' && e.newValue) {
            try {
                const notifData = JSON.parse(e.newValue);
                if (notifData.type === 'auto_renewal') {
                    const name = notifData.userNickname || notifData.userName || "Cliente VIP";
                    const service = notifData.serviceName || "Servicio";
                    const amount = parseFloat(notifData.amount || 0).toFixed(2);
                    const newEnd = notifData.newEndDate || "Nueva fecha";

                    window.cuzcitoNotifier.showNativeNotification({
                        title: `🔄 [CuzcitoGo] ¡Renovación Exitosa con Saldo!`,
                        body: `👤 Cliente: @${name}\n📺 Servicio: ${service}\n💰 Monto debitado: S/ ${amount}\n📅 Nuevo vencimiento: ${newEnd}\n👉 Haz clic para ver en Servicios Activos.`,
                        tag: `renew-${notifData.subId || Date.now()}`,
                        tabToOpen: 'subs',
                        soundType: 'purchase'
                    });

                    if (typeof window.renderActiveTable === 'function') {
                        window.renderActiveTable();
                    }
                    if (typeof window.renderClients === 'function') {
                        window.renderClients();
                    }
                }
            } catch(err) {
                console.warn("Error procesando notificación de renovación:", err);
            }
        }
    });
});
