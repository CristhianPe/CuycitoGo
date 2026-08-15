// Importamos las herramientas de Firebase desde tu archivo de configuración central
import { db, collection, getDocs, query, where, doc, setDoc } from './firebase-config.js';

// ==========================================
// CONFIGURACIÓN PRINCIPAL
// ==========================================
const WHATSAPP_PHONE = "51900000000"; // Pon aquí tu número (ej: 51987654321)
let cart = [];
let currentClientUser = null;

// ==========================================
// 1. VISTAS Y NAVEGACIÓN
// ==========================================
window.showView = (viewId) => {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
    const view = document.getElementById(viewId);
    if(view) view.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.checkAuthAndShowProfile = () => {
    if (currentClientUser) { 
        window.showView('profileView'); 
    } else { 
        window.showView('loginView'); 
    }
};

// ==========================================
// 2. AUTENTICACIÓN (LOGIN DE CLIENTES)
// ==========================================

// Mantener sesión abierta si el cliente ya ingresó antes
const savedSession = localStorage.getItem("cuycitoClient");
if (savedSession) {
    currentClientUser = JSON.parse(savedSession);
    updateUIForUser();
    loadClientSubscriptions(currentClientUser.name);
}

// Función para actualizar la interfaz cuando el cliente se loguea
function updateUIForUser() {
    const navName = document.getElementById('navUserName');
    const profileName = document.getElementById('profileNameDisplay');
    const profilePhone = document.getElementById('profilePhoneDisplay');
    const profileEmail = document.getElementById('profileEmailDisplay');
    const profileAvatar = document.getElementById('profileAvatar');

    if(navName) navName.innerText = `Hola, ${currentClientUser.name.split(' ')[0]}`;
    if(profileName) profileName.innerText = currentClientUser.name;
    if(profilePhone) profilePhone.innerText = currentClientUser.phone;
    if(profileEmail) profileEmail.innerText = currentClientUser.email || 'Sin correo asignado';
    if(profileAvatar) profileAvatar.innerText = currentClientUser.name.charAt(0).toUpperCase();

    // Llenar datos en el modal de edición
    const updatePhone = document.getElementById('updatePhone');
    const updateEmail = document.getElementById('updateEmail');
    const updatePass = document.getElementById('updatePass');

    if(updatePhone) updatePhone.value = currentClientUser.phone;
    if(updateEmail) updateEmail.value = currentClientUser.email || '';
    if(updatePass) updatePass.value = currentClientUser.pass;

    // Cambiar los botones de la barra superior
    const loggedOutBtns = document.getElementById('loggedOutButtons');
    const loggedInBtns = document.getElementById('loggedInButtons');
    
    if(loggedOutBtns) loggedOutBtns.classList.add('hidden');
    if(loggedInBtns) loggedInBtns.classList.remove('hidden');
}

// Proceso de Login verificando en la base de datos
window.handleLogin = async (e) => {
    e.preventDefault();
    const phone = document.getElementById('loginPhone').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const btn = document.getElementById('btnSubmitLogin');
    const errorMsg = document.getElementById('loginErrorMsg');

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';
    errorMsg.classList.add('hidden');

    try {
        const q = query(collection(db, "users"), where("phone", "==", phone), where("pass", "==", pass));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
            const userData = snap.docs[0].data();
            localStorage.setItem("cuycitoClient", JSON.stringify(userData));
            currentClientUser = userData;
            
            updateUIForUser();
            await loadClientSubscriptions(userData.name);
            
            window.showView('profileView');
            btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar a Mi Panel';
        } else {
            throw new Error("Credenciales inválidas");
        }
    } catch (err) {
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar a Mi Panel';
        errorMsg.classList.remove('hidden');
    }
};

// Asegurar que el formulario dispare la función handleLogin
const loginForm = document.getElementById('clientLoginForm');
if(loginForm) {
    loginForm.addEventListener('submit', window.handleLogin);
}

// Cerrar sesión del cliente
window.logoutClient = () => { 
    localStorage.removeItem("cuycitoClient");
    currentClientUser = null;
    
    const loggedOutBtns = document.getElementById('loggedOutButtons');
    const loggedInBtns = document.getElementById('loggedInButtons');
    
    if(loggedOutBtns) loggedOutBtns.classList.remove('hidden');
    if(loggedInBtns) loggedInBtns.classList.add('hidden');
    
    window.showView('storeView');
};

// Guardar cambios si el cliente edita su perfil
window.updateClientData = async (e) => {
    e.preventDefault();
    const newEmail = document.getElementById('updateEmail').value.trim();
    const newPass = document.getElementById('updatePass').value.trim();

    currentClientUser.email = newEmail;
    currentClientUser.pass = newPass;

    try {
        await setDoc(doc(db, "users", currentClientUser.id), currentClientUser);
        localStorage.setItem("cuycitoClient", JSON.stringify(currentClientUser));
        updateUIForUser();
        alert("✅ ¡Tus datos fueron actualizados exitosamente!");
        const modal = document.getElementById('editProfileModal');
        if(modal) modal.classList.add('hidden');
    } catch(e) {
        alert("❌ Ocurrió un error al actualizar tus datos.");
    }
};

