/**
 * agente-publicidad-service.js
 * Catálogo Oficial y Precios Actualizados de CuycitoGo (cuycito.online).
 * Basado en el tarifario gráfico oficial.
 */

export const STREAMING_CATALOG = {
  netflix: {
    name: 'Netflix 4K',
    badge: '🍿 NETFLIX 4K ULTRA HD',
    planType: 'Perfil con PIN Privado',
    quality: 'Ultra HD • Con PIN',
    price: 15.00,
    specs: [
      '📺 Resolución 4K Ultra HD Premium',
      '🔒 Perfil exclusivo protegido con PIN privado',
      '🏠 Activación directo a tu TV o dispositivo móvil',
      '🛡️ Garantía total durante todo tu periodo contratado'
    ],
    features: 'Series exclusivas, películas taquilleras y estrenos mundiales sin límites.'
  },
  disney: {
    name: 'Disney+ Premium',
    badge: '🏆 DISNEY+ PREMIUM + ESPN',
    planType: 'Perfil Exclusivo',
    quality: '4K Ultra HD + IMAX',
    price: 10.00,
    specs: [
      '⚽ Incluye los 7 canales ESPN en vivo (Champions, Premier, F1, Tenis, UFC)',
      '📺 Calidad 4K Ultra HD',
      '👤 1 usuario / 1 pantalla',
      '🏠 Activación directa a tu televisor o celular'
    ],
    features: 'Disney, Pixar, Marvel, Star Wars, National Geographic y deportes ESPN en vivo.'
  },
  max: {
    name: 'HBO Max',
    badge: '✨ HBO MAX 4K PLATINO',
    planType: 'Perfil Exclusivo',
    quality: '4K Platino • Deportes',
    price: 10.00,
    specs: [
      '📺 Plan Platino 4K Ultra HD + Dolby Atmos',
      '⚽ Incluye eventos deportivos y transmisiones en vivo',
      '👤 1 pantalla exclusiva para ti',
      '🍿 HBO, Warner Bros, Discovery, DC y Cartoon Network'
    ],
    features: 'Estrenos directos de cine, series galardonadas y catálogo completo de HBO.'
  },
  spotify: {
    name: 'Spotify Premium',
    badge: '🎧 SPOTIFY PREMIUM',
    planType: 'Cuenta / Activación',
    quality: 'Sin Anuncios • Descarga',
    price: 8.00,
    specs: [
      '🚫 Cero publicidad o interrupciones',
      '📥 Descargas ilimitadas para escuchar sin internet',
      '🎵 Calidad de audio máxima a 320 kbps',
      '📱 Compatible con celular, laptop, TV y parlantes'
    ],
    features: 'Más de 100 millones de canciones y podcasts sin límites.'
  },
  prime: {
    name: 'Prime Video',
    badge: '🎬 AMAZON PRIME VIDEO 4K',
    planType: 'Perfil Exclusivo',
    quality: 'Ultra HD • Perfil',
    price: 6.00,
    specs: [
      '📺 Calidad 4K Ultra HD + HDR',
      '👤 1 pantalla exclusiva con perfil propio',
      '🏠 Activación directa a tu Smart TV o app móvil',
      '⚡ Soporte y entrega inmediata'
    ],
    features: 'Amazon Originals, películas y series taquilleras.'
  },
  crunchyroll: {
    name: 'Crunchyroll',
    badge: '⚡ CRUNCHYROLL MEGA FAN',
    planType: 'Perfil Exclusivo',
    quality: 'Mega Fan • Anime HD',
    price: 5.00,
    specs: [
      '🌟 Plan Mega Fan Premium',
      '🇯🇵 Simulcast 1 hora después del estreno en Japón',
      '📥 Modo offline para ver anime sin internet',
      '🚫 Sin ningún anuncio'
    ],
    features: 'El catálogo de anime más completo del mundo en alta definición.'
  },
  canva: {
    name: 'Canva PRO',
    badge: '🎨 CANVA PRO TODO FULL',
    planType: 'A tu correo • 1 Mes',
    quality: 'Todo Full Desbloqueado',
    price: 3.00,
    specs: [
      '📧 Activación directa a tu propio correo',
      '🔓 Millones de plantillas, fotos y elementos PRO desbloqueados',
      '🪄 Herramientas de IA y borrador de fondos mágico',
      '⏱️ Duración: 1 Mes completo garantizado'
    ],
    features: 'Diseña como un profesional sin marcas de agua.'
  },
  google: {
    name: 'Google PRO',
    badge: '🌐 GOOGLE PRO 2TB + GEMINI IA',
    planType: 'Cuenta / 18 Meses',
    quality: 'IA Gemini + 2TB Nube',
    price: 30.00,
    specs: [
      '☁️ 2 Terabytes (2000 GB) de almacenamiento en Google Drive y Fotos',
      '🤖 Acceso a IA Gemini Advanced de última generación',
      '📅 Plan extendido de 18 Meses de duración',
      '🔒 Espacio 100% privado y seguro'
    ],
    features: 'Potencia total de Google e Inteligencia Artificial para trabajo y estudio.'
  },
  surfshark: {
    name: 'Surfshark VPN',
    badge: '🛡️ SURFSHARK VPN PREMIUM',
    planType: 'Cuenta / 6 Meses',
    quality: 'Seguridad & Privacidad',
    price: 20.00,
    specs: [
      '🌍 Servidores ultra rápidos en más de 100 países',
      '🔒 Cifrado de nivel bancario y navegación anónima',
      '🛡️ Bloqueo de anuncios, malware y rastreadores',
      '⏱️ Duración: 6 Meses continuos'
    ],
    features: 'Navega seguro, desbloquea catálogos de streaming de todo el mundo.'
  },
  paramount: {
    name: 'Paramount+',
    badge: '⛰️ PARAMOUNT+ PREMIUM',
    planType: 'Perfil Exclusivo',
    quality: 'Películas & Deportes',
    price: 7.00,
    specs: [
      '📺 Calidad Full HD / 4K',
      '⚽ Deportes en vivo y Premier League',
      '👤 1 pantalla exclusiva con perfil propio',
      '🏠 Activación directa a tu TV'
    ],
    features: 'Películas exclusivas de Paramount, series y transmisiones deportivas.'
  },
  disney_completo: {
    name: 'Disney+ Completo (7 Perfiles)',
    badge: '🏰 DISNEY+ CUENTA COMPLETA FAMILIAR',
    planType: 'Cuenta Completa (7 Perfiles)',
    quality: 'Familiar 7 Perfiles • 4K',
    price: 42.00,
    specs: [
      '👨‍👩‍👧‍👦 Cuenta completa de 7 perfiles independientes',
      '📺 4 pantallas simultáneas en 4K Ultra HD',
      '⚽ Incluye ESPN en vivo en todos los perfiles',
      '🔑 Correo y contraseña exclusivos para tu familia o negocio'
    ],
    features: 'La cuenta completa para ti solo, ideal para familias o grupos de amigos.'
  },
  combo_duo: {
    name: 'Combo Dúo (Netflix 4K + Disney+)',
    badge: '🎁 COMBO DÚO SÚPER PROMO',
    planType: 'Súper Promo Dúo',
    quality: 'Netflix 4K + Disney+ ESPN',
    price: 19.00,
    specs: [
      '🍿 1 Perfil Netflix 4K Ultra HD con PIN',
      '🏆 1 Perfil Disney+ Premium con 7 canales ESPN',
      '🔥 ¡Ahorras dinero llevando ambos servicios!',
      '🏠 Activación directa a tus pantallas'
    ],
    features: 'El paquete de entretenimiento más vendido de CuycitoGo.'
  }
};

