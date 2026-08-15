import { auth, db, storage, onAuthStateChanged, signOut, collection, getDocs, doc, setDoc, deleteDoc, ref, uploadBytes, getDownloadURL } from "./firebase-config.js";

const DEFAULT_SERVICES = ["Netflix", "Spotify", "HBO Max", "Disney+", "Crunchyroll", "Prime Video"];

let appState = {
    globalCurrency: 'PEN',
    exchangeRate: 3.75,
    services: [...DEFAULT_SERVICES],
    subscriptions: [],
    history: [],
    masterAccounts: [],
    clients: [], 
    catalog: []  
};

let currentTargetAcc = null; 
let currentTargetSlot = null;
let chartPlatformInstance = null; 
let chartAnnualInstance = null;

if (typeof Chart !== 'undefined') { Chart.defaults.color = '#9ca3af'; }

// =====================================
// INICIALIZACIÓN Y SEGURIDAD
// =====================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const subSnap = await getDocs(collection(db, "subscriptions"));
            appState.subscriptions = []; subSnap.forEach(d => appState.subscriptions.push(d.data()));

            const histSnap = await getDocs(collection(db, "history"));
            appState.history = []; histSnap.forEach(d => appState.history.push(d.data()));

            const masterSnap = await getDocs(collection(db, "masterAccounts"));
            appState.masterAccounts = []; masterSnap.forEach(d => appState.masterAccounts.push(d.data()));

            const servSnap = await getDocs(collection(db, "services"));
            let cloudServices = []; servSnap.forEach(d => cloudServices.push(d.data().name));
            
            const clientSnap = await getDocs(collection(db, "users"));
            appState.clients = []; clientSnap.forEach(d => appState.clients.push(d.data()));

            const catalogSnap = await getDocs(collection(db, "store_catalog"));
            appState.catalog = []; catalogSnap.forEach(d => appState.catalog.push(d.data()));

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
// UTILIDADES BÁSICAS
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
    ['subs', 'master', 'finance', 'clients', 'catalog'].forEach(id => {
        const view = document.getElementById('view-' + id);
        const btn = document.getElementById('tab-btn-' + id);
        if(view) {
            view.classList.add('hidden');
            if(id === tabId) {
                view.classList.remove('hidden');
                if(id==='subs') view.classList.add('block');
                if(id==='master' || id==='finance' || id==='clients' || id==='catalog') view.className = view.className.replace('hidden', 'block space-y-4');
            }
        }
        if(btn) btn.className = (id === tabId) ? "text-cuycito-gold border-b-2 border-cuycito-gold pb-2 font-black uppercase tracking-wider text-sm transition" : "text-gray-500 hover:text-white border-b-2 border-transparent pb-2 font-black uppercase tracking-wider text-sm transition";
    });
    if(tabId === 'finance') window.renderFinance();
};

