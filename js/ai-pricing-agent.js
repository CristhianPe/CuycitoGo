// ==========================================================================
// CUZCITOGO VIP - AGENTE IA DE PRECIOS, MARGEN DE GANANCIA & RENTABILIDAD
// ==========================================================================

// Precios Oficiales Predeterminados de Cuentas Completas en Perú (PEN) y perfiles asignables
const INITIAL_PLATFORM_PRICING = [
    {
        id: "netflix",
        name: "Netflix 4K Ultra HD",
        icon: "fa-brands fa-netflix",
        color: "text-red-500",
        badgeBg: "bg-red-950/60 border-red-800 text-red-300",
        officialPrice: 44.90, // Cuenta completa 4K en Perú (PEN)
        profiles: 4,          // 4 Pantallas privadas
        sellingPrice: 13.00,  // Tu precio actual por perfil (PEN)
        note: "Activación TV con PIN de 4 dígitos"
    },
    {
        id: "disney",
        name: "Disney+ Premium con ESPN",
        icon: "fa-solid fa-film",
        color: "text-blue-400",
        badgeBg: "bg-blue-950/60 border-blue-800 text-blue-300",
        officialPrice: 44.90, // Suscripción mensual Premium
        profiles: 4,          // 4 Reproducciones simultáneas
        sellingPrice: 12.00,
        note: "Incluye eventos en vivo ESPN"
    },
    {
        id: "max",
        name: "Max Platino HBO",
        icon: "fa-solid fa-crown",
        color: "text-purple-400",
        badgeBg: "bg-purple-950/60 border-purple-800 text-purple-300",
        officialPrice: 39.90, // Plan Platino 4K
        profiles: 4,
        sellingPrice: 11.00,
        note: "Calidad 4K UHD + Dolby Atmos"
    },
    {
        id: "prime",
        name: "Amazon Prime Video",
        icon: "fa-brands fa-amazon",
        color: "text-amber-400",
        badgeBg: "bg-amber-950/60 border-amber-800 text-amber-300",
        officialPrice: 19.90, // Plan mensual Perú
        profiles: 3,          // 3 Pantallas simultáneas
        sellingPrice: 9.00,
        note: "Películas y series taquilleras"
    },
    {
        id: "crunchyroll",
        name: "Crunchyroll Mega Fan",
        icon: "fa-solid fa-dragon",
        color: "text-orange-400",
        badgeBg: "bg-orange-950/60 border-orange-800 text-orange-300",
        officialPrice: 19.00, // Plan Mega Fan
        profiles: 4,          // 4 Dispositivos simulcast
        sellingPrice: 9.00,
        note: "Credenciales directas (Correo/Clave)"
    },
    {
        id: "spotify",
        name: "Spotify Hi-Fi Premium",
        icon: "fa-brands fa-spotify",
        color: "text-emerald-400",
        badgeBg: "bg-emerald-950/60 border-emerald-800 text-emerald-300",
        officialPrice: 32.90, // Plan Familiar 6 cuentas
        profiles: 6,          // 6 miembros en grupo familiar
        sellingPrice: 8.00,
        note: "Activación en tu misma cuenta personal"
    }
];

// Estado local editable de la tabla
let currentPlatformPricing = [];

// Obtener API Key de Gemini desde localStorage o la predeterminada
function getGeminiApiKeyForPricing() {
    const DEFAULT_KEY = "";
    return localStorage.getItem("cuycito_gemini_api_key") || DEFAULT_KEY;
}

// Cargar estado inicial (recuperar de localStorage si se guardaron personalizaciones)
function loadPlatformPricingData() {
    const saved = localStorage.getItem("cuycito_pricing_matrix");
    if (saved) {
        try {
            currentPlatformPricing = JSON.parse(saved);
        } catch (e) {
            currentPlatformPricing = JSON.parse(JSON.stringify(INITIAL_PLATFORM_PRICING));
        }
    } else {
        currentPlatformPricing = JSON.parse(JSON.stringify(INITIAL_PLATFORM_PRICING));
    }
}

// Guardar matriz local
function savePlatformPricingData() {
    localStorage.setItem("cuycito_pricing_matrix", JSON.stringify(currentPlatformPricing));
}

