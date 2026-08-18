import { db, collection, getDocs, getDoc, doc, setDoc } from "./firebase-config.js";

// Estado de la sesión del cliente
let currentClientUser = null;
let clientSubscriptions = [];
let allMasterAccounts = [];
let activeRechargeOrderId = null;
let rechargePollingInterval = null;
let rechargeCountdownInterval = null;

const CENTRAL_WHATSAPP_PHONE = "";
const BACKEND_API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:5000' 
    : 'http://localhost:5000'; // Ajustable según host de backend

const DEFAULT_CATALOG_PRODUCTS = [
    {
        id: "prod_combo_duo",
        title: "Combo Dúo: Netflix + Crunchyroll",
        category: "COMBOS",
        description: "Disfruta de tus plataformas favoritas en un solo combo con perfiles privados independientes, calidad 4K Ultra HD y garantía total 30 días.",
        price: 17.00,
        imageUrl: "assets/img/promo_combo_duo.jpg",
        promo: true,
        isCombo: true
    },
    {
        id: "prod_netflix_1p",
        title: "Netflix Premium 4K - 1 Perfil Privado",
        category: "STREAMING",
        description: "1 Perfil Privado con PIN personalizado. Calidad 4K Ultra HD y garantía 100% durante 30 días. Descuento por apertura web.",
        price: 15.00,
        imageUrl: "assets/img/promo_netflix_4k.jpg",
        promo: false
    },
    {
        id: "prod_combo_trio",
        title: "Combo Trío Total: Netflix + Disney ESPN + Max",
        category: "COMBOS",
        description: "El paquete definitivo de entretenimiento para toda la familia con PIN privado y 4K Ultra HD.",
        price: 32.00,
        imageUrl: "assets/img/promo_combo_trio.jpg",
        promo: true,
        isCombo: true
    },
    {
        id: "prod_disney_1p",
        title: "Disney+ Premium 4K - 1 Perfil Privado",
        category: "STREAMING",
        description: "1 Perfil Privado con PIN personalizado. Calidad 4K Ultra HD, ESPN y garantía 100% durante 30 días.",
        price: 10.00,
        imageUrl: "assets/img/banner_disney.svg",
        promo: false
    },
    {
        id: "prod_prime_1p",
        title: "Prime Video Premium 4K - 1 Perfil Privado",
        category: "STREAMING",
        description: "1 Perfil Privado con PIN personalizado. Calidad 4K Ultra HD y acceso a todas las series Amazon Originals.",
        price: 6.00,
        imageUrl: "assets/img/banner_prime.svg",
        promo: false
    },
    {
        id: "prod_max_1p",
        title: "Max Platino 4K - 1 Perfil Privado",
        category: "STREAMING",
        description: "Disfruta de HBO Max Platino en 4K Ultra HD con PIN privado.",
        price: 9.00,
        imageUrl: "assets/img/banner_max.svg",
        promo: false
    },
    {
        id: "prod_spotify_ind",
        title: "Spotify Premium Individual (1 Mes)",
        category: "MUSICA",
        description: "Cuenta o renovación de tu cuenta personal Spotify Premium sin anuncios.",
        price: 8.00,
        imageUrl: "assets/img/banner_spotify.svg",
        promo: false
    },
    {
        id: "prod_crunchyroll_1p",
        title: "Crunchyroll Mega Fan - 1 Perfil",
        category: "GAMING",
        description: "Disfruta de todo el anime en HD sin anuncios y estrenos en simulcast.",
        price: 7.00,
        imageUrl: "assets/img/banner_crunchyroll.svg",
        promo: false
    }
];

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
        if (currentClientUser.isDemo || currentClientUser.phone === 'cuycitogodemo' || currentClientUser.id === 'demo_cuycito_user') {
            if (currentClientUser.balance === undefined || currentClientUser.balance === null || currentClientUser.balance <= 0) {
                currentClientUser.balance = 50.00;
            }
            if (!currentClientUser.referredCodeUsed) {
                currentClientUser.referredCodeUsed = "VIP-JUAN-7K9A";
            }
            localStorage.setItem("cuycitoClient", JSON.stringify(currentClientUser));
        }
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

// Actualizar métricas del dashboard cliente (5 Estados)
function calculateMetrics(subs) {
    const totalEl = document.getElementById('metricTotal');
    const activeEl = document.getElementById('metricActive');
    const pendingEl = document.getElementById('metricPending');
    const expiringEl = document.getElementById('metricExpiring');
    const expiredEl = document.getElementById('metricExpired');

    const total = (subs || []).length;
    let active = 0;
    let pending = 0;
    let expiring = 0;
    let expired = 0;

    (subs || []).forEach(s => {
        if (s.status === 'pending_activation' || s.status === 'pending') {
            pending++;
        } else {
            const days = getDaysRemaining(s.endDate);
            if (days < 0) {
                expired++;
            } else if (days <= 3) {
                expiring++;
                active++;
            } else {
                active++;
            }
        }
    });

    if (totalEl) totalEl.innerText = total;
    if (activeEl) activeEl.innerText = active;
    if (pendingEl) pendingEl.innerText = pending;
    if (expiringEl) expiringEl.innerText = expiring;
    if (expiredEl) expiredEl.innerText = expired;
}

const updateMetrics = calculateMetrics;

window.filterServicesList = () => {
    const searchInput = document.getElementById('searchServiceInput');
    const statusFilter = document.getElementById('statusServiceFilter')?.value || 'ALL';
    const query = (searchInput?.value || '').toLowerCase().trim();

    const filtered = clientSubscriptions.filter(sub => {
        const matchesQuery = !query || 
            (sub.service && sub.service.toLowerCase().includes(query)) ||
            (sub.email && sub.email.toLowerCase().includes(query));

        const days = getDaysRemaining(sub.endDate);
        const isPending = sub.status === 'pending_activation' || sub.status === 'pending';
        const isExpired = !isPending && days < 0;
        const isExpiring = !isPending && days >= 0 && days <= 3;
        const isActive = !isPending && days >= 0;

        let matchesStatus = true;
        if (statusFilter === 'ACTIVE') matchesStatus = isActive;
        else if (statusFilter === 'PENDING') matchesStatus = isPending;
        else if (statusFilter === 'EXPIRING') matchesStatus = isExpiring;
        else if (statusFilter === 'EXPIRED') matchesStatus = isExpired;

        return matchesQuery && matchesStatus;
    });

    renderClientSubscriptions(filtered);
};

