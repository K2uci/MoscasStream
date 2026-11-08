// Ilustraciones de marca en SVG. Se usan en la app (react-native-svg → SvgXml)
// y en scripts/generate-assets.ts para generar el ícono y la splash en PNG.

export const BRAND = {
  bg: '#0B0D12',
  bgGlow: '#17323A',
  accent: '#22D3A6',
};

/** Degradados compartidos. Inclúyelos una sola vez por <svg>. */
export const defs = `
<defs>
  <radialGradient id="msHead" cx="38%" cy="32%" r="75%">
    <stop offset="0" stop-color="#5d7282"/><stop offset="1" stop-color="#1b242c"/>
  </radialGradient>
  <radialGradient id="msAbd" cx="38%" cy="28%" r="85%">
    <stop offset="0" stop-color="#46c9a6"/><stop offset=".5" stop-color="#26605a"/><stop offset="1" stop-color="#14262a"/>
  </radialGradient>
  <linearGradient id="msWing" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f2fbff" stop-opacity=".95"/><stop offset="1" stop-color="#8fd3ff" stop-opacity=".5"/>
  </linearGradient>
  <linearGradient id="msUsb" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#4af0c6"/><stop offset="1" stop-color="#14a582"/>
  </linearGradient>
  <linearGradient id="msMetal" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f4f7fa"/><stop offset="1" stop-color="#9ba7b3"/>
  </linearGradient>
  <radialGradient id="msGlow" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="${BRAND.accent}" stop-opacity=".45"/><stop offset="1" stop-color="${BRAND.accent}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="msBg" cx="50%" cy="42%" r="70%">
    <stop offset="0" stop-color="${BRAND.bgGlow}"/><stop offset="1" stop-color="${BRAND.bg}"/>
  </radialGradient>
</defs>`;

const INK = '#121920';

