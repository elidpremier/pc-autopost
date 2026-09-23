const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const rootDir = path.join(__dirname, '..');
const assetsDir = path.join(rootDir, 'assets');
const iconPath = path.join(assetsDir, 'icon.png');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Design dynamic SVG 512x512 icon for PC AutoPost
const svgIcon = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>

    <linearGradient id="screenGrad" x1="100" y1="100" x2="412" y2="300" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>

    <linearGradient id="badgeGrad" x1="260" y1="220" x2="440" y2="400" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>

    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- Background Card -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)"/>
  <rect x="8" y="8" width="496" height="496" rx="104" stroke="#ffffff" stroke-opacity="0.1" stroke-width="4" fill="none"/>

  <!-- Laptop Body -->
  <g filter="url(#shadow)">
    <!-- Screen Frame -->
    <rect x="106" y="96" width="300" height="200" rx="16" fill="#1e293b" stroke="#475569" stroke-width="4"/>
    <!-- Display -->
    <rect x="120" y="110" width="272" height="156" rx="8" fill="url(#screenGrad)"/>
    <!-- Screen Header lines / mockup UI -->
    <rect x="136" y="126" width="100" height="12" rx="4" fill="#ffffff" fill-opacity="0.9"/>
    <rect x="136" y="146" width="160" height="8" rx="4" fill="#ffffff" fill-opacity="0.6"/>
    <rect x="136" y="160" width="120" height="8" rx="4" fill="#ffffff" fill-opacity="0.6"/>
    
    <!-- Image placeholder mock inside screen -->
    <rect x="312" y="126" width="64" height="64" rx="8" fill="#ffffff" fill-opacity="0.25"/>
    <circle cx="332" cy="144" r="8" fill="#ffffff" fill-opacity="0.8"/>
    <path d="M316 182L332 162L348 178L360 168L372 182Z" fill="#ffffff" fill-opacity="0.7"/>

    <!-- Laptop Base / Keyboard deck -->
    <path d="M64 308C64 301.373 69.3726 296 76 296H436C442.627 296 448 301.373 448 308V324C448 332.837 440.837 340 432 340H80C71.1634 340 64 332.837 64 324V308Z" fill="#334155" stroke="#475569" stroke-width="3"/>
    <!-- Trackpad cutout -->
    <rect x="226" y="300" width="60" height="10" rx="3" fill="#1e293b"/>
  </g>

  <!-- AutoPost Social Badge / Sparkle Overlay -->
  <g filter="url(#shadow)">
    <!-- Badge Container -->
    <rect x="250" y="220" width="180" height="180" rx="36" fill="url(#badgeGrad)" stroke="#ffffff" stroke-width="4"/>
    
    <!-- Share / Post Icon (Paper Plane / Megaphone / Send) -->
    <path d="M290 350L400 310L360 260L290 350Z" fill="#ffffff" fill-opacity="0.2"/>
    <path d="M295 345L390 270M395 270L340 345M395 270L295 310" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    
    <!-- Sparkles -->
    <path d="M390 240L394 250L404 254L394 258L390 268L386 258L376 254L386 250Z" fill="#fbbf24"/>
    <path d="M270 360L273 368L281 371L273 374L270 382L267 374L259 371L267 368Z" fill="#fbbf24"/>
  </g>
</svg>
`;

async function generate() {
  try {
    await sharp(Buffer.from(svgIcon))
      .resize(512, 512)
      .png()
      .toFile(iconPath);
    console.log(`✅ Icon successfully generated at: ${iconPath}`);
  } catch (err) {
    console.error('❌ Failed to generate icon:', err);
    process.exit(1);
  }
}

generate();