/**
 * Normaliza el texto para eliminar tildes, signos y letras repetidas excesivas.
 */
function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(.)\1{2,}/g, '$1$1'); // reduce letras triplicadas (ej: netfliiiix -> netfliix)
}

/**
 * Identifica con estricta precisión y tolerancia a faltas ortográficas el servicio consultado.
 */
export function identifyServiceFromText(text) {
  if (!text) return null;
  const t = normalizeText(text);

  // 1. Combo Dúo
  if (t.includes('combo') || (t.includes('duo') && (t.includes('netflix') || t.includes('disney'))) || t.includes('ambas cuentas') || t.includes('dos pantallas')) {
    return 'combo_duo';
  }

  // 2. Disney Completo / Familiar
  if (t.includes('disney completo') || t.includes('disney familiar') || t.includes('7 perfiles') || t.includes('cuenta completa disney') || t.includes('disney entera')) {
    return 'disney_completo';
  }

  // 3. Netflix (y todas sus variantes/errores ortográficos)
  const netflixMatches = ['netflix', 'netflis', 'netflx', 'netfli', 'netflic', 'netflics', 'netflik', 'nexflix', 'neflix', 'neflis', 'netfflix', 'netfix'];
  if (netflixMatches.some(k => t.includes(k))) {
    return 'netflix';
  }

  // 4. Disney+ / ESPN (y variantes)
  const disneyMatches = ['disney', 'disney+', 'disne', 'disnei', 'dizney', 'disnep', 'disny', 'espn', 'star+', 'starplus', 'star plus'];
  if (disneyMatches.some(k => t.includes(k))) {
    return 'disney';
  }

  // 5. HBO Max (y variantes)
  const maxMatches = ['hbo', 'hbomax', 'hbo max', 'max', 'hb0', 'hvomax', 'hbo platino'];
  if (maxMatches.some(k => t.includes(k))) {
    return 'max';
  }

  // 6. Prime Video (y variantes)
  const primeMatches = ['prime', 'primevideo', 'prime video', 'amazon', 'amazon prime', 'amazonprime'];
  if (primeMatches.some(k => t.includes(k))) {
    return 'prime';
  }

  // 7. Crunchyroll (y todas sus variantes/errores ortográficos)
  const crunchyMatches = ['crunchyroll', 'crunchy', 'crunchyrool', 'crunchirool', 'crunchi', 'cruncyroll', 'crunshirrol', 'crunchyrol', 'crushyroll', 'crunshi', 'crunch'];
  if (crunchyMatches.some(k => t.includes(k))) {
    return 'crunchyroll';
  }

  // 8. Spotify (y variantes)
  const spotifyMatches = ['spotify', 'spoty', 'spotifai', 'spotifay', 'spotifi', 'espotify', 'spotyfi'];
  if (spotifyMatches.some(k => t.includes(k))) {
    return 'spotify';
  }

  // 9. Canva PRO (y variantes)
  const canvaMatches = ['canva', 'canva pro', 'canvapro', 'kamba', 'kamba pro'];
  if (canvaMatches.some(k => t.includes(k))) {
    return 'canva';
  }

  // 10. Google PRO / Gemini
  const googleMatches = ['google pro', 'google 2tb', 'gemini pro', 'gemini', 'drive 2tb', '2tb google'];
  if (googleMatches.some(k => t.includes(k))) {
    return 'google';
  }

  // 11. Surfshark / VPN
  const vpnMatches = ['surfshark', 'vpn', 'surf shark', 'proxy'];
  if (vpnMatches.some(k => t.includes(k))) {
    return 'surfshark';
  }

  // 12. Paramount+ (y variantes)
  const paramountMatches = ['paramount', 'paramount+', 'paramon', 'paramountplus', 'paramoun', 'paramont'];
  if (paramountMatches.some(k => t.includes(k))) {
    return 'paramount';
  }

  return null;
}