// ==========================================
// 3. CATÁLOGO DINÁMICO DE TIENDA
// ==========================================
async function loadStoreCatalog() {
    const container = document.getElementById('catalogContainer');
    if(!container) return;
    try {
        const q = query(collection(db, "store_catalog"));
        const snap = await getDocs(q);
        
        let html = '';
        if(snap.empty) {
            html = `<div class="col-span-full py-10 text-center text-gray-500 flex flex-col items-center">
                        <i class="fa-solid fa-store-slash text-3xl mb-3 opacity-50"></i>
                        <p>Pronto añadiremos servicios geniales aquí.</p>
                    </div>`;
        } else {
            snap.forEach(doc => {
                const p = doc.data();
                const imgHTML = p.imageUrl && p.imageUrl.trim() !== '' 
                    ? `<img src="${p.imageUrl}" class="w-full h-32 object-cover rounded-t-xl" alt="Producto">` 
                    : `<div class="w-full h-32 bg-${p.colorClass} flex items-center justify-center text-white/30 text-4xl rounded-t-xl"><i class="fa-solid ${p.icon || 'fa-box'}"></i></div>`;

                html += `
                <div class="bg-[#121212] border border-gray-800 rounded-2xl hover:border-${p.colorClass}/50 transition duration-300 flex flex-col justify-between group">
                    <div class="relative">
                        ${p.promo ? `<span class="bg-cuycito-red text-white text-[9px] px-2 py-0.5 rounded uppercase font-black absolute top-2 right-2 shadow-lg">Oferta</span>` : ''}
                        ${imgHTML}
                    </div>
                    <div class="p-5">
                        <h3 class="text-base font-extrabold text-white group-hover:text-cuycito-gold transition">${p.title}</h3>
                        <p class="text-xs text-gray-400 mt-1 line-clamp-2">${p.description}</p>
                        <div class="pt-4 mt-4 border-t border-gray-800 flex items-center justify-between">
                            <div><span class="text-[10px] text-gray-400 block uppercase">Precio</span><span class="text-lg font-black text-cuycito-gold">S/ ${p.price.toFixed(2)}</span></div>
                            <button onclick="window.addToCart('${p.title}', ${p.price}, '${p.icon || 'fa-box'}', 'text-${p.colorClass}')" class="bg-cuycito-red hover:bg-cuycito-redHover text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 glow-red"><i class="fa-solid fa-cart-plus"></i> Agregar</button>
                        </div>
                    </div>
                </div>`;
            });
        }
        container.innerHTML = html;
    } catch (error) {
        console.error("Error cargando catálogo", error);
        container.innerHTML = '<p class="col-span-full text-center text-red-400">Error al conectar con el servidor.</p>';
    }
}
loadStoreCatalog();

