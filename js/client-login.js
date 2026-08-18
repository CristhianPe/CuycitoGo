import { db, collection, getDocs, setDoc, doc, query, where } from './firebase-config.js';

// Si ya tiene sesión activa, redirigir directo a perfil.html
const existingSession = localStorage.getItem("cuycitoClient");
if (existingSession) {
    try {
        const user = JSON.parse(existingSession);
        if (user && user.phone) {
            window.location.replace('perfil.html');
        }
    } catch(e) {
        localStorage.removeItem("cuycitoClient");
    }
}

// Toggle de visibilidad de contraseña
window.togglePasswordVisibility = () => {
    const input = document.getElementById('loginPass');
    const toggleText = document.getElementById('pwdToggleText');
    if (!input || !toggleText) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        toggleText.innerText = 'Ocultar';
    } else {
        input.type = 'password';
        toggleText.innerText = 'Mostrar';
    }
};

// 1. Manejo del formulario de Login
const form = document.getElementById('clientLoginForm');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = document.getElementById('loginPhone').value.trim();
        const pass = document.getElementById('loginPass').value.trim();
        const btn = document.getElementById('btnLoginSubmit');
        const alertBox = document.getElementById('loginAlertBox');

        alertBox.classList.add('hidden');
        alertBox.innerText = '';
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando datos...';

        try {
            // VERIFICACIÓN DE CUENTA DEMO PARA PRUEBAS
            if (phone.toLowerCase() === 'cuycitogodemo' && pass === 'cuycito123') {
                const demoUser = {
                    id: "demo_cuycito_user",
                    name: "Cuycito Demo VIP 🐹",
                    nickname: "cuycitogodemo",
                    phone: "cuycitogodemo",
                    email: "demo@cuycitogo.pe",
                    pass: "cuycito123",
                    balance: 50.00, // S/ 50.00 de saldo para probar compras y descuentos
                    isDemo: true,
                    referredCodeUsed: "VIP-JUAN-7K9A",
                    referralDiscountUsed: false,
                    createdAt: new Date().toISOString()
                };

                try {
                    await setDoc(doc(db, "users", demoUser.id), demoUser, { merge: true });

                    const today = new Date();
                    const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                    const demoSubs = [
                        {
                            id: "sub_demo_netflix",
                            person: "Cuycito Demo VIP 🐹",
                            service: "Netflix",
                            email: "demo.netflix@cuycitogo.pe",
                            pass: "cuycitoVIP4K",
                            pin: "1234",
                            endDate: nextMonth,
                            isMasterActive: true,
                            isDemo: true
                        },
                        {
                            id: "sub_demo_hbo",
                            person: "Cuycito Demo VIP 🐹",
                            service: "HBO Max",
                            email: "demo.hbo@cuycitogo.pe",
                            pass: "cuycitoHBO2026",
                            pin: "4321",
                            endDate: nextMonth,
                            isMasterActive: true,
                            isDemo: true
                        },
                        {
                            id: "sub_demo_crunchyroll",
                            person: "Cuycito Demo VIP 🐹",
                            service: "Crunchyroll",
                            email: "demo.crunchy@cuycitogo.pe",
                            pass: "cuycitoAnime99",
                            pin: "",
                            endDate: nextMonth,
                            isMasterActive: true,
                            isDemo: true
                        }
                    ];

                    for (const s of demoSubs) {
                        await setDoc(doc(db, "subscriptions", s.id), s, { merge: true });
                    }
                } catch (errSync) {
                    console.warn("Sincronización Firestore en Demo (continuando local):", errSync);
                }

                localStorage.setItem("cuycitoClient", JSON.stringify(demoUser));
                btn.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-400"></i> ¡Acceso Concedido (Demo)!';
                
                setTimeout(() => {
                    window.location.replace('perfil.html');
                }, 400);
                return;
            }

            // Buscamos el usuario estándar por su número de teléfono o nickname y contraseña
            const q = query(
                collection(db, "users"), 
                where("phone", "==", phone), 
                where("pass", "==", pass)
            );
            const snap = await getDocs(q);

            if (!snap.empty) {
                const userData = snap.docs[0].data();
                if (!userData.nickname) {
                    userData.nickname = userData.name;
                }
                localStorage.setItem("cuycitoClient", JSON.stringify(userData));
                btn.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-400"></i> ¡Acceso Concedido!';
                
                setTimeout(() => {
                    window.location.replace('perfil.html');
                }, 400);
            } else {
                throw new Error("Usuario o contraseña incorrectos. Verifica tus credenciales.");
            }
        } catch (error) {
            console.error("Error en login:", error);
            alertBox.innerText = error.message || "Usuario o contraseña incorrectos.";
            alertBox.classList.remove('hidden');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Ingresar a Mi Cuenta';
        }
    });
}

