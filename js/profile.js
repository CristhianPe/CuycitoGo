import { db, collection, getDocs, getDoc, doc, setDoc } from "./firebase-config.js";

// Estado de la sesión del cliente
let currentClientUser = null;
let clientSubscriptions = [];
let allMasterAccounts = [];
let activeRechargeOrderId = null;
let rechargePollingInterval = null;
let rechargeCountdownInterval = null;

const CENTRAL_WHATSAPP_PHONE = "51991735344";
const BACKEND_API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:5000' 
    : 'http://localhost:5000'; // Ajustable según host de backend

// ==========================================
// 1. INICIALIZACIÓN Y VALIDACIÓN DE SESIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Validar si el cliente tiene sesión activa en localStorage
    const savedClient = localStorage.getItem("cuycitoClient");
    
    if (!savedClient) {
        window.location.replace("login-cliente.html");
        return;
    }

    try {
        currentClientUser = JSON.parse(savedClient);
        updateProfileUI();
        window.loadClientPaymentQR();
        await loadClientSubscriptions();
        await refreshUserDataFromFirestore();
    } catch (e) {
        console.error("Error al procesar sesión:", e);
        window.location.replace("login-cliente.html");
    }
});

// Sincroniza los datos más recientes del usuario desde Firestore (saldo, nickname, etc.)
async function refreshUserDataFromFirestore() {
    if (!currentClientUser || !currentClientUser.id) return;
    try {
        const usersSnap = await getDocs(collection(db, "users"));
        usersSnap.forEach(d => {
            if (d.id === currentClientUser.id || d.data().phone === currentClientUser.phone) {
                currentClientUser = { id: d.id, ...d.data() };
                localStorage.setItem("cuycitoClient", JSON.stringify(currentClientUser));
                updateProfileUI();
            }
        });
    } catch (e) {
        console.error("Error refrescando usuario desde Firestore:", e);
    }
}

// Actualiza los elementos del perfil en el DOM
function updateProfileUI() {
    if (!currentClientUser) return;

    const nickname = currentClientUser.nickname || currentClientUser.name;
    const realName = currentClientUser.name;
    const phone = currentClientUser.phone;
    const email = currentClientUser.email || "Sin correo registrado";
    const balance = parseFloat(currentClientUser.balance || 0).toFixed(2);

    const navNick = document.getElementById('navNicknameDisplay') || document.getElementById('navClientNickname');
    const navPhone = document.getElementById('navPhoneDisplay');
    const headerNick = document.getElementById('headerNickname') || document.getElementById('profileNicknameDisplay');
    const headerReal = document.getElementById('headerRealName') || document.getElementById('profileRealNameDisplay');
    const headerPhone = document.getElementById('headerPhone') || document.getElementById('profilePhoneDisplay');
    const headerMail = document.getElementById('headerEmail') || document.getElementById('profileEmailDisplay');
    const balanceDisplay = document.getElementById('profileBalanceDisplay');
    const avatar = document.getElementById('profileAvatar');

    if (navNick) navNick.innerText = currentClientUser.isDemo ? `@${nickname} (DEMO)` : `@${nickname}`;
    if (navPhone) navPhone.innerText = phone;
    if (headerNick) headerNick.innerText = currentClientUser.isDemo ? `@${nickname} 🐹 [MODO DEMO]` : `@${nickname}`;
    if (headerReal) headerReal.innerText = realName;
    if (headerPhone) headerPhone.innerText = phone;
    if (headerMail) headerMail.innerText = email;
    if (balanceDisplay) balanceDisplay.innerText = currentClientUser.isDemo ? `S/ 99,999.00 (Demo Ilimitado)` : `S/ ${balance}`;
    const rouletteBal = document.getElementById('rouletteUserBalanceDisplay');
    if (rouletteBal) rouletteBal.innerText = currentClientUser.isDemo ? `S/ 99,999.00 (Ilimitado)` : `S/ ${balance}`;
    if (avatar && nickname) avatar.innerText = nickname.charAt(0).toUpperCase();

    // Rellenar modal de edición
    const editReal = document.getElementById('editRealName');
    const editNick = document.getElementById('editNickname');
    const editMail = document.getElementById('editEmail');
    const editPass = document.getElementById('editPass');

    if (editReal) editReal.value = realName;
    if (editNick) editNick.value = nickname;
    if (editMail) editMail.value = currentClientUser.email || '';
    if (editPass) editPass.value = currentClientUser.pass || '';
}

// ==========================================
// 2. CARGA DE SUSCRIPCIONES DEL CLIENTE
// ==========================================
async function loadClientSubscriptions() {
    const container = document.getElementById('servicesContainer');
    if (!container || !currentClientUser) return;

    try {
        const [subSnap, masterSnap] = await Promise.all([
            getDocs(collection(db, "subscriptions")),
            getDocs(collection(db, "masterAccounts"))
        ]);

        allMasterAccounts = [];
        masterSnap.forEach(d => allMasterAccounts.push(d.data()));

        const clientNameNorm = (currentClientUser.name || '').trim().toLowerCase();
        
        clientSubscriptions = [];
        subSnap.forEach(d => {
            const data = d.data();
            if (data.person && data.person.trim().toLowerCase() === clientNameNorm) {
                clientSubscriptions.push(data);
            }
        });

        // Si es cuenta Demo y no tiene suscripciones en BD, inyectar 3 servicios de prueba
        if (currentClientUser.isDemo && clientSubscriptions.length === 0) {
            const today = new Date();
            const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            clientSubscriptions = [
                { id: "sub_demo_netflix", person: currentClientUser.name, service: "Netflix", email: "demo.netflix@cuycitogo.pe", pass: "cuycitoVIP4K", pin: "1234", endDate: nextMonth, isMasterActive: true, isDemo: true },
                { id: "sub_demo_hbo", person: currentClientUser.name, service: "HBO Max", email: "demo.hbo@cuycitogo.pe", pass: "cuycitoHBO2026", pin: "4321", endDate: nextMonth, isMasterActive: true, isDemo: true },
                { id: "sub_demo_crunchyroll", person: currentClientUser.name, service: "Crunchyroll", email: "demo.crunchy@cuycitogo.pe", pass: "cuycitoAnime99", pin: "", endDate: nextMonth, isMasterActive: true, isDemo: true }
            ];
        }

        renderClientSubscriptions(clientSubscriptions);
        updateMetrics(clientSubscriptions);

    } catch (e) {
        console.error("Error al cargar suscripciones del cliente:", e);
        if (container) {
            container.innerHTML = `
                <div class="col-span-full text-center text-red-400 py-10 bg-[#121212] rounded-3xl border border-red-500/30 p-6">
                    <i class="fa-solid fa-triangle-exclamation text-3xl mb-2"></i>
                    <p class="font-bold text-sm">No pudimos conectar con la base de datos de tus servicios.</p>
                </div>
            `;
        }
    }
}