window.updateAllServiceDropdowns = () => {
    const ids = ['txService', 'bulkService', 'mService', 'editService'];
    ids.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Seleccionar Servicio --</option>';
        appState.services.forEach(serv => { select.innerHTML += `<option value="${serv}">${serv}</option>`; });
        select.innerHTML += '<option value="__NEW__" class="text-cuycito-gold font-bold">➕ Agregar Nuevo Servicio...</option>';
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
    if(label && typeSelect) label.innerText = typeSelect.value === 'VENTA' ? 'Nombre del Cliente' : 'Nombre del Proveedor'; 
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
// GUARDADO CLOUD
// =====================================
window.saveToFirebase = async () => {
    document.getElementById('dbStatus').innerHTML = '<span class="text-yellow-400"><i class="fa-solid fa-spinner fa-spin"></i> Subiendo...</span>';
    try {
        for (const sub of appState.subscriptions) await setDoc(doc(db, "subscriptions", sub.id), sub);
        for (const tx of appState.history) await setDoc(doc(db, "history", tx.id), tx);
        for (const acc of appState.masterAccounts) await setDoc(doc(db, "masterAccounts", acc.id), acc);
        for (const serv of appState.services) {
            const servDocId = 'serv_' + serv.toLowerCase().replace(/[^a-z0-9]/g, '_');
            await setDoc(doc(db, "services", servDocId), { name: serv });
        }
        for (const cl of appState.clients) await setDoc(doc(db, "users", cl.id), cl);
        
        alert('✅ ¡Datos guardados en la Nube!');
        document.getElementById('dbStatus').innerHTML = '<span class="text-emerald-400"><i class="fa-solid fa-cloud-check"></i> Sincronizado</span>';
    } catch (e) {
        console.error(e);
        alert('❌ Error al guardar.');
        document.getElementById('dbStatus').innerHTML = '<span class="text-red-500">Error Reglas</span>';
    }
};

window.logoutApp = () => { signOut(auth).then(() => window.location.replace('login.html')); };

// =====================================
// MÓDULO: SUSCRIPCIONES INDIVIDUALES
// =====================================
window.handleFormSubmit = async (e) => {
    e.preventDefault();
    const service = await window.getOrRegisterService('txService', 'txServiceCustom');
    if (!service) return;

    const id = 'sub_cuy_' + Date.now();
    const months = parseInt(document.getElementById('durationMonths').value) || 1;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const amount = parseFloat(document.getElementById('txAmount').value) || 0;
    const type = document.getElementById('txType').value;
    const person = document.getElementById('personName').value;
    const currency = document.getElementById('txCurrency') ? document.getElementById('txCurrency').value : 'PEN';

    const newSub = {
        id, type, person, service, 
        email: document.getElementById('credEmail') ? document.getElementById('credEmail').value : '',
        pass: document.getElementById('credPass') ? document.getElementById('credPass').value : '', 
        pin: document.getElementById('credPin') ? document.getElementById('credPin').value : '',
        amount, currency, startDate, durationMonths: months, endDate, status: 'ACTIVO'
    };

    const newTx = {
        id: 'tx_' + Date.now(), subId: id, date: startDate, type, person, service, amount, currency, detail: `Registro de ${type.toLowerCase()} activa`
    };

    appState.subscriptions.push(newSub);
    appState.history.push(newTx);
    document.getElementById('txForm').reset(); 
    window.calculateEndDate(); 
    window.renderAll();
};

window.renewSubscription = (subId, inputMonthsId) => {
    const inputEl = document.getElementById(inputMonthsId);
    const val = inputEl ? parseInt(inputEl.value) || 0 : 0;
    if (val <= 0) return alert('⚠️ Ingresa los meses a renovar.');
    const sub = appState.subscriptions.find(s => s.id === subId);
    if(!sub) return;
    const today = new Date(); 
    const currentEnd = new Date(sub.endDate);
    const baseDate = currentEnd < today ? today : currentEnd;
    
    sub.endDate = new Date(baseDate.getTime() + (val * 30 * 86400000)).toISOString().split('T')[0];
    sub.durationMonths += val;

    appState.history.push({
        id: 'tx_' + Date.now(), subId: sub.id, date: new Date().toISOString().split('T')[0], 
        type: 'RENOVACION', person: sub.person, service: sub.service, amount: sub.amount, currency: sub.currency, detail: `Renovación de ${val} mes(es)`
    });
    window.renderAll();
};

window.openEditModal = (subId) => {
    const sub = appState.subscriptions.find(s => s.id === subId);
    if(!sub) return;
    document.getElementById('editSubId').value = sub.id; document.getElementById('editPerson').value = sub.person;
    document.getElementById('editEmail').value = sub.email; document.getElementById('editPass').value = sub.pass;
    document.getElementById('editPin').value = sub.pin; document.getElementById('editAmount').value = sub.amount; 
    document.getElementById('editCurrency').value = sub.currency; document.getElementById('editEndDate').value = sub.endDate; 
    const editServiceSelect = document.getElementById('editService'); const editServiceCustom = document.getElementById('editServiceCustom');
    if(editServiceSelect && editServiceCustom) {
        if([...editServiceSelect.options].some(o => o.value === sub.service)) { editServiceSelect.value = sub.service; editServiceCustom.classList.add('hidden'); } 
        else { editServiceSelect.value = '__NEW__'; editServiceCustom.value = sub.service; editServiceCustom.classList.remove('hidden'); }
    }
    document.getElementById('editModal').classList.remove('hidden');
};

window.saveEditModal = async () => {
    const subIdInput = document.getElementById('editSubId'); if(!subIdInput) return;
    const sub = appState.subscriptions.find(s => s.id === subIdInput.value);
    const service = await window.getOrRegisterService('editService', 'editServiceCustom');
    if (!service) return;

    sub.person = document.getElementById('editPerson').value; sub.service = service;
    sub.email = document.getElementById('editEmail').value; sub.pass = document.getElementById('editPass').value;
    sub.pin = document.getElementById('editPin').value; sub.amount = parseFloat(document.getElementById('editAmount').value) || 0;
    sub.currency = document.getElementById('editCurrency').value; sub.endDate = document.getElementById('editEndDate').value;
    document.getElementById('editModal').classList.add('hidden'); window.renderAll();
};

window.deleteSubscription = async () => {
    const subIdInput = document.getElementById('editSubId'); 
    if(!subIdInput) return;
    const subId = subIdInput.value;

    if (confirm("⚠️ ¿Estás seguro de eliminar permanentemente este registro?\nSi estaba asignado a una Cuenta Raíz, el cupo quedará libre automáticamente.")) {
        appState.masterAccounts.forEach(acc => {
            if (acc.profiles) {
                const idx = acc.profiles.indexOf(subId);
                if (idx !== -1) acc.profiles[idx] = null;
            }
        });
        appState.subscriptions = appState.subscriptions.filter(s => s.id !== subId);
        try { await deleteDoc(doc(db, "subscriptions", subId)); } catch(e) { }
        document.getElementById('editModal').classList.add('hidden'); 
        window.renderAll();
    }
};

window.generateBulkCells = () => {
    const countInput = document.getElementById('bulkCount');
    const count = countInput ? parseInt(countInput.value) || 5 : 5;
    const container = document.getElementById('bulkContainer'); 
    if(!container) return;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        container.innerHTML += `
        <div class="bg-black p-3 rounded border border-gray-700 space-y-2">
            <div class="flex items-center gap-2"><span class="bg-blue-600 text-white font-bold w-6 h-6 flex justify-center items-center rounded-full text-xs">${i+1}</span><input type="text" id="bulkUser_${i}" placeholder="Usuario (Cliente)" class="flex-1 bg-[#111] border border-gray-600 rounded p-1.5 text-white outline-none focus:border-blue-400 text-xs"></div>
            <div class="grid grid-cols-2 gap-2 pl-8"><input type="text" id="bulkEmail_${i}" placeholder="Correo" class="bg-[#111] border border-gray-600 rounded p-1.5 text-white outline-none focus:border-blue-400 text-xs"><input type="text" id="bulkPass_${i}" placeholder="Contraseña/PIN" class="bg-[#111] border border-gray-600 rounded p-1.5 text-white outline-none focus:border-blue-400 text-xs"></div>
            <div class="grid grid-cols-2 gap-2 pl-8"><input type="number" id="bulkAmount_${i}" placeholder="Monto" class="bg-[#111] border border-gray-600 rounded p-1.5 text-white outline-none focus:border-blue-400 text-xs"><input type="number" id="bulkMonths_${i}" value="1" min="1" placeholder="Meses" class="bg-[#111] border border-gray-600 rounded p-1.5 text-white outline-none focus:border-blue-400 text-xs"></div>
        </div>`;
    }
};

