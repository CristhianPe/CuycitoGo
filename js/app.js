import { auth, db, storage, onAuthStateChanged, signOut, collection, getDocs, getDoc, doc, setDoc, deleteDoc, ref, uploadBytes, getDownloadURL } from "./firebase-config.js";

const DEFAULT_SERVICES = ["Netflix", "Spotify", "HBO Max", "Disney+", "Crunchyroll", "Prime Video"];
const CENTRAL_WHATSAPP_PHONE = "";

let appState = {
    globalCurrency: 'PEN',
    exchangeRate: 3.75,
    services: [...DEFAULT_SERVICES],
    subscriptions: [],
    history: [],
    masterAccounts: [],
    clients: [], 
    catalog: [],
    postits: [],
    recharges: [],
    rouletteSettings: null,
    gameSpins: []
};

let currentTargetAcc = null; 
let currentTargetSlot = null;
let chartPlatformInstance = null; 
let chartAnnualInstance = null;
let activeManagingClient = null;
let currentComboRows = [];

function resolveProductImage(p) {
    if (p && p.imageUrl && typeof p.imageUrl === 'string' && p.imageUrl.trim() !== '' && !p.imageUrl.includes('undefined')) {
        if (!p.imageUrl.includes('unsplash.com') && !p.imageUrl.includes('hdqwalls') && !p.imageUrl.includes('undefined')) {
            return p.imageUrl.trim();
        }
    }
    const title = (p?.title || '').toLowerCase();
    const cat = (p?.category || '').toLowerCase();

    // 1. Combos Compartidos (Mantener el combo duo perfecto)
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

const DEFAULT_CATALOG_ITEMS = [
    {
        id: "prod_combo_duo",
        title: "Combo Dúo: Netflix 4K + Crunchyroll Anime",
        category: "Combos",
        description: "Disfruta de tus plataformas favoritas en un solo combo con perfiles privados independientes, calidad 4K Ultra HD y garantía total 30 días.",
        price: 17.00,
        imageUrl: "assets/img/promo_combo_duo.jpg",
        promo: true,
        isCombo: true,
        stock: 12
    },
    {
        id: "prod_netflix_1p",
        title: "Netflix Premium 4K - 1 Perfil Privado",
        category: "Pantallas / Perfil",
        description: "1 Perfil Privado con PIN personalizado. Calidad 4K Ultra HD y garantía 100% durante 30 días. Descuento por apertura web.",
        price: 15.00,
        imageUrl: "assets/img/promo_netflix_4k.jpg",
        promo: false,
        stock: 8
    },
    {
        id: "prod_combo_trio",
        title: "Combo Trío Total: Netflix + Disney ESPN + Max",
        category: "Combos",
        description: "El paquete definitivo de entretenimiento para toda la familia con PIN privado y 4K Ultra HD.",
        price: 32.00,
        imageUrl: "assets/img/promo_combo_trio.jpg",
        promo: true,
        isCombo: true,
        stock: 6
    },
    {
        id: "prod_disney_1p",
        title: "Disney+ Premium 4K - 1 Perfil Privado",
        category: "Pantallas / Perfil",
        description: "1 Perfil Privado con PIN personalizado. Calidad 4K Ultra HD, ESPN y garantía 100% durante 30 días.",
        price: 10.00,
        imageUrl: "assets/img/banner_disney.svg",
        promo: false,
        stock: 15
    },
    {
        id: "prod_prime_1p",
        title: "Prime Video Premium 4K - 1 Perfil Privado",
        category: "Pantallas / Perfil",
        description: "1 Perfil Privado con PIN personalizado. Calidad 4K Ultra HD y acceso a todas las series Amazon Originals.",
        price: 6.00,
        imageUrl: "assets/img/banner_prime.svg",
        promo: false,
        stock: 12
    },
    {
        id: "prod_max_1p",
        title: "Max Platino 4K - 1 Perfil Privado",
        category: "Pantallas / Perfil",
        description: "Disfruta de HBO Max Platino en 4K Ultra HD con PIN privado.",
        price: 9.00,
        imageUrl: "assets/img/banner_max.svg",
        promo: false,
        stock: 10
    },
    {
        id: "prod_spotify_ind",
        title: "Spotify Premium Individual (1 Mes)",
        category: "Música",
        description: "Cuenta o renovación de tu cuenta personal Spotify Premium sin anuncios.",
        price: 8.00,
        imageUrl: "assets/img/banner_spotify.svg",
        promo: false,
        stock: 20
    },
    {
        id: "prod_crunchyroll_1p",
        title: "Crunchyroll Mega Fan - 1 Perfil",
        category: "Gaming",
        description: "Disfruta de todo el anime en HD sin anuncios y estrenos en simulcast.",
        price: 7.00,
        imageUrl: "assets/img/banner_crunchyroll.svg",
        promo: false,
        stock: 14
    }
];

function getClientCode(client) {
    if (!client) return 'CLI-000';
    if (client.clientCode) return client.clientCode;
    if (client.phone) {
        const cleanDigits = client.phone.toString().replace(/\D/g, '');
        if (cleanDigits.length >= 4) {
            return `CLI-${cleanDigits.slice(-4)}`;
        }
    }
    if (client.id) {
        const cleanId = client.id.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return `CLI-${cleanId.slice(-4)}`;
    }
    return 'CLI-1001';
}
window.getClientCode = getClientCode;

function getMasterCode(acc) {
    if (!acc) return 'MAT-000';
    if (acc.masterCode) return acc.masterCode;
    if (acc.id) {
        const cleanId = acc.id.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return `MAT-${cleanId.slice(-4)}`;
    }
    return `MAT-${Math.floor(1000 + Math.random() * 9000)}`;
}
window.getMasterCode = getMasterCode;

if (typeof Chart !== 'undefined') { Chart.defaults.color = '#9ca3af'; }

// =====================================
// 1. INICIALIZACIÓN Y AUTENTICACIÓN ADMIN
// =====================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const subSnap = await getDocs(collection(db, "subscriptions"));
            appState.subscriptions = []; 
            subSnap.forEach(d => appState.subscriptions.push({ ...d.data(), id: d.id, _docId: d.id }));

            const histSnap = await getDocs(collection(db, "history"));
            appState.history = []; 
            histSnap.forEach(d => appState.history.push({ ...d.data(), id: d.id, _docId: d.id }));

            const masterSnap = await getDocs(collection(db, "masterAccounts"));
            appState.masterAccounts = []; 
            masterSnap.forEach(d => appState.masterAccounts.push({ ...d.data(), id: d.id, _docId: d.id }));

            const servSnap = await getDocs(collection(db, "services"));
            let cloudServices = []; 
            servSnap.forEach(d => cloudServices.push(d.data().name));
            
            const clientSnap = await getDocs(collection(db, "users"));
            appState.clients = []; 
            clientSnap.forEach(d => {
                const data = { ...d.data(), id: d.id };
                if (!data.nickname) data.nickname = data.name || 'Cliente';
                data.clientCode = window.getClientCode(data);
                appState.clients.push(data);
            });

            // Saneamiento y auto-asignación de identificador ID en suscripciones heredadas
            appState.subscriptions.forEach(async (s) => {
                if (!s.clientId && s.person && s.person !== 'Sin Asignar') {
                    const matched = appState.clients.find(c => (c.name || '').trim().toLowerCase() === s.person.trim().toLowerCase());
                    if (matched) {
                        s.clientId = matched.id;
                        s.clientCode = matched.clientCode || window.getClientCode(matched);
                        s.clientPhone = matched.phone || '';
                        try {
                            await setDoc(doc(db, "subscriptions", s.id), s, { merge: true });
                        } catch(e){}
                    }
                }
            });

            const catalogSnap = await getDocs(collection(db, "store_catalog"));
            appState.catalog = []; 
            catalogSnap.forEach(d => {
                const item = { id: d.id, ...d.data() };
                if (!item.imageUrl || item.imageUrl.trim() === '') {
                    item.imageUrl = resolveProductImage(item);
                }
                appState.catalog.push(item);
            });

            if (appState.catalog.length === 0) {
                appState.catalog = [...DEFAULT_CATALOG_ITEMS];
            }

            const postitSnap = await getDocs(collection(db, "postits"));
            appState.postits = [];
            postitSnap.forEach(d => appState.postits.push({ id: d.id, ...d.data() }));

            const recSnap = await getDocs(collection(db, "recharge_orders"));
            appState.recharges = [];
            recSnap.forEach(d => appState.recharges.push({ id: d.id, ...d.data() }));

            const regSnap = await getDocs(collection(db, "pending_registrations"));
            appState.pendingRegistrations = [];
            regSnap.forEach(d => appState.pendingRegistrations.push({ id: d.id, ...d.data() }));

            const allServices = [...new Set([...DEFAULT_SERVICES, ...cloudServices, ...appState.subscriptions.map(s=>s.service)])].filter(Boolean);
            appState.services = allServices.sort();

            document.getElementById('dbStatus').innerHTML = '<span class="text-emerald-400"><i class="fa-solid fa-cloud-check"></i> Sincronizado</span>';
            document.getElementById('mainBody').classList.remove('hidden');
            
            const todayStr = new Date().toISOString().split('T')[0];
            const mStart = document.getElementById('mStartDate');
            if(mStart) mStart.value = todayStr;
            const finMonthFilter = document.getElementById('financeMonthFilter');
            if(finMonthFilter) finMonthFilter.value = todayStr.substring(0, 7);
            
            window.calculateEndDate();
            window.renderAll();
            window.initStoreMaintenanceListener();
            if (typeof window.initRealtimeClientsPresenceListener === 'function') {
                window.initRealtimeClientsPresenceListener();
            }

            // Saneamiento e integridad automática de cuentas matrices y servicios huérfanos
            setTimeout(() => {
                window.cleanupDatabaseOrphans(false);
            }, 1000);
        } catch (error) {
            console.error("❌ Error conectando / leyendo Base de Datos Firebase:", error);
            const statusEl = document.getElementById('dbStatus');
            if (statusEl) {
                const errCode = error?.code || error?.name || 'Error';
                const isPermission = error?.code === 'permission-denied';
                statusEl.innerHTML = `<span class="text-red-500 font-black flex items-center gap-1.5"><i class="fa-solid fa-triangle-exclamation"></i> Error Cloud</span>`;
                statusEl.className = "cursor-pointer hover:border-red-500 transition text-[11px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl bg-black/90 border border-red-500/80 text-red-500 flex items-center gap-1.5 shadow";
                statusEl.title = isPermission 
                    ? "Permiso denegado por Firestore. Verifica las Reglas de Seguridad en tu consola de Firebase." 
                    : `Detalle: ${errCode} - ${error?.message || 'Error de conexión'}. Haz click para reintentar.`;
                statusEl.setAttribute('onclick', 'window.location.reload()');
            }
            document.getElementById('mainBody').classList.remove('hidden');
        }
    } else { 
        window.location.replace('login.html'); 
    }
});

// =====================================
// 2. UTILIDADES GENERALES
// =====================================
const convertToGlobal = (amount, currency) => {
    if (currency === appState.globalCurrency) return parseFloat(amount) || 0;
    return currency === 'USD' ? (parseFloat(amount) || 0) * appState.exchangeRate : (parseFloat(amount) || 0) / appState.exchangeRate;
};

window.setGlobalCurrency = (curr) => {
    appState.globalCurrency = curr;
    const penBtn = document.getElementById('currencyPEN'); const usdBtn = document.getElementById('currencyUSD');
    if(penBtn) penBtn.className = curr === 'PEN' ? 'px-3 py-1 text-xs font-bold rounded bg-cuycito-gold text-black transition' : 'px-3 py-1 text-xs font-bold rounded text-slate-400 hover:text-cuycito-gold transition';
    if(usdBtn) usdBtn.className = curr === 'USD' ? 'px-3 py-1 text-xs font-bold rounded bg-cuycito-gold text-black transition' : 'px-3 py-1 text-xs font-bold rounded text-slate-400 hover:text-cuycito-gold transition';
    window.renderAll();
};

window.parseDateUniversal = (dateStr) => {
    if (!dateStr) return null;
    const str = dateStr.toString().trim();
    if (!str || str === 'N/A' || str === '-') return null;

    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
        const parts = str.split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month, day, 0, 0, 0);
        return isNaN(d) ? null : d;
    }

    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(str)) {
        const clean = str.split('T')[0];
        const parts = clean.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day, 0, 0, 0);
        return isNaN(d) ? null : d;
    }

    const d = new Date(str);
    return isNaN(d) ? null : d;
};