// 2. Control de Pestañas (Iniciar Sesión vs Solicitar Cuenta Gratis)
window.switchAuthTab = (tab) => {
    const loginForm = document.getElementById('clientLoginForm');
    const registerForm = document.getElementById('clientRegisterForm');
    const tabLoginBtn = document.getElementById('tabAuthLoginBtn');
    const tabRegBtn = document.getElementById('tabAuthRegisterBtn');

    if (tab === 'register') {
        if (loginForm) loginForm.classList.add('hidden');
        if (registerForm) registerForm.classList.remove('hidden');
        if (tabLoginBtn) tabLoginBtn.className = "flex-1 pb-3 text-gray-500 hover:text-white border-b-2 border-transparent flex items-center justify-center gap-1.5 transition";
        if (tabRegBtn) tabRegBtn.className = "flex-1 pb-3 text-orange-400 border-b-2 border-orange-400 flex items-center justify-center gap-1.5 transition font-black";
    } else {
        if (loginForm) loginForm.classList.remove('hidden');
        if (registerForm) registerForm.classList.add('hidden');
        if (tabLoginBtn) tabLoginBtn.className = "flex-1 pb-3 text-cuycito-gold border-b-2 border-cuycito-gold flex items-center justify-center gap-1.5 transition font-black";
        if (tabRegBtn) tabRegBtn.className = "flex-1 pb-3 text-gray-500 hover:text-white border-b-2 border-transparent flex items-center justify-center gap-1.5 transition";
    }
};

// 3. Manejo de Solicitud de Cuenta Gratis VIP con Código de Referido
window.handleClientRegisterSubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const referralCode = document.getElementById('regReferralCode') ? document.getElementById('regReferralCode').value.trim().toUpperCase() : '';
    const btn = document.getElementById('btnRegisterSubmit');
    const alertBox = document.getElementById('registerAlertBox');

    if (!name || !phone) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando solicitud a verificación...';

    const reqId = "req_" + Date.now();
    const newRequest = {
        id: reqId,
        name: name,
        phone: phone,
        email: email || '',
        referralCode: referralCode || '',
        status: 'pending', // 'pending', 'approved', 'rejected'
        createdAt: new Date().toISOString()
    };

    // 1. Guardar en Firestore colección 'pending_registrations'
    try {
        await setDoc(doc(db, "pending_registrations", reqId), newRequest, { merge: true });
    } catch(errSync) {
        console.warn("Error guardando solicitud en Firestore (usando fallback local):", errSync);
    }

    // 2. Guardar en localStorage de respaldo
    try {
        let requests = JSON.parse(localStorage.getItem("cuycito_pending_registrations") || "[]");
        requests.unshift(newRequest);
        localStorage.setItem("cuycito_pending_registrations", JSON.stringify(requests));
    } catch(err) {}

    // 3. Guardar en leads
    try {
        let leads = JSON.parse(localStorage.getItem("cuycito_leads") || "[]");
        leads.push({ name, phone, email, referralCode, source: "register_form", date: new Date().toISOString() });
        localStorage.setItem("cuycito_leads", JSON.stringify(leads));
    } catch(err) {}

    // Disparar evento de alerta de registro para el Dashboard
    try {
        localStorage.setItem("cuycito_registration_alert_trigger", JSON.stringify({
            id: reqId,
            name: name,
            email: email || phone,
            phone: phone,
            referralCode: referralCode || 'Directo (Sin referido)',
            timestamp: Date.now()
        }));
    } catch(e) {}

    alertBox.innerHTML = `
        <div class="space-y-1 text-center">
            <div class="flex items-center justify-center gap-1.5 text-emerald-400 font-black text-sm">
                <i class="fa-solid fa-circle-check text-base"></i>
                <span>¡Solicitud enviada al Dashboard!</span>
            </div>
            <p class="text-xs text-gray-200">Tu petición está en estado <b>Pendiente de Verificación</b>. El administrador validará tus accesos en breve.</p>
        </div>
    `;
    alertBox.classList.remove('hidden');

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Solicitud Registrada Correctamente';
};

// 4. Auto-selección por parámetro URL (?tab=register, ?email=..., ?ref=...)
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'register') {
        window.switchAuthTab('register');
    }
    if (params.get('email')) {
        const regEmail = document.getElementById('regEmail');
        if (regEmail) regEmail.value = params.get('email');
    }
    const refParam = params.get('ref') || params.get('referral') || params.get('codigo');
    if (refParam) {
        const regRef = document.getElementById('regReferralCode');
        if (regRef) regRef.value = refParam.toUpperCase();
        window.switchAuthTab('register');
    }
});