// Renderizado de las tarjetas de servicios comprados
function renderClientSubscriptions(subs) {
    const container = document.getElementById('servicesContainer');
    if (!container) return;

    if (subs.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-16 text-center text-gray-500 space-y-3 bg-[#121212] rounded-3xl border border-gray-800 p-8">
                <i class="fa-solid fa-tv text-4xl text-gray-600"></i>
                <p class="text-sm font-semibold text-gray-400">Aún no tienes servicios en esta categoría.</p>
                <p class="text-xs text-gray-500 max-w-sm mx-auto">Explora nuestro catálogo en la tienda y adquiere tus pantallas privadas con activación inmediata.</p>
                <button onclick="window.switchProfileTab('catalog')" class="inline-block bg-cuycito-gold text-black font-extrabold text-xs px-5 py-2.5 rounded-xl transition shadow glow-gold mt-2">
                    <i class="fa-solid fa-store mr-1.5"></i> Explorar Tienda VIP
                </button>
            </div>
        `;
        return;
    }

    let html = '';
    subs.forEach(sub => {
        const days = getDaysRemaining(sub.endDate);
        const isPending = sub.status === 'pending_activation' || sub.status === 'pending';
        const isExpired = !isPending && days < 0;
        const isExpiring = !isPending && days <= 3 && !isExpired;

        let statusBadge = '';
        let borderClass = 'border-gray-800';

        if (isPending) {
            statusBadge = `<span class="bg-yellow-950/80 text-yellow-300 border border-yellow-500/50 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 animate-pulse"><i class="fa-solid fa-hourglass-half"></i> Pendiente de Activación</span>`;
            borderClass = 'border-yellow-500/60 shadow-[0_0_20px_rgba(234,179,8,0.15)]';
        } else if (isExpired) {
            statusBadge = `<span class="bg-red-950/80 text-red-400 border border-cuycito-red/50 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1"><i class="fa-solid fa-circle-xmark"></i> Vencido</span>`;
            borderClass = 'border-red-950/60';
        } else if (isExpiring) {
            statusBadge = `<span class="bg-amber-950/80 text-cuycito-gold border border-cuycito-gold/50 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 animate-pulse"><i class="fa-solid fa-triangle-exclamation"></i> Por Vencer (${days} d)</span>`;
            borderClass = 'border-cuycito-gold/50';
        } else {
            statusBadge = `<span class="bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1"><i class="fa-solid fa-circle-check"></i> Activo (${days} d)</span>`;
            borderClass = 'border-gray-800 hover:border-emerald-500/40';
        }

        // POLÍTICA DE VISIBILIDAD DE CREDENCIALES & QR DE TV
        let credentialsBlockHTML = '';
        if (isPending) {
            if (sub.tvQrImage) {
                credentialsBlockHTML = `
                    <div class="bg-gradient-to-r from-emerald-950/40 via-black to-emerald-950/20 border border-emerald-500/50 rounded-2xl p-3 text-center space-y-2">
                        <div class="flex items-center justify-center gap-2 text-emerald-400 font-bold text-xs">
                            <i class="fa-solid fa-circle-check text-sm"></i>
                            <span>Foto QR de TV Enviada</span>
                        </div>
                        <div class="w-24 h-24 mx-auto rounded-xl overflow-hidden border border-emerald-500/40 shadow-inner bg-black">
                            <img src="${sub.tvQrImage}" alt="QR TV" class="w-full h-full object-contain">
                        </div>
                        <p class="text-[10px] text-gray-300">Tu asesor está escaneando el QR para activar tu TV. Recibirás tu confirmación en breve.</p>
                    </div>
                `;
            } else {
                credentialsBlockHTML = `
                    <div class="bg-gradient-to-r from-amber-950/40 via-black to-amber-950/20 border border-yellow-500/40 rounded-2xl p-3.5 text-center space-y-2">
                        <div class="flex items-center justify-center gap-2 text-yellow-400 font-bold text-xs">
                            <i class="fa-solid fa-tv text-sm"></i>
                            <span>Activación en Televisor Requerida (1 TV)</span>
                        </div>
                        <p class="text-[11px] text-gray-300 leading-snug">Se necesita captura del código QR de activación de tu televisor. Abre la app en tu TV y toma la foto para vincular tu pantalla.</p>
                    </div>
                `;
            }
        } else if (sub.email || sub.pass) {
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

        let actionBtnHTML = '';
        if (isPending) {
            const btnText = sub.tvQrImage ? 'Cambiar Foto QR de mi TV' : 'Tomar Foto QR de mi TV (1 TV)';
            const btnIcon = sub.tvQrImage ? 'fa-solid fa-rotate' : 'fa-solid fa-camera';
            actionBtnHTML = `
                <button onclick="window.openTvQrModal('${sub.id}', '${sub.service}')" class="w-full bg-gradient-to-r from-amber-500 via-cuycito-gold to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs py-3 px-3 rounded-xl transition shadow-xl glow-gold flex items-center justify-center gap-2 uppercase tracking-wider">
                    <i class="${btnIcon} text-sm"></i>
                    <span>${btnText}</span>
                </button>
            `;
        } else {
            actionBtnHTML = `
                <button onclick="window.requestRenewalWhatsApp('${sub.service}', '${sub.endDate}')" class="w-full bg-gradient-to-r from-cuycito-red to-cuycito-redHover hover:from-cuycito-redHover hover:to-cuycito-gold text-white font-extrabold text-xs py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-2 shadow glow-red">
                    <i class="fa-solid fa-rotate-right text-sm"></i>
                    <span>Renovar Servicio</span>
                </button>
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
                ${actionBtnHTML}
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

// ==========================================
// CONTROLADOR DE CAPTURA DE FOTO QR DE LA TV
// ==========================================
let activeActivationSubId = null;
let activeActivationServiceName = '';
let currentTvQrBase64 = null;

window.openTvQrModal = (subId, serviceName) => {
    activeActivationSubId = subId;
    activeActivationServiceName = serviceName;
    currentTvQrBase64 = null;

    const modal = document.getElementById('tvQrUploadModal');
    const nameDisplay = document.getElementById('tvQrServiceNameDisplay');
    const previewImg = document.getElementById('tvQrPreviewImage');
    const placeholder = document.getElementById('tvQrPlaceholder');
    const btnSubmit = document.getElementById('btnSubmitTvQr');
    const fileInput = document.getElementById('tvQrFileInput');

    if (nameDisplay) nameDisplay.innerText = serviceName || 'Servicio TV';
    if (previewImg) {
        previewImg.src = '';
        previewImg.classList.add('hidden');
    }
    if (placeholder) placeholder.classList.remove('hidden');
    if (btnSubmit) btnSubmit.disabled = true;
    if (fileInput) fileInput.value = '';

    // Si ya tenía imagen previa, mostrarla
    const currentSub = clientSubscriptions.find(s => s.id === subId);
    if (currentSub && currentSub.tvQrImage) {
        currentTvQrBase64 = currentSub.tvQrImage;
        if (previewImg) {
            previewImg.src = currentSub.tvQrImage;
            previewImg.classList.remove('hidden');
        }
        if (placeholder) placeholder.classList.add('hidden');
        if (btnSubmit) btnSubmit.disabled = false;
    }

    if (modal) modal.classList.remove('hidden');
};

window.closeTvQrUploadModal = () => {
    const modal = document.getElementById('tvQrUploadModal');
    if (modal) modal.classList.add('hidden');
};

window.handleTvQrFileSelect = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    // Validación estricta: Solo 1 imagen, no videos
    if (!file.type.startsWith('image/')) {
        alert('⚠️ Solo se permite subir archivos de imagen (JPG, PNG o WEBP). No se permiten videos.');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const base64Data = e.target.result;
        currentTvQrBase64 = base64Data;

        const previewImg = document.getElementById('tvQrPreviewImage');
        const placeholder = document.getElementById('tvQrPlaceholder');
        const btnSubmit = document.getElementById('btnSubmitTvQr');

        if (previewImg) {
            previewImg.src = base64Data;
            previewImg.classList.remove('hidden');
        }
        if (placeholder) placeholder.classList.add('hidden');
        if (btnSubmit) btnSubmit.disabled = false;
    };
    reader.readAsDataURL(file);
};

window.submitTvQrForActivation = async () => {
    if (!activeActivationSubId || !currentTvQrBase64) {
        alert('Por favor toma una foto o selecciona la imagen del QR de tu TV antes de enviar.');
        return;
    }

    const sub = clientSubscriptions.find(s => s.id === activeActivationSubId);
    if (sub) {
        sub.tvQrImage = currentTvQrBase64;
        sub.tvQrSubmittedAt = new Date().toISOString();
        sub.status = 'pending_activation';
    }

    try {
        await setDoc(doc(db, "subscriptions", activeActivationSubId), {
            tvQrImage: currentTvQrBase64,
            tvQrSubmittedAt: new Date().toISOString(),
            status: 'pending_activation'
        }, { merge: true });
    } catch(e) {}

    // Emitir alerta en tiempo real al Dashboard con la foto QR
    try {
        localStorage.setItem("cuycito_tv_qr_alert_trigger", JSON.stringify({
            subId: activeActivationSubId,
            serviceName: activeActivationServiceName,
            userName: currentClientUser ? currentClientUser.name : "Cliente VIP",
            userNickname: currentClientUser ? (currentClientUser.nickname || currentClientUser.name) : "Cliente VIP",
            userEmail: currentClientUser ? (currentClientUser.email || currentClientUser.phone || '') : '',
            tvQrImage: currentTvQrBase64,
            timestamp: Date.now()
        }));
    } catch(e) {}

    window.closeTvQrUploadModal();
    renderClientSubscriptions(clientSubscriptions);
    calculateMetrics(clientSubscriptions);

    alert(`📺 ¡Foto QR de tu TV enviada con éxito!\n\nTu asesor ha recibido la captura del código QR de tu televisor (${activeActivationServiceName}) y procederá a activarlo de inmediato.`);
};

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

window.submitManualRechargeRequest = async () => {
    if (!currentClientUser) return alert("Sesión inválida.");
    const input = document.getElementById('manualRechargeAmountInput');
    const amount = parseFloat(input?.value) || 0;
    if (amount <= 0) return alert("Por favor ingresa un monto válido a recargar.");

    const orderId = `rec_man_${Date.now()}`;
    const nick = currentClientUser.nickname || currentClientUser.name;
    const currentBal = parseFloat(currentClientUser.balance || 0);

    try {
        const orderData = {
            id: orderId,
            userId: currentClientUser.id,
            userName: currentClientUser.name,
            userPhone: currentClientUser.phone || '',
            userNickname: nick,
            userEmail: currentClientUser.email || '',
            baseAmount: amount,
            cents: 0,
            exactAmount: amount,
            currentBalance: currentBal,
            projectedBalance: currentBal + amount,
            currency: 'PEN',
            status: 'pending_manual',
            paymentMethod: 'Manual (Yape/Plin/QR)',
            createdAt: new Date().toISOString()
        };

        // Guardar en Firestore y LocalStorage
        try {
            await setDoc(doc(db, "recharge_orders", orderId), orderData);
        } catch(e) {
            console.warn("Error guardando orden en Firestore, guardando local:", e);
        }

        let orders = [];
        try {
            orders = JSON.parse(localStorage.getItem("cuycito_recharges") || "[]");
        } catch(e) {}
        orders.unshift(orderData);
        localStorage.setItem("cuycito_recharges", JSON.stringify(orders));

        // Disparar evento instantáneo de alerta personalizada para el Dashboard
        try {
            localStorage.setItem("cuycito_recharge_alert_trigger", JSON.stringify({
                id: orderId,
                amount: amount,
                userName: currentClientUser.name,
                userNickname: nick,
                currentBalance: currentBal,
                projectedBalance: currentBal + amount,
                method: 'Manual (Yape/Plin/QR)',
                timestamp: Date.now()
            }));
        } catch(e) {}

        window.closeRechargeModal();
        alert(`✨ ¡Solicitud de Recarga Registrada!\n\nSe ha enviado la alerta de tu recarga de S/ ${amount.toFixed(2)} al administrador.\nSaldo actual: S/ ${currentBal.toFixed(2)} ➔ Nuevo saldo: S/ ${(currentBal + amount).toFixed(2)}.`);

    } catch (e) {
        console.error(e);
        alert("Error al registrar la solicitud manual.");
    }
};

window.sendManualRechargeWhatsApp = window.submitManualRechargeRequest;

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

        // Notificar al Dashboard de la nueva orden generada
        try {
            const currentBal = parseFloat(currentClientUser.balance || 0);
            localStorage.setItem("cuycito_recharge_alert_trigger", JSON.stringify({
                id: order.id,
                amount: order.exactAmount,
                userName: currentClientUser.name,
                userNickname: currentClientUser.nickname || currentClientUser.name,
                currentBalance: currentBal,
                projectedBalance: currentBal + order.exactAmount,
                method: 'Lemon Cash (Auto)',
                timestamp: Date.now()
            }));
        } catch(e) {}

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
window.getDaysRemaining = getDaysRemaining;

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
    const btnStore = document.getElementById('tabBtnStore');
    const btnRoulette = document.getElementById('tabBtnRoulette');
    const btnReferrals = document.getElementById('tabBtnReferrals');
    const viewServices = document.getElementById('viewProfileServices');
    const viewStore = document.getElementById('viewProfileStore');
    const viewRoulette = document.getElementById('viewProfileRoulette');
    const viewReferrals = document.getElementById('viewProfileReferrals');

    // Reset styles
    if (btnServices) btnServices.className = "text-gray-400 hover:text-white border-b-2 border-transparent pb-2 font-black uppercase tracking-wider text-sm transition flex items-center gap-2 shrink-0";
    if (btnStore) btnStore.className = "text-gray-400 hover:text-white border-b-2 border-transparent pb-2 font-black uppercase tracking-wider text-sm transition flex items-center gap-2 shrink-0";
    if (btnRoulette) btnRoulette.className = "text-gray-400 hover:text-white border-b-2 border-transparent pb-2 font-black uppercase tracking-wider text-sm transition flex items-center gap-2 shrink-0 relative";
    if (btnReferrals) btnReferrals.className = "text-gray-400 hover:text-white border-b-2 border-transparent pb-2 font-black uppercase tracking-wider text-sm transition flex items-center gap-2 shrink-0";

    // Hide all views
    if (viewServices) viewServices.classList.add('hidden');
    if (viewStore) viewStore.classList.add('hidden');
    if (viewRoulette) viewRoulette.classList.add('hidden');
    if (viewReferrals) viewReferrals.classList.add('hidden');

    if (tab === 'services') {
        if (btnServices) btnServices.className = "text-cuycito-gold border-b-2 border-cuycito-gold pb-2 font-black uppercase tracking-wider text-sm transition flex items-center gap-2 shrink-0";
        if (viewServices) viewServices.classList.remove('hidden');
    } else if (tab === 'store') {
        if (btnStore) btnStore.className = "text-emerald-400 border-b-2 border-emerald-400 pb-2 font-black uppercase tracking-wider text-sm transition flex items-center gap-2 shrink-0";
        if (viewStore) viewStore.classList.remove('hidden');
        window.loadProfileStoreCatalog();
    } else if (tab === 'roulette') {
        if (btnRoulette) btnRoulette.className = "text-cuycito-gold border-b-2 border-cuycito-gold pb-2 font-black uppercase tracking-wider text-sm transition flex items-center gap-2 shrink-0 relative";
        if (viewRoulette) viewRoulette.classList.remove('hidden');

        // Validar acceso según cantidad de servicios activos (>= 3)
        window.checkRouletteEligibility();
    } else if (tab === 'referrals') {
        if (btnReferrals) btnReferrals.className = "text-orange-400 border-b-2 border-orange-400 pb-2 font-black uppercase tracking-wider text-sm transition flex items-center gap-2 shrink-0";
        if (viewReferrals) viewReferrals.classList.remove('hidden');
        window.loadProfileReferralProgram();
    }
};

function getAppProductionOrigin() {
    const hostname = window.location.hostname;
    // Si se ejecuta en localhost, 127.0.0.1 o protocolo file:
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || window.location.protocol === 'file:') {
        // En entorno de pruebas local, predetermina el dominio oficial https://cuzcitogo.pe
        return 'https://cuzcitogo.pe';
    }
    // En producción (cuando esté subido al servidor o hosting real), toma el dominio real automáticamente
    return window.location.origin;
}