// ==========================================
// 4. MIS SERVICIOS (PANEL DE CLIENTE)
// ==========================================
async function loadClientSubscriptions(clientName) {
    const tbody = document.getElementById('clientServicesBody');
    if(!tbody) return;
    try {
        // Busca las suscripciones activas usando el nombre del cliente
        const q = query(collection(db, "subscriptions"), where("person", "==", clientName));
        const snap = await getDocs(q);
        
        let html = '';
        if(snap.empty) {
            html = `<tr><td colspan="4" class="p-6 text-center text-gray-500 italic">No tienes servicios contratados. Visita nuestra tienda.</td></tr>`;
        } else {
            snap.forEach(doc => {
                const sub = doc.data();
                const today = new Date(); today.setHours(0,0,0,0);
                const endD = new Date(sub.endDate);
                const days = Math.ceil((endD - today) / 86400000);
                const badgeColor = days < 0 ? 'bg-cuycito-red/20 text-red-400 border-cuycito-red/50' : (days <= 3 ? 'bg-cuycito-gold/20 text-cuycito-gold border-cuycito-gold/50' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30');

                html += `
                <tr class="hover:bg-gray-800 transition">
                    <td class="p-4 font-bold text-white"><div class="flex items-center gap-2"><i class="fa-solid fa-play text-cuycito-gold"></i> ${sub.service}</div></td>
                    <td class="p-4 font-mono text-[11px] bg-black/30 rounded-lg border border-gray-800">
                        <span class="block text-gray-400">User: <strong class="text-white">${sub.email || '-'}</strong></span>
                        <span class="block text-gray-400">Pass: <strong class="text-cuycito-gold">${sub.pass || '-'}</strong></span>
                        <span class="block text-gray-400 mt-1">Perfil/PIN: <strong class="text-white">${sub.pin || '-'}</strong></span>
                    </td>
                    <td class="p-4 text-center font-mono text-gray-400 text-xs">${sub.endDate}</td>
                    <td class="p-4 text-center"><span class="border px-2.5 py-1 rounded text-[11px] font-black ${badgeColor}">${days < 0 ? 'Expiró' : days + ' días'}</span></td>
                </tr>`;
            });
        }
        tbody.innerHTML = html;
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-red-500 font-bold">Error de conexión.</td></tr>`;
    }
}

// ==========================================
// 5. SISTEMA DE CARRITO DE COMPRAS
// ==========================================
window.addToCart = (title, price, iconClass, colorClass) => {
    const existingIndex = cart.findIndex(item => item.title === title);
    if (existingIndex > -1) { cart[existingIndex].quantity += 1; } 
    else { cart.push({ title, price, quantity: 1, icon: iconClass, color: colorClass }); }
    renderCart();
};

window.updateQuantity = (title, change) => {
    const index = cart.findIndex(item => item.title === title);
    if (index > -1) {
        cart[index].quantity += change;
        if (cart[index].quantity <= 0) cart.splice(index, 1);
    }
    renderCart();
};

window.clearCart = () => { cart = []; renderCart(); };

function renderCart() {
    const container = document.getElementById('cartItemsContainer');
    const cartBadge = document.getElementById('cartBadge');
    const cartSubtotal = document.getElementById('cartSubtotal');
    const cartTotal = document.getElementById('cartTotal');

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if(cartBadge) cartBadge.innerText = totalItems;

    if (cart.length === 0) {
        if(container) container.innerHTML = `<div id="emptyCartMessage" class="text-center py-8 text-gray-500 space-y-2"><i class="fa-solid fa-basket-shopping text-3xl opacity-30"></i><p class="text-xs">Aún no has agregado ningún servicio.</p></div>`;
        if(cartSubtotal) cartSubtotal.innerText = "S/ 0.00"; 
        if(cartTotal) cartTotal.innerText = "S/ 0.00";
        return;
    }

    let html = ''; let totalAmount = 0;
    cart.forEach(item => {
        const itemSubtotal = item.price * item.quantity;
        totalAmount += itemSubtotal;
        html += `
        <div class="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-3 flex items-center justify-between gap-3 mb-2">
            <div class="flex items-center gap-2.5 overflow-hidden">
                <div class="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center ${item.color} text-sm flex-shrink-0 border border-gray-800"><i class="fa-solid ${item.icon}"></i></div>
                <div class="truncate">
                    <h4 class="text-xs font-bold text-white truncate">${item.title}</h4>
                    <span class="text-[10px] text-cuycito-gold font-semibold">S/ ${item.price.toFixed(2)} c/u</span>
                </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <div class="flex items-center bg-gray-900 border border-gray-800 rounded-lg">
                    <button onclick="window.updateQuantity('${item.title}', -1)" class="w-6 h-6 flex items-center justify-center text-xs text-gray-400 hover:text-cuycito-red transition">-</button>
                    <span class="text-xs font-bold px-1.5 text-white">${item.quantity}</span>
                    <button onclick="window.updateQuantity('${item.title}', 1)" class="w-6 h-6 flex items-center justify-center text-xs text-gray-400 hover:text-cuycito-gold transition">+</button>
                </div>
            </div>
        </div>`;
    });

    if(container) container.innerHTML = html;
    if(cartSubtotal) cartSubtotal.innerText = `S/ ${totalAmount.toFixed(2)}`;
    if(cartTotal) cartTotal.innerText = `S/ ${totalAmount.toFixed(2)}`;
}

window.sendWhatsAppOrder = () => {
    if (cart.length === 0) return alert("⚠️ Tu carrito está vacío.");
    
    const customerInput = document.getElementById('customerNameInput');
    const clientName = (customerInput && customerInput.value.trim()) || (currentClientUser ? currentClientUser.name : "Cliente Web");
    
    let message = `🚀 *NUEVO PEDIDO - CUYCITOGO* 🚀\n👤 *Cliente:* ${clientName}\n----------------------------------\n📋 *RESUMEN DE ITEMS:*\n\n`;
    let total = 0;
    
    cart.forEach((item, idx) => {
        const sub = item.price * item.quantity;
        total += sub;
        message += `${idx + 1}. *${item.title}*\n   └ Cantidad: ${item.quantity} x S/ ${item.price.toFixed(2)} = *S/ ${sub.toFixed(2)}*\n\n`;
    });
    
    message += `----------------------------------\n💰 *TOTAL A PAGAR: S/ ${total.toFixed(2)}*\n🔒 *Garantía:* 30 días activa\n\nQuedo a la espera de sus datos de pago para la entrega. ¡Gracias!`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${encodedMessage}`, '_blank');
};