window.saveBulkAccounts = async () => {
    const service = await window.getOrRegisterService('bulkService', 'bulkServiceCustom');
    if (!service) return;

    const countInput = document.getElementById('bulkCount');
    const count = countInput ? parseInt(countInput.value) || 5 : 5;
    const today = new Date().toISOString().split('T')[0];
    let added = 0;
    
    for (let i = 0; i < count; i++) {
        const userEl = document.getElementById(`bulkUser_${i}`);
        if (!userEl || !userEl.value) continue; 
        
        const user = userEl.value;
        const email = document.getElementById(`bulkEmail_${i}`) ? document.getElementById(`bulkEmail_${i}`).value : '';
        const passInfo = document.getElementById(`bulkPass_${i}`) ? document.getElementById(`bulkPass_${i}`).value : '';
        const amount = document.getElementById(`bulkAmount_${i}`) ? parseFloat(document.getElementById(`bulkAmount_${i}`).value) || 0 : 0;
        const months = document.getElementById(`bulkMonths_${i}`) ? parseInt(document.getElementById(`bulkMonths_${i}`).value) || 1 : 1;
        const endDate = new Date(new Date(today).getTime() + (months * 30 * 86400000)).toISOString().split('T')[0];
        const id = 'sub_bulk_' + Date.now() + '_' + i;
        
        appState.subscriptions.push({ id, type: 'VENTA', person: user, service, email, pass: passInfo, pin: '', amount, currency: appState.globalCurrency, startDate: today, durationMonths: months, endDate, status: 'ACTIVO' });
        appState.history.push({ id: 'tx_bulk_' + Date.now() + '_' + i, subId: id, date: today, type: 'VENTA', person: user, service, amount, currency: appState.globalCurrency, detail: `Registro de venta múltiple` });
        added++;
    }
    if (added > 0) { 
        window.renderAll(); 
        const modal = document.getElementById('bulkAddModal');
        if(modal) modal.classList.add('hidden'); 
        alert(`✅ Éxito: Se registraron ${added} usuarios.`); 
    } else { alert('⚠️ Rellena al menos el "Usuario".'); }
};

// =====================================
// MÓDULO: CUENTAS MAESTRAS
// =====================================
window.openAssignModal = (accId, slotIdx) => {
    currentTargetAcc = appState.masterAccounts.find(a => a.id === accId); 
    currentTargetSlot = slotIdx;
    
    const labelEl = document.getElementById('assignServiceLabel');
    if(labelEl) labelEl.innerText = currentTargetAcc.service;
    
    const accService = currentTargetAcc.service ? currentTargetAcc.service.trim().toLowerCase() : '';
    let assignedIds = []; 
    appState.masterAccounts.forEach(a => {
        if(a.profiles) a.profiles.forEach(pId => { if(pId) assignedIds.push(pId); });
    });
    
    let availableSubs = appState.subscriptions.filter(s => !assignedIds.includes(s.id));
    availableSubs.sort((a, b) => {
        let aService = a.service ? a.service.trim().toLowerCase() : '';
        let bService = b.service ? b.service.trim().toLowerCase() : '';
        let matchA = (aService === accService || aService.includes(accService) || accService.includes(aService)) ? 1 : 0;
        let matchB = (bService === accService || bService.includes(accService) || accService.includes(bService)) ? 1 : 0;
        return matchB - matchA; 
    });

    const listDiv = document.getElementById('assignList'); 
    if(!listDiv) return;
    listDiv.innerHTML = '';

    if(availableSubs.length === 0) {
        listDiv.innerHTML = '<p class="text-xs text-cuycito-red italic text-center py-4">No tienes clientes libres en este momento.</p>';
    } else {
        availableSubs.forEach(sub => {
            let sService = sub.service ? sub.service.trim().toLowerCase() : '';
            let isMatch = (sService === accService || sService.includes(accService) || accService.includes(sService));
            let borderClass = isMatch ? 'border-cuycito-gold bg-[#141414]' : 'border-gray-700 bg-black opacity-80 hover:opacity-100';
            let badge = isMatch ? '<span class="bg-cuycito-gold text-black px-1.5 py-0.5 rounded text-[9px] font-black ml-2 uppercase tracking-wider">Recomendado</span>' : '';

            listDiv.innerHTML += `
            <div onclick="window.assignToSlot('${sub.id}')" class="flex justify-between items-center border ${borderClass} hover:border-cuycito-gold rounded p-3 cursor-pointer transition mb-2">
                <div>
                    <p class="text-xs font-bold text-white">${sub.person} <span class="text-cuycito-gold text-[10px] ml-1 font-mono">PIN: ${sub.pin || '-'}</span></p>
                    <p class="text-[10px] text-gray-400 mt-1">Servicio: <strong class="text-white">${sub.service}</strong> ${badge}</p>
                </div>
                <div class="text-right">
                    <p class="text-[10px] text-gray-500 mb-1">Vence: ${sub.endDate}</p>
                    <i class="fa-solid fa-link text-gray-500"></i>
                </div>
            </div>`;
        });
    }
    const modal = document.getElementById('assignModal');
    if(modal) modal.classList.remove('hidden');
};

