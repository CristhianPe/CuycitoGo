// ==========================================================================
// CUZCITOGO VIP - AGENTE IA DE MARKETING & CREADOR DE CONTENIDO (LOCAL)
// ==========================================================================

const DEFAULT_GEMINI_API_KEY = "AQ.Ab8RN6J_V47ODKRw28_UDMbWipLw-HlRpMXMfH3rwu1qZXv5dA";

// Estado interno del agente
let currentAiContentType = "NEWS"; // "NEWS" (16:9 Horizontal) o "CARTELERA" (2:3 Vertical)
let currentAiGeneratedData = null;
let currentCandidateImages = [];
let selectedImageIndex = 0;
let aiConversationHistory = [];

// Estado de encuadre / posición de imagen
let currentImagePosX = 50; // 50% = centro
let currentImagePosY = 50; // 50% = centro
let currentImageZoom = 100; // 100% = normal
let currentImageAspect = "16/9"; // "16/9" para noticias o "2/3" para cartelera

// Obtener API Key (desde localStorage o la por defecto)
function getGeminiApiKey() {
    return localStorage.getItem("cuycito_gemini_api_key") || DEFAULT_GEMINI_API_KEY;
}

window.saveCustomApiKey = (key) => {
    if (key && key.trim()) {
        localStorage.setItem("cuycito_gemini_api_key", key.trim());
        alert("✅ API Key de Gemini guardada correctamente.");
    } else {
        localStorage.removeItem("cuycito_gemini_api_key");
        alert("🔄 Restablecida la API Key predeterminada.");
    }
};

// ==========================================================================
// 0. CONTROLADOR DEL TIPO DE CONTENIDO (16:9 NOTICIAS VS 2:3 CARTELERA)
// ==========================================================================
window.setAiContentType = (type) => {
    currentAiContentType = type === 'CARTELERA' ? 'CARTELERA' : 'NEWS';
    currentImageAspect = currentAiContentType === 'NEWS' ? '16/9' : '2/3';

    const btnNews = document.getElementById('aiTypeBtnNews');
    const btnCartelera = document.getElementById('aiTypeBtnCartelera');
    const label = document.getElementById('aiPromptLabel');
    const input = document.getElementById('aiAgentPrompt');

    if (currentAiContentType === 'NEWS') {
        if (btnNews) {
            btnNews.className = "flex items-start gap-3 p-4 rounded-2xl border-2 border-orange-500 bg-orange-950/40 text-left transition transform hover:scale-[1.01] shadow-lg glow-gold cursor-pointer";
        }
        if (btnCartelera) {
            btnCartelera.className = "flex items-start gap-3 p-4 rounded-2xl border-2 border-gray-800 bg-black/60 text-left transition hover:border-cuycito-gold/50 opacity-70 hover:opacity-100 cursor-pointer";
        }
        if (label) {
            label.innerHTML = `<i class="fa-solid fa-newspaper text-orange-400 mr-1.5"></i> ¿Qué noticia o reportaje tecnológico deseas redactar? <span class="bg-orange-600/30 text-orange-400 border border-orange-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">16:9 Horizontal</span>`;
        }
        if (input) {
            input.placeholder = "Ej: 'El futuro del streaming 4K en Perú', 'Spider-Man Brand New Day todo lo que debes saber', 'Subida de tarifas Netflix y ahorro'...";
        }
    } else {
        if (btnNews) {
            btnNews.className = "flex items-start gap-3 p-4 rounded-2xl border-2 border-gray-800 bg-black/60 text-left transition hover:border-orange-500/50 opacity-70 hover:opacity-100 cursor-pointer";
        }
        if (btnCartelera) {
            btnCartelera.className = "flex items-start gap-3 p-4 rounded-2xl border-2 border-cuycito-gold bg-amber-950/40 text-left transition transform hover:scale-[1.01] shadow-lg glow-gold cursor-pointer";
        }
        if (label) {
            label.innerHTML = `<i class="fa-solid fa-film text-cuycito-gold mr-1.5"></i> ¿Qué serie, película o estreno deseas catalogar? <span class="bg-amber-600/30 text-cuycito-gold border border-cuycito-gold/40 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">2:3 Vertical / Póster</span>`;
        }
        if (input) {
            input.placeholder = "Ej: 'Estreno de Deadpool & Wolverine en Disney+', 'Temporada 5 de Stranger Things', 'Anime Demon Slayer Castillo Infinito'...";
        }
    }

    renderAiSuggestions();

    // Si ya había contenido generado, volver a renderizar con la nueva relación de aspecto
    if (currentAiGeneratedData) {
        renderAiGeneratedPreview();
    }
};

function renderAiSuggestions() {
    const cont = document.getElementById('aiPromptSuggestionsContainer');
    if (!cont) return;

    if (currentAiContentType === 'NEWS') {
        cont.innerHTML = `
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1"><i class="fa-solid fa-lightbulb text-yellow-400 mr-1"></i> Noticias 16:9:</span>
            <button onclick="window.setAiPromptSuggestion('Spider-Man Brand New Day El regreso definitivo a sus raíces 4K')" class="bg-black/60 hover:bg-gray-800 border border-gray-800 hover:border-orange-500/40 text-gray-300 hover:text-orange-300 text-[11px] font-medium px-3 py-1 rounded-lg transition">
                🕷️ Spider-Man 4K
            </button>
            <button onclick="window.setAiPromptSuggestion('Análisis de tarifas de Netflix en Perú y cómo ahorrar hasta 70% con CuzcitoGo')" class="bg-black/60 hover:bg-gray-800 border border-gray-800 hover:border-orange-500/40 text-gray-300 hover:text-orange-300 text-[11px] font-medium px-3 py-1 rounded-lg transition">
                💰 Reporte Tarifas & Ahorro
            </button>
            <button onclick="window.setAiPromptSuggestion('Avances en tecnología 4K HDR Dolby Vision y las mejores pantallas para streaming')" class="bg-black/60 hover:bg-gray-800 border border-gray-800 hover:border-orange-500/40 text-gray-300 hover:text-orange-300 text-[11px] font-medium px-3 py-1 rounded-lg transition">
                📺 Tecnología 4K & HDR
            </button>
            <button onclick="window.setAiPromptSuggestion('Guía definitiva de anime 2026 lo más esperado en Crunchyroll Mega Fan')" class="bg-black/60 hover:bg-gray-800 border border-gray-800 hover:border-orange-500/40 text-gray-300 hover:text-orange-300 text-[11px] font-medium px-3 py-1 rounded-lg transition">
                ⚔️ Guía Anime 2026
            </button>
        `;
    } else {
        cont.innerHTML = `
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1"><i class="fa-solid fa-film text-cuycito-gold mr-1"></i> Cartelera 2:3:</span>
            <button onclick="window.setAiPromptSuggestion('Estreno de Deadpool & Wolverine en Disney+ con calidad 4K UHD')" class="bg-black/60 hover:bg-gray-800 border border-gray-800 hover:border-cyan-500/40 text-gray-300 hover:text-cyan-300 text-[11px] font-medium px-3 py-1 rounded-lg transition">
                🎬 Deadpool & Wolverine
            </button>
            <button onclick="window.setAiPromptSuggestion('Temporada Final de Stranger Things 5 en Netflix')" class="bg-black/60 hover:bg-gray-800 border border-gray-800 hover:border-cyan-500/40 text-gray-300 hover:text-cyan-300 text-[11px] font-medium px-3 py-1 rounded-lg transition">
                📺 Stranger Things 5
            </button>
            <button onclick="window.setAiPromptSuggestion('Cien Años de Soledad Parte 2 en Netflix fecha de estreno y sinopsis')" class="bg-black/60 hover:bg-gray-800 border border-gray-800 hover:border-cyan-500/40 text-gray-300 hover:text-cyan-300 text-[11px] font-medium px-3 py-1 rounded-lg transition">
                🍿 Cien Años de Soledad
            </button>
            <button onclick="window.setAiPromptSuggestion('Nuevo anime Demon Slayer El Castillo Infinito en Crunchyroll')" class="bg-black/60 hover:bg-gray-800 border border-gray-800 hover:border-cyan-500/40 text-gray-300 hover:text-cyan-300 text-[11px] font-medium px-3 py-1 rounded-lg transition">
                ⚔️ Demon Slayer Cine
            </button>
        `;
    }
}

