import { db, collection, getDocs, getDoc, doc, setDoc } from "./firebase-config.js";

const CENTRAL_WHATSAPP_PHONE = "";

let catalogProducts = [];
let masterAccounts = [];
let cart = [];
let activeCategory = 'ALL';

// Inicialización de la Tienda al Cargar la Página
document.addEventListener('DOMContentLoaded', async () => {
    initAuthStatus();
    loadCartFromStorage();
    await loadStoreCatalog();
});

// ==========================================
// 1. ESTADO DE AUTENTICACIÓN DEL CLIENTE
// ==========================================
function initAuthStatus() {
    const clientSession = localStorage.getItem("cuycitoClient");
    const container = document.getElementById('userAuthContainer');
    if (!container) return;

    if (clientSession) {
        try {
            const user = JSON.parse(clientSession);
            const nickname = user.nickname || user.name || 'Cliente';
            container.innerHTML = `
                <a href="perfil.html" class="flex items-center gap-2 bg-black/80 hover:bg-gray-900 border border-cuycito-gold/60 text-cuycito-gold px-3.5 py-2 rounded-xl text-xs font-black transition glow-gold shadow">
                    <i class="fa-solid fa-user-check text-emerald-400"></i>
                    <span>@${nickname}</span>
                </a>
            `;
        } catch (e) {
            renderLoginButton(container);
        }
    } else {
        renderLoginButton(container);
    }
}

function renderLoginButton(container) {
    container.innerHTML = `
        <a href="login-cliente.html" class="flex items-center gap-2 bg-gradient-to-r from-cuycito-gold to-yellow-400 hover:from-yellow-400 hover:to-cuycito-gold text-black px-4 py-2 rounded-xl text-xs font-black transition shadow glow-gold">
            <i class="fa-solid fa-arrow-right-to-bracket"></i>
            <span>Iniciar Sesión</span>
        </a>
    `;
}

// ==========================================
// 2. CARGA DE PRODUCTOS & STOCK DESDE FIREBASE
// ==========================================
async function loadStoreCatalog() {
    const loadingState = document.getElementById('catalogLoadingState');
    const grid = document.getElementById('catalogGrid');

    try {
        // 1. Leer Cuentas Raíz para cálculo de stock dinámico en vivo
        const masterSnap = await getDocs(collection(db, "masterAccounts"));
        masterAccounts = [];
        masterSnap.forEach(doc => {
            masterAccounts.push({ id: doc.id, ...doc.data() });
        });

        // 2. Leer Catálogo Web
        const catalogSnap = await getDocs(collection(db, "store_catalog"));
        catalogProducts = [];
        catalogSnap.forEach(doc => {
            const data = { id: doc.id, ...doc.data() };

            // Cálculo en tiempo real de stock si está enlazado a Cuenta Raíz o a Servicio Combinado
            if (data.linkedService) {
                const matchingAccounts = masterAccounts.filter(m => (m.service || '').toLowerCase() === data.linkedService.toLowerCase());
                if (matchingAccounts.length > 0) {
                    const totalFreeSlots = matchingAccounts.reduce((sum, m) => {
                        const occupied = (m.profiles || []).filter(p => p !== null).length;
                        return sum + Math.max(0, m.capacity - occupied);
                    }, 0);
                    data.stock = totalFreeSlots;
                }
            } else if (data.linkedMasterId) {
                const masterAcc = masterAccounts.find(m => m.id === data.linkedMasterId);
                if (masterAcc) {
                    const occupied = (masterAcc.profiles || []).filter(p => p !== null).length;
                    data.stock = Math.max(0, masterAcc.capacity - occupied);
                }
            }

            catalogProducts.push(data);
        });

        if (catalogProducts.length === 0) {
            catalogProducts = [
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
                    category: "Streaming",
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
                    category: "Streaming",
                    description: "1 Perfil Privado con PIN personalizado. Calidad 4K Ultra HD, ESPN y garantía 100% durante 30 días.",
                    price: 10.00,
                    imageUrl: "assets/img/banner_disney.svg",
                    promo: false,
                    stock: 15
                },
                {
                    id: "prod_prime_1p",
                    title: "Prime Video Premium 4K - 1 Perfil Privado",
                    category: "Streaming",
                    description: "1 Perfil Privado con PIN personalizado. Calidad 4K Ultra HD y acceso a todas las series Amazon Originals.",
                    price: 6.00,
                    imageUrl: "assets/img/banner_prime.svg",
                    promo: false,
                    stock: 12
                },
                {
                    id: "prod_max_1p",
                    title: "Max Platino 4K - 1 Perfil Privado",
                    category: "Streaming",
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
        }

        if (loadingState) loadingState.classList.add('hidden');
        renderProducts(catalogProducts);

    } catch (error) {
        console.error("Error al cargar el catálogo de Firebase:", error);
        if (loadingState) {
            loadingState.classList.add('hidden');
        }
        // Fallback inmediato
        renderProducts([
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
                category: "Streaming",
                description: "1 Perfil Privado con PIN personalizado. Calidad 4K Ultra HD y garantía 100% durante 30 días.",
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
            }
        ]);
    }
}

