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

// Manejo del formulario de Login
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
                    balance: 999999.00,
                    isDemo: true,
                    createdAt: new Date().toISOString()
                };

                // Asegurar registro de cuenta Demo y 3 suscripciones activas en Firestore para desbloquear juegos
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

