import { db, collection, getDocs, doc, setDoc } from "./firebase-config.js";

// Estado de la sesión del cliente
let currentClientUser = null;
let clientSubscriptions = [];
let allMasterAccounts = [];
const CENTRAL_WHATSAPP_PHONE = "51991735344";

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
    } catch (e) {
        console.error("Error al procesar sesión:", e);
        window.location.replace("login-cliente.html");
    }
});

// Actualiza los elementos del perfil en el DOM
function updateProfileUI() {
    if (!currentClientUser) return;

    // En primera instancia, el nickname es exactamente igual a su nombre si no ha sido personalizado
    const nickname = currentClientUser.nickname || currentClientUser.name;
    const realName = currentClientUser.name;
    const phone = currentClientUser.phone;
    const email = currentClientUser.email || "Sin correo registrado";

    const navNick = document.getElementById('navClientNickname');
    const headerNick = document.getElementById('headerNickname') || document.getElementById('profileNicknameDisplay');
    const headerReal = document.getElementById('headerRealName') || document.getElementById('profileRealNameDisplay');
    const headerPhone = document.getElementById('headerPhone') || document.getElementById('profilePhoneDisplay');
    const headerMail = document.getElementById('headerEmail') || document.getElementById('profileEmailDisplay');

    if (navNick) navNick.innerText = `@${nickname}`;
    if (headerNick) headerNick.innerText = `@${nickname}`;
    if (headerReal) headerReal.innerText = realName;
    if (headerPhone) headerPhone.innerText = phone;
    if (headerMail) headerMail.innerText = email;

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

        clientSubscriptions = [];
        const clientNameNorm = currentClientUser.name.trim().toLowerCase();

        subSnap.forEach(d => {
            const sub = d.data();
            if (sub.person && sub.person.trim().toLowerCase() === clientNameNorm) {
                // Verificar si pertenece a una cuenta matriz (raíz)
                const master = allMasterAccounts.find(m => (m.profiles || []).includes(sub.id) || (m.email && sub.email && m.email.trim().toLowerCase() === sub.email.trim().toLowerCase()));
                if (master) {
                    sub.masterAccountLinked = master;
                }
                clientSubscriptions.push(sub);
            }
        });

        // Ordenamos: primero las vigentes más próximas a vencer, luego vencidas
        clientSubscriptions.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));

        updateMetrics();
        window.filterServicesList();
    } catch (error) {
        console.error("Error al cargar suscripciones:", error);
        container.innerHTML = `
            <div class="col-span-full py-12 text-center text-red-400 space-y-2">
                <i class="fa-solid fa-triangle-exclamation text-3xl"></i>
                <p class="font-bold">Error de conexión al cargar tus servicios.</p>
                <button onclick="location.reload()" class="text-xs text-cuycito-gold underline">Reintentar</button>
            </div>
        `;
    }
}

// Calcula días restantes
function calculateDaysRemaining(endDateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDateStr);
    return Math.ceil((end - today) / 86400000);
}

// Actualiza las tarjetas de estadísticas
function updateMetrics() {
    let total = clientSubscriptions.length;
    let active = 0;
    let expiring = 0;
    let expired = 0;

    clientSubscriptions.forEach(sub => {
        const days = calculateDaysRemaining(sub.endDate);
        if (days < 0) {
            expired++;
        } else if (days <= 3) {
            expiring++;
            active++;
        } else {
            active++;
        }
    });

    const mTotal = document.getElementById('metricTotal');
    const mActive = document.getElementById('metricActive');
    const mExpiring = document.getElementById('metricExpiring');
    const mExpired = document.getElementById('metricExpired');

    if (mTotal) mTotal.innerText = total;
    if (mActive) mActive.innerText = active;
    if (mExpiring) mExpiring.innerText = expiring;
    if (mExpired) mExpired.innerText = expired;
}

