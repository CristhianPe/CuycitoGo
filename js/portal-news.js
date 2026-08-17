// ========================================================
// CUZCITOGO NEWS - PORTAL PERIODÍSTICO & CARTELERA DIGITAL
// ========================================================

// 1. BASE DE DATOS DE ARTÍCULOS EDITORIALES (REVISTA DIGITAL)
const defaultPortalArticles = {
    "reporte-agosto-2026": {
        category: "ANÁLISIS DE MERCADO",
        categoryColor: "bg-red-600",
        readTime: "7 min de lectura",
        date: "Agosto 2026",
        title: "📺 Reporte de Streaming: Novedades, Subida de Precios y Cambios en Suscripciones",
        image: "assets/img/news1.jpg",
        content: `
            <p class="text-sm text-gray-300 leading-relaxed font-normal">
                El encarecimiento del ocio digital es el tema del año 2026. La guerra por la rentabilidad está haciendo que todas las plataformas multinacionales ajusten sus tarifas de forma significativa en Latinoamérica y el mundo.
            </p>

            <h4 class="text-lg font-black text-white mt-6 mb-2">💰 1. Subida de Precios y Cambios en Suscripciones</h4>
            <div class="space-y-3 text-xs text-gray-300">
                <div class="bg-black/60 border border-orange-900/40 p-3.5 rounded-xl">
                    <strong class="text-orange-400 font-bold block mb-1 text-sm"><i class="fa-solid fa-arrow-trend-up mr-1"></i> Crunchyroll:</strong>
                    Después de mantener sus precios estables desde 2019, han aplicado una fuerte subida este 2026. El plan <strong>Fan básico subió a $11.99/mes</strong> (antes $9.99), y el plan <strong>Mega Fan a $14.99/mes</strong>.
                </div>

                <div class="bg-black/60 border border-blue-900/40 p-3.5 rounded-xl">
                    <strong class="text-blue-400 font-bold block mb-1 text-sm"><i class="fa-solid fa-arrow-trend-up mr-1"></i> Disney+ y Apple TV+:</strong>
                    Lideran el salto a tarifas más premium en el año. Disney+ consolidó su plan <strong>Estándar en 10,99 € (S/ 49.90 en Perú)</strong> y el <strong>Premium con ESPN en 15,99 € (S/ 68.90 en Perú)</strong>, siendo actualmente de las plataformas más costosas si se quiere evitar la publicidad.
                </div>

                <div class="bg-black/60 border border-red-900/40 p-3.5 rounded-xl">
                    <strong class="text-red-400 font-bold block mb-1 text-sm"><i class="fa-solid fa-lock mr-1"></i> Netflix:</strong>
                    Aunque ha moderado las subidas directas masivas este último trimestre, su estrategia ha sido forzar la adopción de su plan con anuncios y limitar drásticamente las cuentas compartidas fuera del hogar.
                </div>
            </div>

            <div class="bg-gradient-to-r from-amber-950/40 to-black border border-amber-500/40 p-4 rounded-xl mt-6">
                <h5 class="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                    <i class="fa-solid fa-fire text-amber-400"></i> Termómetro de Popularidad (Alta)
                </h5>
                <p class="text-xs text-gray-300 mt-1 leading-relaxed">
                    Las noticias de aumento de precios siempre generan picos de indignación y debate en redes sociales. Es un contenido que garantiza clics y reflexiones sobre si vale la pena pagar individualmente o recurrir a compras comunitarias compartidas en clubes VIP.
                </p>
            </div>
        `
    },
    "jojo-steel-ball-run": {
        category: "ANIME BOMBAZO",
        categoryColor: "bg-purple-600",
        readTime: "5 min de lectura",
        date: "Agosto 2026",
        title: "⚔️ STEEL BALL RUN: JoJo's Bizarre Adventure - Netflix Anuncia Nuevos Episodios para Septiembre",
        image: "assets/img/poster_jojo.jpg",
        content: `
            <p class="text-sm text-gray-300 leading-relaxed font-normal">
                ¡El anuncio del año para los fanáticos de la animación japonesa! La icónica carrera de caballos a través de Norteamérica protagonizada por <strong>Johnny Joestar y Gyro Zeppeli</strong> estrena nuevos episodios (<strong>2nd STAGE</strong>) este septiembre en Netflix, y las redes están en llamas con los nuevos tráilers y revelaciones de personajes.
            </p>

            <h4 class="text-lg font-black text-white mt-6 mb-2">Detalles de Producción</h4>
            <p class="text-xs text-gray-300 leading-relaxed">
                Animada por David Production, la adaptación de la Parte 7 del manga de Hirohiko Araki contará con resolución 4K HDR y audio espacial en streaming global.
            </p>

            <div class="bg-gradient-to-r from-purple-950/40 to-black border border-purple-500/40 p-4 rounded-xl mt-4">
                <h5 class="text-xs font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                    <i class="fa-solid fa-bolt text-purple-300"></i> Termómetro de Popularidad (Extrema)
                </h5>
                <p class="text-xs text-gray-300 mt-1 leading-relaxed">
                    La comunidad de JoJo's Bizarre Adventure es de las más activas y ruidosas de internet. El análisis del tráiler y del manga original de Steel Ball Run garantiza el mayor tráfico orgánico del trimestre.
                </p>
            </div>
        `
    },
    "cien-anos-soledad-noticia": {
        category: "CINE & SERIES",
        categoryColor: "bg-amber-600",
        readTime: "6 min de lectura",
        date: "Agosto 2026",
        title: "🍿 Cien Años de Soledad (Parte 2): La Superproducción de Netflix Basada en García Márquez",
        image: "assets/img/poster_ciensoledad.jpg",
        content: `
            <p class="text-sm text-gray-300 leading-relaxed font-normal">
                El 5 de agosto llegan los siete nuevos episodios de esta monumental superproducción basada en la obra cumbre de Gabriel García Márquez. La trama retoma la historia de la familia Buendía tras el armisticio, culminando con el gran final de la serie pautado para el <strong>26 de agosto</strong>.
            </p>

            <div class="bg-gradient-to-r from-red-950/40 to-black border border-red-500/40 p-4 rounded-xl mt-4">
                <h5 class="text-xs font-black text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                    <i class="fa-solid fa-rocket text-red-400"></i> Termómetro de Popularidad (Muy Alta)
                </h5>
                <p class="text-xs text-gray-300 mt-1 leading-relaxed">
                    La segunda parte de Cien años de soledad es un evento televisivo masivo en toda Hispanoamérica, destacando por su fotografía cinematográfica y fidelidad narrativa.
                </p>
            </div>
        `
    },
    "alzas-tarifas": {
        category: "ANÁLISIS DE MERCADO",
        categoryColor: "bg-red-600",
        readTime: "6 min de lectura",
        date: "Hace 1 hora",
        title: "El Mapa del Streaming en Perú: Alzas de Tarifas Oficiales y Nuevas Políticas de Hogar en 2026",
        image: "assets/img/news1.jpg",
        content: `
            <p class="text-sm text-gray-300 leading-relaxed font-normal">
                Análisis exhaustivo sobre las tarifas de Netflix (S/ 52.90 a S/ 58.90), Disney+ Premium (S/ 68.90) y los cargos por miembros extra en territorio peruano.
            </p>
        `
    },
    "codec-av1": {
        category: "AVANCE TECNOLÓGICO",
        categoryColor: "bg-sky-600",
        readTime: "4 min de lectura",
        date: "Hace 2 horas",
        title: "Nuevo Códec AV1: Plataformas Logran Reducir 30% el Consumo de Datos en Streaming 4K",
        image: "assets/img/news5.jpg",
        content: `
            <p class="text-sm text-gray-300 leading-relaxed font-normal">
                La implementación del estándar AV1 permite reproducir películas en 4K Ultra HD ahorrando hasta un 30% de megas en la red Wi-Fi del hogar.
            </p>
        `
    },
    "espn-disney": {
        category: "DEPORTES & EN VIVO",
        categoryColor: "bg-blue-600",
        readTime: "3 min de lectura",
        date: "Hace 3 horas",
        title: "Disney+ y ESPN Centralizan Todos los Torneos de Fútbol y Deportes en Vivo",
        image: "assets/img/news6.jpg",
        content: `
            <p class="text-sm text-gray-300 leading-relaxed font-normal">
                Transmisiones simultáneas de la Champions League, Premier League y Copa Libertadores integradas en la aplicación de Disney+.
            </p>
        `
    },
    "audio-hifi": {
        category: "AUDIO & HI-FI",
        categoryColor: "bg-emerald-600",
        readTime: "4 min de lectura",
        date: "Hace 4 horas",
        title: "Spotify vs Apple Music: ¿Vale la Pena Pagar por Audio Lossless Sin Pérdidas?",
        image: "assets/img/news3.jpg",
        content: `
            <p class="text-sm text-gray-300 leading-relaxed font-normal">
                Comparativa de compresión acústica y sonido espacial Dolby Atmos entre plataformas de música digital.
            </p>
        `
    },
    "cine-imax": {
        category: "CINE & HARDWARE",
        categoryColor: "bg-purple-600",
        readTime: "3 min de lectura",
        date: "Hace 5 horas",
        title: "Salas IMAX y Estudios de Cine Desarrollan Nuevos Modos de Imagen para Smart TVs",
        image: "assets/img/news4.jpg",
        content: `
            <p class="text-sm text-gray-300 leading-relaxed font-normal">
                Configuración de aspecto 1.90:1 y colores cinematográficos en televisores Ultra HD.
            </p>
        `
    },
    "trailer-stranger": {
        category: "TRAILER OFICIAL",
        categoryColor: "bg-red-600",
        readTime: "Video 3 min",
        date: "Exclusivo",
        title: "Stranger Things 5: Tráiler Final y Adelanto del Mundo del Revés",
        image: "assets/img/poster3.jpg",
        content: `
            <p class="text-sm text-gray-300 leading-relaxed font-normal">
                Avance oficial de la batalla final por Hawkins en 4K HDR.
            </p>
        `
    },
    "trailer-lastofus": {
        category: "TRAILER EXCLUSIVO",
        categoryColor: "bg-purple-600",
        readTime: "Video 2 min",
        date: "Exclusivo",
        title: "The Last of Us T2: Teaser Tráiler de la Segunda Entrega de HBO",
        image: "assets/img/poster4.jpg",
        content: `
            <p class="text-sm text-gray-300 leading-relaxed font-normal">
                Adelanto del viaje de Ellie por Seattle en calidad 4K Platino.
            </p>
        `
    }
};

