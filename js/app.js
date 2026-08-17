import { auth, db, storage, onAuthStateChanged, signOut, collection, getDocs, getDoc, doc, setDoc, deleteDoc, ref, uploadBytes, getDownloadURL } from "./firebase-config.js";

const DEFAULT_SERVICES = ["Netflix", "Spotify", "HBO Max", "Disney+", "Crunchyroll", "Prime Video"];
const CENTRAL_WHATSAPP_PHONE = "51991735344";

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

if (typeof Chart !== 'undefined') { Chart.defaults.color = '#9ca3af'; }

// =====================================
// 1. INICIALIZACIÓN Y AUTENTICACIÓN ADMIN
// =====================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const subSnap = await getDocs(collection(db, "subscriptions"));
            appState.subscriptions = []; 
            subSnap.forEach(d => appState.subscriptions.push(d.data()));

            const histSnap = await getDocs(collection(db, "history"));
            appState.history = []; 
            histSnap.forEach(d => appState.history.push(d.data()));

            const masterSnap = await getDocs(collection(db, "masterAccounts"));
            appState.masterAccounts = []; 
            masterSnap.forEach(d => appState.masterAccounts.push(d.data()));

            const servSnap = await getDocs(collection(db, "services"));
            let cloudServices = []; 
            servSnap.forEach(d => cloudServices.push(d.data().name));
            
            const clientSnap = await getDocs(collection(db, "users"));
            appState.clients = []; 
            clientSnap.forEach(d => {
                const data = d.data();
                if (!data.nickname) data.nickname = data.name || 'Cliente';
                appState.clients.push(data);
            });

            const catalogSnap = await getDocs(collection(db, "store_catalog"));
            appState.catalog = []; 
            catalogSnap.forEach(d => appState.catalog.push(d.data()));

            const postitSnap = await getDocs(collection(db, "postits"));
            appState.postits = [];
            postitSnap.forEach(d => appState.postits.push({ id: d.id, ...d.data() }));

            const recSnap = await getDocs(collection(db, "recharge_orders"));
            appState.recharges = [];
            recSnap.forEach(d => appState.recharges.push({ id: d.id, ...d.data() }));

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
        } catch (error) {
            console.error("Error leyendo DB:", error);
            document.getElementById('dbStatus').innerHTML = '<span class="text-red-500">Error Cloud</span>';
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

window.getDaysRemaining = (endDateStr) => {
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.ceil((new Date(endDateStr) - today) / 86400000);
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
    const msg = window.getDaysRemaining(sub.endDate) >= 0 ? `¡Hola! 🐹👋 Tu suscripción de ${sub.service} vence el ${sub.endDate}. ¿Deseas renovar?` : `¡Hola! 🐹⚠️ Tu cuenta de ${sub.service} ha vencido. Escríbenos para reactivar.`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
};

window.triggerInfo = (subId) => {
    const sub = appState.subscriptions.find(s => s.id === subId);
    if (!sub) return;
    let msg = `✨ *CUENTA ACTIVADA* ✨\n\n🎬 *Servicio:* ${sub.service}\n👤 *Perfil:* ${sub.person}\n📧 *Correo:* ${sub.email}\n🔐 *Pass:* ${sub.pass}\n🔢 *PIN:* ${sub.pin}\n📆 *Vence:* ${sub.endDate}`;
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
    ['subs', 'master', 'finance', 'clients', 'catalog', 'recharges', 'games'].forEach(id => {
        const view = document.getElementById('view-' + id);
        const btn = document.getElementById('tab-btn-' + id);
        if(view) {
            view.classList.add('hidden');
            if(id === tabId) {
                view.classList.remove('hidden');
                if(id==='subs') view.classList.add('block');
                if(id==='master' || id==='finance' || id==='clients' || id==='catalog' || id==='recharges' || id==='games') view.className = view.className.replace('hidden', 'block space-y-4');
            }
        }
        if(btn) {
            btn.className = (id === tabId) 
                ? "text-cuycito-gold border-b-2 border-cuycito-gold pb-2 font-black uppercase tracking-wider text-sm transition flex items-center gap-1.5" 
                : "text-gray-500 hover:text-white border-b-2 border-transparent pb-2 font-black uppercase tracking-wider text-sm transition flex items-center gap-1.5";
        }
    });
    if(tabId === 'finance') window.renderFinance();
    if(tabId === 'recharges') {
        window.renderRechargesTable();
        window.loadPaymentQRSettings();
        window.loadRouletteHouseStats();
    }
    if(tabId === 'games') {
        window.renderGamesSection();
    }
};

window.updateAllServiceDropdowns = () => {
    const ids = ['txService', 'bulkService', 'mService', 'editService', 'csmNewService'];
    ids.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Seleccionar Servicio --</option>';
        appState.services.forEach(serv => { select.innerHTML += `<option value="${serv}">${serv}</option>`; });
        if (id !== 'csmNewService') {
            select.innerHTML += '<option value="__NEW__" class="text-cuycito-gold font-bold">➕ Agregar Nuevo Servicio...</option>';
        }
        if (currentVal && currentVal !== '__NEW__' && [...select.options].some(o => o.value === currentVal)) { select.value = currentVal; }
    });

    const filterSelect = document.getElementById('filterActiveService');
    if (filterSelect) {
        const currentFilter = filterSelect.value;
        filterSelect.innerHTML = '<option value="">Todos los Servicios</option>';
        appState.services.forEach(serv => { filterSelect.innerHTML += `<option value="${serv}">${serv}</option>`; });
        filterSelect.value = currentFilter;
    }
};