// ==========================================
// 3. FILTROS Y RENDERIZADO DE PRODUCTOS
// ==========================================
window.filterByCategory = (category) => {
    activeCategory = category;

    // Actualizar estilo visual de los botones de filtro
    const buttons = document.querySelectorAll('.cat-pill');
    buttons.forEach(btn => {
        const cat = btn.getAttribute('data-category');
        if (cat === category) {
            btn.className = 'cat-pill active bg-cuycito-red text-white px-4 py-2 rounded-xl whitespace-nowrap transition shadow glow-red';
        } else if (cat === 'OFERTA') {
            btn.className = 'cat-pill bg-black hover:bg-gray-900 border border-gray-800 text-cuycito-red hover:text-red-400 px-4 py-2 rounded-xl whitespace-nowrap transition flex items-center gap-1.5';
        } else {
            btn.className = 'cat-pill bg-black hover:bg-gray-900 border border-gray-800 text-gray-300 hover:text-cuycito-gold px-4 py-2 rounded-xl whitespace-nowrap transition';
        }
    });

    window.filterCatalog();
};

window.filterCatalog = () => {
    const grid = document.getElementById('catalogGrid');
    if (!grid) return;

    const searchTerm = (document.getElementById('storeSearchInput')?.value || '').toLowerCase().trim();
    const sortOrder = document.getElementById('storeSortSelect')?.value || 'featured';

    let filtered = catalogProducts.filter(item => {
        const matchSearch = (item.title || '').toLowerCase().includes(searchTerm) || 
                            (item.description || '').toLowerCase().includes(searchTerm) ||
                            (item.category || '').toLowerCase().includes(searchTerm) ||
                            ((item.comboServices || []).some(s => (s.service || '').toLowerCase().includes(searchTerm)));

        let matchCategory = true;
        const isCombo = item.isCombo === true || (item.category || '').toLowerCase() === 'combos' || (item.title || '').toLowerCase().includes('combo') || (item.comboServices && item.comboServices.length > 0);
        if (activeCategory === 'OFERTA') {
            matchCategory = !!item.promo || !!item.isOffer || isCombo;
        } else if (activeCategory === 'Combos') {
            matchCategory = isCombo;
        } else if (activeCategory !== 'ALL') {
            matchCategory = (item.category || '').toLowerCase() === activeCategory.toLowerCase() ||
                            (item.title || '').toLowerCase().includes(activeCategory.toLowerCase());
        }

        return matchSearch && matchCategory;
    });

    // Ordenamiento
    if (sortOrder === 'price_asc') {
        filtered.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
    } else if (sortOrder === 'price_desc') {
        filtered.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
    } else if (sortOrder === 'promo_first') {
        filtered.sort((a, b) => (b.promo ? 1 : 0) - (a.promo ? 1 : 0));
    }

    renderProducts(filtered);
};