// ==========================================================================
// 1. RENDERIZADO E INTERACCIÓN DE LA TABLA COMPARATIVA
// ==========================================================================
window.renderPricingTable = () => {
    loadPlatformPricingData();
    const container = document.getElementById('pricingTableBody');
    if (!container) return;

    let html = '';
    let totalEstimatedProfit = 0;
    let totalRevenue = 0;
    let totalCost = 0;
    let lowMarginCount = 0;

    currentPlatformPricing.forEach((item, index) => {
        const officialPrice = parseFloat(item.officialPrice) || 0;
        const profiles = parseInt(item.profiles) || 1;
        const sellingPrice = parseFloat(item.sellingPrice) || 0;

        // Fórmulas Financieras
        const unitCost = officialPrice / profiles; // Costo por perfil
        const netProfit = sellingPrice - unitCost;  // Ganancia neta por perfil
        const marginPercent = sellingPrice > 0 ? (netProfit / sellingPrice) * 100 : 0;
        
        // Precio Mínimo de Seguridad (Garantiza 20% de ganancia neta sobre costo)
        // Ejemplo: Costo / (1 - 0.20) = Costo * 1.25
        const minSafePrice = unitCost * 1.25;

        // Totales proyectados asumiendo venta de todos los perfiles por cuenta
        const accountRevenue = sellingPrice * profiles;
        const accountProfit = netProfit * profiles;
        
        totalRevenue += accountRevenue;
        totalCost += officialPrice;
        totalEstimatedProfit += accountProfit;

        // Estado del margen (Semáforo)
        let statusBadge = '';
        let statusClass = '';
        if (netProfit < 0) {
            statusBadge = `🔴 EN PÉRDIDA (-S/ ${Math.abs(netProfit).toFixed(2)})`;
            statusClass = 'bg-red-950 border-red-600 text-red-300';
            lowMarginCount++;
        } else if (marginPercent < 18) {
            statusBadge = `⚠️ MARGEN BAJO (${marginPercent.toFixed(1)}%)`;
            statusClass = 'bg-amber-950 border-amber-600 text-amber-300';
            lowMarginCount++;
        } else if (marginPercent < 30) {
            statusBadge = `🟡 MARGEN REGULAR (${marginPercent.toFixed(1)}%)`;
            statusClass = 'bg-yellow-950 border-yellow-600 text-yellow-300';
        } else {
            statusBadge = `🟢 EXCELENTE (${marginPercent.toFixed(1)}%)`;
            statusClass = 'bg-emerald-950 border-emerald-600 text-emerald-300';
        }

        html += `
            <tr class="border-b border-gray-800/80 hover:bg-white/[0.02] transition">
                <!-- Plataforma y Detalles -->
                <td class="p-3 sm:p-4">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-black/80 border border-gray-800 flex items-center justify-center text-lg shrink-0">
                            <i class="${item.icon} ${item.color}"></i>
                        </div>
                        <div>
                            <div class="font-black text-white text-xs sm:text-sm flex items-center gap-2">
                                ${item.name}
                            </div>
                            <div class="text-[10px] text-gray-400">${item.note}</div>
                        </div>
                    </div>
                </td>

                <!-- Precio Oficial Cuenta Completa -->
                <td class="p-3 text-center">
                    <div class="inline-flex items-center gap-1 bg-black/60 border border-gray-800 rounded-xl px-2.5 py-1">
                        <span class="text-gray-400 text-xs font-bold font-mono">S/</span>
                        <input 
                            type="number" 
                            step="0.10" 
                            min="1" 
                            value="${officialPrice.toFixed(2)}" 
                            onchange="window.updatePricingValue(${index}, 'officialPrice', this.value)"
                            class="w-16 bg-transparent text-white font-mono font-bold text-xs text-center outline-none focus:text-cuycito-gold"
                            title="Precio Oficial Cuenta Completa en Perú"
                        >
                    </div>
                </td>

                <!-- Cantidad de Perfiles / Slots -->
                <td class="p-3 text-center">
                    <div class="inline-flex items-center gap-1 bg-black/60 border border-gray-800 rounded-xl px-2 py-1">
                        <input 
                            type="number" 
                            step="1" 
                            min="1" 
                            max="10" 
                            value="${profiles}" 
                            onchange="window.updatePricingValue(${index}, 'profiles', this.value)"
                            class="w-10 bg-transparent text-cyan-300 font-mono font-bold text-xs text-center outline-none focus:text-white"
                            title="Número de perfiles/cupos en esta cuenta"
                        >
                        <span class="text-[10px] text-gray-500 font-bold uppercase">perfiles</span>
                    </div>
                </td>

                <!-- Costo Base por Perfil (Calculado) -->
                <td class="p-3 text-center">
                    <div class="font-mono font-bold text-xs text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 rounded-xl py-1 px-2.5 inline-block">
                        S/ ${unitCost.toFixed(2)}
                    </div>
                </td>

                <!-- Tu Precio de Venta (Editable) -->
                <td class="p-3 text-center">
                    <div class="inline-flex items-center gap-1 bg-amber-950/30 border border-amber-500/50 rounded-xl px-2.5 py-1 glow-gold">
                        <span class="text-cuycito-gold text-xs font-black font-mono">S/</span>
                        <input 
                            type="number" 
                            step="0.50" 
                            min="1" 
                            value="${sellingPrice.toFixed(2)}" 
                            onchange="window.updatePricingValue(${index}, 'sellingPrice', this.value)"
                            class="w-16 bg-transparent text-yellow-300 font-mono font-black text-xs text-center outline-none focus:text-white"
                            title="Tu precio actual de venta por perfil"
                        >
                    </div>
                </td>

                <!-- Ganancia Neta por Perfil -->
                <td class="p-3 text-center">
                    <div class="font-mono font-black text-xs ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}">
                        ${netProfit >= 0 ? '+' : ''}S/ ${netProfit.toFixed(2)}
                    </div>
                    <div class="text-[9px] text-gray-400 font-mono">
                        ${marginPercent.toFixed(1)}% margen
                    </div>
                </td>

                <!-- Precio Mínimo Recomendado (Piso de Seguridad) -->
                <td class="p-3 text-center">
                    <div class="font-mono font-bold text-xs text-yellow-400 bg-yellow-950/30 border border-yellow-500/30 rounded-xl py-1 px-2 inline-block">
                        S/ ${minSafePrice.toFixed(2)}
                    </div>
                    <div class="text-[9px] text-gray-400">Piso mínimo 20%</div>
                </td>

                <!-- Diagnóstico / Estado de Margen -->
                <td class="p-3 text-center">
                    <span class="text-[10px] font-bold px-2.5 py-1 rounded-full border shadow inline-block ${statusClass}">
                        ${statusBadge}
                    </span>
                </td>
            </tr>
        `;
    });

    container.innerHTML = html;

    // Actualizar KPIs superiores
    const totalProfitElem = document.getElementById('kpiTotalEstimatedProfit');
    const totalRevenueElem = document.getElementById('kpiTotalRevenue');
    const avgMarginElem = document.getElementById('kpiAvgMargin');
    const alertsElem = document.getElementById('kpiLowMarginAlerts');

    if (totalProfitElem) totalProfitElem.innerText = `S/ ${totalEstimatedProfit.toFixed(2)}`;
    if (totalRevenueElem) totalRevenueElem.innerText = `S/ ${totalRevenue.toFixed(2)}`;
    
    const overallMargin = totalRevenue > 0 ? (totalEstimatedProfit / totalRevenue) * 100 : 0;
    if (avgMarginElem) avgMarginElem.innerText = `${overallMargin.toFixed(1)}%`;
    if (alertsElem) alertsElem.innerText = lowMarginCount > 0 ? `${lowMarginCount} Plataformas` : "0 Alertas";
};