window.handleServiceSelectChange = (selectId, customInputId) => {
    const select = document.getElementById(selectId);
    const customInput = document.getElementById(customInputId);
    if (!select || !customInput) return;
    if (select.value === '__NEW__') { customInput.classList.remove('hidden'); customInput.focus(); } 
    else { customInput.classList.add('hidden'); customInput.value = ''; }
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
    const end = new Date(new Date(startInput.value).getTime() + (months * 30 * 86400000));
    const endDateInput = document.getElementById('endDate');
    if(endDateInput) endDateInput.value = end.toISOString().split('T')[0];
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

    const newSub = { id, type, person, service, email, pass, pin, hidePassword, showCredentials, amount, currency, startDate, endDate, months };
    appState.subscriptions.push(newSub);

    const txId = 'tx_cuy_' + Date.now();
    const newTx = { id: txId, date: startDate, type, person, service, amount, currency };
    appState.history.push(newTx);

    try {
        await setDoc(doc(db, "subscriptions", id), newSub);
        await setDoc(doc(db, "history", txId), newTx);
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
    const sub = appState.subscriptions.find(s => s.id === subId);
    if(!sub) return;
    document.getElementById('editSubId').value = sub.id;
    document.getElementById('editPerson').value = sub.person;
    document.getElementById('editService').value = sub.service;
    document.getElementById('editEmail').value = sub.email || '';
    document.getElementById('editPass').value = sub.pass || '';
    document.getElementById('editPin').value = sub.pin || '';
    document.getElementById('editHidePass').checked = !!sub.hidePassword;
    document.getElementById('editAmount').value = sub.amount;
    document.getElementById('editCurrency').value = sub.currency;
    document.getElementById('editEndDate').value = sub.endDate;
    document.getElementById('editModal').classList.remove('hidden');
};

window.saveEditModal = async () => {
    const id = document.getElementById('editSubId').value;
    const sub = appState.subscriptions.find(s => s.id === id);
    if(!sub) return;

    sub.person = document.getElementById('editPerson').value.trim();
    sub.service = document.getElementById('editService').value;
    sub.email = document.getElementById('editEmail').value.trim();
    sub.pass = document.getElementById('editPass').value.trim();
    sub.pin = document.getElementById('editPin').value.trim();
    sub.hidePassword = document.getElementById('editHidePass').checked;
    sub.showCredentials = !sub.hidePassword;
    sub.amount = parseFloat(document.getElementById('editAmount').value) || 0;
    sub.currency = document.getElementById('editCurrency').value;
    sub.endDate = document.getElementById('editEndDate').value;

    try { await setDoc(doc(db, "subscriptions", id), sub); } catch(e){}
    document.getElementById('editModal').classList.add('hidden');
    window.renderAll();
};

window.deleteSubscription = async () => {
    const id = document.getElementById('editSubId').value;
    if(confirm("¿Eliminar esta suscripción permanentemente?")) {
        appState.subscriptions = appState.subscriptions.filter(s => s.id !== id);
        try { await deleteDoc(doc(db, "subscriptions", id)); } catch(e){}
        document.getElementById('editModal').classList.add('hidden');
        window.renderAll();
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
    const todayStr = new Date().toISOString().split('T')[0];
    const endStr = new Date(Date.now() + (30 * 86400000)).toISOString().split('T')[0];

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
window.saveMasterAccount = async () => {
    const service = await window.getOrRegisterService('mService', 'mServiceCustom');
    if (!service) return;
    const id = 'master_' + Date.now();
    const provider = document.getElementById('mProvider').value.trim();
    const capacity = parseInt(document.getElementById('mCapacity').value) || 5;
    const cost = parseFloat(document.getElementById('mCost').value) || 0;
    const currency = document.getElementById('mCurrency').value;
    const startDate = document.getElementById('mStartDate').value;
    const months = parseInt(document.getElementById('mMonths').value) || 1;
    const email = document.getElementById('mEmail').value.trim();
    const pass = document.getElementById('mPass').value.trim();
    const hidePasswordFromClient = document.getElementById('mHidePass').checked;
    const showCredentialsToClient = !hidePasswordFromClient;
    const end = new Date(new Date(startDate).getTime() + (months * 30 * 86400000)).toISOString().split('T')[0];

    const newAcc = { id, service, provider, capacity, cost, currency, startDate, endDate: end, email, pass, hidePasswordFromClient, showCredentialsToClient, profiles: new Array(capacity).fill(null) };
    appState.masterAccounts.push(newAcc);

    const txId = 'tx_mas_' + Date.now();
    const newTx = { id: txId, date: startDate, type: 'COMPRA', person: provider || 'Proveedor', service, amount: cost, currency };
    appState.history.push(newTx);

    try {
        await setDoc(doc(db, "masterAccounts", id), newAcc);
        await setDoc(doc(db, "history", txId), newTx);
    } catch(e){}

    document.getElementById('masterModal').classList.add('hidden');
    window.renderAll();
};

window.toggleMasterCredentialsVisibility = async (accId) => {
    const acc = appState.masterAccounts.find(a => a.id === accId);
    if (!acc) return;

    acc.showCredentialsToClient = !acc.showCredentialsToClient;
    acc.hidePasswordFromClient = !acc.showCredentialsToClient;

    if (acc.profiles) {
        acc.profiles.forEach(async (subId) => {
            if (subId) {
                const sub = appState.subscriptions.find(s => s.id === subId);
                if (sub) {
                    sub.hidePassword = acc.hidePasswordFromClient;
                    sub.showCredentials = acc.showCredentialsToClient;
                    try { await setDoc(doc(db, "subscriptions", sub.id), sub); } catch(e){}
                }
            }
        });
    }

    try {
        await setDoc(doc(db, "masterAccounts", acc.id), acc);
    } catch(e) { console.error(e); }

    window.renderMasterAccounts();
    window.renderActiveTable();
};
window.toggleMasterPasswordVisibility = window.toggleMasterCredentialsVisibility;

window.openEditMasterModal = (accId) => {
    const acc = appState.masterAccounts.find(a => a.id === accId);
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
    const acc = appState.masterAccounts.find(a => a.id === id);
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

    if (acc.profiles) {
        acc.profiles.forEach(async (subId) => {
            if (subId) {
                const sub = appState.subscriptions.find(s => s.id === subId);
                if (sub) {
                    sub.email = acc.email;
                    sub.pass = acc.pass;
                    sub.hidePassword = acc.hidePasswordFromClient;
                    sub.showCredentials = acc.showCredentialsToClient;
                    try { await setDoc(doc(db, "subscriptions", sub.id), sub); } catch(e){}
                }
            }
        });
    }

    try { await setDoc(doc(db, "masterAccounts", id), acc); } catch(e){}
    document.getElementById('editMasterModal').classList.add('hidden');
    window.renderAll();
};

window.deleteMasterAccount = async (accId) => {
    if(confirm("¿Eliminar Cuenta Raíz?")) {
        appState.masterAccounts = appState.masterAccounts.filter(a => a.id !== accId);
        try { await deleteDoc(doc(db, "masterAccounts", accId)); } catch(e){}
        window.renderAll();
    }
};

window.openAssignModal = (accId, slotIndex) => {
    currentTargetAcc = accId;
    currentTargetSlot = slotIndex;
    const acc = appState.masterAccounts.find(a => a.id === accId);
    if (!acc) return;
    document.getElementById('assignServiceLabel').innerText = `${acc.service} (Cupo #${slotIndex + 1})`;
    
    const list = document.getElementById('assignList');
    list.innerHTML = '';

    const matchingSubs = appState.subscriptions.filter(s => s.service === acc.service && s.type === 'VENTA');
    if (matchingSubs.length === 0) {
        list.innerHTML = `<p class="text-xs text-gray-500 italic p-3 text-center">No hay clientes con suscripciones de ${acc.service}.</p>`;
    } else {
        matchingSubs.forEach(sub => {
            list.innerHTML += `
            <div class="flex justify-between items-center bg-gray-900 border border-gray-700 p-2.5 rounded hover:border-cuycito-gold transition">
                <div>
                    <p class="text-xs font-bold text-white">${sub.person}</p>
                    <p class="text-[10px] text-gray-400 font-mono">PIN: ${sub.pin || '-'} | Vence: ${sub.endDate}</p>
                </div>
                <button onclick="window.confirmAssignSlot('${sub.id}')" class="bg-cuycito-gold text-black font-black text-xs px-3 py-1.5 rounded hover:bg-yellow-400">Asignar</button>
            </div>`;
        });
    }
    document.getElementById('assignModal').classList.remove('hidden');
};

window.confirmAssignSlot = async (subId) => {
    const acc = appState.masterAccounts.find(a => a.id === currentTargetAcc);
    const sub = appState.subscriptions.find(s => s.id === subId);
    if (!acc || !sub) return;

    acc.profiles[currentTargetSlot] = sub.id;
    sub.email = acc.email;
    sub.pass = acc.pass;
    sub.hidePassword = !!acc.hidePasswordFromClient;
    sub.showCredentials = !!acc.showCredentialsToClient;

    try {
        await setDoc(doc(db, "masterAccounts", acc.id), acc);
        await setDoc(doc(db, "subscriptions", sub.id), sub);
    } catch(e){}

    document.getElementById('assignModal').classList.add('hidden');
    window.renderAll();
};

window.unlinkProfile = async (accId, slotIndex) => {
    const acc = appState.masterAccounts.find(a => a.id === accId);
    if (!acc) return;
    acc.profiles[slotIndex] = null;
    try { await setDoc(doc(db, "masterAccounts", acc.id), acc); } catch(e){}
    window.renderAll();
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
    const defaultNickname = personName; // Por defecto el Nickname es igual al Nombre
    const id = 'user_' + Date.now();

    const newClient = {
        id,
        name: personName,
        nickname: defaultNickname,
        phone: randomPhone,
        pass: randomPass,
        email: ''
    };

    appState.clients.push(newClient);

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
    const banner = document.getElementById('newAccessGeneratedBanner');
    if (banner) banner.classList.add('hidden');

    const dataList = document.getElementById('clientNamesList');
    dataList.innerHTML = '';
    const uniqueNames = [...new Set(appState.subscriptions.map(s => s.person))].filter(Boolean);
    uniqueNames.forEach(name => { dataList.innerHTML += `<option value="${name}">`; });

    if(!clientId) {
        document.getElementById('cId').value = 'user_' + Date.now();
        document.getElementById('cName').value = '';
        document.getElementById('cNickname').value = '';
        document.getElementById('cPhone').value = '';
        document.getElementById('cEmail').value = '';
        document.getElementById('cPass').value = Math.random().toString(36).slice(-8);
        window.switchClientModalTab('pending');
    } else {
        const c = appState.clients.find(x => x.id === clientId);
        document.getElementById('cId').value = c.id;
        document.getElementById('cName').value = c.name;
        document.getElementById('cNickname').value = c.nickname || c.name;
        document.getElementById('cPhone').value = c.phone;
        document.getElementById('cEmail').value = c.email || '';
        document.getElementById('cPass').value = c.pass;
        window.switchClientModalTab('manual');
    }
    document.getElementById('clientModal').classList.remove('hidden');
};

window.saveClient = async () => {
    const id = document.getElementById('cId').value;
    const name = document.getElementById('cName').value.trim();
    const nickname = document.getElementById('cNickname').value.trim() || name;
    const phone = document.getElementById('cPhone').value.trim();
    const email = document.getElementById('cEmail').value.trim();
    const pass = document.getElementById('cPass').value.trim();

    if(!name || !phone || !pass) return alert("Nombre, Número y Contraseña son obligatorios.");

    const existing = appState.clients.find(c => c.phone === phone && c.id !== id);
    if (existing) return alert("Este número ya está registrado como acceso de otro cliente.");

    const newClient = { id, name, nickname, email, pass, phone };
    const index = appState.clients.findIndex(c => c.id === id);
    if(index > -1) appState.clients[index] = newClient;
    else appState.clients.push(newClient);

    try {
        await setDoc(doc(db, "users", id), newClient);
        document.getElementById('clientModal').classList.add('hidden');
        window.renderClients();
    } catch(e) { alert("Error guardando cliente."); }
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
    const linked = appState.subscriptions.filter(s => s.person && s.person.trim().toLowerCase() === clientNameNorm);

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
        const isNotSame = !s.person || s.person.trim().toLowerCase() !== clientNameNorm;
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
    const sub = appState.subscriptions.find(s => s.id === subId);
    if (!sub) return;

    if (confirm(`¿Desvincular "${sub.service}" de ${activeManagingClient.name}? El servicio pasará a estado "Sin Asignar" para que puedas reasignarlo a otro cliente.`)) {
        sub.person = 'Sin Asignar';
        try {
            await setDoc(doc(db, "subscriptions", sub.id), sub);
            window.renderCsmLinkedList();
            window.renderCsmAvailableSubs();
            window.renderClients();
            window.renderActiveTable();
        } catch(e) {
            alert("Error al desvincular servicio.");
        }
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

    try {
        await setDoc(doc(db, "subscriptions", sub.id), sub);
        alert(`✅ ¡Servicio "${sub.service}" vinculado exitosamente a ${activeManagingClient.name}!`);
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
        person: activeManagingClient.name,
        service: service,
        email: email,
        pass: pass,
        pin: pin,
        hidePassword,
        showCredentials,
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
        document.getElementById('catColor').value = 'red-600';
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
        document.getElementById('catColor').value = p.colorClass || 'red-600';
        document.getElementById('catPromo').checked = p.promo || false;
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

    const newItem = { id, title, category, description: desc, price, stock, linkedMasterId, linkedService, colorClass: color, promo, imageUrl, isCombo: false };

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

window.renderActiveTable = () => {
    const tbody = document.getElementById('activeTableBody'); if(!tbody) return;
    tbody.innerHTML = '';
    const search = document.getElementById('searchActive') ? document.getElementById('searchActive').value.toLowerCase() : '';
    const serviceFilter = document.getElementById('filterActiveService') ? document.getElementById('filterActiveService').value : '';
    const statusFilter = document.getElementById('filterActiveStatus') ? document.getElementById('filterActiveStatus').value : 'VIGENTE';

    const filteredSubs = appState.subscriptions.filter(sub => {
        const isVigente = window.getDaysRemaining(sub.endDate) >= 0;
        const matchSearch = (sub.person || '').toLowerCase().includes(search) || (sub.service || '').toLowerCase().includes(search);
        const matchService = !serviceFilter || sub.service === serviceFilter;
        let matchStatus = true;
        if (statusFilter === 'VIGENTE') matchStatus = isVigente;
        if (statusFilter === 'VENCIDO') matchStatus = !isVigente;
        return matchSearch && matchService && matchStatus;
    });

    const badge = document.getElementById('activeCountBadge');
    if(badge) badge.innerText = filteredSubs.length;

    filteredSubs.forEach(sub => {
        const days = window.getDaysRemaining(sub.endDate);
        const badgeColor = days < 0 ? 'bg-cuycito-red/20 text-red-400 border-cuycito-red/50' : (days <= 3 ? 'bg-cuycito-gold/20 text-cuycito-gold border-cuycito-gold/50' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30');
        const rowStyle = days < 0 ? 'bg-cuycito-red/5 hover:bg-cuycito-red/10 transition' : 'hover:bg-gray-800 transition';
        const typeBadge = sub.type === 'VENTA' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400';
        const hidePassBadge = sub.hidePassword 
            ? `<span class="bg-red-950/80 text-red-400 border border-cuycito-red/40 px-1.5 py-0.5 rounded text-[9px] font-bold">🔒 Clave Oculta</span>` 
            : `<span class="bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[9px] font-bold">👁️ Clave Visible</span>`;

        tbody.innerHTML += `
            <tr class="${rowStyle}">
                <td class="p-4"><span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${typeBadge}">${sub.type}</span><div class="font-bold text-white mt-1.5">${sub.person}</div></td>
                <td class="p-4 font-bold text-gray-300">${sub.service}</td>
                <td class="p-4 font-mono text-[11px] bg-black/20 rounded-lg">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-white">${sub.email || '<span class="text-gray-600 italic">Sin asignar</span>'}</span>
                        ${hidePassBadge}
                    </div>
                    <div class="text-cuycito-gold mt-1">Pass: ${sub.pass || '-'} | PIN: ${sub.pin || '-'}</div>
                </td>
                <td class="p-4 font-mono text-gray-400 text-xs">${sub.endDate}</td>
                <td class="p-4"><span class="border px-2.5 py-1 rounded text-[11px] font-black ${badgeColor}">${days < 0 ? 'Expiró' : days + ' d'}</span></td>
                <td class="p-4 text-center"><div class="flex items-center justify-center gap-1 bg-black p-1 rounded-lg border border-gray-800"><input type="number" id="renew_${sub.id}" value="1" min="1" class="w-10 bg-transparent text-center text-cuycito-gold font-bold outline-none"><button onclick="window.renewSubscription('${sub.id}', 'renew_${sub.id}')" class="bg-cuycito-gold hover:bg-cuycito-gold_light text-black px-2 py-1 rounded font-black transition"><i class="fa-solid fa-rotate-right"></i></button></div></td>
                <td class="p-4 text-center"><div class="flex items-center justify-center gap-2"><button onclick="window.triggerWhatsApp('${sub.id}')" class="bg-[#25D366] text-black p-2 rounded transition"><i class="fa-brands fa-whatsapp text-sm"></i></button><button onclick="window.triggerInfo('${sub.id}')" class="bg-[#0ea5e9] text-black p-2 rounded transition"><i class="fa-solid fa-circle-info text-sm"></i></button><button onclick="window.openEditModal('${sub.id}')" class="bg-gray-700 text-white p-2 rounded transition"><i class="fa-solid fa-pen text-sm"></i></button></div></td>
            </tr>`;
    });
};

window.renderMasterAccounts = () => {
    const grid = document.getElementById('masterGrid'); if(!grid) return;
    grid.innerHTML = '';
    
    appState.masterAccounts.forEach(acc => {
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
                    <h4 class="font-black text-white text-sm uppercase">${acc.service}</h4>
                    <p class="text-[10px] text-cuycito-gold font-mono">${acc.email}</p>
                </div>
                <div class="flex flex-col items-end gap-1">
                    <div class="text-center border px-2 py-0.5 rounded ${occColor} bg-black text-[10px] font-black tracking-widest">${occupied}/${acc.capacity} Lleno (${freeSlots} libres)</div>
                    <span class="text-[9px] text-gray-500">Vence: ${acc.endDate || 'N/A'}</span>
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
                            <p class="text-[10px] ${dColor} font-mono">Vence: ${sub.endDate} | Cobra: ${subSym}${sub.amount}</p>
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

window.renderClients = () => {
    const tbody = document.getElementById('clientsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const search = (document.getElementById('searchClientsInput')?.value || '').toLowerCase().trim();
    
    const filteredClients = appState.clients.filter(c => {
        const cName = (c.name || '').toLowerCase();
        const cNick = (c.nickname || '').toLowerCase();
        const cPhone = (c.phone || '').toLowerCase();
        
        const hasMatchingService = appState.subscriptions.some(s => 
            s.person && s.person.trim().toLowerCase() === cName && 
            (s.service || '').toLowerCase().includes(search)
        );

        return cName.includes(search) || cNick.includes(search) || cPhone.includes(search) || hasMatchingService;
    });

    const badge = document.getElementById('clientsCountBadge');
    if(badge) badge.innerText = `${filteredClients.length} Clientes`;

    if (filteredClients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-500 italic">No se encontraron accesos de clientes.</td></tr>`;
        return;
    }
    
    filteredClients.forEach(c => {
        const clientNameNorm = (c.name || '').trim().toLowerCase();
        const linkedSubs = appState.subscriptions.filter(s => s.person && s.person.trim().toLowerCase() === clientNameNorm);
        
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

        tbody.innerHTML += `
        <tr class="hover:bg-gray-800/60 transition">
            <td class="p-4">
                <div class="font-black text-white text-xs">${c.name}</div>
                <div class="text-[10px] text-gray-500 font-mono">${c.email || 'Sin correo'}</div>
            </td>
            <td class="p-4">
                <span class="bg-cuycito-gold/20 text-cuycito-gold text-[11px] font-extrabold px-2.5 py-1 rounded-lg border border-cuycito-gold/40">
                    @${c.nickname || c.name}
                </span>
            </td>
            <td class="p-4 font-mono text-blue-400 font-bold text-xs"><i class="fa-solid fa-mobile-screen mr-1"></i> ${c.phone}</td>
            <td class="p-4 font-mono text-cuycito-gold text-xs">${c.pass}</td>
            <td class="p-4 font-mono font-black text-emerald-400 text-xs">$ ${(c.balance || 0).toFixed(2)}</td>
            <td class="p-4">${servicesHTML}</td>
            <td class="p-4 text-center">
                <div class="flex items-center justify-center gap-1.5">
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

        const imgHTML = p.imageUrl && p.imageUrl.trim() !== '' 
            ? `<img src="${p.imageUrl}" class="w-full h-36 object-cover" alt="Producto">` 
            : `<div class="w-full h-36 bg-gradient-to-br from-black via-gray-900 to-${p.colorClass || 'red-600'} flex flex-col items-center justify-center text-white/30 text-4xl"><i class="fa-solid ${isCombo ? 'fa-gift text-cuycito-gold' : 'fa-box'}"></i></div>`;

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
    const cont = document.getElementById('notificationsContainer'); if(!cont) return;
    cont.innerHTML = '';
    const exp = appState.subscriptions.filter(s => window.getDaysRemaining(s.endDate) <= 3 && window.getDaysRemaining(s.endDate) >= 0);
    const alertCount = document.getElementById('alertCount');
    if(alertCount) alertCount.innerText = exp.length;
    
    if (exp.length === 0) {
        cont.innerHTML = `<div class="p-3 bg-black/40 border border-gray-800/80 rounded-xl text-center text-gray-500 text-xs italic"><i class="fa-solid fa-circle-check text-emerald-400 mr-1"></i> No hay cuentas por vencer</div>`;
        return;
    }

    exp.forEach(s => {
        const days = window.getDaysRemaining(s.endDate);
        cont.innerHTML += `<div class="p-3 bg-[#0a0a0a] border-l-4 ${days===0?'border-cuycito-red':'border-cuycito-gold'} shadow-lg rounded-r-xl"><div class="flex justify-between items-start font-bold mb-1"><span class="text-white text-xs">${s.person}</span><span class="${days===0?'text-cuycito-red_light':'text-cuycito-gold'} font-black text-[10px] px-2 rounded bg-black">${days===0?'HOY':days+' d'}</span></div><div class="text-gray-400 text-[11px]">${s.service}</div></div>`;
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
                    <td class="p-3 font-bold text-white">$ ${(order.baseAmount || 0).toFixed(2)}</td>
                    <td class="p-3 font-black text-cuycito-gold glow-gold">$ ${(order.exactAmount || order.baseAmount || 0).toFixed(2)}</td>
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
            completedBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-500 font-sans">Aún no hay recargas procesadas registradas.</td></tr>`;
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
                    <td class="p-3 font-black text-emerald-400">$ ${(order.creditedAmount || order.exactAmount || order.baseAmount || 0).toFixed(2)} ${order.currency || 'USD'}</td>
                    <td class="p-3">${typeBadge}</td>
                    <td class="p-3 font-mono text-[11px] text-gray-400 truncate max-w-[150px]">${order.transferReference || 'N/A'}</td>
                    <td class="p-3 text-center">
                        <span class="bg-emerald-950 text-emerald-400 border border-emerald-500/50 text-[10px] font-black px-2 py-0.5 rounded">🟢 Acreditado</span>
                    </td>
                </tr>`;
            });
            completedBody.innerHTML = html;
        }
    }
};

window.approveRechargeOrder = async (orderId) => {
    const order = appState.recharges.find(r => r.id === orderId);
    if (!order) return alert("Orden no encontrada.");

    const amountToCredit = parseFloat(order.exactAmount || order.baseAmount || 0);
    if (!confirm(`¿Aprobar manualmente la recarga de $${amountToCredit.toFixed(2)} para el cliente "${order.userName || order.userId}"?`)) return;

    try {
        // 1. Buscar cliente y acreditar saldo
        const userDocRef = doc(db, "users", order.userId);
        const clientObj = appState.clients.find(c => c.id === order.userId);
        const currentBal = clientObj ? parseFloat(clientObj.balance || 0) : 0;
        const newBal = parseFloat((currentBal + amountToCredit).toFixed(2));

        if (clientObj) clientObj.balance = newBal;
        await setDoc(userDocRef, { balance: newBal, lastRechargeAt: new Date().toISOString() }, { merge: true });

        // 2. Actualizar estado de la orden
        order.status = 'completed';
        order.completedAt = new Date().toISOString();
        order.transferReference = 'Aprobación Manual Admin';
        order.creditedAmount = amountToCredit;
        await setDoc(doc(db, "recharge_orders", order.id), order);

        // 3. Registrar en historial contable
        const txId = `tx_rec_man_${Date.now()}`;
        const newTx = {
            id: txId,
            date: new Date().toISOString().split('T')[0],
            type: 'RECARGA_MANUAL',
            person: order.userName || order.userId,
            service: 'Recarga Saldo VIP',
            amount: amountToCredit,
            currency: order.currency || 'USD',
            orderId: order.id
        };
        appState.history.push(newTx);
        await setDoc(doc(db, "history", txId), newTx);

        window.notifyAutoSave('Recarga Aprobada');
        window.renderRechargesTable();
        window.renderClients();
        alert(`✅ ¡Recarga de $${amountToCredit.toFixed(2)} aprobada y acreditada exitosamente!`);

    } catch (e) {
        console.error(e);
        alert("Error al aprobar la recarga en Firebase.");
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
        completedBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-500 font-sans">No se encontraron recargas con "${query}".</td></tr>`;
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
            <td class="p-3 font-black text-emerald-400">$ ${(order.creditedAmount || order.exactAmount || order.baseAmount || 0).toFixed(2)} ${order.currency || 'USD'}</td>
            <td class="p-3">${typeBadge}</td>
            <td class="p-3 font-mono text-[11px] text-gray-400 truncate max-w-[150px]">${order.transferReference || 'N/A'}</td>
            <td class="p-3 text-center">
                <span class="bg-emerald-950 text-emerald-400 border border-emerald-500/50 text-[10px] font-black px-2 py-0.5 rounded">🟢 Acreditado</span>
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
        const docSnap = await getDoc(doc(db, "settings", "general"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            const qrInput = document.getElementById('settingQrUrlInput');
            const preview = document.getElementById('dashboardQrPreview');
            const lemonInput = document.getElementById('settingLemonTagInput');
            const phoneInput = document.getElementById('settingWhatsappPhoneInput');

            if (qrInput && data.paymentQrUrl) qrInput.value = data.paymentQrUrl;
            if (preview && data.paymentQrUrl) preview.src = data.paymentQrUrl;
            if (lemonInput && data.lemonTag) lemonInput.value = data.lemonTag;
            if (phoneInput && data.whatsappPhone) phoneInput.value = data.whatsappPhone;
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
        const base64 = event.target.result;
        const qrInput = document.getElementById('settingQrUrlInput');
        const preview = document.getElementById('dashboardQrPreview');
        if (qrInput) qrInput.value = base64;
        if (preview) preview.src = base64;
    };
    reader.readAsDataURL(file);
};

window.savePaymentQRSettings = async () => {
    const qrUrl = document.getElementById('settingQrUrlInput')?.value.trim() || '';
    const lemonTag = document.getElementById('settingLemonTagInput')?.value.trim() || '$cmancocambillo';
    const whatsappPhone = document.getElementById('settingWhatsappPhoneInput')?.value.trim() || '+51 991735344';

    try {
        await setDoc(doc(db, "settings", "general"), {
            paymentQrUrl: qrUrl,
            lemonTag: lemonTag,
            whatsappPhone: whatsappPhone,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        const preview = document.getElementById('dashboardQrPreview');
        if (preview && qrUrl) preview.src = qrUrl;

        window.notifyAutoSave('Configuración QR Guardada');
        alert("✅ ¡Configuración de QR y Lemon Tag guardada exitosamente! Se mostrará a los clientes al recargar.");
    } catch (e) {
        console.error(e);
        alert("Error al guardar la configuración en Firebase.");
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