function getOrGenerateReferralCode(user) {
    if (!user) return "VIP-CUY-7X9Q";
    // Si el usuario ya tiene un código guardado y no es provisional, mantenerlo
    if (user.referralCode && user.referralCode.trim() !== '' && !user.referralCode.includes('CARGANDO')) {
        return user.referralCode.trim().toUpperCase();
    }

    // Tomar las primeras letras del nombre o nickname (3 o 4 letras)
    const rawLetters = (user.nickname || user.name || 'VIP').toUpperCase().replace(/[^A-Z]/g, '');
    const prefixLetters = (rawLetters.slice(0, 4) || 'VIP');

    // Generar caracteres alfanuméricos aleatorios únicos
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const generatedCode = `VIP-${prefixLetters}-${randomPart}`;
    user.referralCode = generatedCode;

    try {
        localStorage.setItem("cuycitoClient", JSON.stringify(user));
        if (typeof db !== 'undefined' && user.id && typeof setDoc === 'function' && typeof doc === 'function') {
            setDoc(doc(db, "users", user.id), { referralCode: generatedCode }, { merge: true }).catch(()=>{});
        }
    } catch(e) {}

    return generatedCode;
}

window.loadProfileReferralProgram = async () => {
    if (!currentClientUser) {
        try {
            const stored = localStorage.getItem("cuycitoClient");
            if (stored) currentClientUser = JSON.parse(stored);
        } catch(e) {}
    }
    if (!currentClientUser) return;

    // 1. Refrescar datos de usuario desde Firestore de forma segura
    try {
        await refreshUserDataFromFirestore();
    } catch(e) {}

    const activeSubs = (clientSubscriptions || []).filter(s => {
        if (!s || !s.endDate) return false;
        return getDaysRemaining(s.endDate) >= 0;
    });
    const activeCount = activeSubs.length;
    // Calificación VIP: más de 3 servicios activos (es decir, 4 o más, o en modo demo)
    const isVipEligible = activeCount > 3 || currentClientUser.isDemo;

    // Actualizar Banner de Estado
    const bannerTitle = document.getElementById('referralStatusTitle');
    const bannerDesc = document.getElementById('referralStatusDescription');
    const bannerBadge = document.getElementById('referralStatusBadge');

    if (isVipEligible) {
        if (bannerTitle) bannerTitle.innerHTML = `<span class="text-emerald-400 font-black flex items-center gap-1.5"><i class="fa-solid fa-crown text-yellow-400"></i> Miembro Referidor VIP Activo (Comisiones Habilitadas)</span>`;
        if (bannerDesc) bannerDesc.innerHTML = `Tienes <strong class="text-emerald-400 font-mono">${activeCount}</strong> servicios activos. ¡Tus comisiones de <strong>+S/ 0.50</strong> por cada amigo verificado o compra se abonan automáticamente a tu saldo!`;
        if (bannerBadge) {
            bannerBadge.className = "bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-black px-3 py-1.5 rounded-xl uppercase";
            bannerBadge.innerText = "● Comisiones 100% Activas";
        }
    } else {
        if (bannerTitle) bannerTitle.innerHTML = `<span class="text-white font-black flex items-center gap-1.5"><i class="fa-solid fa-gift text-cuycito-gold"></i> Tu Código VIP está Listo para Compartir</span>`;
        if (bannerDesc) bannerDesc.innerHTML = `Tienes <strong class="text-cuycito-gold font-mono">${activeCount} / 4</strong> servicios activos. ¡Puedes invitar a tus amigos desde ya! Tus comisiones (+S/ 0.50) se acreditarán al alcanzar 4 servicios activos.`;
        if (bannerBadge) {
            bannerBadge.className = "bg-amber-950 text-yellow-300 border border-yellow-500/40 text-[10px] font-black px-3 py-1.5 rounded-xl uppercase";
            bannerBadge.innerText = "● Código Generado";
        }
    }

    // Generar código VIP único aleatorio vinculado a la cuenta
    const refCode = getOrGenerateReferralCode(currentClientUser);

    const codeDisplay = document.getElementById('displayReferralCode');
    const linkInput = document.getElementById('displayReferralLink');
    const metricCount = document.getElementById('metricReferredCount');
    const metricEffectuated = document.getElementById('metricEffectuatedCount');
    const metricEarnings = document.getElementById('metricReferredEarnings');

    const origin = getAppProductionOrigin();
    const refLink = `${origin}/login-cliente.html?tab=register&ref=${encodeURIComponent(refCode)}`;

    if (codeDisplay) codeDisplay.innerText = refCode;
    if (linkInput) linkInput.value = refLink;

    // 2. Cargar logs de referidos desde Firestore / LocalStorage
    let myReferralLogs = [];
    try {
        const logsSnap = await getDocs(collection(db, "referral_logs"));
        logsSnap.forEach(d => {
            const logData = d.data();
            if (logData.referrerId === currentClientUser.id || 
                logData.referrerPhone === currentClientUser.phone || 
                logData.referrerCode === refCode ||
                (logData.referrerName && logData.referrerName.toLowerCase() === (currentClientUser.name || '').toLowerCase())) {
                myReferralLogs.push({ id: d.id, ...logData });
            }
        });
    } catch(e) {}

    // Fallback local
    try {
        let localLogs = JSON.parse(localStorage.getItem("cuycito_referral_logs") || "[]");
        localLogs.forEach(ll => {
            if ((ll.referrerId === currentClientUser.id || ll.referrerCode === refCode || ll.referrerPhone === currentClientUser.phone) &&
                !myReferralLogs.some(r => r.id === ll.id)) {
                myReferralLogs.push(ll);
            }
        });
    } catch(e) {}

    // Si es demo y no hay logs, cargar demo interactivo
    if (currentClientUser.isDemo && myReferralLogs.length === 0) {
        myReferralLogs = [
            { id: "demo_1", referredName: "Carlos Mendoza", referredPhone: "991882144", service: "Netflix 4K UHD Ultra HD", status: "completed", action: "purchase_effectuated", amountEarned: 0.50, createdAt: new Date(Date.now() - 3600000 * 4).toISOString() },
            { id: "demo_2", referredName: "Lucía Fernández", referredPhone: "987654321", service: "Max Platino 4K", status: "completed", action: "purchase_effectuated", amountEarned: 0.50, createdAt: new Date(Date.now() - 3600000 * 24).toISOString() },
            { id: "demo_3", referredName: "Diego Ramos", referredPhone: "994551234", service: "Activación Cuenta Gratis VIP", status: "completed", action: "account_approved", amountEarned: 0.50, createdAt: new Date(Date.now() - 3600000 * 48).toISOString() },
            { id: "demo_4", referredName: "Mariana Silva", referredPhone: "993112233", service: "Solicitud en Proceso", status: "pending", action: "registration_pending", amountEarned: 0.00, createdAt: new Date().toISOString() }
        ];
    }

    const totalReferred = myReferralLogs.length || currentClientUser.referredCount || (currentClientUser.isDemo ? 4 : 0);
    const effectuatedList = myReferralLogs.filter(l => l.status === 'completed' || l.action === 'purchase_effectuated' || l.action === 'account_approved');
    const effectuatedCount = effectuatedList.length || (currentClientUser.isDemo ? 3 : 0);
    const totalEarnings = effectuatedCount * 0.50;

    if (metricCount) metricCount.innerText = totalReferred;
    if (metricEffectuated) metricEffectuated.innerText = effectuatedCount;
    if (metricEarnings) metricEarnings.innerText = `S/ ${totalEarnings.toFixed(2)}`;

    // Actualizar Barra de Códigos Efectuados
    const effectuatedRatio = totalReferred > 0 ? (effectuatedCount / totalReferred) * 100 : 0;
    const ratioBadge = document.getElementById('effectuatedRatioBadge');
    const detailText = document.getElementById('effectuatedDetailText');
    const percentText = document.getElementById('effectuatedPercentText');
    const progressBarEl = document.getElementById('effectuatedProgressBar');

    if (ratioBadge) ratioBadge.innerText = `${effectuatedRatio.toFixed(0)}% Efectuado`;
    if (detailText) detailText.innerText = `${effectuatedCount} de ${totalReferred} códigos efectuados en compra o verificación`;
    if (percentText) percentText.innerText = `${effectuatedRatio.toFixed(0)}%`;
    if (progressBarEl) progressBarEl.style.width = `${Math.max(5, effectuatedRatio)}%`;

    // Renderizar Historial de Referidos
    const tbody = document.getElementById('referralHistoryTableBody');
    if (tbody) {
        if (myReferralLogs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="p-8 text-center text-gray-500 italic">
                        Aún no tienes amigos registrados con tu código. ¡Comparte tu enlace de invitación y empieza a ganar!
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = myReferralLogs.map(log => {
                const dateStr = log.createdAt ? new Date(log.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Reciente';
                const maskedPhone = log.referredPhone ? `${log.referredPhone.slice(0, 3)}***${log.referredPhone.slice(-2)}` : 'Web';
                const isCompleted = log.status === 'completed' || log.action === 'purchase_effectuated' || log.action === 'account_approved';
                
                let badgeClass = isCompleted 
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40' 
                    : 'bg-amber-950/80 text-yellow-300 border border-yellow-500/40 animate-pulse';
                let badgeText = isCompleted ? '🟢 Compra / Activación Efectuada' : '🟡 En Verificación';
                let amountText = isCompleted ? '+S/ 0.50' : 'Pendiente';

                return `
                    <tr class="hover:bg-gray-800/40 transition">
                        <td class="p-3.5">
                            <div class="font-black text-white text-xs">${log.referredName || 'Cliente Amigo'}</div>
                            <div class="text-[10px] text-gray-500 font-mono">${maskedPhone}</div>
                        </td>
                        <td class="p-3.5 font-bold text-gray-300 text-xs">
                            <i class="fa-solid fa-cart-shopping text-cuycito-gold mr-1"></i> ${log.service || 'Activación VIP'}
                        </td>
                        <td class="p-3.5 text-gray-400 font-mono text-[11px]">${dateStr}</td>
                        <td class="p-3.5">
                            <span class="text-[10px] font-black px-2.5 py-1 rounded-lg ${badgeClass} inline-flex items-center gap-1 shadow">
                                ${badgeText}
                            </span>
                        </td>
                        <td class="p-3.5 text-right font-mono font-black text-emerald-400 text-xs">
                            ${amountText}
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }
};

window.copyReferralCode = () => {
    const refCode = getOrGenerateReferralCode(currentClientUser);
    navigator.clipboard.writeText(refCode);
    alert(`📋 ¡Código de Referido Copiado: ${refCode}!\n\nComparte este código con tus amigos para que lo ingresen al solicitar su cuenta gratis.`);
};

window.copyReferralLink = () => {
    const linkInput = document.getElementById('displayReferralLink');
    if (linkInput && linkInput.value) {
        navigator.clipboard.writeText(linkInput.value);
        alert("🔗 ¡Enlace de Invitación copiado al portapapeles!\n\nTu amigo podrá registrarse directamente con tu código de referido prellenado.");
    }
};

window.shareReferralWhatsApp = () => {
    const refCode = getOrGenerateReferralCode(currentClientUser);
    const origin = getAppProductionOrigin();
    const refLink = `${origin}/login-cliente.html?tab=register&ref=${encodeURIComponent(refCode)}`;

    const text = `🔥 ¡Los mejores precios en CuycitoGO! 🐹🍿 Accede a pantallas privadas de Netflix 4K, Disney+, Max Platino, Crunchyroll y Spotify.\n\n🎉 ¡APROVECHA HOY S/ 1.00 SOL DE CRÉDITO DE BIENVENIDA al solicitar tu cuenta gratis!\n\n🎁 Código VIP de Invitación: *${refCode}*\n🔗 Solicita tu cuenta en 1 clic aquí: ${refLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};

window.shareReferralGlobalAction = async () => {
    if (!currentClientUser) return;
    const refCode = getOrGenerateReferralCode(currentClientUser);
    const origin = getAppProductionOrigin();
    const refLink = `${origin}/login-cliente.html?tab=register&ref=${encodeURIComponent(refCode)}`;

    const shareTitle = "¡Los mejores precios en CuycitoGO - S/ 1.00 Gratis de Crédito!";
    const shareText = `🔥 ¡Los mejores precios en CuycitoGO! 🐹🍿 Accede a pantallas privadas de Netflix 4K, Disney+, Max Platino y Spotify al mejor precio.\n\n🎉 ¡APROVECHA HOY! Recibe S/ 1.00 Sol de crédito de bienvenida de regalo al solicitar tu cuenta gratis.\n\n🎁 Código VIP de Invitación: *${refCode}*\n🔗 Solicita tu cuenta aquí:`;

    try {
        await navigator.clipboard.writeText(`${shareText}\n${refLink}`);
    } catch(e) {}

    if (navigator.share) {
        try {
            await navigator.share({
                title: shareTitle,
                text: `${shareText}\n${refLink}`,
                url: refLink
            });
            return;
        } catch(e) {}
    }

    alert(`🚀 ¡Enlace de Invitación copiado al portapapeles!\n\n${refLink}\n\nSe abrirá WhatsApp para que lo compartas con tus amigos.`);
    const waUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${refLink}`)}`;
    window.open(waUrl, '_blank');
};

window.updateReferralCalculator = (val) => {
    const count = parseInt(val) || 1;
    const earnings = (count * 0.50).toFixed(2);

    const friendsCountEl = document.getElementById('calcReferralFriendsCount');
    const earningsResultEl = document.getElementById('calcReferralEarningsResult');
    const equivalenceEl = document.getElementById('calcReferralEquivalenceText');

    if (friendsCountEl) friendsCountEl.innerText = `${count} ${count === 1 ? 'amigo' : 'amigos'}`;
    if (earningsResultEl) earningsResultEl.innerText = `S/ ${earnings}`;

    if (equivalenceEl) {
        if (count < 5) {
            equivalenceEl.innerText = `✨ ¡Invita a más amigos para pagar cuentas enteras de streaming sin gastar de tu bolsillo!`;
        } else if (count < 15) {
            equivalenceEl.innerText = `✨ ¡Con ${count} amigos ganas S/ ${earnings}, suficiente para pagar hasta la mitad de un perfil de Netflix 4K o Max!`;
        } else if (count < 30) {
            equivalenceEl.innerText = `🎉 ¡Con ${count} amigos ganas S/ ${earnings}! ¡Te alcanza para tener 1 o 2 cuentas completas totalmente GRATIS cada mes!`;
        } else {
            equivalenceEl.innerText = `🚀 ¡Modo Embajador VIP! Con ${count} amigos ganas S/ ${earnings} en saldo directo acumulado. ¡Eres un crack!`;
        }
    }
};

let profileCatalogProducts = [];
let profileActiveCategory = 'ALL';

window.loadProfileStoreCatalog = async () => {
    const grid = document.getElementById('profileCatalogGrid');
    if (!grid) return;

    // 1. Renderizado INSTANTÁNEO para eliminar la pantalla de spinner
    if (!profileCatalogProducts || profileCatalogProducts.length === 0) {
        profileCatalogProducts = [...DEFAULT_CATALOG_PRODUCTS];
    }
    renderProfileCatalog();

    // 2. Consulta asíncrona a Firebase Firestore en segundo plano
    try {
        const catalogSnap = await getDocs(collection(db, "store_catalog"));
        const fetchedProducts = [];
        catalogSnap.forEach(d => {
            fetchedProducts.push({ id: d.id, ...d.data() });
        });

        if (fetchedProducts.length > 0) {
            profileCatalogProducts = fetchedProducts.map(p => {
                if (!p.imageUrl || p.imageUrl.trim() === '') {
                    p.imageUrl = resolveProductImage(p);
                }
                return p;
            });
            renderProfileCatalog();
        }
    } catch (e) {
        console.warn("Uso de catálogo local de contingencia:", e);
    }

    try {
        const masterSnap = await getDocs(collection(db, "masterAccounts"));
        allMasterAccounts = [];
        masterSnap.forEach(d => {
            allMasterAccounts.push({ id: d.id, ...d.data() });
        });
    } catch (e) {
        console.warn("Cuentas maestras no cargadas:", e);
    }
};

window.filterProfileCatalog = (category) => {
    profileActiveCategory = category;
    const buttons = document.querySelectorAll('.profile-category-btn');
    buttons.forEach(btn => {
        if (btn.dataset.category === category) {
            btn.className = "profile-category-btn bg-cuycito-gold text-black text-xs font-black px-4 py-2 rounded-xl transition shadow glow-gold";
        } else {
            btn.className = "profile-category-btn bg-[#141414] hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800 text-xs font-bold px-4 py-2 rounded-xl transition";
        }
    });
    renderProfileCatalog();
};

function resolveProductImage(p) {
    if (p && p.imageUrl && typeof p.imageUrl === 'string' && p.imageUrl.trim() !== '' && !p.imageUrl.includes('undefined')) {
        if (!p.imageUrl.includes('unsplash.com') && !p.imageUrl.includes('hdqwalls') && !p.imageUrl.includes('undefined')) {
            return p.imageUrl.trim();
        }
    }
    const title = (p?.title || '').toLowerCase();
    const cat = (p?.category || '').toLowerCase();

    // 1. Combos Compartidos (Mantener el combo duo que esta perfecto)
    if (title.includes('trio') || title.includes('trío') || (title.includes('netflix') && title.includes('disney') && title.includes('max'))) {
        return 'assets/img/promo_combo_trio.jpg';
    }
    if (title.includes('combo') || title.includes('duo') || title.includes('dúo') || cat.includes('combo')) {
        return 'assets/img/promo_combo_duo.jpg';
    }

    // 2. Servicios Específicos Centrados en Logos
    if (title.includes('prime') || title.includes('amazon')) {
        return 'assets/img/banner_prime.svg';
    }
    if (title.includes('disney') || title.includes('star') || title.includes('espn') || title.includes('marvel')) {
        return 'assets/img/banner_disney.svg';
    }
    if (title.includes('spotify') || cat.includes('music') || cat.includes('música') || title.includes('music') || title.includes('cancion')) {
        return 'assets/img/banner_spotify.svg';
    }
    if (title.includes('crunchyroll') || title.includes('anime') || cat.includes('anime') || cat.includes('gaming')) {
        return 'assets/img/banner_crunchyroll.svg';
    }
    if (title.includes('max') || title.includes('hbo')) {
        return 'assets/img/banner_max.svg';
    }
    if (title.includes('netflix')) {
        return 'assets/img/promo_netflix_4k.jpg';
    }

    return 'assets/img/promo_netflix_4k.jpg';
}

function getPlatformThemeData(p) {
    const rawCat = (p.category || '').toUpperCase();
    const title = (p.title || '').toLowerCase();
    const isOffer = p.promo === true || p.isOffer === true || rawCat === 'OFERTA' || rawCat === 'COMBOS' || title.includes('combo') || title.includes('oferta') || title.includes('pack');

    let hex = '#ffb703';
    let icon = 'fa-solid fa-tv';
    let platformLabel = p.category || 'Streaming VIP';
    let borderAccent = 'border-gray-800 hover:border-cuycito-gold/60';
    let glowClass = 'glow-gold';

    if (title.includes('netflix')) {
        hex = '#e50914';
        icon = 'fa-solid fa-play';
        platformLabel = 'Netflix 4K UHD';
        borderAccent = 'border-red-950/60 hover:border-red-600/80';
        glowClass = 'glow-red';
    } else if (title.includes('max') || title.includes('hbo')) {
        hex = '#8b5cf6';
        icon = 'fa-solid fa-film';
        platformLabel = 'Max Platino 4K';
        borderAccent = 'border-purple-950/60 hover:border-purple-500/80';
        glowClass = 'shadow-[0_0_20px_rgba(139,92,246,0.3)]';
    } else if (title.includes('disney')) {
        hex = '#3b82f6';
        icon = 'fa-solid fa-clapperboard';
        platformLabel = 'Disney+ Premium ESPN';
        borderAccent = 'border-blue-950/60 hover:border-blue-500/80';
        glowClass = 'shadow-[0_0_20px_rgba(59,130,246,0.3)]';
    } else if (title.includes('crunchyroll') || rawCat === 'ANIME' || rawCat === 'GAMING' || title.includes('anime')) {
        hex = '#f97316';
        icon = 'fa-solid fa-dragon';
        platformLabel = 'Crunchyroll Mega Fan';
        borderAccent = 'border-orange-950/60 hover:border-orange-500/80';
        glowClass = 'shadow-[0_0_20px_rgba(249,115,22,0.3)]';
    } else if (title.includes('spotify') || rawCat === 'MÚSICA' || rawCat === 'MUSICA' || title.includes('music')) {
        hex = '#10b981';
        icon = 'fa-solid fa-music';
        platformLabel = 'Spotify Hi-Fi';
        borderAccent = 'border-emerald-950/60 hover:border-emerald-500/80';
        glowClass = 'shadow-[0_0_20px_rgba(16,185,129,0.3)]';
    } else if (title.includes('prime') || title.includes('amazon')) {
        hex = '#06b6d4';
        icon = 'fa-solid fa-cube';
        platformLabel = 'Prime Video';
        borderAccent = 'border-cyan-950/60 hover:border-cyan-500/80';
        glowClass = 'shadow-[0_0_20px_rgba(6,182,212,0.3)]';
    } else if (title.includes('combo') || rawCat === 'COMBOS') {
        hex = '#ffb703';
        icon = 'fa-solid fa-gift';
        platformLabel = 'Combo Ahorro VIP';
        borderAccent = 'border-amber-950/60 hover:border-amber-500/80';
        glowClass = 'glow-gold';
    }

    if (p.color && p.color.startsWith('#')) hex = p.color;
    else if (p.colorClass) {
        const map = {
            'red-600': '#e50914',
            'purple-600': '#8b5cf6',
            'blue-600': '#3b82f6',
            'orange-500': '#f97316',
            'emerald-600': '#10b981',
            'cuycito-gold': '#ffb703',
            'sky-600': '#06b6d4'
        };
        if (map[p.colorClass]) hex = map[p.colorClass];
    }

    return { hex, icon, platformLabel, isOffer, borderAccent, glowClass };
}

function renderProfileCatalog() {
    const grid = document.getElementById('profileCatalogGrid');
    if (!grid) return;

    const searchEl = document.getElementById('profileCatalogSearch');
    const searchTerm = (searchEl?.value || '').toLowerCase().trim();

    // Catálogo de respaldo si no hay productos cargados en base de datos
    let productsList = profileCatalogProducts;
    if (!productsList || productsList.length === 0) {
        productsList = [
            {
                id: "vip-netflix",
                title: "Netflix 4K UHD Ultra HD",
                category: "Streaming",
                price: 13.00,
                description: "Perfil privado con PIN personal, calidad 4K UHD real y soporte continuo.",
                color: "#e50914",
                icon: "fa-solid fa-play",
                imageUrl: "assets/img/promo_netflix_4k.jpg",
                promo: false
            },
            {
                id: "vip-combo-cine",
                title: "Combo Dúo Cine: Netflix 4K + Crunchyroll",
                category: "Combos",
                price: 17.00,
                description: "¡Super Ahorro! Llévate los 2 gigantes del cine y anime con PIN privado.",
                color: "#ffb703",
                icon: "fa-solid fa-gift",
                imageUrl: "assets/img/promo_combo_duo.jpg",
                promo: true
            },
            {
                id: "vip-combo-trio",
                title: "Combo Trío Total: Netflix + Disney ESPN + Max",
                category: "Combos",
                price: 32.00,
                description: "El paquete definitivo de entretenimiento para toda la familia con 4K Ultra HD.",
                color: "#ffb703",
                icon: "fa-solid fa-fire",
                imageUrl: "assets/img/promo_combo_trio.jpg",
                promo: true
            },
            {
                id: "vip-disney",
                title: "Disney+ Premium con ESPN",
                category: "Streaming",
                price: 12.00,
                description: "Incluye todos los canales ESPN, fútbol en vivo, Disney, Pixar, Marvel y Star.",
                color: "#3b82f6",
                icon: "fa-solid fa-clapperboard",
                imageUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80",
                promo: false
            },
            {
                id: "vip-max",
                title: "Max Platino 4K + Dolby Atmos",
                category: "Streaming",
                price: 11.00,
                description: "Acceso completo a todo HBO, Warner Bros, Discovery y deportes en vivo.",
                color: "#8b5cf6",
                icon: "fa-solid fa-film",
                imageUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80",
                promo: false
            },
            {
                id: "vip-crunchyroll",
                title: "Crunchyroll Mega Fan Simulcast",
                category: "Gaming",
                price: 9.00,
                description: "Estrenos simultáneos desde Japón sin anuncios en Full HD y descargas offline.",
                color: "#f97316",
                icon: "fa-solid fa-dragon",
                imageUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80",
                promo: false
            },
            {
                id: "vip-spotify",
                title: "Spotify Premium Individual",
                category: "Música",
                price: 8.00,
                description: "Música ilimitada sin anuncios a tu propia cuenta o perfil nuevo garantizado.",
                color: "#10b981",
                icon: "fa-solid fa-music",
                imageUrl: "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=800&q=80",
                promo: false
            }
        ];
    }

    let filtered = productsList.filter(p => {
        const cat = (p.category || '').toUpperCase();
        const title = (p.title || '').toLowerCase();
        const isOffer = p.promo === true || p.isOffer === true || cat === 'OFERTA' || cat === 'COMBOS' || title.includes('combo') || title.includes('oferta');

        let matchesCategory = false;
        if (profileActiveCategory === 'ALL') {
            matchesCategory = true;
        } else if (profileActiveCategory === 'OFERTA') {
            matchesCategory = isOffer;
        } else if (profileActiveCategory === 'STREAMING') {
            matchesCategory = cat === 'STREAMING' || cat === 'PANTALLAS / PERFIL' || cat === 'CUENTAS RAÍZ' || title.includes('netflix') || title.includes('max') || title.includes('disney') || title.includes('prime');
        } else if (profileActiveCategory === 'COMBOS') {
            matchesCategory = cat === 'COMBOS' || title.includes('combo');
        } else if (profileActiveCategory === 'MUSICA') {
            matchesCategory = cat === 'MÚSICA' || cat === 'MUSICA' || title.includes('spotify') || title.includes('music') || title.includes('apple');
        } else if (profileActiveCategory === 'GAMING') {
            matchesCategory = cat === 'GAMING' || cat === 'ANIME' || title.includes('crunchyroll') || title.includes('game') || title.includes('steam');
        }

        const matchesSearch = !searchTerm || title.includes(searchTerm) || (p.description || '').toLowerCase().includes(searchTerm) || cat.includes(searchTerm);
        return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-16 text-gray-500 space-y-3">
                <i class="fa-solid fa-box-open text-4xl text-gray-600"></i>
                <p class="text-sm font-bold text-gray-400">No se encontraron productos con los filtros seleccionados.</p>
                <button onclick="window.filterProfileCatalog('ALL')" class="text-xs text-cuycito-gold underline font-bold">Ver catálogo completo</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(prod => {
        const price = parseFloat(prod.price || 0).toFixed(2);
        const theme = getPlatformThemeData(prod);
        const safeId = String(prod.id || '').replace(/'/g, "\\'");
        const safeTitle = encodeURIComponent(prod.title || 'Servicio');

        const finalImage = resolveProductImage(prod);
        const imageBannerHTML = `
            <div class="w-full h-40 rounded-2xl overflow-hidden mb-3 border border-white/10 relative shadow-inner group-hover:border-cuycito-gold/40 transition">
                <img src="${finalImage}" alt="${prod.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
            </div>
        `;

        return `
            <div class="bg-[#121212] border ${theme.borderAccent} rounded-3xl p-5 flex flex-col justify-between transition duration-300 shadow-2xl relative overflow-hidden group">
                
                ${theme.isOffer ? `
                    <div class="absolute top-3 right-3 z-10">
                        <span class="bg-gradient-to-r from-cuycito-red to-orange-500 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-lg glow-red animate-pulse flex items-center gap-1">
                            <i class="fa-solid fa-fire text-yellow-200"></i> OFERTA VIP
                        </span>
                    </div>
                ` : ''}

                <div class="space-y-3">
                    ${imageBannerHTML}
                    
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg shrink-0 border border-white/10" style="background-color: ${theme.hex}25; color: ${theme.hex}; border-color: ${theme.hex}50;">
                            <i class="${theme.icon}"></i>
                        </div>
                        <div>
                            <span class="text-[10px] uppercase font-black tracking-widest block" style="color: ${theme.hex};">
                                ${theme.platformLabel}
                            </span>
                            <h3 class="text-base font-black text-white group-hover:text-cuycito-gold transition leading-snug">
                                ${prod.title || 'Servicio Digital'}
                            </h3>
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-1.5 text-[9px] font-black uppercase">
                        <span class="bg-black/80 text-gray-300 px-2 py-0.5 rounded-lg border border-gray-800 flex items-center gap-1">
                            <i class="fa-solid fa-users text-sky-400"></i> Pantalla Privada
                        </span>
                        <span class="bg-black/80 text-gray-300 px-2 py-0.5 rounded-lg border border-gray-800 flex items-center gap-1">
                            <i class="fa-solid fa-lock text-amber-400"></i> PIN Exclusivo
                        </span>
                        <span class="bg-black/80 text-gray-300 px-2 py-0.5 rounded-lg border border-gray-800 flex items-center gap-1">
                            <i class="fa-solid fa-tv text-emerald-400"></i> 4K UHD
                        </span>
                    </div>

                    <p class="text-xs text-gray-300 leading-relaxed font-normal">
                        ${prod.description || 'Acceso garantizado y privado con soporte VIP.'}
                    </p>
                </div>

                <div class="pt-5 border-t border-gray-800/80 mt-5 flex items-center justify-between gap-3">
                    <div>
                        <span class="text-[10px] text-gray-400 block uppercase font-bold">Precio VIP:</span>
                        <span class="text-2xl font-black text-cuycito-gold font-mono">S/ ${price}</span>
                    </div>

                    <button onclick="window.addToProfileCart('${safeId}', '${safeTitle}', ${price})" class="bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 hover:from-orange-400 hover:to-emerald-400 text-black font-black text-xs px-4 py-2.5 rounded-xl transition shadow-lg glow-gold flex items-center gap-1.5 shrink-0 uppercase tracking-wider">
                        <i class="fa-solid fa-cart-plus text-sm"></i>
                        <span>Añadir al Carrito</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// SISTEMA DE CARRITO DE COMPRAS Y CÓDIGO DE REFERIDO VIP (-S/ 0.50)
// ==========================================
let profileCart = [];
let isCartReferralDiscountApplied = false;
let cartReferralCode = '';

window.toggleProfileCartModal = () => {
    const modal = document.getElementById('profileCartModal');
    if (!modal) return;
    modal.classList.toggle('hidden');

    // Auto-prellenar código de referido si fue registrado con uno y no lo ha usado
    if (!modal.classList.contains('hidden') && currentClientUser) {
        const input = document.getElementById('cartReferralInput');
        if (input && currentClientUser.referredCodeUsed && !currentClientUser.referralDiscountUsed) {
            input.value = currentClientUser.referredCodeUsed;
            window.applyCartReferralDiscount();
        } else {
            window.renderProfileCartUI();
        }
    }
};

window.addToProfileCart = (id, titleEncoded, price) => {
    const title = decodeURIComponent(titleEncoded || '');
    const existingIndex = profileCart.findIndex(item => item.id === id || item.title === title);

    if (existingIndex >= 0) {
        profileCart[existingIndex].quantity += 1;
    } else {
        profileCart.push({
            id: id || ('prod_' + Date.now()),
            title: title || 'Servicio VIP',
            price: parseFloat(price) || 0,
            quantity: 1
        });
    }

    window.renderProfileCartUI();

    // Abrir automáticamente el modal del carrito para que el cliente lo vea de inmediato
    const modal = document.getElementById('profileCartModal');
    if (modal) {
        modal.classList.remove('hidden');
    }

    // Notificación animada en el badge
    const badge = document.getElementById('profileCartBadge');
    if (badge) {
        badge.classList.add('scale-125', 'bg-cuycito-gold', 'text-black');
        setTimeout(() => badge.classList.remove('scale-125', 'bg-cuycito-gold', 'text-black'), 300);
    }
};

window.addToCart = window.addToProfileCart;
window.toggleCartModal = window.toggleProfileCartModal;
window.openCartModal = () => {
    const modal = document.getElementById('profileCartModal');
    if (modal) modal.classList.remove('hidden');
    window.renderProfileCartUI();
};
window.closeCartModal = () => {
    const modal = document.getElementById('profileCartModal');
    if (modal) modal.classList.add('hidden');
};

window.updateProfileCartQuantity = (index, delta) => {
    if (profileCart[index]) {
        profileCart[index].quantity += delta;
        if (profileCart[index].quantity <= 0) {
            profileCart.splice(index, 1);
        }
    }
    window.renderProfileCartUI();
};

window.removeFromProfileCart = (index) => {
    if (profileCart[index]) {
        profileCart.splice(index, 1);
    }
    window.renderProfileCartUI();
};

window.applyCartReferralDiscount = () => {
    if (!currentClientUser) return;
    const input = document.getElementById('cartReferralInput');
    const code = (input ? input.value : '').trim().toUpperCase();

    if (!code) {
        isCartReferralDiscountApplied = false;
        cartReferralCode = '';
        const msg = document.getElementById('referralDiscountMessage');
        if (msg) msg.innerText = 'Ingresa un código de referido VIP válido.';
        window.renderProfileCartUI();
        return;
    }

    if (currentClientUser.referralDiscountUsed) {
        alert('⚠️ Ya utilizaste tu descuento único de referido VIP en una compra anterior.');
        isCartReferralDiscountApplied = false;
        cartReferralCode = '';
        window.renderProfileCartUI();
        return;
    }

    isCartReferralDiscountApplied = true;
    cartReferralCode = code;
    const msg = document.getElementById('referralDiscountMessage');
    if (msg) {
        msg.innerText = `✅ ¡Código ${code} aplicado! Se descontará S/ 0.50 céntimos de tu total.`;
        msg.className = 'text-[10px] text-emerald-400 font-bold';
    }
    window.renderProfileCartUI();
};

window.renderProfileCartUI = () => {
    const list = document.getElementById('profileCartItemsList');
    const badge = document.getElementById('profileCartBadge');
    const subtotalDisplay = document.getElementById('cartSubtotalDisplay');
    const referralRow = document.getElementById('cartReferralDiscountRow');
    const balanceAppliedDisplay = document.getElementById('cartBalanceAppliedDisplay');
    const totalPayableDisplay = document.getElementById('cartTotalPayableDisplay');

    const totalCount = profileCart.reduce((sum, item) => sum + item.quantity, 0);
    if (badge) badge.innerText = totalCount;

    if (!list) return;

    if (profileCart.length === 0) {
        list.innerHTML = `<p class="text-center text-xs text-gray-500 py-8">Tu carrito está vacío.</p>`;
        if (subtotalDisplay) subtotalDisplay.innerText = 'S/ 0.00';
        if (referralRow) referralRow.classList.add('hidden');
        if (balanceAppliedDisplay) balanceAppliedDisplay.innerText = '- S/ 0.00';
        if (totalPayableDisplay) totalPayableDisplay.innerText = 'S/ 0.00';
        return;
    }

    let subtotal = 0;
    list.innerHTML = profileCart.map((item, idx) => {
        const itemSub = item.price * item.quantity;
        subtotal += itemSub;
        return `
            <div class="flex items-center justify-between gap-3 pt-3 first:pt-0">
                <div class="flex-1">
                    <h4 class="text-xs font-bold text-white leading-snug">${item.title}</h4>
                    <span class="text-[10px] text-cuycito-gold font-mono">S/ ${item.price.toFixed(2)} c/u</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="flex items-center border border-gray-800 rounded-lg bg-black overflow-hidden">
                        <button onclick="window.updateProfileCartQuantity(${idx}, -1)" class="px-2 py-1 text-xs text-gray-400 hover:text-white font-bold bg-gray-900">-</button>
                        <span class="px-2 py-1 text-xs font-mono text-white font-bold">${item.quantity}</span>
                        <button onclick="window.updateProfileCartQuantity(${idx}, 1)" class="px-2 py-1 text-xs text-gray-400 hover:text-white font-bold bg-gray-900">+</button>
                    </div>
                    <span class="text-xs font-bold text-emerald-400 font-mono w-16 text-right">S/ ${itemSub.toFixed(2)}</span>
                    <button onclick="window.removeFromProfileCart(${idx})" class="text-red-400 hover:text-red-300 text-xs p-1">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    const referralDiscount = isCartReferralDiscountApplied ? 0.50 : 0.00;
    if (referralRow) {
        if (isCartReferralDiscountApplied) referralRow.classList.remove('hidden');
        else referralRow.classList.add('hidden');
    }

    const userBalance = currentClientUser ? (currentClientUser.balance || 0) : 0;
    const appliedBalance = Math.min(userBalance, Math.max(0, subtotal - referralDiscount));
    const finalPayable = Math.max(0, subtotal - referralDiscount - appliedBalance);

    if (subtotalDisplay) subtotalDisplay.innerText = `S/ ${subtotal.toFixed(2)}`;
    if (balanceAppliedDisplay) balanceAppliedDisplay.innerText = `- S/ ${appliedBalance.toFixed(2)}`;
    if (totalPayableDisplay) totalPayableDisplay.innerText = `S/ ${finalPayable.toFixed(2)}`;
};

window.confirmCartCheckout = async () => {
    if (!currentClientUser) return alert('Por favor inicia sesión.');
    if (profileCart.length === 0) return alert('Tu carrito está vacío.');

    const subtotal = profileCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const referralDiscount = isCartReferralDiscountApplied ? 0.50 : 0.00;
    
    // Soporte para Cuenta Demo: Auto-recargar saldo si se agota en pruebas
    if ((currentClientUser.isDemo || currentClientUser.id === 'demo_cuycito_user') && (currentClientUser.balance || 0) < (subtotal - referralDiscount)) {
        currentClientUser.balance = 50.00;
    }

    const userBalance = currentClientUser.balance || 0;
    const appliedBalance = Math.min(userBalance, Math.max(0, subtotal - referralDiscount));
    const finalPayable = Math.max(0, subtotal - referralDiscount - appliedBalance);

    if (finalPayable > 0) {
        if (!confirm(`El total a pagar con tus descuentos es S/ ${finalPayable.toFixed(2)}.\n\n¿Deseas confirmar tu orden y procesar tus servicios?`)) return;
    }

    // Cerrar modal de carrito e iniciar Cinemática de Pago VIP
    window.toggleProfileCartModal();
    const cinematicModal = document.getElementById('paymentCinematicModal');
    const pBar = document.getElementById('cinematicProgressBar');
    const sText = document.getElementById('cinematicStatusText');
    const cTitle = document.getElementById('cinematicTitle');

    if (cinematicModal) {
        cinematicModal.classList.remove('hidden');
        if (cTitle) cTitle.innerText = 'Procesando Pago VIP...';
        if (pBar) pBar.style.width = '30%';
        if (sText) sText.innerText = '1. Verificando saldo VIP en cuenta...';

        await new Promise(r => setTimeout(r, 450));
        if (pBar) pBar.style.width = '70%';
        if (sText) sText.innerText = `2. Descontando saldo (-S/ ${appliedBalance.toFixed(2)})...`;

        await new Promise(r => setTimeout(r, 550));
        if (pBar) pBar.style.width = '100%';
        if (sText) sText.innerText = '3. ¡Pago completado! Registrando servicios...';
        if (cTitle) cTitle.innerText = '¡Compra Exitosa! 🎉';

        await new Promise(r => setTimeout(r, 500));
        cinematicModal.classList.add('hidden');
    }

    // 1. Procesar descuento de referido de 1 solo uso si fue aplicado
    if (isCartReferralDiscountApplied && cartReferralCode) {
        currentClientUser.referralDiscountUsed = true;

        try {
            const usersSnap = await getDocs(collection(db, "users"));
            usersSnap.forEach(async (uDoc) => {
                const uData = uDoc.data();
                const assignedCode = (uData.referralCode || '').trim().toUpperCase();
                const nickCode = ('VIP-' + (uData.nickname || uData.name || '')).toUpperCase();

                if ((assignedCode && cartReferralCode === assignedCode) || cartReferralCode === nickCode) {
                    const oldBal = uData.balance || 0;
                    const newBal = parseFloat((oldBal + 0.50).toFixed(2));
                    const newReferredCount = (uData.referredCount || 0) + 1;
                    const newEarnings = parseFloat(((uData.referralEarnings || 0) + 0.50).toFixed(2));

                    const cleanName = (uData.nickname || uData.name || 'VIP').trim().substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'C');
                    const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
                    const newReferralCode = `VIP-${cleanName}-${randSuffix}`;

                    await setDoc(doc(db, "users", uDoc.id), {
                        balance: newBal,
                        referredCount: newReferredCount,
                        referralEarnings: newEarnings,
                        referralCode: newReferralCode
                    }, { merge: true });

                    const refLogItem = {
                        id: "ref_log_" + Date.now(),
                        referrerId: uDoc.id,
                        referrerName: uData.nickname || uData.name,
                        referrerCodeUsed: cartReferralCode,
                        newReferralCodeGenerated: newReferralCode,
                        referredName: currentClientUser.name,
                        referredPhone: currentClientUser.phone,
                        service: "Compra con Código Referido",
                        action: "purchase_effectuated",
                        amountEarned: 0.50,
                        createdAt: new Date().toISOString()
                    };
                    await setDoc(doc(db, "referral_logs", refLogItem.id), refLogItem, { merge: true });
                }
            });
        } catch(e) {}
    }

    // 2. Descontar saldo utilizado
    const newClientBalance = parseFloat(Math.max(0, userBalance - appliedBalance).toFixed(2));
    currentClientUser.balance = newClientBalance;

    try {
        await setDoc(doc(db, "users", currentClientUser.id), {
            balance: newClientBalance,
            referralDiscountUsed: currentClientUser.referralDiscountUsed || false
        }, { merge: true });
    } catch(e) {}

    localStorage.setItem("cuycitoClient", JSON.stringify(currentClientUser));

    // 3. Crear suscripciones para cada producto comprado en estado 'pending_activation'
    const today = new Date();
    const expiry = new Date();
    expiry.setDate(today.getDate() + 30);

    profileCart.forEach(async (item) => {
        for (let i = 0; i < item.quantity; i++) {
            const subId = "sub_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
            const newSub = {
                id: subId,
                person: currentClientUser.name,
                service: item.title,
                accountEmail: "activacion@cuycitogo.pe",
                profileName: `Perfil ${currentClientUser.nickname || currentClientUser.name}`,
                pin: Math.floor(1000 + Math.random() * 9000).toString(),
                startDate: today.toISOString().split('T')[0],
                endDate: expiry.toISOString().split('T')[0],
                cost: 0,
                price: item.price,
                status: 'pending_activation', // ⏳ Nuevo estado oficial de compra
                createdAt: new Date().toISOString()
            };

            clientSubscriptions.unshift(newSub);
            try {
                await setDoc(doc(db, "subscriptions", subId), newSub, { merge: true });
            } catch(e) {}
        }
    });

    // 4. Limpiar Carrito y Emitir Alertas al Dashboard
    const boughtServices = profileCart.map(item => `${item.title} (x${item.quantity}) - S/ ${(item.price * item.quantity).toFixed(2)}`).join(', ');
    const boughtSummary = profileCart.map(i => i.title).join(', ');

    try {
        localStorage.setItem("cuycito_purchase_alert_trigger", JSON.stringify({
            userName: currentClientUser.name,
            userNickname: currentClientUser.nickname || currentClientUser.name,
            userEmail: currentClientUser.email || currentClientUser.phone || '',
            serviceName: boughtSummary,
            servicesDetail: boughtServices,
            amount: subtotal.toFixed(2),
            status: "Pendiente de activación",
            timestamp: Date.now()
        }));
    } catch(e) {}

    profileCart = [];
    isCartReferralDiscountApplied = false;
    cartReferralCode = '';

    // Cambiar a la vista de servicios contratados
    window.switchProfileTab('services');
    updateProfileUI();
    renderClientSubscriptions(clientSubscriptions);
    calculateMetrics(clientSubscriptions);

    alert(`🎉 ¡Compra procesada exitosamente!\n\nTus productos han sido añadidos a tu lista con estado "Pendiente de Activación".\nSaldo descontado: S/ ${appliedBalance.toFixed(2)} | Nuevo saldo: S/ ${newClientBalance.toFixed(2)}.`);
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