// Renderiza y filtra la lista de servicios
window.filterServicesList = () => {
    const container = document.getElementById('servicesContainer');
    if (!container) return;

    const searchTerm = (document.getElementById('searchServiceInput')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('statusServiceFilter')?.value || 'ALL';

    const filtered = clientSubscriptions.filter(sub => {
        const days = calculateDaysRemaining(sub.endDate);
        const isExpired = days < 0;
        const isExpiring = days >= 0 && days <= 3;
        const isActive = days >= 0;

        const matchSearch = (sub.service || '').toLowerCase().includes(searchTerm) || 
                            (sub.email || '').toLowerCase().includes(searchTerm);

        let matchStatus = true;
        if (statusFilter === 'ACTIVE') matchStatus = isActive;
        if (statusFilter === 'EXPIRING') matchStatus = isExpiring;
        if (statusFilter === 'EXPIRED') matchStatus = isExpired;

        return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-16 text-center text-gray-500 space-y-3 bg-black/40 rounded-2xl border border-gray-800/60 p-8">
                <i class="fa-solid fa-box-open text-4xl text-gray-600"></i>
                <p class="text-sm font-semibold text-gray-400">No se encontraron servicios contratados con esos criterios.</p>
                <a href="index.html" class="inline-flex items-center gap-2 bg-cuycito-gold hover:bg-cuycito-goldHover text-black text-xs font-black px-4 py-2.5 rounded-xl transition shadow">
                    <i class="fa-solid fa-cart-shopping"></i> Explorar Catálogo de Tienda
                </a>
            </div>
        `;
        return;
    }

    let html = '';
    filtered.forEach(sub => {
        const days = calculateDaysRemaining(sub.endDate);
        
        let statusBadge = '';
        let statusBorder = 'border-gray-800';

        if (days < 0) {
            statusBadge = `<span class="bg-red-950/60 text-red-400 border border-cuycito-red/50 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase flex items-center gap-1.5"><i class="fa-solid fa-circle-xmark"></i> Vencido hace ${Math.abs(days)}d</span>`;
            statusBorder = 'border-red-900/40';
        } else if (days <= 3) {
            statusBadge = `<span class="bg-amber-950/60 text-cuycito-gold border border-cuycito-gold/50 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase flex items-center gap-1.5 animate-pulse"><i class="fa-solid fa-triangle-exclamation"></i> Por Vencer (${days === 0 ? 'Vence HOY' : days + ' días'})</span>`;
            statusBorder = 'border-amber-700/50 glow-border-gold';
        } else {
            statusBadge = `<span class="bg-emerald-950/60 text-emerald-400 border border-emerald-500/40 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase flex items-center gap-1.5"><i class="fa-solid fa-circle-check"></i> Activo (${days} días)</span>`;
            statusBorder = 'border-gray-800 hover:border-cuycito-gold/40';
        }

        // ==========================================
        // LÓGICA DE VISIBILIDAD DE CREDENCIALES
        // Solo mostrar los campos (Correo y Contraseña) si la cuenta matriz / suscripción tiene activada su visibilidad
        // ==========================================
        let canShowCredentials = false;
        if (sub.masterAccountLinked) {
            canShowCredentials = !!sub.masterAccountLinked.showCredentialsToClient && !sub.hidePassword;
        } else {
            canShowCredentials = !!sub.showCredentials && !sub.hidePassword;
        }

        let credentialsBlockHTML = '';
        if (canShowCredentials) {
            // MOSTRAR CAMPOS DE CORREO Y CONTRASEÑA
            credentialsBlockHTML = `
            <div class="bg-[#0a0a0a] border border-gray-800/90 rounded-xl p-3.5 space-y-2 text-xs font-mono">
                <div class="flex items-center justify-between gap-2 border-b border-gray-800/60 pb-2">
                    <div class="truncate">
                        <span class="text-[10px] text-gray-500 uppercase block font-sans font-bold">Correo / Usuario</span>
                        <span class="text-gray-200 font-bold truncate block">${sub.email || '<span class="text-gray-600 font-sans italic">Sin usuario asignado</span>'}</span>
                    </div>
                    ${sub.email ? `
                    <button onclick="window.copyToClipboard('${sub.email}', 'Correo copiado')" class="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white p-1.5 px-2.5 rounded-lg text-[10px] transition flex items-center gap-1 flex-shrink-0" title="Copiar Correo">
                        <i class="fa-regular fa-copy"></i>
                    </button>` : ''}
                </div>

                <div class="flex items-center justify-between gap-2 border-b border-gray-800/60 pb-2">
                    <div class="truncate">
                        <span class="text-[10px] text-gray-500 uppercase block font-sans font-bold">Contraseña</span>
                        <span class="text-cuycito-gold font-black tracking-wider block">${sub.pass || '<span class="text-gray-600 font-sans italic">Sin clave</span>'}</span>
                    </div>
                    ${sub.pass ? `
                    <button onclick="window.copyToClipboard('${sub.pass}', 'Contraseña copiada')" class="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white p-1.5 px-2.5 rounded-lg text-[10px] transition flex items-center gap-1 flex-shrink-0" title="Copiar Contraseña">
                        <i class="fa-regular fa-copy"></i>
                    </button>` : ''}
                </div>

                <div class="flex items-center justify-between gap-2">
                    <div>
                        <span class="text-[10px] text-gray-500 uppercase block font-sans font-bold">PIN / Perfil Asignado</span>
                        <span class="text-emerald-400 font-bold block">${sub.pin || 'General / Sin PIN'}</span>
                    </div>
                </div>
            </div>
            `;
        } else {
            // NO MOSTRAR CAMPOS DE CORREO NI CONTRASEÑA (SOLO MOSTRAR QUE ESTÁ ACTIVO)
            credentialsBlockHTML = `
            <div class="bg-[#0a0a0a] border border-gray-800/90 rounded-xl p-3.5 space-y-2.5 text-xs font-sans">
                <div class="flex items-center justify-between gap-2 p-2 bg-emerald-950/40 border border-emerald-500/30 rounded-lg">
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span class="text-emerald-400 font-black text-xs">Servicio Activo & Garantizado</span>
                    </div>
                    <span class="text-[10px] text-gray-400 font-mono font-bold">${days < 0 ? 'Expirado' : days + ' días restantes'}</span>
                </div>

                ${sub.pin ? `
                <div class="flex items-center justify-between gap-2 px-1 pt-1 font-mono">
                    <span class="text-[11px] text-gray-400">PIN / Perfil:</span>
                    <span class="text-cuycito-gold font-bold">${sub.pin}</span>
                </div>` : ''}

                <div class="text-[11px] text-gray-400 leading-relaxed px-1 pt-1 flex items-center gap-1.5">
                    <i class="fa-solid fa-shield-halved text-cuycito-gold"></i>
                    <span>Acceso gestionado por administración. Soporte 24/7 disponible.</span>
                </div>
            </div>
            `;
        }

        html += `
        <div class="bg-[#141414] ${statusBorder} rounded-2xl p-5 shadow-xl transition-all duration-300 flex flex-col justify-between space-y-4 relative group">
            
            <!-- Cabecera de la Tarjeta -->
            <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-xl bg-black border border-cuycito-gold/40 text-cuycito-gold flex items-center justify-center text-xl font-bold glow-gold flex-shrink-0">
                        <i class="fa-solid fa-tv"></i>
                    </div>
                    <div>
                        <h3 class="text-base font-black text-white group-hover:text-cuycito-gold transition">${sub.service}</h3>
                        <p class="text-[11px] text-gray-400">Vence: <strong class="text-white font-mono">${sub.endDate}</strong></p>
                    </div>
                </div>
                ${statusBadge}
            </div>

            <!-- Bloque de Estado / Credenciales -->
            ${credentialsBlockHTML}

            <!-- Botones de Acción -->
            <div class="pt-2 flex items-center justify-between gap-2 border-t border-gray-800/60">
                <button onclick="window.copyFullAccessCard('${sub.id}')" class="text-gray-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition">
                    <i class="fa-solid fa-clipboard-list text-cuycito-gold"></i> Copiar Info
                </button>

                <button onclick="window.requestRenewalWhatsApp('${sub.service}', '${sub.endDate}', '${sub.email || ''}')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition flex items-center gap-2 shadow glow-gold">
                    <i class="fa-brands fa-whatsapp text-sm"></i> ${days <= 3 ? 'Renovar Ahora' : 'Soporte / Renovar'}
                </button>
            </div>
        </div>`;
    });

    container.innerHTML = html;
};

// ==========================================
// 3. UTILIDADES: COPIAR Y WHATSAPP (+51 991735344)
// ==========================================
window.copyToClipboard = (text, successMsg = "¡Copiado!") => {
    navigator.clipboard.writeText(text).then(() => {
        alert(`📋 ${successMsg}: ${text}`);
    }).catch(() => {
        prompt("Copia este texto:", text);
    });
};

window.copyFullAccessCard = (subId) => {
    const sub = clientSubscriptions.find(s => s.id === subId);
    if (!sub) return;

    const nickname = currentClientUser.nickname || currentClientUser.name;
    let canShow = false;
    if (sub.masterAccountLinked) {
        canShow = !!sub.masterAccountLinked.showCredentialsToClient && !sub.hidePassword;
    } else {
        canShow = !!sub.showCredentials && !sub.hidePassword;
    }

    let msg = '';
    if (canShow) {
        msg = `🐹 *CUYCITOGO - DETALLE DE TU SERVICIO* 🐹\n\n👤 *Cliente:* ${nickname}\n🎬 *Plataforma:* ${sub.service}\n📧 *Correo:* ${sub.email || '-'}\n🔐 *Contraseña:* ${sub.pass || '-'}\n🔢 *PIN/Perfil:* ${sub.pin || '-'}\n📆 *Fecha de Vencimiento:* ${sub.endDate}\n\n¡Gracias por confiar en CuycitoGO! 🙌`;
    } else {
        msg = `🐹 *CUYCITOGO - DETALLE DE TU SERVICIO* 🐹\n\n👤 *Cliente:* ${nickname}\n🎬 *Plataforma:* ${sub.service}\n🟢 *Estado:* Servicio Activo y Garantizado\n🔢 *PIN/Perfil:* ${sub.pin || '-'}\n📆 *Fecha de Vencimiento:* ${sub.endDate}\n\n¡Gracias por confiar en CuycitoGO! 🙌`;
    }

    navigator.clipboard.writeText(msg).then(() => {
        alert("📋 ¡La información de tu servicio ha sido copiada al portapapeles!");
    }).catch(() => {
        prompt("Copia la información de tu servicio:", msg);
    });
};

window.requestRenewalWhatsApp = (serviceName, endDate, email) => {
    const nickname = currentClientUser.nickname || currentClientUser.name;
    const msg = `¡Hola CuycitoGO! 🐹👋\nSoy *${nickname}* (Usuario: ${currentClientUser.phone}).\nQuiero consultar o renovar mi servicio de *${serviceName}* (Vence: ${endDate}).\n¿Me indican las opciones de renovación y datos para pago? ¡Muchas gracias!`;

    window.open(`https://wa.me/${CENTRAL_WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`, '_blank');
};

window.requestCredentialHelpWhatsApp = (serviceName, email) => {
    const nickname = currentClientUser.nickname || currentClientUser.name;
    const msg = `¡Hola CuycitoGO! 🐹👋\nSoy *${nickname}* (Usuario: ${currentClientUser.phone}).\nNecesito asistencia para acceder a mi servicio de *${serviceName}*. ¿Podrían asistirme para el ingreso? ¡Muchas gracias!`;

    window.open(`https://wa.me/${CENTRAL_WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`, '_blank');
};

// ==========================================
// 4. EDICIÓN DE NICKNAME Y PERFIL
// ==========================================
window.openEditProfileModal = () => {
    const modal = document.getElementById('editProfileModal');
    const alertBox = document.getElementById('editProfileAlert');
    if (alertBox) alertBox.classList.add('hidden');
    if (modal) modal.classList.remove('hidden');
};

window.closeEditProfileModal = () => {
    const modal = document.getElementById('editProfileModal');
    if (modal) modal.classList.add('hidden');
};

const editForm = document.getElementById('editProfileForm');
if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newNickname = document.getElementById('editNickname').value.trim();
        const newEmail = document.getElementById('editEmail').value.trim();
        const newPass = document.getElementById('editPass').value.trim();
        const btn = document.getElementById('btnSaveProfile');
        const alertBox = document.getElementById('editProfileAlert');

        if (!newNickname || !newPass) {
            alert("El Nickname y la Contraseña son obligatorios.");
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        currentClientUser.nickname = newNickname;
        currentClientUser.email = newEmail;
        currentClientUser.pass = newPass;

        try {
            await setDoc(doc(db, "users", currentClientUser.id), currentClientUser);
            localStorage.setItem("cuycitoClient", JSON.stringify(currentClientUser));
            
            updateProfileUI();
            
            if (alertBox) {
                alertBox.className = 'p-3 rounded-xl text-xs text-center font-bold bg-emerald-950/60 border border-emerald-500 text-emerald-400';
                alertBox.innerText = '✅ ¡Tus datos y Nickname fueron actualizados exitosamente!';
                alertBox.classList.remove('hidden');
            }

            setTimeout(() => {
                window.closeEditProfileModal();
                btn.disabled = false;
                btn.innerHTML = 'Guardar Cambios';
            }, 1000);
        } catch(err) {
            console.error("Error al actualizar perfil:", err);
            if (alertBox) {
                alertBox.className = 'p-3 rounded-xl text-xs text-center font-bold bg-red-950/60 border border-red-500 text-red-400';
                alertBox.innerText = '❌ Ocurrió un error al guardar los cambios en la nube.';
                alertBox.classList.remove('hidden');
            }
            btn.disabled = false;
            btn.innerHTML = 'Guardar Cambios';
        }
    });
}

// ==========================================
// 5. CERRAR SESIÓN
// ==========================================
window.logoutClient = () => {
    if (confirm("¿Deseas cerrar tu sesión?")) {
        localStorage.removeItem("cuycitoClient");
        window.location.replace('index.html');
    }
};
