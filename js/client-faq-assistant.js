// ==========================================================================
// CUZCITOGO VIP - CONSOLA DE PREGUNTAS FRECUENTES Y CONDICIONES DE SERVICIO
// Basado en condiciones_de_servicios.txt (Navegación por Palabras Clave y Chips)
// ==========================================================================

const CUZCITO_CONDITIONS = {
    "netflix": {
        name: "Netflix 4K Ultra HD",
        badge: "SOLO TELEVISORES",
        badgeColor: "bg-red-600",
        icon: "fa-brands fa-netflix",
        color: "text-red-500",
        price: "S/ 13.00 / mes",
        quality: "4K Ultra HD • Dolby Vision • HDR",
        rules: [
            "🔒 **Pantalla privada exclusiva** con PIN personal de 4 dígitos.",
            "📺 **1 Activación = 1 TV** (Smart TV, Android TV, Google TV, Roku, Fire TV Stick).",
            "⚠️ **Activación SOLO en Televisores** (No apto para celulares ni navegadores).",
            "🚫 **Prohibido:** Modificar contraseña maestra, alterar el correo o ingresar a perfiles ajenos."
        ],
        ctaText: "Pedir Netflix 4K",
        buyPlatform: "NETFLIX"
    },
    "disney": {
        name: "Disney+ Premium con ESPN",
        badge: "SOLO TELEVISORES",
        badgeColor: "bg-blue-600",
        icon: "fa-solid fa-film",
        color: "text-blue-400",
        price: "S/ 12.00 / mes",
        quality: "4K Ultra HD • IMAX Enhanced • Audio 5.1",
        rules: [
            "⚽ **Deportes en Vivo:** Incluye todos los canales de ESPN (Champions, Premier, F1, UFC).",
            "🎬 **Catálogo:** Todo Disney, Pixar, Marvel, Star Wars y Star+.",
            "📺 **1 Activación = 1 TV** (Activación SOLO en televisores).",
            "🚫 **Prohibido:** Compartir credenciales con personas fuera de tu televisor asignado."
        ],
        ctaText: "Pedir Disney+ con ESPN",
        buyPlatform: "DISNEY"
    },
    "max": {
        name: "Max Platino HBO",
        badge: "SOLO TELEVISORES",
        badgeColor: "bg-purple-600",
        icon: "fa-solid fa-crown",
        color: "text-purple-400",
        price: "S/ 11.00 / mes",
        quality: "4K UHD • HDR10+ • Sonido Dolby Atmos",
        rules: [
            "🍿 **Contenido:** Estrenos de cine Warner Bros, series de HBO, Discovery y Adult Swim.",
            "📺 **1 Activación = 1 TV** (Activación SOLO en televisores).",
            "🚫 **Prohibido:** Alterar configuraciones de cuenta o intentar crear perfiles adicionales."
        ],
        ctaText: "Pedir Max Platino",
        buyPlatform: "MAX"
    },
    "prime": {
        name: "Amazon Prime Video",
        badge: "SOLO TELEVISORES",
        badgeColor: "bg-amber-600",
        icon: "fa-brands fa-amazon",
        color: "text-amber-400",
        price: "S/ 9.00 / mes",
        quality: "4K UHD • HDR",
        rules: [
            "🎬 **Contenido:** Series originales Amazon Originals y películas taquilleras.",
            "📺 **1 Activación = 1 TV** (Activación SOLO en televisores).",
            "🚫 **Prohibido:** Realizar compras de alquiler digital o suscribirse a canales de pago."
        ],
        ctaText: "Pedir Prime Video",
        buyPlatform: "PRIME"
    },
    "crunchyroll": {
        name: "Crunchyroll Mega Fan",
        badge: "CORREO Y CONTRASEÑA",
        badgeColor: "bg-orange-600",
        icon: "fa-solid fa-dragon",
        color: "text-orange-400",
        price: "S/ 9.00 / mes",
        quality: "1080p Full HD 60fps • Simulcast",
        rules: [
            "🔑 **Modalidad de Entrega:** Se te entregan credenciales exclusivas (**Correo y Contraseña**) para iniciar sesión directamente.",
            "⚔️ **Simulcast:** Episodios el mismo día de estreno en Japón sin publicidad.",
            "📱 **Compatibilidad Total:** Smart TV, PC, celulares y tabletas.",
            "📥 **Descarga Offline:** Descarga episodios para ver sin internet."
        ],
        ctaText: "Pedir Crunchyroll",
        buyPlatform: "CRUNCHYROLL"
    },
    "spotify": {
        name: "Spotify Hi-Fi Premium",
        badge: "CUENTA DIRECTA",
        badgeColor: "bg-emerald-600",
        icon: "fa-brands fa-spotify",
        color: "text-emerald-400",
        price: "S/ 8.00 / mes",
        quality: "Audio Ultra Alta Calidad (320kbps / Hi-Fi)",
        rules: [
            "👤 **Con tu misma cuenta personal:** No pierdes tus playlists, canciones favoritas ni seguidores.",
            "🎧 **Sin Anuncios:** Música y podcasts ilimitados con saltos de canciones infinitos.",
            "📱 **Compatibilidad:** Móvil, PC, TV, parlantes inteligentes y reloj."
        ],
        ctaText: "Pedir Spotify Premium",
        buyPlatform: "SPOTIFY"
    },
    "activacion_tv": {
        name: "¿Cómo activar mi televisor?",
        badge: "GUÍA TÉCNICA",
        badgeColor: "bg-yellow-600",
        icon: "fa-solid fa-tv",
        color: "text-yellow-400",
        price: "Activación Rápida",
        quality: "Smart TVs • Android TV • Google TV • Roku • Fire Stick",
        rules: [
            "1️⃣ Abre la app oficial en tu televisor (Netflix, Disney+, Max, etc.).",
            "2️⃣ Selecciona **'Iniciar Sesión'** ➔ Verás un código en tu pantalla o enlace web.",
            "3️⃣ Envía el código a tu asesor de CuzcitoGo y tu pantalla se activará en segundos con tu PIN personal.",
            "💡 **Nota:** Recuerda que las pantallas de TV están configuradas para reproducir exclusivamente en ese televisor."
        ],
        ctaText: "Contactar a Soporte TV",
        buyPlatform: null
    },
    "garantia": {
        name: "Garantía & Política de Uso",
        badge: "PROTECCIÓN TOTAL",
        badgeColor: "bg-emerald-600",
        icon: "fa-solid fa-shield-halved",
        color: "text-emerald-400",
        price: "30 Días de Garantía",
        quality: "Soporte Continuo CuzcitoGo VIP",
        rules: [
            "🛡️ **Garantía Total de 30 Días:** Si hay alguna desconexión o actualización de cuenta, el soporte técnico la soluciona o renueva inmediatamente.",
            "🔄 **Renovación Puntual:** Renueva antes del día 30 para mantener tu mismo perfil e historial.",
            "🚫 **Seguridad:** Prohibido cambiar contraseñas generales o revender accesos. El incumplimiento cancela el servicio sin reembolso."
        ],
        ctaText: "Ver Catálogo",
        buyPlatform: null
    }
};