window.assignToSlot = (subId) => { 
    if(currentTargetAcc) { 
        currentTargetAcc.profiles[currentTargetSlot] = subId; 
        const sub = appState.subscriptions.find(s => s.id === subId);
        if(sub) {
            sub.email = currentTargetAcc.email;
            sub.pass = currentTargetAcc.pass;
        }
        const modal = document.getElementById('assignModal');
        if(modal) modal.classList.add('hidden'); 
        window.renderAll(); 
    } 
};

window.unlinkProfile = (accId, slotIdx) => { 
    const acc = appState.masterAccounts.find(a => a.id === accId); 
    if(acc) { 
        const subId = acc.profiles[slotIdx];
        if(subId) {
            const sub = appState.subscriptions.find(s => s.id === subId);
            if(sub) { sub.email = ''; sub.pass = ''; }
        }
        acc.profiles[slotIdx] = null; 
        window.renderAll(); 
    } 
};

window.saveMasterAccount = async () => {
    const service = await window.getOrRegisterService('mService', 'mServiceCustom');
    if (!service) return;

    const emailInput = document.getElementById('mEmail');
    const email = emailInput ? emailInput.value : '';
    if(!email) return alert("Falta el correo principal.");

    const provider = document.getElementById('mProvider').value || 'Proveedor Desconocido';
    const cost = parseFloat(document.getElementById('mCost').value) || 0;
    const currency = document.getElementById('mCurrency').value || 'PEN';
    const startDate = document.getElementById('mStartDate').value || new Date().toISOString().split('T')[0];
    const months = parseInt(document.getElementById('mMonths').value) || 1;
    const endDate = new Date(new Date(startDate).getTime() + (months * 30 * 86400000)).toISOString().split('T')[0];
    
    const capacity = parseInt(document.getElementById('mCapacity').value) || 5;
    const pass = document.getElementById('mPass').value || '';
    const newAccId = 'ma_' + Date.now();

    appState.masterAccounts.push({ 
        id: newAccId, service, email, pass, capacity, 
        provider, cost, currency, startDate, durationMonths: months, endDate, 
        profiles: Array(capacity).fill(null) 
    });

    appState.history.push({
        id: 'tx_compra_' + Date.now(), subId: newAccId, date: startDate, type: 'COMPRA', person: provider, service, amount: cost, currency, detail: `Compra de Cuenta Raíz (${capacity} cupos)`
    });
    
    const modal = document.getElementById('masterModal');
    if(modal) modal.classList.add('hidden'); 
    window.renderAll();
};

window.deleteMasterAccount = async (accId) => { 
    if(confirm("¿Eliminar Cuenta Raíz? Los clientes se desvincularán y sus accesos se limpiarán.")) { 
        const acc = appState.masterAccounts.find(a => a.id === accId);
        if(acc && acc.profiles) {
            acc.profiles.forEach(pId => {
                if(pId) {
                    const sub = appState.subscriptions.find(s => s.id === pId);
                    if(sub) { sub.email = ''; sub.pass = ''; }
                }
            });
        }
        appState.masterAccounts = appState.masterAccounts.filter(a => a.id !== accId); 
        try { await deleteDoc(doc(db, "masterAccounts", accId)); } catch(e) {}
        window.renderAll(); 
    } 
};

window.openEditMasterModal = (accId) => {
    const acc = appState.masterAccounts.find(a => a.id === accId);
    if(!acc) return;
    document.getElementById('editMasterId').value = acc.id;
    document.getElementById('editMasterEmail').value = acc.email;
    document.getElementById('editMasterPass').value = acc.pass;
    document.getElementById('editMasterCapacity').value = acc.capacity;
    document.getElementById('editMasterModal').classList.remove('hidden');
};