// ==========================================================================
// 1. MOTOR DE BÚSQUEDA DE IMÁGENES REALES EN INTERNET (NO IA)
// ==========================================================================
async function searchRealWebImages(query, platform = "") {
    const images = [];
    const cleanQuery = query.replace(/[^\w\s\d]/gi, ' ').trim();

    // 1. Búsqueda en TVMaze API (Series y Shows de TV en HD)
    try {
        const tvRes = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(cleanQuery)}`);
        if (tvRes.ok) {
            const tvData = await tvRes.json();
            tvData.slice(0, 5).forEach(item => {
                if (item.show && item.show.image) {
                    if (item.show.image.original) {
                        images.push({
                            url: item.show.image.original,
                            source: `TVMaze (${item.show.name || 'Póster Oficial'})`,
                            type: "poster"
                        });
                    }
                    if (item.show.image.medium && item.show.image.medium !== item.show.image.original) {
                        images.push({
                            url: item.show.image.medium,
                            source: `TVMaze HD (${item.show.name || 'Carátula'})`,
                            type: "poster"
                        });
                    }
                }
            });
        }
    } catch (e) {
        console.warn("TVMaze Search fallback:", e);
    }

    // 2. Búsqueda en iTunes Search API (Películas y Cine en Alta Resolución)
    try {
        const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanQuery)}&entity=movie&limit=6`);
        if (itunesRes.ok) {
            const itunesData = await itunesRes.json();
            if (itunesData.results) {
                itunesData.results.forEach(res => {
                    if (res.artworkUrl100) {
                        const hdPoster = res.artworkUrl100.replace('100x100bb', '800x800bb');
                        images.push({
                            url: hdPoster,
                            source: `Apple Cine HD (${res.trackName || 'Oficial'})`,
                            type: "poster"
                        });
                    }
                });
            }
        }
    } catch (e) {
        console.warn("iTunes Search fallback:", e);
    }

    // 3. Búsqueda en Jikan API (Anime Oficial MyAnimeList en HD)
    if (cleanQuery.toLowerCase().includes('anime') || platform.toUpperCase() === 'CRUNCHYROLL' || cleanQuery.toLowerCase().includes('jojo') || cleanQuery.toLowerCase().includes('demon') || cleanQuery.toLowerCase().includes('dragon') || cleanQuery.toLowerCase().includes('piece')) {
        try {
            const animeRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanQuery)}&limit=5`);
            if (animeRes.ok) {
                const animeData = await animeRes.json();
                if (animeData.data) {
                    animeData.data.forEach(item => {
                        if (item.images && item.images.jpg && item.images.jpg.large_image_url) {
                            images.push({
                                url: item.images.jpg.large_image_url,
                                source: `MyAnimeList (${item.title || 'Anime HD'})`,
                                type: "poster"
                            });
                        }
                    });
                }
            }
        } catch (e) {
            console.warn("Jikan Anime Search fallback:", e);
        }
    }

    // 4. Búsqueda en Wikipedia / Wikimedia Commons para Producciones, Artículos y Logos
    try {
        const wikiRes = await fetch(`https://es.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&pithumbsize=1000&generator=search&gsrsearch=${encodeURIComponent(cleanQuery)}&gsrlimit=5`);
        if (wikiRes.ok) {
            const wikiData = await wikiRes.json();
            if (wikiData.query && wikiData.query.pages) {
                Object.values(wikiData.query.pages).forEach(page => {
                    if (page.thumbnail && page.thumbnail.source) {
                        images.push({
                            url: page.thumbnail.source,
                            source: `Wikipedia Oficial (${page.title})`,
                            type: "backdrop"
                        });
                    }
                });
            }
        }
    } catch (e) {
        console.warn("Wikipedia Search fallback:", e);
    }

    // 5. Imágenes locales de respaldo
    const platformFallbacks = {
        "NETFLIX": ["assets/img/poster_ciensoledad.jpg", "assets/img/poster_jojo.jpg", "assets/img/poster_walter.jpg", "assets/img/poster3.jpg", "assets/img/news1.jpg"],
        "DISNEY": ["assets/img/poster1.jpg", "assets/img/news1.jpg", "assets/img/news4.jpg"],
        "MAX": ["assets/img/poster4.jpg", "assets/img/news1.jpg", "assets/img/news3.jpg"],
        "PRIME": ["assets/img/poster5.jpg", "assets/img/news1.jpg"],
        "CRUNCHYROLL": ["assets/img/poster2.jpg", "assets/img/poster_jojo.jpg", "assets/img/news1.jpg"],
        "SPOTIFY": ["assets/img/news1.jpg", "assets/img/news6.jpg"]
    };

    const fallbacks = platformFallbacks[platform.toUpperCase()] || ["assets/img/news1.jpg", "assets/img/news2.jpg", "assets/img/news3.jpg", "assets/img/poster1.jpg", "assets/img/poster2.jpg"];
    fallbacks.forEach((fb, idx) => {
        images.push({
            url: fb,
            source: `Biblioteca Local CuzcitoGo #${idx + 1}`,
            type: "fallback"
        });
    });

    const unique = [];
    const seen = new Set();
    images.forEach(img => {
        if (!seen.has(img.url)) {
            seen.add(img.url);
            unique.push(img);
        }
    });

    return unique;
}