// Actualizar métricas del dashboard cliente
function updateMetrics(subs) {
    const totalEl = document.getElementById('metricTotal');
    const activeEl = document.getElementById('metricActive');
    const expiringEl = document.getElementById('metricExpiring');
    const expiredEl = document.getElementById('metricExpired');

    const total = subs.length;
    let active = 0;
    let expiring = 0;
    let expired = 0;

    subs.forEach(s => {
        const days = getDaysRemaining(s.endDate);
        if (days < 0) {
            expired++;
        } else if (days <= 3) {
            expiring++;
            active++;
        } else {
            active++;
        }
    });

    if (totalEl) totalEl.innerText = total;
    if (activeEl) activeEl.innerText = active;
    if (expiringEl) expiringEl.innerText = expiring;
    if (expiredEl) expiredEl.innerText = expired;
}

// Renderizado de las tarjetas de servicios comprados
function renderClientSubscriptions(subs) {
    const container = document.getElementById('servicesContainer');
    if (!container) return;

    if (subs.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-16 text-center text-gray-500 space-y-3 bg-[#121212] rounded-3xl border border-gray-800 p-8">
                <i class="fa-solid fa-tv text-4xl text-gray-600"></i>
                <p class="text-sm font-semibold text-gray-400">Aún no tienes servicios activos vinculados a este usuario.</p>
                <p class="text-xs text-gray-500 max-w-sm mx-auto">Explora nuestro catálogo en la tienda y adquiere tus pantallas privadas con activación inmediata.</p>
                <a href="index.html" class="inline-block bg-cuycito-gold text-black font-extrabold text-xs px-5 py-2.5 rounded-xl transition shadow glow-gold mt-2">
                    <i class="fa-solid fa-store mr-1.5"></i> Explorar Tienda de Cuentas
                </a>
            </div>
        `;
        return;
    }

    let html = '';
    subs.forEach(sub => {
        const days = getDaysRemaining(sub.endDate);
        const isExpired = days < 0;
        const isExpiring = days <= 3 && !isExpired;

        let statusBadge = '';
        let borderClass = 'border-gray-800';

        if (isExpired) {
            statusBadge = `<span class="bg-red-950/80 text-red-400 border border-cuycito-red/50 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1"><i class="fa-solid fa-circle-xmark"></i> Vencido</span>`;
            borderClass = 'border-red-950/60';
        } else if (isExpiring) {
            statusBadge = `<span class="bg-amber-950/80 text-cuycito-gold border border-cuycito-gold/50 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 animate-pulse"><i class="fa-solid fa-triangle-exclamation"></i> Por Vencer (${days} d)</span>`;
            borderClass = 'border-cuycito-gold/50';
        } else {
            statusBadge = `<span class="bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1"><i class="fa-solid fa-circle-check"></i> Activo (${days} d)</span>`;
            borderClass = 'border-gray-800 hover:border-emerald-500/40';
        }

        // ==========================================
        // POLÍTICA DE VISIBILIDAD DE CREDENCIALES
        // ==========================================
        let shouldShowCreds = true;

        if (sub.hidePassword === true) {
            shouldShowCreds = false;
        }

        const linkedMaster = allMasterAccounts.find(m => 
            (m.service || '').toLowerCase() === (sub.service || '').toLowerCase() &&
            m.profiles && m.profiles.includes(sub.id)
        );

        if (linkedMaster) {
            if (linkedMaster.showCredentialsToClient === false || linkedMaster.hidePasswordFromClient === true) {
                shouldShowCreds = false;
            }
        }

        let credentialsBlockHTML = '';
        if (shouldShowCreds && (sub.email || sub.pass)) {
            credentialsBlockHTML = `
                <div class="bg-black/60 border border-gray-800/90 rounded-2xl p-3.5 space-y-2 font-mono text-xs">
                    <div class="flex items-center justify-between">
                        <span class="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Correo:</span>
                        <div class="flex items-center gap-1.5">
                            <span class="text-white font-bold truncate max-w-[170px] select-all">${sub.email || 'Sin correo'}</span>
                            <button onclick="window.copyText('${sub.email || ''}')" class="text-gray-400 hover:text-cuycito-gold p-1 transition" title="Copiar correo"><i class="fa-regular fa-copy text-xs"></i></button>
                        </div>
                    </div>

                    <div class="flex items-center justify-between pt-1 border-t border-gray-800/60">
                        <span class="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Contraseña:</span>
                        <div class="flex items-center gap-1.5">
                            <span class="text-cuycito-gold font-black select-all">${sub.pass || '••••••••'}</span>
                            <button onclick="window.copyText('${sub.pass || ''}')" class="text-gray-400 hover:text-cuycito-gold p-1 transition" title="Copiar contraseña"><i class="fa-regular fa-copy text-xs"></i></button>
                        </div>
                    </div>

                    ${sub.pin ? `
                    <div class="flex items-center justify-between pt-1 border-t border-gray-800/60">
                        <span class="text-gray-500 text-[10px] uppercase font-bold tracking-wider">PIN / Perfil:</span>
                        <span class="text-emerald-400 font-black">${sub.pin}</span>
                    </div>` : ''}
                </div>
            `;
        } else {
            credentialsBlockHTML = `
                <div class="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-3 text-center space-y-1">
                    <div class="flex items-center justify-center gap-1.5 text-emerald-400 text-xs font-bold">
                        <i class="fa-solid fa-shield-halved"></i>
                        <span>Servicio Activo & Garantizado</span>
                    </div>
                    <p class="text-[10px] text-gray-400">Tu acceso directo se encuentra sincronizado con nuestro servidor.</p>
                </div>
            `;
        }

        html += `
        <div class="bg-[#121212] border ${borderClass} rounded-3xl p-5 sm:p-6 transition-all duration-300 flex flex-col justify-between shadow-xl relative group">
            
            <div class="space-y-4">
                <div class="flex items-start justify-between gap-2">
                    <div>
                        <span class="text-[10px] text-cuycito-gold uppercase font-bold tracking-widest block">Suscripción VIP</span>
                        <h3 class="text-lg font-black text-white group-hover:text-cuycito-gold transition">${sub.service}</h3>
                    </div>
                    ${statusBadge}
                </div>

                ${credentialsBlockHTML}

                <div class="text-[11px] text-gray-400 font-mono flex items-center justify-between pt-1">
                    <span>Fecha Vencimiento:</span>
                    <strong class="${isExpired ? 'text-red-400' : 'text-white'}">${sub.endDate}</strong>
                </div>
            </div>

            <div class="pt-4 mt-4 border-t border-gray-800 flex items-center justify-between gap-2">
                <button onclick="window.requestRenewalWhatsApp('${sub.service}', '${sub.endDate}')" class="w-full bg-gradient-to-r from-cuycito-red to-cuycito-redHover hover:from-cuycito-redHover hover:to-cuycito-gold text-white font-extrabold text-xs py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-2 shadow glow-red">
                    <i class="fa-brands fa-whatsapp text-sm"></i>
                    <span>Renovar Servicio</span>
                </button>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

// ==========================================
// 3. RECARGA DUAL: LEMON CASH & MANUAL QR
// ==========================================
window.loadClientPaymentQR = async () => {
    const cachedQr = localStorage.getItem("paymentQrUrl");
    const cachedTag = localStorage.getItem("lemonTag");
    const cachedPhone = localStorage.getItem("whatsappPhone");
    
    const qrImg = document.getElementById('manualQrImage');
    const orderQr = document.getElementById('orderQrImage');
    const lemonTagEl = document.getElementById('lemonTagDisplay');
    const manualTagEl = document.getElementById('manualLemonTagDisplay');
    const manualPhoneEl = document.getElementById('manualWhatsappDisplay');

    if (cachedQr) {
        if (qrImg) qrImg.src = cachedQr;
        if (orderQr) orderQr.src = cachedQr;
    }
    if (cachedTag) {
        if (lemonTagEl) lemonTagEl.innerText = cachedTag;
        if (manualTagEl) manualTagEl.innerText = cachedTag;
    }
    if (cachedPhone && manualPhoneEl) {
        manualPhoneEl.innerText = cachedPhone;
    }

    try {
        const docSnap = await getDoc(doc(db, "settings", "general"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.paymentQrUrl) {
                if (qrImg) qrImg.src = data.paymentQrUrl;
                if (orderQr) orderQr.src = data.paymentQrUrl;
                localStorage.setItem("paymentQrUrl", data.paymentQrUrl);
            }
            if (data.lemonTag) {
                if (lemonTagEl) lemonTagEl.innerText = data.lemonTag;
                if (manualTagEl) manualTagEl.innerText = data.lemonTag;
                localStorage.setItem("lemonTag", data.lemonTag);
            }
            if (data.whatsappPhone) {
                if (manualPhoneEl) manualPhoneEl.innerText = data.whatsappPhone;
                localStorage.setItem("whatsappPhone", data.whatsappPhone);
            }
        }
    } catch(e) {
        console.error("Error al cargar QR en cliente:", e);
    }
};

window.openRechargeModal = async () => {
    const modal = document.getElementById('rechargeModal');
    if (!modal) return;
    window.resetRechargeModal();
    modal.classList.remove('hidden');

    // Cargar QR y datos personalizados inmediatamente
    await window.loadClientPaymentQR();
    
    // Verificar si el servidor y robot IMAP están en línea
    await window.checkServerStatus();
};

window.checkServerStatus = async () => {
    const statusNotice = document.getElementById('rechargeServerStatusNotice');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
        const res = await fetch(`${BACKEND_API_BASE}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
            const data = await res.json();
            if (statusNotice) {
                statusNotice.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span> <strong class="text-emerald-400">Servidor En Línea:</strong> Robot IMAP Lemon Cash Activo`;
            }
            window.setRechargeUIMode('AUTO');
            return true;
        }
    } catch (e) {
        clearTimeout(timeoutId);
    }

    // Si no responde, activar modo manual
    if (statusNotice) {
        statusNotice.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> <strong class="text-amber-400">Servidor Apagado:</strong> Modo Manual por WhatsApp &amp; QR Activo`;
    }
    window.setRechargeUIMode('MANUAL');
    return false;
};

window.setRechargeUIMode = (mode) => {
    const autoCont = document.getElementById('rechargeAutoContainer');
    const manualCont = document.getElementById('rechargeManualContainer');
    const btnAuto = document.getElementById('btnModeAuto');
    const btnManual = document.getElementById('btnModeManual');

    // Asegurar carga de QR al cambiar de pestaña
    window.loadClientPaymentQR();

    if (mode === 'AUTO') {
        if (autoCont) autoCont.classList.remove('hidden');
        if (manualCont) manualCont.classList.add('hidden');
        if (btnAuto) btnAuto.className = "flex-1 py-2 rounded-lg bg-emerald-600 text-black font-black transition flex items-center justify-center gap-1.5 shadow";
        if (btnManual) btnManual.className = "flex-1 py-2 rounded-lg text-gray-400 hover:text-white transition flex items-center justify-center gap-1.5";
    } else {
        if (autoCont) autoCont.classList.add('hidden');
        if (manualCont) manualCont.classList.remove('hidden');
        if (btnManual) btnManual.className = "flex-1 py-2 rounded-lg bg-cuycito-gold text-black font-black transition flex items-center justify-center gap-1.5 shadow";
        if (btnAuto) btnAuto.className = "flex-1 py-2 rounded-lg text-gray-400 hover:text-white transition flex items-center justify-center gap-1.5";
    }
};

window.sendManualRechargeWhatsApp = async () => {
    if (!currentClientUser) return alert("Sesión inválida.");
    const input = document.getElementById('manualRechargeAmountInput');
    const amount = parseFloat(input?.value) || 0;
    if (amount <= 0) return alert("Por favor ingresa un monto válido a recargar.");

    const orderId = `rec_man_${Date.now()}`;
    const nick = currentClientUser.nickname || currentClientUser.name;

    try {
        const orderData = {
            id: orderId,
            userId: currentClientUser.id,
            userName: currentClientUser.name,
            userPhone: currentClientUser.phone,
            userNickname: nick,
            baseAmount: amount,
            cents: 0,
            exactAmount: amount,
            currency: 'PEN',
            status: 'pending_manual',
            paymentMethod: 'Manual (WhatsApp)',
            createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, "recharge_orders", orderId), orderData);

        const msg = `¡Hola CuycitoGO! 🐹👋\nSoy *${nick}* (${currentClientUser.name} - Tel: ${currentClientUser.phone}).\nAcabo de realizar una recarga manual de *S/ ${amount.toFixed(2)}* para mi saldo VIP.\nAdjunto mi comprobante para que lo validen y aprueben en el sistema. ¡Muchas gracias! 🙌`;
        
        window.open(`https://wa.me/${CENTRAL_WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`, '_blank');
        window.closeRechargeModal();
        alert("✨ ¡Solicitud de recarga enviada! En cuanto envíes tu comprobante por WhatsApp, el administrador la aprobará en el sistema.");

    } catch (e) {
        console.error(e);
        alert("Error al registrar la solicitud manual.");
    }
};

window.closeRechargeModal = () => {
    const modal = document.getElementById('rechargeModal');
    if (modal) modal.classList.add('hidden');
    if (rechargePollingInterval) clearInterval(rechargePollingInterval);
    if (rechargeCountdownInterval) clearInterval(rechargeCountdownInterval);
};

window.resetRechargeModal = () => {
    const step1 = document.getElementById('rechargeStep1');
    const step2 = document.getElementById('rechargeStep2');
    const waitingBox = document.getElementById('rechargeWaitingBox');
    const successBox = document.getElementById('rechargeSuccessBox');

    if (step1) step1.classList.remove('hidden');
    if (step2) step2.classList.add('hidden');
    if (waitingBox) waitingBox.classList.remove('hidden');
    if (successBox) successBox.classList.add('hidden');

    if (rechargePollingInterval) clearInterval(rechargePollingInterval);
    if (rechargeCountdownInterval) clearInterval(rechargeCountdownInterval);
};

window.selectPresetAmount = (val) => {
    const input = document.getElementById('customRechargeAmount');
    if (input) input.value = val;
};

window.generateRechargeOrder = async () => {
    if (!currentClientUser) return alert("Sesión inválida.");
    const input = document.getElementById('customRechargeAmount');
    const amount = parseFloat(input?.value) || 0;

    if (amount <= 0) return alert("Por favor ingresa un monto válido mayor a 0.");

    const step1 = document.getElementById('rechargeStep1');
    const step2 = document.getElementById('rechargeStep2');

    try {
        // 1. Llamar al backend API de recargas con cabeceras de integridad criptográfica
        const payload = {
            userId: currentClientUser.id,
            amount: amount,
            currency: 'PEN',
            userInfo: {
                name: currentClientUser.name,
                nickname: currentClientUser.nickname || currentClientUser.name,
                phone: currentClientUser.phone
            }
        };

        const secHeaders = window.SecurityGuard 
            ? await window.SecurityGuard.signPayload(payload) 
            : { 'Content-Type': 'application/json' };

        const response = await fetch(`${BACKEND_API_BASE}/api/recharges/create`, {
            method: 'POST',
            headers: secHeaders,
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || "No se pudo generar la orden de recarga en el servidor.");
        }

        const order = data.order;
        activeRechargeOrderId = order.id;

        // 2. Mostrar datos generados con céntimos únicos en Soles (S/)
        document.getElementById('orderExactAmountDisplay').innerText = `S/ ${order.exactAmount.toFixed(2)}`;
        document.getElementById('lemonTagDisplay').innerText = order.lemonTag || '$cmancocambillo';
        
        await window.loadClientPaymentQR();
        if (order.paymentQrUrl) {
            const orderQr = document.getElementById('orderQrImage');
            if (orderQr) orderQr.src = order.paymentQrUrl;
        }

        if (step1) step1.classList.add('hidden');
        if (step2) step2.classList.remove('hidden');

        // 3. Iniciar temporizador de cuenta regresiva (30 minutos)
        startCountdownTimer(new Date(order.expiresAt));

        // 4. Iniciar verificación periódica (polling) del estado de la orden
        startRechargeStatusPolling(order.id);

    } catch (err) {
        console.error("Error al crear orden de recarga:", err);
        
        // Fallback en caso de que el backend API esté iniciando: generar orden en Firestore directamente
        try {
            const randomCents = Math.floor(Math.random() * 90) + 10;
            const exactAmount = parseFloat(`${Math.floor(amount)}.${randomCents}`);
            const orderId = `rec_${Date.now()}_local`;
            activeRechargeOrderId = orderId;

            const orderData = {
                id: orderId,
                userId: currentClientUser.id,
                userName: currentClientUser.name,
                baseAmount: Math.floor(amount),
                cents: randomCents,
                exactAmount: exactAmount,
                currency: 'PEN',
                status: 'pending',
                paymentMethod: 'Lemon Cash',
                lemonTag: '$cmancocambillo',
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
            };

            await setDoc(doc(db, "recharge_orders", orderId), orderData);

            document.getElementById('orderExactAmountDisplay').innerText = `S/ ${exactAmount.toFixed(2)}`;
            await window.loadClientPaymentQR();

            if (step1) step1.classList.add('hidden');
            if (step2) step2.classList.remove('hidden');
            startCountdownTimer(new Date(Date.now() + 30 * 60 * 1000));
            startRechargeStatusPolling(orderId);
        } catch (e2) {
            alert("No se pudo conectar con el servicio de recargas. Por favor verifica que el backend esté activo.");
        }
    }
};

function startCountdownTimer(expirationDate) {
    if (rechargeCountdownInterval) clearInterval(rechargeCountdownInterval);
    const timerDisplay = document.getElementById('orderCountdownTimer');

    function update() {
        const now = new Date();
        const diff = expirationDate - now;
        if (diff <= 0) {
            if (timerDisplay) timerDisplay.innerText = "Expirada";
            clearInterval(rechargeCountdownInterval);
            return;
        }
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        if (timerDisplay) {
            timerDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }

    update();
    rechargeCountdownInterval = setInterval(update, 1000);
}

function startRechargeStatusPolling(orderId) {
    if (rechargePollingInterval) clearInterval(rechargePollingInterval);

    rechargePollingInterval = setInterval(async () => {
        try {
            const ordersSnap = await getDocs(collection(db, "recharge_orders"));
            ordersSnap.forEach(d => {
                const data = d.data();
                if (data.id === orderId && data.status === 'completed') {
                    clearInterval(rechargePollingInterval);
                    if (rechargeCountdownInterval) clearInterval(rechargeCountdownInterval);

                    const waitingBox = document.getElementById('rechargeWaitingBox');
                    const successBox = document.getElementById('rechargeSuccessBox');
                    const details = document.getElementById('rechargeSuccessDetails');

                    if (waitingBox) waitingBox.classList.add('hidden');
                    if (successBox) successBox.classList.remove('hidden');
                    if (details) details.innerText = `Se han acreditado S/ ${(data.exactAmount || data.baseAmount).toFixed(2)} a tu saldo VIP.`;

                    // Refrescar saldo del usuario
                    refreshUserDataFromFirestore();
                }
            });
        } catch (e) {
            console.error("Error consultando estado de recarga:", e);
        }
    }, 4000);
}

window.copyExactAmount = () => {
    const text = document.getElementById('orderExactAmountDisplay')?.innerText.replace('S/', '').replace('$', '').trim();
    if (text) {
        navigator.clipboard.writeText(text).then(() => alert(`📋 ¡Monto exacto copiado: S/ ${text}!`));
    }
};

window.copyTextElement = (elId) => {
    const text = document.getElementById(elId)?.innerText.trim();
    if (text) {
        navigator.clipboard.writeText(text).then(() => alert(`📋 ¡Copiado: ${text}!`));
    }
};

// ==========================================
// 4. EDICIÓN DE PERFIL & WHATSAPP
// ==========================================
window.openEditProfileModal = () => {
    const modal = document.getElementById('editProfileModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeEditProfileModal = () => {
    const modal = document.getElementById('editProfileModal');
    if (modal) modal.classList.add('hidden');
};

window.saveProfileChanges = async () => {
    if (!currentClientUser) return;

    const newNick = document.getElementById('editNickname')?.value.trim();
    const newMail = document.getElementById('editEmail')?.value.trim();
    const newPass = document.getElementById('editPass')?.value.trim();

    if (!newPass) return alert("La contraseña no puede estar vacía.");

    currentClientUser.nickname = newNick || currentClientUser.name;
    currentClientUser.email = newMail;
    currentClientUser.pass = newPass;

    try {
        await setDoc(doc(db, "users", currentClientUser.id), currentClientUser);
        localStorage.setItem("cuycitoClient", JSON.stringify(currentClientUser));
        updateProfileUI();
        window.closeEditProfileModal();
        alert("✨ ¡Perfil actualizado correctamente!");
    } catch (e) {
        alert("Error al actualizar perfil en Firebase.");
    }
};

window.copyText = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        alert(`📋 ¡Copiado: ${text}!`);
    });
};