window.saveEditMasterModal = () => {
    const id = document.getElementById('editMasterId').value;
    const acc = appState.masterAccounts.find(a => a.id === id);
    if(!acc) return;
    const newEmail = document.getElementById('editMasterEmail').value;
    const newPass = document.getElementById('editMasterPass').value;
    const newCapacity = parseInt(document.getElementById('editMasterCapacity').value) || acc.capacity;
    const credsChanged = (acc.email !== newEmail || acc.pass !== newPass);
    
    acc.email = newEmail; acc.pass = newPass;

    if (newCapacity > acc.capacity) {
        const diff = newCapacity - acc.capacity;
        for(let i=0; i<diff; i++) acc.profiles.push(null);
    } else if (newCapacity < acc.capacity) {
        const removedSlots = acc.profiles.slice(newCapacity);
        removedSlots.forEach(pId => {
            if (pId) {
                const sub = appState.subscriptions.find(s => s.id === pId);
                if(sub) { sub.email = ''; sub.pass = ''; }
            }
        });
        acc.profiles = acc.profiles.slice(0, newCapacity);
    }
    
    acc.capacity = newCapacity;

    if (credsChanged) {
        acc.profiles.forEach(pId => {
            if (pId) {
                const sub = appState.subscriptions.find(s => s.id === pId);
                if(sub) { sub.email = acc.email; sub.pass = acc.pass; }
            }
        });
    }

    document.getElementById('editMasterModal').classList.add('hidden');
    window.renderAll();
};

// =====================================
// MÓDULO: CLIENTES (ACCESOS TIENDA)
// =====================================
window.openClientModal = (clientId = null) => {
    const form = document.getElementById('clientModal');
    
    const dataList = document.getElementById('clientNamesList');
    dataList.innerHTML = '';
    const uniqueNames = [...new Set(appState.subscriptions.map(s => s.person))];
    uniqueNames.forEach(name => { dataList.innerHTML += `<option value="${name}">`; });

    if(!clientId) {
        document.getElementById('cId').value = 'user_' + Date.now();
        document.getElementById('cName').value = '';
        document.getElementById('cPhone').value = '';
        document.getElementById('cEmail').value = '';
        document.getElementById('cPass').value = Math.random().toString(36).slice(-8); 
    } else {
        const c = appState.clients.find(x => x.id === clientId);
        document.getElementById('cId').value = c.id;
        document.getElementById('cName').value = c.name;
        document.getElementById('cPhone').value = c.phone;
        document.getElementById('cEmail').value = c.email || '';
        document.getElementById('cPass').value = c.pass;
    }
    form.classList.remove('hidden');
};

window.saveClient = async () => {
    const id = document.getElementById('cId').value;
    const name = document.getElementById('cName').value.trim();
    const phone = document.getElementById('cPhone').value.trim();
    const email = document.getElementById('cEmail').value.trim();
    const pass = document.getElementById('cPass').value;

    if(!name || !phone || !pass) return alert("Nombre, Número y Contraseña son obligatorios.");

    const existing = appState.clients.find(c => c.phone === phone && c.id !== id);
    if (existing) return alert("Este número ya está registrado como acceso de otro cliente.");

    const newClient = { id, name, email, pass, phone };
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

// 📋 FUNCIÓN PARA COPIAR AL PORTAPAPELES EL MENSAJE DE ACCESO
window.copyClientAccess = (clientId) => {
    const client = appState.clients.find(c => c.id === clientId);
    if (!client) return;
    const message = `🐹 *CUYCITOGO - ACCESO A TU CUENTA* 🐹\n\nHola *${client.name}*, esta es tu cuenta para acceder a nuestro portal web:\n\n👤 *Usuario:* ${client.phone}\n🔐 *Contraseña:* ${client.pass}\n\nIngresa para ver tus servicios contratados. ¡Cualquier consulta estamos a tu disposición! 🙌`;
    
    navigator.clipboard.writeText(message).then(() => {
        alert(`📋 ¡Mensaje copiado para WhatsApp!\n\n${message}`);
    }).catch(() => {
        const temp = document.createElement("textarea");
        temp.value = message;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
        alert("📋 ¡Mensaje copiado para WhatsApp!");
    });
};

// 📲 FUNCIÓN PARA ENVIAR DIRECTO POR WHATSAPP AL CLIENTE
window.sendClientAccessWhatsApp = (clientId) => {
    const client = appState.clients.find(c => c.id === clientId);
    if (!client) return;
    const message = `🐹 *CUYCITOGO - ACCESO A TU CUENTA* 🐹\n\nHola *${client.name}*, esta es tu cuenta para acceder a nuestro portal web:\n\n👤 *Usuario:* ${client.phone}\n🔐 *Contraseña:* ${client.pass}\n\nIngresa para ver tus servicios contratados. ¡Cualquier consulta estamos a tu disposición! 🙌`;
    const cleanPhone = client.phone.replace(/[^0-9]/g, '');
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
};

// =====================================
// MÓDULO: CATÁLOGO WEB
// =====================================
window.openCatalogModal = (catId = null) => {
    const form = document.getElementById('catalogModal');
    if(!catId) {
        document.getElementById('catId').value = 'prod_' + Date.now();
        document.getElementById('catTitle').value = '';
        document.getElementById('catDesc').value = '';
        document.getElementById('catPrice').value = '';
        document.getElementById('catColor').value = 'red-600';
        document.getElementById('catPromo').checked = false;
        document.getElementById('catOldImage').value = '';
        document.getElementById('catImageFile').value = ''; 
    } else {
        const p = appState.catalog.find(c => c.id === catId);
        document.getElementById('catId').value = p.id;
        document.getElementById('catTitle').value = p.title;
        document.getElementById('catDesc').value = p.description;
        document.getElementById('catPrice').value = p.price;
        document.getElementById('catColor').value = p.colorClass;
        document.getElementById('catPromo').checked = p.promo || false;
        document.getElementById('catOldImage').value = p.imageUrl || '';
        document.getElementById('catImageFile').value = ''; 
    }
    form.classList.remove('hidden');
};

window.saveCatalogItem = async () => {
    const statusLabel = document.getElementById('dbStatus');
    statusLabel.innerHTML = '<span class="text-yellow-400"><i class="fa-solid fa-spinner fa-spin"></i> Subiendo imagen...</span>';
    
    const id = document.getElementById('catId').value;
    const title = document.getElementById('catTitle').value;
    const desc = document.getElementById('catDesc').value;
    const price = parseFloat(document.getElementById('catPrice').value) || 0;
    const color = document.getElementById('catColor').value;
    const promo = document.getElementById('catPromo').checked;
    
    const fileInput = document.getElementById('catImageFile');
    let imageUrl = document.getElementById('catOldImage').value; 

    if (fileInput.files.length > 0) {
        try {
            const file = fileInput.files[0];
            const storageRef = ref(storage, 'catalogo/' + Date.now() + '_' + file.name);
            await uploadBytes(storageRef, file);
            imageUrl = await getDownloadURL(storageRef);
        } catch(e) {
            console.error("Error subiendo imagen:", e);
            alert("No se pudo subir la imagen, se guardará sin ella.");
        }
    }

    const newItem = { id, title, description: desc, price, colorClass: color, promo, imageUrl };

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
// IMPORT/EXPORT JSON
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
            if(data.catalog) appState.catalog = data.catalog;
            if(data.clients) appState.clients = data.clients;
            
            const modal = document.getElementById('jsonModal'); if(modal) modal.classList.add('hidden');
            textArea.value = ''; window.renderAll(); alert('✅ Datos pegados en memoria. ¡AHORA PRESIONA "Guardar Nube" para subirlos!');
        }
    } catch(e) { alert('❌ Error en el formato JSON.'); }
};