// ==========================================================================
// 2. GENERACIÓN DE CONTENIDO DE MARKETING CON GEMINI API (CON FALLBACK)
// ==========================================================================
window.generateMarketingContent = async () => {
    const promptInput = document.getElementById('aiAgentPrompt');
    const statusBox = document.getElementById('aiAgentStatus');
    const resultBox = document.getElementById('aiAgentResult');
    const generateBtn = document.getElementById('btnAiGenerate');

    if (!promptInput || !promptInput.value.trim()) {
        alert("Por favor escribe una idea o título para que el Agente de Marketing la desarrolle.");
        return;
    }

    const userPrompt = promptInput.value.trim();
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
        alert("Por favor ingresa una API Key de Gemini válida.");
        return;
    }

    if (statusBox) {
        statusBox.classList.remove('hidden');
        statusBox.innerHTML = `
            <div class="flex items-center gap-3 text-sm text-yellow-300">
                <i class="fa-solid fa-circle-notch fa-spin text-xl text-cuycito-gold"></i>
                <div>
                    <strong class="block text-white">El Agente IA de Marketing está redactando (${currentAiContentType === 'NEWS' ? 'Noticia 16:9' : 'Cartelera 2:3'})...</strong>
                    <span class="text-xs text-gray-300">Consultando datos oficiales, redactando copy persuasivo y buscando imágenes en internet...</span>
                </div>
            </div>
        `;
    }
    if (resultBox) resultBox.classList.add('hidden');
    if (generateBtn) generateBtn.disabled = true;

    try {
        let systemInstruction = "";

        if (currentAiContentType === "NEWS") {
            systemInstruction = `
Eres el Editor en Jefe y Periodista Tecnológico de "CuzcitoGo VIP", club premium de streaming y tecnología en Perú.
Tu misión: Redactar un artículo o reportaje de alto impacto en formato horizontal (16:9) sobre novedades de streaming, tecnología 4K, análisis de mercado o lanzamientos.

Debes devolver OBLIGATORIAMENTE un JSON válido con la siguiente estructura exacta:
{
  "titulo": "Titular periodístico llamativo con emojis (máx 90 caracteres)",
  "categoria": "TECNOLOGÍA 4K",
  "readTime": "4 min de lectura",
  "fechaEstreno": "Actualizado Hoy",
  "plataforma": "NETFLIX",
  "calidad": "4K Ultra HD",
  "rating": "9.6",
  "tag": "REPORTAJE EXCLUSIVO",
  "resumenCorto": "Extracto de 2 oraciones para la tarjeta de portada.",
  "redaccionCompleta": "<p class='text-sm text-gray-300 leading-relaxed font-normal'>Primer párrafo con el gancho y contexto de la noticia...</p><h4 class='text-base font-black text-white mt-4 mb-2'>🚀 Aspectos Clave & Innovación</h4><p class='text-xs text-gray-300 leading-relaxed'>Segundo párrafo con detalles técnicos y ventajas...</p><div class='bg-black/60 border border-yellow-500/40 p-3.5 rounded-xl mt-4'><strong class='text-yellow-400 font-bold block mb-1 text-xs'><i class='fa-solid fa-crown mr-1'></i> Disfrútalo al Máximo con CuzcitoGo:</strong><p class='text-xs text-gray-300'>Accede con tu pantalla privada y la mejor calidad garantizada.</p></div>",
  "queryBusquedaImagenes": "Término en inglés o español para buscar foto horizontal 16:9 en internet"
}
`;
        } else {
            systemInstruction = `
Eres el Copywriter Principal y Agente de Marketing de "CuzcitoGo VIP", club exclusivo de streaming en Perú y Latinoamérica que vende pantallas privadas con PIN propio en 4K Ultra HD (Netflix, Disney+ con ESPN, Max Platino, Amazon Prime Video, Crunchyroll Mega Fan, Spotify Hi-Fi).

Tu misión: Recibir una serie o película y generar una ficha de cartelera/estrenos con póster vertical (2:3).
Debes devolver OBLIGATORIAMENTE un JSON válido con la siguiente estructura exacta:
{
  "titulo": "Título de la serie o película con emojis (máx 90 caracteres)",
  "tipo": "estrenos",
  "plataforma": "NETFLIX",
  "categoria": "CINE & SERIES",
  "fechaEstreno": "Fecha aproximada o año (ej: 'Estreno Diciembre 2026' o 'En Emisión')",
  "calidad": "4K UHD • Dolby Atmos",
  "rating": "9.6",
  "tag": "TEMPORADA FINAL",
  "readTime": "4 min",
  "resumenCorto": "Sinopsis de 2 oraciones para la tarjeta de cartelera.",
  "redaccionCompleta": "<p class='text-sm text-gray-300 leading-relaxed font-normal'>Sinopsis argumental y reparto principal...</p><h4 class='text-base font-black text-white mt-4 mb-2'>🔥 Lo que debes saber</h4><p class='text-xs text-gray-300 leading-relaxed'>Detalles de la producción...</p>",
  "queryBusquedaImagenes": "Título limpio para buscar póster vertical oficial (ej: 'Deadpool Wolverine movie poster' o 'Stranger Things 5 poster')"
}
`;
        }

        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: `${systemInstruction}\n\nIdea del Administrador: "${userPrompt}"`
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1500
            }
        };

        const candidateModels = [
            'gemini-3.5-flash-lite',
            'gemini-3.6-flash',
            'gemini-3.7-flash',
            'gemini-flash-latest'
        ];

        let rawText = null;
        let lastError = null;

        for (const model of candidateModels) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody)
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                        rawText = data.candidates[0].content.parts[0].text;
                        break;
                    }
                } else {
                    const errData = await response.json().catch(() => ({}));
                    lastError = errData.error?.message || `Error ${response.status} en ${model}`;
                }
            } catch (e) {
                lastError = e.message;
            }
        }

        if (!rawText) {
            throw new Error(lastError || "Ninguno de los modelos disponibles pudo responder en este momento.");
        }

        let cleanJsonStr = rawText.trim();
        if (cleanJsonStr.startsWith("```json")) {
            cleanJsonStr = cleanJsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (cleanJsonStr.startsWith("```")) {
            cleanJsonStr = cleanJsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        const parsedContent = JSON.parse(cleanJsonStr);
        currentAiGeneratedData = parsedContent;
        currentImagePosX = 50;
        currentImagePosY = 50;
        currentImageZoom = 100;

        aiConversationHistory = [
            { role: "user", text: userPrompt },
            { role: "agent", data: parsedContent }
        ];

        const initialUrlMatch = userPrompt.match(/(https?:\/\/[^\s]+)/i);
        const searchQuery = parsedContent.queryBusquedaImagenes || parsedContent.titulo || userPrompt;
        currentCandidateImages = await searchRealWebImages(searchQuery, parsedContent.plataforma);

        if (initialUrlMatch) {
            currentCandidateImages.unshift({
                url: initialUrlMatch[0],
                source: "🔗 Enlace proporcionado por ti",
                type: "custom_link"
            });
        }
        selectedImageIndex = 0;

        renderAiGeneratedPreview();

        if (statusBox) statusBox.classList.add('hidden');
        if (resultBox) resultBox.classList.remove('hidden');

    } catch (err) {
        console.error("Error en Agente IA:", err);
        if (statusBox) {
            statusBox.innerHTML = `
                <div class="bg-red-950/80 border border-red-500/60 rounded-xl p-4 text-xs text-red-200 space-y-2">
                    <strong class="text-white font-bold flex items-center gap-2">
                        <i class="fa-solid fa-triangle-exclamation text-red-400"></i> No se pudo generar el contenido
                    </strong>
                    <p>${err.message}</p>
                    <div class="pt-2">
                        <button onclick="window.generateMarketingContent()" class="bg-red-800 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition">
                            <i class="fa-solid fa-rotate-right mr-1"></i> Reintentar
                        </button>
                    </div>
                </div>
            `;
        }
    } finally {
        if (generateBtn) generateBtn.disabled = false;
    }
};

// ==========================================================================
// 3. CHAT DE FEEDBACK CONTINUO & REFINAMIENTO CON EL AGENTE
// ==========================================================================
window.refineAiMarketingContent = async (customFeedback = '') => {
    const feedbackInput = document.getElementById('aiAgentFeedbackInput');
    const feedbackText = customFeedback || (feedbackInput ? feedbackInput.value.trim() : '');

    if (!feedbackText) {
        alert("Por favor escribe tu instrucción de feedback o pega un enlace de imagen.");
        return;
    }

    // 1. Detectar si el usuario pegó una URL de imagen directamente en el feedback
    const urlMatch = feedbackText.match(/(https?:\/\/[^\s]+)/i);
    let extractedUrl = null;
    let textWithoutUrl = feedbackText;

    if (urlMatch) {
        extractedUrl = urlMatch[0];
        textWithoutUrl = feedbackText.replace(extractedUrl, '').trim();

        // Inyectar de inmediato como la opción #1 seleccionada
        const customImageObj = {
            url: extractedUrl,
            source: "🔗 Enlace proporcionado por ti",
            type: "custom_link"
        };

        // Evitar duplicados y colocar al inicio
        currentCandidateImages = currentCandidateImages.filter(img => img.url !== extractedUrl);
        currentCandidateImages.unshift(customImageObj);
        selectedImageIndex = 0;
        currentImagePosX = 50;
        currentImagePosY = 50;
        currentImageZoom = 100;

        // Si el usuario SOLO envió el enlace (o "usa esta imagen: URL"), actualizar de inmediato
        if (!textWithoutUrl || textWithoutUrl.length < 5 || /^(usa|pon|cambia|coloca|esta|este|imagen|link|foto|poster)\b/i.test(textWithoutUrl)) {
            renderAiGeneratedPreview();
            if (feedbackInput) feedbackInput.value = '';
            alert("✅ ¡Imagen cargada y aplicada desde tu enlace!");
            return;
        }
    }

    const apiKey = getGeminiApiKey();
    const refineBtn = document.getElementById('btnAiRefine');
    const statusBox = document.getElementById('aiAgentRefineStatus');

    if (refineBtn) refineBtn.disabled = true;
    if (statusBox) {
        statusBox.classList.remove('hidden');
        statusBox.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin text-cuycito-gold mr-1.5"></i> Refinando contenido con tu feedback...`;
    }

    try {
        const isImageSearchRequest = !extractedUrl && /imagen|foto|poster|caratula|portada|horizontal|vertical|margen/i.test(feedbackText);
        
        const refinePrompt = `
Contexto actual del artículo/estreno:
${JSON.stringify(currentAiGeneratedData, null, 2)}

Instrucción de Feedback del Administrador:
"${feedbackText}"
${extractedUrl ? `NOTA: El usuario proporcionó el enlace de imagen directo: ${extractedUrl}` : ''}

Aplica las modificaciones solicitadas manteniendo la estructura JSON obligatoria de CuzcitoGo VIP. Si el usuario pidió cambios de texto o narrativa, actualízalos. Devuelve SOLO el JSON puro:
`;

        const requestBody = {
            contents: [{ parts: [{ text: refinePrompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1500 }
        };

        const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-flash-latest'];
        let rawText = null;

        for (const model of candidateModels) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody)
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                        rawText = data.candidates[0].content.parts[0].text;
                        break;
                    }
                }
            } catch (e) {}
        }

        if (rawText) {
            let cleanJsonStr = rawText.trim();
            if (cleanJsonStr.startsWith("```json")) {
                cleanJsonStr = cleanJsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            } else if (cleanJsonStr.startsWith("```")) {
                cleanJsonStr = cleanJsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
            }

            const updatedData = JSON.parse(cleanJsonStr);
            currentAiGeneratedData = updatedData;

            // Si se pidió buscar nuevas imágenes en la web y no se dio URL directa
            if (isImageSearchRequest) {
                const newImgs = await searchRealWebImages(updatedData.queryBusquedaImagenes || feedbackText, updatedData.plataforma);
                if (newImgs.length > 0) {
                    currentCandidateImages = newImgs;
                    selectedImageIndex = 0;
                }
            }

            renderAiGeneratedPreview();
            if (feedbackInput) feedbackInput.value = '';
        }

    } catch (err) {
        console.error("Error al refinar feedback:", err);
        alert("No se pudo procesar el feedback: " + err.message);
    } finally {
        if (refineBtn) refineBtn.disabled = false;
        if (statusBox) statusBox.classList.add('hidden');
    }
};