// Actualizar un valor en tiempo real y recalcular la tabla
window.updatePricingValue = (index, field, newValue) => {
    const val = parseFloat(newValue);
    if (isNaN(val) || val < 0) return;

    currentPlatformPricing[index][field] = val;
    savePlatformPricingData();
    window.renderPricingTable();
};

// Restablecer valores predeterminados de fábrica
window.resetPricingToDefault = () => {
    if (confirm("¿Deseas restablecer todos los precios de cuentas completas y precios de venta a los valores predeterminados de fábrica para Perú?")) {
        currentPlatformPricing = JSON.parse(JSON.stringify(INITIAL_PLATFORM_PRICING));
        savePlatformPricingData();
        window.renderPricingTable();
        alert("✅ Precios restablecidos correctamente.");
    }
};

// ==========================================================================
// 2. CONSULTA Y RECOMENDACIÓN CON GEMINI IA
// ==========================================================================
window.analyzePricingWithGemini = async () => {
    const apiKey = getGeminiApiKeyForPricing();
    const statusBox = document.getElementById('pricingAiStatus');
    const resultBox = document.getElementById('pricingAiResult');
    const btn = document.getElementById('btnAnalyzePricingAi');

    if (!statusBox || !resultBox || !btn) return;

    statusBox.classList.remove('hidden');
    resultBox.classList.add('hidden');
    btn.disabled = true;

    statusBox.innerHTML = `
        <div class="flex items-center gap-3 text-cyan-300 font-bold text-xs">
            <i class="fa-solid fa-spinner fa-spin text-cyan-400 text-base"></i>
            <span>El Agente de Rentabilidad está analizando los precios frente al mercado peruano...</span>
        </div>
    `;

    // Preparar resumen para el Prompt
    const dataSummary = currentPlatformPricing.map(p => {
        const official = parseFloat(p.officialPrice);
        const profiles = parseInt(p.profiles);
        const selling = parseFloat(p.sellingPrice);
        const costPerSlot = (official / profiles).toFixed(2);
        const profitPerSlot = (selling - (official / profiles)).toFixed(2);
        const margin = ((profitPerSlot / selling) * 100).toFixed(1);
        const minFloor = ((official / profiles) * 1.25).toFixed(2);
        return `- ${p.name}: Cuenta Completa S/ ${official} (${profiles} perfiles). Costo unitario por perfil: S/ ${costPerSlot}. Tu precio venta: S/ ${selling}. Ganancia por perfil: S/ ${profitPerSlot} (${margin}% margen). Piso de seguridad recomendado: S/ ${minFloor}.`;
    }).join('\n');

    const prompt = `Eres el Agente Estratega de Precios y Rentabilidad Financiera de "CuzcitoGo VIP", un servicio de venta de perfiles y pantallas privadas en Perú.

Analiza la siguiente tabla actual de precios, costos unitarios y márgenes de ganancia:

${dataSummary}

TAREA Y FORMATO DE RESPUESTA EN MARKDOWN:
1. 📊 **Diagnóstico del Portafolio de Precios**:
   - Evalúa cuáles servicios tienen el mejor y el peor margen de ganancia.
   - Identifica si algún servicio está en riesgo de pérdida o margen demasiado ajustado.

2. 💡 **Recomendaciones Específicas de Ajuste por Plataforma**:
   - Para cada plataforma donde veas oportunidad, sugiere si deberíamos subir el precio S/ 1.00 o S/ 2.00 más (considerando la demanda en Perú).
   - Define el **Piso Absoluto de Seguridad** (el precio más bajo al que NUNCA deberíamos vender en promociones o combos para asegurar ganancia neta sólida).

3. 🚀 **Estrategia para Combos y Ofertas VIP**:
   - Dame 2 ideas de combos atractivos usando servicios de alto margen para subsidiar o hacer más atractivos los de menor margen (ej: Combo Cine 4K o Combo Deportes).

Mantén un tono profesional, claro y directo orientado a maximizar ganancias en el mercado peruano.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (responseText) {
            statusBox.classList.add('hidden');
            resultBox.classList.remove('hidden');
            
            // Convertir negritas y títulos markdown sencillos a HTML
            let formattedText = responseText
                .replace(/^### (.*$)/gim, '<h4 class="text-sm font-black text-cuycito-gold mt-4 mb-2 uppercase tracking-wider border-b border-gray-800 pb-1">$1</h4>')
                .replace(/^## (.*$)/gim, '<h3 class="text-base font-black text-white mt-5 mb-2 uppercase tracking-wider flex items-center gap-2"><i class="fa-solid fa-chart-line text-cyan-400"></i> $1</h3>')
                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
                .replace(/^\- (.*$)/gim, '<li class="flex items-start gap-2 text-xs text-gray-300 leading-relaxed mb-1"><span class="text-cuycito-gold font-bold">•</span><span>$1</span></li>');

            resultBox.innerHTML = `
                <div class="bg-black/80 border border-cyan-500/40 rounded-2xl p-5 shadow-2xl space-y-4 glow-gold">
                    <div class="flex items-center justify-between border-b border-gray-800 pb-3">
                        <div class="flex items-center gap-2 text-cyan-300 font-black text-xs uppercase tracking-wider">
                            <i class="fa-solid fa-wand-magic-sparkles text-cyan-400 text-sm"></i>
                            Análisis Estratégico Generado por Gemini IA
                        </div>
                        <span class="bg-cyan-900/60 text-cyan-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-cyan-500/40">
                            Mercado Perú
                        </span>
                    </div>
                    <div class="space-y-2 text-xs text-gray-300 leading-relaxed font-sans">
                        ${formattedText}
                    </div>
                </div>
            `;
        } else {
            throw new Error("Respuesta inválida del servicio Gemini IA.");
        }
    } catch (err) {
        console.error("Error en análisis IA de precios:", err);
        statusBox.innerHTML = `
            <div class="text-red-400 font-bold text-xs flex items-center gap-2">
                <i class="fa-solid fa-circle-exclamation text-base"></i>
                <span>No se pudo conectar con Gemini IA: ${err.message}. Revisa tu API Key en la pestaña Agente de Marketing.</span>
            </div>
        `;
    } finally {
        btn.disabled = false;
    }
};

// Cargar la tabla cuando la pestaña se activa o la página carga
document.addEventListener('DOMContentLoaded', () => {
    // Si la función switchTab global existe, asegurar renderizado al cambiar a esta pestaña
    const originalSwitchTab = window.switchTab;
    if (typeof originalSwitchTab === 'function') {
        window.switchTab = (tabId) => {
            originalSwitchTab(tabId);
            if (tabId === 'ai-pricing') {
                window.renderPricingTable();
            }
        };
    }
    
    // Auto renderizar si estamos en la pestaña
    if (document.getElementById('view-ai-pricing-agent')) {
        window.renderPricingTable();
    }
});