window.exportJSONDownload = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
    const dn = document.createElement('a'); dn.setAttribute("href", dataStr); dn.setAttribute("download", "cuycitogo_respaldo.json");
    document.body.appendChild(dn); dn.click(); dn.remove();
};

// =====================================
// RENDERIZADO VISUAL
// =====================================
window.renderFinance = () => {
    const finMonthFilter = document.getElementById('financeMonthFilter');
    if(!finMonthFilter) return;
    const selectedMonthStr = finMonthFilter.value;
    if(!selectedMonthStr) return;
    
    const [selYear, selMonth] = selectedMonthStr.split('-');
    
    let monthIncome = 0; let monthExpense = 0;
    let servicesIncomeMap = {}; 
    let annualData = { income: Array(12).fill(0), expense: Array(12).fill(0) };

    const tbody = document.getElementById('financeTableBody');
    if(tbody) tbody.innerHTML = '';

    appState.history.forEach(tx => {
        if(!tx.date) return;
        const txDate = tx.date;
        const txYear = txDate.substring(0, 4);
        const txMonth = txDate.substring(5, 7);
        const amountGlobal = convertToGlobal(tx.amount, tx.currency);
        const sym = appState.globalCurrency === 'PEN' ? 'S/' : '$';

        if (txYear === selYear) {
            const mIndex = parseInt(txMonth) - 1; 
            if (tx.type === 'VENTA' || tx.type === 'RENOVACION') annualData.income[mIndex] += amountGlobal;
            if (tx.type === 'COMPRA') annualData.expense[mIndex] += amountGlobal;
        }

        if (txYear === selYear && txMonth === selMonth) {
            if (tx.type === 'VENTA' || tx.type === 'RENOVACION') {
                monthIncome += amountGlobal;
                if(tx.service) {
                    if(!servicesIncomeMap[tx.service]) servicesIncomeMap[tx.service] = 0;
                    servicesIncomeMap[tx.service] += amountGlobal;
                }
            } else if (tx.type === 'COMPRA') { monthExpense += amountGlobal; }

            if(tbody) {
                let badgeType = tx.type === 'COMPRA' ? 'bg-cuycito-red/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400';
                let amountColor = tx.type === 'COMPRA' ? 'text-red-400' : 'text-emerald-400';
                let sign = tx.type === 'COMPRA' ? '-' : '+';
                
                tbody.innerHTML += `
                    <tr class="hover:bg-gray-800 transition">
                        <td class="p-3 font-mono text-[10px] text-gray-400">${tx.date}</td>
                        <td class="p-3"><span class="px-2 py-0.5 rounded text-[9px] font-bold ${badgeType}">${tx.type}</span></td>
                        <td class="p-3 font-bold text-white">${tx.person}</td>
                        <td class="p-3 text-cuycito-gold font-bold">${tx.service}</td>
                        <td class="p-3 text-right font-black ${amountColor}">${sign} ${sym} ${amountGlobal.toFixed(2)}</td>
                    </tr>`;
            }
        }
    });

    if(tbody && tbody.innerHTML === '') { tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-500 italic">No hay movimientos registrados en este mes.</td></tr>`; }

    let profit = monthIncome - monthExpense;
    let margin = monthIncome > 0 ? ((profit / monthIncome) * 100).toFixed(1) : 0;
    
    document.getElementById('finMonthIncome').innerText = monthIncome.toFixed(2);
    document.getElementById('finMonthExpense').innerText = monthExpense.toFixed(2);
    
    const profitEl = document.getElementById('finMonthProfit');
    if(profitEl){
        profitEl.innerText = profit.toFixed(2);
        profitEl.className = profit >= 0 ? "text-2xl font-black text-white mt-1" : "text-2xl font-black text-cuycito-red_light mt-1";
    }
    
    const marginEl = document.getElementById('finMonthMargin');
    if(marginEl){
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
        const matchSearch = sub.person.toLowerCase().includes(search) || sub.service.toLowerCase().includes(search);
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

        tbody.innerHTML += `
            <tr class="${rowStyle}">
                <td class="p-4"><span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${typeBadge}">${sub.type}</span><div class="font-bold text-white mt-1.5">${sub.person}</div></td>
                <td class="p-4 font-bold text-gray-300">${sub.service}</td>
                <td class="p-4 font-mono text-[11px] bg-black/20 rounded-lg"><div class="text-white">${sub.email || '<span class="text-gray-600 italic">Sin asignar</span>'}</div><div class="text-cuycito-gold mt-1">Pass: ${sub.pass || '-'} | PIN: ${sub.pin || '-'}</div></td>
                <td class="p-4 font-mono text-gray-400 text-xs">${sub.endDate}</td>
                <td class="p-4"><span class="border px-2.5 py-1 rounded text-[11px] font-black ${badgeColor}">${days < 0 ? 'Expiró' : days + ' d'}</span></td>
                <td class="p-4 text-center"><div class="flex items-center justify-center gap-1 bg-black p-1 rounded-lg border border-gray-800"><input type="number" id="renew_${sub.id}" value="0" min="0" class="w-12 bg-transparent text-center text-cuycito-gold font-bold outline-none"><button onclick="window.renewSubscription('${sub.id}', 'renew_${sub.id}')" class="bg-cuycito-gold hover:bg-cuycito-gold_light text-black px-2 py-1 rounded font-black transition"><i class="fa-solid fa-rotate-right"></i></button></div></td>
                <td class="p-4 text-center"><div class="flex items-center justify-center gap-2"><button onclick="window.triggerWhatsApp('${sub.id}')" class="bg-[#25D366] text-black p-2 rounded transition"><i class="fa-brands fa-whatsapp text-lg"></i></button><button onclick="window.triggerInfo('${sub.id}')" class="bg-[#0ea5e9] text-black p-2 rounded transition"><i class="fa-solid fa-circle-info text-lg"></i></button><button onclick="window.openEditModal('${sub.id}')" class="bg-gray-700 text-white p-2 rounded transition"><i class="fa-solid fa-pen text-lg"></i></button></div></td>
            </tr>`;
    });
};

