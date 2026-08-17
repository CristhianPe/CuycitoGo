import { db, collection, getDocs, query, where } from './firebase-config.js';

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
            // Buscamos el usuario por su número de teléfono y contraseña
            const q = query(
                collection(db, "users"), 
                where("phone", "==", phone), 
                where("pass", "==", pass)
            );
            const snap = await getDocs(q);

            if (!snap.empty) {
                const userData = snap.docs[0].data();
                // Si no tiene nickname registrado, asignamos por defecto su nombre completo
                if (!userData.nickname) {
                    userData.nickname = userData.name;
                }
                localStorage.setItem("cuycitoClient", JSON.stringify(userData));
                btn.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-400"></i> ¡Acceso Concedido!';
                
                setTimeout(() => {
                    window.location.replace('perfil.html');
                }, 400);
            } else {
                throw new Error("Número o contraseña incorrectos. Verifica tus credenciales.");
            }
        } catch (error) {
            console.error("Error en login:", error);
            alertBox.innerText = error.message || "Número o contraseña incorrectos.";
            alertBox.classList.remove('hidden');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Ingresar a Mi Cuenta';
        }
    });
}