// ==========================================================================
// 4. RENDERIZADO DE LA VISTA PREVIA INTERACTIVA + HERRAMIENTA DE ENCUADRE (16:9 / 2:3)
// ==========================================================================
function renderAiGeneratedPreview() {
    const container = document.getElementById('aiAgentPreviewContainer');
    if (!container || !currentAiGeneratedData) return;

    const data = currentAiGeneratedData;
    const currentImg = currentCandidateImages[selectedImageIndex] ? currentCandidateImages[selectedImageIndex].url : 'assets/img/news1.jpg';
    const isNewsMode = currentAiContentType === 'NEWS';

    const platformColors = {
        "NETFLIX": "bg-red-600",
        "DISNEY": "bg-blue-600",
        "MAX": "bg-purple-600",
        "PRIME": "bg-amber-600",
        "CRUNCHYROLL": "bg-orange-600",
        "SPOTIFY": "bg-emerald-600"
    };

    const categoryColors = {
        "ANÁLISIS DE MERCADO": "bg-red-600",
        "CINE & SERIES": "bg-cuycito-red",
        "ANIME & GAMING": "bg-orange-500",
        "AUDIO & HI-FI": "bg-emerald-600",
        "TECNOLOGÍA 4K": "bg-sky-600"
    };

    const badgeColor = isNewsMode 
        ? (categoryColors[data.categoria] || "bg-orange-600")
        : (platformColors[(data.plataforma || '').toUpperCase()] || "bg-yellow-600");
    const badgeLabel = isNewsMode ? (data.categoria || "NOTICIA 16:9") : (data.plataforma || "CARTELERA 2:3");

    const objectPosStyle = `${currentImagePosX}% ${currentImagePosY}%`;
    const zoomTransform = `scale(${currentImageZoom / 100})`;
    const aspectClass = currentImageAspect === '16/9' ? 'aspect-[16/9] max-h-[300px]' : 'aspect-[2/3] max-h-[380px]';

    container.innerHTML = `
        <div class="bg-[#121212] border-2 ${isNewsMode ? 'border-orange-500/80 shadow-[0_0_25px_rgba(249,115,22,0.15)]' : 'border-cuycito-gold/80 shadow-[0_0_25px_rgba(255,183,3,0.15)]'} rounded-3xl p-5 sm:p-6 shadow-2xl space-y-6">
            
            <!-- Encabezado con Badges -->
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-4">
                <div class="flex items-center gap-2.5">
                    <span class="px-3 py-1 rounded-full text-xs font-black text-white ${badgeColor} uppercase tracking-wider shadow">
                        ${badgeLabel}
                    </span>
                    <span class="bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-black px-2.5 py-1 rounded-lg flex items-center gap-1 shadow">
                        <i class="fa-solid fa-wand-magic-sparkles text-cyan-400"></i> Agente IA • ${isNewsMode ? 'Formato 16:9 Noticia' : 'Formato 2:3 Póster'}
                    </span>
                </div>
                
                <!-- Selector rápido de aspecto dentro de la tarjeta -->
                <div class="flex items-center gap-1.5 bg-black/80 p-1 rounded-xl border border-gray-800 text-[11px] font-bold">
                    <span class="text-gray-400 px-2">Proporción:</span>
                    <button onclick="window.setImageAspect('16/9')" class="px-2.5 py-1 rounded-lg transition ${currentImageAspect === '16/9' ? 'bg-orange-600 text-white font-black shadow' : 'text-gray-400 hover:text-white'}">
                        16:9 (Horizontal)
                    </button>
                    <button onclick="window.setImageAspect('2/3')" class="px-2.5 py-1 rounded-lg transition ${currentImageAspect === '2/3' ? 'bg-cuycito-gold text-black font-black shadow' : 'text-gray-400 hover:text-white'}">
                        2:3 (Póster)
                    </button>
                </div>
            </div>

            <!-- Grid Principal: Imagen & Datos -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                <!-- Columna Izquierda: Imagen con Herramienta de Arrastre & Encuadre -->
                <div class="lg:col-span-5 space-y-3">
                    <div class="flex items-center justify-between">
                        <label class="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                            <i class="fa-solid fa-crop text-cuycito-gold"></i> Encuadre Interactivo (${currentImageAspect})
                        </label>
                        <span class="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            Arrastra para recortar
                        </span>
                    </div>

                    <!-- Contenedor Interactivo con Arrastre para Centrar / Encuadrar -->
                    <div class="space-y-2">
                        <div 
                            id="aiImageFramingBox" 
                            class="relative ${aspectClass} w-full rounded-2xl overflow-hidden bg-black border-2 border-cyan-500/50 shadow-xl cursor-grab active:cursor-grabbing select-none group touch-none mx-auto"
                            title="Haz clic y arrastra con el ratón para centrar y mover la sección visible de la imagen"
                        >
                            <img 
                                id="aiPreviewSelectedImg" 
                                src="${currentImg}" 
                                alt="Previsualización" 
                                class="w-full h-full object-cover transition-none pointer-events-none"
                                style="object-position: ${objectPosStyle}; transform: ${zoomTransform};"
                            >
                            
                            <!-- Guía de Encuadre Visual en Arrastre con Cuadrícula sutil -->
                            <div class="absolute inset-0 border-2 border-dashed border-cyan-400/40 pointer-events-none group-hover:border-cyan-400/80 transition flex items-center justify-center">
                                <div class="w-10 h-10 border border-cyan-400/40 rounded-full flex items-center justify-center pointer-events-none opacity-40 group-hover:opacity-100 transition">
                                    <div class="w-2 h-2 bg-cyan-400 rounded-full shadow"></div>
                                </div>
                            </div>

                            <span class="absolute top-2 right-2 bg-black/80 backdrop-blur-sm text-cyan-300 text-[10px] font-bold px-2 py-1 rounded-lg border border-cyan-500/40 pointer-events-none flex items-center gap-1 shadow">
                                <i class="fa-solid fa-arrows-up-down-left-right"></i> Arrastra imagen
                            </span>

                            <div class="absolute bottom-2 left-2 right-2 bg-black/80 backdrop-blur-sm border border-gray-700 rounded-lg p-1.5 text-[10px] text-gray-300 truncate text-center pointer-events-none">
                                Fuente: <span id="aiImageSourceLabel" class="text-cuycito-gold font-bold">${currentCandidateImages[selectedImageIndex]?.source || 'Web Oficial'}</span>
                            </div>
                        </div>

                        <!-- Controles Rápidos de Ajuste Fino (Sliders & Presets) -->
                        <div class="bg-black/80 border border-gray-800 rounded-xl p-3 space-y-2.5 text-xs">
                            <div class="flex items-center justify-between text-[11px] font-bold text-gray-300 border-b border-gray-800 pb-1.5">
                                <span><i class="fa-solid fa-sliders text-cyan-400 mr-1"></i> Posición y Margen:</span>
                                <span id="framingPosLabel" class="text-cyan-300 font-mono">X: ${currentImagePosX}% | Y: ${currentImagePosY}%</span>
                            </div>

                            <!-- Botones Rápidos de Centrado -->
                            <div class="grid grid-cols-5 gap-1.5 text-[10px]">
                                <button onclick="window.setPresetImagePosition(50, 0)" class="bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 py-1 rounded font-bold transition cursor-pointer">⬆️ Arriba</button>
                                <button onclick="window.setPresetImagePosition(50, 50)" class="bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 py-1 rounded font-bold transition cursor-pointer">🎯 Centro</button>
                                <button onclick="window.setPresetImagePosition(50, 100)" class="bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 py-1 rounded font-bold transition cursor-pointer">⬇️ Abajo</button>
                                <button onclick="window.setPresetImagePosition(0, 50)" class="bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 py-1 rounded font-bold transition cursor-pointer">⬅️ Izq</button>
                                <button onclick="window.setPresetImagePosition(100, 50)" class="bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 py-1 rounded font-bold transition cursor-pointer">➡️ Der</button>
                            </div>

                            <!-- Sliders de Zoom y Posición -->
                            <div class="grid grid-cols-3 gap-2 pt-1 text-[10px]">
                                <div>
                                    <span class="text-gray-400 block mb-1">Horizontal (X):</span>
                                    <input type="range" min="0" max="100" value="${currentImagePosX}" oninput="window.updateFramingSliders('X', this.value)" class="w-full accent-cyan-400 h-1.5 bg-gray-800 rounded-lg cursor-pointer">
                                </div>
                                <div>
                                    <span class="text-gray-400 block mb-1">Vertical (Y):</span>
                                    <input type="range" min="0" max="100" value="${currentImagePosY}" oninput="window.updateFramingSliders('Y', this.value)" class="w-full accent-cyan-400 h-1.5 bg-gray-800 rounded-lg cursor-pointer">
                                </div>
                                <div>
                                    <span class="text-gray-400 block mb-1">Zoom (${currentImageZoom}%):</span>
                                    <input type="range" min="100" max="180" value="${currentImageZoom}" oninput="window.updateFramingSliders('Z', this.value)" class="w-full accent-cyan-400 h-1.5 bg-gray-800 rounded-lg cursor-pointer">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Carrusel de selección de imágenes encontradas -->
                    <div class="space-y-1.5 pt-1">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Fotos Oficiales Encontradas (${currentCandidateImages.length}):</span>
                        <div class="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                            ${currentCandidateImages.map((img, idx) => `
                                <button onclick="window.selectAiCandidateImage(${idx})" class="w-16 h-16 rounded-xl overflow-hidden border-2 transition shrink-0 cursor-pointer ${idx === selectedImageIndex ? 'border-cuycito-gold shadow-[0_0_10px_rgba(255,183,3,0.8)] scale-105' : 'border-gray-800 opacity-60 hover:opacity-100'}">
                                    <img src="${img.url}" class="w-full h-full object-cover" alt="Opción ${idx + 1}">
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Entrada manual de URL -->
                    <div>
                        <input 
                            type="text" 
                            id="aiCustomImageUrl" 
                            value="${currentImg}" 
                            oninput="window.updateAiCustomImage(this.value)"
                            placeholder="O pega una URL de imagen personalizada..." 
                            class="w-full bg-black border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-cuycito-gold transition"
                        >
                    </div>
                </div>

                <!-- Columna Derecha: Campos Editables y Texto de Marketing -->
                <div class="lg:col-span-7 space-y-4">
                    
                    <div>
                        <label class="text-xs font-bold text-gray-300 block mb-1">${isNewsMode ? 'Título de la Noticia / Reportaje:' : 'Título de la Serie / Película:'}</label>
                        <input 
                            type="text" 
                            id="aiEditTitle" 
                            value="${data.titulo}" 
                            class="w-full bg-black border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-cuycito-gold transition"
                        >
                    </div>

                    ${isNewsMode ? `
                    <!-- Campos para NOTICIA 16:9 -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label class="text-[11px] font-bold text-gray-400 block mb-1">Categoría:</label>
                            <select id="aiEditCategory" class="w-full bg-black border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 font-bold">
                                <option value="TECNOLOGÍA 4K" ${data.categoria === 'TECNOLOGÍA 4K' ? 'selected' : ''}>TECNOLOGÍA 4K</option>
                                <option value="CINE & SERIES" ${data.categoria === 'CINE & SERIES' ? 'selected' : ''}>CINE & SERIES</option>
                                <option value="ANÁLISIS DE MERCADO" ${data.categoria === 'ANÁLISIS DE MERCADO' ? 'selected' : ''}>ANÁLISIS DE MERCADO</option>
                                <option value="ANIME & GAMING" ${data.categoria === 'ANIME & GAMING' ? 'selected' : ''}>ANIME & GAMING</option>
                                <option value="AUDIO & HI-FI" ${data.categoria === 'AUDIO & HI-FI' ? 'selected' : ''}>AUDIO & HI-FI</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-[11px] font-bold text-gray-400 block mb-1">Tiempo de Lectura:</label>
                            <input 
                                type="text" 
                                id="aiEditReadTime" 
                                value="${data.readTime || '4 min de lectura'}" 
                                class="w-full bg-black border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-orange-500"
                            >
                        </div>
                        <div>
                            <label class="text-[11px] font-bold text-gray-400 block mb-1">Fecha / Estado:</label>
                            <input 
                                type="text" 
                                id="aiEditDate" 
                                value="${data.fechaEstreno || 'Actualizado Hoy'}" 
                                class="w-full bg-black border border-gray-700 rounded-xl px-3 py-2 text-xs text-yellow-300 font-bold focus:outline-none focus:border-orange-500"
                            >
                        </div>
                    </div>
                    ` : `
                    <!-- Campos para CARTELERA 2:3 -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label class="text-[11px] font-bold text-gray-400 block mb-1">Plataforma:</label>
                            <select id="aiEditPlatform" class="w-full bg-black border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cuycito-gold font-bold">
                                <option value="NETFLIX" ${data.plataforma === 'NETFLIX' ? 'selected' : ''}>Netflix</option>
                                <option value="MAX" ${data.plataforma === 'MAX' ? 'selected' : ''}>Max HBO</option>
                                <option value="DISNEY" ${data.plataforma === 'DISNEY' ? 'selected' : ''}>Disney+</option>
                                <option value="PRIME" ${data.plataforma === 'PRIME' ? 'selected' : ''}>Prime Video</option>
                                <option value="CRUNCHYROLL" ${data.plataforma === 'CRUNCHYROLL' ? 'selected' : ''}>Crunchyroll</option>
                                <option value="SPOTIFY" ${data.plataforma === 'SPOTIFY' ? 'selected' : ''}>Spotify</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-[11px] font-bold text-gray-400 block mb-1">Fecha de Estreno:</label>
                            <input 
                                type="text" 
                                id="aiEditReleaseDate" 
                                value="${data.fechaEstreno || 'Estreno 2026'}" 
                                class="w-full bg-black border border-gray-700 rounded-xl px-3 py-2 text-xs text-yellow-300 font-bold focus:outline-none focus:border-cuycito-gold"
                            >
                        </div>
                        <div>
                            <label class="text-[11px] font-bold text-gray-400 block mb-1">Calidad / Audio:</label>
                            <input 
                                type="text" 
                                id="aiEditQuality" 
                                value="${data.calidad || '4K UHD • Dolby Atmos'}" 
                                class="w-full bg-black border border-gray-700 rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold focus:outline-none focus:border-cuycito-gold"
                            >
                        </div>
                    </div>
                    `}

                    <div>
                        <label class="text-xs font-bold text-gray-300 block mb-1">Resumen Corto (Excerpt para tarjetas):</label>
                        <textarea 
                            id="aiEditExcerpt" 
                            rows="2" 
                            class="w-full bg-black border border-gray-700 rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:border-cuycito-gold transition"
                        >${data.resumenCorto}</textarea>
                    </div>

                    <div>
                        <label class="text-xs font-bold text-gray-300 block mb-1">Redacción Completa (HTML / Párrafos):</label>
                        <textarea 
                            id="aiEditContent" 
                            rows="4" 
                            class="w-full bg-black border border-gray-700 rounded-xl p-3 text-xs text-gray-200 font-mono focus:outline-none focus:border-cuycito-gold transition"
                        >${data.redaccionCompleta}</textarea>
                    </div>

                    <!-- SECCIÓN: CHAT DE FEEDBACK & REFINAMIENTO CONTINUO -->
                    <div class="bg-gradient-to-r from-cyan-950/40 via-black to-black border border-cyan-500/40 rounded-2xl p-4 space-y-3 shadow-inner">
                        <div class="flex items-center justify-between">
                            <label class="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                                <i class="fa-solid fa-comments"></i> Chat de Feedback con el Agente
                            </label>
                            <span class="text-[10px] text-gray-400">Pídele cambios de narrativa, márgenes o imágenes</span>
                        </div>

                        <div class="flex flex-col sm:flex-row gap-2">
                            <input 
                                type="text" 
                                id="aiAgentFeedbackInput" 
                                placeholder="Ej: 'Busca otra foto más horizontal', 'Haz el texto más técnico', 'Cambia el estreno a Diciembre'..." 
                                class="flex-1 bg-black border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-cyan-400 transition"
                                onkeydown="if(event.key==='Enter') window.refineAiMarketingContent();"
                            >
                            <button 
                                id="btnAiRefine"
                                onclick="window.refineAiMarketingContent()" 
                                class="bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs px-4 py-2.5 rounded-xl transition shadow flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                            >
                                <i class="fa-solid fa-paper-plane"></i>
                                <span>Refinar</span>
                            </button>
                        </div>

                        <!-- Chips de Feedback Rápido -->
                        <div class="flex flex-wrap items-center gap-1.5">
                            <span class="text-[10px] text-gray-500 font-bold">Feedback rápido:</span>
                            <button onclick="window.refineAiMarketingContent('Busca más imágenes oficiales en alta resolución')" class="bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 text-[10px] px-2 py-0.5 rounded transition">
                                🖼️ Más fotos HD
                            </button>
                            <button onclick="window.refineAiMarketingContent('Haz la redacción más corta y directa al grano')" class="bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 text-[10px] px-2 py-0.5 rounded transition">
                                ✂️ Más corto
                            </button>
                            <button onclick="window.refineAiMarketingContent('Enfoca el gancho en el ahorro con pantallas privadas de CuzcitoGo')" class="bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 text-[10px] px-2 py-0.5 rounded transition">
                                💰 Enfocar en Ahorro
                            </button>
                            <button onclick="window.refineAiMarketingContent('Haz el tono más emocionante y periodístico')" class="bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 text-[10px] px-2 py-0.5 rounded transition">
                                🔥 Más periodístico
                            </button>
                        </div>

                        <div id="aiAgentRefineStatus" class="hidden text-xs text-yellow-300 font-bold flex items-center gap-1.5 pt-1"></div>
                    </div>
                </div>
            </div>

            <!-- Botones de Acción: Publicar en 1 Clic -->
            <div class="pt-4 border-t border-gray-800 space-y-3">
                <div class="flex items-center justify-between">
                    <button onclick="window.generateMarketingContent()" class="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer">
                        <i class="fa-solid fa-rotate-right"></i> Regenerar
                    </button>
                    <span class="text-xs text-cuycito-gold font-bold uppercase tracking-wider">🚀 Opciones de Publicación Directa:</span>
                </div>

                ${isNewsMode ? `
                <!-- Botones de Publicación para NOTICIAS 16:9 -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <!-- 1. Hero Slider Portada -->
                    <button onclick="window.publishAiAsNews(true)" class="bg-gradient-to-r from-orange-600 to-cuycito-red hover:from-orange-500 hover:to-red-500 text-white font-black text-xs p-3.5 rounded-2xl transition shadow-lg glow-red flex flex-col items-center justify-center text-center gap-1 cursor-pointer">
                        <i class="fa-solid fa-crown text-base text-yellow-300"></i>
                        <span>Hero Slider #1 (Portada)</span>
                    </button>

                    <!-- 2. Sub-Destacada Tecnológica -->
                    <button onclick="window.publishAiAsSubdestacada()" class="bg-gradient-to-r from-sky-700 to-blue-600 hover:from-sky-600 hover:to-blue-500 text-white font-black text-xs p-3.5 rounded-2xl transition shadow-lg flex flex-col items-center justify-center text-center gap-1 cursor-pointer">
                        <i class="fa-solid fa-bolt text-base text-sky-200"></i>
                        <span>Sub-Destacada (Tecno)</span>
                    </button>

                    <!-- 3. Grilla Temática -->
                    <button onclick="window.publishAiAsThematic()" class="bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-black text-xs p-3.5 rounded-2xl transition shadow-lg flex flex-col items-center justify-center text-center gap-1 cursor-pointer">
                        <i class="fa-solid fa-layer-group text-base text-purple-200"></i>
                        <span>Grilla Temática</span>
                    </button>

                    <!-- 4. Lo Más Leído -->
                    <button onclick="window.publishAiAsTop5()" class="bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black font-black text-xs p-3.5 rounded-2xl transition shadow-lg flex flex-col items-center justify-center text-center gap-1 cursor-pointer">
                        <i class="fa-solid fa-fire text-base text-orange-950"></i>
                        <span>'Lo Más Leído' (#1)</span>
                    </button>
                </div>
                ` : `
                <!-- Botones de Publicación para CARTELERA 2:3 -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <!-- 1. Cartelera y Estrenos (Ambos) -->
                    <button onclick="window.publishAiAsCartelera('ambos')" class="bg-gradient-to-r from-amber-500 via-cuycito-gold to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs p-3.5 rounded-2xl transition shadow-xl glow-gold flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer">
                        <i class="fa-solid fa-clapperboard text-lg"></i>
                        <span>Publicar en Cartelera & Estrenos</span>
                    </button>

                    <!-- 2. Solo Cartelera -->
                    <button onclick="window.publishAiAsCartelera('cartelera')" class="bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white font-bold text-xs p-3.5 rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer">
                        <i class="fa-solid fa-film text-cuycito-gold"></i>
                        <span>Solo en Cartelera</span>
                    </button>

                    <!-- 3. Solo Próximos Estrenos -->
                    <button onclick="window.publishAiAsCartelera('estrenos')" class="bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white font-bold text-xs p-3.5 rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer">
                        <i class="fa-solid fa-rocket text-yellow-400"></i>
                        <span>Solo en Próximos Estrenos</span>
                    </button>
                </div>
                `}
            </div>

        </div>
    `;

    // Inicializar listeners de arrastre interactivo
    initImageDragController();
}

window.setImageAspect = (aspect) => {
    currentImageAspect = aspect;
    renderAiGeneratedPreview();
};

// ==========================================================================
// 5. CONTROLADOR DE ARRASTRE PARA CENTRAR / ENCUADRAR LA IMAGEN
// ==========================================================================
function initImageDragController() {
    const box = document.getElementById('aiImageFramingBox');
    const img = document.getElementById('aiPreviewSelectedImg');
    const posLabel = document.getElementById('framingPosLabel');
    if (!box || !img) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialPosX = currentImagePosX;
    let initialPosY = currentImagePosY;

    const onPointerDown = (e) => {
        isDragging = true;
        startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        startY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        initialPosX = currentImagePosX;
        initialPosY = currentImagePosY;
        box.classList.add('cursor-grabbing');
    };

    const onPointerMove = (e) => {
        if (!isDragging) return;
        const currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        const currentY = e.clientY || (e.touches && e.touches[0].clientY) || 0;

        const deltaX = currentX - startX;
        const deltaY = currentY - startY;

        const rect = box.getBoundingClientRect();
        const sensitivity = 1.2;
        
        let newX = Math.round(initialPosX - (deltaX / rect.width) * 100 * sensitivity);
        let newY = Math.round(initialPosY - (deltaY / rect.height) * 100 * sensitivity);

        newX = Math.max(0, Math.min(100, newX));
        newY = Math.max(0, Math.min(100, newY));

        currentImagePosX = newX;
        currentImagePosY = newY;

        img.style.objectPosition = `${newX}% ${newY}%`;
        if (posLabel) posLabel.innerText = `X: ${newX}% | Y: ${newY}%`;
    };

    const onPointerUp = () => {
        if (isDragging) {
            isDragging = false;
            box.classList.remove('cursor-grabbing');
        }
    };

    box.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    box.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
}

window.setPresetImagePosition = (x, y) => {
    currentImagePosX = x;
    currentImagePosY = y;
    const img = document.getElementById('aiPreviewSelectedImg');
    const posLabel = document.getElementById('framingPosLabel');
    if (img) img.style.objectPosition = `${x}% ${y}%`;
    if (posLabel) posLabel.innerText = `X: ${x}% | Y: ${y}%`;
};

window.updateFramingSliders = (type, val) => {
    const img = document.getElementById('aiPreviewSelectedImg');
    const posLabel = document.getElementById('framingPosLabel');
    if (type === 'X') {
        currentImagePosX = parseInt(val, 10);
    } else if (type === 'Y') {
        currentImagePosY = parseInt(val, 10);
    } else if (type === 'Z') {
        currentImageZoom = parseInt(val, 10);
    }
    if (img) {
        img.style.objectPosition = `${currentImagePosX}% ${currentImagePosY}%`;
        img.style.transform = `scale(${currentImageZoom / 100})`;
    }
    if (posLabel) posLabel.innerText = `X: ${currentImagePosX}% | Y: ${currentImagePosY}%`;
};

window.selectAiCandidateImage = (index) => {
    selectedImageIndex = index;
    currentImagePosX = 50;
    currentImagePosY = 50;
    currentImageZoom = 100;
    renderAiGeneratedPreview();
};

window.updateAiCustomImage = (url) => {
    const previewEl = document.getElementById('aiPreviewSelectedImg');
    if (previewEl && url.trim()) {
        previewEl.src = url.trim();
    }
};

// ==========================================================================
// 6. PUBLICACIÓN EN 1 CLIC A CARTELERA / ESTRENOS CON ENCUADRE
// ==========================================================================
window.publishAiAsCartelera = async (carteleraType = 'ambos') => {
    if (!currentAiGeneratedData) return;

    const title = document.getElementById('aiEditTitle').value.trim();
    const platform = document.getElementById('aiEditPlatform')?.value || 'NETFLIX';
    const releaseDate = document.getElementById('aiEditReleaseDate')?.value.trim() || 'Estreno 2026';
    const quality = document.getElementById('aiEditQuality')?.value.trim() || '4K UHD • Dolby Atmos';
    const synopsis = document.getElementById('aiEditExcerpt').value.trim();
    const customImg = document.getElementById('aiCustomImageUrl')?.value.trim();
    const image = customImg || (currentCandidateImages[selectedImageIndex] ? currentCandidateImages[selectedImageIndex].url : 'assets/img/poster3.jpg');
    const imagePosition = `${currentImagePosX}% ${currentImagePosY}%`;

    if (!title) {
        alert("El título no puede estar vacío.");
        return;
    }

    const platformColors = {
        "NETFLIX": "bg-red-600",
        "DISNEY": "bg-blue-600",
        "MAX": "bg-purple-600",
        "PRIME": "bg-amber-600",
        "CRUNCHYROLL": "bg-orange-600",
        "SPOTIFY": "bg-emerald-600"
    };

    const newCarteleraItem = {
        id: "ai-title-" + Date.now(),
        title,
        platform,
        type: carteleraType,
        tag: currentAiGeneratedData.tag || `${platform} EXCLUSIVO`,
        tagColor: platformColors[platform.toUpperCase()] || "bg-yellow-600",
        rating: currentAiGeneratedData.rating || "9.5",
        releaseDate: releaseDate,
        image,
        imagePosition,
        quality,
        synopsis
    };

    let list = [];
    try {
        const stored = localStorage.getItem("cuycito_portal_cartelera");
        if (stored) list = JSON.parse(stored);
    } catch (e) {}

    list.unshift(newCarteleraItem);
    localStorage.setItem("cuycito_portal_cartelera", JSON.stringify(list));

    // Sincronizar en la Nube Firestore
    try {
        const { db, doc, setDoc } = await import('./firebase-config.js');
        if (db) {
            await setDoc(doc(db, "portal_cartelera", newCarteleraItem.id), newCarteleraItem, { merge: true });
        }
    } catch(e) {}

    if (typeof window.renderAdminCarteleraList === 'function') {
        window.renderAdminCarteleraList();
    }

    alert(`🎉 ¡Título publicado con éxito en Cartelera y Estrenos!\n\n"${title}" ya está visible con el encuadre personalizado (${imagePosition}).`);
    
    if (typeof window.switchTab === 'function') {
        window.switchTab('cartelera');
    }
};

// ==========================================================================
// 7. PUBLICACIÓN EN 1 CLIC A NOTICIAS DE PORTADA CON ENCUADRE
// ==========================================================================
window.publishAiAsNews = async (isHero = false) => {
    if (!currentAiGeneratedData) return;

    const title = document.getElementById('aiEditTitle').value.trim();
    const category = document.getElementById('aiEditCategory')?.value || "TECNOLOGÍA 4K";
    const readTime = document.getElementById('aiEditReadTime')?.value.trim() || "4 min de lectura";
    const date = document.getElementById('aiEditDate')?.value.trim() || "Actualizado Hoy";
    const excerpt = document.getElementById('aiEditExcerpt').value.trim();
    const content = document.getElementById('aiEditContent').value.trim();
    const customImg = document.getElementById('aiCustomImageUrl')?.value.trim();
    const image = customImg || (currentCandidateImages[selectedImageIndex] ? currentCandidateImages[selectedImageIndex].url : 'assets/img/news1.jpg');
    const imagePosition = `${currentImagePosX}% ${currentImagePosY}%`;

    if (!title) {
        alert("El título no puede estar vacío.");
        return;
    }

    const categoryColors = {
        "ANÁLISIS DE MERCADO": "bg-red-600",
        "CINE & SERIES": "bg-cuycito-red",
        "ANIME & GAMING": "bg-orange-500",
        "AUDIO & HI-FI": "bg-emerald-600",
        "TECNOLOGÍA 4K": "bg-sky-600"
    };

    const newArticle = {
        id: "ai-news-" + Date.now(),
        title,
        category,
        categoryColor: categoryColors[category] || "bg-orange-600",
        readTime,
        date,
        image,
        imagePosition,
        excerpt,
        content,
        isHero: !!isHero,
        createdAt: new Date().toISOString()
    };

    let newsList = [];
    try {
        const stored = localStorage.getItem("cuycito_portal_news");
        if (stored) newsList = JSON.parse(stored);
    } catch(e) {}

    if (isHero) {
        newsList.forEach(n => n.isHero = false);
    }

    newsList.unshift(newArticle);
    localStorage.setItem("cuycito_portal_news", JSON.stringify(newsList));

    // Sincronizar en la Nube Firestore
    try {
        const { db, doc, setDoc } = await import('./firebase-config.js');
        if (db) {
            await setDoc(doc(db, "portal_news", newArticle.id), newArticle, { merge: true });
        }
    } catch(e) {}

    // Alimentar automáticamente "Lo Más Leído" con esta nueva noticia
    try {
        let top5 = [];
        const storedTop = localStorage.getItem("cuycito_portal_top5");
        if (storedTop) top5 = JSON.parse(storedTop);

        top5 = top5.filter(t => t.id !== newArticle.id && t.title !== title);
        top5.unshift({
            id: newArticle.id,
            rank: 1,
            title,
            tag: newArticle.category || "Tendencia",
            content
        });
        if (top5.length > 5) top5 = top5.slice(0, 5);
        top5.forEach((t, i) => t.rank = i + 1);
        localStorage.setItem("cuycito_portal_top5", JSON.stringify(top5));

        try {
            const { db, doc, setDoc } = await import('./firebase-config.js');
            if (db) await setDoc(doc(db, "portal_config", "top5"), { list: top5 }, { merge: true });
        } catch(e) {}
    } catch(e) {}

    if (typeof window.renderAdminNewsList === 'function') {
        window.renderAdminNewsList();
    }

    alert(`📰 ¡Noticia publicada con éxito en Portada!\n\n"${title}" ya está visible en el carrusel con el encuadre personalizado (${imagePosition}).`);

    if (typeof window.switchTab === 'function') {
        window.switchTab('news');
    }
};

// Publicar como Sub-Destacada Tecnológica
window.publishAiAsSubdestacada = async () => {
    if (!currentAiGeneratedData) return;

    const title = document.getElementById('aiEditTitle').value.trim();
    const excerpt = document.getElementById('aiEditExcerpt').value.trim();
    const content = document.getElementById('aiEditContent').value.trim();
    const customImg = document.getElementById('aiCustomImageUrl')?.value.trim();
    const image = customImg || (currentCandidateImages[selectedImageIndex] ? currentCandidateImages[selectedImageIndex].url : 'assets/img/news5.jpg');
    const imagePosition = `${currentImagePosX}% ${currentImagePosY}%`;

    const subItem = {
        id: "subdestacada-" + Date.now(),
        tag: currentAiGeneratedData.tag || "AVANCE TECNOLÓGICO:",
        badge: "TECNOLOGÍA",
        badgeColor: "bg-sky-600",
        title,
        excerpt,
        image,
        imagePosition,
        category: "HARDWARE & REDES",
        date: "Actualizado Hoy",
        content,
        createdAt: new Date().toISOString()
    };

    localStorage.setItem("cuycito_portal_subdestacada", JSON.stringify(subItem));

    // Sincronizar en la Nube Firestore
    try {
        const { db, doc, setDoc } = await import('./firebase-config.js');
        if (db) {
            await setDoc(doc(db, "portal_config", "subdestacada"), subItem, { merge: true });
        }
    } catch(e) {}

    if (typeof window.renderAdminSubdestacada === 'function') {
        window.renderAdminSubdestacada();
    }

    alert(`⚡ ¡Sub-destacada tecnológica publicada con éxito!\n\n"${title}" ahora ocupa el banner tecnológico de portada.`);

    if (typeof window.switchTab === 'function') {
        window.switchTab('news');
    }
};

// Publicar en Grilla Temática
window.publishAiAsThematic = async () => {
    if (!currentAiGeneratedData) return;

    const title = document.getElementById('aiEditTitle').value.trim();
    const excerpt = document.getElementById('aiEditExcerpt').value.trim();
    const content = document.getElementById('aiEditContent').value.trim();
    const customImg = document.getElementById('aiCustomImageUrl')?.value.trim();
    const image = customImg || (currentCandidateImages[selectedImageIndex] ? currentCandidateImages[selectedImageIndex].url : 'assets/img/news6.jpg');
    const imagePosition = `${currentImagePosX}% ${currentImagePosY}%`;

    const categoryMap = {
        "ANIME & GAMING": { cat: "ANIME", col: "text-purple-400" },
        "AUDIO & HI-FI": { cat: "AUDIO", col: "text-emerald-400" },
        "CINE & SERIES": { cat: "CINE", col: "text-purple-400" },
        "TECNOLOGÍA 4K": { cat: "TECNOLOGÍA", col: "text-sky-400" }
    };

    const catInfo = categoryMap[currentAiGeneratedData.categoria] || { cat: "DEPORTES", col: "text-blue-400" };

    const newItem = {
        id: "thematic-" + Date.now(),
        category: catInfo.cat,
        categoryColor: catInfo.col,
        title,
        excerpt,
        date: "Actualizado Hoy",
        image,
        imagePosition,
        content,
        createdAt: new Date().toISOString()
    };

    let list = [];
    try {
        const stored = localStorage.getItem("cuycito_portal_thematic");
        if (stored) list = JSON.parse(stored);
    } catch(e) {}

    list.unshift(newItem);
    if (list.length > 3) list = list.slice(0, 3);
    localStorage.setItem("cuycito_portal_thematic", JSON.stringify(list));

    // Sincronizar en la Nube Firestore
    try {
        const { db, doc, setDoc } = await import('./firebase-config.js');
        if (db) {
            await setDoc(doc(db, "portal_config", "thematic"), { list: list }, { merge: true });
        }
    } catch(e) {}

    if (typeof window.renderAdminThematicGrid === 'function') {
        window.renderAdminThematicGrid();
    }

    alert(`🎨 ¡Publicado en Grilla Temática de Portada!\n\n"${title}" se ha integrado en la columna de ${catInfo.cat}.`);

    if (typeof window.switchTab === 'function') {
        window.switchTab('news');
    }
};

// Publicar en Ranking 'Lo Más Leído'
window.publishAiAsTop5 = async () => {
    if (!currentAiGeneratedData) return;

    const title = document.getElementById('aiEditTitle').value.trim();
    const content = document.getElementById('aiEditContent').value.trim();

    let list = [];
    try {
        const stored = localStorage.getItem("cuycito_portal_top5");
        if (stored) list = JSON.parse(stored);
    } catch(e) {}

    const newItem = {
        id: "top5-" + Date.now(),
        rank: 1,
        title,
        tag: currentAiGeneratedData.tag || "Tendencia Nacional",
        content,
        createdAt: new Date().toISOString()
    };

    list.unshift(newItem);
    if (list.length > 5) list = list.slice(0, 5);
    list.forEach((it, idx) => it.rank = idx + 1);

    localStorage.setItem("cuycito_portal_top5", JSON.stringify(list));

    // Sincronizar en la Nube Firestore
    try {
        const { db, doc, setDoc } = await import('./firebase-config.js');
        if (db) {
            await setDoc(doc(db, "portal_config", "top5"), { list: list }, { merge: true });
        }
    } catch(e) {}

    if (typeof window.renderAdminTop5 === 'function') {
        window.renderAdminTop5();
    }

    alert(`🔥 ¡Publicado como #1 en 'Lo Más Leído'!\n\n"${title}" ahora encabeza el ranking lateral.`);

    if (typeof window.switchTab === 'function') {
        window.switchTab('news');
    }
};

window.setAiPromptSuggestion = (text) => {
    const input = document.getElementById('aiAgentPrompt');
    if (input) {
        input.value = text;
        input.focus();
    }
};

// Inicializar sugerencias al cargar el documento
document.addEventListener('DOMContentLoaded', () => {
    renderAiSuggestions();
});