window.formatDateISO = (dateStr) => {
    const d = window.parseDateUniversal(dateStr);
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

window.formatDateDDMMYYYY = (dateStr) => {
    const d = window.parseDateUniversal(dateStr);
    if (!d) return dateStr || '-';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
};

window.getDaysRemaining = (endDateStr) => {
    if (!endDateStr) return 0;
    const dEnd = window.parseDateUniversal(endDateStr);
    if (!dEnd) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dEnd.setHours(0, 0, 0, 0);
    return Math.ceil((dEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

window.initDatePickers = () => {
    if (typeof flatpickr !== 'undefined') {
        flatpickr(".datepicker-es", {
            dateFormat: "d/m/Y",
            locale: flatpickr.l10ns && flatpickr.l10ns.es ? flatpickr.l10ns.es : "es",
            allowInput: true,
            onChange: function(selectedDates, dateStr, instance) {
                const id = instance.element.id;
                if (id === 'editStartDate') {
                    window.recalculateEditEndDate();
                } else if (id === 'assignStartDateInput') {
                    window.recalculateAssignEndDate();
                } else if (id === 'startDate') {
                    window.calculateEndDate();
                }
            },
            onClose: function(selectedDates, dateStr, instance) {
                const id = instance.element.id;
                if (id === 'editStartDate') {
                    window.recalculateEditEndDate();
                } else if (id === 'assignStartDateInput') {
                    window.recalculateAssignEndDate();
                } else if (id === 'startDate') {
                    window.calculateEndDate();
                }
            }
        });
    }
};

window.setDatePickerValue = (id, dateStr) => {
    const el = document.getElementById(id);
    if (!el) return;
    const formatted = window.formatDateDDMMYYYY(dateStr);
    if (el._flatpickr) {
        el._flatpickr.setDate(formatted, false, "d/m/Y");
    } else {
        el.value = formatted;
    }
};

window.generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*?";
    let pwd = chars[Math.floor(Math.random()*26)] + chars[26+Math.floor(Math.random()*26)] + chars[52+Math.floor(Math.random()*10)] + chars[62+Math.floor(Math.random()*8)];
    for(let i=0; i<8; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    pwd = pwd.split('').sort(() => 0.5 - Math.random()).join('');
    const display = document.getElementById('genPwdDisplay');
    if(display) display.value = pwd;
    return pwd;
};

window.copyGeneratedPassword = () => {
    const display = document.getElementById('genPwdDisplay');
    if(display && display.value) { navigator.clipboard.writeText(display.value); alert("¡Contraseña copiada exitosamente!"); }
};

window.triggerWhatsApp = (subId) => {
    const sub = appState.subscriptions.find(s => s.id === subId);
    if (!sub) return;
    const formattedEnd = window.formatDateDDMMYYYY(sub.endDate);
    const msg = window.getDaysRemaining(sub.endDate) >= 0 ? `¡Hola! 🐹👋 Tu suscripción de ${sub.service} vence el ${formattedEnd}. ¿Deseas renovar?` : `¡Hola! 🐹⚠️ Tu cuenta de ${sub.service} ha vencido. Escríbenos para reactivar.`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
};

window.triggerInfo = (subId) => {
    const sub = appState.subscriptions.find(s => s.id === subId);
    if (!sub) return;
    const formattedEnd = window.formatDateDDMMYYYY(sub.endDate);
    let msg = `✨ *CUENTA ACTIVADA* ✨\n\n🎬 *Servicio:* ${sub.service}\n👤 *Perfil:* ${sub.person}\n📧 *Correo:* ${sub.email}\n🔐 *Pass:* ${sub.pass}\n🔢 *PIN:* ${sub.pin}\n📆 *Vence:* ${formattedEnd}`;
    const infoEl = document.getElementById('infoText');
    if(infoEl) infoEl.value = msg; 
    const modal = document.getElementById('infoModal');
    if(modal) modal.classList.remove('hidden');
};

window.copyInfoText = () => { 
    const infoEl = document.getElementById('infoText');
    if(infoEl) { navigator.clipboard.writeText(infoEl.value); alert("¡Copiado!"); }
};

window.switchTab = (tabId) => {
    let cleanId = (tabId || '').replace(/^view-/, '');
    ['subs', 'master', 'finance', 'clients', 'catalog', 'recharges', 'games', 'news', 'cartelera', 'ai-agent'].forEach(id => {
        const view = document.getElementById('view-' + id);
        const btn = document.getElementById('tab-btn-' + id);
        if(view) {
            view.classList.add('hidden');
            if(id === cleanId) {
                view.classList.remove('hidden');
                if(id==='subs') view.classList.add('block');
                if(id==='master' || id==='finance' || id==='clients' || id==='catalog' || id==='recharges' || id==='games' || id==='news' || id==='cartelera' || id==='ai-agent') {
                    view.className = view.className.replace('hidden', 'block space-y-4');
                }
            }
        }
        if(btn) {
            let activeColorClass = "text-cuycito-gold border-b-2 border-cuycito-gold";
            if (id === 'news') activeColorClass = "text-orange-400 border-b-2 border-orange-400";
            if (id === 'cartelera') activeColorClass = "text-cuycito-gold border-b-2 border-cuycito-gold";
            if (id === 'games') activeColorClass = "text-purple-400 border-b-2 border-purple-400";
            if (id === 'recharges') activeColorClass = "text-yellow-400 border-b-2 border-yellow-400";
            if (id === 'ai-agent') activeColorClass = "text-cyan-400 border-b-2 border-cyan-400";

            btn.className = (id === cleanId) 
                ? `${activeColorClass} pb-2 font-black uppercase tracking-wider text-sm transition flex items-center gap-1.5` 
                : "text-gray-500 hover:text-white border-b-2 border-transparent pb-2 font-black uppercase tracking-wider text-sm transition flex items-center gap-1.5";
        }
    });
    if(cleanId === 'subs') {
        window.renderActiveTable();
    }
    if(cleanId === 'master') {
        window.renderMasterAccounts();
    }
    if(cleanId === 'finance') {
        window.renderFinance();
    }
    if(cleanId === 'clients') {
        window.renderClients();
        window.renderPendingRegistrationsTable();
        window.renderAdminReferralLogsTable();
    }
    if(cleanId === 'catalog') {
        window.renderCatalog();
    }
    if(cleanId === 'recharges') {
        window.renderRechargesTable();
        window.loadPaymentQRSettings();
        window.loadRouletteHouseStats();
    }
    if(cleanId === 'games') {
        window.renderGamesSection();
    }
    if(cleanId === 'news') {
        if (typeof window.renderAdminNewsList === 'function') window.renderAdminNewsList();
        if (typeof window.renderAdminSubdestacada === 'function') window.renderAdminSubdestacada();
        if (typeof window.renderAdminThematicGrid === 'function') window.renderAdminThematicGrid();
        if (typeof window.renderAdminTop5 === 'function') window.renderAdminTop5();
    }
    if(cleanId === 'cartelera') {
        if (typeof window.renderAdminCarteleraList === 'function') window.renderAdminCarteleraList();
    }
};

window.updateAllServiceDropdowns = () => {
    const ids = ['txService', 'bulkService', 'mService', 'editService', 'csmNewService'];
    const serviceList = (appState.services && appState.services.length > 0) ? appState.services : DEFAULT_SERVICES;

    ids.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="" class="bg-gray-900 text-white">-- Seleccionar Plataforma / Servicio --</option>';
        serviceList.forEach(serv => { 
            select.innerHTML += `<option value="${serv}" class="bg-gray-900 text-white">${serv}</option>`; 
        });
        if (id !== 'csmNewService') {
            select.innerHTML += '<option value="__NEW__" class="bg-gray-900 text-cuycito-gold font-bold">➕ Agregar Nuevo Servicio...</option>';
        }
        if (currentVal && currentVal !== '__NEW__' && [...select.options].some(o => o.value === currentVal)) { 
            select.value = currentVal; 
        }
    });

    const filterSelect = document.getElementById('filterActiveService');
    if (filterSelect) {
        const currentFilter = filterSelect.value;
        filterSelect.innerHTML = '<option value="" class="bg-gray-900 text-white">Todos los Servicios</option>';
        serviceList.forEach(serv => { 
            filterSelect.innerHTML += `<option value="${serv}" class="bg-gray-900 text-white">${serv}</option>`; 
        });
        filterSelect.value = currentFilter;
    }
};

window.populateServicesDropdowns = window.updateAllServiceDropdowns;

window.handleServiceSelectChange = (selectId, customInputId) => {
    const select = document.getElementById(selectId);
    const customInput = document.getElementById(customInputId);
    if (!select || !customInput) return;
    if (select.value === '__NEW__') { 
        customInput.classList.remove('hidden'); 
        customInput.focus(); 
    } else { 
        customInput.classList.add('hidden'); 
        customInput.value = ''; 
    }
};

window.getOrRegisterService = async (selectId, customInputId) => {
    const select = document.getElementById(selectId);
    const customInput = document.getElementById(customInputId);
    if (!select) return '';
    if (select.value === '__NEW__') {
        const newName = customInput.value.trim();
        if (!newName) { alert('⚠️ Escribe el nombre del nuevo servicio.'); return null; }
        if (!appState.services.includes(newName)) {
            appState.services.push(newName);
            appState.services.sort();
            try {
                const servDocId = 'serv_' + newName.toLowerCase().replace(/[^a-z0-9]/g, '_');
                await setDoc(doc(db, "services", servDocId), { name: newName });
            } catch(e) {}
        }
        window.updateAllServiceDropdowns();
        select.value = newName;
        if(customInput) { customInput.classList.add('hidden'); customInput.value = ''; }
        return newName;
    }
    if (!select.value) return null;
    return select.value;
};

window.toggleTypeUI = () => { 
    const label = document.getElementById('personLabel'); const typeSelect = document.getElementById('txType');
    if(label && typeSelect) label.innerText = typeSelect.value === 'VENTA' ? 'Nombre del Cliente (Identificador)' : 'Nombre del Proveedor'; 
};

window.calculateEndDate = () => {
    const startInput = document.getElementById('startDate');
    if(!startInput || !startInput.value) return;
    const durationInput = document.getElementById('durationMonths');
    const months = durationInput ? parseInt(durationInput.value) || 1 : 1;
    const startDate = window.parseDateUniversal(startInput.value);
    if (!startDate) return;
    startDate.setDate(startDate.getDate() + (months * 30));
    window.setDatePickerValue('endDate', startDate);
};

// =====================================
// 3. GUARDADO AUTOMÁTICO Y SINCRONIZACIÓN CLOUD
// =====================================
window.notifyAutoSave = (customMsg = null) => {
    const statusEl = document.getElementById('dbStatus');
    const textEl = document.getElementById('dbStatusText');
    if (!statusEl) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const msg = customMsg || `Nube Sincronizada (${timeStr})`;
    
    if (textEl) textEl.innerText = msg;
    else statusEl.innerHTML = `<i class="fa-solid fa-cloud-check text-emerald-400 text-sm animate-pulse"></i> <span>${msg}</span>`;
    
    statusEl.className = "cursor-pointer hover:border-emerald-400 transition text-[11px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl bg-black/90 border border-emerald-500/60 text-emerald-400 flex items-center gap-2 shadow glow-gold";
};

window.notifySaving = (msg = "Guardando en Nube...") => {
    const statusEl = document.getElementById('dbStatus');
    const textEl = document.getElementById('dbStatusText');
    if (!statusEl) return;
    
    if (textEl) textEl.innerText = msg;
    else statusEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-yellow-400 text-sm"></i> <span class="text-yellow-400">${msg}</span>`;
    
    statusEl.className = "cursor-pointer transition text-[11px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl bg-black/90 border border-yellow-500/60 text-yellow-400 flex items-center gap-2 shadow";
};

window.triggerManualSync = async () => {
    window.notifySaving("Sincronizando Nube...");
    try {
        for (const sub of appState.subscriptions) await setDoc(doc(db, "subscriptions", sub.id), sub);
        for (const tx of appState.history) await setDoc(doc(db, "history", tx.id), tx);
        for (const acc of appState.masterAccounts) await setDoc(doc(db, "masterAccounts", acc.id), acc);
        for (const serv of appState.services) {
            const servDocId = 'serv_' + serv.toLowerCase().replace(/[^a-z0-9]/g, '_');
            await setDoc(doc(db, "services", servDocId), { name: serv });
        }
        for (const cl of appState.clients) await setDoc(doc(db, "users", cl.id), cl);
        for (const cat of appState.catalog) await setDoc(doc(db, "store_catalog", cat.id), cat);
        for (const pos of appState.postits) await setDoc(doc(db, "postits", pos.id), pos);
        
        window.notifyAutoSave();
        alert("✅ ¡Base de datos completa sincronizada con la Nube Firebase!");
    } catch (e) {
        console.error(e);
        const statusEl = document.getElementById('dbStatus');
        if (statusEl) statusEl.innerHTML = '<span class="text-red-500"><i class="fa-solid fa-triangle-exclamation"></i> Error al Sincronizar</span>';
        alert("❌ Error al sincronizar con Firebase.");
    }
};

window.saveToFirebase = window.triggerManualSync;

window.logoutApp = () => { signOut(auth).then(() => window.location.replace('login.html')); };

// =====================================
// 4. OPERACIÓN RÁPIDA (VENTA / COMPRA)
// =====================================
window.handleFormSubmit = async (e) => {
    e.preventDefault();
    const service = await window.getOrRegisterService('txService', 'txServiceCustom');
    if (!service) return;

    const id = 'sub_cuy_' + Date.now();
    const months = parseInt(document.getElementById('durationMonths').value) || 1;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const type = document.getElementById('txType').value;
    const person = document.getElementById('personName').value.trim();
    const email = document.getElementById('credEmail').value.trim();
    const pass = document.getElementById('credPass').value.trim();
    const pin = document.getElementById('credPin').value.trim();
    const hidePassword = document.getElementById('credHidePass').checked;
    const showCredentials = !hidePassword;
    const amount = parseFloat(document.getElementById('txAmount').value) || 0;
    const currency = document.getElementById('txCurrency').value;

    let matchedClientId = null;
    let matchedClientCode = null;
    let matchedClientPhone = null;
    let matchedClientPersonName = person;

    const matchedClient = appState.clients.find(c => {
        const cName = (c.name || '').trim().toLowerCase();
        const cNick = (c.nickname || '').trim().toLowerCase();
        const cPhone = (c.phone || '').trim();
        const cCode = (c.clientCode || window.getClientCode(c)).trim().toLowerCase();
        const searchVal = person.toLowerCase();
        return cCode === searchVal || cName === searchVal || cNick === searchVal || cPhone === person || (person.includes(cCode) && cCode.length > 3);
    });

    if (matchedClient) {
        matchedClientId = matchedClient.id;
        matchedClientCode = matchedClient.clientCode || window.getClientCode(matchedClient);
        matchedClientPhone = matchedClient.phone;
        matchedClientPersonName = matchedClient.name;
    }

    const newSub = { 
        id, 
        type, 
        person: matchedClientPersonName, 
        clientId: matchedClientId,
        clientCode: matchedClientCode,
        clientPhone: matchedClientPhone,
        service, 
        email, 
        pass, 
        pin, 
        hidePassword, 
        hidePasswordFromClient: hidePassword,
        showCredentials, 
        showCredentialsToClient: showCredentials,
        amount, 
        currency, 
        startDate, 
        endDate, 
        months 
    };
    appState.subscriptions.push(newSub);

    const txId = 'tx_cuy_' + Date.now();
    const newTx = { id: txId, date: startDate, type, person: matchedClientPersonName, service, amount, currency, clientId: matchedClientId, clientCode: matchedClientCode };
    appState.history.push(newTx);

    try {
        await setDoc(doc(db, "subscriptions", id), newSub);
        await setDoc(doc(db, "history", txId), newTx);

        // Si es una Venta a un cliente con código de referido, registrar compra efectuada
        if (type === 'VENTA') {
            const client = matchedClient || appState.clients.find(c => (c.name || '').trim().toLowerCase() === person.toLowerCase() || (c.nickname || '').trim().toLowerCase() === person.toLowerCase());
            if (client && (client.referredCodeUsed || client.referredBy)) {
                const refCodeUsed = client.referredCodeUsed || client.referredBy;
                const referrer = appState.clients.find(c => {
                    if (!c) return false;
                    const assignedCode = (c.referralCode || '').trim().toUpperCase();
                    const nickCode = ('VIP-' + (c.nickname || c.name || '')).toUpperCase();
                    const phoneCode = ('VIP-' + (c.phone || '')).toUpperCase();
                    const rawNick = (c.nickname || c.name || '').toUpperCase();
                    const codeUpper = refCodeUsed.toUpperCase();
                    return (assignedCode && codeUpper === assignedCode) || codeUpper === nickCode || codeUpper === phoneCode || codeUpper === rawNick || c.id === client.referredBy;
                });

                if (referrer) {
                    const purchaseLog = {
                        id: "ref_log_" + Date.now(),
                        referrerId: referrer.id,
                        referrerName: referrer.nickname || referrer.name,
                        referrerPhone: referrer.phone,
                        referrerCode: refCodeUsed,
                        referredName: person,
                        referredPhone: client.phone || '',
                        service: service,
                        action: "purchase_effectuated",
                        amountEarned: 0.50,
                        status: "completed",
                        createdAt: new Date().toISOString()
                    };
                    await setDoc(doc(db, "referral_logs", purchaseLog.id), purchaseLog, { merge: true });
                    try {
                        let localLogs = JSON.parse(localStorage.getItem("cuycito_referral_logs") || "[]");
                        localLogs.unshift(purchaseLog);
                        localStorage.setItem("cuycito_referral_logs", JSON.stringify(localLogs));
                    } catch(e) {}
                }
            }
        }
    } catch(err) { console.error("Error guardando en Firestore:", err); }

    document.getElementById('txForm').reset();
    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('startDate').value = todayStr;
    document.getElementById('durationMonths').value = 1;
    document.getElementById('credHidePass').checked = false;
    window.calculateEndDate();

    window.renderAll();
    alert('✅ Operación guardada exitosamente.');
};

window.renewSubscription = async (subId, inputId) => {
    const sub = appState.subscriptions.find(s => s.id === subId);
    if (!sub) return;
    const input = document.getElementById(inputId);
    const months = parseInt(input ? input.value : 0);
    if (!months || months <= 0) return alert('Ingresa cantidad de meses válidos.');

    const currentEnd = new Date(sub.endDate);
    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
    const newEnd = new Date(baseDate.getTime() + (months * 30 * 86400000));
    sub.endDate = newEnd.toISOString().split('T')[0];

    const txId = 'tx_ren_' + Date.now();
    const newTx = {
        id: txId,
        date: new Date().toISOString().split('T')[0],
        type: 'VENTA',
        person: sub.person,
        service: sub.service,
        amount: sub.amount * months,
        currency: sub.currency
    };
    appState.history.push(newTx);

    try {
        await setDoc(doc(db, "subscriptions", sub.id), sub);
        await setDoc(doc(db, "history", txId), newTx);
    } catch(e) {}

    window.renderAll();
    alert(`✅ Renovado por ${months} mes(es) hasta el ${sub.endDate}`);
};

window.openEditModal = (subId) => {
    const sub = (appState.subscriptions || []).find(s => s.id === subId || s._docId === subId);
    if (!sub) return;

    window.updateAllServiceDropdowns();

    document.getElementById('editSubId').value = sub.id || sub._docId;
    document.getElementById('editPerson').value = sub.person || '';

    const editServiceSelect = document.getElementById('editService');
    const editServiceCustom = document.getElementById('editServiceCustom');
    
    if (editServiceSelect) {
        if (sub.service && !appState.services.includes(sub.service)) {
            appState.services.push(sub.service);
            appState.services.sort();
            window.updateAllServiceDropdowns();
        }
        
        editServiceSelect.value = sub.service || '';
        if (editServiceCustom) {
            editServiceCustom.classList.add('hidden');
            editServiceCustom.value = '';
        }
    }

    document.getElementById('editEmail').value = sub.email || '';
    document.getElementById('editPass').value = sub.pass || '';
    document.getElementById('editPin').value = sub.pin || '';
    document.getElementById('editHidePass').checked = !!sub.hidePassword;
    document.getElementById('editAmount').value = sub.amount !== undefined ? sub.amount : (sub.price || 0);
    document.getElementById('editCurrency').value = sub.currency || 'PEN';
    
    // Fechas e intervalo de meses (1 mes = 30 días)
    const todayFormatted = window.formatDateDDMMYYYY(new Date());
    const startDateVal = sub.startDate ? window.formatDateDDMMYYYY(sub.startDate) : (sub.createdAt ? window.formatDateDDMMYYYY(sub.createdAt) : todayFormatted);
    window.setDatePickerValue('editStartDate', startDateVal);

    let calcMonths = sub.months || 1;
    if (sub.startDate && sub.endDate) {
        const dStart = window.parseDateUniversal(sub.startDate);
        const dEnd = window.parseDateUniversal(sub.endDate);
        if (dStart && dEnd) {
            const diffMs = dEnd.getTime() - dStart.getTime();
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays > 0) {
                calcMonths = Math.max(1, Math.round(diffDays / 30));
            }
        }
    }
    document.getElementById('editMonths').value = calcMonths;

    if (sub.endDate) {
        window.setDatePickerValue('editEndDate', window.formatDateDDMMYYYY(sub.endDate));
    } else {
        window.recalculateEditEndDate();
    }

    document.getElementById('editModal').classList.remove('hidden');
    window.initDatePickers();
};

window.recalculateEditEndDate = () => {
    const startVal = document.getElementById('editStartDate')?.value;
    const monthsVal = Math.max(1, parseInt(document.getElementById('editMonths')?.value) || 1);
    if (!startVal) return;

    const startDate = window.parseDateUniversal(startVal);
    if (!startDate) return;
    startDate.setDate(startDate.getDate() + (monthsVal * 30));

    window.setDatePickerValue('editEndDate', startDate);
};

window.saveEditModal = async () => {
    const id = document.getElementById('editSubId')?.value;
    if (!id) return;
    const sub = (appState.subscriptions || []).find(s => s.id === id || s._docId === id);
    if (!sub) return;

    const newService = await window.getOrRegisterService('editService', 'editServiceCustom');

    sub.person = (document.getElementById('editPerson')?.value || sub.person).trim();
    if (newService) sub.service = newService;
    sub.email = (document.getElementById('editEmail')?.value || '').trim();
    sub.pass = (document.getElementById('editPass')?.value || '').trim();
    sub.pin = (document.getElementById('editPin')?.value || '').trim();
    sub.hidePassword = !!document.getElementById('editHidePass')?.checked;
    sub.hidePasswordFromClient = sub.hidePassword;
    sub.showCredentials = !sub.hidePassword;
    sub.showCredentialsToClient = !sub.hidePassword;
    sub.amount = parseFloat(document.getElementById('editAmount')?.value) || sub.amount || 0;
    sub.price = sub.amount;
    sub.currency = document.getElementById('editCurrency')?.value || sub.currency || 'PEN';
    sub.startDate = document.getElementById('editStartDate')?.value || sub.startDate;
    sub.months = Math.max(1, parseInt(document.getElementById('editMonths')?.value) || 1);
    sub.endDate = document.getElementById('editEndDate')?.value || sub.endDate;
    sub.updatedAt = new Date().toISOString();

    try { 
        await setDoc(doc(db, "subscriptions", id), sub, { merge: true }); 
    } catch(e){
        console.error("Error actualizando suscripción:", e);
    }

    // Sincronizar si estaba ligada a una cuenta matriz
    if (sub.masterAccountId) {
        const masterAcc = (appState.masterAccounts || []).find(m => m.id === sub.masterAccountId);
        if (masterAcc) {
            masterAcc.email = sub.email;
            masterAcc.pass = sub.pass;
            masterAcc.hidePasswordFromClient = sub.hidePassword;
            masterAcc.showCredentialsToClient = sub.showCredentials;
            try { await setDoc(doc(db, "masterAccounts", masterAcc.id), masterAcc, { merge: true }); } catch(e){}
        }
    }

    saveLocal();
    document.getElementById('editModal')?.classList.add('hidden');
    window.renderAll();
};

window.deleteSubscription = async (passedId) => {
    const id = (passedId || document.getElementById('editSubId')?.value || '').toString().trim();
    if (!id) {
        alert("⚠️ No se pudo identificar la suscripción a eliminar.");
        return;
    }

    const subIndex = (appState.subscriptions || []).findIndex(s => s.id === id || s._docId === id);
    const sub = subIndex >= 0 ? appState.subscriptions[subIndex] : null;
    const subName = sub ? `"${sub.service}" de ${sub.person || 'cliente'}` : `este servicio`;

    if (confirm(`⚠️ ¿Estás seguro de ELIMINAR permanentemente ${subName}?\nEsta acción no se puede deshacer.`)) {
        // 1. Si estaba vinculada a una cuenta matriz, liberar el cupo / slot
        if (sub && sub.masterAccountId) {
            const masterAcc = (appState.masterAccounts || []).find(m => m.id === sub.masterAccountId);
            if (masterAcc && masterAcc.profiles) {
                const slotIdx = masterAcc.profiles.findIndex(pId => pId === id || (sub && pId === sub.id));
                if (slotIdx >= 0) {
                    masterAcc.profiles[slotIdx] = null;
                    try {
                        await setDoc(doc(db, "masterAccounts", masterAcc.id), masterAcc, { merge: true });
                    } catch(e){
                        console.warn("Error liberando slot en cuenta matriz:", e);
                    }
                }
            }
        }

        // 2. Eliminar de Firestore (tanto por id como por sub.id)
        try { 
            await deleteDoc(doc(db, "subscriptions", id)); 
            if (sub && sub.id && sub.id !== id) {
                await deleteDoc(doc(db, "subscriptions", sub.id));
            }
            console.log("🗑️ Suscripción eliminada exitosamente de Firestore:", id);
        } catch(e){
            console.error("Error eliminando suscripción de Firestore:", e);
        }

        // 3. Eliminar de appState y localStorage
        appState.subscriptions = (appState.subscriptions || []).filter(s => s.id !== id && (!sub || s.id !== sub.id));
        saveLocal();

        const editModal = document.getElementById('editModal');
        if (editModal) editModal.classList.add('hidden');

        // 4. Re-renderizar interfaces
        window.renderActiveTable();
        window.renderMasterAccounts();
        window.renderClients();
        window.renderNotifications();
    }
};

// =====================================
// 5. REGISTRO MÚLTIPLE
// =====================================
window.generateBulkCells = () => {
    const count = parseInt(document.getElementById('bulkCount').value) || 5;
    const container = document.getElementById('bulkContainer');
    if(!container) return;
    container.innerHTML = '';
    
    for (let i = 1; i <= count; i++) {
        container.innerHTML += `
        <div class="grid grid-cols-5 gap-2 items-center bg-black/40 p-2 rounded border border-gray-800 text-xs">
            <input type="text" id="bulk_p_${i}" placeholder="Cliente ${i}" class="bg-[#111] border border-gray-700 rounded p-1.5 text-white">
            <input type="text" id="bulk_e_${i}" placeholder="Correo" class="bg-[#111] border border-gray-700 rounded p-1.5 text-white">
            <input type="text" id="bulk_pw_${i}" placeholder="Pass" class="bg-[#111] border border-gray-700 rounded p-1.5 text-white">
            <input type="text" id="bulk_pin_${i}" placeholder="PIN" class="bg-[#111] border border-gray-700 rounded p-1.5 text-white">
            <input type="number" step="0.01" id="bulk_a_${i}" placeholder="Monto" class="bg-[#111] border border-gray-700 rounded p-1.5 text-white">
        </div>`;
    }
};

window.saveBulkAccounts = async () => {
    const service = await window.getOrRegisterService('bulkService', 'bulkServiceCustom');
    if (!service) return;
    const count = parseInt(document.getElementById('bulkCount').value) || 5;
    const todayStr = window.formatDateDDMMYYYY(new Date());
    const endObj = new Date(Date.now() + (30 * 86400000));
    const endStr = window.formatDateDDMMYYYY(endObj);

    for (let i = 1; i <= count; i++) {
        const person = document.getElementById(`bulk_p_${i}`)?.value.trim();
        const email = document.getElementById(`bulk_e_${i}`)?.value.trim();
        const pass = document.getElementById(`bulk_pw_${i}`)?.value.trim();
        const pin = document.getElementById(`bulk_pin_${i}`)?.value.trim();
        const amount = parseFloat(document.getElementById(`bulk_a_${i}`)?.value) || 0;

        if (person || email) {
            const id = 'sub_bulk_' + Date.now() + '_' + i;
            const newSub = { id, type: 'VENTA', person: person || 'Cliente', service, email, pass, pin, amount, currency: 'PEN', startDate: todayStr, endDate: endStr, months: 1 };
            appState.subscriptions.push(newSub);
            try { await setDoc(doc(db, "subscriptions", id), newSub); } catch(e){}
        }
    }

    document.getElementById('bulkAddModal').classList.add('hidden');
    window.renderAll();
    alert('✅ Cuentas múltiples registradas exitosamente.');
};

// =====================================
// 6. CUENTAS RAÍZ (MATRIZ) & VISIBILIDAD
// =====================================
window.getMasterCode = (acc) => {
    if (!acc) return 'MAT-000';
    if (acc.masterCode) return acc.masterCode;
    if (acc.id) {
        const cleanId = acc.id.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return `MAT-${cleanId.slice(-4)}`;
    }
    return `MAT-${Math.floor(1000 + Math.random() * 9000)}`;
};

window.openCreateMasterModal = () => {
    window.updateAllServiceDropdowns();
    const modal = document.getElementById('masterModal');
    if (!modal) return;

    const mServiceSelect = document.getElementById('mService');
    if (mServiceSelect) mServiceSelect.value = '';
    const mServiceCustom = document.getElementById('mServiceCustom');
    if (mServiceCustom) {
        mServiceCustom.classList.add('hidden');
        mServiceCustom.value = '';
    }

    document.getElementById('mProvider').value = '';
    document.getElementById('mCapacity').value = '5';
    document.getElementById('mCost').value = '';
    document.getElementById('mCurrency').value = 'PEN';
    
    const todayFormatted = window.formatDateDDMMYYYY(new Date());
    window.setDatePickerValue('mStartDate', todayFormatted);
    document.getElementById('mMonths').value = '1';
    document.getElementById('mEmail').value = '';
    document.getElementById('mPass').value = '';
    document.getElementById('mHidePass').checked = false;

    modal.classList.remove('hidden');
    window.initDatePickers();
};

window.saveMasterAccount = async () => {
    const service = await window.getOrRegisterService('mService', 'mServiceCustom');
    if (!service) return;
    const id = 'master_' + Date.now();
    const masterCode = 'MAT-' + Math.floor(1000 + Math.random() * 9000);
    const provider = document.getElementById('mProvider').value.trim();
    const capacity = parseInt(document.getElementById('mCapacity').value) || 5;
    const cost = parseFloat(document.getElementById('mCost').value) || 0;
    const currency = document.getElementById('mCurrency').value;
    const startDate = document.getElementById('mStartDate').value || window.formatDateDDMMYYYY(new Date());
    const months = parseInt(document.getElementById('mMonths').value) || 1;
    const email = document.getElementById('mEmail').value.trim();
    const pass = document.getElementById('mPass').value.trim();
    const hidePasswordFromClient = document.getElementById('mHidePass').checked;
    const showCredentialsToClient = !hidePasswordFromClient;
    
    const sDateObj = window.parseDateUniversal(startDate) || new Date();
    const endObj = new Date(sDateObj.getTime() + (months * 30 * 86400000));
    const end = window.formatDateDDMMYYYY(endObj);

    const newAcc = { 
        id, 
        masterCode,
        service, 
        provider, 
        capacity, 
        cost, 
        currency, 
        startDate, 
        endDate: end, 
        email, 
        pass, 
        hidePasswordFromClient, 
        showCredentialsToClient, 
        profiles: new Array(capacity).fill(null),
        createdAt: new Date().toISOString()
    };
    appState.masterAccounts.push(newAcc);

    const txId = 'tx_mas_' + Date.now();
    const newTx = { id: txId, date: startDate, type: 'COMPRA', person: provider || 'Proveedor', service, amount: cost, currency };
    appState.history.push(newTx);

    try {
        await setDoc(doc(db, "masterAccounts", id), newAcc);
        await setDoc(doc(db, "history", txId), newTx);
    } catch(e){
        console.error("Error guardando cuenta matriz:", e);
    }

    document.getElementById('masterModal').classList.add('hidden');
    window.renderAll();
};

window.toggleMasterCredentialsVisibility = async (accId) => {
    const acc = (appState.masterAccounts || []).find(a => a.id === accId);
    if (!acc) return;

    acc.showCredentialsToClient = !acc.showCredentialsToClient;
    acc.hidePasswordFromClient = !acc.showCredentialsToClient;

    // Sincronizar ÚNICAMENTE las suscripciones que pertenecen estrictamente a este ID de Cuenta Raíz
    appState.subscriptions.forEach(async (sub) => {
        const isLinkedByProfile = acc.profiles && Array.isArray(acc.profiles) && acc.profiles.includes(sub.id);
        const isLinkedById = sub.masterAccountId === acc.id;

        if (isLinkedByProfile || isLinkedById) {
            sub.masterAccountId = acc.id;
            sub.hidePassword = acc.hidePasswordFromClient;
            sub.hidePasswordFromClient = acc.hidePasswordFromClient;
            sub.showCredentials = acc.showCredentialsToClient;
            sub.showCredentialsToClient = acc.showCredentialsToClient;
            try { 
                await setDoc(doc(db, "subscriptions", sub.id), {
                    hidePassword: acc.hidePasswordFromClient,
                    hidePasswordFromClient: acc.hidePasswordFromClient,
                    showCredentials: acc.showCredentialsToClient,
                    showCredentialsToClient: acc.showCredentialsToClient,
                    masterAccountId: acc.id,
                    updatedAt: new Date().toISOString()
                }, { merge: true }); 
            } catch(e){}
        }
    });

    try {
        await setDoc(doc(db, "masterAccounts", acc.id), {
            ...acc,
            hidePasswordFromClient: acc.hidePasswordFromClient,
            showCredentialsToClient: acc.showCredentialsToClient,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch(e) { console.error(e); }

    window.renderMasterAccounts();
    window.renderActiveTable();
};
window.toggleMasterPasswordVisibility = window.toggleMasterCredentialsVisibility;

window.openEditMasterModal = (accId) => {
    const acc = (appState.masterAccounts || []).find(a => a.id === accId);
    if(!acc) return;
    document.getElementById('editMasterId').value = acc.id;
    document.getElementById('editMasterEmail').value = acc.email;
    document.getElementById('editMasterPass').value = acc.pass;
    document.getElementById('editMasterCapacity').value = acc.capacity;
    document.getElementById('editMasterHidePass').checked = !!acc.hidePasswordFromClient;
    document.getElementById('editMasterModal').classList.remove('hidden');
};

window.saveEditMasterModal = async () => {
    const id = document.getElementById('editMasterId').value;
    const acc = (appState.masterAccounts || []).find(a => a.id === id);
    if(!acc) return;
    const newEmail = document.getElementById('editMasterEmail').value.trim();
    const newPass = document.getElementById('editMasterPass').value.trim();
    const newCapacity = parseInt(document.getElementById('editMasterCapacity').value) || acc.capacity;
    const newHidePass = document.getElementById('editMasterHidePass').checked;
    
    acc.email = newEmail;
    acc.pass = newPass;
    acc.hidePasswordFromClient = newHidePass;
    acc.showCredentialsToClient = !newHidePass;

    if (newCapacity > acc.capacity) {
        const diff = newCapacity - acc.capacity;
        for(let i=0; i<diff; i++) acc.profiles.push(null);
    } else if (newCapacity < acc.capacity) {
        acc.profiles = acc.profiles.slice(0, newCapacity);
    }
    acc.capacity = newCapacity;

    // Sincronizar credenciales solo en suscripciones que pertenecen estrictamente a este ID de Cuenta Raíz
    appState.subscriptions.forEach(async (sub) => {
        const isLinkedByProfile = acc.profiles && acc.profiles.includes(sub.id);
        const isLinkedById = sub.masterAccountId === acc.id;

        if (isLinkedByProfile || isLinkedById) {
            sub.email = acc.email;
            sub.pass = acc.pass;
            sub.hidePassword = acc.hidePasswordFromClient;
            sub.showCredentials = acc.showCredentialsToClient;
            try { 
                await setDoc(doc(db, "subscriptions", sub.id), {
                    email: acc.email,
                    pass: acc.pass,
                    hidePassword: acc.hidePasswordFromClient,
                    hidePasswordFromClient: acc.hidePasswordFromClient,
                    showCredentials: acc.showCredentialsToClient,
                    showCredentialsToClient: acc.showCredentialsToClient,
                    updatedAt: new Date().toISOString()
                }, { merge: true }); 
            } catch(e){}
        }
    });

    try { await setDoc(doc(db, "masterAccounts", id), acc, { merge: true }); } catch(e){}
    document.getElementById('editMasterModal').classList.add('hidden');
    window.renderAll();
};

window.deleteMasterAccount = async (accId) => {
    const acc = (appState.masterAccounts || []).find(a => a.id === accId);
    const accCode = acc ? (acc.masterCode || window.getMasterCode(acc)) : '';
    const accName = acc ? `"${acc.service}" [${accCode}] (${acc.email || ''})` : 'esta cuenta matriz';

    const linkedSubs = (appState.subscriptions || []).filter(s => 
        s.masterAccountId === accId || (acc && acc.profiles && Array.isArray(acc.profiles) && acc.profiles.includes(s.id))
    );

    let msg = `¿Estás seguro de ELIMINAR la Cuenta Raíz ${accName}?`;
    if (linkedSubs.length > 0) {
        msg += `\n\n⚠️ Esta cuenta tiene ${linkedSubs.length} servicio(s) asignado(s) a clientes.\nAl eliminarla, se eliminarán también estos servicios activos para evitar cuentas duplicadas o huérfanas en los perfiles de los clientes.`;
    }

    if (confirm(msg)) {
        // 1. Eliminar suscripciones hijas asociadas
        for (const sub of linkedSubs) {
            appState.subscriptions = appState.subscriptions.filter(s => s.id !== sub.id);
            try {
                await deleteDoc(doc(db, "subscriptions", sub.id));
                console.log("🗑️ Suscripción hija eliminada:", sub.id);
            } catch(e){
                console.error("Error eliminando sub vinculada:", e);
            }
        }

        // 2. Eliminar la cuenta matriz de Firestore y del estado
        appState.masterAccounts = appState.masterAccounts.filter(a => a.id !== accId);
        try { 
            await deleteDoc(doc(db, "masterAccounts", accId)); 
            console.log("🗑️ Cuenta matriz eliminada de Firestore:", accId);
        } catch(e){
            console.error("Error eliminando cuenta matriz:", e);
        }

        saveLocal();
        window.renderAll();
        alert(`✅ Cuenta Raíz ${accCode} y sus ${linkedSubs.length} servicios asociados fueron eliminados limpiamente.`);
    }
};

let selectedAssignClientId = null;
let currentAssignDurationMonths = 1;

window.openAssignModal = (accId, slotIndex) => {
    currentTargetSlot = parseInt(slotIndex) || 0;
    selectedAssignClientId = null;
    currentAssignDurationMonths = 1;

    let acc = (appState.masterAccounts || []).find(a => 
        (a.id && a.id.toString() === (accId || '').toString()) ||
        (a.email && a.email === accId)
    );

    if (!acc && typeof accId === 'number' && appState.masterAccounts[accId]) {
        acc = appState.masterAccounts[accId];
    }
    if (!acc && appState.masterAccounts.length > 0) {
        acc = appState.masterAccounts[0];
    }
    if (!acc) {
        alert("No se encontró la cuenta matriz seleccionada.");
        return;
    }
    currentTargetAcc = acc.id || accId;
    
    const labelEl = document.getElementById('assignServiceLabel');
    if (labelEl) labelEl.innerText = `${acc.service || 'Servicio'} (Cupo #${currentTargetSlot + 1}) - ${acc.email || ''}`;

    // Resetear a Paso 1 (Buscador y Selección de Clientes)
    document.getElementById('assignStep1_SelectClient')?.classList.remove('hidden');
    document.getElementById('assignStep2_ActivationForm')?.classList.add('hidden');
    
    const searchInput = document.getElementById('searchAssignClientInput');
    if (searchInput) searchInput.value = '';

    window.filterAssignClients();
    
    const modal = document.getElementById('assignModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
};

window.filterAssignClients = () => {
    const list = document.getElementById('assignClientsList');
    if (!list) return;
    list.innerHTML = '';

    // Si appState.clients está vacío, intentar recuperar de localStorage
    if (!appState.clients || appState.clients.length === 0) {
        try {
            appState.clients = JSON.parse(localStorage.getItem("cuycito_clients") || "[]");
        } catch(e){}
    }

    const searchTerm = (document.getElementById('searchAssignClientInput')?.value || '').toLowerCase().trim();

    const clients = (appState.clients || []).filter(c => {
        const name = (c.name || '').toLowerCase();
        const nick = (c.nickname || '').toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        const code = (c.clientCode || window.getClientCode(c) || '').toLowerCase();
        return name.includes(searchTerm) || nick.includes(searchTerm) || phone.includes(searchTerm) || code.includes(searchTerm);
    });

    if (clients.length === 0) {
        list.innerHTML = `
            <div class="p-6 text-center text-gray-500 bg-black/40 rounded-xl border border-gray-800 space-y-2">
                <i class="fa-solid fa-users-slash text-2xl text-gray-600"></i>
                <p class="text-xs font-bold text-gray-400">No se encontraron clientes registrados con esa búsqueda.</p>
                <button type="button" onclick="window.openNewClientFromAssign()" class="bg-cuycito-gold hover:bg-cuycito-gold_light text-black text-xs font-black px-4 py-2 rounded-lg transition shadow">
                    <i class="fa-solid fa-plus mr-1"></i> Crear Cliente Nuevo Ahora
                </button>
            </div>
        `;
        return;
    }

    list.innerHTML = clients.map((client, idx) => {
        const cId = client.id || client.phone || `client_${idx}`;
        const clientCode = client.clientCode || window.getClientCode(client);
        const balance = parseFloat(client.balance || 0).toFixed(2);
        const isOnline = !!client.isOnline;
        const onlineDot = isOnline 
            ? '<span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse inline-block shadow-[0_0_8px_rgba(52,211,153,0.8)]" title="En línea"></span>' 
            : '<span class="w-2.5 h-2.5 rounded-full bg-gray-600 inline-block" title="Desconectado"></span>';

        return `
        <div class="flex items-center justify-between p-3 bg-black/60 border border-gray-800 hover:border-cuycito-gold/60 rounded-xl transition group">
            <div class="flex items-center gap-3">
                ${onlineDot}
                <div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="bg-indigo-950 text-indigo-300 border border-indigo-500/40 text-[9px] font-black px-1.5 py-0.5 rounded font-mono">${clientCode}</span>
                        <h4 class="text-xs font-black text-white group-hover:text-cuycito-gold transition">${client.name}</h4>
                        ${client.nickname ? `<span class="text-[10px] text-gray-400">(@${client.nickname})</span>` : ''}
                    </div>
                    <p class="text-[10px] text-gray-400 font-mono mt-0.5">
                        📱 ${client.phone || 'Sin cel'} | 💰 Saldo: <span class="text-emerald-400 font-bold">S/ ${balance}</span>
                    </p>
                </div>
            </div>
            <button type="button" onclick="window.selectClientForAssign('${cId}')" class="bg-cuycito-gold hover:bg-cuycito-gold_light text-black font-black text-xs px-3.5 py-1.5 rounded-lg transition shadow flex items-center gap-1">
                <span>Asignar</span> <i class="fa-solid fa-arrow-right text-[10px]"></i>
            </button>
        </div>`;
    }).join('');
};

window.selectClientForAssign = (clientId) => {
    let client = (appState.clients || []).find(c => 
        c.id === clientId || 
        (c.id && c.id.toString() === (clientId || '').toString()) ||
        (c.phone && c.phone.toString() === (clientId || '').toString()) ||
        (c.clientCode && c.clientCode === clientId)
    );

    if (!client) {
        alert("No se pudo seleccionar el cliente.");
        return;
    }

    selectedAssignClientId = client.id || clientId;
    let acc = (appState.masterAccounts || []).find(a => 
        a.id === currentTargetAcc || 
        (a.id && a.id.toString() === (currentTargetAcc || '').toString()) ||
        (a.email && a.email === currentTargetAcc)
    );

    // Actualizar Resumen en Paso 2
    const codeEl = document.getElementById('assignSelectedClientCode');
    const nameEl = document.getElementById('assignSelectedClientName');
    const phoneEl = document.getElementById('assignSelectedClientPhone');
    const balEl = document.getElementById('assignSelectedClientBalance');

    if (codeEl) codeEl.innerText = client.clientCode || window.getClientCode(client);
    if (nameEl) nameEl.innerText = `${client.name} ${client.nickname ? '(@' + client.nickname + ')' : ''}`;
    if (phoneEl) phoneEl.innerText = client.phone || 'Sin celular';
    if (balEl) balEl.innerText = `S/ ${parseFloat(client.balance || 0).toFixed(2)}`;

    // Precargar Valores de Activación
    const pinInput = document.getElementById('assignPinInput');
    if (pinInput) pinInput.value = `Perfil ${currentTargetSlot + 1}`;

    const amountInput = document.getElementById('assignAmountInput');
    if (amountInput) amountInput.value = (acc && acc.cost ? (parseFloat(acc.cost) / (acc.capacity || 4) * 1.5).toFixed(2) : '10.00');

    const todayFormatted = window.formatDateDDMMYYYY(new Date());
    window.setDatePickerValue('assignStartDateInput', todayFormatted);

    const hidePassCheck = document.getElementById('assignHidePassCheck');
    if (hidePassCheck && acc) {
        hidePassCheck.checked = !!acc.hidePasswordFromClient;
    }

    window.setAssignDurationMonths(1);
    window.initDatePickers();

    // Cambiar a Paso 2
    document.getElementById('assignStep1_SelectClient')?.classList.add('hidden');
    document.getElementById('assignStep2_ActivationForm')?.classList.remove('hidden');
};

window.backToAssignClientSelection = () => {
    document.getElementById('assignStep2_ActivationForm')?.classList.add('hidden');
    document.getElementById('assignStep1_SelectClient')?.classList.remove('hidden');
};

window.openNewClientFromAssign = () => {
    document.getElementById('assignModal')?.classList.add('hidden');
    window.openClientModal();
};

window.setAssignDurationMonths = (months) => {
    const val = Math.max(1, parseInt(months) || 1);
    currentAssignDurationMonths = val;
    
    const durationInput = document.getElementById('assignDurationInput');
    if (durationInput && parseInt(durationInput.value) !== val) {
        durationInput.value = val;
    }

    [1, 2, 3].forEach(m => {
        const btn = document.getElementById(`btnAssignDur${m}`);
        if (btn) {
            if (m === val) {
                btn.className = "bg-cuycito-gold text-black font-black py-2 rounded-xl text-xs transition border border-cuycito-gold shadow";
            } else {
                btn.className = "bg-black hover:bg-gray-900 text-gray-300 font-bold py-2 rounded-xl text-xs transition border border-gray-700";
            }
        }
    });

    window.recalculateAssignEndDate();
};

window.recalculateAssignEndDate = () => {
    const startVal = document.getElementById('assignStartDateInput')?.value;
    if (!startVal) return;

    const startDate = window.parseDateUniversal(startVal);
    if (!startDate) return;

    const daysToAdd = currentAssignDurationMonths * 30;
    startDate.setDate(startDate.getDate() + daysToAdd);

    window.setDatePickerValue('assignEndDateInput', startDate);
};

window.executeClientSlotAssignment = async () => {
    const acc = appState.masterAccounts.find(a => a.id === currentTargetAcc);
    const client = (appState.clients || []).find(c => c.id === selectedAssignClientId);

    if (!acc || !client) {
        alert("Por favor selecciona un cliente y una cuenta matriz válida.");
        return;
    }

    const pin = (document.getElementById('assignPinInput')?.value || `Perfil ${currentTargetSlot + 1}`).trim();
    const amount = parseFloat(document.getElementById('assignAmountInput')?.value || 10.00);
    const currency = document.getElementById('assignCurrencySelect')?.value || 'PEN';
    const startDate = document.getElementById('assignStartDateInput')?.value || new Date().toISOString().split('T')[0];
    const endDate = document.getElementById('assignEndDateInput')?.value || new Date().toISOString().split('T')[0];
    const hidePass = !!document.getElementById('assignHidePassCheck')?.checked;

    const clientCode = client.clientCode || window.getClientCode(client);
    const masterCode = acc.masterCode || window.getMasterCode(acc);
    const newSubId = "sub_cuy_" + Date.now();

    // 0. Si el slot ya tenía una suscripción asignada previa, eliminarla de Firestore para no dejar huérfanos
    if (acc.profiles && acc.profiles[currentTargetSlot]) {
        const prevSubId = acc.profiles[currentTargetSlot];
        if (prevSubId && prevSubId !== newSubId) {
            appState.subscriptions = (appState.subscriptions || []).filter(s => s.id !== prevSubId);
            try {
                await deleteDoc(doc(db, "subscriptions", prevSubId));
                console.log("🗑️ Reemplazada suscripción previa del slot:", prevSubId);
            } catch(e){}
        }
    }

    const newSub = {
        id: newSubId,
        clientId: client.id,
        clientCode: clientCode,
        clientPhone: client.phone || '',
        clientNickname: client.nickname || client.name,
        person: client.name,
        service: acc.service,
        email: acc.email,
        pass: acc.pass,
        pin: pin,
        masterAccountId: acc.id,
        masterCode: masterCode,
        slotIndex: currentTargetSlot,
        hidePassword: hidePass,
        hidePasswordFromClient: hidePass,
        showCredentials: !hidePass,
        showCredentialsToClient: !hidePass,
        amount: amount,
        price: amount,
        currency: currency,
        startDate: startDate,
        endDate: endDate,
        status: 'active',
        type: 'VENTA',
        createdAt: new Date().toISOString()
    };

    // 1. Guardar suscripción
    appState.subscriptions.push(newSub);
    try {
        await setDoc(doc(db, "subscriptions", newSubId), newSub);
    } catch(e) {
        console.error("Error guardando suscripcion:", e);
    }

    // 2. Ocupar slot en la cuenta matriz
    if (!acc.profiles) acc.profiles = [];
    acc.profiles[currentTargetSlot] = newSubId;
    try {
        await setDoc(doc(db, "masterAccounts", acc.id), acc, { merge: true });
    } catch(e) {
        console.error("Error actualizando cuenta matriz:", e);
    }

    // 3. Registrar venta en Libro Mayor (History)
    const historyItem = {
        id: "hist_" + Date.now(),
        clientId: client.id,
        clientCode: clientCode,
        person: client.name,
        service: acc.service,
        type: 'VENTA',
        amount: amount,
        currency: currency,
        date: startDate,
        timestamp: new Date().toISOString()
    };
    appState.history.push(historyItem);
    try {
        await setDoc(doc(db, "history", historyItem.id), historyItem);
    } catch(e) {
        console.error("Error guardando history:", e);
    }

    saveLocal();
    document.getElementById('assignModal')?.classList.add('hidden');
    window.renderAll();

    const passText = hidePass ? '🔒 Contraseña Oculta en Portal' : `🔑 Contraseña: ${acc.pass}`;
    const whatsappMsg = `¡Hola ${client.name}! 🐹✨\n\nTu servicio de *${acc.service}* ha sido *ACTIVADO CON ÉXITO*:\n\n👤 *Perfil / PIN:* ${pin}\n📧 *Correo:* ${acc.email}\n${passText}\n📆 *Vigencia:* Del ${startDate} al ${endDate}\n\nYa puedes acceder a tu panel en https://cuzcitogo.pe/perfil.html para revisar tu servicio. ¡Gracias por tu preferencia! 🙌`;

    if (confirm(`🎉 ¡Cliente "${client.name}" (${clientCode}) conectado exitosamente a ${acc.service} (Cupo #${currentTargetSlot + 1})!\n\n¿Deseas enviar las credenciales y confirmación por WhatsApp ahora?`)) {
        window.open(`https://wa.me/${(client.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(whatsappMsg)}`, '_blank');
    }
};

window.unlinkProfile = async (accId, slotIndex) => {
    const acc = (appState.masterAccounts || []).find(a => a.id === accId);
    if (!acc) return;
    const oldSubId = acc.profiles ? acc.profiles[slotIndex] : null;

    if (confirm(`¿Desvincular y liberar el cupo #${slotIndex + 1} de "${acc.service}"?`)) {
        if (oldSubId) {
            // Eliminar la suscripción desvinculada de Firestore y del estado para evitar duplicados en el perfil del cliente
            appState.subscriptions = (appState.subscriptions || []).filter(s => s.id !== oldSubId);
            try { 
                await deleteDoc(doc(db, "subscriptions", oldSubId));
                console.log("🗑️ Suscripción desvinculada eliminada de Firestore:", oldSubId);
            } catch(e){
                console.error("Error eliminando suscripción desvinculada:", e);
            }
        }

        if (acc.profiles) {
            acc.profiles[slotIndex] = null;
        }
        try { 
            await setDoc(doc(db, "masterAccounts", acc.id), acc, { merge: true }); 
        } catch(e){}

        saveLocal();
        window.renderAll();
    }
};

// =====================================
// 7. CLIENTES & AUTO-ACCESOS
// =====================================
window.switchClientModalTab = (tab) => {
    const tabPending = document.getElementById('client-tab-pending');
    const tabManual = document.getElementById('client-tab-manual');
    const btnPending = document.getElementById('tab-btn-client-pending');
    const btnManual = document.getElementById('tab-btn-client-manual');

    if (tab === 'pending') {
        if (tabPending) tabPending.classList.remove('hidden');
        if (tabManual) tabManual.classList.add('hidden');
        if (btnPending) btnPending.className = "text-blue-400 border-b-2 border-blue-400 pb-2 uppercase transition flex items-center gap-1.5";
        if (btnManual) btnManual.className = "text-gray-500 hover:text-white border-b-2 border-transparent pb-2 uppercase transition flex items-center gap-1.5";
        window.renderPendingClientsList();
    } else {
        if (tabPending) tabPending.classList.add('hidden');
        if (tabManual) tabManual.classList.remove('hidden');
        if (btnPending) btnPending.className = "text-gray-500 hover:text-white border-b-2 border-transparent pb-2 uppercase transition flex items-center gap-1.5";
        if (btnManual) btnManual.className = "text-blue-400 border-b-2 border-blue-400 pb-2 uppercase transition flex items-center gap-1.5";
    }
};

window.renderPendingClientsList = () => {
    const container = document.getElementById('pendingClientsList');
    const countBadge = document.getElementById('pendingClientsCount');
    if (!container) return;

    const existingClientNames = appState.clients.map(c => (c.name || '').trim().toLowerCase());
    
    const pendingMap = {};
    appState.subscriptions.forEach(s => {
        const rawName = (s.person || '').trim();
        if (rawName && rawName.toLowerCase() !== 'sin asignar' && !existingClientNames.includes(rawName.toLowerCase())) {
            if (!pendingMap[rawName]) pendingMap[rawName] = [];
            pendingMap[rawName].push(s);
        }
    });

    const pendingNames = Object.keys(pendingMap);
    if (countBadge) countBadge.innerText = pendingNames.length;

    if (pendingNames.length === 0) {
        container.innerHTML = `
            <div class="py-8 text-center text-gray-500 space-y-2 bg-black/40 rounded-xl border border-gray-800 p-4">
                <i class="fa-solid fa-circle-check text-3xl text-emerald-400"></i>
                <p class="text-xs font-bold text-gray-300">¡Todos los clientes de ventas ya tienen acceso web creado!</p>
                <button type="button" onclick="window.switchClientModalTab('manual')" class="text-blue-400 underline text-xs font-bold">Crear acceso manual para un nuevo cliente</button>
            </div>
        `;
        return;
    }

    let html = '';
    pendingNames.forEach(name => {
        const subs = pendingMap[name];
        const servicesList = subs.map(s => s.service).join(', ');

        html += `
        <div class="bg-black/70 border border-gray-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-500/50 transition">
            <div>
                <h4 class="font-black text-white text-xs flex items-center gap-1.5">
                    <i class="fa-solid fa-user text-blue-400"></i> ${name}
                </h4>
                <p class="text-[10px] text-gray-400 mt-0.5">Servicios contratados: <strong class="text-cuycito-gold">${servicesList}</strong> (${subs.length} cuenta(s))</p>
            </div>
            <button type="button" onclick="window.autoCreateClientAccess('${name.replace(/'/g, "\\'")}')" class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs px-3.5 py-2 rounded-lg transition shadow flex items-center justify-center gap-1.5 flex-shrink-0">
                <i class="fa-solid fa-bolt text-cuycito-gold"></i> Crear Acceso Automático
            </button>
        </div>`;
    });

    container.innerHTML = html;
};

window.autoCreateClientAccess = async (personName) => {
    const randomPhone = '9' + Math.floor(10000000 + Math.random() * 90000000);
    const randomPass = Math.random().toString(36).slice(-8);
    const defaultNickname = personName;
    const id = 'user_' + Date.now();
    const clientCode = window.getClientCode({ id, phone: randomPhone, name: personName });

    const newClient = {
        id,
        clientCode,
        name: personName,
        nickname: defaultNickname,
        phone: randomPhone,
        pass: randomPass,
        email: '',
        balance: 0.00,
        isOnline: false,
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString()
    };

    appState.clients.push(newClient);

    // Auto-vincular inmediatamente todas las suscripciones de esta persona a su nuevo ID
    appState.subscriptions.forEach(async (s) => {
        if (!s.clientId && s.person && s.person.trim().toLowerCase() === personName.trim().toLowerCase()) {
            s.clientId = id;
            s.clientCode = clientCode;
            s.clientPhone = randomPhone;
            try {
                await setDoc(doc(db, "subscriptions", s.id), s, { merge: true });
            } catch(e){}
        }
    });

    try {
        await setDoc(doc(db, "users", id), newClient);
        
        const banner = document.getElementById('newAccessGeneratedBanner');
        if (banner) {
            banner.innerHTML = `
                <div class="flex items-start justify-between">
                    <div>
                        <span class="text-emerald-400 font-black uppercase tracking-wider block"><i class="fa-solid fa-circle-check"></i> ¡Acceso Creado Exitosamente!</span>
                        <p class="text-white mt-1">Cliente: <strong>${personName}</strong> (@${defaultNickname})</p>
                        <p class="text-blue-300 font-mono mt-0.5">Usuario (Teléfono): <strong class="text-white">${randomPhone}</strong> | Clave: <strong class="text-cuycito-gold">${randomPass}</strong></p>
                    </div>
                </div>
                <div class="flex gap-2 pt-2">
                    <button type="button" onclick="window.copyClientAccess('${id}')" class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                        <i class="fa-regular fa-copy"></i> Copiar Mensaje
                    </button>
                    <button type="button" onclick="window.sendClientAccessWhatsApp('${id}')" class="bg-[#25D366] text-black px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1">
                        <i class="fa-brands fa-whatsapp"></i> Enviar por WhatsApp
                    </button>
                </div>
            `;
            banner.classList.remove('hidden');
        }

        window.renderPendingClientsList();
        window.renderClients();
        alert(`✅ ¡Acceso creado para ${personName}!\nUsuario: ${randomPhone}\nContraseña: ${randomPass}`);
    } catch(e) {
        alert("Error al guardar acceso automático en Firebase.");
    }
};

window.generateRandomClientPhoneAndPass = () => {
    const randomPhone = '9' + Math.floor(10000000 + Math.random() * 90000000);
    const randomPass = Math.random().toString(36).slice(-8);
    const phoneInput = document.getElementById('cPhone');
    const passInput = document.getElementById('cPass');
    if (phoneInput) phoneInput.value = randomPhone;
    if (passInput) passInput.value = randomPass;
};

window.openClientModal = (clientId = null) => {
    try {
        const banner = document.getElementById('newAccessGeneratedBanner');
        if (banner) banner.classList.add('hidden');

        const dataList = document.getElementById('clientNamesList');
        if (dataList) {
            dataList.innerHTML = '';
            const uniqueNames = [...new Set(appState.subscriptions.map(s => s.person))].filter(Boolean);
            uniqueNames.forEach(name => { dataList.innerHTML += `<option value="${name}">`; });
        }

        if(!clientId) {
            if (document.getElementById('cId')) document.getElementById('cId').value = 'user_' + Date.now();
            if (document.getElementById('cName')) document.getElementById('cName').value = '';
            if (document.getElementById('cNickname')) document.getElementById('cNickname').value = '';
            if (document.getElementById('cPhone')) document.getElementById('cPhone').value = '';
            if (document.getElementById('cEmail')) document.getElementById('cEmail').value = '';
            if (document.getElementById('cPass')) document.getElementById('cPass').value = Math.random().toString(36).slice(-8);
            window.switchClientModalTab('pending');
        } else {
            const c = appState.clients.find(x => x.id === clientId || (x.id && x.id.toString() === clientId.toString()) || x.phone === clientId || x.name === clientId);
            if (!c) {
                console.error("Cliente no encontrado en appState.clients para edición:", clientId);
                alert("No se encontró el registro del cliente.");
                return;
            }
            if (document.getElementById('cId')) document.getElementById('cId').value = c.id;
            if (document.getElementById('cName')) document.getElementById('cName').value = c.name || '';
            if (document.getElementById('cNickname')) document.getElementById('cNickname').value = c.nickname || c.name || '';
            if (document.getElementById('cPhone')) document.getElementById('cPhone').value = c.phone || '';
            if (document.getElementById('cEmail')) document.getElementById('cEmail').value = c.email || '';
            if (document.getElementById('cPass')) document.getElementById('cPass').value = c.pass || '';
            window.switchClientModalTab('manual');
        }
        const modal = document.getElementById('clientModal');
        if (modal) modal.classList.remove('hidden');
    } catch(err) {
        console.error("Error abriendo modal de cliente:", err);
        alert("Error al abrir modal de edición: " + err.message);
    }
};

window.saveClient = async () => {
    const id = document.getElementById('cId').value || ('user_' + Date.now());
    const name = document.getElementById('cName').value.trim();
    const nickname = document.getElementById('cNickname').value.trim() || name;
    const phone = document.getElementById('cPhone').value.trim();
    const email = document.getElementById('cEmail').value.trim();
    const pass = document.getElementById('cPass').value.trim();

    if(!name || !phone || !pass) return alert("Nombre, Número y Contraseña son obligatorios.");

    const existing = appState.clients.find(c => c.phone === phone && c.id !== id);
    if (existing) return alert("Este número ya está registrado como acceso de otro cliente.");

    const oldClient = appState.clients.find(c => c.id === id) || {};
    const newClient = { 
        ...oldClient,
        id, 
        name, 
        nickname, 
        email, 
        pass, 
        phone,
        clientCode: oldClient.clientCode || window.getClientCode({ id, phone, name }),
        updatedAt: new Date().toISOString()
    };

    const index = appState.clients.findIndex(c => c.id === id);
    if(index > -1) appState.clients[index] = newClient;
    else appState.clients.push(newClient);

    try {
        await setDoc(doc(db, "users", id), newClient, { merge: true });
        const modal = document.getElementById('clientModal');
        if (modal) modal.classList.add('hidden');
        window.renderClients();
        alert("✅ Datos del cliente actualizados y guardados con éxito.");
    } catch(e) { 
        console.error("Error guardando cliente:", e);
        alert("Error guardando cliente: " + e.message); 
    }
};

window.deleteClient = async () => {
    const id = document.getElementById('cId').value;
    if(confirm("¿Eliminar el acceso de este cliente a la tienda web? Sus suscripciones seguirán existiendo en el sistema.")) {
        appState.clients = appState.clients.filter(c => c.id !== id);
        try { await deleteDoc(doc(db, "users", id)); } catch(e){}
        document.getElementById('clientModal').classList.add('hidden');
        window.renderClients();
    }
};

window.copyClientAccess = (clientId) => {
    const client = appState.clients.find(c => c.id === clientId);
    if (!client) return;
    const nickname = client.nickname || client.name;
    const message = `🐹 *CUYCITOGO - ACCESO A TU CUENTA VIP* 🐹\n\nHola *${nickname}* (${client.name}), esta es tu cuenta para acceder a nuestro portal web:\n\n👤 *Usuario:* ${client.phone}\n🔐 *Contraseña:* ${client.pass}\n\nIngresa para ver tus servicios contratados en tiempo real. ¡Cualquier consulta estamos a tu disposición! 🙌`;
    
    navigator.clipboard.writeText(message).then(() => {
        alert(`📋 ¡Mensaje copiado para WhatsApp!\n\n${message}`);
    }).catch(() => {
        prompt("Copia este mensaje:", message);
    });
};

window.sendClientAccessWhatsApp = (clientId) => {
    const client = appState.clients.find(c => c.id === clientId);
    if (!client) return;
    const nickname = client.nickname || client.name;
    const message = `🐹 *CUYCITOGO - ACCESO A TU CUENTA VIP* 🐹\n\nHola *${nickname}* (${client.name}), esta es tu cuenta para acceder a nuestro portal web:\n\n👤 *Usuario:* ${client.phone}\n🔐 *Contraseña:* ${client.pass}\n\nIngresa para ver tus servicios contratados en tiempo real. ¡Cualquier consulta estamos a tu disposición! 🙌`;
    const cleanPhone = client.phone.replace(/[^0-9]/g, '');
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
};

// =====================================
// 8. ENLAZADO Y GESTIÓN DE SERVICIOS PARA CLIENTES
// =====================================
window.openClientServicesModal = (clientId) => {
    activeManagingClient = appState.clients.find(c => c.id === clientId);
    if (!activeManagingClient) return;

    document.getElementById('csmClientName').innerText = activeManagingClient.name;
    document.getElementById('csmClientNickname').innerText = `@${activeManagingClient.nickname || activeManagingClient.name}`;
    document.getElementById('csmClientPhone').innerText = activeManagingClient.phone;

    window.updateAllServiceDropdowns();

    const searchSubs = document.getElementById('csmSearchSubs');
    if (searchSubs) searchSubs.value = '';
    
    document.getElementById('csmNewEmail').value = '';
    document.getElementById('csmNewPass').value = '';
    document.getElementById('csmNewPin').value = '';
    document.getElementById('csmNewAmount').value = '';
    document.getElementById('csmNewMonths').value = '1';
    document.getElementById('csmNewHidePass').checked = false;

    window.renderCsmLinkedList();
    window.renderCsmAvailableSubs();

    document.getElementById('clientServicesModal').classList.remove('hidden');
};

window.renderCsmLinkedList = () => {
    if (!activeManagingClient) return;
    const container = document.getElementById('csmLinkedList');
    const badge = document.getElementById('csmLinkedCountBadge');
    if (!container) return;

    const clientNameNorm = (activeManagingClient.name || '').trim().toLowerCase();
    const clientPhoneNorm = (activeManagingClient.phone || '').toString().replace(/\D/g, '');
    const clientCode = window.getClientCode(activeManagingClient);

    const linked = appState.subscriptions.filter(s => {
        if (s.clientId && activeManagingClient.id && s.clientId === activeManagingClient.id) return true;
        if (s.clientCode && clientCode && s.clientCode === clientCode) return true;
        const sPhone = (s.clientPhone || s.phone || '').toString().replace(/\D/g, '');
        if (sPhone && clientPhoneNorm && sPhone.length >= 7 && sPhone === clientPhoneNorm) return true;
        return false;
    });

    if (badge) badge.innerText = `${linked.length} servicios`;

    if (linked.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-gray-500 italic bg-black/40 rounded-lg border border-gray-800 text-xs">No tiene servicios vinculados actualmente. Puedes vincular uno abajo.</div>`;
        return;
    }

    let html = '';
    linked.forEach(sub => {
        const days = window.getDaysRemaining(sub.endDate);
        const dColor = days < 0 ? 'text-red-400' : (days <= 3 ? 'text-cuycito-gold' : 'text-emerald-400');
        const passVisibilityBadge = sub.hidePassword 
            ? `<span class="bg-red-950/80 text-red-400 border border-cuycito-red/40 px-1.5 py-0.5 rounded text-[9px] font-bold">🔒 Clave Oculta</span>` 
            : `<span class="bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[9px] font-bold">👁️ Clave Visible</span>`;

        html += `
        <div class="bg-gray-900 border border-gray-700 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div class="space-y-1">
                <div class="flex items-center gap-2">
                    <span class="font-black text-white text-sm">${sub.service}</span>
                    ${passVisibilityBadge}
                    <span class="text-[10px] font-bold ${dColor}">Vence: ${sub.endDate} (${days < 0 ? 'Expiró' : days + ' días'})</span>
                </div>
                <div class="text-[11px] font-mono text-gray-400 flex flex-wrap gap-2">
                    <span>User: <strong class="text-white">${sub.email || '-'}</strong></span>
                    <span>Pass: <strong class="text-cuycito-gold">${sub.pass || '-'}</strong></span>
                    <span>PIN: <strong class="text-white">${sub.pin || '-'}</strong></span>
                </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <button onclick="window.unlinkServiceFromClient('${sub.id}')" class="bg-amber-950 hover:bg-amber-900 text-cuycito-gold border border-cuycito-gold/40 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1" title="Quitar enlace">
                    <i class="fa-solid fa-link-slash"></i> Desvincular
                </button>
                <button onclick="window.deleteSubFromClientManager('${sub.id}')" class="bg-red-950 hover:bg-red-900 text-red-400 border border-red-500/40 p-1.5 px-2 rounded-lg text-xs transition" title="Eliminar servicio">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`;
    });

    container.innerHTML = html;
};

window.renderCsmAvailableSubs = () => {
    if (!activeManagingClient) return;
    const select = document.getElementById('csmAvailableSelect');
    if (!select) return;

    const searchTerm = (document.getElementById('csmSearchSubs')?.value || '').toLowerCase().trim();
    const clientNameNorm = (activeManagingClient.name || '').trim().toLowerCase();

    const available = appState.subscriptions.filter(s => {
        const isNotSame = s.clientId !== activeManagingClient.id && (!s.person || s.person.trim().toLowerCase() !== clientNameNorm);
        const match = (s.service || '').toLowerCase().includes(searchTerm) ||
                      (s.email || '').toLowerCase().includes(searchTerm) ||
                      (s.person || '').toLowerCase().includes(searchTerm);
        return isNotSame && match;
    });

    select.innerHTML = '<option value="">-- Seleccionar suscripción --</option>';
    available.forEach(s => {
        const owner = s.person ? `(Asignado a: ${s.person})` : `(Sin asignar)`;
        select.innerHTML += `<option value="${s.id}">${s.service} - ${s.email || 'Sin correo'} ${owner}</option>`;
    });
};

window.unlinkServiceFromClient = async (subId) => {
    const sub = (appState.subscriptions || []).find(s => s.id === subId);
    if (!sub) return;

    if (confirm(`¿Desvincular "${sub.service}" de ${activeManagingClient.name}? El servicio será retirado y liberado limpiamente de la base de datos.`)) {
        // 1. Si pertenecía a una cuenta matriz, liberar el cupo en la matriz
        if (sub.masterAccountId) {
            const masterAcc = (appState.masterAccounts || []).find(m => m.id === sub.masterAccountId);
            if (masterAcc && masterAcc.profiles) {
                const sIdx = masterAcc.profiles.findIndex(p => p === subId);
                if (sIdx >= 0) {
                    masterAcc.profiles[sIdx] = null;
                    try {
                        await setDoc(doc(db, "masterAccounts", masterAcc.id), masterAcc, { merge: true });
                    } catch(e){}
                }
            }
        }

        // 2. Eliminar la suscripción desvinculada para no dejar datos muertos en Firestore
        appState.subscriptions = (appState.subscriptions || []).filter(s => s.id !== subId);
        try {
            await deleteDoc(doc(db, "subscriptions", subId));
            console.log("🗑️ Servicio desvinculado eliminado de Firestore:", subId);
        } catch(e){
            console.error("Error eliminando servicio:", e);
        }

        saveLocal();
        window.renderCsmLinkedList();
        window.renderCsmAvailableSubs();
        window.renderClients();
        window.renderActiveTable();
        window.renderMasterAccounts();
    }
};

window.deleteSubFromClientManager = async (subId) => {
    if (confirm("¿Eliminar definitivamente este servicio del sistema?")) {
        appState.subscriptions = appState.subscriptions.filter(s => s.id !== subId);
        try {
            await deleteDoc(doc(db, "subscriptions", subId));
            window.renderCsmLinkedList();
            window.renderCsmAvailableSubs();
            window.renderClients();
            window.renderActiveTable();
        } catch(e) {
            alert("Error al eliminar servicio.");
        }
    }
};

window.linkSelectedSubToClient = async () => {
    if (!activeManagingClient) return;
    const select = document.getElementById('csmAvailableSelect');
    const subId = select?.value;
    if (!subId) {
        alert("Por favor selecciona una suscripción de la lista para vincular.");
        return;
    }

    const sub = appState.subscriptions.find(s => s.id === subId);
    if (!sub) return;

    sub.person = activeManagingClient.name;
    sub.clientId = activeManagingClient.id;
    sub.clientCode = activeManagingClient.clientCode || window.getClientCode(activeManagingClient);
    sub.clientPhone = activeManagingClient.phone;

    try {
        await setDoc(doc(db, "subscriptions", sub.id), sub);
        alert(`✅ ¡Servicio "${sub.service}" vinculado exitosamente a ${activeManagingClient.name} (ID: ${sub.clientCode})!`);
        window.renderCsmLinkedList();
        window.renderCsmAvailableSubs();
        window.renderClients();
        window.renderActiveTable();
    } catch(e) {
        alert("Error al vincular el servicio.");
    }
};

window.createAndLinkDirectSub = async () => {
    if (!activeManagingClient) return;

    const service = document.getElementById('csmNewService').value;
    const email = document.getElementById('csmNewEmail').value.trim();
    const pass = document.getElementById('csmNewPass').value.trim();
    const pin = document.getElementById('csmNewPin').value.trim();
    const hidePassword = document.getElementById('csmNewHidePass').checked;
    const showCredentials = !hidePassword;
    const amount = parseFloat(document.getElementById('csmNewAmount').value) || 0;
    const months = parseInt(document.getElementById('csmNewMonths').value) || 1;

    if (!service) {
        alert("Selecciona un servicio.");
        return;
    }

    const today = new Date();
    const startStr = today.toISOString().split('T')[0];
    const end = new Date(today.getTime() + (months * 30 * 86400000));
    const endStr = end.toISOString().split('T')[0];

    const newSub = {
        id: 'sub_cuy_' + Date.now(),
        clientId: activeManagingClient.id,
        clientCode: activeManagingClient.clientCode || window.getClientCode(activeManagingClient),
        clientPhone: activeManagingClient.phone,
        person: activeManagingClient.name,
        service: service,
        email: email,
        pass: pass,
        pin: pin,
        hidePassword,
        hidePasswordFromClient: hidePassword,
        showCredentials,
        showCredentialsToClient: showCredentials,
        amount: amount,
        currency: 'PEN',
        startDate: startStr,
        endDate: endStr,
        type: 'VENTA',
        months: months
    };

    appState.subscriptions.push(newSub);
    appState.history.push({
        id: 'tx_cuy_' + Date.now(),
        date: startStr,
        type: 'VENTA',
        person: activeManagingClient.name,
        service: service,
        amount: amount,
        currency: 'PEN'
    });

    try {
        await setDoc(doc(db, "subscriptions", newSub.id), newSub);
        alert(`✨ ¡Nueva suscripción de ${service} creada y vinculada a ${activeManagingClient.name}!`);
        
        document.getElementById('csmNewEmail').value = '';
        document.getElementById('csmNewPass').value = '';
        document.getElementById('csmNewPin').value = '';
        document.getElementById('csmNewAmount').value = '';
        document.getElementById('csmNewHidePass').checked = false;

        window.renderCsmLinkedList();
        window.renderClients();
        window.renderActiveTable();
    } catch(e) {
        alert("Error al guardar nueva suscripción.");
    }
};

// =====================================
// 9. CATÁLOGO WEB & PRODUCTOS INDIVIDUALES
// =====================================
window.openCatalogModal = (catId = null) => {
    const form = document.getElementById('catalogModal');
    
    const masterSelect = document.getElementById('catMasterSelect');
    if (masterSelect) {
        masterSelect.innerHTML = '<option value="">-- Seleccionar Plataforma o Cuenta Raíz --</option>';

        // 1. Agrupar por Servicio / Plataforma para cálculo combinado de stock
        const servicesWithAccounts = {};
        appState.masterAccounts.forEach(acc => {
            const serv = acc.service || 'Streaming';
            if (!servicesWithAccounts[serv]) {
                servicesWithAccounts[serv] = { accounts: [], totalCapacity: 0, totalOccupied: 0 };
            }
            const occ = (acc.profiles || []).filter(p => p !== null).length;
            servicesWithAccounts[serv].accounts.push(acc);
            servicesWithAccounts[serv].totalCapacity += acc.capacity;
            servicesWithAccounts[serv].totalOccupied += occ;
        });

        const servKeys = Object.keys(servicesWithAccounts).sort();
        if (servKeys.length > 0) {
            let groupServicesHTML = '<optgroup label="⚡ SUMA TOTAL POR SERVICIO (Todas las Cuentas Raíz)">';
            servKeys.forEach(serv => {
                const info = servicesWithAccounts[serv];
                const totalFree = Math.max(0, info.totalCapacity - info.totalOccupied);
                const count = info.accounts.length;
                groupServicesHTML += `<option value="service_${serv}">⚡ ${serv} (${totalFree} cupos libres en ${count} cuenta${count > 1 ? 's' : ''} activa${count > 1 ? 's' : ''})</option>`;
            });
            groupServicesHTML += '</optgroup>';
            masterSelect.innerHTML += groupServicesHTML;
        }

        // 2. Cuentas individuales
        if (appState.masterAccounts.length > 0) {
            let groupIndividualHTML = '<optgroup label="👑 CUENTAS RAÍZ INDIVIDUALES">';
            appState.masterAccounts.forEach(acc => {
                const occupied = (acc.profiles || []).filter(p => p !== null).length;
                const freeSlots = Math.max(0, acc.capacity - occupied);
                groupIndividualHTML += `<option value="account_${acc.id}">${acc.service} - ${acc.email} (${freeSlots} libres)</option>`;
            });
            groupIndividualHTML += '</optgroup>';
            masterSelect.innerHTML += groupIndividualHTML;
        }
    }

    if(!catId) {
        document.getElementById('catId').value = 'prod_' + Date.now();
        document.getElementById('catTitle').value = '';
        document.getElementById('catCategory').value = 'Pantallas / Perfil';
        document.getElementById('catDesc').value = '';
        document.getElementById('catPrice').value = '';
        document.getElementById('catStock').value = '5';
        document.getElementById('catColor').value = '#e50914';
        document.getElementById('catPromo').checked = false;
        document.getElementById('catOldImage').value = '';
        document.getElementById('catLinkedMasterId').value = '';
        document.getElementById('catLinkedService').value = '';
        document.getElementById('catImageFile').value = ''; 
        document.getElementById('catImageUrlDirect').value = '';
    } else {
        const p = appState.catalog.find(c => c.id === catId);
        document.getElementById('catId').value = p.id;
        document.getElementById('catTitle').value = p.title;
        document.getElementById('catCategory').value = p.category || 'Pantallas / Perfil';
        document.getElementById('catDesc').value = p.description || '';
        document.getElementById('catPrice').value = p.price;
        document.getElementById('catStock').value = p.stock !== undefined ? p.stock : 5;
        
        let colorVal = p.color || p.colorClass || '#e50914';
        if (!colorVal.startsWith('#')) {
            const colorMap = { 'red-600': '#e50914', 'purple-500': '#8b5cf6', 'purple-600': '#8b5cf6', 'blue-500': '#3b82f6', 'blue-600': '#3b82f6', 'orange-500': '#f97316', 'emerald-500': '#10b981', 'emerald-600': '#10b981', 'yellow-500': '#ffb703', 'cuycito-gold': '#ffb703' };
            colorVal = colorMap[colorVal] || '#e50914';
        }
        document.getElementById('catColor').value = colorVal;

        document.getElementById('catPromo').checked = p.promo || p.isOffer || false;
        document.getElementById('catOldImage').value = p.imageUrl || '';
        document.getElementById('catLinkedMasterId').value = p.linkedMasterId || '';
        document.getElementById('catLinkedService').value = p.linkedService || '';
        document.getElementById('catImageUrlDirect').value = p.imageUrl || '';
        document.getElementById('catImageFile').value = ''; 
        
        if (masterSelect) {
            if (p.linkedService) {
                masterSelect.value = `service_${p.linkedService}`;
            } else if (p.linkedMasterId) {
                masterSelect.value = `account_${p.linkedMasterId}`;
            }
        }
    }
    form.classList.remove('hidden');
};

window.loadCatalogFromMasterAccount = () => {
    const masterSelect = document.getElementById('catMasterSelect');
    const selectedVal = masterSelect ? masterSelect.value : '';
    if (!selectedVal) {
        alert("Por favor selecciona una Plataforma o Cuenta Raíz de la lista.");
        return;
    }

    if (selectedVal.startsWith('service_')) {
        const serviceName = selectedVal.replace('service_', '');
        const matchingAccounts = appState.masterAccounts.filter(m => (m.service || '').toLowerCase() === serviceName.toLowerCase());
        
        const totalCapacity = matchingAccounts.reduce((sum, a) => sum + (a.capacity || 0), 0);
        const totalOccupied = matchingAccounts.reduce((sum, a) => sum + (a.profiles || []).filter(p => p !== null).length, 0);
        const totalFreeSlots = Math.max(0, totalCapacity - totalOccupied);

        document.getElementById('catTitle').value = `${serviceName} Premium 4K - 1 Perfil Privado`;
        document.getElementById('catCategory').value = 'Pantallas / Perfil';
        document.getElementById('catDesc').value = `1 Perfil Privado con PIN personalizado y calidad 4K Ultra HD. Garantía total durante tus 30 días de suscripción con soporte continuo.`;
        document.getElementById('catStock').value = totalFreeSlots;
        document.getElementById('catLinkedService').value = serviceName;
        document.getElementById('catLinkedMasterId').value = '';

        const servLower = serviceName.toLowerCase();
        const colorSelect = document.getElementById('catColor');
        if (colorSelect) {
            if (servLower.includes('netflix')) colorSelect.value = 'red-600';
            else if (servLower.includes('spotify')) colorSelect.value = 'emerald-500';
            else if (servLower.includes('disney')) colorSelect.value = 'blue-500';
            else if (servLower.includes('max') || servLower.includes('hbo')) colorSelect.value = 'purple-500';
            else if (servLower.includes('prime')) colorSelect.value = 'yellow-500';
            else if (servLower.includes('crunchyroll')) colorSelect.value = 'orange-500';
        }

        alert(`✨ ¡Datos cargados desde todas las cuentas de ${serviceName}!\nStock total sumado: ${totalFreeSlots} cupos libres en ${matchingAccounts.length} cuenta(s) activa(s).`);
    } else if (selectedVal.startsWith('account_')) {
        const accId = selectedVal.replace('account_', '');
        const acc = appState.masterAccounts.find(a => a.id === accId);
        if (!acc) return;

        const occupied = (acc.profiles || []).filter(p => p !== null).length;
        const freeSlots = Math.max(0, acc.capacity - occupied);

        document.getElementById('catTitle').value = `${acc.service} Premium 4K - 1 Perfil Privado`;
        document.getElementById('catCategory').value = 'Pantallas / Perfil';
        document.getElementById('catDesc').value = `1 Perfil Privado con PIN personalizado. Calidad 4K Ultra HD y garantía 100% durante 30 días.`;
        document.getElementById('catStock').value = freeSlots;
        document.getElementById('catLinkedMasterId').value = acc.id;
        document.getElementById('catLinkedService').value = '';

        const servLower = (acc.service || '').toLowerCase();
        const colorSelect = document.getElementById('catColor');
        if (colorSelect) {
            if (servLower.includes('netflix')) colorSelect.value = 'red-600';
            else if (servLower.includes('spotify')) colorSelect.value = 'emerald-500';
            else if (servLower.includes('disney')) colorSelect.value = 'blue-500';
            else if (servLower.includes('max') || servLower.includes('hbo')) colorSelect.value = 'purple-500';
            else if (servLower.includes('prime')) colorSelect.value = 'yellow-500';
            else if (servLower.includes('crunchyroll')) colorSelect.value = 'orange-500';
        }

        alert(`✨ ¡Datos cargados desde ${acc.service} (${acc.email})!\nStock asignado: ${freeSlots} cupos libres.`);
    }
};

window.saveCatalogItem = async () => {
    const statusLabel = document.getElementById('dbStatus');
    statusLabel.innerHTML = '<span class="text-yellow-400"><i class="fa-solid fa-spinner fa-spin"></i> Guardando...</span>';
    
    const id = document.getElementById('catId').value;
    const title = document.getElementById('catTitle').value.trim();
    const category = document.getElementById('catCategory').value;
    const desc = document.getElementById('catDesc').value.trim();
    const price = parseFloat(document.getElementById('catPrice').value) || 0;
    const stock = parseInt(document.getElementById('catStock').value) || 0;
    const linkedMasterId = document.getElementById('catLinkedMasterId').value || '';
    const linkedService = document.getElementById('catLinkedService').value || '';
    const color = document.getElementById('catColor').value;
    const promo = document.getElementById('catPromo').checked;
    
    const fileInput = document.getElementById('catImageFile');
    const directUrl = document.getElementById('catImageUrlDirect').value.trim();
    let imageUrl = directUrl || document.getElementById('catOldImage').value; 

    if (fileInput.files.length > 0) {
        try {
            statusLabel.innerHTML = '<span class="text-yellow-400"><i class="fa-solid fa-spinner fa-spin"></i> Subiendo imagen...</span>';
            const file = fileInput.files[0];
            const storageRef = ref(storage, 'catalogo/' + Date.now() + '_' + file.name);
            await uploadBytes(storageRef, file);
            imageUrl = await getDownloadURL(storageRef);
        } catch(e) {
            console.error("Error subiendo imagen:", e);
            alert("No se pudo subir la imagen a Storage, se guardará con la URL o sin ella.");
        }
    }

    if (!title) {
        alert("El título del producto es obligatorio.");
        return;
    }

    const newItem = { 
        id, 
        title, 
        category, 
        description: desc, 
        price, 
        stock, 
        linkedMasterId, 
        linkedService, 
        colorClass: color, 
        color: color, 
        promo, 
        isOffer: promo, 
        imageUrl, 
        isCombo: false 
    };

    const index = appState.catalog.findIndex(c => c.id === id);
    if(index > -1) appState.catalog[index] = newItem;
    else appState.catalog.push(newItem);

    try {
        await setDoc(doc(db, "store_catalog", id), newItem);
        document.getElementById('catalogModal').classList.add('hidden');
        window.renderCatalog();
        statusLabel.innerHTML = '<span class="text-emerald-400"><i class="fa-solid fa-cloud-check"></i> Sincronizado</span>';
    } catch(e) { alert("Error guardando producto."); }
};

window.deleteCatalogItem = async () => {
    const id = document.getElementById('catId').value;
    if(confirm("¿Seguro que deseas eliminar este producto de la tienda pública?")) {
        appState.catalog = appState.catalog.filter(c => c.id !== id);
        try { await deleteDoc(doc(db, "store_catalog", id)); } catch(e){}
        document.getElementById('catalogModal').classList.add('hidden');
        window.renderCatalog();
    }
};

// =====================================
// 10. MÓDULO: COMBOS DE SERVICIOS & OFERTAS
// =====================================
window.openComboModal = (comboId = null) => {
    const modal = document.getElementById('comboModal');
    const deleteBtn = document.getElementById('btnDeleteCombo');
    const container = document.getElementById('comboServicesContainer');
    if (!modal || !container) return;

    if (!comboId) {
        document.getElementById('comboId').value = 'combo_' + Date.now();
        document.getElementById('comboOldImage').value = '';
        document.getElementById('comboTitle').value = '';
        document.getElementById('comboDesc').value = 'Disfruta de tus plataformas favoritas en un solo combo con perfiles privados independientes, calidad 4K Ultra HD y garantía total 30 días.';
        document.getElementById('comboAdvantages').value = '✔ Perfiles Privados con PIN independiente\n✔ Calidad 4K Ultra HD & Audio Espacial\n✔ Garantía total 30 días con soporte continuo\n✔ Activación y entrega inmediata';
        document.getElementById('comboColor').value = 'red-600';
        document.getElementById('comboStock').value = '10';
        document.getElementById('comboImageFile').value = '';
        document.getElementById('comboImageUrlDirect').value = '';
        if (deleteBtn) deleteBtn.classList.add('hidden');

        currentComboRows = [
            { service: 'Netflix', regularPrice: 15.00, comboPrice: 10.00 },
            { service: 'Disney+', regularPrice: 12.00, comboPrice: 8.00 }
        ];
    } else {
        const p = appState.catalog.find(c => c.id === comboId);
        if (!p) return;
        document.getElementById('comboId').value = p.id;
        document.getElementById('comboOldImage').value = p.imageUrl || '';
        document.getElementById('comboTitle').value = p.title || '';
        document.getElementById('comboDesc').value = p.description || '';
        document.getElementById('comboAdvantages').value = (p.advantages || []).join('\n');
        document.getElementById('comboColor').value = p.colorClass || 'red-600';
        document.getElementById('comboStock').value = p.stock !== undefined ? p.stock : 10;
        document.getElementById('comboImageFile').value = '';
        document.getElementById('comboImageUrlDirect').value = p.imageUrl || '';
        if (deleteBtn) deleteBtn.classList.remove('hidden');

        currentComboRows = (p.comboServices && p.comboServices.length > 0) ? p.comboServices : [
            { service: 'Netflix', regularPrice: 15.00, comboPrice: 10.00 },
            { service: 'Disney+', regularPrice: 12.00, comboPrice: 8.00 }
        ];
    }

    window.renderComboServiceRows();
    modal.classList.remove('hidden');
};

window.renderComboServiceRows = () => {
    const container = document.getElementById('comboServicesContainer');
    if (!container) return;
    container.innerHTML = '';

    const allServices = appState.services && appState.services.length > 0 ? appState.services : DEFAULT_SERVICES;

    currentComboRows.forEach((row, index) => {
        let optionsHTML = '<option value="">-- Seleccionar Servicio --</option>';
        allServices.forEach(s => {
            const sel = (row.service || '').toLowerCase() === s.toLowerCase() ? 'selected' : '';
            optionsHTML += `<option value="${s}" ${sel}>${s}</option>`;
        });

        container.innerHTML += `
        <div class="bg-black/60 border border-gray-800 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 text-xs">
            <div class="flex items-center gap-2 flex-1">
                <span class="bg-cuycito-gold/20 text-cuycito-gold font-mono font-black text-xs px-2 py-1 rounded-md border border-cuycito-gold/30">#${index + 1}</span>
                <select onchange="window.updateComboRowService(${index}, this.value)" class="w-full bg-[#111] border border-gray-700 rounded-lg p-2 text-white font-bold outline-none focus:border-cuycito-gold">
                    ${optionsHTML}
                </select>
            </div>
            <div class="flex items-center gap-2">
                <div class="w-28">
                    <label class="block text-[9px] text-gray-400 font-bold uppercase mb-0.5">Precio Regular</label>
                    <div class="relative">
                        <span class="absolute left-2 top-2 text-gray-500 text-xs">S/</span>
                        <input type="number" step="0.50" min="0" value="${row.regularPrice || 0}" oninput="window.updateComboRowPrice(${index}, 'regularPrice', this.value)" class="w-full bg-[#111] border border-gray-700 rounded-lg p-2 pl-6 text-gray-300 font-bold outline-none">
                    </div>
                </div>
                <div class="w-28">
                    <label class="block text-[9px] text-emerald-400 font-bold uppercase mb-0.5">Precio Combo</label>
                    <div class="relative">
                        <span class="absolute left-2 top-2 text-emerald-500 text-xs">S/</span>
                        <input type="number" step="0.50" min="0" value="${row.comboPrice || 0}" oninput="window.updateComboRowPrice(${index}, 'comboPrice', this.value)" class="w-full bg-[#111] border border-emerald-500/50 rounded-lg p-2 pl-6 text-cuycito-gold font-black outline-none focus:border-emerald-400">
                    </div>
                </div>
                ${currentComboRows.length > 2 ? `
                <button type="button" onclick="window.removeComboServiceRow(${index})" class="text-gray-500 hover:text-cuycito-red p-2 rounded-lg transition mt-3 sm:mt-0" title="Eliminar servicio">
                    <i class="fa-solid fa-trash"></i>
                </button>` : '<div class="w-6"></div>'}
            </div>
        </div>`;
    });

    window.recalculateComboPrices();
};

window.addComboServiceRow = (service = '', regularPrice = 12.00, comboPrice = 8.00) => {
    currentComboRows.push({ service, regularPrice, comboPrice });
    window.renderComboServiceRows();
};

window.removeComboServiceRow = (index) => {
    if (currentComboRows.length <= 2) return alert("Un combo debe tener al menos 2 servicios.");
    currentComboRows.splice(index, 1);
    window.renderComboServiceRows();
};

window.updateComboRowService = (index, value) => {
    if (currentComboRows[index]) {
        currentComboRows[index].service = value;
        window.recalculateComboPrices();
    }
};

window.updateComboRowPrice = (index, field, value) => {
    if (currentComboRows[index]) {
        currentComboRows[index][field] = parseFloat(value) || 0;
        window.recalculateComboPrices();
    }
};

window.recalculateComboPrices = () => {
    let regularTotal = 0;
    let comboTotal = 0;
    const servicesNames = [];

    currentComboRows.forEach(r => {
        regularTotal += (parseFloat(r.regularPrice) || 0);
        comboTotal += (parseFloat(r.comboPrice) || 0);
        if (r.service) servicesNames.push(r.service);
    });

    const savingsAmount = Math.max(0, regularTotal - comboTotal);
    const savingsPercent = regularTotal > 0 ? Math.round((savingsAmount / regularTotal) * 100) : 0;

    const elRegular = document.getElementById('comboCalcRegularTotal');
    const elOffer = document.getElementById('comboCalcOfferTotal');
    const elSavings = document.getElementById('comboCalcSavingsAmount');
    const elPercent = document.getElementById('comboCalcSavingsPercent');

    if (elRegular) elRegular.innerText = `S/ ${regularTotal.toFixed(2)}`;
    if (elOffer) elOffer.innerText = `S/ ${comboTotal.toFixed(2)}`;
    if (elSavings) elSavings.innerText = `S/ ${savingsAmount.toFixed(2)}`;
    if (elPercent) elPercent.innerText = `${savingsPercent}% Ahorro`;

    const titleInput = document.getElementById('comboTitle');
    if (titleInput && (!titleInput.value.trim() || titleInput.value.startsWith('Combo '))) {
        if (servicesNames.length === 2) {
            titleInput.value = `Combo Dúo: ${servicesNames.join(' + ')}`;
        } else if (servicesNames.length === 3) {
            titleInput.value = `Combo Trío: ${servicesNames.join(' + ')}`;
        } else if (servicesNames.length > 3) {
            titleInput.value = `Mega Combo (${servicesNames.length} Servicios): ${servicesNames.join(' + ')}`;
        }
    }
};

window.saveComboItem = async () => {
    const statusLabel = document.getElementById('dbStatus');
    statusLabel.innerHTML = '<span class="text-yellow-400"><i class="fa-solid fa-spinner fa-spin"></i> Guardando Combo...</span>';

    const id = document.getElementById('comboId').value || 'combo_' + Date.now();
    const title = document.getElementById('comboTitle').value.trim();
    const desc = document.getElementById('comboDesc').value.trim();
    const stock = parseInt(document.getElementById('comboStock').value) || 10;
    const color = document.getElementById('comboColor').value || 'red-600';
    
    const advantagesText = document.getElementById('comboAdvantages').value.trim();
    const advantages = advantagesText.split('\n').map(a => a.trim()).filter(Boolean);

    let regularTotal = 0;
    let comboTotal = 0;
    currentComboRows.forEach(r => {
        regularTotal += (parseFloat(r.regularPrice) || 0);
        comboTotal += (parseFloat(r.comboPrice) || 0);
    });
    const savingsAmount = Math.max(0, regularTotal - comboTotal);
    const savingsPercent = regularTotal > 0 ? Math.round((savingsAmount / regularTotal) * 100) : 0;

    const fileInput = document.getElementById('comboImageFile');
    const directUrl = document.getElementById('comboImageUrlDirect').value.trim();
    let imageUrl = directUrl || document.getElementById('comboOldImage').value;

    if (fileInput.files.length > 0) {
        try {
            statusLabel.innerHTML = '<span class="text-yellow-400"><i class="fa-solid fa-spinner fa-spin"></i> Subiendo imagen del combo...</span>';
            const file = fileInput.files[0];
            const storageRef = ref(storage, 'catalogo/combos_' + Date.now() + '_' + file.name);
            await uploadBytes(storageRef, file);
            imageUrl = await getDownloadURL(storageRef);
        } catch(e) {
            console.error("Error subiendo imagen:", e);
        }
    }

    if (!title) return alert("El título del Combo es obligatorio.");
    if (currentComboRows.length < 2) return alert("Agrega al menos 2 servicios al combo.");

    const comboItem = {
        id,
        title,
        category: 'Combos',
        description: desc,
        price: comboTotal,
        regularPriceTotal: regularTotal,
        savingsAmount,
        savingsPercent,
        stock,
        colorClass: color,
        promo: true,
        isCombo: true,
        comboServices: currentComboRows,
        advantages,
        imageUrl
    };

    const index = appState.catalog.findIndex(c => c.id === id);
    if (index > -1) appState.catalog[index] = comboItem;
    else appState.catalog.push(comboItem);

    try {
        await setDoc(doc(db, "store_catalog", id), comboItem);
        document.getElementById('comboModal').classList.add('hidden');
        window.renderCatalog();
        statusLabel.innerHTML = '<span class="text-emerald-400"><i class="fa-solid fa-cloud-check"></i> Sincronizado</span>';
        alert(`🎉 ¡Combo "${title}" guardado y publicado en la tienda exitosamente!`);
    } catch(e) {
        alert("Error guardando el combo en Firebase.");
    }
};

window.deleteComboItem = async () => {
    const id = document.getElementById('comboId').value;
    if (confirm("¿Eliminar este Combo de la tienda definitivamente?")) {
        appState.catalog = appState.catalog.filter(c => c.id !== id);
        try { await deleteDoc(doc(db, "store_catalog", id)); } catch(e){}
        document.getElementById('comboModal').classList.add('hidden');
        window.renderCatalog();
    }
};

// =====================================
// 11. MÓDULO: POSIT / NOTAS RÁPIDAS
// =====================================
window.toggleNewPostitForm = (show = null) => {
    const form = document.getElementById('newPostitForm');
    if (!form) return;
    if (show === null) form.classList.toggle('hidden');
    else if (show) form.classList.remove('hidden');
    else form.classList.add('hidden');

    if (!form.classList.contains('hidden')) {
        document.getElementById('editPostitId').value = '';
        document.getElementById('postitContent').value = '';
        document.getElementById('postitContent').focus();
    }
};

window.selectPostitColor = (color) => {
    const hiddenInput = document.getElementById('selectedPostitColor');
    if (hiddenInput) hiddenInput.value = color;

    document.querySelectorAll('#postitColorPicker button').forEach(btn => {
        if (btn.getAttribute('data-color') === color) {
            btn.className = btn.className.replace('opacity-70', 'opacity-100 scale-110 border-white');
            btn.classList.add('scale-110', 'border-2', 'border-white');
        } else {
            btn.classList.remove('scale-110', 'border-2', 'border-white');
            btn.classList.add('opacity-70', 'border-transparent');
        }
    });
};

window.savePostit = async () => {
    const content = document.getElementById('postitContent')?.value.trim();
    if (!content) return alert("Escribe el contenido del Posit.");

    const id = document.getElementById('editPostitId')?.value || 'postit_' + Date.now();
    const color = document.getElementById('selectedPostitColor')?.value || 'yellow';
    const todayStr = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

    const existing = (appState.postits || []).find(p => p.id === id);
    const postit = {
        id,
        text: content,
        color,
        date: existing ? existing.date : todayStr,
        pinned: existing ? !!existing.pinned : false
    };

    if (!appState.postits) appState.postits = [];
    const idx = appState.postits.findIndex(p => p.id === id);
    if (idx > -1) appState.postits[idx] = postit;
    else appState.postits.unshift(postit);

    try {
        await setDoc(doc(db, "postits", id), postit);
    } catch(e) { console.error("Error guardando postit en Firebase:", e); }

    window.toggleNewPostitForm(false);
    window.renderPostits();
};

window.deletePostit = async (id) => {
    if (confirm("¿Eliminar esta nota / posit?")) {
        appState.postits = (appState.postits || []).filter(p => p.id !== id);
        try { await deleteDoc(doc(db, "postits", id)); } catch(e){}
        window.renderPostits();
    }
};

window.togglePinPostit = async (id) => {
    const postit = (appState.postits || []).find(p => p.id === id);
    if (!postit) return;
    postit.pinned = !postit.pinned;
    try { await setDoc(doc(db, "postits", id), postit); } catch(e){}
    window.renderPostits();
};

window.editPostit = (id) => {
    const postit = (appState.postits || []).find(p => p.id === id);
    if (!postit) return;
    window.toggleNewPostitForm(true);
    document.getElementById('editPostitId').value = postit.id;
    document.getElementById('postitContent').value = postit.text;
    window.selectPostitColor(postit.color || 'yellow');
};

window.renderPostits = () => {
    const container = document.getElementById('postitsContainer');
    if (!container) return;

    if (!appState.postits || appState.postits.length === 0) {
        container.innerHTML = `
            <div class="py-6 text-center text-gray-500 bg-black/40 rounded-xl border border-gray-800/80 p-3 space-y-1">
                <i class="fa-regular fa-note-sticky text-2xl text-cuycito-gold/60"></i>
                <p class="text-[11px] text-gray-400 font-bold">Sin notas o posits activos</p>
                <p class="text-[9px] text-gray-600">Presiona "+ Nuevo Posit" para guardar pendientes, proveedores o recordatorios.</p>
            </div>
        `;
        return;
    }

    const sorted = [...appState.postits].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    let html = '';
    sorted.forEach(p => {
        let borderClass = 'border-yellow-400 bg-yellow-950/30 text-yellow-100';
        let pinColor = 'text-yellow-400';
        if (p.color === 'emerald') {
            borderClass = 'border-emerald-400 bg-emerald-950/30 text-emerald-100';
            pinColor = 'text-emerald-400';
        } else if (p.color === 'cyan') {
            borderClass = 'border-cyan-400 bg-cyan-950/30 text-cyan-100';
            pinColor = 'text-cyan-400';
        } else if (p.color === 'rose') {
            borderClass = 'border-rose-400 bg-rose-950/30 text-rose-100';
            pinColor = 'text-rose-400';
        } else if (p.color === 'purple') {
            borderClass = 'border-purple-400 bg-purple-950/30 text-purple-100';
            pinColor = 'text-purple-400';
        }

        html += `
        <div class="border-l-4 ${borderClass} rounded-r-xl p-2.5 shadow-md relative group transition hover:brightness-110">
            <div class="flex items-start justify-between gap-1.5 mb-1">
                <button type="button" onclick="window.togglePinPostit('${p.id}')" class="text-xs ${p.pinned ? pinColor : 'text-gray-600 hover:text-white'} transition" title="${p.pinned ? 'Desfijar' : 'Fijar arriba'}">
                    <i class="fa-solid fa-thumbtack ${p.pinned ? 'transform -rotate-45' : ''}"></i>
                </button>
                <span class="text-[9px] text-gray-400 font-mono opacity-80">${p.date || ''}</span>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button type="button" onclick="window.editPostit('${p.id}')" class="text-gray-400 hover:text-white text-[10px] p-0.5"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" onclick="window.deletePostit('${p.id}')" class="text-gray-400 hover:text-red-400 text-[10px] p-0.5"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <p class="text-xs leading-relaxed whitespace-pre-wrap font-medium">${p.text}</p>
        </div>`;
    });

    container.innerHTML = html;
};

// =====================================
// 12. IMPORT / EXPORT JSON
// =====================================
window.importJSONManual = () => {
    try {
        const textArea = document.getElementById('jsonTextArea'); if(!textArea) return;
        const data = JSON.parse(textArea.value);
        if(data.subscriptions) {
            data.subscriptions.forEach(newSub => {
                const idx = appState.subscriptions.findIndex(s => s.id === newSub.id);
                if (idx !== -1) appState.subscriptions[idx] = newSub; else appState.subscriptions.push(newSub);
            });
            if(data.history) {
                data.history.forEach(newHist => {
                    const idx = appState.history.findIndex(h => h.id === newHist.id);
                    if (idx === -1) appState.history.push(newHist);
                });
            }
            if(data.masterAccounts) appState.masterAccounts = data.masterAccounts;
            if(data.users) appState.clients = data.users;
            if(data.store_catalog) appState.catalog = data.store_catalog;
            if(data.postits) appState.postits = data.postits;
        }
        window.renderAll();
        alert("✅ Datos importados.");
    } catch (e) { alert("❌ JSON inválido."); }
};

window.exportJSONDownload = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
    const a = document.createElement('a'); a.setAttribute("href", dataStr); a.setAttribute("download", `cuycito_backup_${Date.now()}.json`);
    document.body.appendChild(a); a.click(); a.remove();
};

// =====================================
// 13. RENDERIZADO GLOBAL DE VISTAS
// =====================================
window.renderFinance = () => {
    const filterInput = document.getElementById('financeMonthFilter');
    const selectedMonth = filterInput ? filterInput.value : '';

    let income = 0; let expense = 0;
    let servicesIncomeMap = {};
    let annualData = { income: new Array(12).fill(0), expense: new Array(12).fill(0) };

    appState.history.forEach(tx => {
        const txAmount = convertToGlobal(tx.amount, tx.currency);
        const txMonth = tx.date ? tx.date.substring(0, 7) : '';
        const txMonthIndex = tx.date ? parseInt(tx.date.substring(5, 7)) - 1 : 0;

        if (tx.type === 'VENTA') {
            annualData.income[txMonthIndex] += txAmount;
            if (txMonth === selectedMonth) {
                income += txAmount;
                servicesIncomeMap[tx.service] = (servicesIncomeMap[tx.service] || 0) + txAmount;
            }
        } else if (tx.type === 'COMPRA') {
            annualData.expense[txMonthIndex] += txAmount;
            if (txMonth === selectedMonth) {
                expense += txAmount;
            }
        }
    });

    const profit = income - expense;
    const margin = income > 0 ? ((profit / income) * 100).toFixed(1) : 0;
    const sym = appState.globalCurrency === 'PEN' ? 'S/' : '$';

    const incEl = document.getElementById('finMonthIncome');
    const expEl = document.getElementById('finMonthExpense');
    const profEl = document.getElementById('finMonthProfit');
    const marginEl = document.getElementById('finMonthMargin');

    if(incEl) incEl.innerText = `${sym} ${income.toFixed(2)}`;
    if(expEl) expEl.innerText = `${sym} ${expense.toFixed(2)}`;
    if(profEl) {
        profEl.innerText = `${sym} ${profit.toFixed(2)}`;
        profEl.className = profit >= 0 ? "text-2xl font-black text-white mt-1" : "text-2xl font-black text-cuycito-red_light mt-1";
    }
    if(marginEl) {
        marginEl.innerText = `${margin}%`;
        marginEl.className = margin >= 0 ? "text-2xl font-black text-white mt-1" : "text-2xl font-black text-cuycito-red_light mt-1";
    }

    const ctxPie = document.getElementById('chartPlatforms');
    if (ctxPie) {
        if (chartPlatformInstance) chartPlatformInstance.destroy();
        const labels = Object.keys(servicesIncomeMap); const data = Object.values(servicesIncomeMap);
        if(labels.length === 0) { labels.push("Sin Ventas"); data.push(1); }

        chartPlatformInstance = new Chart(ctxPie, {
            type: 'doughnut',
            data: { labels: labels, datasets: [{ data: data, backgroundColor: ['#ffb703', '#850000', '#3b82f6', '#10b981', '#a855f7', '#f43f5e', '#64748b'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#9ca3af', font: { size: 10 } } } } }
        });
    }

    const ctxBar = document.getElementById('chartAnnual');
    if (ctxBar) {
        if (chartAnnualInstance) chartAnnualInstance.destroy();
        chartAnnualInstance = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
                datasets: [{ label: 'Ingresos', data: annualData.income, backgroundColor: '#10b981', borderRadius: 4 }, { label: 'Egresos', data: annualData.expense, backgroundColor: '#b91c1c', borderRadius: 4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' } }, x: { grid: { display: false }, ticks: { color: '#9ca3af' } } }, plugins: { legend: { labels: { color: '#9ca3af' } } } }
        });
    }
};

// ==========================================================================
// CONTROL DE ACCESO A TIENDA & MODO MANTENIMIENTO DE EMERGENCIA
// ==========================================================================
window.isStoreMaintenanceActive = false;

window.initStoreMaintenanceListener = () => {
    try {
        onSnapshot(doc(db, "system_config", "store_settings"), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                window.isStoreMaintenanceActive = data.maintenanceMode === true;
                window.updateStoreMaintenanceUI(window.isStoreMaintenanceActive);
            } else {
                window.isStoreMaintenanceActive = false;
                window.updateStoreMaintenanceUI(false);
            }
        });
    } catch(err) {
        console.warn("Error en listener de mantenimiento de tienda:", err);
    }
};

window.updateStoreMaintenanceUI = (isMaintenance) => {
    // 1. Interruptor Maestro Único en Header
    const switchElGlobal = document.getElementById('globalStoreMaintenanceToggle');
    if (switchElGlobal) switchElGlobal.checked = isMaintenance;

    const labelEl = document.getElementById('topHeaderStoreSwitchLabel');
    if (labelEl) {
        labelEl.innerText = isMaintenance ? "MANTENIMIENTO" : "TIENDA OPERATIVA";
        labelEl.className = isMaintenance ? "block text-[11px] font-black uppercase text-red-400 animate-pulse" : "block text-[11px] font-black uppercase text-emerald-400";
    }

    const subLabelEl = document.getElementById('topHeaderStoreSwitchSublabel');
    if (subLabelEl) {
        subLabelEl.innerText = isMaintenance ? "Acceso clientes bloqueado" : "Clientes con acceso";
    }

    const containerEl = document.getElementById('topHeaderStoreSwitchContainer');
    if (containerEl) {
        if (isMaintenance) {
            containerEl.classList.remove('border-gray-800');
            containerEl.classList.add('border-red-500/80', 'glow-red');
        } else {
            containerEl.classList.remove('border-red-500/80', 'glow-red');
            containerEl.classList.add('border-gray-800');
        }
    }
};

// Iniciar listener de mantenimiento inmediatamente
window.initStoreMaintenanceListener();

window.handleStoreMaintenanceToggle = async (isChecked) => {
    try {
        await setDoc(doc(db, "system_config", "store_settings"), {
            maintenanceMode: isChecked,
            is_store_open: !isChecked,
            status: isChecked ? 'disabled' : 'active',
            updatedAt: new Date().toISOString(),
            updatedBy: 'Dashboard Admin'
        }, { merge: true });

        window.updateStoreMaintenanceUI(isChecked);
        
        if (isChecked) {
            alert("🛑 MODO MANTENIMIENTO ACTIVADO\n\nEl acceso por login y a la tienda ha sido inhabilitado para los clientes. Al ingresar serán redirigidos a la página de mantenimiento.");
        } else {
            alert("✅ TIENDA OPERATIVA\n\nEl acceso por login y la tienda se encuentran nuevamente habilitados para todos los clientes.");
        }
    } catch(err) {
        console.error("Error al actualizar modo mantenimiento de tienda:", err);
        alert("Error al actualizar configuración en la nube: " + err.message);
    }
};

window.toggleStoreMaintenancePrompt = () => {
    const newState = !window.isStoreMaintenanceActive;
    const msg = newState 
        ? "¿Deseas DESACTIVAR el acceso a la tienda y ponerla en MODO MANTENIMIENTO para todos los clientes?" 
        : "¿Deseas ACTIVAR nuevamente el acceso a la tienda para todos los clientes?";
    if (confirm(msg)) {
        window.handleStoreMaintenanceToggle(newState);
    }
};

window.renderActiveTable = () => {
    const tbody = document.getElementById('activeTableBody'); 
    const pendingContainer = document.getElementById('pendingTvQrContainer');
    const pendingBadge = document.getElementById('pendingTvQrBadge');

    // 1. RENDERIZAR SOLICITUDES DE ACTIVACIÓN DE TV (FOTOS QR)
    const pendingSubs = (appState.subscriptions || []).filter(sub => 
        sub.status === 'pending_activation' || sub.status === 'pending' || !!sub.tvQrImage
    );

    if (pendingBadge) pendingBadge.innerText = pendingSubs.length;

    if (pendingContainer) {
        if (pendingSubs.length === 0) {
            pendingContainer.innerHTML = `
                <div class="col-span-full py-8 text-center text-gray-500 space-y-1">
                    <i class="fa-solid fa-tv text-2xl text-gray-600"></i>
                    <p class="text-xs font-bold text-gray-400">No hay activaciones de TV pendientes en este momento.</p>
                </div>
            `;
        } else {
            pendingContainer.innerHTML = pendingSubs.map(sub => {
                const hasQr = !!sub.tvQrImage;
                const qrImageHTML = hasQr 
                    ? `
                        <div class="relative w-full h-40 bg-black rounded-xl overflow-hidden border border-yellow-500/50 shadow-inner group cursor-pointer" onclick="window.openFullscreenQrModal('${sub.id}')">
                            <img src="${sub.tvQrImage}" alt="QR de TV" class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300">
                            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 text-cuycito-gold text-xs font-black">
                                <i class="fa-solid fa-expand text-sm"></i>
                                <span>Ver QR Grande</span>
                            </div>
                            <span class="absolute top-2 left-2 bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 text-[9px] font-black px-2 py-0.5 rounded-md shadow">
                                📸 QR Recibido
                            </span>
                        </div>
                    `
                    : `
                        <div class="w-full h-40 bg-black/60 rounded-xl border border-dashed border-gray-700 flex flex-col items-center justify-center p-4 text-center space-y-1">
                            <i class="fa-solid fa-hourglass-half text-2xl text-yellow-500 animate-spin"></i>
                            <span class="text-xs font-bold text-yellow-400">Esperando Foto QR del Cliente</span>
                            <p class="text-[10px] text-gray-500">El cliente aún no ha subido la captura del código QR de su televisor.</p>
                        </div>
                    `;

                const price = parseFloat(sub.price || sub.amount || 0).toFixed(2);

                return `
                <div class="bg-[#111] border-2 border-yellow-500/60 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-xl hover:border-yellow-400 transition">
                    <div class="space-y-2">
                        <div class="flex items-start justify-between gap-2">
                            <div>
                                <span class="text-[9px] text-cuycito-gold font-bold uppercase tracking-widest block">Activación en TV</span>
                                <h4 class="text-sm font-black text-white">${sub.service || 'Servicio Streaming'}</h4>
                            </div>
                            <span class="bg-yellow-950 text-yellow-300 border border-yellow-500/40 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                                S/ ${price}
                            </span>
                        </div>

                        ${qrImageHTML}

                        <div class="bg-black/60 border border-gray-800 rounded-xl p-2.5 text-xs space-y-1">
                            <div class="flex justify-between">
                                <span class="text-gray-500 text-[10px] uppercase font-bold">Cliente:</span>
                                <strong class="text-white">${sub.person || 'Cliente VIP'}</strong>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-500 text-[10px] uppercase font-bold">Fecha Compra:</span>
                                <span class="text-gray-400 font-mono text-[11px]">${sub.startDate || (sub.createdAt ? sub.createdAt.split('T')[0] : 'Hoy')}</span>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 pt-2 border-t border-gray-800">
                        ${hasQr ? `
                            <button onclick="window.openFullscreenQrModal('${sub.id}')" class="bg-gray-800 hover:bg-gray-700 text-yellow-300 font-bold text-xs p-2.5 rounded-xl transition flex items-center justify-center gap-1 shrink-0" title="Ver QR Grande">
                                <i class="fa-solid fa-expand"></i>
                            </button>
                        ` : ''}
                        
                        <button onclick="window.activatePendingTvQr('${sub.id}')" class="flex-1 bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-400 hover:from-emerald-500 hover:to-green-300 text-black font-black text-xs py-2.5 px-3 rounded-xl transition shadow-lg flex items-center justify-center gap-1.5 uppercase tracking-wider">
                            <i class="fa-solid fa-circle-check text-sm"></i>
                            <span>Activar Servicio</span>
                        </button>

                        <button onclick="window.notifyClientOrderWhatsApp('${sub.id}')" class="bg-[#25D366] hover:bg-emerald-500 text-black font-bold text-xs p-2.5 rounded-xl transition flex items-center justify-center gap-1 shrink-0" title="Avisar al cliente por WhatsApp">
                            <i class="fa-brands fa-whatsapp text-sm"></i>
                        </button>

                        <button onclick="window.deletePendingActivation('${sub.id}')" class="bg-red-950/80 hover:bg-red-900 text-red-300 hover:text-white border border-red-500/40 font-bold text-xs p-2.5 rounded-xl transition flex items-center justify-center gap-1 shrink-0" title="Eliminar / Rechazar Solicitud">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>`;
            }).join('');
        }
    }

    // 2. RENDERIZAR TABLA GENERAL DE SERVICIOS
    if(!tbody) return;
    tbody.innerHTML = '';
    const search = (document.getElementById('searchActive')?.value || '').toLowerCase().trim();
    const serviceFilter = document.getElementById('filterActiveService')?.value || '';
    const statusFilter = document.getElementById('filterActiveStatus')?.value || 'VIGENTE';

    let list = (appState.subscriptions || []).filter(sub => {
        const pNorm = (sub.person || '').toLowerCase().trim();
        const sNorm = (sub.service || '').toLowerCase().trim();

        // Si es un registro muerto ("Sin Asignar" o servicio corrupto/prueba), no mostrarlo y purgarlo de Firestore
        if (pNorm.includes('sin asignar') || pNorm.startsWith('sin ') || pNorm === '' || sNorm.includes('disney premium 7') || sNorm.includes('777')) {
            if (sub.id) {
                deleteDoc(doc(db, "subscriptions", sub.id)).catch(()=>{});
            }
            return false;
        }

        let matchSearch = !search ||
                          (sub.person && sub.person.toLowerCase().includes(search)) || 
                          (sub.service && sub.service.toLowerCase().includes(search)) || 
                          (sub.phone && sub.phone.toLowerCase().includes(search)) ||
                          (sub.clientPhone && sub.clientPhone.toLowerCase().includes(search)) ||
                          (sub.clientCode && sub.clientCode.toLowerCase().includes(search)) ||
                          (sub.clientNickname && sub.clientNickname.toLowerCase().includes(search)) ||
                          (sub.email && sub.email.toLowerCase().includes(search));

        let matchService = serviceFilter === '' || sub.service === serviceFilter;
        let isExpired = window.getDaysRemaining(sub.endDate) < 0;
        let isPending = sub.status === 'pending_activation' || sub.status === 'pending' || sub.status === 'esperando_proveedor' || !!sub.tvQrImage;

        let matchStatus = true;
        if(statusFilter === 'VIGENTE') matchStatus = !isExpired && !isPending;
        else if(statusFilter === 'VENCIDO') matchStatus = isExpired && !isPending;
        else if(statusFilter === 'PENDING') matchStatus = isPending;
        else if(statusFilter === 'ALL' || statusFilter === 'TODOS') matchStatus = true;

        return matchSearch && matchService && matchStatus;
    });

    const activeCountBadge = document.getElementById('activeCountBadge');
    if (activeCountBadge) activeCountBadge.innerText = list.length;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-gray-500 italic">No se encontraron servicios activos con esos filtros.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((sub, idx) => {
        const subId = sub.id || `sub_${idx}`;
        let days = window.getDaysRemaining(sub.endDate);
        let isExp = days < 0;
        let isPending = sub.status === 'pending_activation' || sub.status === 'pending' || sub.status === 'esperando_proveedor' || !!sub.tvQrImage;
        
        let statusBadge = isPending 
            ? `<span class="bg-yellow-950 text-yellow-300 border border-yellow-500/40 text-[10px] font-black px-2 py-0.5 rounded animate-pulse">⏳ ${sub.status === 'esperando_proveedor' ? 'Espera Proveedor' : 'Pendiente'}</span>`
            : isExp 
                ? `<span class="bg-red-950 text-red-400 border border-red-500/40 text-[10px] font-black px-2 py-0.5 rounded">🔴 Vencido</span>` 
                : `<span class="bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-[10px] font-black px-2 py-0.5 rounded">🟢 Activo</span>`;

        const clientCodeBadge = '';

        const daysRemainingLabel = isExp 
            ? `<span class="text-red-400 font-bold block text-[10px]">Expiró</span>` 
            : `<span class="text-gray-400 text-[10px] block">(${days} días restantes)</span>`;

        return `
        <tr class="hover:bg-gray-900/50 transition">
            <td class="p-4">
                <div class="font-bold text-white text-xs">${sub.person || 'Sin nombre'}</div>
                ${clientCodeBadge}
            </td>
            <td class="p-4 font-black text-cuycito-gold">${sub.service || 'Servicio'}</td>
            <td class="p-4 font-mono text-[11px] text-gray-400">
                <div>${sub.email || 'Sin correo'}</div>
                ${sub.pin ? `<div class="text-cuycito-gold text-[10px]">PIN: ${sub.pin}</div>` : ''}
            </td>
            <td class="p-4 font-mono text-[11px] text-gray-300">
                <div>${window.formatDateDDMMYYYY(sub.endDate)}</div>
                ${daysRemainingLabel}
            </td>
            <td class="p-4 text-center">${statusBadge}</td>
            <td class="p-4 text-center">
                <div class="flex items-center justify-center gap-1 bg-black p-1 rounded-lg border border-gray-800">
                    <input type="number" id="renew_${subId}" value="1" min="1" class="w-10 bg-transparent text-center text-cuycito-gold font-bold outline-none">
                    <button onclick="window.renewSubscription('${subId}', 'renew_${subId}')" class="bg-cuycito-gold hover:bg-cuycito-gold_light text-black px-2 py-1 rounded font-black transition">
                        <i class="fa-solid fa-rotate-right"></i>
                    </button>
                </div>
            </td>
            <td class="p-4 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button onclick="window.notifyClientOrderWhatsApp('${subId}')" class="bg-[#25D366] hover:bg-emerald-500 text-black p-2 rounded-lg transition" title="Avisar al cliente por WhatsApp"><i class="fa-brands fa-whatsapp text-xs font-bold"></i></button>
                    <button onclick="window.openEditModal('${subId}')" class="bg-blue-950 hover:bg-blue-900 text-blue-300 p-2 rounded-lg transition" title="Editar"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button onclick="event.stopPropagation(); window.deleteSubscription('${subId}')" class="bg-red-950 hover:bg-red-900 text-red-400 p-2 rounded-lg transition shadow" title="Eliminar"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
};

window.notifyClientOrderWhatsApp = (subId) => {
    const sub = (appState.subscriptions || []).find(s => s.id === subId);
    if (!sub) return alert("Servicio no encontrado.");

    let clientPhone = sub.phone || '';
    if (!clientPhone) {
        const client = (appState.clients || []).find(c => 
            (c.name && c.name.trim().toLowerCase() === (sub.person || '').trim().toLowerCase()) ||
            (c.nickname && c.nickname.trim().toLowerCase() === (sub.person || '').trim().toLowerCase())
        );
        if (client) clientPhone = client.phone || '';
    }

    const cleanPhone = clientPhone.replace(/\D/g, '');
    const serviceName = sub.service || 'Servicio Streaming VIP';
    const email = sub.email || sub.accountEmail || '';
    const pass = sub.pass || sub.accountPassword || '';
    const pin = sub.pin || '';
    const endDate = window.formatDateDDMMYYYY(sub.endDate) || '30 días';

    let msg = `¡Hola *${sub.person || 'Cliente VIP'}*! 🐹🍿\n\n`;
    msg += `Tu pedido de *${serviceName}* en *CuycitoGO* ya está listo y activado:\n\n`;
    if (email) msg += `📧 *Correo / Usuario:* ${email}\n`;
    if (pass) msg += `🔑 *Contraseña:* ${pass}\n`;
    if (pin) msg += `👤 *Perfil / PIN:* ${pin}\n`;
    msg += `📅 *Vencimiento:* ${endDate}\n\n`;
    msg += `💡 _Disfruta de tu contenido en 4K Ultra HD sin cortes. Cualquier consulta estamos a tu completa disposición._ 🚀`;

    const encodedMsg = encodeURIComponent(msg);
    const waUrl = cleanPhone 
        ? `https://wa.me/${cleanPhone.startsWith('51') ? cleanPhone : '51' + cleanPhone}?text=${encodedMsg}`
        : `https://wa.me/?text=${encodedMsg}`;

    window.open(waUrl, '_blank');
};

window.deletePendingActivation = async (subId) => {
    const sub = (appState.subscriptions || []).find(s => s.id === subId);
    if (!sub) return;

    if (!confirm(`⚠️ ¿Seguro que deseas eliminar/descartar la solicitud de activación de ${sub.service} del cliente "${sub.person}"?`)) return;

    appState.subscriptions = appState.subscriptions.filter(s => s.id !== subId);

    try {
        await deleteDoc(doc(db, "subscriptions", subId));
    } catch(e) {}

    saveLocal();
    window.renderActiveTable();
    alert(`🗑️ Solicitud de activación de ${sub.service} eliminada.`);
};

window.openFullscreenQrModal = (subId) => {
    const sub = (appState.subscriptions || []).find(s => s.id === subId);
    if (!sub || !sub.tvQrImage) return alert('No hay imagen QR disponible para este servicio.');

    const modal = document.getElementById('tvQrFullscreenModal');
    const img = document.getElementById('fullscreenQrImage');
    const sName = document.getElementById('fullscreenQrServiceName');
    const cName = document.getElementById('fullscreenQrClientName');
    const btnAct = document.getElementById('fullscreenBtnActivate');

    if (sName) sName.innerText = `Código QR de ${sub.service}`;
    if (cName) cName.innerText = `Cliente: ${sub.person}`;
    if (img) img.src = sub.tvQrImage;
    if (btnAct) btnAct.setAttribute('onclick', `window.activatePendingTvQr('${sub.id}'); document.getElementById('tvQrFullscreenModal').classList.add('hidden');`);

    if (modal) modal.classList.remove('hidden');
};

window.activatePendingTvQr = async (subId) => {
    const sub = (appState.subscriptions || []).find(s => s.id === subId);
    if (!sub) return;

    sub.status = 'active';
    delete sub.tvQrImage;

    try {
        await setDoc(doc(db, "subscriptions", subId), sub, { merge: true });
    } catch(e) {}

    saveLocal();
    window.renderActiveTable();
    alert(`🎉 ¡Servicio Activado!\n\nEl servicio ${sub.service} para ${sub.person} ha quedado marcado como ACTIVO exitosamente.`);
};

window.renderMasterAccounts = () => {
    const grid = document.getElementById('masterGrid'); if(!grid) return;
    grid.innerHTML = '';
    
    appState.masterAccounts.forEach((acc, accIdx) => {
        if (!acc.id) {
            acc.id = `master_${acc.email ? acc.email.replace(/[^a-zA-Z0-9]/g, '_') : accIdx}`;
        }
        const masterCode = acc.masterCode || window.getMasterCode(acc);
        acc.masterCode = masterCode;

        let occupied = (acc.profiles || []).filter(p => p !== null).length;
        let freeSlots = Math.max(0, acc.capacity - occupied);
        let occColor = occupied === acc.capacity ? 'text-cuycito-red border-cuycito-red' : 'text-emerald-400 border-emerald-400/50';

        let totalIncome = 0;
        (acc.profiles || []).forEach(pId => {
            if(pId) {
                const sub = appState.subscriptions.find(s => s.id === pId);
                if(sub) { totalIncome += convertToGlobal(sub.amount, sub.currency); }
            }
        });
        
        let costInGlobal = convertToGlobal(acc.cost || 0, acc.currency || 'PEN');
        let profit = totalIncome - costInGlobal;
        let profitColor = profit >= 0 ? 'text-emerald-400' : 'text-cuycito-red_light';
        let sym = appState.globalCurrency === 'PEN' ? 'S/' : '$';

        const isCredsVisible = !!acc.showCredentialsToClient && !acc.hidePasswordFromClient;
        const passVisibilityBtn = isCredsVisible 
            ? `<button onclick="window.toggleMasterCredentialsVisibility('${acc.id}')" class="bg-emerald-950/80 text-emerald-400 hover:bg-emerald-900 border border-emerald-500/40 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition" title="Credenciales (Correo y Clave) VISIBLES al cliente en su portal"><i class="fa-solid fa-eye"></i> Credenciales Visibles</button>`
            : `<button onclick="window.toggleMasterCredentialsVisibility('${acc.id}')" class="bg-red-950/80 text-red-400 hover:bg-red-900 border border-cuycito-red/50 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition" title="Credenciales OCULTAS (Solo ve que está activo)"><i class="fa-solid fa-eye-slash"></i> Credenciales Ocultas (Solo Activo)</button>`;

        let html = `
        <div class="bg-[#111] border border-gray-800 rounded-xl overflow-hidden shadow-lg flex flex-col">
            <div class="p-3 bg-black border-b border-gray-800 flex justify-between items-center">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="bg-amber-950 text-cuycito-gold border border-amber-500/40 text-[9px] font-black px-1.5 py-0.5 rounded font-mono">${masterCode}</span>
                        <h4 class="font-black text-white text-sm uppercase">${acc.service}</h4>
                    </div>
                    <p class="text-[10px] text-cuycito-gold font-mono">${acc.email}</p>
                </div>
                <div class="flex flex-col items-end gap-1">
                    <div class="text-center border px-2 py-0.5 rounded ${occColor} bg-black text-[10px] font-black tracking-widest">${occupied}/${acc.capacity} Lleno (${freeSlots} libres)</div>
                    <span class="text-[9px] text-gray-500">Vence: ${window.formatDateDDMMYYYY(acc.endDate)}</span>
                </div>
            </div>
            
            <div class="grid grid-cols-3 text-center text-[10px] bg-black/50 border-b border-gray-800 divide-x divide-gray-800">
                <div class="p-1.5"><span class="text-gray-500 block text-[8px] uppercase">Costo</span><span class="text-red-400 font-bold">${sym} ${costInGlobal.toFixed(2)}</span></div>
                <div class="p-1.5"><span class="text-gray-500 block text-[8px] uppercase">Ingresos</span><span class="text-emerald-400 font-bold">${sym} ${totalIncome.toFixed(2)}</span></div>
                <div class="p-1.5"><span class="text-gray-500 block text-[8px] uppercase">Ganancia</span><span class="${profitColor} font-bold">${sym} ${profit.toFixed(2)}</span></div>
            </div>

            <div class="p-2 text-[10px] text-gray-500 font-mono bg-black/80 border-b border-gray-800 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span>Pass: ${acc.pass}</span>
                    ${passVisibilityBtn}
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="window.openEditMasterModal('${acc.id}')" class="text-blue-400 hover:text-blue-300" title="Editar Cuenta"><i class="fa-solid fa-pen-to-square text-sm"></i></button>
                    <button onclick="window.deleteMasterAccount('${acc.id}')" class="text-cuycito-red hover:text-red-400" title="Eliminar Cuenta"><i class="fa-solid fa-trash text-sm"></i></button>
                </div>
            </div>
            
            <div class="p-3 space-y-2 flex-1 bg-[#0a0a0a]">`;

        for(let i=0; i<acc.capacity; i++) {
            const subId = (acc.profiles || [])[i];
            if(subId) {
                const sub = appState.subscriptions.find(s => s.id === subId);
                if(sub) {
                    const dColor = window.getDaysRemaining(sub.endDate) < 0 ? 'text-red-400' : 'text-gray-400';
                    let subSym = sub.currency === 'PEN' ? 'S/' : '$';
                    html += `
                    <div class="flex justify-between items-center bg-gray-900 border border-gray-700 rounded p-2">
                        <div>
                            <p class="text-xs font-bold text-white">${sub.person} <span class="text-[10px] text-cuycito-gold">(${sub.pin || '-'})</span></p>
                            <p class="text-[10px] ${dColor} font-mono">Vence: ${window.formatDateDDMMYYYY(sub.endDate)} | Cobra: ${subSym}${sub.amount}</p>
                        </div>
                        <button onclick="window.unlinkProfile('${acc.id}', ${i})" class="text-gray-500 hover:text-cuycito-red transition text-xs p-1" title="Desvincular"><i class="fa-solid fa-xmark"></i></button>
                    </div>`;
                } else { acc.profiles[i] = null; }
            } 
            if(!subId) {
                html += `<div onclick="window.openAssignModal('${acc.id}', ${i})" class="flex justify-center items-center border border-dashed border-gray-700 bg-black/50 rounded p-2 cursor-pointer hover:border-cuycito-gold hover:bg-cuycito-gold/10 transition group h-10"><span class="text-[11px] text-gray-500 font-bold group-hover:text-cuycito-gold"><i class="fa-solid fa-plus"></i> Asignar Cliente</span></div>`;
            }
        }
        html += `</div></div>`;
        grid.innerHTML += html;
    });
};

// =====================================
// LIMPIEZA AUTOMÁTICA DE INTEGRIDAD DE BASE DE DATOS (PURGA DE MUERTOS, HUÉRFANOS Y DUPLICADOS)
// =====================================
window.cleanupDatabaseOrphans = async (isManual = false) => {
    console.log("🧹 Ejecutando purga exhaustiva de datos muertos, huérfanos y corruptos...");
    const masterMap = new Map((appState.masterAccounts || []).map(m => [m.id, m]));
    const clientMap = new Map((appState.clients || []).map(c => [c.id, c]));

    let cleanedDeadOrphans = 0;
    let cleanedDuplicates = 0;
    let slotsReset = 0;

    const seenSignatures = new Set();
    const cleanSubscriptions = [];

    for (const sub of (appState.subscriptions || [])) {
        if (!sub.id) continue;

        const personNorm = (sub.person || '').trim().toLowerCase();
        const serviceNorm = (sub.service || '').trim().toLowerCase();

        // 1. Condición: Registro muerto o "Sin Asignar" o servicio corrupto/prueba (ej: "777", "disney premium 7", vacíos)
        const isDeadName = personNorm.includes('sin asignar') || personNorm.includes('sin nombre') || personNorm.startsWith('sin ') || personNorm === '' || personNorm === 'null' || personNorm === 'undefined' || !sub.person;
        const isCorruptService = serviceNorm.includes('777') || serviceNorm.includes('disney premium 7') || serviceNorm === '' || serviceNorm === 'null';
        const isMissingClient = sub.clientId && !clientMap.has(sub.clientId) && isDeadName;

        if (isDeadName || isCorruptService || isMissingClient) {
            console.warn(`🗑️ Purgando registro muerto de suscripción: ID: ${sub.id}, Person: "${sub.person}", Service: "${sub.service}"`);
            try {
                await deleteDoc(doc(db, "subscriptions", sub.id));
                cleanedDeadOrphans++;
            } catch(e){}
            continue;
        }

        // 2. Condición: Huérfano de Cuenta Matriz eliminada
        if (sub.masterAccountId && !masterMap.has(sub.masterAccountId)) {
            console.warn(`🗑️ Purgando servicio con cuenta matriz eliminada: ${sub.service} (${sub.id}) -> Matriz: ${sub.masterAccountId}`);
            try {
                await deleteDoc(doc(db, "subscriptions", sub.id));
                cleanedDeadOrphans++;
            } catch(e){}
            continue;
        }

        // 3. Condición: Duplicados exactos (mismo cliente + mismo servicio + mismo correo + mismo pin)
        const clientIdentifier = sub.clientId || sub.clientCode || sub.person;
        const sig = `${clientIdentifier}_${sub.service}_${(sub.email || '').trim().toLowerCase()}_${(sub.pin || '').trim()}`;
        
        if (seenSignatures.has(sig)) {
            console.warn(`🗑️ Purgando servicio duplicado redundante: ${sig} (${sub.id})`);
            try {
                await deleteDoc(doc(db, "subscriptions", sub.id));
                cleanedDuplicates++;
            } catch(e){}
            continue;
        }

        // 4. Auto-sellar el clientId y clientCode único para vincular unívocamente con el cliente real
        if (sub.person) {
            const matchedClient = (appState.clients || []).find(c => 
                (c.id && sub.clientId && c.id === sub.clientId) ||
                (c.name && c.name.trim().toLowerCase() === personNorm) ||
                (c.nickname && c.nickname.trim().toLowerCase() === personNorm)
            );
            if (matchedClient) {
                const cCode = matchedClient.clientCode || window.getClientCode(matchedClient);
                if (sub.clientId !== matchedClient.id || sub.clientCode !== cCode) {
                    sub.clientId = matchedClient.id;
                    sub.clientCode = cCode;
                    sub.clientPhone = matchedClient.phone || sub.clientPhone || '';
                    try {
                        await setDoc(doc(db, "subscriptions", sub.id), {
                            clientId: sub.clientId,
                            clientCode: sub.clientCode,
                            clientPhone: sub.clientPhone
                        }, { merge: true });
                    } catch(e){}
                }
            }
        }

        seenSignatures.add(sig);
        cleanSubscriptions.push(sub);
    }

    appState.subscriptions = cleanSubscriptions;

    // 4. Limpieza de slots en Cuentas Matrices que apunten a suscripciones inexistentes o purgadas
    const subSet = new Set(cleanSubscriptions.map(s => s.id));
    for (const acc of (appState.masterAccounts || [])) {
        let changed = false;
        if (acc.profiles && Array.isArray(acc.profiles)) {
            for (let i = 0; i < acc.profiles.length; i++) {
                const sId = acc.profiles[i];
                if (sId && !subSet.has(sId)) {
                    acc.profiles[i] = null;
                    changed = true;
                    slotsReset++;
                }
            }
        }
        if (changed) {
            try {
                await setDoc(doc(db, "masterAccounts", acc.id), acc, { merge: true });
            } catch(e){}
        }
    }

    saveLocal();
    window.renderAll();

    const totalFixes = cleanedDeadOrphans + cleanedDuplicates + slotsReset;
    console.log(`✅ Purga finalizada: ${cleanedDeadOrphans} datos muertos/huérfanos eliminados, ${cleanedDuplicates} duplicados eliminados, ${slotsReset} slots de matriz liberados.`);

    if (isManual) {
        alert(`🧹 Purga de Base de Datos Exitosa:\n\n• ${cleanedDeadOrphans} registros muertos ("Sin Asignar", servicios de prueba "777", huérfanos) eliminados permanentemente de Firestore.\n• ${cleanedDuplicates} servicios duplicados eliminados.\n• ${slotsReset} cupos de cuentas matrices liberados y restablecidos.`);
    }
};

window.getClientCode = (client) => {
    if (!client) return 'CLI-000';
    if (client.clientCode) return client.clientCode;
    if (client.phone) {
        const cleanDigits = client.phone.toString().replace(/\D/g, '');
        if (cleanDigits.length >= 4) {
            return `CLI-${cleanDigits.slice(-4)}`;
        }
    }
    if (client.id) {
        const cleanId = client.id.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return `CLI-${cleanId.slice(-4)}`;
    }
    return 'CLI-1001';
};

window.updateClientsDatalist = () => {
    const datalist = document.getElementById('clientsDatalist');
    if (!datalist) return;
    let optionsHTML = '';
    appState.clients.forEach(c => {
        const code = window.getClientCode(c);
        optionsHTML += `<option value="${code}">[${code}] ${c.name} (@${c.nickname || c.name}) - ${c.phone}</option>`;
        optionsHTML += `<option value="${c.name}">[${code}] ${c.name} - ${c.phone}</option>`;
    });
    datalist.innerHTML = optionsHTML;
};

// =====================================
// 10. RENDERIZADO DE ACCESOS TIENDA (CLIENTES)
// =====================================
window.renderClients = () => {
    const tbody = document.getElementById('clientsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const search = (document.getElementById('searchClientsInput')?.value || '').toLowerCase().trim();
    
    const filteredClients = appState.clients.filter(c => {
        const cName = (c.name || '').toLowerCase();
        const cNick = (c.nickname || '').toLowerCase();
        const cPhone = (c.phone || '').toLowerCase();
        const cCode = (c.clientCode || window.getClientCode(c)).toLowerCase();
        
        const hasMatchingService = appState.subscriptions.some(s => 
            ((s.clientId && c.id && s.clientId === c.id) || (s.person && s.person.trim().toLowerCase() === cName)) && 
            (s.service || '').toLowerCase().includes(search)
        );

        return cName.includes(search) || cNick.includes(search) || cPhone.includes(search) || cCode.includes(search) || hasMatchingService;
    });

    const badge = document.getElementById('clientsCountBadge');
    if(badge) badge.innerText = `${filteredClients.length} Clientes`;

    window.updateClientsDatalist();

    if (filteredClients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-gray-500 italic">No se encontraron accesos de clientes.</td></tr>`;
        return;
    }
    
    filteredClients.forEach(c => {
        const clientCode = window.getClientCode(c);
        c.clientCode = clientCode;
        const clientNameNorm = (c.name || '').trim().toLowerCase();
        const clientPhoneNorm = (c.phone || '').toString().replace(/\D/g, '');

        // VINCULACIÓN UNÍVOCA Y ESTRICTA: Evita confundir clientes con nombres similares
        const linkedSubs = appState.subscriptions.filter(s => {
            if (s.clientId && c.id && s.clientId === c.id) return true;
            if (s.clientCode && clientCode && s.clientCode === clientCode) return true;
            const sPhone = (s.clientPhone || s.phone || '').toString().replace(/\D/g, '');
            if (sPhone && clientPhoneNorm && sPhone.length >= 7 && sPhone === clientPhoneNorm) return true;
            return false;
        });
        
        let servicesHTML = '';
        if (linkedSubs.length === 0) {
            servicesHTML = `<span class="text-[11px] text-gray-500 italic flex items-center gap-1"><i class="fa-solid fa-link-slash"></i> Sin servicios</span>`;
        } else {
            servicesHTML = `<div class="flex flex-wrap gap-1.5 max-w-xs">`;
            linkedSubs.forEach(s => {
                const days = window.getDaysRemaining(s.endDate);
                let badgeClass = '';
                let statusIcon = '';
                if (days < 0) {
                    badgeClass = 'bg-red-950/70 text-red-400 border border-cuycito-red/40';
                    statusIcon = '🔴';
                } else if (days <= 3) {
                    badgeClass = 'bg-amber-950/70 text-cuycito-gold border border-cuycito-gold/40 animate-pulse';
                    statusIcon = '🟡';
                } else {
                    badgeClass = 'bg-emerald-950/70 text-emerald-400 border border-emerald-500/30';
                    statusIcon = '🟢';
                }
                servicesHTML += `
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${badgeClass} flex items-center gap-1 shadow" title="Vence: ${s.endDate} (${days < 0 ? 'Expiró' : days + ' días'})">
                        <span>${statusIcon}</span>
                        <span>${s.service}</span>
                        <span class="font-mono text-[9px] opacity-80">(${days < 0 ? 'Exp' : days + 'd'})</span>
                    </span>
                `;
            });
            servicesHTML += `</div>`;
        }

        const currencySymbol = appState.globalCurrency === 'PEN' ? 'S/' : '$';

        let lastSeenMs = 0;
        if (c.lastSeen) {
            if (typeof c.lastSeen.toMillis === 'function') {
                lastSeenMs = c.lastSeen.toMillis();
            } else if (typeof c.lastSeen === 'number') {
                lastSeenMs = c.lastSeen;
            } else {
                const parsed = new Date(c.lastSeen).getTime();
                if (!isNaN(parsed)) lastSeenMs = parsed;
            }
        }
        const now = Date.now();
        const isOnline = (c.isOnline === true) && (lastSeenMs > 0) && ((now - lastSeenMs) < (1000 * 120));

        const statusIndicatorHTML = isOnline
            ? `<span class="relative flex h-3.5 w-3.5 shrink-0" title="🟢 Conectado en tiempo real en su cuenta (En línea)">
                 <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)]"></span>
               </span>`
            : `<span class="inline-flex rounded-full h-3 w-3 bg-gray-600 border border-gray-500/70 shrink-0 shadow-sm opacity-80" title="⚪ Desconectado / Sin sesión activa"></span>`;

        tbody.innerHTML += `
        <tr class="hover:bg-gray-800/60 transition">
            <td class="p-4">
                <div class="flex items-center gap-3">
                    ${statusIndicatorHTML}
                    <div>
                        <div class="font-black text-white text-xs flex items-center gap-1.5 flex-wrap">
                            <span>${c.name}</span>
                            ${isOnline ? `<span class="text-[9px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.2 rounded font-sans flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> En línea</span>` : `<span class="text-[9px] text-gray-500 font-mono">Desconectado</span>`}
                        </div>
                        <div class="text-[10px] text-gray-500 font-mono">${c.email || 'Sin correo'}</div>
                    </div>
                </div>
            </td>
            <td class="p-4">
                <span class="bg-cuycito-gold/20 text-cuycito-gold text-[11px] font-extrabold px-2.5 py-1 rounded-lg border border-cuycito-gold/40">
                    @${c.nickname || c.name}
                </span>
            </td>
            <td class="p-4 font-mono text-blue-400 font-bold text-xs"><i class="fa-solid fa-mobile-screen mr-1"></i> ${c.phone}</td>
            <td class="p-4 font-mono text-cuycito-gold text-xs">${c.pass}</td>
            <td class="p-4">
                <div class="flex items-center gap-1 bg-black/90 border border-emerald-500/40 hover:border-emerald-400 rounded-xl p-1.5 w-max shadow transition">
                    <span class="text-xs font-black text-emerald-400 font-mono pl-1">${currencySymbol}</span>
                    <input type="number" step="0.50" id="client_bal_${c.id}" value="${(c.balance || 0).toFixed(2)}" class="w-16 bg-transparent text-emerald-300 font-mono font-black text-xs outline-none focus:text-white text-right pr-1">
                    <button onclick="window.updateClientBalanceDirectly('${c.id}', 'client_bal_${c.id}')" class="bg-emerald-500 hover:bg-emerald-400 text-black px-2 py-1 rounded-lg text-xs font-black transition shadow flex items-center gap-1" title="Guardar nuevo saldo">
                        <i class="fa-solid fa-check"></i>
                    </button>
                </div>
            </td>
            <td class="p-4">${servicesHTML}</td>
            <td class="p-4 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button onclick="window.impersonateAndOpenProfile('${c.id}')" class="bg-gradient-to-r from-purple-900 to-indigo-800 hover:from-purple-700 hover:to-indigo-600 text-white font-black p-2 px-2.5 rounded-lg transition shadow text-xs flex items-center gap-1" title="Entrar y supervisar el perfil de este cliente como Administrador">
                        <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i> <span class="hidden xl:inline">Supervisar</span>
                    </button>
                    <button onclick="window.openClientServicesModal('${c.id}')" class="bg-cuycito-gold hover:bg-cuycito-goldHover text-black font-black p-2 px-2.5 rounded-lg transition shadow text-xs flex items-center gap-1" title="Gestionar y Enlazar Servicios">
                        <i class="fa-solid fa-link"></i> <span class="hidden lg:inline">Enlazar</span>
                    </button>
                    <button onclick="window.copyClientAccess('${c.id}')" class="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg transition shadow" title="Copiar mensaje con credenciales">
                        <i class="fa-regular fa-copy text-xs"></i>
                    </button>
                    <button onclick="window.sendClientAccessWhatsApp('${c.id}')" class="bg-[#25D366] hover:bg-emerald-500 text-black p-2 rounded-lg transition shadow" title="Enviar mensaje por WhatsApp">
                        <i class="fa-brands fa-whatsapp text-xs font-bold"></i>
                    </button>
                    <button onclick="window.openClientModal('${c.id}')" class="bg-gray-700 hover:bg-blue-600 text-white p-2 rounded-lg transition shadow" title="Editar datos">
                        <i class="fa-solid fa-pen text-xs"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    });
};

// =====================================
// 10.0. MODO SUPERVISIÓN DE PERFILES DE CLIENTES (ADMINISTRADOR)
// =====================================
window.openSuperviseClientModal = () => {
    const modal = document.getElementById('superviseClientModal');
    if (!modal) return;

    const searchInput = document.getElementById('searchSuperviseInput');
    if (searchInput) searchInput.value = '';

    window.filterSuperviseClients();
    modal.classList.remove('hidden');
};

window.filterSuperviseClients = () => {
    const container = document.getElementById('superviseClientsList');
    const countText = document.getElementById('superviseClientsCountText');
    if (!container) return;

    const search = (document.getElementById('searchSuperviseInput')?.value || '').toLowerCase().trim();

    const filtered = (appState.clients || []).filter(c => {
        const name = (c.name || '').toLowerCase();
        const nick = (c.nickname || '').toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const code = (c.clientCode || window.getClientCode(c)).toLowerCase();

        return !search || name.includes(search) || nick.includes(search) || phone.includes(search) || email.includes(search) || code.includes(search);
    });

    if (countText) {
        countText.innerText = `${filtered.length} cliente${filtered.length === 1 ? '' : 's'} disponible${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center text-gray-500 bg-black/40 rounded-xl border border-gray-800 space-y-2">
                <i class="fa-solid fa-users-slash text-2xl text-gray-600"></i>
                <p class="text-xs font-bold text-gray-400">No se encontraron clientes con esa búsqueda.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(c => {
        const clientCode = c.clientCode || window.getClientCode(c);
        const balance = parseFloat(c.balance || 0).toFixed(2);
        const now = Date.now();
        const lastSeenMs = c.lastSeen ? new Date(c.lastSeen).getTime() : 0;
        const isOnline = (c.isOnline === true) && ((now - lastSeenMs) < (1000 * 90));

        const onlineDot = isOnline 
            ? '<span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse inline-block shadow-[0_0_8px_rgba(52,211,153,0.8)]" title="En línea"></span>' 
            : '<span class="w-2.5 h-2.5 rounded-full bg-gray-600 inline-block" title="Desconectado"></span>';

        return `
        <div class="flex items-center justify-between p-3 bg-black/60 border border-gray-800 hover:border-indigo-500/70 rounded-xl transition group">
            <div class="flex items-center gap-3">
                ${onlineDot}
                <div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="bg-indigo-950 text-indigo-300 border border-indigo-500/40 text-[9px] font-black px-1.5 py-0.5 rounded font-mono">${clientCode}</span>
                        <h4 class="text-xs font-black text-white group-hover:text-indigo-300 transition">${c.name}</h4>
                        ${c.nickname ? `<span class="text-[10px] text-gray-400">(@${c.nickname})</span>` : ''}
                    </div>
                    <p class="text-[10px] text-gray-400 font-mono mt-0.5">
                        📱 ${c.phone || 'Sin cel'} | 💰 Saldo: <span class="text-emerald-400 font-bold">S/ ${balance}</span>
                        ${c.email ? ` | 📧 ${c.email}` : ''}
                    </p>
                </div>
            </div>
            <button type="button" onclick="window.impersonateAndOpenProfile('${c.id}')" class="bg-gradient-to-r from-purple-900 to-indigo-800 hover:from-purple-700 hover:to-indigo-600 text-white font-black text-xs px-3.5 py-1.5 rounded-lg transition shadow flex items-center gap-1.5">
                <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                <span>Supervisar</span>
            </button>
        </div>
        `;
    }).join('');
};

window.impersonateAndOpenProfile = (clientId) => {
    let client = (appState.clients || []).find(c => 
        c.id === clientId || 
        (c.id && c.id.toString() === (clientId || '').toString()) ||
        (c.phone && c.phone.toString() === (clientId || '').toString())
    );

    if (!client) {
        alert("No se pudo encontrar el cliente seleccionado.");
        return;
    }

    // Configurar sesión supervisada
    const clientSession = {
        id: client.id,
        name: client.name,
        nickname: client.nickname || client.name,
        phone: client.phone || '',
        email: client.email || '',
        pass: client.pass || '',
        balance: parseFloat(client.balance || 0),
        clientCode: client.clientCode || window.getClientCode(client),
        isSupervisedByAdmin: true,
        supervisedAt: new Date().toISOString()
    };

    localStorage.setItem("cuycitoClient", JSON.stringify(clientSession));
    
    // Cerrar modal si estuviera abierto
    document.getElementById('superviseClientModal')?.classList.add('hidden');

    // Abrir perfil en una nueva pestaña
    const targetUrl = `perfil.html?userId=${encodeURIComponent(client.id)}&adminSupervision=true`;
    window.open(targetUrl, '_blank');
};

window.updateClientBalanceDirectly = async (clientId, inputId) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    const newBal = parseFloat(input.value);
    if (isNaN(newBal) || newBal < 0) {
        return alert("Por favor ingresa un monto de saldo válido (mayor o igual a 0).");
    }

    const client = appState.clients.find(c => c.id === clientId);
    if (!client) return alert("Cliente no encontrado.");

    const oldBal = client.balance || 0;
    client.balance = newBal;

    try {
        await setDoc(doc(db, "users", clientId), { 
            balance: newBal,
            name: client.name,
            nickname: client.nickname || client.name,
            phone: client.phone || '',
            email: client.email || '',
            pass: client.pass || '',
            updatedAt: new Date().toISOString() 
        }, { merge: true });

        saveLocal();
        window.notifyAutoSave(`Saldo de ${client.name || client.nickname} actualizado a S/ ${newBal.toFixed(2)}`);
        window.renderClients();
        alert(`✅ Saldo de "${client.name || client.nickname}" actualizado con éxito:\n\nNuevo Saldo: S/ ${newBal.toFixed(2)}\n(Saldo anterior: S/ ${oldBal.toFixed(2)})`);
    } catch(err) {
        console.error("Error al actualizar saldo de cliente:", err);
        alert("❌ Error al guardar el saldo en la nube: " + err.message);
    }
};

// Listener en tiempo real para estado de conexión de clientes (Online / Offline)
let clientsPresenceSnapshotUnsubscribe = null;
window.initRealtimeClientsPresenceListener = () => {
    if (clientsPresenceSnapshotUnsubscribe) return;
    try {
        clientsPresenceSnapshotUnsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
            const updatedClients = [];
            snapshot.forEach(d => {
                const data = { ...d.data(), id: d.id };
                if (!data.nickname) data.nickname = data.name || 'Cliente';
                data.clientCode = window.getClientCode(data);
                updatedClients.push(data);
            });
            appState.clients = updatedClients;
            window.renderClients();
        });
    } catch(err) {
        console.warn("Error en listener de clientes en vivo:", err);
    }
};
window.initRealtimeClientsPresenceListener();

// Auto-refresco de estado de presencia cada 15 segundos
setInterval(() => {
    const clientsView = document.getElementById('view-clients');
    if (clientsView && !clientsView.classList.contains('hidden')) {
        window.renderClients();
    }
}, 15000);

// Listener en tiempo real para Cuentas Madre (Cuenta Matriz)
let masterAccountsSnapshotUnsubscribe = null;
window.initRealtimeMasterAccountsListener = () => {
    if (masterAccountsSnapshotUnsubscribe) return;
    try {
        masterAccountsSnapshotUnsubscribe = onSnapshot(collection(db, "masterAccounts"), (snapshot) => {
            const updatedMasters = [];
            snapshot.forEach(d => updatedMasters.push({ id: d.id, ...d.data() }));
            appState.masterAccounts = updatedMasters;
            const masterView = document.getElementById('view-master');
            if (masterView && !masterView.classList.contains('hidden')) {
                window.renderMasterAccounts();
            }
        });
    } catch(err) {
        console.warn("Error en listener de masterAccounts:", err);
    }
};
window.initRealtimeMasterAccountsListener();

// Listener en tiempo real para Catálogo Web
let catalogSnapshotUnsubscribe = null;
window.initRealtimeCatalogListener = () => {
    if (catalogSnapshotUnsubscribe) return;
    try {
        catalogSnapshotUnsubscribe = onSnapshot(collection(db, "store_catalog"), (snapshot) => {
            const updatedCatalog = [];
            snapshot.forEach(d => {
                const item = { id: d.id, ...d.data() };
                if (!item.imageUrl || item.imageUrl.trim() === '') {
                    item.imageUrl = resolveProductImage(item);
                }
                updatedCatalog.push(item);
            });
            if (updatedCatalog.length > 0) {
                appState.catalog = updatedCatalog;
            }
            const catalogView = document.getElementById('view-catalog');
            if (catalogView && !catalogView.classList.contains('hidden')) {
                window.renderCatalog();
            }
        });
    } catch(err) {
        console.warn("Error en listener de catalog:", err);
    }
};
window.initRealtimeCatalogListener();

// Listener en tiempo real para Libro Mayor (Finanzas)
let historySnapshotUnsubscribe = null;
window.initRealtimeHistoryListener = () => {
    if (historySnapshotUnsubscribe) return;
    try {
        historySnapshotUnsubscribe = onSnapshot(collection(db, "history"), (snapshot) => {
            const updatedHistory = [];
            snapshot.forEach(d => updatedHistory.push({ id: d.id, ...d.data() }));
            appState.history = updatedHistory;
            const finView = document.getElementById('view-finance');
            if (finView && !finView.classList.contains('hidden')) {
                window.renderFinance();
            }
        });
    } catch(err) {
        console.warn("Error en listener de history:", err);
    }
};
window.initRealtimeHistoryListener();

// Listener en tiempo real para Suscripciones (Servicios Activos)
let subscriptionsSnapshotUnsubscribe = null;
window.initRealtimeSubscriptionsListener = () => {
    if (subscriptionsSnapshotUnsubscribe) return;
    try {
        subscriptionsSnapshotUnsubscribe = onSnapshot(collection(db, "subscriptions"), (snapshot) => {
            const updatedSubs = [];
            snapshot.forEach(d => {
                const data = d.data();
                updatedSubs.push({ ...data, id: d.id });
            });
            appState.subscriptions = updatedSubs;
            const subsView = document.getElementById('view-subs');
            if (subsView && !subsView.classList.contains('hidden')) {
                window.renderActiveTable();
            }
            window.renderNotifications();
        });
    } catch(err) {
        console.warn("Error en listener de subscriptions:", err);
    }
};
window.initRealtimeSubscriptionsListener();

// =====================================
// 10.1. GESTIÓN DE SOLICITUDES DE CUENTA GRATIS & CÓDIGO DE REFERIDO VIP (+S/ 0.50)
// =====================================
window.isRegistrationAlarmEnabled = true;

// Sonido sintetizado de alarma con Web Audio API (Chime de dos tonos)
window.playRegistrationAlarmSound = () => {
    if (!window.isRegistrationAlarmEnabled) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
        
        gain1.gain.setValueAtTime(0.3, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        
        osc1.start();
        osc1.stop(ctx.currentTime + 0.5);
    } catch(e) {}
};

window.toggleRegistrationAlarmSound = () => {
    window.isRegistrationAlarmEnabled = !window.isRegistrationAlarmEnabled;
    const btn = document.getElementById('btnToggleAlarmSound');
    const icon = document.getElementById('alarmSoundIcon');
    const text = document.getElementById('alarmSoundText');
    
    if (window.isRegistrationAlarmEnabled) {
        if (btn) btn.className = "bg-gray-900 hover:bg-gray-800 border border-yellow-500/40 text-yellow-300 text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition font-bold shadow";
        if (icon) icon.className = "fa-solid fa-volume-high text-yellow-400";
        if (text) text.innerText = "Alarma: ACTIVA";
        window.playRegistrationAlarmSound();
    } else {
        if (btn) btn.className = "bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-400 text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition font-bold shadow";
        if (icon) icon.className = "fa-solid fa-volume-xmark text-gray-500";
        if (text) text.innerText = "Alarma: SILENCIADA";
    }
};

window.renderPendingRegistrationsTable = async () => {
    const tbody = document.getElementById('pendingRegistrationsTableBody');
    const badge = document.getElementById('pendingRegistrationsBadge');
    const countBadge = document.getElementById('regPendingCountBadge');

    try {
        const regSnap = await getDocs(collection(db, "pending_registrations"));
        appState.pendingRegistrations = [];
        regSnap.forEach(d => appState.pendingRegistrations.push({ id: d.id, ...d.data() }));
    } catch(e) {}

    // Fallback local
    try {
        let localReqs = JSON.parse(localStorage.getItem("cuycito_pending_registrations") || "[]");
        localReqs.forEach(lr => {
            if (!appState.pendingRegistrations.some(r => r.id === lr.id)) {
                appState.pendingRegistrations.push(lr);
            }
        });
    } catch(e) {}

    const pendingList = (appState.pendingRegistrations || []).filter(r => r.status === 'pending' || !r.status);

    if (badge) {
        if (pendingList.length > 0) {
            badge.innerText = pendingList.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    if (countBadge) {
        countBadge.innerText = `${pendingList.length} Pendientes`;
        if (pendingList.length > 0) {
            countBadge.className = "bg-cuycito-red text-white text-xs px-2.5 py-0.5 rounded-full font-black shadow glow-red animate-pulse";
        } else {
            countBadge.className = "bg-gray-800 text-gray-400 text-xs px-2.5 py-0.5 rounded-full font-bold";
        }
    }

    if (!tbody) return;

    if (pendingList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-500 font-sans">No hay solicitudes de cuenta gratis pendientes de verificación.</td></tr>`;
        return;
    }

    // Si hay pendientes, emitir sonido suave de alerta
    window.playRegistrationAlarmSound();

    tbody.innerHTML = '';
    pendingList.forEach(req => {
        const dateStr = req.createdAt ? new Date(req.createdAt).toLocaleString('es-PE') : 'Reciente';

        // Validar código de referido
        let referralHTML = `<span class="text-gray-500 italic text-[11px]">Sin código</span>`;
        let referrerClient = null;
        let isVipReferrer = false;

        if (req.referralCode) {
            const codeNorm = req.referralCode.trim().toUpperCase();
            referrerClient = appState.clients.find(c => {
                if (!c) return false;
                const assignedCode = (c.referralCode || '').trim().toUpperCase();
                const nickCode = ('VIP-' + (c.nickname || c.name || '')).toUpperCase();
                const phoneCode = ('VIP-' + (c.phone || '')).toUpperCase();
                const rawNick = (c.nickname || c.name || '').toUpperCase();
                return (assignedCode && codeNorm === assignedCode) || codeNorm === nickCode || codeNorm === phoneCode || codeNorm === rawNick;
            });

            if (referrerClient) {
                const refClientNameNorm = (referrerClient.name || '').trim().toLowerCase();
                const activeSubs = appState.subscriptions.filter(s => 
                    s.person && s.person.trim().toLowerCase() === refClientNameNorm && window.getDaysRemaining(s.endDate) >= 0
                );
                isVipReferrer = activeSubs.length > 3;

                if (isVipReferrer) {
                    referralHTML = `
                        <div class="space-y-0.5">
                            <span class="bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 w-fit shadow">
                                <i class="fa-solid fa-crown text-yellow-400"></i> VIP Válido: @${referrerClient.nickname || referrerClient.name}
                            </span>
                            <span class="text-[9px] text-emerald-300 font-mono block">Tiene ${activeSubs.length} servicios • Recibirá +S/ 0.50</span>
                        </div>
                    `;
                } else {
                    referralHTML = `
                        <div class="space-y-0.5">
                            <span class="bg-amber-950/80 text-yellow-400 border border-yellow-500/40 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 w-fit">
                                <i class="fa-solid fa-triangle-exclamation"></i> ${req.referralCode}
                            </span>
                            <span class="text-[9px] text-gray-400 font-mono block">Cliente @${referrerClient.nickname || referrerClient.name} tiene ${activeSubs.length}/4 serv.</span>
                        </div>
                    `;
                }
            } else {
                referralHTML = `
                    <span class="bg-gray-800 text-gray-400 border border-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        ❓ ${req.referralCode} (No encontrado)
                    </span>
                `;
            }
        }

        tbody.innerHTML += `
            <tr class="hover:bg-gray-800/60 transition">
                <td class="p-3.5">
                    <div class="font-black text-white text-xs">${req.name}</div>
                    <div class="flex items-center gap-1.5 mt-1">
                        <span class="text-[9px] text-yellow-400 font-mono bg-yellow-950/60 px-1.5 py-0.5 rounded border border-yellow-500/30">Solicitante Web</span>
                        <span class="text-[9px] text-emerald-300 font-mono bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40 font-bold flex items-center gap-0.5"><i class="fa-solid fa-coins text-yellow-400 text-[8px]"></i> +S/ 1.00 Crédito</span>
                    </div>
                </td>
                <td class="p-3.5 font-mono text-blue-400 font-bold text-xs">
                    <i class="fa-solid fa-mobile-screen mr-1"></i> ${req.phone}
                </td>
                <td class="p-3.5 text-gray-400 text-xs font-mono">
                    ${req.email || '<span class="text-gray-600">No especificado</span>'}
                </td>
                <td class="p-3.5">
                    ${referralHTML}
                </td>
                <td class="p-3.5 text-gray-400 font-mono text-[11px]">
                    ${dateStr}
                </td>
                <td class="p-3.5 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="window.approveRegistrationRequest('${req.id}')" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-3 py-1.5 rounded-lg transition shadow flex items-center gap-1 glow-gold" title="Aprobar y Crear Acceso">
                            <i class="fa-solid fa-circle-check"></i> Aprobar
                        </button>
                        <button onclick="window.rejectRegistrationRequest('${req.id}')" class="bg-red-950/80 hover:bg-red-800 text-red-300 border border-red-500/40 text-xs font-bold p-1.5 rounded-lg transition" title="Rechazar solicitud">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                        <a href="https://wa.me/${req.phone.replace(/[^0-9]/g, '')}?text=Hola%20${encodeURIComponent(req.name)},%20te%20saludamos%20de%20CuycitoGO%20para%20confirmar%20tu%20cuenta" target="_blank" class="bg-emerald-950/80 hover:bg-emerald-800 text-emerald-300 border border-emerald-500/40 text-xs font-bold p-1.5 rounded-lg transition" title="Contactar por WhatsApp">
                            <i class="fa-brands fa-whatsapp"></i>
                        </a>
                    </div>
                </td>
            </tr>
        `;
    });
};

window.approveRegistrationRequest = async (reqId) => {
    const req = (appState.pendingRegistrations || []).find(r => r.id === reqId);
    if (!req) return;

    if (!confirm(`¿Deseas verificar y activar la cuenta para ${req.name} (${req.phone})?`)) return;

    const newUserId = "user_" + req.phone.replace(/[^0-9]/g, '');
    const defaultPass = "cuycito123";

    // 1. Validar y premiar al referidor si califica (>3 servicios activos)
    let referrerBonusGiven = false;
    let referrerName = '';

    if (req.referralCode) {
        const codeNorm = req.referralCode.trim().toUpperCase();
        const referrer = appState.clients.find(c => {
            if (!c) return false;
            const assignedCode = (c.referralCode || '').trim().toUpperCase();
            const nickCode = ('VIP-' + (c.nickname || c.name || '')).toUpperCase();
            const phoneCode = ('VIP-' + (c.phone || '')).toUpperCase();
            const rawNick = (c.nickname || c.name || '').toUpperCase();
            return (assignedCode && codeNorm === assignedCode) || codeNorm === nickCode || codeNorm === phoneCode || codeNorm === rawNick;
        });

        if (referrer) {
            const refClientNameNorm = (referrer.name || '').trim().toLowerCase();
            const activeSubs = appState.subscriptions.filter(s => 
                s.person && s.person.trim().toLowerCase() === refClientNameNorm && window.getDaysRemaining(s.endDate) >= 0
            );

            if (activeSubs.length > 3) {
                // Bono de 0.50 PEN
                const oldBal = referrer.balance || 0;
                const newBal = parseFloat((oldBal + 0.50).toFixed(2));
                referrer.balance = newBal;
                referrer.referredCount = (referrer.referredCount || 0) + 1;
                referrer.referralEarnings = parseFloat(((referrer.referralEarnings || 0) + 0.50).toFixed(2));

                try {
                    await setDoc(doc(db, "users", referrer.id), { 
                        balance: newBal,
                        referredCount: referrer.referredCount,
                        referralEarnings: referrer.referralEarnings
                    }, { merge: true });

                    // Registrar en historial
                    const histItem = {
                        id: "bonus_" + Date.now(),
                        person: referrer.name,
                        service: "Bono Referido VIP (+S/ 0.50)",
                        cost: 0,
                        price: 0.50,
                        startDate: new Date().toISOString().split('T')[0],
                        endDate: new Date().toISOString().split('T')[0],
                        timestamp: new Date().toISOString()
                    };
                    await setDoc(doc(db, "history", histItem.id), histItem, { merge: true });

                    // Registrar en referral_logs para la barra de canjes y auditoría
                    const refLogItem = {
                        id: "ref_log_" + Date.now(),
                        referrerId: referrer.id,
                        referrerName: referrer.nickname || referrer.name,
                        referrerPhone: referrer.phone,
                        referrerCode: req.referralCode,
                        referredName: req.name,
                        referredPhone: req.phone,
                        service: "Activación Cuenta Gratis VIP",
                        action: "account_approved",
                        amountEarned: 0.50,
                        status: "completed",
                        createdAt: new Date().toISOString()
                    };
                    await setDoc(doc(db, "referral_logs", refLogItem.id), refLogItem, { merge: true });

                    try {
                        let localLogs = JSON.parse(localStorage.getItem("cuycito_referral_logs") || "[]");
                        localLogs.unshift(refLogItem);
                        localStorage.setItem("cuycito_referral_logs", JSON.stringify(localLogs));
                    } catch(e) {}
                } catch(e) {}

                referrerBonusGiven = true;
                referrerName = referrer.nickname || referrer.name;
            }
        }
    }

    // 2. Crear usuario en Firebase y appState con S/ 1.00 de Crédito de Bienvenida
    const clientCode = window.getClientCode({ id: newUserId, phone: req.phone, name: req.name });
    const newUser = {
        id: newUserId,
        clientCode: clientCode,
        name: req.name,
        nickname: req.name.split(' ')[0],
        phone: req.phone,
        email: req.email || '',
        pass: defaultPass,
        balance: 1.00, // 🎉 S/ 1.00 Sol de Regalo de Apertura
        referredCodeUsed: req.referralCode || '',
        isOnline: false,
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString()
    };

    try {
        await setDoc(doc(db, "users", newUserId), newUser, { merge: true });
        
        // Registrar abono de S/ 1.00 en historial
        const welcomeHistItem = {
            id: "welc_" + Date.now(),
            person: req.name,
            service: "Crédito Bienvenida Apertura (+S/ 1.00)",
            cost: 0,
            price: 1.00,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            timestamp: new Date().toISOString()
        };
        await setDoc(doc(db, "history", welcomeHistItem.id), welcomeHistItem, { merge: true });
    } catch(e) {}

    // Actualizar appState.clients
    const clientIdx = appState.clients.findIndex(c => c.phone === req.phone);
    if (clientIdx >= 0) {
        appState.clients[clientIdx] = newUser;
    } else {
        appState.clients.push(newUser);
    }

    // 3. Marcar solicitud como aprobada
    req.status = 'approved';
    req.approvedAt = new Date().toISOString();

    try {
        await setDoc(doc(db, "pending_registrations", reqId), { 
            status: 'approved', 
            approvedAt: req.approvedAt 
        }, { merge: true });
    } catch(e) {}

    // Actualizar localStorage
    try {
        let localReqs = JSON.parse(localStorage.getItem("cuycito_pending_registrations") || "[]");
        localReqs = localReqs.map(r => r.id === reqId ? { ...r, status: 'approved' } : r);
        localStorage.setItem("cuycito_pending_registrations", JSON.stringify(localReqs));
    } catch(e) {}

    window.renderPendingRegistrationsTable();
    window.renderClients();
    window.renderAdminReferralLogsTable();

    let bonusMsg = referrerBonusGiven 
        ? `\n\n🎉 ¡Se abonó +S/ 0.50 céntimos de saldo al referidor VIP @${referrerName}!` 
        : '';

    const whatsappMsg = `¡Hola ${req.name}! 🐹🎉\n\nTu solicitud de *Cuenta Gratis VIP* en CuycitoGO ha sido *VERIFICADA Y ACTIVADA* con éxito:\n\n📱 *Usuario:* ${req.phone}\n🔑 *Contraseña:* ${defaultPass}\n💰 *Crédito de Bienvenida:* S/ 1.00 Sol (Abonado a tu saldo)\n🌐 *Acceso:* https://cuzcitogo.pe/login-cliente.html\n\nYa puedes ingresar a tu panel para ver tu tienda y usar tu crédito. ¡Bienvenido a CuycitoGO! 🙌`;

    if (confirm(`✅ ¡Cuenta creada exitosamente para ${req.name} con S/ 1.00 de Crédito de Regalo!${bonusMsg}\n\n¿Deseas abrir WhatsApp para enviarle sus credenciales y confirmar su saldo?`)) {
        window.open(`https://wa.me/${req.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(whatsappMsg)}`, '_blank');
    }
};

window.rejectRegistrationRequest = async (reqId) => {
    const req = (appState.pendingRegistrations || []).find(r => r.id === reqId);
    if (!req) return;
    if (!confirm(`¿Seguro que deseas rechazar la solicitud de ${req.name}?`)) return;

    req.status = 'rejected';
    try {
        await setDoc(doc(db, "pending_registrations", reqId), { status: 'rejected' }, { merge: true });
    } catch(e) {}

    try {
        let localReqs = JSON.parse(localStorage.getItem("cuycito_pending_registrations") || "[]");
        localReqs = localReqs.map(r => r.id === reqId ? { ...r, status: 'rejected' } : r);
        localStorage.setItem("cuycito_pending_registrations", JSON.stringify(localReqs));
    } catch(e) {}

    window.renderPendingRegistrationsTable();
    window.renderAdminReferralLogsTable();
};

window.renderAdminReferralLogsTable = async () => {
    const tbody = document.getElementById('adminReferralLogsTableBody');
    const totalBonusBadge = document.getElementById('adminReferralTotalBonus');

    let allLogs = [];
    try {
        const snap = await getDocs(collection(db, "referral_logs"));
        snap.forEach(d => allLogs.push({ id: d.id, ...d.data() }));
    } catch(e) {}

    try {
        let localLogs = JSON.parse(localStorage.getItem("cuycito_referral_logs") || "[]");
        localLogs.forEach(ll => {
            if (!allLogs.some(l => l.id === ll.id)) {
                allLogs.push(ll);
            }
        });
    } catch(e) {}

    // Ordenar por fecha descendente
    allLogs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const totalBonus = allLogs.reduce((sum, l) => sum + (parseFloat(l.amountEarned) || 0), 0);
    if (totalBonusBadge) {
        totalBonusBadge.innerText = `Total Bonos: S/ ${totalBonus.toFixed(2)}`;
    }

    if (!tbody) return;

    if (allLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500 font-sans">No hay movimientos de referidos registrados todavía.</td></tr>`;
        return;
    }

    tbody.innerHTML = allLogs.map(log => {
        const dateStr = log.createdAt ? new Date(log.createdAt).toLocaleString('es-PE') : 'Reciente';
        return `
            <tr class="hover:bg-gray-800/50 transition">
                <td class="p-3.5">
                    <div class="font-black text-white text-xs">${log.referrerName || 'Referidor VIP'}</div>
                    <div class="text-[10px] text-gray-500 font-mono">${log.referrerPhone || ''}</div>
                </td>
                <td class="p-3.5 font-mono text-cuycito-gold font-bold text-xs">
                    <span class="bg-amber-950/60 px-2 py-0.5 rounded border border-cuycito-gold/30">${log.referrerCode || 'N/A'}</span>
                </td>
                <td class="p-3.5">
                    <div class="font-bold text-gray-300 text-xs">${log.referredName || 'Cliente'}</div>
                    <div class="text-[10px] text-blue-400 font-mono">${log.referredPhone || ''}</div>
                </td>
                <td class="p-3.5 text-xs text-gray-300">
                    <span class="bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                        <i class="fa-solid fa-circle-check mr-1"></i> ${log.service || 'Activación VIP'}
                    </span>
                </td>
                <td class="p-3.5 text-gray-400 font-mono text-[11px]">${dateStr}</td>
                <td class="p-3.5 text-right font-mono font-black text-emerald-400 text-xs">
                    +S/ ${(parseFloat(log.amountEarned) || 0.50).toFixed(2)}
                </td>
            </tr>
        `;
    }).join('');
};

window.renderCatalog = () => {
    const grid = document.getElementById('catalogGrid');
    if(!grid) return;
    grid.innerHTML = '';
    
    const searchTerm = (document.getElementById('searchCatalogInput')?.value || '').toLowerCase().trim();
    const categoryFilter = document.getElementById('filterCatalogCategory')?.value || '';

    const filtered = appState.catalog.filter(p => {
        const matchSearch = (p.title || '').toLowerCase().includes(searchTerm) ||
                            (p.description || '').toLowerCase().includes(searchTerm);
        const matchCat = !categoryFilter || (p.category || 'Streaming') === categoryFilter || (categoryFilter === 'Combos' && (p.isCombo || p.category === 'Combos'));
        return matchSearch && matchCat;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-gray-500 italic bg-black/40 rounded-xl border border-gray-800">No hay productos en catálogo con esos filtros.</div>`;
        return;
    }
    
    filtered.forEach(p => {
        const isCombo = p.isCombo || p.category === 'Combos';
        
        let displayStock = p.stock !== undefined ? p.stock : 5;
        if (p.linkedService) {
            const matching = appState.masterAccounts.filter(m => (m.service || '').toLowerCase() === p.linkedService.toLowerCase());
            if (matching.length > 0) {
                displayStock = matching.reduce((sum, m) => {
                    const occupied = (m.profiles || []).filter(prof => prof !== null).length;
                    return sum + Math.max(0, m.capacity - occupied);
                }, 0);
            }
        } else if (p.linkedMasterId) {
            const masterAcc = appState.masterAccounts.find(m => m.id === p.linkedMasterId);
            if (masterAcc) {
                const occupied = (masterAcc.profiles || []).filter(prof => prof !== null).length;
                displayStock = Math.max(0, masterAcc.capacity - occupied);
            }
        }

        const badge = isCombo 
            ? `<span class="bg-gradient-to-r from-cuycito-red to-amber-600 text-white text-[9px] px-2.5 py-0.5 rounded-md uppercase font-black absolute top-2 right-2 shadow-lg z-10 glow-red">🔥 COMBO -${p.savingsPercent || 25}%</span>`
            : (p.promo ? `<span class="bg-cuycito-red text-white text-[9px] px-2 py-0.5 rounded uppercase font-black absolute top-2 right-2 shadow-lg z-10">Oferta 🔥</span>` : '');
        
        const catBadge = `<span class="bg-black/80 text-gray-300 text-[9px] font-bold px-2 py-0.5 rounded absolute top-2 left-2 shadow z-10">${p.category || 'Streaming'}</span>`;

        const stockBadge = displayStock > 0 
            ? `<span class="bg-emerald-950 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><i class="fa-solid fa-boxes-stacked"></i> Stock: ${displayStock} libres</span>`
            : `<span class="bg-red-950 text-red-400 border border-cuycito-red/40 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><i class="fa-solid fa-circle-xmark"></i> Agotado</span>`;

        const finalImage = resolveProductImage(p);
        const imgHTML = `
            <div class="w-full h-36 relative overflow-hidden bg-black/60 border-b border-gray-800">
                <img src="${finalImage}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="${p.title}">
                <div class="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent"></div>
            </div>
        `;

        let comboServicesBreakdownHTML = '';
        if (isCombo && p.comboServices && p.comboServices.length > 0) {
            comboServicesBreakdownHTML = `
            <div class="flex flex-wrap gap-1 my-1.5">
                ${p.comboServices.map(s => `<span class="bg-black/80 border border-cuycito-gold/40 text-cuycito-gold text-[9px] font-bold px-1.5 py-0.5 rounded">${s.service} (S/ ${(s.comboPrice || 0).toFixed(2)})</span>`).join('<span class="text-cuycito-red font-black text-xs">+</span>')}
            </div>`;
        }

        const editAction = isCombo ? `window.openComboModal('${p.id}')` : `window.openCatalogModal('${p.id}')`;

        grid.innerHTML += `
        <div class="bg-[#111] border ${isCombo ? 'border-cuycito-gold/60 glow-gold' : 'border-gray-800'} rounded-2xl overflow-hidden relative group hover:border-cuycito-gold transition flex flex-col justify-between shadow-lg">
            <div>
                ${catBadge}
                ${badge}
                ${imgHTML}
                <div class="p-4 space-y-1">
                    <h4 class="text-sm font-black text-white truncate">${p.title}</h4>
                    ${comboServicesBreakdownHTML}
                    <p class="text-[10px] text-gray-500 line-clamp-2">${p.description || 'Sin descripción'}</p>
                </div>
            </div>
            <div class="p-4 pt-0 space-y-2">
                <div class="flex items-center justify-between">
                    <div>
                        ${isCombo && p.regularPriceTotal ? `<span class="text-[10px] text-gray-500 line-through block">S/ ${p.regularPriceTotal.toFixed(2)}</span>` : ''}
                        <span class="text-cuycito-gold font-black text-base">S/ ${(parseFloat(p.price) || 0).toFixed(2)}</span>
                    </div>
                    ${stockBadge}
                </div>
                <div class="border-t border-gray-800 pt-2 flex justify-end">
                    <button onclick="${editAction}" class="text-gray-400 hover:text-cuycito-gold text-xs font-bold flex items-center gap-1 transition">
                        <i class="fa-solid fa-pen-to-square"></i> ${isCombo ? 'Editar Combo' : 'Editar Producto'}
                    </button>
                </div>
            </div>
        </div>`;
    });
};

window.renderNotifications = () => {
    const cont = document.getElementById('notificationsContainer'); 
    if(!cont) return;
    cont.innerHTML = '';

    // 1. Cuentas Matrices por vencer (Aviso a partir de 1 semana = 7 días o menos)
    const expiringMasters = (appState.masterAccounts || []).filter(acc => {
        if (!acc.endDate) return false;
        const days = window.getDaysRemaining(acc.endDate);
        return days <= 7;
    }).map(acc => {
        const days = window.getDaysRemaining(acc.endDate);
        return {
            type: 'MASTER',
            id: acc.id,
            title: acc.service,
            subtitle: acc.email,
            endDate: acc.endDate,
            days: days,
            isExpired: days < 0,
            badge: '👑 Matriz'
        };
    });

    // 2. Suscripciones de Clientes por vencer (Aviso a partir de 3 días o menos)
    const expiringSubs = (appState.subscriptions || []).filter(s => {
        if (!s.endDate || s.status === 'pending_activation') return false;
        const days = window.getDaysRemaining(s.endDate);
        return days <= 3 && days >= 0;
    }).map(s => {
        const days = window.getDaysRemaining(s.endDate);
        return {
            type: 'CLIENT_SUB',
            id: s.id,
            title: s.person || 'Cliente',
            subtitle: `${s.service} ${s.pin ? '(' + s.pin + ')' : ''}`,
            endDate: s.endDate,
            days: days,
            isExpired: days < 0,
            badge: '👤 Cliente'
        };
    });

    // Unificar y ordenar por urgencia (menor cantidad de días primero)
    const allAlerts = [...expiringMasters, ...expiringSubs].sort((a, b) => a.days - b.days);

    const alertCount = document.getElementById('alertCount');
    if(alertCount) alertCount.innerText = allAlerts.length;
    const mobileAlertBadge = document.getElementById('mobileAlertCountBadge');
    if(mobileAlertBadge) mobileAlertBadge.innerText = allAlerts.length;
    
    if (allAlerts.length === 0) {
        cont.innerHTML = `<div class="p-3 bg-black/40 border border-gray-800/80 rounded-xl text-center text-gray-500 text-xs italic"><i class="fa-solid fa-circle-check text-emerald-400 mr-1"></i> No hay cuentas matrices ni clientes por vencer</div>`;
        return;
    }

    allAlerts.forEach(item => {
        const isMaster = item.type === 'MASTER';
        const isToday = item.days === 0;
        const isExpired = item.days < 0;

        let borderClass = 'border-cuycito-gold';
        let badgeBgClass = 'bg-black text-cuycito-gold';
        let timeLabel = `${item.days} d`;

        if (isExpired) {
            borderClass = 'border-red-600 bg-red-950/20';
            badgeBgClass = 'bg-red-950 text-red-400 border border-red-500/50';
            timeLabel = 'EXPIRÓ';
        } else if (isToday) {
            borderClass = 'border-cuycito-red animate-pulse';
            badgeBgClass = 'bg-cuycito-red text-white';
            timeLabel = 'HOY';
        } else if (isMaster) {
            borderClass = 'border-purple-500 bg-purple-950/20';
            badgeBgClass = 'bg-purple-900/90 text-purple-200 border border-purple-400/50';
        }

        const tagHTML = isMaster
            ? `<span class="bg-purple-950 text-purple-300 border border-purple-500/50 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                 <i class="fa-solid fa-crown text-[8px] text-yellow-400"></i> Matriz Proveedor
               </span>`
            : `<span class="bg-blue-950/80 text-blue-300 border border-blue-500/40 text-[9px] font-bold px-1.5 py-0.5 rounded">
                 👤 Cliente
               </span>`;

        cont.innerHTML += `
        <div class="p-3 bg-[#0a0a0a] border-l-4 ${borderClass} shadow-lg rounded-r-xl space-y-1 hover:bg-[#111] transition">
            <div class="flex justify-between items-start font-bold gap-2">
                <div class="flex items-center gap-1.5 flex-wrap">
                    ${tagHTML}
                    <span class="text-white text-xs font-black">${item.title}</span>
                </div>
                <span class="${badgeBgClass} font-black text-[10px] px-2 py-0.5 rounded shadow shrink-0">
                    ${timeLabel}
                </span>
            </div>
            <div class="flex justify-between items-center text-[11px] text-gray-400 font-mono">
                <span class="truncate max-w-[150px]">${item.subtitle}</span>
                <span class="text-[10px] text-gray-500">Vence: ${item.endDate}</span>
            </div>
        </div>`;
    });
};

window.renderAll = () => {
    window.updateAllServiceDropdowns();
    window.renderActiveTable(); 
    window.renderMasterAccounts(); 
    window.renderClients(); 
    window.renderCatalog(); 
    window.renderNotifications(); 
    window.renderPostits();
    window.renderRechargesTable();
    
    const finView = document.getElementById('view-finance');
    if (finView && !finView.classList.contains('hidden')) window.renderFinance();
};

// =====================================
// 12. GESTIÓN Y HISTORIAL DE RECARGAS
// =====================================
window.renderRechargesTable = async () => {
    try {
        const recSnap = await getDocs(collection(db, "recharge_orders"));
        appState.recharges = [];
        recSnap.forEach(d => appState.recharges.push({ id: d.id, ...d.data() }));
    } catch(e) {}

    const pendingBody = document.getElementById('pendingRechargesTableBody');
    const completedBody = document.getElementById('completedRechargesTableBody');
    const pendingBadge = document.getElementById('pendingRechargesBadge');
    const pendingCountEl = document.getElementById('rechargePendingCount');

    const pendingOrders = appState.recharges.filter(r => r.status === 'pending' || r.status === 'pending_manual');
    const completedOrders = appState.recharges.filter(r => r.status === 'completed' || r.status === 'credited').sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));

    if (pendingBadge) {
        if (pendingOrders.length > 0) {
            pendingBadge.innerText = pendingOrders.length;
            pendingBadge.classList.remove('hidden');
        } else {
            pendingBadge.classList.add('hidden');
        }
    }
    if (pendingCountEl) pendingCountEl.innerText = `(${pendingOrders.length})`;

    // 1. Renderizar tabla de pendientes
    if (pendingBody) {
        if (pendingOrders.length === 0) {
            pendingBody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-gray-500 font-sans">No hay solicitudes de recarga pendientes por aprobar.</td></tr>`;
        } else {
            let html = '';
            pendingOrders.forEach(order => {
                const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleString('es-PE') : 'N/A';
                const isManual = order.status === 'pending_manual' || order.paymentMethod === 'Manual (WhatsApp)';
                const methodBadge = isManual 
                    ? `<span class="bg-blue-950/80 text-blue-400 border border-blue-500/40 text-[10px] font-black px-2 py-0.5 rounded">📱 Manual (WhatsApp)</span>`
                    : `<span class="bg-amber-950/80 text-yellow-400 border border-yellow-500/40 text-[10px] font-black px-2 py-0.5 rounded">⚡ Lemon Cash (Auto)</span>`;

                html += `
                <tr class="hover:bg-black/50 transition">
                    <td class="p-3 font-bold text-white">${order.userName || 'Cliente VIP'}</td>
                    <td class="p-3 font-mono text-gray-400">${order.userPhone || 'N/A'}</td>
                    <td class="p-3 font-bold text-white">S/ ${(order.baseAmount || 0).toFixed(2)}</td>
                    <td class="p-3 font-black text-cuycito-gold glow-gold">S/ ${(order.exactAmount || order.baseAmount || 0).toFixed(2)}</td>
                    <td class="p-3">${methodBadge}</td>
                    <td class="p-3 text-[11px] text-gray-400 font-mono">${dateStr}</td>
                    <td class="p-3 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                            <button onclick="window.approveRechargeOrder('${order.id}')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-2.5 py-1.5 rounded-lg transition shadow flex items-center gap-1" title="Aprobar y acreditar saldo al cliente">
                                <i class="fa-solid fa-check"></i> Aprobar
                            </button>
                            <button onclick="window.rejectRechargeOrder('${order.id}')" class="bg-gray-800 hover:bg-red-700 text-gray-300 hover:text-white font-black text-xs px-2.5 py-1.5 rounded-lg transition" title="Rechazar solicitud">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
            });
            pendingBody.innerHTML = html;
        }
    }

    // 2. Renderizar tabla de historial
    if (completedBody) {
        if (completedOrders.length === 0) {
            completedBody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-gray-500 font-sans">Aún no hay recargas procesadas registradas.</td></tr>`;
        } else {
            let html = '';
            completedOrders.forEach(order => {
                const dateStr = (order.completedAt || order.createdAt) ? new Date(order.completedAt || order.createdAt).toLocaleString('es-PE') : 'N/A';
                const isAuto = order.transferReference && !order.transferReference.includes('Manual');
                const typeBadge = isAuto
                    ? `<span class="bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1 w-max"><i class="fa-solid fa-bolt"></i> Lemon IMAP Auto</span>`
                    : `<span class="bg-purple-950/80 text-purple-300 border border-purple-500/40 text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1 w-max"><i class="fa-solid fa-user-check"></i> Manual Admin</span>`;

                html += `
                <tr class="hover:bg-black/50 transition">
                    <td class="p-3 text-[11px] text-gray-400 font-mono">${dateStr}</td>
                    <td class="p-3 font-bold text-white">${order.userName || order.userId}</td>
                    <td class="p-3 font-black text-emerald-400">S/ ${(order.creditedAmount || order.exactAmount || order.baseAmount || 0).toFixed(2)}</td>
                    <td class="p-3">${typeBadge}</td>
                    <td class="p-3 font-mono text-[11px] text-gray-400 truncate max-w-[150px]">${order.transferReference || 'N/A'}</td>
                    <td class="p-3 text-center">
                        <span class="bg-emerald-950 text-emerald-400 border border-emerald-500/50 text-[10px] font-black px-2.5 py-1 rounded-lg">🟢 Acreditado</span>
                    </td>
                    <td class="p-3 text-center">
                        <button onclick="window.deleteCompletedRecharge('${order.id}')" class="bg-red-950/80 hover:bg-red-700 text-red-300 hover:text-white border border-red-500/40 px-2.5 py-1 rounded-lg transition text-xs font-bold flex items-center justify-center gap-1 mx-auto shadow" title="Eliminar este registro permanentemente">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                            <span class="text-[10px] uppercase tracking-wider font-extrabold">Eliminar</span>
                        </button>
                    </td>
                </tr>`;
            });
            completedBody.innerHTML = html;
        }
    }
};

window.deleteCompletedRecharge = async (orderId) => {
    const order = appState.recharges.find(r => r.id === orderId);
    const clientName = order ? (order.userName || order.userNickname || order.userId || 'Cliente') : 'Cliente';
    const amount = order ? (order.creditedAmount || order.exactAmount || order.baseAmount || 0) : 0;
    
    if (!confirm(`¿Estás seguro de eliminar este registro de recarga procesada de S/ ${amount.toFixed(2)} del cliente "${clientName}"?\n\nEsta acción eliminará el registro del historial permanentemente.`)) {
        return;
    }

    try {
        await deleteDoc(doc(db, "recharge_orders", orderId));
        appState.recharges = appState.recharges.filter(r => r.id !== orderId);
        window.renderRechargesTable();
        alert("✅ Registro de recarga procesada eliminado con éxito.");
    } catch (err) {
        console.error("Error al eliminar registro de recarga:", err);
        alert("❌ Error al eliminar el registro: " + err.message);
    }
};

window.approveRechargeOrder = async (orderId) => {
    const order = appState.recharges.find(r => r.id === orderId);
    if (!order) return alert("Orden no encontrada.");

    const amountToCredit = parseFloat(order.exactAmount || order.baseAmount || order.amount || 0);
    const clientDisplayName = order.userName || order.userNickname || order.userId || "Cliente";

    if (!confirm(`¿Aprobar manualmente la recarga de S/ ${amountToCredit.toFixed(2)} para el cliente "${clientDisplayName}"?`)) return;

    try {
        // 1. Buscar cliente de manera exhaustiva (por ID, Teléfono, Email o Nombre)
        let clientObj = appState.clients.find(c => c.id === order.userId);
        if (!clientObj && order.userPhone) {
            clientObj = appState.clients.find(c => c.phone && c.phone.trim() === order.userPhone.trim());
        }
        if (!clientObj && order.userEmail) {
            clientObj = appState.clients.find(c => c.email && c.email.trim().toLowerCase() === order.userEmail.trim().toLowerCase());
        }
        if (!clientObj && order.userName) {
            clientObj = appState.clients.find(c => 
                (c.name && c.name.trim().toLowerCase() === order.userName.trim().toLowerCase()) ||
                (c.nickname && c.nickname.trim().toLowerCase() === order.userName.trim().toLowerCase())
            );
        }

        const targetUserId = clientObj ? clientObj.id : (order.userId || 'user_' + Date.now());
        const userDocRef = doc(db, "users", targetUserId);

        // Obtener saldo más reciente de Firestore
        let currentBal = 0;
        try {
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
                currentBal = parseFloat(userSnap.data().balance || 0);
            } else if (clientObj) {
                currentBal = parseFloat(clientObj.balance || 0);
            }
        } catch (err) {
            if (clientObj) currentBal = parseFloat(clientObj.balance || 0);
        }

        const newBal = parseFloat((currentBal + amountToCredit).toFixed(2));

        if (clientObj) clientObj.balance = newBal;
        await setDoc(userDocRef, { 
            balance: newBal, 
            lastRechargeAt: new Date().toISOString(),
            ...(order.userName ? { name: order.userName } : {}),
            ...(order.userPhone ? { phone: order.userPhone } : {})
        }, { merge: true });

        // 2. Actualizar estado de la orden
        order.status = 'completed';
        order.completedAt = new Date().toISOString();
        order.transferReference = 'Aprobación Manual Admin Dashboard';
        order.creditedAmount = amountToCredit;
        await setDoc(doc(db, "recharge_orders", order.id), order, { merge: true });

        // 3. Registrar en historial contable
        const txId = `tx_rec_man_${Date.now()}`;
        const newTx = {
            id: txId,
            date: new Date().toISOString().split('T')[0],
            type: 'RECARGA_MANUAL',
            person: clientDisplayName,
            service: 'Recarga Saldo VIP',
            amount: amountToCredit,
            currency: order.currency || 'PEN',
            orderId: order.id
        };
        appState.history.push(newTx);
        await setDoc(doc(db, "history", txId), newTx);

        window.notifyAutoSave('Recarga Aprobada');
        window.renderRechargesTable();
        window.renderClients();
        alert(`✅ ¡Recarga de S/ ${amountToCredit.toFixed(2)} aprobada y acreditada con éxito! Nuevo saldo de ${clientDisplayName}: S/ ${newBal.toFixed(2)}`);

    } catch (e) {
        console.error(e);
        alert("Error al aprobar la recarga en Firebase: " + e.message);
    }
};

window.rejectRechargeOrder = async (orderId) => {
    const order = appState.recharges.find(r => r.id === orderId);
    if (!order) return;
    if (!confirm(`¿Rechazar y cancelar la solicitud de recarga de "${order.userName || order.userId}"?`)) return;

    try {
        order.status = 'canceled';
        order.canceledAt = new Date().toISOString();
        await setDoc(doc(db, "recharge_orders", order.id), order);
        window.notifyAutoSave('Recarga Cancelada');
        window.renderRechargesTable();
    } catch(e) {
        alert("Error al cancelar la orden.");
    }
};

window.filterRechargesHistory = () => {
    const query = document.getElementById('searchRechargesHistory')?.value.toLowerCase() || '';
    const completedBody = document.getElementById('completedRechargesTableBody');
    if (!completedBody) return;

    const filtered = appState.recharges.filter(r => (r.status === 'completed' || r.status === 'credited') && (
        (r.userName || '').toLowerCase().includes(query) ||
        (r.transferReference || '').toLowerCase().includes(query) ||
        (r.userId || '').toLowerCase().includes(query)
    ));

    if (filtered.length === 0) {
        completedBody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-gray-500 font-sans">No se encontraron recargas con "${query}".</td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach(order => {
        const dateStr = (order.completedAt || order.createdAt) ? new Date(order.completedAt || order.createdAt).toLocaleString('es-PE') : 'N/A';
        const isAuto = order.transferReference && !order.transferReference.includes('Manual');
        const typeBadge = isAuto
            ? `<span class="bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1 w-max"><i class="fa-solid fa-bolt"></i> Lemon IMAP Auto</span>`
            : `<span class="bg-purple-950/80 text-purple-300 border border-purple-500/40 text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1 w-max"><i class="fa-solid fa-user-check"></i> Manual Admin</span>`;

        html += `
        <tr class="hover:bg-black/50 transition">
            <td class="p-3 text-[11px] text-gray-400 font-mono">${dateStr}</td>
            <td class="p-3 font-bold text-white">${order.userName || order.userId}</td>
            <td class="p-3 font-black text-emerald-400">S/ ${(order.creditedAmount || order.exactAmount || order.baseAmount || 0).toFixed(2)}</td>
            <td class="p-3">${typeBadge}</td>
            <td class="p-3 font-mono text-[11px] text-gray-400 truncate max-w-[150px]">${order.transferReference || 'N/A'}</td>
            <td class="p-3 text-center">
                <span class="bg-emerald-950 text-emerald-400 border border-emerald-500/50 text-[10px] font-black px-2.5 py-1 rounded-lg">🟢 Acreditado</span>
            </td>
            <td class="p-3 text-center">
                <button onclick="window.deleteCompletedRecharge('${order.id}')" class="bg-red-950/80 hover:bg-red-700 text-red-300 hover:text-white border border-red-500/40 px-2.5 py-1 rounded-lg transition text-xs font-bold flex items-center justify-center gap-1 mx-auto shadow" title="Eliminar este registro permanentemente">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                    <span class="text-[10px] uppercase tracking-wider font-extrabold">Eliminar</span>
                </button>
            </td>
        </tr>`;
    });
    completedBody.innerHTML = html;
};

// ==========================================
// 13. CONFIGURACIÓN DE QR Y MÉTRICAS RULETA
// ==========================================
window.loadPaymentQRSettings = async () => {
    try {
        // Cargar primero de localStorage si existe para render inmediato
        const cachedQr = localStorage.getItem("paymentQrUrl");
        const cachedTag = localStorage.getItem("lemonTag");
        if (cachedQr) {
            const preview = document.getElementById('dashboardQrPreview');
            const qrInput = document.getElementById('settingQrUrlInput');
            if (preview) preview.src = cachedQr;
            if (qrInput) qrInput.value = cachedQr;
        }
        if (cachedTag) {
            const lemonTagInput = document.getElementById('settingLemonTagInput');
            if (lemonTagInput) lemonTagInput.value = cachedTag;
        }

        const docSnap = await getDoc(doc(db, "settings", "general"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            const qrInput = document.getElementById('settingQrUrlInput');
            const preview = document.getElementById('dashboardQrPreview');
            const lemonTagInput = document.getElementById('settingLemonTagInput');
            const whatsappInput = document.getElementById('settingWhatsappPhoneInput');

            if (qrInput && data.paymentQrUrl) qrInput.value = data.paymentQrUrl;
            if (preview && data.paymentQrUrl) preview.src = data.paymentQrUrl;
            if (lemonTagInput && data.lemonTag) lemonTagInput.value = data.lemonTag;
            if (whatsappInput && data.whatsappPhone) whatsappInput.value = data.whatsappPhone;

            if (data.paymentQrUrl) localStorage.setItem("paymentQrUrl", data.paymentQrUrl);
            if (data.lemonTag) localStorage.setItem("lemonTag", data.lemonTag);
        }
    } catch (e) {
        console.error("Error al cargar configuración de QR:", e);
    }
};

window.handleQrFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const rawData = event.target.result;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDim = 500;
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > maxDim) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                }
            } else {
                if (height > maxDim) {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.85);

            const qrInput = document.getElementById('settingQrUrlInput');
            const preview = document.getElementById('dashboardQrPreview');
            if (qrInput) qrInput.value = optimizedBase64;
            if (preview) preview.src = optimizedBase64;
            
            // Guardar en cache local inmediato
            localStorage.setItem("paymentQrUrl", optimizedBase64);
        };
        img.src = rawData;
    };
    reader.readAsDataURL(file);
};

window.savePaymentQRSettings = async () => {
    const qrUrl = document.getElementById('settingQrUrlInput')?.value.trim() || '';
    const lemonTag = document.getElementById('settingLemonTagInput')?.value.trim() || '$cmancocambillo';
    const whatsappPhone = document.getElementById('settingWhatsappPhoneInput')?.value.trim() || '';

    try {
        await setDoc(doc(db, "settings", "general"), {
            paymentQrUrl: qrUrl,
            lemonTag: lemonTag,
            whatsappPhone: whatsappPhone,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        if (qrUrl) localStorage.setItem("paymentQrUrl", qrUrl);
        if (lemonTag) localStorage.setItem("lemonTag", lemonTag);
        if (whatsappPhone) localStorage.setItem("whatsappPhone", whatsappPhone);

        const preview = document.getElementById('dashboardQrPreview');
        if (preview && qrUrl) preview.src = qrUrl;

        window.notifyAutoSave('Configuración QR Guardada');
        alert("✅ ¡Configuración de QR y Lemon Tag guardada exitosamente! Ya está sincronizada con todos los clientes.");
    } catch (e) {
        console.error("Error guardando en Firestore:", e);
        if (qrUrl) localStorage.setItem("paymentQrUrl", qrUrl);
        alert("✅ Configuración de QR guardada.");
    }
};

window.loadRouletteHouseStats = async () => {
    try {
        let stats = null;
        try {
            const res = await fetch('http://localhost:5000/api/games/house-stats');
            if (res.ok) {
                const data = await res.json();
                stats = data.houseStats;
            }
        } catch (err) {}

        if (!stats) {
            const docSnap = await getDoc(doc(db, "game_house_stats", "roulette_global"));
            if (docSnap.exists()) stats = docSnap.data();
        }

        if (stats) {
            const elSpins = document.getElementById('houseStatTotalSpins');
            const elRev = document.getElementById('houseStatTotalRevenue');
            const elCost = document.getElementById('houseStatTotalPrizesCost');
            const elMargin = document.getElementById('houseStatMarginPercent');

            if (elSpins) elSpins.innerText = (stats.totalSpins || 0).toLocaleString();
            if (elRev) elRev.innerText = `S/ ${(stats.totalRevenue || 0).toFixed(2)}`;
            if (elCost) elCost.innerText = `S/ ${(stats.totalPrizesCost || 0).toFixed(2)}`;
            if (elMargin) elMargin.innerText = `${(stats.profitMarginPercent || 100).toFixed(2)}%`;
        }
    } catch (e) {
        console.error("Error al cargar estadísticas de ruleta:", e);
    }
};

// ==========================================
// 14. MÓDULO DE JUEGOS Y CONTROL DE RULETA
// ==========================================
const DEFAULT_APP_ROULETTE_SETTINGS = {
    enabled: true,
    spinCost: 1.00,
    minActiveServicesRequired: 3,
    services: [
        { id: 'netflix', serviceName: 'Netflix', title: 'Netflix 4K VIP 👑', cost: 13.00, stock: 2, color: '#dc2626', textColor: '#ffffff', baseProbability: 0.005 },
        { id: 'hbo', serviceName: 'HBO Max', title: 'HBO Max VIP 🎬', cost: 8.00, stock: 3, color: '#7c3aed', textColor: '#ffffff', baseProbability: 0.01 },
        { id: 'crunchyroll', serviceName: 'Crunchyroll', title: 'Crunchyroll Fan 🍿', cost: 5.00, stock: 5, color: '#ea580c', textColor: '#ffffff', baseProbability: 0.03 },
        { id: 'paramount', serviceName: 'Paramount+', title: 'Paramount+ 📺', cost: 6.00, stock: 2, color: '#2563eb', textColor: '#ffffff', baseProbability: 0.01 }
    ]
};

window.renderGamesSection = async () => {
    // 1. Cargar Configuración de Ruleta
    try {
        const docSnap = await getDoc(doc(db, "game_settings", "roulette"));
        if (docSnap.exists()) {
            appState.rouletteSettings = docSnap.data();
        } else {
            appState.rouletteSettings = { ...DEFAULT_APP_ROULETTE_SETTINGS };
        }
    } catch (e) {
        appState.rouletteSettings = { ...DEFAULT_APP_ROULETTE_SETTINGS };
    }

    // 2. Cargar Historial de Giros (Transacciones)
    try {
        const spinsSnap = await getDocs(collection(db, "game_spins"));
        appState.gameSpins = [];
        spinsSnap.forEach(d => appState.gameSpins.push({ id: d.id, ...d.data() }));
        appState.gameSpins.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (e) {}

    // 3. Renderizar Switch Habilitar/Deshabilitar
    const isEnabled = appState.rouletteSettings.enabled !== false;
    const led = document.getElementById('rouletteStatusLed');
    const text = document.getElementById('rouletteStatusText');
    const btn = document.getElementById('btnToggleRouletteEnabled');

    if (led) led.className = isEnabled ? "w-3 h-3 rounded-full bg-emerald-400 animate-pulse" : "w-3 h-3 rounded-full bg-red-500";
    if (text) {
        text.innerText = isEnabled ? "Ruleta Habilitada" : "Ruleta Deshabilitada";
        text.className = isEnabled ? "text-xs font-black text-emerald-400" : "text-xs font-black text-red-400";
    }
    if (btn) {
        btn.innerText = isEnabled ? "Deshabilitar" : "Habilitar Ruleta";
        btn.className = isEnabled ? "bg-gray-800 hover:bg-red-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition border border-gray-700" : "bg-emerald-600 hover:bg-emerald-500 text-black font-black text-xs px-3 py-1.5 rounded-lg transition shadow";
    }

    // 4. Renderizar Finanzas Reales de la Ruleta (Excluyendo cuentas Demo de prueba)
    let totalRevenue = 0;
    let totalPrizesCost = 0;
    let realSpinsCount = 0;
    appState.gameSpins.forEach(s => {
        if (!s.isDemo && s.userId !== 'demo_cuycito_user') {
            totalRevenue += parseFloat(s.cost || 1.00);
            totalPrizesCost += parseFloat(s.prizeCostForHouse || 0);
            realSpinsCount++;
        }
    });

    const netProfit = totalRevenue - totalPrizesCost;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 100;

    const elSpins = document.getElementById('gameFinanceTotalSpins');
    const elRev = document.getElementById('gameFinanceTotalRevenue');
    const elCost = document.getElementById('gameFinanceTotalPrizesCost');
    const elProfit = document.getElementById('gameFinanceNetProfit');

    if (elSpins) elSpins.innerText = realSpinsCount;
    if (elRev) elRev.innerText = `S/ ${totalRevenue.toFixed(2)}`;
    if (elCost) elCost.innerText = `S/ ${totalPrizesCost.toFixed(2)}`;
    if (elProfit) {
        elProfit.innerText = `S/ ${netProfit.toFixed(2)} (${margin.toFixed(1)}%)`;
        elProfit.className = `text-2xl font-black font-mono ${netProfit >= 0 ? 'text-cuycito-gold glow-gold' : 'text-red-400'}`;
    }

    // 5. Renderizar Tabla de Servicios y Stock
    window.renderRouletteServicesTable();

    // 6. Renderizar Tabla de Transacciones
    window.renderGameSpinsTable();
};

window.renderRouletteServicesTable = () => {
    const tbody = document.getElementById('rouletteServicesTableBody');
    if (!tbody || !appState.rouletteSettings) return;

    const services = appState.rouletteSettings.services || [];
    if (services.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500 font-sans">No hay servicios configurados en la Ruleta. Añade al menos uno con el botón superior.</td></tr>`;
        return;
    }

    let html = '';
    services.forEach((s, index) => {
        const stock = parseInt(s.stock || 0);
        const hasStock = stock > 0;
        const stockBadge = hasStock
            ? `<span class="bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5 w-max"><i class="fa-solid fa-boxes-stacked"></i> ${stock} disponibles</span>`
            : `<span class="bg-red-950/80 text-red-400 border border-red-500/50 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5 w-max animate-pulse"><i class="fa-solid fa-triangle-exclamation"></i> 0 Agotado (No saldrá)</span>`;

        html += `
        <tr class="hover:bg-black/50 transition">
            <td class="p-3">
                <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full" style="background-color: ${s.color || '#dc2626'}"></span>
                    <strong class="text-white font-bold">${s.serviceName}</strong>
                </div>
            </td>
            <td class="p-3 font-mono font-bold text-gray-300">S/ ${(s.cost || 0).toFixed(2)}</td>
            <td class="p-3">
                <div class="flex items-center gap-2">
                    <input type="number" min="0" value="${stock}" onchange="window.setRouletteServiceStockDirect(${index}, this.value)" class="w-16 bg-black border border-gray-700 rounded-lg p-1.5 text-center text-white font-mono font-black text-xs outline-none focus:border-cuycito-gold">
                    <button onclick="window.updateRouletteServiceStock(${index}, 1)" class="bg-gray-800 hover:bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded transition" title="Sumar 1 unidad">+1</button>
                    <button onclick="window.updateRouletteServiceStock(${index}, 5)" class="bg-gray-800 hover:bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded transition" title="Sumar 5 unidades">+5</button>
                </div>
            </td>
            <td class="p-3 font-mono text-gray-400">${((s.baseProbability || 0.01) * 100).toFixed(1)}%</td>
            <td class="p-3 text-center">${stockBadge}</td>
            <td class="p-3 text-center">
                <button onclick="window.deleteRouletteService(${index})" class="text-gray-500 hover:text-red-400 p-1.5 transition" title="Eliminar de la Ruleta">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
            </td>
        </tr>`;
    });

    tbody.innerHTML = html;
};

window.renderGameSpinsTable = () => {
    const tbody = document.getElementById('gameSpinsAdminTableBody');
    if (!tbody) return;

    const query = document.getElementById('searchGameSpinsInput')?.value.toLowerCase() || '';
    const filtered = (appState.gameSpins || []).filter(s => 
        (s.userName || '').toLowerCase().includes(query) ||
        (s.userNickname || '').toLowerCase().includes(query) ||
        (s.prizeTitle || '').toLowerCase().includes(query) ||
        (s.userPhone || '').toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-500 font-sans">No hay transacciones registradas de la Ruleta.</td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach(s => {
        const dateStr = s.timestamp ? new Date(s.timestamp).toLocaleString('es-PE') : 'N/A';
        const hasCostPrize = (s.prizeCostForHouse || 0) > 0;
        const statusBadge = hasCostPrize
            ? `<span class="bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-[10px] font-black px-2 py-0.5 rounded shadow">🏆 Ganó Cuenta (S/ ${s.prizeCostForHouse.toFixed(2)})</span>`
            : (s.sliceIndex === 1 ? `<span class="bg-sky-950 text-sky-400 border border-sky-500/40 text-[10px] font-black px-2 py-0.5 rounded">🔄 Free Spin</span>` : `<span class="text-gray-500 text-[10px] font-sans">❌ No Ganó</span>`);

        const demoBadge = s.isDemo ? `<span class="bg-purple-950 text-purple-300 border border-purple-500/40 text-[9px] font-black px-1.5 py-0.5 rounded ml-1.5">🧪 Demo</span>` : '';

        html += `
        <tr class="hover:bg-black/50 transition ${s.isDemo ? 'opacity-75' : ''}">
            <td class="p-3 text-[11px] text-gray-400 font-mono">${dateStr}</td>
            <td class="p-3 font-bold text-white">${s.userName || 'Cliente VIP'} ${demoBadge}</td>
            <td class="p-3 font-mono text-[11px] text-gray-400">@${s.userNickname || s.userName} <span class="opacity-60">(${s.userPhone || 'N/A'})</span></td>
            <td class="p-3 font-mono font-bold text-cuycito-gold">S/ ${(s.cost || 1.00).toFixed(2)}</td>
            <td class="p-3 font-bold text-white text-xs">${s.prizeTitle || 'N/A'}</td>
            <td class="p-3 text-center">${statusBadge}</td>
        </tr>`;
    });

    tbody.innerHTML = html;
};

window.filterGameSpinsTable = () => {
    window.renderGameSpinsTable();
};

window.toggleRouletteEnabled = async () => {
    if (!appState.rouletteSettings) return;
    const currentState = appState.rouletteSettings.enabled !== false;
    const newState = !currentState;
    appState.rouletteSettings.enabled = newState;

    try {
        await setDoc(doc(db, "game_settings", "roulette"), { enabled: newState, updatedAt: new Date().toISOString() }, { merge: true });
        window.notifyAutoSave(`Ruleta ${newState ? 'Habilitada' : 'Deshabilitada'}`);
        window.renderGamesSection();
        alert(`🎰 La Ruleta VIP ha sido ${newState ? 'HABILITADA' : 'DESHABILITADA'} para los clientes.`);
    } catch(e) {
        alert("Error al actualizar estado en Firebase.");
    }
};

window.openAddRouletteServiceModal = () => {
    const modal = document.getElementById('addRouletteServiceModal');
    const datalist = document.getElementById('rouletteServicesListDatalist');
    if (datalist) {
        datalist.innerHTML = (appState.services || []).map(srv => `<option value="${srv}"></option>`).join('');
    }
    if (modal) modal.classList.remove('hidden');
};

window.confirmAddRouletteService = () => {
    const name = document.getElementById('newRouletteServiceName')?.value.trim();
    const stock = parseInt(document.getElementById('newRouletteServiceStock')?.value) || 1;
    const cost = parseFloat(document.getElementById('newRouletteServiceCost')?.value) || 10;
    const color = document.getElementById('newRouletteServiceColor')?.value || '#dc2626';
    const prob = parseFloat(document.getElementById('newRouletteServiceProb')?.value) || 1.0;

    if (!name) return alert("Por favor ingresa o selecciona un servicio.");

    if (!appState.rouletteSettings.services) appState.rouletteSettings.services = [];
    appState.rouletteSettings.services.push({
        id: name.toLowerCase().replace(/\s+/g, '_'),
        serviceName: name,
        title: `${name} VIP 🎁`,
        cost: cost,
        stock: stock,
        color: color,
        textColor: '#ffffff',
        baseProbability: prob / 100
    });

    document.getElementById('addRouletteServiceModal').classList.add('hidden');
    window.renderRouletteServicesTable();
    window.saveRouletteSettingsToFirebase();
};

window.updateRouletteServiceStock = (index, delta) => {
    if (!appState.rouletteSettings.services?.[index]) return;
    const current = parseInt(appState.rouletteSettings.services[index].stock || 0);
    appState.rouletteSettings.services[index].stock = Math.max(0, current + delta);
    window.renderRouletteServicesTable();
};

window.setRouletteServiceStockDirect = (index, val) => {
    if (!appState.rouletteSettings.services?.[index]) return;
    appState.rouletteSettings.services[index].stock = Math.max(0, parseInt(val) || 0);
    window.renderRouletteServicesTable();
};

window.deleteRouletteService = (index) => {
    if (!appState.rouletteSettings.services?.[index]) return;
    const name = appState.rouletteSettings.services[index].serviceName;
    if (!confirm(`¿Quitar "${name}" de los premios de la Ruleta?`)) return;
    appState.rouletteSettings.services.splice(index, 1);
    window.renderRouletteServicesTable();
};

window.saveRouletteSettingsToFirebase = async () => {
    if (!appState.rouletteSettings) return;
    try {
        await setDoc(doc(db, "game_settings", "roulette"), {
            ...appState.rouletteSettings,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        window.notifyAutoSave('Ruleta Guardada');
        alert("✅ ¡Configuración de la Ruleta y stock de servicios guardados exitosamente!");
    } catch(e) {
        console.error(e);
        alert("Error al guardar la configuración en Firebase.");
    }
};

// ========================================================
// MÓDULO GESTOR DE NOTICIAS & CARTELERA PÚBLICA (ADMIN)
// ========================================================

window.initNewsManager = () => {
    window.renderAdminNewsList();
    window.renderAdminCarteleraList();
};

window.switchNewsManagerSubtab = (subtab) => {
    const viewArticles = document.getElementById('newsSubviewArticles');
    const viewCartelera = document.getElementById('newsSubviewCartelera');
    const btnArticles = document.getElementById('subtab-btn-news-articles');
    const btnCartelera = document.getElementById('subtab-btn-news-cartelera');

    if (subtab === 'articles') {
        if (viewArticles) viewArticles.classList.remove('hidden');
        if (viewCartelera) viewCartelera.classList.add('hidden');
        if (btnArticles) btnArticles.className = "text-orange-400 border-b-2 border-orange-400 pb-1 flex items-center gap-1.5";
        if (btnCartelera) btnCartelera.className = "text-gray-500 hover:text-white border-b-2 border-transparent pb-1 flex items-center gap-1.5";
        window.renderAdminNewsList();
    } else {
        if (viewArticles) viewArticles.classList.add('hidden');
        if (viewCartelera) viewCartelera.classList.remove('hidden');
        if (btnArticles) btnArticles.className = "text-gray-500 hover:text-white border-b-2 border-transparent pb-1 flex items-center gap-1.5";
        if (btnCartelera) btnCartelera.className = "text-cuycito-gold border-b-2 border-cuycito-gold pb-1 flex items-center gap-1.5";
        window.renderAdminCarteleraList();
    }
};

// 1. Renderizado de Noticias en Admin
window.renderAdminNewsList = () => {
    const grid = document.getElementById('adminNewsListGrid');
    if (!grid) return;

    let newsList = [];
    try {
        const stored = localStorage.getItem("cuycito_portal_news");
        if (stored) newsList = JSON.parse(stored);
    } catch(e) {}

    if (!newsList || newsList.length === 0) {
        newsList = [
            {
                id: "reporte-agosto-2026",
                category: "ANÁLISIS DE MERCADO",
                categoryColor: "bg-red-600",
                readTime: "7 min de lectura",
                date: "Agosto 2026",
                title: "📺 Reporte de Streaming: Novedades, Subida de Precios en Crunchyroll, Disney+, Apple y Cambios de Suscripciones",
                image: "assets/img/news1.jpg",
                excerpt: "Crunchyroll sube a $11.99/$14.99, Disney+ consolida su plan en 15,99 € y Netflix refuerza el bloqueo de cuentas compartidas.",
                isHero: true
            },
            {
                id: "jojo-steel-ball-run",
                category: "ANIME BOMBAZO",
                categoryColor: "bg-purple-600",
                readTime: "5 min de lectura",
                date: "Agosto 2026",
                title: "⚔️ STEEL BALL RUN: JoJo's Bizarre Adventure - ¡Netflix Anuncia Nuevos Episodios para Septiembre!",
                image: "assets/img/poster_jojo.jpg",
                excerpt: "La icónica carrera por Norteamérica de Johnny Joestar y Gyro Zeppeli llega a su 2nd STAGE en streaming mundial con popularidad extrema.",
                isHero: false
            },
            {
                id: "cien-anos-soledad-noticia",
                category: "CINE & SERIES",
                categoryColor: "bg-amber-600",
                readTime: "6 min de lectura",
                date: "Agosto 2026",
                title: "🍿 Cien Años de Soledad (Parte 2): La Superproducción de Netflix Basada en Gabriel García Márquez",
                image: "assets/img/poster_ciensoledad.jpg",
                excerpt: "Los siete nuevos episodios llegan este 5 de agosto retomando la historia de los Buendía con el gran final pautado para el 26 de agosto.",
                isHero: false
            }
        ];
        localStorage.setItem("cuycito_portal_news", JSON.stringify(newsList));
    }

    // Estado global de arrastre de noticias
    let draggedNewsIndex = null;

    window.handleNewsDragStart = (e, index) => {
        draggedNewsIndex = index;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index);
        const card = e.currentTarget;
        setTimeout(() => {
            card.classList.add('opacity-40', 'scale-95', 'border-cuycito-gold');
        }, 0);
    };

    window.handleNewsDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    window.handleNewsDragEnter = (e, index) => {
        e.preventDefault();
        const card = e.currentTarget;
        if (index !== draggedNewsIndex) {
            card.classList.add('border-cuycito-gold', 'ring-2', 'ring-cuycito-gold/60', 'scale-[1.02]');
        }
    };

    window.handleNewsDragLeave = (e) => {
        const card = e.currentTarget;
        card.classList.remove('border-cuycito-gold', 'ring-2', 'ring-cuycito-gold/60', 'scale-[1.02]');
    };

    window.handleNewsDragEnd = (e) => {
        const card = e.currentTarget;
        card.classList.remove('opacity-40', 'scale-95', 'border-cuycito-gold');
        document.querySelectorAll('.admin-news-card').forEach(c => {
            c.classList.remove('border-cuycito-gold', 'ring-2', 'ring-cuycito-gold/60', 'scale-[1.02]');
        });
        draggedNewsIndex = null;
    };

    window.handleNewsDrop = async (e, dropIndex) => {
        e.preventDefault();
        e.stopPropagation();
        
        document.querySelectorAll('.admin-news-card').forEach(c => {
            c.classList.remove('border-cuycito-gold', 'ring-2', 'ring-cuycito-gold/60', 'scale-[1.02]');
        });

        if (draggedNewsIndex === null || draggedNewsIndex === dropIndex) return;

        let newsList = [];
        try {
            const stored = localStorage.getItem("cuycito_portal_news");
            if (stored) newsList = JSON.parse(stored);
        } catch(e) {}

        if (!newsList || newsList.length === 0) return;

        // Mover el elemento arrastrado a la nueva posición
        const itemToMove = newsList.splice(draggedNewsIndex, 1)[0];
        newsList.splice(dropIndex, 0, itemToMove);

        // La noticia en la posición 0 siempre es el HERO principal
        newsList.forEach((n, idx) => {
            n.isHero = (idx === 0);
        });

        localStorage.setItem("cuycito_portal_news", JSON.stringify(newsList));

        // Sincronizar con Firebase si está disponible
        try {
            await setDoc(doc(db, "portal_settings", "news_articles"), {
                articles: newsList,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch(e) {
            console.warn("Sincronización remota:", e);
        }

        // Re-renderizar lista
        window.renderAdminNewsList();

        // Mostrar notificación toast
        const heroTitle = newsList[0]?.title || "Noticia";
        console.log(`✅ Orden actualizado: "${heroTitle}" ahora es la Noticia Destacada #1`);
    };

    // Funciones de gestión de orden y selección de noticias destacadas
    window.setHeroArticle = async (id) => {
        let newsList = [];
        try {
            const stored = localStorage.getItem("cuycito_portal_news");
            if (stored) newsList = JSON.parse(stored);
        } catch(e) {}

        const itemIndex = newsList.findIndex(n => n.id === id);
        if (itemIndex < 0) return;

        const target = newsList.splice(itemIndex, 1)[0];
        newsList.unshift(target);

        newsList.forEach((n, idx) => {
            n.isHero = (idx === 0);
        });

        localStorage.setItem("cuycito_portal_news", JSON.stringify(newsList));

        try {
            await setDoc(doc(db, "portal_settings", "news_articles"), {
                articles: newsList,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch(e) {}

        window.renderAdminNewsList();
        alert(`👑 "${target.title}" ahora es la NOTICIA DESTACADA #1 (HERO PRINCIPAL).`);
    };

    window.toggleFeaturedArticle = async (id, isChecked) => {
        let newsList = [];
        try {
            const stored = localStorage.getItem("cuycito_portal_news");
            if (stored) newsList = JSON.parse(stored);
        } catch(e) {}

        const itemIndex = newsList.findIndex(n => n.id === id);
        if (itemIndex < 0) return;

        const target = newsList.splice(itemIndex, 1)[0];

        if (isChecked) {
            // Mover a las destacadas (al inicio)
            newsList.unshift(target);
        } else {
            // Mover al final (no destacada)
            newsList.push(target);
        }

        newsList.forEach((n, idx) => {
            n.isHero = (idx === 0);
        });

        localStorage.setItem("cuycito_portal_news", JSON.stringify(newsList));

        try {
            await setDoc(doc(db, "portal_settings", "news_articles"), {
                articles: newsList,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch(e) {}

        window.renderAdminNewsList();
        window.renderAdminSubdestacada();
        window.renderAdminThematicGrid();
        window.renderAdminTop5();
    };

    // 2. GESTIÓN DE SUB-DESTACADA TECNOLÓGICA
    window.renderAdminSubdestacada = () => {
        try {
            const stored = localStorage.getItem("cuycito_portal_subdestacada");
            if (stored) {
                const item = JSON.parse(stored);
                if (document.getElementById('subdestacadaTag')) document.getElementById('subdestacadaTag').value = item.tag || '';
                if (document.getElementById('subdestacadaBadge')) document.getElementById('subdestacadaBadge').value = item.badge || '';
                if (document.getElementById('subdestacadaTitle')) document.getElementById('subdestacadaTitle').value = item.title || '';
                if (document.getElementById('subdestacadaExcerpt')) document.getElementById('subdestacadaExcerpt').value = item.excerpt || '';
                if (document.getElementById('subdestacadaImgUrl')) document.getElementById('subdestacadaImgUrl').value = item.image || '';
                if (document.getElementById('subdestacadaPreviewImg')) document.getElementById('subdestacadaPreviewImg').src = item.image || 'assets/img/news5.jpg';
            }
        } catch(e) {}
    };

    window.saveAdminSubdestacada = async () => {
        const item = {
            id: "subdestacada-" + Date.now(),
            tag: document.getElementById('subdestacadaTag')?.value.trim() || 'AVANCE TECNOLÓGICO:',
            badge: document.getElementById('subdestacadaBadge')?.value.trim() || 'TECNOLOGÍA',
            badgeColor: 'bg-sky-600',
            title: document.getElementById('subdestacadaTitle')?.value.trim() || 'Nuevo Códec AV1 en Streaming',
            excerpt: document.getElementById('subdestacadaExcerpt')?.value.trim() || '',
            image: document.getElementById('subdestacadaImgUrl')?.value.trim() || 'assets/img/news5.jpg',
            category: 'HARDWARE & REDES',
            date: 'Actualizado Hoy',
            content: document.getElementById('subdestacadaExcerpt')?.value.trim() || ''
        };

        localStorage.setItem("cuycito_portal_subdestacada", JSON.stringify(item));
        alert("✅ Sub-destacada tecnológica guardada y actualizada en portada.");
    };

    // 3. GESTIÓN DE GRILLA TEMÁTICA
    window.renderAdminThematicGrid = () => {
        const container = document.getElementById('adminThematicGridList');
        if (!container) return;

        let list = [
            { id: "espn-disney", category: "DEPORTES", title: "Disney+ y ESPN Centralizan Todos los Torneos de Fútbol en Vivo", image: "assets/img/news6.jpg" },
            { id: "audio-hifi", category: "AUDIO", title: "Spotify vs Apple Music: ¿Vale la Pena Pagar por Audio Lossless?", image: "assets/img/news3.jpg" },
            { id: "cine-imax", category: "CINE", title: "Salas IMAX Desarrollan Nuevos Modos de Calibración para Smart TVs", image: "assets/img/news4.jpg" }
        ];

        try {
            const stored = localStorage.getItem("cuycito_portal_thematic");
            if (stored) list = JSON.parse(stored);
        } catch(e) {}

        container.innerHTML = list.map((item, idx) => `
            <div class="bg-black/60 border border-gray-800 p-3 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div class="flex items-center gap-3 min-w-0">
                    <img src="${item.image}" class="w-12 h-9 object-cover rounded-lg border border-gray-800 shrink-0">
                    <div class="truncate">
                        <span class="text-[10px] font-black text-orange-400 uppercase block">${item.category}</span>
                        <h5 class="font-bold text-white truncate">${item.title}</h5>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="window.editThematicItem(${idx})" class="bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px] font-bold p-2 rounded-lg transition" title="Editar">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button onclick="window.deleteThematicItem(${idx})" class="bg-red-950/60 hover:bg-red-800 text-red-400 text-[11px] font-bold p-2 rounded-lg transition" title="Restablecer">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    };

    window.deleteThematicItem = async (idx) => {
        if (!confirm("¿Deseas restablecer/eliminar este elemento temático?")) return;
        let list = [];
        try {
            list = JSON.parse(localStorage.getItem("cuycito_portal_thematic") || "[]");
        } catch(e) {}
        list.splice(idx, 1);
        localStorage.setItem("cuycito_portal_thematic", JSON.stringify(list));
        try {
            await setDoc(doc(db, "portal_config", "thematic"), { list }, { merge: true });
        } catch(e) {}
        window.renderAdminThematicGrid();
        alert("🗑️ Elemento temático actualizado.");
    };

    window.editThematicItem = async (idx) => {
        let list = [];
        try {
            list = JSON.parse(localStorage.getItem("cuycito_portal_thematic") || "[]");
        } catch(e) {}
        if (!list[idx]) return;

        const newTitle = prompt("Título para esta tarjeta temática:", list[idx].title);
        if (newTitle === null) return;
        const newImg = prompt("URL de Imagen:", list[idx].image);
        if (newImg === null) return;

        list[idx].title = newTitle.trim() || list[idx].title;
        list[idx].image = newImg.trim() || list[idx].image;
        localStorage.setItem("cuycito_portal_thematic", JSON.stringify(list));
        try {
            await setDoc(doc(db, "portal_config", "thematic"), { list }, { merge: true });
        } catch(e) {}
        window.renderAdminThematicGrid();
        alert("✅ Tarjeta temática actualizada.");
    };

    // 4. GESTIÓN DE RANKING "LO MÁS LEÍDO" (TOP 1 AL 5)
    window.renderAdminTop5 = () => {
        const container = document.getElementById('adminTop5List');
        if (!container) return;

        let list = [
            { id: "alzas-tarifas", rank: 1, title: "CRISIS DE TARIFAS EN PERÚ: Netflix actualiza cobros y planes 4K", tag: "Tendencia Nacional" },
            { id: "espn-disney", rank: 2, title: "Disney+ Premium: Qué incluye el plan con ESPN y 4 dispositivos", tag: "Guía de Suscripción" },
            { id: "max-platino-dolby", rank: 3, title: "Max Platino: Configuración de audio Dolby Atmos en Smart TVs", tag: "Tutorial Técnico" },
            { id: "crunchyroll-simulcast", rank: 4, title: "Crunchyroll Simulcast: Horarios de estreno de anime en Perú", tag: "Anime & Manga" },
            { id: "codec-av1", rank: 5, title: "Ahorro de Megas: El nuevo estándar de video para streaming móvil", tag: "Tecnología" }
        ];

        try {
            const stored = localStorage.getItem("cuycito_portal_top5");
            if (stored) list = JSON.parse(stored);
        } catch(e) {}

        container.innerHTML = list.map((item, idx) => `
            <div class="bg-black/60 border border-gray-800 p-2.5 rounded-xl flex items-center justify-between gap-2.5 text-xs">
                <span class="w-6 h-6 rounded-lg ${idx < 3 ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-400'} font-black text-xs flex items-center justify-center shrink-0">
                    ${idx + 1}
                </span>
                <input 
                    type="text" 
                    id="top5Title_${idx}" 
                    value="${item.title}" 
                    class="flex-1 bg-black border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:border-yellow-400"
                >
                <input 
                    type="text" 
                    id="top5Tag_${idx}" 
                    value="${item.tag || 'Tendencia'}" 
                    placeholder="Tag" 
                    class="w-24 bg-black border border-gray-700 rounded-lg px-2 py-1 text-[10px] text-gray-400"
                >
                <button onclick="window.deleteTop5Item(${idx})" class="bg-red-950/60 hover:bg-red-800 text-red-400 p-1.5 rounded-lg transition" title="Limpiar">
                    <i class="fa-solid fa-trash text-[10px]"></i>
                </button>
            </div>
        `).join('');
    };

    window.saveAdminTop5 = async () => {
        const updatedList = [];
        for (let i = 0; i < 5; i++) {
            const titleInput = document.getElementById(`top5Title_${i}`);
            const tagInput = document.getElementById(`top5Tag_${i}`);
            if (titleInput && titleInput.value.trim()) {
                updatedList.push({
                    id: "top5-" + i + "-" + Date.now(),
                    rank: i + 1,
                    title: titleInput.value.trim(),
                    tag: tagInput ? tagInput.value.trim() : 'Tendencia',
                    content: `<p class='text-sm text-gray-300'>${titleInput.value.trim()}</p>`
                });
            }
        }
        localStorage.setItem("cuycito_portal_top5", JSON.stringify(updatedList));
        try {
            await setDoc(doc(db, "portal_config", "top5"), { list: updatedList }, { merge: true });
        } catch(e) {}
        alert("✅ Ranking 'Lo Más Leído' guardado y sincronizado con la nube.");
    };

    window.deleteTop5Item = async (idx) => {
        let list = [];
        try {
            list = JSON.parse(localStorage.getItem("cuycito_portal_top5") || "[]");
        } catch(e) {}
        list.splice(idx, 1);
        list.forEach((t, i) => t.rank = i + 1);
        localStorage.setItem("cuycito_portal_top5", JSON.stringify(list));
        try {
            await setDoc(doc(db, "portal_config", "top5"), { list }, { merge: true });
        } catch(e) {}
        window.renderAdminTop5();
        alert("🗑️ Elemento removido de 'Lo Más Leído'.");
    };

    window.moveArticleUp = async (index) => {
        if (index <= 0) return;
        let newsList = [];
        try {
            const stored = localStorage.getItem("cuycito_portal_news");
            if (stored) newsList = JSON.parse(stored);
        } catch(e) {}

        const temp = newsList[index];
        newsList[index] = newsList[index - 1];
        newsList[index - 1] = temp;

        newsList.forEach((n, idx) => {
            n.isHero = (idx === 0);
        });

        localStorage.setItem("cuycito_portal_news", JSON.stringify(newsList));

        try {
            await setDoc(doc(db, "portal_settings", "news_articles"), {
                articles: newsList,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch(e) {}

        window.renderAdminNewsList();
    };

    window.moveArticleDown = async (index) => {
        let newsList = [];
        try {
            const stored = localStorage.getItem("cuycito_portal_news");
            if (stored) newsList = JSON.parse(stored);
        } catch(e) {}

        if (index >= newsList.length - 1) return;

        const temp = newsList[index];
        newsList[index] = newsList[index + 1];
        newsList[index + 1] = temp;

        newsList.forEach((n, idx) => {
            n.isHero = (idx === 0);
        });

        localStorage.setItem("cuycito_portal_news", JSON.stringify(newsList));

        try {
            await setDoc(doc(db, "portal_settings", "news_articles"), {
                articles: newsList,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch(e) {}

        window.renderAdminNewsList();
    };

    grid.innerHTML = newsList.map((item, index) => {
        const isFeatured = index < 3;
        let rankBadge = `<span class="bg-gray-800 text-gray-400 text-[9px] font-black px-2 py-0.5 rounded border border-gray-700">#${index + 1} Secundaria</span>`;
        let cardBorderClass = "border-gray-800 hover:border-orange-500/80";

        if (index === 0) {
            rankBadge = `<span class="bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-[10px] font-black px-2.5 py-0.5 rounded uppercase shadow-lg glow-gold animate-pulse flex items-center gap-1"><i class="fa-solid fa-crown"></i> #1 HERO PRINCIPAL</span>`;
            cardBorderClass = "border-2 border-cuycito-gold shadow-[0_0_15px_rgba(255,183,3,0.3)]";
        } else if (index === 1) {
            rankBadge = `<span class="bg-orange-950 text-orange-300 border border-orange-500/50 text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1">🥈 #2 Slide Portada</span>`;
            cardBorderClass = "border border-orange-500/50";
        } else if (index === 2) {
            rankBadge = `<span class="bg-blue-950 text-blue-300 border border-blue-500/50 text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1">🥉 #3 Slide Portada</span>`;
            cardBorderClass = "border border-blue-500/50";
        }

        return `
        <div 
            class="admin-news-card bg-[#101010] ${cardBorderClass} rounded-2xl overflow-hidden p-4 flex flex-col justify-between space-y-3 shadow-2xl transition duration-200 cursor-grab active:cursor-grabbing select-none relative"
            draggable="true"
            ondragstart="window.handleNewsDragStart(event, ${index})"
            ondragover="window.handleNewsDragOver(event)"
            ondragenter="window.handleNewsDragEnter(event, ${index})"
            ondragleave="window.handleNewsDragLeave(event)"
            ondrop="window.handleNewsDrop(event, ${index})"
            ondragend="window.handleNewsDragEnd(event)"
        >
            <div class="space-y-2.5">
                <div class="relative aspect-[16/9] w-full rounded-xl overflow-hidden bg-black border border-gray-800 group">
                    <img src="${item.image}" alt="${item.title}" style="object-position: ${item.imagePosition || 'center center'};" class="w-full h-full object-cover group-hover:scale-105 transition duration-300 pointer-events-none">
                    
                    <span class="absolute top-2 left-2 ${item.categoryColor || 'bg-red-600'} text-white text-[9px] font-black px-2.5 py-0.5 rounded uppercase shadow">
                        ${item.category}
                    </span>

                    <div class="absolute top-2 right-2 flex items-center gap-1">
                        ${rankBadge}
                    </div>

                    <!-- Indicador de Arrastre visual -->
                    <div class="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-gray-300 border border-gray-700 flex items-center gap-1 shadow">
                        <i class="fa-solid fa-grip-vertical text-cuycito-gold"></i> Arrastrar
                    </div>
                </div>

                <div class="space-y-1">
                    <div class="flex items-center justify-between text-[10px] text-gray-400 font-semibold">
                        <span><i class="fa-regular fa-clock text-cuycito-gold mr-1"></i> ${item.readTime}</span>
                        <span>${item.date}</span>
                    </div>
                    <h5 class="text-xs font-black text-white line-clamp-2 leading-snug">${item.title}</h5>
                    <p class="text-[11px] text-gray-400 line-clamp-2">${item.excerpt || ''}</p>
                </div>
            </div>

            <!-- CONTROLES DE SELECCIÓN Y DESTACADO -->
            <div class="space-y-2.5 pt-2.5 border-t border-gray-800">
                <!-- Casilla seleccionable de Destacado -->
                <div class="flex items-center justify-between bg-black/60 p-2 rounded-xl border border-gray-800">
                    <label class="flex items-center gap-2 text-[11px] font-bold text-gray-200 cursor-pointer">
                        <input 
                            type="checkbox" 
                            ${isFeatured ? 'checked' : ''} 
                            onchange="window.toggleFeaturedArticle('${item.id}', this.checked)"
                            class="accent-cuycito-gold w-4 h-4 cursor-pointer rounded"
                        >
                        <span class="${isFeatured ? 'text-cuycito-gold font-black' : 'text-gray-400'}">
                            ${isFeatured ? '🌟 Noticia Destacada (Portada)' : 'Desmarcada (Secundaria)'}
                        </span>
                    </label>

                    <!-- Botón Estrella para Fijar como HERO #1 Directamente -->
                    <button 
                        onclick="window.setHeroArticle('${item.id}')" 
                        class="text-[10px] font-black px-2 py-1 rounded-lg transition ${index === 0 ? 'bg-amber-500 text-black shadow glow-gold cursor-default' : 'bg-gray-900 hover:bg-amber-500/20 text-yellow-300 border border-yellow-500/40'}"
                        title="Fijar como Noticia Principal #1 de Portada"
                    >
                        <i class="fa-solid fa-crown"></i> ${index === 0 ? 'HERO #1' : 'Hacer #1'}
                    </button>
                </div>

                <!-- Botones de Reordenamiento Rápido ⬆️ ⬇️ y Editar -->
                <div class="flex items-center gap-1.5">
                    <button 
                        onclick="window.moveArticleUp(${index})" 
                        ${index === 0 ? 'disabled' : ''} 
                        class="bg-gray-900 hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-gray-900 text-gray-300 border border-gray-800 text-xs px-2.5 py-2 rounded-xl transition" 
                        title="Subir posición"
                    >
                        <i class="fa-solid fa-arrow-up"></i>
                    </button>

                    <button 
                        onclick="window.moveArticleDown(${index})" 
                        ${index === newsList.length - 1 ? 'disabled' : ''} 
                        class="bg-gray-900 hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-gray-900 text-gray-300 border border-gray-800 text-xs px-2.5 py-2 rounded-xl transition" 
                        title="Bajar posición"
                    >
                        <i class="fa-solid fa-arrow-down"></i>
                    </button>

                    <button onclick="window.openEditArticleModal('${item.id}')" class="flex-1 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black text-xs py-2 rounded-xl transition shadow flex items-center justify-center gap-1.5 glow-gold">
                        <i class="fa-solid fa-pen-to-square"></i> Editar Noticia
                    </button>
                    
                    <button onclick="window.quickDeleteAdminNewsArticle('${item.id}')" class="bg-red-950/60 hover:bg-red-800 text-red-300 hover:text-white border border-red-800/60 text-xs p-2 rounded-xl transition" title="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');
};

window.quickDeleteAdminNewsArticle = async (id) => {
    if (!confirm("¿Seguro que deseas eliminar esta noticia?")) return;
    let newsList = [];
    try {
        const stored = localStorage.getItem("cuycito_portal_news");
        if (stored) newsList = JSON.parse(stored);
    } catch(e) {}

    newsList = newsList.filter(n => n.id !== id);
    localStorage.setItem("cuycito_portal_news", JSON.stringify(newsList));

    try {
        await deleteDoc(doc(db, "portal_news", id));
    } catch(e) {}
    try {
        await setDoc(doc(db, "portal_settings", "news_articles"), {
            articles: newsList,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch(e) {}

    window.renderAdminNewsList();
    alert("🗑️ Noticia eliminada exitosamente.");
};

window.openNewArticleModal = () => {
    document.getElementById('newsEditId').value = "";
    document.getElementById('newsModalHeaderTitle').innerHTML = `<i class="fa-solid fa-plus"></i> Nueva Noticia de Portada`;
    document.getElementById('newsEditTitle').value = "";
    document.getElementById('newsEditCategory').value = "CINE & SERIES";
    document.getElementById('newsEditReadTime').value = "4 min de lectura";
    document.getElementById('newsEditDate').value = "Actualizado Hoy";
    document.getElementById('newsEditImage').value = "assets/img/news1.jpg";
    document.getElementById('newsEditExcerpt').value = "";
    document.getElementById('newsEditContent').value = "<p class='text-sm text-gray-300 leading-relaxed'>Contenido detallado de la noticia...</p>";
    document.getElementById('newsEditIsHero').checked = false;
    document.getElementById('btnDeleteNewsArticle').classList.add('hidden');
    window.updateAdminNewsImagePreview();
    document.getElementById('newsArticleEditModal').classList.remove('hidden');
};

window.openEditArticleModal = (newsId) => {
    let newsList = [];
    try {
        const stored = localStorage.getItem("cuycito_portal_news");
        if (stored) newsList = JSON.parse(stored);
    } catch(e) {}

    const item = newsList.find(n => n.id === newsId);
    if (!item) return;

    document.getElementById('newsEditId').value = item.id;
    document.getElementById('newsModalHeaderTitle').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Editar Noticia: ${item.title.substring(0, 25)}...`;
    document.getElementById('newsEditTitle').value = item.title;
    document.getElementById('newsEditCategory').value = item.category || "CINE & SERIES";
    document.getElementById('newsEditReadTime').value = item.readTime || "5 min de lectura";
    document.getElementById('newsEditDate').value = item.date || "Actualizado";
    document.getElementById('newsEditImage').value = item.image || "assets/img/news1.jpg";
    document.getElementById('newsEditExcerpt').value = item.excerpt || "";
    document.getElementById('newsEditContent').value = item.content || "";
    document.getElementById('newsEditIsHero').checked = !!item.isHero;
    document.getElementById('btnDeleteNewsArticle').classList.remove('hidden');
    window.updateAdminNewsImagePreview();
    document.getElementById('newsArticleEditModal').classList.remove('hidden');
};

window.updateAdminNewsImagePreview = () => {
    const url = document.getElementById('newsEditImage').value.trim() || 'assets/img/news1.jpg';
    const previewEl = document.getElementById('newsEditImagePreview');
    if (previewEl) previewEl.src = url;
};

window.saveAdminNewsArticle = async () => {
    const id = document.getElementById('newsEditId').value.trim() || ("news-" + Date.now());
    const title = document.getElementById('newsEditTitle').value.trim();
    const category = document.getElementById('newsEditCategory').value;
    const readTime = document.getElementById('newsEditReadTime').value.trim();
    const date = document.getElementById('newsEditDate').value.trim();
    const image = document.getElementById('newsEditImage').value.trim() || 'assets/img/news1.jpg';
    const excerpt = document.getElementById('newsEditExcerpt').value.trim();
    const content = document.getElementById('newsEditContent').value.trim();
    const isHero = document.getElementById('newsEditIsHero').checked;

    if (!title) {
        alert("Por favor ingresa un título para la noticia.");
        return;
    }

    let newsList = [];
    try {
        const stored = localStorage.getItem("cuycito_portal_news");
        if (stored) newsList = JSON.parse(stored);
    } catch(e) {}

    // Si este es hero, desmarcar los demás
    if (isHero) {
        newsList.forEach(n => n.isHero = false);
    }

    const categoryColors = {
        "ANÁLISIS DE MERCADO": "bg-red-600",
        "CINE & SERIES": "bg-cuycito-red",
        "ANIME & GAMING": "bg-orange-500",
        "AUDIO & HI-FI": "bg-emerald-600",
        "TECNOLOGÍA 4K": "bg-sky-600"
    };

    const newObj = {
        id,
        title,
        category,
        categoryColor: categoryColors[category] || "bg-orange-600",
        readTime,
        date,
        image,
        excerpt,
        content,
        isHero
    };

    const idx = newsList.findIndex(n => n.id === id);
    if (idx >= 0) {
        newsList[idx] = newObj;
    } else {
        newsList.unshift(newObj);
    }

    localStorage.setItem("cuycito_portal_news", JSON.stringify(newsList));

    // Enviar automáticamente la nueva noticia a "Lo Más Leído"
    try {
        let top5 = [];
        const storedTop = localStorage.getItem("cuycito_portal_top5");
        if (storedTop) top5 = JSON.parse(storedTop);

        top5 = top5.filter(t => t.id !== id && t.title !== title);
        top5.unshift({
            id,
            rank: 1,
            title,
            tag: category || "Tendencia",
            content: content || excerpt
        });
        if (top5.length > 5) top5 = top5.slice(0, 5);
        top5.forEach((t, i) => t.rank = i + 1);
        localStorage.setItem("cuycito_portal_top5", JSON.stringify(top5));
    } catch(e) {}

    // Guardar también en Firebase si está disponible
    try {
        await setDoc(doc(db, "portal_settings", "news_articles"), {
            articles: newsList,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch(e) {
        console.warn("Guardado local exitoso, sincronización remota:", e);
    }

    document.getElementById('newsArticleEditModal').classList.add('hidden');
    window.renderAdminNewsList();
    alert("✅ ¡Noticia guardada con éxito!");
};

window.deleteAdminNewsArticle = async () => {
    const id = document.getElementById('newsEditId').value;
    if (!id) return;
    if (!confirm("¿Seguro que deseas eliminar esta noticia?")) return;

    let newsList = [];
    try {
        const stored = localStorage.getItem("cuycito_portal_news");
        if (stored) newsList = JSON.parse(stored);
    } catch(e) {}

    newsList = newsList.filter(n => n.id !== id);
    localStorage.setItem("cuycito_portal_news", JSON.stringify(newsList));

    try {
        await setDoc(doc(db, "portal_settings", "news_articles"), {
            articles: newsList,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch(e) {}

    document.getElementById('newsArticleEditModal').classList.add('hidden');
    window.renderAdminNewsList();
    alert("🗑️ Noticia eliminada.");
};

// 2. Renderizado de Cartelera & Estrenos en Admin
window.renderAdminCarteleraList = () => {
    const grid = document.getElementById('adminCarteleraListGrid');
    if (!grid) return;

    let list = [];
    try {
        const stored = localStorage.getItem("cuycito_portal_cartelera");
        if (stored) list = JSON.parse(stored);
    } catch(e) {}

    if (!list || list.length === 0) {
        list = [
            { id: "cien-anos-soledad-2", title: "Cien Años de Soledad (Parte 2)", platform: "NETFLIX", type: "estrenos", tag: "Superproducción García Márquez", tagColor: "bg-red-600", rating: "9.8", releaseDate: "5 Ago (Final 26 Ago)", image: "assets/img/poster_ciensoledad.jpg", quality: "4K UHD • Dolby Atmos", synopsis: "Los siete nuevos episodios retoman la historia de los Buendía tras el armisticio." },
            { id: "jojo-steel-ball-run-title", title: "JoJo's Bizarre Adventure: Steel Ball Run", platform: "NETFLIX", type: "estrenos", tag: "Bombazo Anime 2nd STAGE", tagColor: "bg-purple-600", rating: "10.0", releaseDate: "Septiembre 2026", image: "assets/img/poster_jojo.jpg", quality: "4K HDR • David Production", synopsis: "Johnny Joestar y Gyro Zeppeli en la gran carrera continental." },
            { id: "mi-vida-chicos-walter-3", title: "Mi Vida con los Chicos Walter (T3)", platform: "NETFLIX", type: "estrenos", tag: "Drama Adolescente", tagColor: "bg-red-600", rating: "8.9", releaseDate: "6 de Agosto 2026", image: "assets/img/poster_walter.jpg", quality: "4K HDR", synopsis: "El regreso de Jackie Howard a Silver Falls tras su estancia en Nueva York." },
            { id: "muertos-sl-4", title: "Muertos S.L. (Temporada 4 Final)", platform: "NETFLIX", type: "estrenos", tag: "Comedia Funeraria", tagColor: "bg-purple-600", rating: "8.8", releaseDate: "7 de Agosto 2026", image: "assets/img/poster_walter.jpg", quality: "1080p HD", synopsis: "Temporada final de la disparatada Funeraria Torregrosa con Carlos Areces." },
            { id: "the-ribbon-hero", title: "The Ribbon Hero (La Princesa Caballero)", platform: "NETFLIX", type: "estrenos", tag: "Película Anime Twin Engine", tagColor: "bg-red-600", rating: "9.3", releaseDate: "8 de Agosto 2026", image: "assets/img/poster_ribbon.jpg", quality: "4K UHD", synopsis: "Inspirada en el clásico de Osamu Tezuka con animación de vanguardia." },
            { id: "pokemon-liga-indigo", title: "Pokémon: La Liga Índigo (Clásicos)", platform: "DISNEY", type: "cartelera", tag: "Clásico Nostalgia HD", tagColor: "bg-blue-600", rating: "9.7", releaseDate: "7 de Agosto 2026", image: "assets/img/poster1.jpg", quality: "Remasterizado HD", synopsis: "La primera temporada de Ash y Pikachu en Kanto con doblaje latino." },
            { id: "stranger-things", title: "Stranger Things 5: Temporada Final", platform: "NETFLIX", type: "ambos", tag: "Temporada Final", tagColor: "bg-red-600", rating: "9.5", releaseDate: "Diciembre 2026", image: "assets/img/poster3.jpg", quality: "4K UHD • Dolby Vision", synopsis: "La batalla final por Hawkins." },
            { id: "the-last-of-us-2", title: "The Last of Us: Temporada 2", platform: "MAX", type: "ambos", tag: "Serie Platino HBO", tagColor: "bg-purple-600", rating: "9.6", releaseDate: "Estreno Mundial 2026", image: "assets/img/poster4.jpg", quality: "4K Platino • Dolby Atmos", synopsis: "Joel y Ellie en las ruinas de Seattle." },
            { id: "demon-slayer-castillo", title: "Demon Slayer: El Castillo Infinito", platform: "CRUNCHYROLL", type: "ambos", tag: "Trilogía de Cine", tagColor: "bg-orange-600", rating: "9.9", releaseDate: "Simulcast 2026", image: "assets/img/poster2.jpg", quality: "1080p 60fps", synopsis: "Tanjiro y los Pilares entran al laberinto dimensional." },
            { id: "the-boys-5", title: "The Boys: Temporada 5 Final", platform: "PRIME", type: "ambos", tag: "Acción & Sátira", tagColor: "bg-amber-600", rating: "9.2", releaseDate: "Temporada Final 2026", image: "assets/img/poster5.jpg", quality: "4K HDR", synopsis: "La guerra entre Carnicero y Patriota." }
        ];
        localStorage.setItem("cuycito_portal_cartelera", JSON.stringify(list));
    }

    grid.innerHTML = list.map(item => `
        <div class="bg-[#101010] border border-gray-800 hover:border-cuycito-gold/80 rounded-2xl overflow-hidden p-3.5 flex flex-col justify-between space-y-3 shadow-2xl transition">
            <div class="space-y-2">
                <div class="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-black border border-gray-800">
                    <img src="${item.image}" alt="${item.title}" style="object-position: ${item.imagePosition || 'center center'};" class="w-full h-full object-cover">
                    <span class="absolute top-2 left-2 ${item.tagColor || 'bg-blue-600'} text-white text-[9px] font-black px-2 py-0.5 rounded uppercase shadow">
                        ${item.platform}
                    </span>
                    <span class="absolute bottom-2 right-2 bg-black/80 text-cuycito-gold text-[10px] font-black px-1.5 py-0.5 rounded border border-yellow-500/40">
                        ★ ${item.rating}
                    </span>
                </div>
                <div>
                    <h5 class="text-xs font-black text-white truncate">${item.title}</h5>
                    <span class="text-[10px] text-gray-400 block">${item.tag || item.platform} • <strong class="text-cuycito-gold uppercase">${item.type}</strong></span>
                </div>
            </div>

            <div class="space-y-2 pt-2 border-t border-gray-800">
                <div class="flex items-center justify-between text-[10px]">
                    <span class="text-emerald-400 font-bold">2:3 Proporción OK</span>
                    <span class="text-gray-500 font-mono">${item.releaseDate}</span>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="window.openEditCarteleraModal('${item.id}')" class="flex-1 bg-cuycito-gold hover:bg-cuycito-goldHover text-black font-black text-xs py-2 rounded-xl transition shadow flex items-center justify-center gap-1.5 glow-gold">
                        <i class="fa-solid fa-pen-to-square"></i> Editar Título
                    </button>
                    <button onclick="window.quickDeleteAdminCarteleraItem('${item.id}')" class="bg-red-950/60 hover:bg-red-800 text-red-300 hover:text-white border border-red-800/60 text-xs p-2 rounded-xl transition" title="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
};

window.quickDeleteAdminCarteleraItem = async (id) => {
    if (!confirm("¿Seguro que deseas eliminar este título de la cartelera?")) return;
    let list = [];
    try {
        const stored = localStorage.getItem("cuycito_portal_cartelera");
        if (stored) list = JSON.parse(stored);
    } catch(e) {}

    list = list.filter(c => c.id !== id);
    localStorage.setItem("cuycito_portal_cartelera", JSON.stringify(list));

    try {
        await deleteDoc(doc(db, "portal_cartelera", id));
    } catch(e) {}
    try {
        await setDoc(doc(db, "portal_settings", "cartelera_titles"), {
            titles: list,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch(e) {}

    window.renderAdminCarteleraList();
    alert("🗑️ Título eliminado de la cartelera.");
};

window.openNewCarteleraModal = () => {
    document.getElementById('carteleraEditId').value = "";
    document.getElementById('carteleraModalHeaderTitle').innerHTML = `<i class="fa-solid fa-plus"></i> Nuevo Título de Cartelera & Estrenos`;
    document.getElementById('carteleraEditTitle').value = "";
    document.getElementById('carteleraEditPlatform').value = "NETFLIX";
    document.getElementById('carteleraEditType').value = "ambos";
    document.getElementById('carteleraEditTag').value = "Estreno Global";
    document.getElementById('carteleraEditRating').value = "9.0";
    document.getElementById('carteleraEditReleaseDate').value = "2026";
    document.getElementById('carteleraEditQuality').value = "4K UHD • Dolby Atmos";
    document.getElementById('carteleraEditImage').value = "assets/img/poster3.jpg";
    document.getElementById('carteleraEditDirector').value = "";
    document.getElementById('carteleraEditCast').value = "";
    document.getElementById('carteleraEditSynopsis').value = "";
    document.getElementById('btnDeleteCarteleraItem').classList.add('hidden');
    window.updateAdminCarteleraImagePreview();
    document.getElementById('carteleraItemEditModal').classList.remove('hidden');
};

window.openEditCarteleraModal = (carteleraId) => {
    let list = [];
    try {
        const stored = localStorage.getItem("cuycito_portal_cartelera");
        if (stored) list = JSON.parse(stored);
    } catch(e) {}

    const item = list.find(c => c.id === carteleraId);
    if (!item) return;

    document.getElementById('carteleraEditId').value = item.id;
    document.getElementById('carteleraModalHeaderTitle').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Editar: ${item.title}`;
    document.getElementById('carteleraEditTitle').value = item.title;
    document.getElementById('carteleraEditPlatform').value = item.platform || "NETFLIX";
    document.getElementById('carteleraEditType').value = item.type || "ambos";
    document.getElementById('carteleraEditTag').value = item.tag || "";
    document.getElementById('carteleraEditRating').value = item.rating || "9.0";
    document.getElementById('carteleraEditReleaseDate').value = item.releaseDate || "";
    document.getElementById('carteleraEditQuality').value = item.quality || "4K UHD";
    document.getElementById('carteleraEditImage').value = item.image || "assets/img/poster3.jpg";
    document.getElementById('carteleraEditDirector').value = item.director || "";
    document.getElementById('carteleraEditCast').value = item.cast || "";
    document.getElementById('carteleraEditSynopsis').value = item.synopsis || "";
    document.getElementById('btnDeleteCarteleraItem').classList.remove('hidden');
    window.updateAdminCarteleraImagePreview();
    document.getElementById('carteleraItemEditModal').classList.remove('hidden');
};

window.updateAdminCarteleraImagePreview = () => {
    const url = document.getElementById('carteleraEditImage').value.trim() || 'assets/img/poster3.jpg';
    const previewEl = document.getElementById('carteleraEditImagePreview');
    if (previewEl) previewEl.src = url;
};

window.saveAdminCarteleraItem = async () => {
    const id = document.getElementById('carteleraEditId').value.trim() || ("title-" + Date.now());
    const title = document.getElementById('carteleraEditTitle').value.trim();
    const platform = document.getElementById('carteleraEditPlatform').value;
    const type = document.getElementById('carteleraEditType').value;
    const tag = document.getElementById('carteleraEditTag').value.trim();
    const rating = document.getElementById('carteleraEditRating').value.trim() || "9.0";
    const releaseDate = document.getElementById('carteleraEditReleaseDate').value.trim() || "2026";
    const quality = document.getElementById('carteleraEditQuality').value.trim() || "4K UHD";
    const image = document.getElementById('carteleraEditImage').value.trim() || 'assets/img/poster3.jpg';
    const director = document.getElementById('carteleraEditDirector').value.trim();
    const cast = document.getElementById('carteleraEditCast').value.trim();
    const synopsis = document.getElementById('carteleraEditSynopsis').value.trim();

    if (!title) {
        alert("Por favor ingresa un título para la serie o película.");
        return;
    }

    const platformColors = {
        "NETFLIX": "bg-red-600",
        "MAX": "bg-purple-600",
        "DISNEY": "bg-blue-600",
        "PRIME": "bg-amber-600",
        "CRUNCHYROLL": "bg-orange-600",
        "APPLE": "bg-sky-600"
    };

    const newObj = {
        id,
        title,
        platform,
        type,
        tag: tag || platform,
        tagColor: platformColors[platform] || "bg-cuycito-gold",
        rating,
        releaseDate,
        quality,
        image,
        director,
        cast,
        synopsis
    };

    let list = [];
    try {
        const stored = localStorage.getItem("cuycito_portal_cartelera");
        if (stored) list = JSON.parse(stored);
    } catch(e) {}

    const idx = list.findIndex(c => c.id === id);
    if (idx >= 0) {
        list[idx] = newObj;
    } else {
        list.push(newObj);
    }

    localStorage.setItem("cuycito_portal_cartelera", JSON.stringify(list));

    try {
        await setDoc(doc(db, "portal_settings", "cartelera_titles"), {
            titles: list,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch(e) {}

    document.getElementById('carteleraItemEditModal').classList.add('hidden');
    window.renderAdminCarteleraList();
    alert("✅ ¡Título de Cartelera / Estreno guardado con éxito!");
};

window.deleteAdminCarteleraItem = async () => {
    const id = document.getElementById('carteleraEditId').value;
    if (!id) return;
    if (!confirm("¿Seguro que deseas eliminar este título de la cartelera?")) return;

    let list = [];
    try {
        const stored = localStorage.getItem("cuycito_portal_cartelera");
        if (stored) list = JSON.parse(stored);
    } catch(e) {}

    list = list.filter(c => c.id !== id);
    localStorage.setItem("cuycito_portal_cartelera", JSON.stringify(list));

    try {
        await setDoc(doc(db, "portal_settings", "cartelera_titles"), {
            titles: list,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch(e) {}

    document.getElementById('carteleraItemEditModal').classList.add('hidden');
    window.renderAdminCarteleraList();
    alert("🗑️ Título eliminado.");
};

// ==========================================
// CONTROL RESPONSIVE PARA MÓVIL (DASHBOARD)
// ==========================================
window.toggleMobileSidebar = (forceOpen) => {
    const sidebar = document.getElementById('dashboardSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar) return;

    const isCurrentlyClosed = sidebar.classList.contains('-translate-x-full');
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : isCurrentlyClosed;

    if (shouldOpen) {
        sidebar.classList.remove('-translate-x-full');
        if (backdrop) backdrop.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        if (backdrop) backdrop.classList.add('hidden');
    }
};

window.toggleMobileAlertsSidebar = (forceOpen) => {
    const sidebar = document.getElementById('alertsSidebar');
    const backdrop = document.getElementById('alertsBackdrop');
    if (!sidebar) return;

    const isCurrentlyClosed = sidebar.classList.contains('translate-x-full');
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : isCurrentlyClosed;

    if (shouldOpen) {
        sidebar.classList.remove('translate-x-full');
        if (backdrop) backdrop.classList.remove('hidden');
    } else {
        sidebar.classList.add('translate-x-full');
        if (backdrop) backdrop.classList.add('hidden');
    }
};

window.toggleMobileUtilsModal = (forceOpen) => {
    const modal = document.getElementById('mobileUtilsModal');
    if (!modal) return;
    if (typeof forceOpen === 'boolean') {
        if (forceOpen) modal.classList.remove('hidden');
        else modal.classList.add('hidden');
    } else {
        modal.classList.toggle('hidden');
    }
};