/**
 * Detecta si el mensaje es una consulta sobre cuentas o servicios de streaming generales.
 * Filtra estrictamente sin responder a comandos con "/" (como /cuenta).
 */
export function isGeneralStreamingInquiry(text) {
  if (!text) return false;
  const trimmed = text.trim();

  // Si empieza con "/" es un comando de sistema, no se procesa como consulta de catálogo
  if (trimmed.startsWith('/')) return false;

  const t = normalizeText(trimmed);

  const strictKeywords = [
    'cuenta', 'cuentas', 'pantalla', 'pantallas', 'perfil', 'perfiles',
    'streaming', 'streeming', 'streming', 'stream',
    'plataforma', 'plataformas', 'catalogo', 'catalogos',
    'tarifa', 'tarifas', 'precio', 'precios', 'costo', 'costos',
    'vendes cuentas', 'tienes cuentas', 'venden cuentas', 'comprar cuenta',
    'renovar cuenta', 'sigues vendiendo', 'vendes pantallas'
  ];

  return strictKeywords.some(kw => t.includes(kw));
}

/**
 * Genera la respuesta comercial oficial para el cliente con la pregunta de pago (1. Sí / 2. No).
 */
export function formatCustomerOfferMessage(serviceKey, options = {}) {
  const service = STREAMING_CATALOG[serviceKey] || STREAMING_CATALOG.netflix;
  const price = (options.price !== undefined ? Number(options.price) : service.price).toFixed(2);
  const customerName = options.customerName ? `Hola *${options.customerName}* 👋` : '¡Hola! 👋';

  let msg = `${customerName}\n`;
  msg += `¡Bienvenido a *CuycitoGo*! Tu tienda de servicios digitales 100% seguros y garantizados. 🐹✨\n\n`;
  msg += `${service.badge}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💰 *Precio:* *S/ ${price}* (${service.planType})\n`;
  msg += `⚡ *Entrega:* Inmediata con garantía total\n\n`;
  msg += `📋 *Beneficios y Condiciones:*\n`;
  service.specs.forEach(spec => {
    msg += `• ${spec}\n`;
  });
  msg += `\n✨ _${service.features}_\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💳 *¿Deseas proceder con el pago?*\n\n`;
  msg += `*1* ➔ *Sí, quiero pagar ahora* 🚀\n`;
  msg += `*2* ➔ *No, en otro momento* 🙌\n\n`;
  msg += `_Por favor responde con el número *1* o *2*._`;

  return msg;
}