function resolveProductImage(p) {
    if (p && p.imageUrl && typeof p.imageUrl === 'string') {
        const clean = p.imageUrl.trim();
        if (clean !== '' && clean !== 'undefined' && clean !== 'null') {
            return clean;
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
    if (title.includes('chatgpt') || title.includes('gpt') || title.includes('openai') || title.includes('claude') || title.includes('gemini') || title.includes('midjourney') || title.includes('deepseek') || cat.includes('ai') || cat.includes('ia')) {
        return 'assets/img/banner_ai.svg';
    }
    if (title.includes('canva') || title.includes('office') || title.includes('capcut') || title.includes('adobe') || title.includes('freepik') || cat.includes('productiv')) {
        return 'assets/img/banner_productivity.svg';
    }
    if (title.includes('netflix')) {
        return 'assets/img/promo_netflix_4k.jpg';
    }

    return 'assets/img/promo_netflix_4k.jpg';
}

function renderProducts(filtered) {
    const grid = document.getElementById('catalogGrid');
    if (!grid) return;

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-16 text-center text-gray-500 space-y-3 bg-[#121212] rounded-3xl border border-gray-800 p-8">
                <i class="fa-solid fa-box-open text-4xl text-gray-600"></i>
                <p class="text-sm font-semibold text-gray-400">No encontramos productos con esos filtros en este momento.</p>
                <button onclick="window.filterByCategory('ALL'); document.getElementById('storeSearchInput').value='';" class="bg-cuycito-gold text-black font-extrabold text-xs px-4 py-2 rounded-xl transition shadow">
                    Ver todos los servicios
                </button>
            </div>
        `;
        return;
    }

    let html = '';
    filtered.forEach(p => {
        const isCombo = p.isCombo || p.category === 'Combos';
        const price = parseFloat(p.price) || 0;
        const categoryTag = p.category || (isCombo ? 'Combos' : 'Streaming');
        const stock = p.stock !== undefined ? p.stock : 5;
        const hasStock = stock > 0;

        const stockBadge = hasStock 
            ? `<span class="bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1"><i class="fa-solid fa-boxes-stacked"></i> Stock: ${stock} libres</span>`
            : `<span class="bg-red-950/80 text-red-400 border border-cuycito-red/50 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1"><i class="fa-solid fa-circle-xmark"></i> Agotado</span>`;

        const finalImage = resolveProductImage(p);
        const imageHTML = `<img src="${finalImage}" alt="${p.title}" class="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-500">`;

        const actionButtonsHTML = hasStock 
            ? `
                <button onclick="window.addToCart('${p.id}')" class="bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 hover:from-orange-400 hover:to-emerald-400 text-black font-black text-xs px-4 py-2.5 rounded-xl transition shadow-lg glow-gold flex items-center gap-1.5 shrink-0 uppercase tracking-wider">
                    <i class="fa-solid fa-cart-plus text-sm"></i> Añadir al Carrito
                </button>
            `
            : `
                <span class="bg-gray-950 text-gray-500 border border-gray-800 font-bold text-xs px-3 py-2 rounded-xl">Agotado</span>
            `;

        // Renderizado especial para COMBOS
        if (isCombo) {
            let comboBadgesHTML = '';
            if (p.comboServices && p.comboServices.length > 0) {
                comboBadgesHTML = `
                <div class="flex flex-wrap items-center gap-1.5 my-2">
                    ${p.comboServices.map(s => `
                        <span class="bg-black/90 border border-cuycito-gold/40 text-cuycito-gold text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shadow">
                            <span>${s.service}</span>
                            <span class="text-gray-400 font-mono text-[9px] font-normal">(S/ ${(s.comboPrice || 0).toFixed(2)})</span>
                        </span>
                    `).join('<span class="text-cuycito-red font-black text-xs">+</span>')}
                </div>`;
            }

            let advantagesHTML = '';
            if (p.advantages && p.advantages.length > 0) {
                advantagesHTML = `
                <div class="space-y-1 my-2 bg-black/40 p-2.5 rounded-xl border border-gray-800/80">
                    ${p.advantages.slice(0, 4).map(adv => `
                        <div class="text-[11px] text-gray-300 flex items-center gap-1.5">
                            <i class="fa-solid fa-circle-check text-emerald-400 text-[10px] flex-shrink-0"></i>
                            <span class="line-clamp-1">${adv.replace(/^✔\s*/, '')}</span>
                        </div>
                    `).join('')}
                </div>`;
            }

            const savingsPercent = p.savingsPercent || (p.regularPriceTotal ? Math.round(((p.regularPriceTotal - price) / p.regularPriceTotal) * 100) : 25);
            const savingsAmount = p.savingsAmount || (p.regularPriceTotal ? (p.regularPriceTotal - price) : 0);

            html += `
            <div class="bg-[#121212] border-2 border-cuycito-gold/50 rounded-3xl overflow-hidden hover:border-cuycito-gold transition-all duration-300 flex flex-col justify-between group shadow-[0_0_20px_rgba(255,183,3,0.15)] hover:shadow-[0_0_30px_rgba(255,183,3,0.3)]">
                
                <!-- Imagen y Badges Combo -->
                <div class="relative overflow-hidden bg-black">
                    <div class="absolute top-3 left-3 z-10 bg-gradient-to-r from-cuycito-red via-red-600 to-amber-600 text-white text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-wider shadow-lg flex items-center gap-1.5 glow-red">
                        <i class="fa-solid fa-gift text-cuycito-gold"></i> COMBO AHORRO -${savingsPercent}%
                    </div>
                    
                    <span class="absolute top-3 right-3 z-10 bg-black/90 backdrop-blur-md border border-cuycito-gold/50 text-cuycito-gold text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase">
                        ${categoryTag}
                    </span>

                    ${imageHTML}
                </div>

                <!-- Contenido Informativo Combo -->
                <div class="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                        <h3 class="text-base font-black text-white group-hover:text-cuycito-gold transition line-clamp-2">
                            ${p.title}
                        </h3>
                        ${comboBadgesHTML}
                        <p class="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                            ${p.description || 'Disfruta de múltiples plataformas con perfiles privados independientes, 4K y garantía total.'}
                        </p>
                        ${advantagesHTML}
                    </div>

                    <div class="pt-3 border-t border-gray-800/80 space-y-2">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-1.5">
                                ${p.regularPriceTotal ? `<span class="text-xs text-gray-500 line-through font-mono">S/ ${p.regularPriceTotal.toFixed(2)}</span>` : ''}
                                ${savingsAmount > 0 ? `<span class="bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-[10px] font-black px-1.5 py-0.5 rounded">Ahorras S/ ${savingsAmount.toFixed(2)}</span>` : ''}
                            </div>
                            ${stockBadge}
                        </div>
                        <div class="flex items-center justify-between">
                            <div>
                                <span class="text-[9px] uppercase tracking-wider text-gray-500 block font-bold">Precio Promo Combo</span>
                                <span class="text-2xl font-black text-cuycito-gold glow-gold">S/ ${price.toFixed(2)}</span>
                            </div>
                            ${actionButtonsHTML}
                        </div>
                    </div>
                </div>
            </div>`;

        } else {
            // Renderizado Estándar
            html += `
            <div class="bg-[#121212] border border-gray-800/80 rounded-3xl overflow-hidden hover:border-cuycito-gold/50 transition-all duration-300 flex flex-col justify-between group shadow-xl hover:shadow-2xl">
                
                <!-- Imagen y Badges -->
                <div class="relative overflow-hidden bg-black">
                    ${p.promo ? `
                    <div class="absolute top-3 left-3 z-10 bg-gradient-to-r from-cuycito-red to-red-700 text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-lg flex items-center gap-1 glow-red">
                        <i class="fa-solid fa-fire animate-pulse"></i> Oferta Especial
                    </div>` : ''}
                    
                    <span class="absolute top-3 right-3 z-10 bg-black/80 backdrop-blur-md border border-gray-800 text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                        ${categoryTag}
                    </span>

                    ${imageHTML}
                </div>

                <!-- Contenido Informativo -->
                <div class="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                        <h3 class="text-base font-black text-white group-hover:text-cuycito-gold transition line-clamp-1">
                            ${p.title}
                        </h3>

                        <!-- Badges de Cuenta Compartida / Perfil Privado -->
                        <div class="flex items-center gap-1.5 my-2 flex-wrap text-[10px] font-bold">
                            <span class="bg-black/90 border border-gray-800 text-sky-400 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <i class="fa-solid fa-users"></i> Cuenta Compartida
                            </span>
                            <span class="bg-black/90 border border-gray-800 text-emerald-400 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <i class="fa-solid fa-lock"></i> PIN Privado
                            </span>
                            <span class="bg-black/90 border border-gray-800 text-gray-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <i class="fa-solid fa-tv"></i> 1 Pantalla
                            </span>
                        </div>

                        <p class="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                            ${p.description || 'Perfil personal privado con PIN propio. Entrega inmediata con garantía 100% durante todo tu mes.'}
                        </p>
                    </div>

                    <div class="pt-3 border-t border-gray-800/80 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-[9px] uppercase tracking-wider text-gray-500 block font-bold">Precio en Soles</span>
                            ${stockBadge}
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xl font-black text-cuycito-gold">S/ ${price.toFixed(2)}</span>
                            ${actionButtonsHTML}
                        </div>
                    </div>
                </div>
            </div>`;
        }
    });

    grid.innerHTML = html;
}

// 4. CARRITO DE COMPRAS & PEDIDOS WHATSAPP OFICIAL

// Envío del pedido a WhatsApp Oficial con detalle de productos y suma total

// Compra rápida directa para un solo producto (WhatsApp Oficial)
window.toggleCartDrawer = () => {
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('cartDrawerBackdrop');
    if (!drawer || !backdrop) return;

    if (drawer.classList.contains('translate-x-full')) {
        drawer.classList.remove('translate-x-full');
        backdrop.classList.remove('hidden');
    } else {
        drawer.classList.add('translate-x-full');
        backdrop.classList.add('hidden');
    }
};

window.addToCart = (productId) => {
    const product = catalogProducts.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            title: product.title,
            price: parseFloat(product.price) || 0,
            quantity: 1,
            category: product.category || 'Streaming',
            isCombo: !!product.isCombo,
            comboServices: product.comboServices || [],
            savingsPercent: product.savingsPercent || 0,
            regularPriceTotal: product.regularPriceTotal || 0
        });
    }

    saveCart();
    updateCartUI();
    window.toggleCartDrawer();
};

window.updateQuantity = (productId, delta) => {
    const item = cart.find(i => i.id === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(i => i.id !== productId);
    }

    saveCart();
    updateCartUI();
};

window.removeFromCart = (productId) => {
    cart = cart.filter(i => i.id !== productId);
    saveCart();
    updateCartUI();
};

window.clearCart = () => {
    if (confirm("¿Estás seguro de que deseas vaciar tu carrito?")) {
        cart = [];
        saveCart();
        updateCartUI();
    }
};

function saveCart() {
    localStorage.setItem("cuycitoCart", JSON.stringify(cart));
    updateCartCounter();
}

function loadCartFromStorage() {
    try {
        const saved = localStorage.getItem("cuycitoCart");
        if (saved) {
            cart = JSON.parse(saved);
            updateCartCounter();
            updateCartUI();
        }
    } catch (e) {
        cart = [];
    }
}

function updateCartCounter() {
    const totalCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);
    const badges = document.querySelectorAll('.cart-count-badge');
    badges.forEach(b => {
        b.innerText = totalCount;
        if (totalCount > 0) {
            b.classList.remove('hidden');
        } else {
            b.classList.add('hidden');
        }
    });
}

function updateCartUI() {
    const container = document.getElementById('cartItemsContainer');
    const totalEl = document.getElementById('cartTotalPrice');
    const emptyState = document.getElementById('cartEmptyState');
    const footer = document.getElementById('cartFooter');

    if (!container) return;

    if (cart.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (footer) footer.classList.add('hidden');
        container.innerHTML = '';
        if (totalEl) totalEl.innerText = 'S/ 0.00';
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (footer) footer.classList.remove('hidden');

    let total = 0;
    let html = '';

    cart.forEach(item => {
        const subtotal = item.price * item.quantity;
        total += subtotal;

        let comboServicesTag = '';
        if (item.isCombo && item.comboServices && item.comboServices.length > 0) {
            comboServicesTag = `<p class="text-[10px] text-cuycito-gold font-bold mt-0.5">🎁 ${item.comboServices.map(s => s.service).join(' + ')}</p>`;
        }

        html += `
        <div class="flex items-center justify-between gap-3 bg-[#0a0a0a] border border-gray-800 p-3.5 rounded-2xl">
            <div class="flex-1">
                <h4 class="text-xs font-black text-white line-clamp-1">${item.title}</h4>
                ${comboServicesTag}
                <p class="text-[10px] text-gray-500 font-mono">S/ ${item.price.toFixed(2)} c/u</p>
                <p class="text-xs font-black text-cuycito-gold mt-1">S/ ${subtotal.toFixed(2)}</p>
            </div>

            <div class="flex items-center gap-2">
                <div class="flex items-center bg-black border border-gray-700 rounded-lg overflow-hidden">
                    <button onclick="window.updateQuantity('${item.id}', -1)" class="px-2 py-1 text-gray-400 hover:text-white transition font-bold text-xs">-</button>
                    <span class="px-2 py-1 text-white font-mono text-xs font-bold">${item.quantity}</span>
                    <button onclick="window.updateQuantity('${item.id}', 1)" class="px-2 py-1 text-gray-400 hover:text-white transition font-bold text-xs">+</button>
                </div>
                <button onclick="window.removeFromCart('${item.id}')" class="text-gray-500 hover:text-cuycito-red p-1 transition" title="Eliminar">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
            </div>
        </div>`;
    });

    container.innerHTML = html;
    if (totalEl) totalEl.innerText = `S/ ${total.toFixed(2)}`;

    // Comprobar si el cliente está logueado y mostrar su saldo disponible
    const clientSession = localStorage.getItem("cuycitoClient");
    const balanceBox = document.getElementById('cartUserBalanceBox');
    const balanceText = document.getElementById('cartUserBalanceText');
    const balanceNotice = document.getElementById('cartBalanceNotice');
    const btnPayBalance = document.getElementById('btnPayWithBalance');
    const clientNameInput = document.getElementById('cartClientName');

    if (clientSession) {
        try {
            const user = JSON.parse(clientSession);
            const userBalance = parseFloat(user.balance || 0);
            
            if (balanceBox) balanceBox.classList.remove('hidden');
            if (balanceText) balanceText.innerText = user.isDemo ? `S/ 99,999.00 (Demo Ilimitado)` : `S/ ${userBalance.toFixed(2)}`;
            if (clientNameInput && !clientNameInput.value) {
                clientNameInput.value = `@${user.nickname || user.name}`;
            }

            if (user.isDemo || userBalance >= total) {
                if (btnPayBalance) btnPayBalance.classList.remove('hidden');
                if (balanceNotice) {
                    balanceNotice.innerHTML = `✨ <strong class="text-emerald-400">¡Tienes saldo suficiente ${user.isDemo ? '(Demo Ilimitado)' : `(S/ ${userBalance.toFixed(2)})`}!</strong> Puedes comprar de inmediato con 1 clic.`;
                }
            } else {
                if (btnPayBalance) btnPayBalance.classList.add('hidden');
                if (balanceNotice) {
                    balanceNotice.innerHTML = `💡 Saldo disponible: S/ ${userBalance.toFixed(2)}. Puedes <a href="perfil.html" class="text-cuycito-gold underline font-bold">recargar aquí</a> o solicitar por WhatsApp.`;
                }
            }
        } catch (e) {}
    } else {
        if (balanceBox) balanceBox.classList.add('hidden');
        if (btnPayBalance) btnPayBalance.classList.add('hidden');
    }
}

// Compra directa descontando saldo VIP del cliente con notificación automática por WhatsApp
window.payOrderWithBalance = async () => {
    if (cart.length === 0) return alert("El carrito está vacío.");
    
    const clientSession = localStorage.getItem("cuycitoClient");
    if (!clientSession) return alert("Debes iniciar sesión con tu cuenta de cliente para usar tu saldo.");

    let user = null;
    try {
        user = JSON.parse(clientSession);
    } catch(e) { return alert("Sesión inválida."); }

    let total = 0;
    let itemsText = '';

    cart.forEach((item, index) => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        itemsText += `  ${index + 1}. *${item.title}* x${item.quantity} (S/ ${subtotal.toFixed(2)})\n`;
    });

    const currentBalance = parseFloat(user.balance || 0);

    if (!user.isDemo && currentBalance < total) {
        return alert(`Saldo insuficiente. Tienes S/ ${currentBalance.toFixed(2)} y el total del pedido es S/ ${total.toFixed(2)}.`);
    }

    if (!confirm(`¿Confirmar compra por S/ ${total.toFixed(2)} descontando de tu Saldo VIP${user.isDemo ? ' [MODO DEMO]' : ''}?`)) return;

    try {
        if (!user.isDemo) {
            const newBalance = parseFloat(Math.max(0, currentBalance - total).toFixed(2));
            user.balance = newBalance;

            // 1. Descontar saldo en Firestore
            await setDoc(doc(db, "users", user.id), { balance: newBalance }, { merge: true });
            localStorage.setItem("cuycitoClient", JSON.stringify(user));

            // 2. Registrar en historial contable
            const txId = `tx_pay_${Date.now()}`;
            const txData = {
                id: txId,
                date: new Date().toISOString().split('T')[0],
                type: 'VENTA_SALDO',
                person: user.name || user.nickname,
                service: `Compra Carrito (${cart.length} productos)`,
                amount: total,
                currency: 'PEN',
                userId: user.id
            };
            await setDoc(doc(db, "history", txId), txData);
        }

        // 3. Notificar automáticamente a WhatsApp con el detalle
        const nick = user.nickname || user.name;
        const msg = `🐹 *¡COMPRA DIRECTA CON SALDO VIP - CUYCITOGO!* 🐹${user.isDemo ? ' [MODO DEMO]' : ''}\n\n👤 *Cliente:* ${user.name} (@${nick})\n📱 *Teléfono:* ${user.phone}\n\n📦 *Productos Comprados:*\n${itemsText}━━━━━━━━━━━━━━━━━━━━━\n💰 *Total Pagado con Saldo:* S/ ${total.toFixed(2)}\n💳 *Nuevo Saldo Restante:* ${user.isDemo ? 'S/ 99,999.00 (Demo Ilimitado)' : `S/ ${user.balance.toFixed(2)}`}\n━━━━━━━━━━━━━━━━━━━━━\n\n¡Por favor registrar y entregar mis credenciales/pantallas en el sistema! 🙌`;

        window.open(`https://wa.me/${CENTRAL_WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`, '_blank');

        window.clearCart();
        window.toggleCartDrawer();
        alert(`🎉 ¡Compra exitosa${user.isDemo ? ' (MODO DEMO DE PRUEBA)' : ''}! Revisa tu WhatsApp para la entrega de credenciales.`);
        
        // Redirigir a su perfil
        window.location.href = "perfil.html";

    } catch (e) {
        console.error("Error al procesar pago con saldo:", e);
        alert("Ocurrió un error al procesar el pago con saldo. Intenta nuevamente.");
    }
};

// Envío del pedido a WhatsApp Oficial con detalle de productos y suma total
window.sendOrderWhatsApp = () => {
    if (cart.length === 0) return alert("Tu carrito está vacío.");

    let clientName = (document.getElementById('cartClientName')?.value || document.getElementById('cartCustomerNameInput')?.value || '').trim();
    let clientPhone = '';
    
    // Si tiene sesión activa, usar su Nickname y teléfono
    const clientSession = localStorage.getItem("cuycitoClient");
    if (clientSession) {
        try {
            const user = JSON.parse(clientSession);
            if (!clientName) clientName = `@${user.nickname || user.name}`;
            clientPhone = user.phone || '';
        } catch (e) {}
    }

    if (!clientName) {
        clientName = prompt("Por favor ingresa tu Nombre o Nickname para el pedido:") || "Cliente Web";
    }

    let total = 0;
    let itemsText = '';

    cart.forEach((item, index) => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        
        let comboDetail = '';
        if (item.isCombo && item.comboServices && item.comboServices.length > 0) {
            comboDetail = `\n     🎁 *Servicios:* ${item.comboServices.map(s => `${s.service} (S/ ${(s.comboPrice || 0).toFixed(2)})`).join(' + ')}`;
            if (item.savingsPercent) comboDetail += `\n     🔥 *Ahorro:* ${item.savingsPercent}%`;
        }

        itemsText += `  ${index + 1}. *${item.title}*${comboDetail}\n     ▪ Cantidad: x${item.quantity}\n     ▪ Subtotal: S/ ${subtotal.toFixed(2)}\n\n`;
    });

    const clientPhoneText = clientPhone ? `\n📱 *Teléfono:* ${clientPhone}` : '';

    const msg = `🐹 *¡HOLA CUYCITOGO! QUIERO REALIZAR UN PEDIDO* 🐹\n\n👤 *Cliente:* ${clientName}${clientPhoneText}\n\n📦 *Productos Seleccionados:*\n${itemsText}━━━━━━━━━━━━━━━━━━━━━\n💰 *PRECIO TOTAL DE LA SUMA:* S/ ${total.toFixed(2)}\n━━━━━━━━━━━━━━━━━━━━━\n\n¿Me confirman la disponibilidad y los datos para realizar el pago por Yape / Plin? ¡Muchas gracias! 🙌`;

    window.open(`https://wa.me/${CENTRAL_WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`, '_blank');
};

// Compra rápida directa para un solo producto (WhatsApp Oficial)
window.quickBuy = (productId) => {
    const product = catalogProducts.find(p => p.id === productId);
    if (!product) return;

    let clientName = "Cliente";
    let clientPhone = '';
    
    const clientSession = localStorage.getItem("cuycitoClient");
    if (clientSession) {
        try {
            const user = JSON.parse(clientSession);
            clientName = `@${user.nickname || user.name}`;
            clientPhone = user.phone || '';
        } catch (e) {}
    }

    const price = parseFloat(product.price) || 0;
    const clientPhoneText = clientPhone ? `\n📱 *Teléfono:* ${clientPhone}` : '';

    let comboExtra = '';
    if (product.isCombo && product.comboServices && product.comboServices.length > 0) {
        comboExtra = `\n🎁 *Servicios incluidos:* ${product.comboServices.map(s => `${s.service} (S/ ${(s.comboPrice || 0).toFixed(2)})`).join(' + ')}`;
        if (product.regularPriceTotal) comboExtra += `\n💵 *Precio Regular:* ~S/ ${product.regularPriceTotal.toFixed(2)}~`;
        if (product.savingsPercent) comboExtra += `\n🔥 *Ahorro:* ${product.savingsPercent}%`;
    }

    const msg = `🐹 *¡HOLA CUYCITOGO! COMPRA RÁPIDA* 🐹\n\n👤 *Cliente:* ${clientName}${clientPhoneText}\n🎬 *Producto:* ${product.title}${comboExtra}\n💰 *Precio:* S/ ${price.toFixed(2)}\n\n¿Tienen disponibilidad inmediata para pago por Yape / Plin? ¡Muchas gracias! 🙌`;

    window.open(`https://wa.me/${CENTRAL_WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`, '_blank');
};

window.requestOutOfStockWhatsApp = (productTitle) => {
    const msg = `¡Hola CuycitoGO! 🐹👋\nVi que el producto *${productTitle}* figura como *Agotado* en la web.\n¿Cuándo tendrán nuevo stock o pueden reservarme un cupo para cuando activen una nueva cuenta? ¡Muchas gracias!`;
    window.open(`https://wa.me/${CENTRAL_WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`, '_blank');
};

window.submitWhatsAppOrder = window.sendOrderWhatsApp;