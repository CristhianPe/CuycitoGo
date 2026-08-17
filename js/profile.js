import { db, collection, getDocs, doc, setDoc } from "./firebase-config.js";

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

    if (navNick) navNick.innerText = `@${nickname}`;
    if (navPhone) navPhone.innerText = phone;
    if (headerNick) headerNick.innerText = `@${nickname}`;
    if (headerReal) headerReal.innerText = realName;
    if (headerPhone) headerPhone.innerText = phone;
    if (headerMail) headerMail.innerText = email;
    if (balanceDisplay) balanceDisplay.innerText = `$ ${balance}`;
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
window.openRechargeModal = async () => {
    const modal = document.getElementById('rechargeModal');
    if (!modal) return;
    window.resetRechargeModal();
    modal.classList.remove('hidden');
    
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
        // 1. Llamar al backend API de recargas
        const response = await fetch(`${BACKEND_API_BASE}/api/recharges/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentClientUser.id,
                amount: amount,
                currency: 'USD',
                userInfo: {
                    name: currentClientUser.name,
                    nickname: currentClientUser.nickname || currentClientUser.name,
                    phone: currentClientUser.phone
                }
            })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || "No se pudo generar la orden de recarga en el servidor.");
        }

        const order = data.order;
        activeRechargeOrderId = order.id;

        // 2. Mostrar datos generados con céntimos únicos en la UI
        document.getElementById('orderExactAmountDisplay').innerText = `$ ${order.exactAmount.toFixed(2)}`;
        document.getElementById('lemonTagDisplay').innerText = order.lemonTag || '$cuycitogo';
        document.getElementById('lemonAliasDisplay').innerText = order.lemonAlias || 'cuycitogo.lemon';
        document.getElementById('lemonCVUDisplay').innerText = order.lemonCVU || '0000123400005678901234';

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
                currency: 'USD',
                status: 'pending',
                paymentMethod: 'Lemon Cash',
                lemonTag: '$cuycitogo',
                lemonAlias: 'cuycitogo.lemon',
                lemonCVU: '0000123400005678901234',
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
            };

            await setDoc(doc(db, "recharge_orders", orderId), orderData);

            document.getElementById('orderExactAmountDisplay').innerText = `$ ${exactAmount.toFixed(2)}`;
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
            // Consultar a Firestore o API
            const ordersSnap = await getDocs(collection(db, "recharge_orders"));
            ordersSnap.forEach(d => {
                const data = d.data();
                if (data.id === orderId && data.status === 'completed') {
                    // ¡Acreditación detectada!
                    clearInterval(rechargePollingInterval);
                    if (rechargeCountdownInterval) clearInterval(rechargeCountdownInterval);

                    const waitingBox = document.getElementById('rechargeWaitingBox');
                    const successBox = document.getElementById('rechargeSuccessBox');
                    const details = document.getElementById('rechargeSuccessDetails');

                    if (waitingBox) waitingBox.classList.add('hidden');
                    if (successBox) successBox.classList.remove('hidden');
                    if (details) details.innerText = `Se han acreditado $${(data.exactAmount || data.baseAmount).toFixed(2)} USD a tu saldo.`;

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
    const text = document.getElementById('orderExactAmountDisplay')?.innerText.replace('$', '').trim();
    if (text) {
        navigator.clipboard.writeText(text).then(() => alert(`📋 ¡Monto exacto copiado: $${text}!`));
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