// 2. BASE DE DATOS DE CARTELERA & ESTRENOS CLASIFICADOS (AGOSTO - SEPTIEMBRE 2026)
const defaultCarteleraList = [
    // --- ESTRENOS DE SERIES Y PELÍCULAS AGOSTO 2026 ---
    {
        id: "cien-anos-soledad-2",
        title: "Cien Años de Soledad (Parte 2)",
        platform: "NETFLIX",
        type: "estrenos",
        tag: "Superproducción Latinoamericana",
        tagColor: "bg-red-600",
        rating: "9.8",
        releaseDate: "5 de Agosto 2026 (Final: 26 Ago)",
        image: "assets/img/poster_ciensoledad.jpg",
        quality: "4K UHD • Dolby Atmos",
        director: "Alex García López & Laura Mora",
        cast: "Claudio Cataño, Susana Morales, Marco González",
        synopsis: "Los siete nuevos episodios retoman la historia de la familia Buendía tras el armisticio. Macondo se transforma en el epicentro de pasiones, guerra y misticismo en el cierre monumental de la obra de Gabriel García Márquez."
    },
    {
        id: "mi-vida-chicos-walter-3",
        title: "Mi Vida con los Chicos Walter (T3)",
        platform: "NETFLIX",
        type: "estrenos",
        tag: "Drama & Romance",
        tagColor: "bg-red-600",
        rating: "8.9",
        releaseDate: "6 de Agosto 2026",
        image: "assets/img/poster_walter.jpg",
        quality: "4K HDR • 5.1 Surround",
        director: "Melanie Halsall",
        cast: "Nikki Rodriguez, Sarah Rafferty, Marc Blucas",
        synopsis: "Continúa el drama juvenil con el regreso de Jackie Howard a Silver Falls, enfrentando nuevas decisiones románticas y desafíos familiares tras su estancia en Nueva York."
    },
    {
        id: "muertos-sl-4",
        title: "Muertos S.L. (Temporada 4 Final)",
        platform: "NETFLIX",
        type: "estrenos",
        tag: "Comedia Funeraria",
        tagColor: "bg-purple-600",
        rating: "8.8",
        releaseDate: "7 de Agosto 2026",
        image: "assets/img/poster_walter.jpg",
        quality: "1080p HD • Dolby Digital",
        director: "Laura Caballero & Alberto Caballero",
        cast: "Carlos Areces, Ascen López, Salva Reina, Aitziber Garmendia",
        synopsis: "La comedia de la Funeraria Torregrosa estrena su temporada final con enredos disparatados por el control del negocio familiar y situaciones cómicas al límite."
    },

    // --- ANIME Y BOMBAZOS 2026 ---
    {
        id: "jojo-steel-ball-run-title",
        title: "JoJo's Bizarre Adventure: Steel Ball Run",
        platform: "NETFLIX",
        type: "estrenos",
        tag: "Bombazo Anime 2nd STAGE",
        tagColor: "bg-purple-600",
        rating: "10.0",
        releaseDate: "Septiembre 2026",
        image: "assets/img/poster_jojo.jpg",
        quality: "4K HDR • Audio Japonés / Español Latino",
        director: "David Production",
        cast: "Johnny Joestar, Gyro Zeppeli, Diego Brando, Funny Valentine",
        synopsis: "La icónica carrera de caballos a través de Norteamérica llega a su 2nd STAGE. Johnny Joestar y Gyro Zeppeli desvelan el misterio del Cuerpo Santo mientras compiten contra los jinetes más letales del mundo."
    },
    {
        id: "the-ribbon-hero",
        title: "The Ribbon Hero (La Princesa Caballero)",
        platform: "NETFLIX",
        type: "estrenos",
        tag: "Película Anime Original",
        tagColor: "bg-red-600",
        rating: "9.3",
        releaseDate: "8 de Agosto 2026",
        image: "assets/img/poster_ribbon.jpg",
        quality: "4K UHD • Studio Twin Engine",
        director: "Studio Twin Engine",
        cast: "Voces Originales Japonesas",
        synopsis: "Película original inspirada en el legendario clásico 'La princesa caballero' de Osamu Tezuka. Una reinvención moderna con animación deslumbrante sobre valentía y honor."
    },
    {
        id: "pokemon-liga-indigo",
        title: "Pokémon: La Liga Índigo (Clásicos)",
        platform: "DISNEY",
        type: "cartelera",
        tag: "Clásico Nostalgia",
        tagColor: "bg-blue-600",
        rating: "9.7",
        releaseDate: "7 de Agosto 2026",
        image: "assets/img/poster1.jpg",
        quality: "Remasterizado HD • Audio Latino",
        director: "Kunihiko Yuyama",
        cast: "Ash Ketchum, Pikachu, Misty, Brock",
        synopsis: "La primera e histórica temporada del viaje de Ash y Pikachu por la región de Kanto llega a Disney+ y Crunchyroll con remasterización de imagen en alta definición."
    },

    // --- CARTELERA POPULAR EN STREAMING ---
    {
        id: "stranger-things",
        title: "Stranger Things 5: Temporada Final",
        platform: "NETFLIX",
        type: "ambos",
        tag: "Temporada Final",
        tagColor: "bg-red-600",
        rating: "9.5",
        releaseDate: "Diciembre 2026",
        image: "assets/img/poster3.jpg",
        quality: "4K UHD • Dolby Vision • Dolby Atmos",
        director: "Hermanos Duffer",
        cast: "Millie Bobby Brown, Finn Wolfhard, Winona Ryder, David Harbour",
        synopsis: "La amenaza del Mundo del Revés invade Hawkins en una escala sin precedentes. Once y sus amigos deberán librar la batalla definitiva para poner fin al reinado de Vecna."
    },
    {
        id: "the-last-of-us-2",
        title: "The Last of Us: Temporada 2",
        platform: "MAX",
        type: "ambos",
        tag: "Serie Platino HBO",
        tagColor: "bg-purple-600",
        rating: "9.6",
        releaseDate: "Estreno Mundial 2026",
        image: "assets/img/poster4.jpg",
        quality: "4K Platino • HDR10+ • Dolby Atmos",
        director: "Craig Mazin & Neil Druckmann",
        cast: "Pedro Pascal, Bella Ramsey, Kaitlyn Dever, Isabela Merced",
        synopsis: "Joel y Ellie intentan asentarse en Jackson, Wyoming. Sin embargo, un evento trágico desencadena una vorágine de venganza en las ruinas de Seattle."
    },
    {
        id: "demon-slayer-castillo",
        title: "Demon Slayer: El Castillo Infinito",
        platform: "CRUNCHYROLL",
        type: "ambos",
        tag: "Trilogía de Cine & Simulcast",
        tagColor: "bg-orange-600",
        rating: "9.9",
        releaseDate: "Simulcast 2026",
        image: "assets/img/poster2.jpg",
        quality: "1080p 60fps • Studio Ufotable",
        director: "Haruo Sotozaki",
        cast: "Natsuki Hanae, Akari Kito, Hiro Shimono",
        synopsis: "El Cuerpo de Cazadores de Demonios cae en la trampa dimensional de Muzan Kibutsuji. Batallas a muerte contra las tres Lunas Superiores más poderosas."
    },
    {
        id: "the-boys-5",
        title: "The Boys: Temporada 5 Final",
        platform: "PRIME",
        type: "ambos",
        tag: "Acción & Sátira",
        tagColor: "bg-amber-600",
        rating: "9.2",
        releaseDate: "Temporada Final 2026",
        image: "assets/img/poster5.jpg",
        quality: "4K HDR",
        director: "Eric Kripke",
        cast: "Karl Urban, Antony Starr, Jack Quaid",
        synopsis: "Con Patriota controlando las más altas esferas del gobierno, los muchachos libran su guerra definitiva."
    },
    {
        id: "avatar-fuego",
        title: "Avatar 3: Fuego y Cenizas",
        platform: "DISNEY",
        type: "estrenos",
        tag: "Superproducción Disney+",
        tagColor: "bg-blue-600",
        rating: "9.4",
        releaseDate: "Diciembre 2026",
        image: "assets/img/poster6.jpg",
        quality: "IMAX Enhanced 4K",
        director: "James Cameron",
        cast: "Sam Worthington, Zoe Saldaña",
        synopsis: "Jake Sully y Neytiri exploran una nueva región volcánica de Pandora habitada por el Pueblo de la Ceniza."
    }
];