// ==========================================================================
// RENDERIZADO DEL WIDGET FLOTANTE / MODAL DE PREGUNTAS FRECUENTES
// ==========================================================================
function injectFaqWidget() {
    if (document.getElementById('cuzcitoFaqWidget')) return;

    const widgetHtml = `
        <!-- BOTÓN FLOTANTE DE AYUDA Y CONDICIONES (IZQUIERDA PARA NO CHOCAR CON CARRITO) -->
        <button 
            id="btnToggleFaqModal" 
            onclick="window.toggleFaqModal()" 
            class="fixed bottom-6 left-6 z-40 bg-gradient-to-r from-amber-600 via-cuycito-gold to-yellow-400 hover:from-amber-500 hover:to-yellow-300 text-black font-black text-xs px-4 py-3 rounded-full shadow-2xl glow-gold flex items-center gap-2 transform hover:scale-105 transition duration-300 cursor-pointer border border-yellow-300/40"
            title="Preguntas frecuentes y condiciones de servicios"
        >
            <i class="fa-solid fa-circle-question text-base"></i>
            <span class="hidden sm:inline">Condiciones & FAQ</span>
        </button>

        <!-- MODAL DE PREGUNTAS FRECUENTES Y CONDICIONES -->
        <div id="cuzcitoFaqModal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
            <div class="bg-[#121212] border-2 border-cuycito-gold/50 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden glow-gold">
                
                <!-- Encabezado del Modal -->
                <div class="bg-gradient-to-r from-[#181818] via-[#121212] to-[#181818] border-b border-gray-800 p-4 sm:p-5 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-amber-950/80 border border-yellow-500/40 text-cuycito-gold flex items-center justify-center text-xl shadow">
                            <i class="fa-solid fa-shield-halved"></i>
                        </div>
                        <div>
                            <h3 class="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                                Condiciones de Servicios & FAQ <span class="bg-yellow-950 text-yellow-300 border border-yellow-500/30 text-[9px] font-bold px-2 py-0.5 rounded-full">Oficial</span>
                            </h3>
                            <p class="text-[11px] text-gray-400">Selecciona un servicio para conocer sus reglas de activación y precios.</p>
                        </div>
                    </div>
                    <button onclick="window.toggleFaqModal()" class="w-8 h-8 rounded-full bg-black/60 hover:bg-red-900/60 text-gray-400 hover:text-white border border-gray-700 flex items-center justify-center transition">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Barra de Búsqueda Rápida por Palabra Clave -->
                <div class="p-4 border-b border-gray-800/80 bg-black/40 space-y-2">
                    <div class="relative">
                        <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
                        <input 
                            type="text" 
                            id="faqKeywordInput" 
                            placeholder="Escribe una palabra clave (ej: tv, netflix, pin, precio, spotify)..." 
                            oninput="window.handleFaqKeywordSearch(this.value)"
                            class="w-full bg-black border border-gray-700 focus:border-cuycito-gold rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 outline-none transition"
                        >
                    </div>

                    <!-- Chips de Palabras Clave / Botones de Servicios -->
                    <div class="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-[11px]">
                        <button onclick="window.showFaqCondition('netflix')" class="bg-black hover:bg-red-950/80 border border-red-800/60 text-red-300 px-2.5 py-1 rounded-lg font-bold transition shrink-0 flex items-center gap-1">
                            🔴 Netflix
                        </button>
                        <button onclick="window.showFaqCondition('disney')" class="bg-black hover:bg-blue-950/80 border border-blue-800/60 text-blue-300 px-2.5 py-1 rounded-lg font-bold transition shrink-0 flex items-center gap-1">
                            🔵 Disney+ ESPN
                        </button>
                        <button onclick="window.showFaqCondition('max')" class="bg-black hover:bg-purple-950/80 border border-purple-800/60 text-purple-300 px-2.5 py-1 rounded-lg font-bold transition shrink-0 flex items-center gap-1">
                            🟣 Max HBO
                        </button>
                        <button onclick="window.showFaqCondition('prime')" class="bg-black hover:bg-amber-950/80 border border-amber-800/60 text-amber-300 px-2.5 py-1 rounded-lg font-bold transition shrink-0 flex items-center gap-1">
                            🟡 Prime Video
                        </button>
                        <button onclick="window.showFaqCondition('crunchyroll')" class="bg-black hover:bg-orange-950/80 border border-orange-800/60 text-orange-300 px-2.5 py-1 rounded-lg font-bold transition shrink-0 flex items-center gap-1">
                            🟠 Crunchyroll
                        </button>
                        <button onclick="window.showFaqCondition('spotify')" class="bg-black hover:bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 px-2.5 py-1 rounded-lg font-bold transition shrink-0 flex items-center gap-1">
                            🟢 Spotify
                        </button>
                        <button onclick="window.showFaqCondition('activacion_tv')" class="bg-gray-900 hover:bg-gray-800 border border-gray-700 text-yellow-300 px-2.5 py-1 rounded-lg font-bold transition shrink-0 flex items-center gap-1">
                            📺 Activar en TV
                        </button>
                        <button onclick="window.showFaqCondition('garantia')" class="bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 px-2.5 py-1 rounded-lg font-bold transition shrink-0 flex items-center gap-1">
                            🛡️ Garantía
                        </button>
                    </div>
                </div>

                <!-- Contenido Dinámico de la Condición Seleccionada -->
                <div id="faqContentBody" class="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
                    <!-- Se inyecta la información del servicio -->
                </div>

            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', widgetHtml);
}

// Alternar visibilidad del modal
window.toggleFaqModal = () => {
    const modal = document.getElementById('cuzcitoFaqModal');
    if (!modal) return;
    const isHidden = modal.classList.contains('hidden');
    if (isHidden) {
        modal.classList.remove('hidden');
        window.showFaqCondition('netflix'); // Por defecto abre Netflix
    } else {
        modal.classList.add('hidden');
    }
};

// Mostrar ficha de condición de servicio
window.showFaqCondition = (key) => {
    const container = document.getElementById('faqContentBody');
    const data = CUZCITO_CONDITIONS[key.toLowerCase()];
    if (!container || !data) return;

    container.innerHTML = `
        <div class="space-y-4 animate-fade-in">
            
            <!-- Tarjeta Principal de Resumen -->
            <div class="bg-black/70 border border-gray-800 rounded-2xl p-4 sm:p-5 space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800/80 pb-3">
                    <div class="flex items-center gap-2.5">
                        <i class="${data.icon} ${data.color} text-2xl"></i>
                        <div>
                            <h4 class="text-base font-black text-white">${data.name}</h4>
                            <span class="text-[11px] text-gray-400 font-mono">${data.quality}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="${data.badgeColor} text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                            ${data.badge}
                        </span>
                        <div class="text-xs font-black text-cuycito-gold mt-1 font-mono">${data.price}</div>
                    </div>
                </div>

                <!-- Lista de Reglas y Condiciones -->
                <div class="space-y-2 pt-1 text-xs text-gray-300">
                    ${data.rules.map(rule => {
                        // Formatear negritas de markdown
                        const formatted = rule.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>');
                        return `<div class="flex items-start gap-2 leading-relaxed">
                            <span class="text-cuycito-gold mt-0.5">•</span>
                            <div>${formatted}</div>
                        </div>`;
                    }).join('')}
                </div>
            </div>

            <!-- Botones de Acción Inmediata -->
            <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span class="text-[11px] text-gray-400 flex items-center gap-1.5">
                    <i class="fa-solid fa-check text-emerald-400"></i> Stock verificado en tiempo real
                </span>

                <div class="flex items-center gap-2">
                    ${data.buyPlatform ? `
                        <button onclick="window.buyServiceFromFaq('${data.buyPlatform}')" class="bg-gradient-to-r from-amber-600 via-cuycito-gold to-yellow-400 hover:from-amber-500 hover:to-yellow-300 text-black font-black text-xs px-4 py-2.5 rounded-xl transition shadow glow-gold flex items-center gap-1.5 uppercase tracking-wider">
                            <i class="fa-solid fa-cart-shopping text-black"></i>
                            <span>${data.ctaText}</span>
                        </button>
                    ` : `
                        <button onclick="window.requestInternalSupport('${data.name}')" class="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs px-4 py-2.5 rounded-xl transition shadow flex items-center gap-1.5 uppercase tracking-wider">
                            <i class="fa-solid fa-headset"></i>
                            <span>Solicitar Asesoría VIP</span>
                        </button>
                    `}
                </div>
            </div>

        </div>
    `;
};

// Solicitar soporte interno sin exponer número personal
window.requestInternalSupport = (serviceName) => {
    window.toggleFaqModal();
    alert(`💬 Soporte CuzcitoGo VIP:\n\nTu consulta sobre "${serviceName}" ha sido registrada. Nuestro equipo de atención te asistirá directamente desde tu panel.`);
};

// Búsqueda en vivo por palabras clave
window.handleFaqKeywordSearch = (query) => {
    const q = query.toLowerCase().trim();
    if (!q) {
        window.showFaqCondition('netflix');
        return;
    }

    if (q.includes('netflix')) window.showFaqCondition('netflix');
    else if (q.includes('disney') || q.includes('espn') || q.includes('futbol') || q.includes('champions')) window.showFaqCondition('disney');
    else if (q.includes('max') || q.includes('hbo') || q.includes('warner')) window.showFaqCondition('max');
    else if (q.includes('prime') || q.includes('amazon')) window.showFaqCondition('prime');
    else if (q.includes('crunchyroll') || q.includes('anime') || q.includes('japon')) window.showFaqCondition('crunchyroll');
    else if (q.includes('spotify') || q.includes('musica') || q.includes('cancion')) window.showFaqCondition('spotify');
    else if (q.includes('tv') || q.includes('tele') || q.includes('activar') || q.includes('codigo') || q.includes('smart')) window.showFaqCondition('activacion_tv');
    else if (q.includes('garantia') || q.includes('renovar') || q.includes('soporte') || q.includes('regla')) window.showFaqCondition('garantia');
};

// Añadir al carrito o abrir pasarela
window.buyServiceFromFaq = (platform) => {
    window.toggleFaqModal();
    if (typeof window.addToCart === 'function') {
        const idMap = {
            "NETFLIX": "netflix-4k",
            "DISNEY": "disney-premium",
            "MAX": "max-platino",
            "PRIME": "prime-video",
            "CRUNCHYROLL": "crunchyroll-mega",
            "SPOTIFY": "spotify-premium"
        };
        const serviceId = idMap[platform] || "netflix-4k";
        window.addToCart(serviceId);
    } else {
        window.location.href = "index.html#catalogo";
    }
};

// Auto-inicializar ÚNICAMENTE en el perfil del cliente (perfil.html)
document.addEventListener('DOMContentLoaded', () => {
    const isProfilePage = window.location.pathname.includes('perfil.html') || document.getElementById('profileEmail') || document.getElementById('userProfileCard');
    if (isProfilePage) {
        injectFaqWidget();
    }
});