window.requestRenewalWhatsApp = (serviceName, endDate) => {
    const nick = currentClientUser.nickname || currentClientUser.name;
    const msg = `¡Hola CuycitoGO! 🐹👋\nSoy *${nick}* (${currentClientUser.name}). Deseo renovar mi servicio de *${serviceName}* que vence el *${endDate}*.\n¿Me brindan los datos de pago? ¡Muchas gracias! 🙌`;
    window.open(`https://wa.me/${CENTRAL_WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`, '_blank');
};

window.logoutClient = () => {
    localStorage.removeItem("cuycitoClient");
    window.location.replace("login-cliente.html");
};

function getDaysRemaining(endDateStr) {
    if (!endDateStr) return 0;
    const today = new Date();
    today.setHours(0,0,0,0);
    const end = new Date(endDateStr);
    return Math.ceil((end - today) / 86400000);
}

// ==========================================
// 5. MÓDULO DE JUEGOS: RULETA DE PREMIOS VIP
// ==========================================
let ROULETTE_SLICES = [
    { text: "Más suerte 🍀", color: "#1e293b", textColor: "#94a3b8", cost: 0 },
    { text: "Repite Jugada 🔄", color: "#0284c7", textColor: "#ffffff", cost: 0 },
    { text: "HBO Max VIP 🎬", color: "#7c3aed", textColor: "#ffffff", cost: 8 },
    { text: "Sigue intentando ⚡", color: "#0f172a", textColor: "#64748b", cost: 0 },
    { text: "Crunchyroll 🍿", color: "#ea580c", textColor: "#ffffff", cost: 5 },
    { text: "Netflix 4K VIP 👑", color: "#dc2626", textColor: "#ffffff", cost: 13 },
    { text: "Paramount+ 📺", color: "#2563eb", textColor: "#ffffff", cost: 6 }
];