function getCarteleraData() {
    try {
        const stored = localStorage.getItem("cuycito_portal_cartelera");
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch(e) {}
    localStorage.setItem("cuycito_portal_cartelera", JSON.stringify(defaultCarteleraList));
    return defaultCarteleraList;
}

// 3. RENDERIZADO EN CARTELERA DEDICADA (cartelera.html)
window.renderCarteleraPage = (filterPlatform = 'ALL', searchTerm = '') => {
    const grid = document.getElementById('carteleraDedicatedGrid');
    if (!grid) return;

    let list = getCarteleraData();

    if (filterPlatform !== 'ALL') {
        list = list.filter(item => item.platform === filterPlatform);
    }

    if (searchTerm) {
        const query = searchTerm.toLowerCase();
        list = list.filter(item => 
            item.title.toLowerCase().includes(query) ||
            (item.cast && item.cast.toLowerCase().includes(query)) ||
            (item.director && item.director.toLowerCase().includes(query)) ||
            item.platform.toLowerCase().includes(query) ||
            (item.tag && item.tag.toLowerCase().includes(query))
        );
    }

    if (list.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-16 text-center text-gray-500 space-y-2">
                <i class="fa-solid fa-film text-4xl text-gray-700"></i>
                <p class="text-sm font-bold text-gray-400">No se encontraron producciones en este filtro.</p>
                <button onclick="window.filterCarteleraPage('ALL')" class="text-xs text-cuycito-gold underline font-bold">Restablecer filtros</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = list.map(item => `
        <div class="bg-[#121212] border border-gray-800 hover:border-cuycito-gold/60 rounded-3xl overflow-hidden shadow-2xl transition duration-300 flex flex-col justify-between group">
            <div class="relative aspect-[2/3] w-full overflow-hidden bg-black cursor-pointer" onclick="window.openCarteleraModal('${item.id}')">
                <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover object-center group-hover:scale-105 transition duration-500">
                <div class="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-black/30"></div>
                
                <span class="absolute top-3 left-3 ${item.tagColor || 'bg-red-600'} text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-lg">
                    ${item.platform}
                </span>

                <span class="absolute top-3 right-3 bg-black/80 backdrop-blur-sm border border-yellow-500/40 text-cuycito-gold text-xs font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shadow">
                    ★ ${item.rating}
                </span>

                <div class="absolute bottom-3 left-3 right-3">
                    <span class="text-[10px] text-gray-300 font-bold bg-black/70 px-2 py-0.5 rounded backdrop-blur-sm border border-gray-800 block truncate">
                        ${item.quality || '4K UHD'}
                    </span>
                </div>
            </div>

            <div class="p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div class="space-y-1.5">
                    <span class="text-[10px] font-black text-cuycito-gold uppercase tracking-wider block">
                        ${item.tag || item.platform}
                    </span>
                    <h3 class="text-base font-black text-white group-hover:text-cuycito-gold transition line-clamp-1 leading-snug cursor-pointer" onclick="window.openCarteleraModal('${item.id}')">
                        ${item.title}
                    </h3>
                    <p class="text-xs text-gray-400 line-clamp-2 leading-relaxed font-normal">
                        ${item.synopsis || ''}
                    </p>
                </div>

                <div class="pt-3 border-t border-gray-800/80 flex items-center justify-between">
                    <span class="text-[10px] text-gray-500 font-bold uppercase tracking-wider truncate mr-2">
                        <i class="fa-regular fa-calendar text-gray-400 mr-1"></i> ${item.releaseDate || 'Disponible'}
                    </span>
                    <button onclick="window.openCarteleraModal('${item.id}')" class="bg-gray-900 hover:bg-cuycito-gold text-gray-300 hover:text-black text-[11px] font-black px-3.5 py-1.5 rounded-xl border border-gray-700 hover:border-cuycito-gold transition flex items-center gap-1 shrink-0">
                        <i class="fa-solid fa-circle-info"></i> Ficha
                    </button>
                </div>
            </div>
        </div>
    `).join('');
};

// 4. RENDERIZADO EN ESTRENOS DEDICADOS (estrenos.html)
window.renderEstrenosPage = (filterPlatform = 'ALL', searchTerm = '') => {
    const grid = document.getElementById('estrenosDedicatedGrid');
    if (!grid) return;

    let list = getCarteleraData().filter(item => item.type === 'estrenos' || item.type === 'ambos');

    if (filterPlatform !== 'ALL') {
        list = list.filter(item => item.platform === filterPlatform);
    }

    if (searchTerm) {
        const query = searchTerm.toLowerCase();
        list = list.filter(item => 
            item.title.toLowerCase().includes(query) ||
            item.platform.toLowerCase().includes(query) ||
            (item.releaseDate && item.releaseDate.toLowerCase().includes(query)) ||
            (item.tag && item.tag.toLowerCase().includes(query))
        );
    }

    if (list.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-16 text-center text-gray-500 space-y-2">
                <i class="fa-solid fa-clapperboard text-4xl text-gray-700"></i>
                <p class="text-sm font-bold text-gray-400">No hay estrenos programados para este filtro.</p>
                <button onclick="window.filterCarteleraPage('ALL')" class="text-xs text-cuycito-gold underline font-bold">Ver todos los estrenos</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = list.map(item => `
        <div class="bg-[#121212] border border-gray-800 hover:border-cuycito-red/60 rounded-3xl overflow-hidden shadow-2xl transition duration-300 flex flex-col justify-between group">
            <div class="relative aspect-[2/3] w-full overflow-hidden bg-black cursor-pointer" onclick="window.openCarteleraModal('${item.id}')">
                <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover object-center group-hover:scale-105 transition duration-500">
                <div class="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-black/30"></div>
                
                <span class="absolute top-3 left-3 ${item.tagColor || 'bg-red-600'} text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-lg">
                    ${item.platform}
                </span>

                <span class="absolute top-3 right-3 bg-red-950/80 border border-red-500/40 text-red-300 text-xs font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shadow">
                    <i class="fa-solid fa-bolt text-[10px] text-yellow-400"></i> Estreno 2026
                </span>

                <div class="absolute bottom-3 left-3 right-3">
                    <span class="text-[10px] text-yellow-300 font-bold bg-black/80 px-2.5 py-1 rounded-lg backdrop-blur-sm border border-yellow-500/40 block truncate">
                        <i class="fa-regular fa-clock mr-1"></i> ${item.releaseDate}
                    </span>
                </div>
            </div>

            <div class="p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div class="space-y-1.5">
                    <span class="text-[10px] font-black text-cuycito-red uppercase tracking-wider block">
                        ${item.tag || 'Próximo Estreno'}
                    </span>
                    <h3 class="text-base font-black text-white group-hover:text-cuycito-gold transition line-clamp-1 leading-snug cursor-pointer" onclick="window.openCarteleraModal('${item.id}')">
                        ${item.title}
                    </h3>
                    <p class="text-xs text-gray-400 line-clamp-2 leading-relaxed font-normal">
                        ${item.synopsis || ''}
                    </p>
                </div>

                <div class="pt-3 border-t border-gray-800/80 flex items-center justify-between">
                    <span class="text-[10px] text-gray-400 font-bold truncate mr-2">
                        <i class="fa-solid fa-tv text-cuycito-gold mr-1"></i> ${item.quality || '4K UHD'}
                    </span>
                    <button onclick="window.openCarteleraModal('${item.id}')" class="bg-gradient-to-r from-cuycito-redDark to-cuycito-red hover:from-cuycito-red hover:to-cuycito-gold text-white text-[11px] font-black px-3.5 py-1.5 rounded-xl transition shadow glow-red flex items-center gap-1 shrink-0">
                        <i class="fa-solid fa-film"></i> Sinopsis
                    </button>
                </div>
            </div>
        </div>
    `).join('');
};

// 5. RENDERIZADO EN PORTADA PRINCIPAL (index.html)
window.renderIndexCarteleraAndEstrenos = () => {
    const carteleraGrid = document.getElementById('indexCarteleraGrid');
    const estrenosGrid = document.getElementById('indexEstrenosGrid');

    const list = getCarteleraData();

    if (carteleraGrid) {
        const top4 = list.slice(0, 4);
        carteleraGrid.innerHTML = top4.map(item => `
            <div class="bg-[#121212] border border-gray-800 hover:border-cuycito-gold/50 rounded-2xl overflow-hidden shadow-xl transition flex flex-col justify-between group cursor-pointer" onclick="window.openCarteleraModal('${item.id}')">
                <div class="relative aspect-[2/3] w-full overflow-hidden bg-black">
                    <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover object-center group-hover:scale-105 transition duration-300">
                    <span class="absolute top-2 left-2 ${item.tagColor || 'bg-red-600'} text-white text-[9px] font-black px-2 py-0.5 rounded uppercase shadow">
                        ${item.platform}
                    </span>
                    <span class="absolute bottom-2 right-2 bg-black/80 text-cuycito-gold text-[10px] font-black px-1.5 py-0.5 rounded border border-yellow-500/40">
                        ★ ${item.rating}
                    </span>
                </div>
                <div class="p-3 space-y-1">
                    <h4 class="text-xs font-black text-white group-hover:text-cuycito-gold transition truncate">${item.title}</h4>
                    <span class="text-[10px] text-gray-400 block">${item.tag || item.platform}</span>
                </div>
            </div>
        `).join('');
    }

    if (estrenosGrid) {
        const upcoming4 = list.filter(item => item.type === 'estrenos' || item.type === 'ambos').slice(0, 4);
        estrenosGrid.innerHTML = upcoming4.map(item => `
            <div class="bg-[#121212] border border-gray-800 hover:border-cuycito-red/50 rounded-2xl overflow-hidden shadow-xl transition flex flex-col justify-between group cursor-pointer" onclick="window.openCarteleraModal('${item.id}')">
                <div class="relative aspect-[2/3] w-full overflow-hidden bg-black">
                    <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover object-center group-hover:scale-105 transition duration-300">
                    <span class="absolute top-2 left-2 ${item.tagColor || 'bg-blue-600'} text-white text-[9px] font-black px-2 py-0.5 rounded uppercase shadow">
                        ${item.platform}
                    </span>
                    <span class="absolute bottom-2 right-2 bg-black/80 text-yellow-300 text-[9px] font-black px-1.5 py-0.5 rounded border border-yellow-500/40 truncate max-w-[80%]">
                        ${item.releaseDate}
                    </span>
                </div>
                <div class="p-3 space-y-1">
                    <h4 class="text-xs font-black text-white group-hover:text-cuycito-red transition truncate">${item.title}</h4>
                    <span class="text-[10px] text-gray-400 block">${item.quality || '4K UHD'}</span>
                </div>
            </div>
        `).join('');
    }
};

// 6. FILTROS Y BÚSQUEDA
let activeFilterPlatform = 'ALL';

window.filterCarteleraPage = (platform) => {
    activeFilterPlatform = platform;
    const buttons = document.querySelectorAll('.cartelera-filter-btn');
    buttons.forEach(btn => {
        if (btn.dataset.platform === platform) {
            btn.className = "cartelera-filter-btn bg-cuycito-gold text-black text-xs font-black px-4 py-2 rounded-xl shadow glow-gold";
        } else {
            btn.className = "cartelera-filter-btn bg-[#141414] hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800 text-xs font-bold px-4 py-2 rounded-xl transition";
        }
    });

    const searchInput = document.getElementById('searchCarteleraInput');
    const term = searchInput ? searchInput.value.trim() : '';

    if (document.getElementById('carteleraDedicatedGrid')) {
        window.renderCarteleraPage(platform, term);
    }
    if (document.getElementById('estrenosDedicatedGrid')) {
        window.renderEstrenosPage(platform, term);
    }
};

window.searchCartelera = () => {
    const searchInput = document.getElementById('searchCarteleraInput');
    const term = searchInput ? searchInput.value.trim() : '';
    if (document.getElementById('carteleraDedicatedGrid')) {
        window.renderCarteleraPage(activeFilterPlatform, term);
    }
    if (document.getElementById('estrenosDedicatedGrid')) {
        window.renderEstrenosPage(activeFilterPlatform, term);
    }
};

// 7. MODAL DETALLE DE CARTELERA & ESTRENOS
window.openCarteleraModal = (itemId) => {
    const list = getCarteleraData();
    const item = list.find(c => c.id === itemId);
    if (!item) return;

    const modal = document.getElementById('articleReaderModal');
    const container = document.getElementById('articleReaderContent');
    if (!modal || !container) return;

    container.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-12 gap-6">
            <div class="sm:col-span-5">
                <div class="relative aspect-[2/3] rounded-2xl overflow-hidden bg-black border border-gray-800 shadow-2xl">
                    <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover object-center">
                    <span class="absolute top-3 left-3 ${item.tagColor || 'bg-red-600'} text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                        ${item.platform}
                    </span>
                    <span class="absolute bottom-3 right-3 bg-black/80 text-cuycito-gold text-xs font-black px-2 py-0.5 rounded border border-yellow-500/40">
                        ★ ${item.rating} / 10
                    </span>
                </div>
            </div>

            <div class="sm:col-span-7 space-y-4">
                <div>
                    <span class="text-xs font-black text-cuycito-gold uppercase tracking-widest block">${item.tag || item.platform}</span>
                    <h2 class="text-2xl font-black text-white leading-tight mt-1">${item.title}</h2>
                </div>

                <div class="bg-black/60 border border-gray-800/80 rounded-xl p-3 space-y-1.5 text-xs text-gray-300">
                    <div><strong class="text-gray-400">Fecha / Emisión:</strong> <span class="text-white font-bold">${item.releaseDate}</span></div>
                    <div><strong class="text-gray-400">Calidad:</strong> <span class="text-emerald-400 font-bold">${item.quality || '4K UHD'}</span></div>
                    ${item.director ? `<div><strong class="text-gray-400">Dirección / Estudio:</strong> ${item.director}</div>` : ''}
                    ${item.cast ? `<div><strong class="text-gray-400">Reparto / Personajes:</strong> ${item.cast}</div>` : ''}
                </div>

                <div class="space-y-1">
                    <h4 class="text-xs font-black text-gray-400 uppercase tracking-wider">Sinopsis Oficial:</h4>
                    <p class="text-xs text-gray-200 leading-relaxed font-normal">${item.synopsis || 'Sinopsis en actualización.'}</p>
                </div>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
};

// 8. CARRUSEL DE NOTICIA DESTACADA DESPLAZABLE (HERO SLIDER)
let currentHeroSlide = 0;
const totalHeroSlides = 3;
let heroSlideInterval = null;

window.initHeroSlider = () => {
    window.showHeroSlide(0);
    startHeroAutoplay();

    const sliderContainer = document.getElementById('heroSliderTrack');
    if (sliderContainer) {
        sliderContainer.addEventListener('mouseenter', stopHeroAutoplay);
        sliderContainer.addEventListener('mouseleave', startHeroAutoplay);
    }
};

window.showHeroSlide = (index) => {
    currentHeroSlide = (index + totalHeroSlides) % totalHeroSlides;
    const track = document.getElementById('heroSliderTrack');
    const dots = document.querySelectorAll('.hero-slider-dot');

    if (track) {
        track.style.transform = `translateX(-${currentHeroSlide * 100}%)`;
    }

    dots.forEach((dot, idx) => {
        if (idx === currentHeroSlide) {
            dot.className = "hero-slider-dot w-6 h-2 rounded-full bg-cuycito-gold transition-all duration-300 shadow glow-gold";
        } else {
            dot.className = "hero-slider-dot w-2 h-2 rounded-full bg-gray-600 hover:bg-gray-400 transition-all duration-300";
        }
    });
};

window.nextHeroSlide = () => {
    window.showHeroSlide(currentHeroSlide + 1);
};

window.prevHeroSlide = () => {
    window.showHeroSlide(currentHeroSlide - 1);
};

function startHeroAutoplay() {
    stopHeroAutoplay();
    heroSlideInterval = setInterval(() => {
        window.nextHeroSlide();
    }, 6000);
}

function stopHeroAutoplay() {
    if (heroSlideInterval) clearInterval(heroSlideInterval);
}

// 9. SUSCRIPCIÓN NEWSLETTER
window.handleNewsletterSubscribe = (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('newsletterEmail');
    if (!emailInput || !emailInput.value.trim()) return;

    alert(`¡Gracias por suscribirte con ${emailInput.value.trim()}! Recibirás los reportajes semanales y alertas de estrenos de streaming.`);
    emailInput.value = "";
};

// 10. MODAL LECTOR DE ARTÍCULOS EDITORIALES
window.openArticleModal = (articleId) => {
    const article = defaultPortalArticles[articleId];
    if (!article) return;

    const modal = document.getElementById('articleReaderModal');
    const container = document.getElementById('articleReaderContent');
    if (!modal || !container) return;

    container.innerHTML = `
        <div class="relative aspect-[16/9] rounded-2xl overflow-hidden mb-6 border border-gray-800 bg-black">
            <img src="${article.image}" alt="${article.title}" class="w-full h-full object-cover object-center">
            <div class="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-black/40"></div>
            <span class="absolute top-4 left-4 ${article.categoryColor} text-white text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow">
                ${article.category}
            </span>
        </div>

        <div class="space-y-4">
            <div class="flex items-center gap-3 text-xs text-gray-400 font-medium">
                <span><i class="fa-regular fa-clock text-cuycito-gold mr-1"></i> ${article.readTime}</span>
                <span>•</span>
                <span><i class="fa-regular fa-calendar mr-1"></i> ${article.date}</span>
                <span>•</span>
                <span class="text-emerald-400 font-bold"><i class="fa-solid fa-check mr-1"></i> Formato Informativo</span>
            </div>

            <h2 class="text-2xl sm:text-3xl font-black text-white leading-tight">
                ${article.title}
            </h2>

            <div class="border-t border-gray-800 pt-5 text-gray-200">
                ${article.content}
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
};

window.closeArticleModal = () => {
    const modal = document.getElementById('articleReaderModal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
};

// 11. INICIALIZACIÓN GLOBAL
document.addEventListener('DOMContentLoaded', () => {
    initPortalAuth();
    window.initHeroSlider();
    window.renderIndexCarteleraAndEstrenos();
    window.renderCarteleraPage();
    window.renderEstrenosPage();
    initPriceComparator();
});

function initPortalAuth() {
    const authContainer = document.getElementById('navAuthContainer');
    if (!authContainer) return;

    const savedClient = localStorage.getItem("cuycitoClient");
    if (savedClient) {
        try {
            const user = JSON.parse(savedClient);
            const name = user.nickname || user.name || 'Miembro VIP';
            authContainer.innerHTML = `
                <a href="perfil.html" class="bg-gradient-to-r from-amber-600 via-cuycito-gold to-yellow-400 hover:from-amber-500 hover:to-yellow-300 text-black text-xs font-black px-4 py-2.5 rounded-xl transition shadow-lg glow-gold flex items-center gap-2 uppercase tracking-wider">
                    <i class="fa-solid fa-crown text-black"></i>
                    <span>@${name} • Mi Panel VIP</span>
                </a>
            `;
            return;
        } catch (e) {}
    }

    authContainer.innerHTML = `
        <a href="login-cliente.html" class="bg-gradient-to-r from-cuycito-redDark via-cuycito-red to-cuycito-redHover hover:from-cuycito-red hover:to-cuycito-gold text-white text-xs font-black px-4 py-2.5 rounded-xl transition shadow-lg glow-red flex items-center gap-2 uppercase tracking-wider">
            <i class="fa-solid fa-right-to-bracket"></i>
            <span>Iniciar Sesión</span>
        </a>
    `;
}

function initPriceComparator() {
    window.filterPlatforms = function(category) {
        const cards = document.querySelectorAll('.platform-price-card');
        const buttons = document.querySelectorAll('.platform-filter-btn');

        buttons.forEach(btn => {
            if (btn.dataset.category === category) {
                btn.className = "platform-filter-btn bg-cuycito-red text-white text-xs font-black px-4 py-2 rounded-xl transition shadow glow-red";
            } else {
                btn.className = "platform-filter-btn bg-[#141414] hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800 text-xs font-bold px-4 py-2 rounded-xl transition";
            }
        });

        cards.forEach(card => {
            if (category === 'ALL' || card.dataset.category === category) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    };
}