window.renderMasterAccounts = () => {
    const grid = document.getElementById('masterGrid'); if(!grid) return;
    grid.innerHTML = '';
    
    appState.masterAccounts.forEach(acc => {
        let occupied = acc.profiles.filter(p => p !== null).length;
        let occColor = occupied === acc.capacity ? 'text-cuycito-red border-cuycito-red' : 'text-emerald-400 border-emerald-400/50';

        let totalIncome = 0;
        acc.profiles.forEach(pId => {
            if(pId) {
                const sub = appState.subscriptions.find(s => s.id === pId);
                if(sub) { totalIncome += convertToGlobal(sub.amount, sub.currency); }
            }
        });
        
        let costInGlobal = convertToGlobal(acc.cost || 0, acc.currency || 'PEN');
        let profit = totalIncome - costInGlobal;
        let profitColor = profit >= 0 ? 'text-emerald-400' : 'text-cuycito-red_light';
        let sym = appState.globalCurrency === 'PEN' ? 'S/' : '$';

        let html = `
        <div class="bg-[#111] border border-gray-800 rounded-xl overflow-hidden shadow-lg flex flex-col">
            <div class="p-3 bg-black border-b border-gray-800 flex justify-between items-center">
                <div>
                    <h4 class="font-black text-white text-sm uppercase">${acc.service}</h4>
                    <p class="text-[10px] text-cuycito-gold font-mono">${acc.email}</p>
                </div>
                <div class="flex flex-col items-end gap-1">
                    <div class="text-center border px-2 py-0.5 rounded ${occColor} bg-black text-[10px] font-black tracking-widest">${occupied}/${acc.capacity} Lleno</div>
                    <span class="text-[9px] text-gray-500">Vence: ${acc.endDate || 'N/A'}</span>
                </div>
            </div>
            
            <div class="grid grid-cols-3 text-center text-[10px] bg-black/50 border-b border-gray-800 divide-x divide-gray-800">
                <div class="p-1.5"><span class="text-gray-500 block text-[8px] uppercase">Costo</span><span class="text-red-400 font-bold">${sym} ${costInGlobal.toFixed(2)}</span></div>
                <div class="p-1.5"><span class="text-gray-500 block text-[8px] uppercase">Ingresos</span><span class="text-emerald-400 font-bold">${sym} ${totalIncome.toFixed(2)}</span></div>
                <div class="p-1.5"><span class="text-gray-500 block text-[8px] uppercase">Ganancia</span><span class="${profitColor} font-bold">${sym} ${profit.toFixed(2)}</span></div>
            </div>

            <div class="p-2 text-[10px] text-gray-500 font-mono bg-black/80 border-b border-gray-800 flex justify-between items-center">
                <span>Pass: ${acc.pass}</span>
                <div class="flex items-center gap-3">
                    <button onclick="window.openEditMasterModal('${acc.id}')" class="text-blue-400 hover:text-blue-300" title="Editar Cuenta"><i class="fa-solid fa-pen-to-square text-sm"></i></button>
                    <button onclick="window.deleteMasterAccount('${acc.id}')" class="text-cuycito-red hover:text-red-400" title="Eliminar Cuenta"><i class="fa-solid fa-trash text-sm"></i></button>
                </div>
            </div>
            
            <div class="p-3 space-y-2 flex-1 bg-[#0a0a0a]">`;

        for(let i=0; i<acc.capacity; i++) {
            const subId = acc.profiles[i];
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

// 📌 TABLA DE CLIENTES ACTUALIZADA CON BOTONES DE COPIAR Y WHATSAPP
window.renderClients = () => {
    const tbody = document.getElementById('clientsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    appState.clients.forEach(c => {
        tbody.innerHTML += `
        <tr class="hover:bg-gray-800 transition">
            <td class="p-4 font-bold text-white">${c.name}</td>
            <td class="p-4 font-mono text-blue-400 font-bold text-xs"><i class="fa-solid fa-mobile-screen mr-1"></i> ${c.phone}</td>
            <td class="p-4 font-mono text-cuycito-gold text-xs">${c.pass}</td>
            <td class="p-4 font-mono text-gray-500 text-[10px]">${c.email || 'Sin correo'}</td>
            <td class="p-4 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button onclick="window.copyClientAccess('${c.id}')" class="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded transition shadow" title="Copiar mensaje con credenciales">
                        <i class="fa-regular fa-copy text-sm"></i>
                    </button>
                    <button onclick="window.sendClientAccessWhatsApp('${c.id}')" class="bg-[#25D366] hover:bg-emerald-500 text-black p-2 rounded transition shadow" title="Enviar mensaje por WhatsApp">
                        <i class="fa-brands fa-whatsapp text-sm font-bold"></i>
                    </button>
                    <button onclick="window.openClientModal('${c.id}')" class="bg-gray-700 hover:bg-blue-600 text-white p-2 rounded transition shadow" title="Editar">
                        <i class="fa-solid fa-pen text-sm"></i>
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
    
    appState.catalog.forEach(p => {
        const badge = p.promo ? `<span class="bg-cuycito-red text-white text-[9px] px-2 py-0.5 rounded uppercase font-black absolute top-2 right-2 shadow-lg z-10">Oferta</span>` : '';
        const imgHTML = p.imageUrl && p.imageUrl.trim() !== '' 
            ? `<img src="${p.imageUrl}" class="w-full h-32 object-cover" alt="Producto">` 
            : `<div class="w-full h-32 bg-${p.colorClass} flex items-center justify-center text-white/30 text-4xl"><i class="fa-solid fa-box"></i></div>`;

        grid.innerHTML += `
        <div class="bg-[#111] border border-gray-800 rounded-xl overflow-hidden relative group">
            ${badge}
            ${imgHTML}
            <div class="p-4">
                <h4 class="text-sm font-black text-white truncate">${p.title}</h4>
                <p class="text-[10px] text-gray-500 mt-1 line-clamp-2">${p.description}</p>
                <div class="mt-3 flex justify-between items-center">
                    <span class="text-cuycito-gold font-black">S/ ${p.price.toFixed(2)}</span>
                    <button onclick="window.openCatalogModal('${p.id}')" class="text-gray-400 hover:text-white transition"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
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
    exp.forEach(s => {
        const days = window.getDaysRemaining(s.endDate);
        cont.innerHTML += `<div class="p-3 bg-[#0a0a0a] border-l-4 ${days===0?'border-cuycito-red':'border-cuycito-gold'} shadow-lg"><div class="flex justify-between items-start font-bold mb-1"><span class="text-white">${s.person}</span><span class="${days===0?'text-cuycito-red_light':'text-cuycito-gold'} font-black px-2 rounded bg-black">${days===0?'HOY':days+' d'}</span></div><div class="text-gray-300 text-xs">${s.service}</div></div>`;
    });
};

window.renderAll = () => {
    window.updateAllServiceDropdowns();
    window.renderActiveTable(); 
    window.renderMasterAccounts(); 
    window.renderClients(); 
    window.renderCatalog(); 
    window.renderNotifications(); 
    
    const finView = document.getElementById('view-finance');
    if (finView && !finView.classList.contains('hidden')) window.renderFinance();
};