let rouletteCurrentRotation = 0;
let isRouletteSpinning = false;
let audioCtx = null;
let currentRouletteSettings = null;

function playTickSound() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.04);
    } catch(e) {}
}

function playWinSound() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const notes = [440, 554, 659, 880];
        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.1);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.1 + 0.25);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(audioCtx.currentTime + i * 0.1);
            osc.stop(audioCtx.currentTime + i * 0.1 + 0.25);
        });
    } catch(e) {}
}

window.drawRouletteWheel = (angle = 0) => {
    const canvas = document.getElementById('rouletteCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const numSlices = ROULETTE_SLICES.length;
    const sliceAngle = (2 * Math.PI) / numSlices;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = centerX - 10;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ROULETTE_SLICES.forEach((slice, i) => {
        const startAngle = angle + (i * sliceAngle);
        const endAngle = startAngle + sliceAngle;

        // Dibujar sector
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = slice.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        // Dibujar texto
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = slice.textColor;
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(slice.text, radius - 15, 4);
        ctx.restore();
    });
};

window.switchProfileTab = (tab) => {
    const btnServices = document.getElementById('tabBtnServices');
    const btnRoulette = document.getElementById('tabBtnRoulette');
    const viewServices = document.getElementById('viewProfileServices');
    const viewRoulette = document.getElementById('viewProfileRoulette');

    if (tab === 'services') {
        if (btnServices) btnServices.className = "text-cuycito-gold border-b-2 border-cuycito-gold pb-2 font-black uppercase tracking-wider text-sm transition flex items-center gap-2";
        if (btnRoulette) btnRoulette.className = "text-gray-400 hover:text-white border-b-2 border-transparent pb-2 font-black uppercase tracking-wider text-sm transition flex items-center gap-2 relative";
        if (viewServices) viewServices.classList.remove('hidden');
        if (viewRoulette) viewRoulette.classList.add('hidden');
    } else {
        if (btnRoulette) btnRoulette.className = "text-cuycito-gold border-b-2 border-cuycito-gold pb-2 font-black uppercase tracking-wider text-sm transition flex items-center gap-2 relative";
        if (btnServices) btnServices.className = "text-gray-400 hover:text-white border-b-2 border-transparent pb-2 font-black uppercase tracking-wider text-sm transition flex items-center gap-2";
        if (viewServices) viewServices.classList.add('hidden');
        if (viewRoulette) viewRoulette.classList.remove('hidden');

        // Validar acceso según cantidad de servicios activos (>= 3)
        window.checkRouletteEligibility();
    }
};

window.checkRouletteEligibility = async () => {
    const activeCount = clientSubscriptions.filter(s => getDaysRemaining(s.endDate) >= 0).length;
    const lockedCard = document.getElementById('rouletteLockedCard');
    const activeCont = document.getElementById('rouletteActiveContainer');
    const countText = document.getElementById('rouletteActiveCountText');
    const bar = document.getElementById('rouletteProgressBar');
    const remText = document.getElementById('rouletteRemainingText');
    const disabledNotice = document.getElementById('rouletteDisabledNotice');
    const btnSpin = document.getElementById('btnSpinRoulette');
    const prizesGrid = document.getElementById('roulettePrizesGrid');

    if (countText) countText.innerText = `${activeCount} / 3 Servicios Activos`;
    if (bar) bar.style.width = `${Math.min(100, (activeCount / 3) * 100)}%`;
    if (remText) {
        const remaining = Math.max(0, 3 - activeCount);
        remText.innerText = remaining === 0 
            ? "✨ ¡Requisito completado! Tienes acceso al Módulo de Juegos." 
            : `Te falta(n) ${remaining} servicio(s) activo(s) para desbloquear los Juegos.`;
    }

    if (activeCount >= 3) {
        if (lockedCard) lockedCard.classList.add('hidden');
        if (activeCont) activeCont.classList.remove('hidden');

        // Cargar configuración de la Ruleta desde Firestore
        try {
            const docSnap = await getDoc(doc(db, "game_settings", "roulette"));
            if (docSnap.exists()) {
                currentRouletteSettings = docSnap.data();
            }
        } catch(e) {}

        const isEnabled = currentRouletteSettings?.enabled !== false;

        if (!isEnabled) {
            if (disabledNotice) disabledNotice.classList.remove('hidden');
            if (btnSpin) {
                btnSpin.disabled = true;
                btnSpin.classList.add('opacity-50', 'cursor-not-allowed');
            }
        } else {
            if (disabledNotice) disabledNotice.classList.add('hidden');
            if (btnSpin) {
                btnSpin.disabled = false;
                btnSpin.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }

        // Construir sectores dinámicos si hay servicios configurados
        if (currentRouletteSettings?.services && currentRouletteSettings.services.length > 0) {
            const dynamicSlices = [
                { text: "Más suerte 🍀", color: "#1e293b", textColor: "#94a3b8", cost: 0 },
                { text: "Repite Jugada 🔄", color: "#0284c7", textColor: "#ffffff", cost: 0 }
            ];

            let prizesHtml = '';
            currentRouletteSettings.services.forEach(srv => {
                const stock = parseInt(srv.stock || 0);
                const color = srv.color || '#dc2626';
                dynamicSlices.push({
                    text: srv.serviceName,
                    color: color,
                    textColor: srv.textColor || '#ffffff',
                    cost: parseFloat(srv.cost || 0),
                    stock: stock
                });

                prizesHtml += `
                <div class="bg-black/60 border border-gray-800 p-2.5 rounded-xl flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-lg text-white flex items-center justify-center font-black text-xs" style="background-color: ${color}">
                            ${srv.serviceName.charAt(0)}
                        </div>
                        <div>
                            <strong class="text-white block text-[11px]">${srv.serviceName}</strong>
                            <span class="text-[9px] text-gray-400 font-mono">${stock > 0 ? `🟢 Stock: ${stock}` : `🔴 Agotado`}</span>
                        </div>
                    </div>
                    <span class="text-[10px] font-bold ${stock > 0 ? 'text-emerald-400' : 'text-gray-500'}">
                        ${stock > 0 ? 'Disponible' : 'Sin Stock'}
                    </span>
                </div>`;
            });

            dynamicSlices.push({ text: "Sigue intentando ⚡", color: "#0f172a", textColor: "#64748b", cost: 0 });
            ROULETTE_SLICES = dynamicSlices;

            prizesHtml += `
            <div class="bg-black/60 border border-sky-500/40 p-2.5 rounded-xl flex items-center gap-2 col-span-2">
                <div class="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center font-black text-xs"><i class="fa-solid fa-rotate-right"></i></div>
                <div>
                    <strong class="text-white block text-[11px]">Repite la Jugada (Free Spin)</strong>
                    <span class="text-[9px] text-sky-400 font-mono">¡Giro 100% Gratis de inmediato!</span>
                </div>
            </div>`;

            if (prizesGrid) prizesGrid.innerHTML = prizesHtml;
        }

        window.drawRouletteWheel(rouletteCurrentRotation);
        window.loadUserGameStats();
    } else {
        if (lockedCard) lockedCard.classList.remove('hidden');
        if (activeCont) activeCont.classList.add('hidden');
    }
};

window.spinRouletteWheel = async () => {
    if (isRouletteSpinning) return;
    if (!currentClientUser) return alert("Sesión inválida.");

    const currentBal = parseFloat(currentClientUser.balance || 0);
    if (currentBal < 1.00) {
        return alert("Saldo insuficiente. Necesitas al menos S/ 1.00 de saldo para girar la Ruleta. Recarga saldo a tu cuenta en la tienda o por WhatsApp.");
    }

    if (window.SecurityGuard && !window.SecurityGuard.checkSpinInterval(4000)) {
        return alert("⚠️ Por favor espera a que termine la animación del giro actual.");
    }

    const btnSpin = document.getElementById('btnSpinRoulette');
    if (btnSpin) btnSpin.disabled = true;
    isRouletteSpinning = true;

    try {
        let spinResult = null;
        try {
            const spinPayload = {
                userId: currentClientUser.id,
                userName: currentClientUser.name
            };

            const secHeaders = window.SecurityGuard 
                ? await window.SecurityGuard.signPayload(spinPayload) 
                : { 'Content-Type': 'application/json' };

            const res = await fetch(`${BACKEND_API_BASE}/api/games/spin`, {
                method: 'POST',
                headers: secHeaders,
                body: JSON.stringify(spinPayload)
            });

            if (res.ok) {
                spinResult = await res.json();
            } else {
                const errData = await res.json();
                throw new Error(errData.message || errData.error || "No se pudo procesar el giro.");
            }
        } catch (backendErr) {
            console.warn("Backend no disponible para giro, procesando de forma segura en Firebase:", backendErr);
            // Fallback local seguro
            const randIndex = Math.random() < 0.8 ? (Math.random() < 0.5 ? 0 : 3) : (Math.random() < 0.7 ? 1 : 4);
            const prize = ROULETTE_SLICES[randIndex] || ROULETTE_SLICES[0];
            const newBal = parseFloat((currentBal - 1.00 + (randIndex === 1 ? 1.00 : 0)).toFixed(2));
            
            await setDoc(doc(db, "users", currentClientUser.id), { balance: newBal }, { merge: true });
            const spinId = `spin_loc_${Date.now()}`;
            await setDoc(doc(db, "game_spins", spinId), {
                id: spinId,
                userId: currentClientUser.id,
                userName: currentClientUser.name,
                cost: 1.00,
                prizeTitle: prize.text,
                sliceIndex: randIndex,
                prizeCostForHouse: prize.cost || 0,
                timestamp: new Date().toISOString()
            });

            spinResult = {
                sliceIndex: randIndex,
                prize: { title: prize.text, cost: prize.cost || 0 },
                newBalance: newBal
            };
        }

        const targetSliceIndex = spinResult.sliceIndex !== undefined ? spinResult.sliceIndex : 0;
        const numSlices = ROULETTE_SLICES.length;
        const sliceAngle = (2 * Math.PI) / numSlices;
        
        // Calcular ángulo objetivo alineado con la flecha superior (-PI/2)
        const baseSpins = 5 + Math.floor(Math.random() * 3); // Entre 5 y 7 vueltas completas
        const targetAngle = (baseSpins * 2 * Math.PI) + ((numSlices - targetSliceIndex) * sliceAngle) - (sliceAngle / 2) - (Math.PI / 2);

        const startTime = performance.now();
        const duration = 4000; // 4 segundos de giro
        const initialAngle = rouletteCurrentRotation % (2 * Math.PI);
        let lastTickAngle = initialAngle;

        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(1, elapsed / duration);
            // Easing cúbico desacelerado
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            rouletteCurrentRotation = initialAngle + (targetAngle - initialAngle) * easeOut;
            window.drawRouletteWheel(rouletteCurrentRotation);

            // Efecto de sonido de clic al pasar cada sector
            if (Math.abs(rouletteCurrentRotation - lastTickAngle) >= sliceAngle) {
                playTickSound();
                lastTickAngle = rouletteCurrentRotation;
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                isRouletteSpinning = false;
                if (btnSpin) btnSpin.disabled = false;

                // Actualizar saldo del usuario
                currentClientUser.balance = spinResult.newBalance;
                localStorage.setItem("cuycitoClient", JSON.stringify(currentClientUser));
                updateProfileUI();

                // Mostrar resultado en la Ventana Flotante Animada
                window.showRoulettePrizeModal(spinResult, targetSliceIndex);

                // Si el juego se auto-deshabilitó por agotamiento de stock
                if (spinResult.autoDisabledNotice) {
                    setTimeout(() => {
                        alert("⚠️ ¡Atención! Se ha agotado el stock total de cuentas de la Ruleta. El juego ha entrado en pausa automática hasta que el administrador reponga unidades.");
                    }, 800);
                }

                window.checkRouletteEligibility();
            }
        }

        requestAnimationFrame(animate);

    } catch (e) {
        console.error(e);
        alert(e.message || "Error al procesar el giro de la ruleta.");
        isRouletteSpinning = false;
        if (btnSpin) btnSpin.disabled = false;
    }
};

// Variable para almacenar el último premio ganado en memoria
let lastWonPrizeData = null;

window.showRoulettePrizeModal = (spinResult, targetSliceIndex) => {
    const modal = document.getElementById('roulettePrizeModal');
    const card = document.getElementById('roulettePrizeCard');
    const iconWrapper = document.getElementById('prizeModalIconWrapper');
    const badge = document.getElementById('prizeModalBadge');
    const title = document.getElementById('prizeModalTitle');
    const desc = document.getElementById('prizeModalDesc');
    const userNameEl = document.getElementById('prizeModalUserName');
    const userBalEl = document.getElementById('prizeModalNewBalance');
    const btnMain = document.getElementById('prizeModalBtnMain');
    const btnSecondary = document.getElementById('prizeModalBtnSecondary');
    const glow = document.getElementById('prizeModalGlow');

    if (!modal || !card) return;

    const prize = spinResult.prize || {};
    lastWonPrizeData = prize;

    const nick = currentClientUser.nickname || currentClientUser.name;
    if (userNameEl) userNameEl.innerText = `${nick} (${currentClientUser.phone})`;
    if (userBalEl) userBalEl.innerText = `S/ ${parseFloat(currentClientUser.balance || 0).toFixed(2)}`;

    const isServiceWin = (prize.cost > 0) || (prize.serviceName);
    const isFreeSpin = targetSliceIndex === 1;

    if (isServiceWin) {
        playWinSound();
        if (iconWrapper) {
            iconWrapper.innerText = '🎁';
            iconWrapper.className = "w-24 h-24 mx-auto rounded-3xl bg-gradient-to-tr from-amber-400 via-yellow-500 to-yellow-200 text-black flex items-center justify-center text-5xl shadow-[0_0_40px_rgba(255,183,3,0.6)] animate-bounce";
        }
        if (badge) {
            badge.innerText = '🏆 ¡PREMIO GANADO!';
            badge.className = 'text-[11px] font-black uppercase tracking-widest px-3.5 py-1.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/50 inline-block shadow';
        }
        if (title) {
            title.innerText = prize.title || prize.serviceName || 'Cuenta VIP';
            title.className = 'text-2xl sm:text-3xl font-black text-cuycito-gold glow-gold';
        }
        if (desc) {
            desc.innerText = `¡Felicidades! Has ganado una suscripción completa de ${prize.title || prize.serviceName}. Haz clic abajo para recibir tus accesos oficiales de inmediato por WhatsApp.`;
        }
        if (glow) glow.className = "absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-cuycito-gold/30 rounded-full blur-3xl pointer-events-none";

        if (btnMain) {
            btnMain.className = "w-full bg-[#25D366] hover:bg-emerald-400 text-black font-black text-sm py-4 px-6 rounded-2xl transition shadow-2xl glow-gold flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-95";
            btnMain.innerHTML = `<i class="fa-brands fa-whatsapp text-xl"></i> <span>Reclamar Premio por WhatsApp</span>`;
            btnMain.onclick = window.claimRoulettePrizeWhatsApp;
        }
        if (btnSecondary) {
            btnSecondary.className = "w-full bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white font-bold text-xs py-3 rounded-2xl transition flex items-center justify-center gap-2";
            btnSecondary.innerHTML = `<i class="fa-solid fa-rotate-right"></i> <span>Seguir Jugando en la Ruleta (S/ 1.00)</span>`;
            btnSecondary.onclick = window.spinAgainFromModal;
        }

    } else if (isFreeSpin) {
        playWinSound();
        if (iconWrapper) {
            iconWrapper.innerText = '🔄';
            iconWrapper.className = "w-24 h-24 mx-auto rounded-3xl bg-gradient-to-tr from-sky-400 to-blue-600 text-white flex items-center justify-center text-5xl shadow-[0_0_35px_rgba(56,189,248,0.5)] animate-bounce";
        }
        if (badge) {
            badge.innerText = '✨ ¡GIRO GRATIS!';
            badge.className = 'text-[11px] font-black uppercase tracking-widest px-3.5 py-1.5 rounded-full bg-sky-950 text-sky-400 border border-sky-500/50 inline-block shadow';
        }
        if (title) {
            title.innerText = '¡Repites Jugada Gratis!';
            title.className = 'text-2xl sm:text-3xl font-black text-sky-300';
        }
        if (desc) {
            desc.innerText = '¡La suerte está de tu lado! Se te ha reembolsado S/ 1.00 a tu saldo para que vuelvas a girar inmediatamente gratis.';
        }
        if (glow) glow.className = "absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-sky-500/25 rounded-full blur-3xl pointer-events-none";

        if (btnMain) {
            btnMain.className = "w-full bg-sky-500 hover:bg-sky-400 text-black font-black text-sm py-4 px-6 rounded-2xl transition shadow-xl flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-95";
            btnMain.innerHTML = `<i class="fa-solid fa-bolt"></i> <span>¡Girar de Nuevo Gratis!</span>`;
            btnMain.onclick = window.spinAgainFromModal;
        }
        if (btnSecondary) {
            btnSecondary.className = "w-full bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-400 hover:text-white text-xs py-3 rounded-2xl transition";
            btnSecondary.innerHTML = `<span>Cerrar</span>`;
            btnSecondary.onclick = window.closeRoulettePrizeModal;
        }

    } else {
        // Más suerte / Sigue intentando
        if (iconWrapper) {
            iconWrapper.innerText = '🍀';
            iconWrapper.className = "w-24 h-24 mx-auto rounded-3xl bg-gradient-to-tr from-gray-700 to-gray-900 text-white flex items-center justify-center text-5xl shadow-xl";
        }
        if (badge) {
            badge.innerText = '🎲 SIGUE JUGANDO';
            badge.className = 'text-[11px] font-black uppercase tracking-widest px-3.5 py-1.5 rounded-full bg-gray-900 text-gray-400 border border-gray-700 inline-block';
        }
        if (title) {
            title.innerText = '¡Casi lo logras!';
            title.className = 'text-2xl sm:text-3xl font-black text-white';
        }
        if (desc) {
            desc.innerText = '¡Más suerte para la próxima! Cada giro de 1 Sol tiene oportunidades reales de ganar cuentas completas.';
        }
        if (glow) glow.className = "absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-gray-800/30 rounded-full blur-3xl pointer-events-none";

        if (btnMain) {
            btnMain.className = "w-full bg-gradient-to-r from-cuycito-gold to-yellow-500 hover:from-yellow-400 hover:to-yellow-300 text-black font-black text-sm py-4 px-6 rounded-2xl transition shadow-xl glow-gold flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-95";
            btnMain.innerHTML = `<i class="fa-solid fa-dice"></i> <span>Girar de Nuevo (S/ 1.00)</span>`;
            btnMain.onclick = window.spinAgainFromModal;
        }
        if (btnSecondary) {
            btnSecondary.className = "w-full bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-400 hover:text-white text-xs py-3 rounded-2xl transition";
            btnSecondary.innerHTML = `<span>Cerrar</span>`;
            btnSecondary.onclick = window.closeRoulettePrizeModal;
        }
    }

    // Mostrar modal con animación fluida
    modal.classList.remove('hidden');
    setTimeout(() => {
        card.classList.remove('scale-95', 'opacity-0');
        card.classList.add('scale-100', 'opacity-100');
    }, 20);
};

window.closeRoulettePrizeModal = () => {
    const modal = document.getElementById('roulettePrizeModal');
    const card = document.getElementById('roulettePrizeCard');
    if (!modal || !card) return;

    card.classList.remove('scale-100', 'opacity-100');
    card.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 250);
};

window.spinAgainFromModal = () => {
    window.closeRoulettePrizeModal();
    setTimeout(() => {
        window.spinRouletteWheel();
    }, 300);
};

window.claimRoulettePrizeWhatsApp = () => {
    if (!lastWonPrizeData || !currentClientUser) return;
    const prizeName = lastWonPrizeData.title || lastWonPrizeData.serviceName || 'Premio VIP';
    const nick = currentClientUser.nickname || currentClientUser.name;
    const msg = `¡Hola CuycitoGO! 🐹🎁👑\n\nSoy *${nick}* (${currentClientUser.name} - Tel: ${currentClientUser.phone}).\n🎉 ¡Acabo de ganar *${prizeName}* en la Ruleta VIP del Club CuycitoGO!\n\n¿Me pueden enviar los accesos de mi cuenta premiada? ¡Muchas gracias! 🙌`;

    window.open(`https://wa.me/${CENTRAL_WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`, '_blank');
    window.closeRoulettePrizeModal();
};

window.loadUserGameStats = async () => {
    // Ya no es necesario renderizar la tabla de gastos personales del cliente
};