/** La mosca (caja 200×200). Con `usb` sostiene una memoria con las patas; sin ella, las patas cuelgan. */
export function fly({ usb = true, motion = true } = {}) {
  const wings = `
  <g transform="rotate(-18 90 76)">
    <ellipse cx="58" cy="60" rx="38" ry="17" fill="url(#msWing)" stroke="#c4eaff" stroke-width="2.5"/>
    <path d="M26 60 Q58 51 92 63 M36 69 Q62 63 90 67" stroke="#c4eaff" stroke-width="1.6" fill="none" opacity=".85"/>
  </g>
  <g transform="rotate(18 110 76)">
    <ellipse cx="142" cy="60" rx="38" ry="17" fill="url(#msWing)" stroke="#c4eaff" stroke-width="2.5"/>
    <path d="M174 60 Q142 51 108 63 M164 69 Q138 63 110 67" stroke="#c4eaff" stroke-width="1.6" fill="none" opacity=".85"/>
  </g>`;

  // Patas del medio: saludando hacia arriba (gesto de celebración).
  const midLegs = `
  <path d="M78 110 Q60 106 50 92" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M122 110 Q140 106 150 92" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>
  <circle cx="50" cy="91" r="4" fill="${INK}"/><circle cx="150" cy="91" r="4" fill="${INK}"/>`;

  const body = `
  <ellipse cx="100" cy="118" rx="27" ry="31" fill="url(#msAbd)" stroke="#5fd9b8" stroke-opacity=".35" stroke-width="2"/>
  <path d="M76 114 Q100 124 124 114 M79 130 Q100 140 121 130" stroke="#0a0f12" stroke-width="3" fill="none" opacity=".55"/>
  <ellipse cx="89" cy="106" rx="7" ry="12" fill="#fff" opacity=".16"/>
  <ellipse cx="100" cy="93" rx="19" ry="11" fill="#1a232b"/>`;

  const head = `
  <path d="M90 41 Q84 26 75 23 M110 41 Q116 26 125 23" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <circle cx="75" cy="23" r="4.5" fill="${INK}"/><circle cx="125" cy="23" r="4.5" fill="${INK}"/>
  <circle cx="100" cy="68" r="32" fill="url(#msHead)" stroke="#8aa2b3" stroke-opacity=".35" stroke-width="2"/>
  <ellipse cx="87" cy="47" rx="10" ry="5.5" fill="#fff" opacity=".2"/>
  <ellipse cx="73" cy="82" rx="6.5" ry="4" fill="#ff7aa0" opacity=".55"/>
  <ellipse cx="127" cy="82" rx="6.5" ry="4" fill="#ff7aa0" opacity=".55"/>
  <!-- boca riéndose a carcajadas -->
  <path d="M80 79 Q100 82 120 79 Q118 103 100 105 Q82 103 80 79 Z" fill="#3d0b16"/>
  <path d="M82 80 Q100 83 118 80 L117 86 Q100 89 83 86 Z" fill="#fff"/>
  <path d="M89 99 Q100 89 111 99 Q100 106 89 99 Z" fill="#ff5f7e"/>
  <!-- gafas negras -->
  <rect x="64" y="53" width="72" height="5" rx="2.5" fill="#050709"/>
  <rect x="66" y="55" width="31" height="20" rx="8" fill="#050709"/>
  <rect x="103" y="55" width="31" height="20" rx="8" fill="#050709"/>
  <rect x="95" y="59" width="10" height="4" fill="#050709"/>
  <path d="M71 59 L79 59 L71 70 Z" fill="#fff" opacity=".55"/>
  <path d="M108 59 L116 59 L108 70 Z" fill="#fff" opacity=".55"/>
  <!-- lágrima de la risa -->
  <path d="M138 70 Q143 78 140 82 Q135 84 134 79 Q134 75 138 70 Z" fill="#7fd3ff"/>`;

  const frontLegs = usb
    ? `
  <path d="M88 142 Q82 150 84 162" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M112 142 Q118 150 116 162" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>
  <ellipse cx="84" cy="163" rx="5" ry="3.5" fill="${INK}"/><ellipse cx="116" cy="163" rx="5" ry="3.5" fill="${INK}"/>`
    : `
  <path d="M88 142 Q84 152 88 160" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M112 142 Q116 152 112 160" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`;

  const usbStick = usb
    ? `
  <g transform="rotate(-6 100 172)">
    <rect x="58" y="160" width="70" height="28" rx="8" fill="url(#msUsb)"/>
    <rect x="58" y="160" width="70" height="8" rx="4" fill="#fff" opacity=".18"/>
    <path d="M86 167 L86 181 L98 174 Z" fill="${BRAND.bg}" opacity=".85"/>
    <circle cx="68" cy="174" r="3" fill="${BRAND.bg}" opacity=".6"/>
    <rect x="126" y="165" width="26" height="18" rx="2" fill="url(#msMetal)"/>
    <rect x="134" y="170" width="5" height="4" fill="#4a5562"/><rect x="143" y="170" width="5" height="4" fill="#4a5562"/>
  </g>`
    : '';

  const lines = motion
    ? `
  <path d="M14 74 H36 M6 96 H32 M16 118 H34" stroke="${BRAND.accent}" stroke-width="5" stroke-linecap="round" opacity=".7"/>`
    : '';

  return `<g transform="rotate(-8 100 100)">${lines}${wings}${midLegs}${body}${usbStick}${frontLegs}${head}</g>`;
}

/** Memoria USB grande (caja 240×120), protagonista de la pantalla de carga. */
export function bigUsb() {
  return `
  <ellipse cx="110" cy="60" rx="110" ry="60" fill="url(#msGlow)"/>
  <rect x="22" y="22" width="150" height="76" rx="18" fill="url(#msUsb)"/>
  <rect x="22" y="22" width="150" height="20" rx="10" fill="#fff" opacity=".2"/>
  <circle cx="44" cy="60" r="7" fill="${BRAND.bg}" opacity=".55"/>
  <path d="M86 40 L86 80 L120 60 Z" fill="${BRAND.bg}" opacity=".9"/>
  <circle cx="156" cy="84" r="4" fill="#eaffb0"/>
  <rect x="168" y="34" width="54" height="52" rx="4" fill="url(#msMetal)"/>
  <rect x="184" y="48" width="10" height="8" fill="#4a5562"/><rect x="202" y="48" width="10" height="8" fill="#4a5562"/>
  <rect x="168" y="34" width="54" height="8" fill="#fff" opacity=".35"/>`;
}

export const svg = (viewBox: string, body: string, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ${extra}>${defs}${body}</svg>`;

/** Mosca suelta para animaciones (sin USB ni líneas de movimiento). */
export const flyMiniXml = svg('0 0 200 200', fly({ usb: false, motion: false }));
export const bigUsbXml = svg('0 0 240 120', bigUsb());
export const flyLogoXml = svg('0 0 200 200', fly({ usb: true, motion: false }));
