// Moteur de rendu des visuels — Système Visuel Paramétrique Cyber Luxe v2 (PSD Inspired).
// Templates disponibles :
//   - cyber_luxe_v2 : Cyber Luxe v2 (Premium Tech / PSD Inspired - Défaut)
//   - clean_minimal : Studio E-Commerce Épuré
//   - dark_luxe : Tech Dark Luxe
//   - promo_banner : Bannière Promo High-Impact
//   - pro : Professionnel Classic v2

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { GENERATED_DIR, uid, type ComputerRow } from '../db';
import { BATTERY_LABELS, CONDITION_LABELS, type Format, type TemplateData } from '../types';
import { escapeXml, formatPrice, truncate, wrapText } from '../utils';

export const TEMPLATES: Record<string, { version: string; name: string; description: string }> = {
  cyber_luxe_v2: { version: '2', name: 'Cyber Luxe v2 — Premium Tech', description: 'Design PSD Cyber Premium avec typographie d\'impact, néon Lime et capsule flottante (Recommandé)' },
  clean_minimal: { version: '1', name: 'Clean E-Commerce', description: 'Studio clair, cartes épurées et pastilles colorées' },
  dark_luxe: { version: '1', name: 'Dark Tech Luxe', description: 'Fond sombre premium avec lueur néon' },
  promo_banner: { version: '1', name: 'Bannière Promo', description: 'Mise en page haute visibilité avec prix géant' },
  pro: { version: '2', name: 'Professionnel Classic', description: 'Layout classique et structuré' },
};

const FONT = 'DejaVu Sans, Liberation Sans, Arial, sans-serif';

/* ------------------------------------------------------------------ */
/* Jetons Graphiques (Design Tokens - CYBER_LUXE_V2)                  */
/* ------------------------------------------------------------------ */

const CYBER_LUXE = {
  colors: {
    bgDark: '#0B0813',
    bgGradientEnd: '#1E1035',
    textMain: '#F8FAFC',
    textMuted: '#A1A1AA',
    accentNeon: '#CCFF00', // Vert-Jaune Néon issu du PSD d'origine
    violet: '#7C3AED',
    capsuleBg: '#180E2B',
    borderLight: 'rgba(255, 255, 255, 0.18)',
  },
};

/* ------------------------------------------------------------------ */
/* Construction des données normalisées                                */
/* ------------------------------------------------------------------ */

export function buildTemplateData(c: ComputerRow, s: {
  shop_name: string; tagline: string; phone: string; city: string;
  color_primary: string; color_accent: string; currency: string;
}): TemplateData {
  const brand = (c.brand || '').trim() || 'Marque';
  const model = (c.model || '').trim();
  const size = c.screen_size && !Number.isNaN(c.screen_size) ? String(Math.round(c.screen_size * 10) / 10).replace('.', ',') : '';
  return {
    shopName: s.shop_name || 'Ma Boutique PC',
    tagline: s.tagline || 'PC occasion & reconditionnés certifiés',
    phone: s.phone || '',
    city: s.city || '',
    colorPrimary: s.color_primary || '#1d4ed8',
    colorAccent: s.color_accent || '#f59e0b',
    brand,
    model,
    title: `${brand} ${model}`.trim(),
    processor: (c.processor || '').trim() || 'Non renseigné',
    ramText: c.ram_gb ? `${c.ram_gb} Go` : 'Non renseigné',
    storageText: c.storage_capacity_gb
      ? `${c.storage_capacity_gb} Go${c.storage_type ? ' ' + c.storage_type : ''}`
      : 'Non renseigné',
    screenText: [size ? `${size} pouces` : '', c.screen_resolution || ''].filter(Boolean).join(' '),
    graphics: c.graphics || '',
    keyboard: c.keyboard || '',
    ports: c.ports || [],
    accessories: c.accessories || [],
    warranty: c.warranty || '',
    battery:
      c.battery_note ||
      (c.battery_condition && c.battery_condition !== 'non_renseignee' ? BATTERY_LABELS[c.battery_condition] : ''),
    conditionLabel: CONDITION_LABELS[c.condition] || 'Bon état',
    priceText: formatPrice(c.price_amount, c.currency || s.currency),
    notes: c.notes || '',
  };
}

/* ------------------------------------------------------------------ */
/* Helpers SVG                                                         */
/* ------------------------------------------------------------------ */

function T(
  x: number, y: number, size: number, str: string,
  o: { fill?: string; anchor?: 'start' | 'end' | 'middle'; weight?: number; spacing?: number; italic?: boolean; opacity?: number } = {}
): string {
  const sp = o.spacing ? ` letter-spacing="${o.spacing}"` : '';
  const it = o.italic ? ' font-style="italic"' : '';
  const op = o.opacity !== undefined ? ` opacity="${o.opacity}"` : '';
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${o.fill ?? '#0f172a'}" font-family="${FONT}" font-weight="${o.weight ?? 400}" text-anchor="${o.anchor ?? 'start'}"${sp}${it}${op}>${escapeXml(str)}</text>`;
}

function rect(x: number, y: number, w: number, h: number, fill: string, rx = 0, stroke?: string, strokeWidth = 0, opacity?: number): string {
  const strk = stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth}"` : '';
  const op = opacity !== undefined ? ` opacity="${opacity}"` : '';
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${strk}${op}/>`;
}

function icon(name: string, x: number, y: number, size: number, color: string): string {
  const k = size / 24;
  const body: Record<string, string> = {
    bolt: `<path d="M13 2 L4.5 13.5 H10 L9 22 L19.5 9.5 H13.5 Z" fill="${color}"/>`,
    ram: `<g fill="none" stroke="${color}" stroke-width="2"><rect x="3" y="7" width="18" height="9" rx="1"/><path d="M7 16 v3 M12 16 v3 M17 16 v3"/><path d="M7 10.5 v2 M12 10.5 v2 M17 10.5 v2"/></g>`,
    hdd: `<g fill="none" stroke="${color}" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="16.5" cy="12" r="1.8" fill="${color}" stroke="none"/><path d="M6.5 14.5 h5"/></g>`,
    screen: `<g fill="none" stroke="${color}" stroke-width="2"><rect x="3" y="4.5" width="18" height="12.5" rx="1.5"/><path d="M9 21 h6 M12 17 v4"/></g>`,
    gpu: `<g fill="none" stroke="${color}" stroke-width="2"><rect x="2.5" y="7" width="19" height="10" rx="1.5"/><circle cx="9" cy="12" r="3.4"/><path d="M15.5 10 h4 M15.5 12 h4 M15.5 14 h4"/></g>`,
    shield: `<path d="M12 2.5 L20 6 v5.8 c0 4.8-3.4 8.3-8 9.7 c-4.6-1.4-8-4.9-8-9.7 V6 Z" fill="none" stroke="${color}" stroke-width="2"/><path d="M8.5 12 l2.4 2.4 L15.8 9.8" fill="none" stroke="${color}" stroke-width="2"/>`,
    box: `<g fill="none" stroke="${color}" stroke-width="2"><rect x="4" y="9" width="16" height="10.5" rx="1"/><path d="M4 9 L12 4 L20 9 M12 9 v10.5"/></g>`,
    check: `<path d="M5 12 l5 5 L19 7" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`,
    phone: `<path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.11-.27c1.21.49 2.53.76 3.88.76a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.35.27 2.67.76 3.88a1 1 0 01-.27 1.11l-2.37 2.4z" fill="${color}"/>`,
    arrowRight: `<path d="M5 12 h14 M13 5 l7 7 l-7 7" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  };
  return `<g transform="translate(${x},${y}) scale(${k})">${body[name] ?? ''}</g>`;
}

function fitSize(str: string, maxW: number, baseSize: number, minSize = 16): number {
  const charWidthRatio = 0.58;
  const approxW = str.length * baseSize * charWidthRatio;
  if (approxW <= maxW) return baseSize;
  return Math.max(minSize, Math.floor(maxW / (str.length * charWidthRatio)));
}

/* ------------------------------------------------------------------ */
/* Géométrie dynamique par format                                     */
/* ------------------------------------------------------------------ */

type Zone = { x: number; y: number; w: number; h: number };

type Layout = {
  W: number;
  H: number;
  headerH: (hasLogo: boolean) => number;
  logoMaxH: number;
  photoW: number;
  minPhotoH: number;
  footerH: number;
  titleSize: number;
};

const LAYOUTS: Record<Format, Layout> = {
  square: { W: 1080, H: 1080, headerH: (l) => (l ? 150 : 110), logoMaxH: 52, photoW: 460, minPhotoH: 460, footerH: 140, titleSize: 38 },
  portrait: { W: 1080, H: 1350, headerH: (l) => (l ? 160 : 110), logoMaxH: 56, photoW: 480, minPhotoH: 500, footerH: 150, titleSize: 40 },
  story: { W: 1080, H: 1920, headerH: (l) => (l ? 200 : 130), logoMaxH: 70, photoW: 560, minPhotoH: 580, footerH: 180, titleSize: 44 },
  detail: { W: 1080, H: 1080, headerH: (l) => (l ? 150 : 110), logoMaxH: 52, photoW: 460, minPhotoH: 460, footerH: 140, titleSize: 38 },
};

type SvgPair = { svgBase: string; svgOverlay: string; photoZone: Zone };

/* ------------------------------------------------------------------ */
/* Générateurs SVG Cyber Luxe v2 (Style PSD d'Origine)                */
/* ------------------------------------------------------------------ */

function buildCyberLuxeSquareSvgPair(format: Format, d: TemplateData, hasLogo: boolean, photoRatio: number): SvgPair {
  const L = LAYOUTS[format];
  const { W, H } = L;

  const base: string[] = [];
  base.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  base.push(`<defs>
    <linearGradient id="cyberBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${CYBER_LUXE.colors.bgDark}"/>
      <stop offset="45%" stop-color="#120A20"/>
      <stop offset="100%" stop-color="${CYBER_LUXE.colors.bgGradientEnd}"/>
    </linearGradient>
    <radialGradient id="neonGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#0b0813" stop-opacity="0"/>
    </radialGradient>
  </defs>`);

  // 1. Fond Cyber Gradient + Polygones Décoratifs
  base.push(rect(0, 0, W, H, 'url(#cyberBg)'));
  base.push(`<polygon points="800,0 1080,0 1080,280" fill="${CYBER_LUXE.colors.accentNeon}" opacity="0.12"/>`);
  base.push(`<polygon points="0,850 0,1080 230,1080" fill="${CYBER_LUXE.colors.violet}" opacity="0.15"/>`);

  // Filigrane d'ambiance
  base.push(`<text x="540" y="380" font-size="140" fill="#ffffff" opacity="0.03" font-weight="900" font-style="italic" text-anchor="middle" transform="rotate(-6 540 380)">CYBER TECH</text>`);

  // 2. En-tête (Logo / Boutique) avec espacement vertical corrigé sans superposition
  if (hasLogo) {
    base.push(T(W / 2, 74, 22, d.shopName.toUpperCase(), { fill: '#ffffff', weight: 800, anchor: 'middle', spacing: 2 }));
    base.push(T(W / 2, 96, 14, (d.tagline || 'PC OCCASIONS & RECONDITIONNÉS CERTIFIÉS').toUpperCase(), { fill: CYBER_LUXE.colors.accentNeon, weight: 800, anchor: 'middle', spacing: 1.5 }));
    base.push(`<line x1="180" y1="112" x2="900" y2="112" stroke="${CYBER_LUXE.colors.accentNeon}" stroke-width="1.5" opacity="0.4"/>`);
  } else {
    base.push(T(W / 2, 44, 28, d.shopName.toUpperCase(), { fill: '#ffffff', weight: 900, anchor: 'middle', spacing: 3 }));
    base.push(T(W / 2, 72, 15, (d.tagline || 'PC OCCASIONS & RECONDITIONNÉS CERTIFIÉS').toUpperCase(), { fill: CYBER_LUXE.colors.accentNeon, weight: 800, anchor: 'middle', spacing: 2 }));
    base.push(`<line x1="180" y1="92" x2="900" y2="92" stroke="${CYBER_LUXE.colors.accentNeon}" stroke-width="1.5" opacity="0.4"/>`);
  }

  // 3. Section Hero Produit (Haut : Photo à gauche, Infos & Prix à droite)
  const topY = hasLogo ? 124 : 108;
  const heroH = format === 'portrait' ? 560 : (format === 'story' ? 680 : 465);
  const photoW = format === 'story' ? 992 : 490;
  const photoH = heroH;
  const photoX = 44;

  const photoZone: Zone = { x: photoX, y: topY, w: photoW, h: photoH };

  // Halo Lumineux derrière la photo
  base.push(`<ellipse cx="${photoZone.x + photoZone.w / 2}" cy="${photoZone.y + photoZone.h / 2}" rx="${photoZone.w / 1.1}" ry="${photoZone.h / 1.1}" fill="url(#neonGlow)"/>`);
  // Cadre de la photo
  base.push(rect(photoZone.x - 3, photoZone.y - 3, photoZone.w + 6, photoZone.h + 6, '#180e2b', 18, CYBER_LUXE.colors.borderLight, 1.5));

  // Colonne Droite (Square / Portrait) — Élimination des redondances
  if (format !== 'story') {
    const R = { x: photoZone.x + photoZone.w + 32, w: W - 44 - (photoZone.x + photoZone.w + 32), top: topY };

    // Marque
    base.push(T(R.x, R.top + 28, 22, d.brand.toUpperCase(), { fill: CYBER_LUXE.colors.textMuted, weight: 800, spacing: 3 }));
    
    // Modèle (Grand, typographie d'impact)
    const modelLines = wrapText(d.model.toUpperCase(), Math.floor(R.w / 24)).slice(0, 2);
    base.push(T(R.x, R.top + 74, 44, truncate(modelLines[0] ?? '', 22), { fill: '#ffffff', weight: 900, italic: true }));
    let nextY = R.top + 74;
    if (modelLines[1]) {
      nextY += 46;
      base.push(T(R.x, nextY, 44, truncate(modelLines[1], 22), { fill: '#ffffff', weight: 900, italic: true }));
    }

    // Pill de certification (sans répéter le processeur)
    nextY += 34;
    base.push(rect(R.x, nextY, R.w, 38, 'rgba(204, 255, 0, 0.12)', 10, 'rgba(204, 255, 0, 0.4)', 1));
    base.push(icon('check', R.x + 10, nextY + 8, 22, CYBER_LUXE.colors.accentNeon));
    base.push(T(R.x + 38, nextY + 25, 15, 'PC TESTÉ & CERTIFIÉ — PRÊT À L\'EMPLOI', { fill: CYBER_LUXE.colors.accentNeon, weight: 900 }));

    // Bloc Prix Géant Néon (#CCFF00)
    nextY += 72;
    base.push(T(R.x, nextY, 14, 'PRIX PROMOTIONNEL', { fill: CYBER_LUXE.colors.textMuted, weight: 800, spacing: 2 }));
    
    const priceSz = fitSize(d.priceText, R.w, 50, 32);
    base.push(T(R.x, nextY + priceSz * 0.9 + 4, priceSz, d.priceText, { fill: CYBER_LUXE.colors.accentNeon, weight: 900, italic: true }));

    // Pill Statut sous le prix (sans répéter la garantie 3 fois)
    nextY += priceSz + 30;
    base.push(rect(R.x, nextY, R.w, 46, '#180e2b', 12, CYBER_LUXE.colors.borderLight, 1));
    base.push(icon('shield', R.x + 12, nextY + 11, 24, CYBER_LUXE.colors.accentNeon));
    const statusStr = d.warranty ? `GARANTIE : ${d.warranty.toUpperCase()}` : `ÉTAT : ${d.conditionLabel.toUpperCase()}`;
    base.push(T(R.x + 44, nextY + 29, 15, truncate(statusStr, 28), { fill: '#ffffff', weight: 800 }));
  }

  // 4. Conteneur Grille des Spécifications (Détails complets processeur sans coupure)
  const specsBoxY = topY + heroH + 16;
  const specsBoxH = format === 'portrait' ? 470 : (format === 'story' ? 700 : 340);
  const specsBoxW = W - 88; // 992px
  const specsBoxX = 44;

  base.push(rect(specsBoxX, specsBoxY, specsBoxW, specsBoxH, '#120a20', 20, 'rgba(255, 255, 255, 0.14)', 1.5));

  // Titre du Conteneur Fiche Technique
  base.push(T(specsBoxX + 24, specsBoxY + 34, 16, 'FICHE TECHNIQUE & CONFIGURATION', { fill: CYBER_LUXE.colors.accentNeon, weight: 900, spacing: 2 }));
  base.push(`<line x1="${specsBoxX + 24}" y1="${specsBoxY + 44}" x2="${specsBoxX + 380}" y2="${specsBoxY + 44}" stroke="${CYBER_LUXE.colors.accentNeon}" stroke-width="2"/>`);

  // Données non-redondantes et exhaustives
  const items: { icon: string; label: string; value: string }[] = [
    { icon: 'bolt', label: 'PROCESSEUR', value: d.processor },
    { icon: 'ram', label: 'MÉMOIRE RAM', value: d.ramText },
    { icon: 'hdd', label: 'STOCKAGE', value: d.storageText },
    { icon: 'screen', label: 'ÉCRAN & AFFICHAGE', value: d.screenText || 'Écran HD High Definition' },
    { icon: 'gpu', label: 'CARTE GRAPHIQUE', value: d.graphics || 'Graphiques Intégrés HD' },
    { icon: 'box', label: 'ACCESSOIRES INCLUS', value: d.accessories.length ? d.accessories.join(', ') : 'Sac de transport, Chargeur' },
  ];

  // Organisation de la Grille (2 Colonnes x 3 Lignes)
  const gridY = specsBoxY + 58;
  const colW = (specsBoxW - 60) / 2; // ~466px
  const cardH = format === 'portrait' ? 115 : (format === 'story' ? 180 : 78);

  items.forEach((item, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);

    const cx = specsBoxX + 20 + col * (colW + 20);
    const cy = gridY + row * (cardH + 12);

    base.push(rect(cx, cy, colW, cardH, '#180e2b', 14, 'rgba(255, 255, 255, 0.08)', 1));
    base.push(icon(item.icon, cx + 16, cy + (cardH - 26) / 2, 26, CYBER_LUXE.colors.accentNeon));
    
    base.push(T(cx + 52, cy + 22, 12, item.label, { fill: CYBER_LUXE.colors.textMuted, weight: 800, spacing: 1 }));
    
    // Découpage multi-lignes sans tronquer le texte du processeur ou des specs
    const valLines = wrapText(item.value, 24).slice(0, 2);
    if (valLines.length > 1) {
      base.push(T(cx + 52, cy + 44, 16, valLines[0], { fill: '#ffffff', weight: 800 }));
      base.push(T(cx + 52, cy + 65, 15, valLines[1], { fill: CYBER_LUXE.colors.textMuted, weight: 700 }));
    } else {
      base.push(T(cx + 52, cy + 50, 17, valLines[0], { fill: '#ffffff', weight: 800 }));
    }
  });

  // 5. Pied de Page : Capsule Flottante Flou Translucide
  const capW = 992;
  const capX = 44;
  const capY = H - 110;
  const capH = 72;

  base.push(rect(capX, capY, capW, capH, CYBER_LUXE.colors.capsuleBg, 36, CYBER_LUXE.colors.borderLight, 1.5));

  // Gauche : WhatsApp
  if (d.phone) {
    base.push(icon('phone', capX + 24, capY + 20, 32, '#ffffff'));
    const phoneSz = fitSize(d.phone, 320, 24, 16);
    base.push(T(capX + 68, capY + 44, phoneSz, d.phone, { fill: '#ffffff', weight: 800 }));
  }

  // Centre : Bouton COMMANDER ➔ Néon
  const btnW = 260;
  const btnX = capX + (capW - btnW) / 2;
  base.push(rect(btnX, capY + 10, btnW, capH - 20, CYBER_LUXE.colors.accentNeon, 26));
  base.push(T(btnX + 38, capY + 34, 18, 'COMMANDER', { fill: '#0b0813', weight: 900, spacing: 1 }));
  base.push(icon('arrowRight', btnX + 195, capY + 17, 20, '#0b0813'));

  // Droite : Ville / Boutique
  if (d.city) {
    base.push(T(capX + capW - 24, capY + 44, 20, d.city.toUpperCase(), { fill: CYBER_LUXE.colors.textMuted, weight: 800, anchor: 'end', spacing: 1 }));
  }

  base.push('</svg>');

  // 6. Calque Supérieur (Badge Circulaire Violet/Néon sur la photo)
  const over: string[] = [];
  over.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  
  const badgeCx = photoZone.x + 70;
  const badgeCy = photoZone.y + photoZone.h - 44;
  const badgeR = 56;

  over.push(`<circle cx="${badgeCx}" cy="${badgeCy}" r="${badgeR}" fill="${CYBER_LUXE.colors.violet}" stroke="${CYBER_LUXE.colors.accentNeon}" stroke-width="3"/>`);
  
  if (d.warranty) {
    over.push(T(badgeCx, badgeCy - 6, 13, 'GARANTIE', { fill: '#ffffff', weight: 900, anchor: 'middle' }));
    over.push(T(badgeCx, badgeCy + 16, 20, truncate(d.warranty.toUpperCase(), 10), { fill: CYBER_LUXE.colors.accentNeon, weight: 900, anchor: 'middle' }));
  } else {
    over.push(T(badgeCx, badgeCy - 6, 13, 'CERTIFIÉ', { fill: '#ffffff', weight: 900, anchor: 'middle' }));
    over.push(T(badgeCx, badgeCy + 16, 17, truncate(d.conditionLabel.toUpperCase(), 10), { fill: CYBER_LUXE.colors.accentNeon, weight: 900, anchor: 'middle' }));
  }
  
  over.push('</svg>');

  return { svgBase: base.join(''), svgOverlay: over.join(''), photoZone };
}

// --- Fiche Technique Détaillée (Deuxième visuel du carrousel) ---
function buildCyberLuxeDetailSvgPair(format: Format, d: TemplateData, hasLogo: boolean, photoRatio: number): SvgPair {
  const L = LAYOUTS[format];
  const { W, H } = L;
  const headerEnd = L.headerH(hasLogo);

  const base: string[] = [];
  base.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  base.push(`<defs>
    <linearGradient id="cyberBg2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${CYBER_LUXE.colors.bgDark}"/>
      <stop offset="100%" stop-color="${CYBER_LUXE.colors.bgGradientEnd}"/>
    </linearGradient>
  </defs>`);

  base.push(rect(0, 0, W, H, 'url(#cyberBg2)'));

  // Header Profil Technique
  base.push(T(W / 2, 50, 18, 'PROFIL TECHNIQUE DÉTAILLÉ', { fill: CYBER_LUXE.colors.accentNeon, weight: 900, anchor: 'middle', spacing: 3 }));
  base.push(T(W / 2, 95, 38, `${d.brand} ${d.model}`.toUpperCase(), { fill: '#ffffff', weight: 900, anchor: 'middle' }));

  // Grille 2 colonnes des caractéristiques exhaustives
  const topY = headerEnd + 10;
  const gridW = W - 80; // 1000px
  const colW = 480;

  const techList: [string, string][] = [
    ['Processeur', d.processor],
    ['Mémoire RAM', d.ramText],
    ['Stockage Principal', d.storageText],
    ['Écran & Affichage', d.screenText || 'Non renseigné'],
    ['Carte Graphique', d.graphics || 'Intégré'],
    ['Disposition Clavier', d.keyboard || 'Standard'],
    ['Garantie Boutique', d.warranty || 'Non spécifiée'],
    ['Autonomie Batterie', d.battery || 'Bonne autonomie'],
  ];

  let sy = topY;
  techList.forEach(([label, val], idx) => {
    const isCol2 = idx % 2 === 1;
    const cx = isCol2 ? 40 + colW + 40 : 40;
    if (isCol2) {
      // Maintient sy sur la même ligne pour la col 2
    } else if (idx > 0) {
      sy += 85;
    }

    base.push(rect(cx, sy, colW, 76, '#180e2b', 16, CYBER_LUXE.colors.borderLight, 1));
    base.push(T(cx + 20, sy + 28, 14, label.toUpperCase(), { fill: CYBER_LUXE.colors.textMuted, weight: 800, spacing: 1 }));
    base.push(T(cx + 20, sy + 56, 20, truncate(val, 28), { fill: '#ffffff', weight: 800 }));
  });

  // Footer Prix & Contact
  const footerY = H - L.footerH;
  base.push(rect(40, footerY + 20, W - 80, 80, CYBER_LUXE.colors.capsuleBg, 24, CYBER_LUXE.colors.borderLight, 1));
  base.push(T(70, footerY + 66, 32, d.priceText, { fill: CYBER_LUXE.colors.accentNeon, weight: 900 }));
  base.push(T(W - 70, footerY + 66, 22, `WhatsApp : ${d.phone}`, { fill: '#ffffff', weight: 800, anchor: 'end' }));

  base.push('</svg>');

  const over: string[] = [];
  over.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  over.push('</svg>');

  const photoZone: Zone = { x: 0, y: 0, w: 0, h: 0 };
  return { svgBase: base.join(''), svgOverlay: over.join(''), photoZone };
}

/* ------------------------------------------------------------------ */
/* Choix du Générateur SVG Pair                                       */
/* ------------------------------------------------------------------ */

function buildSvgPairForTemplate(
  templateId: string,
  format: Format,
  d: TemplateData,
  hasLogo: boolean,
  photoRatio: number
): SvgPair {
  if (format === 'detail') {
    return buildCyberLuxeDetailSvgPair(format, d, hasLogo, photoRatio);
  }

  switch (templateId) {
    case 'cyber_luxe_v2':
    default:
      return buildCyberLuxeSquareSvgPair(format, d, hasLogo, photoRatio);
  }
}

/* ------------------------------------------------------------------ */
/* Rendu & Composition Calques                                         */
/* ------------------------------------------------------------------ */

export type PhotosForRender = { main?: string; secondary?: string };

async function photoFit(src: string, w: number, h: number, bg = { r: 11, g: 8, b: 19, alpha: 1 }): Promise<Buffer> {
  return sharp(src)
    .resize(w, h, { fit: 'contain', background: bg })
    .jpeg({ quality: 94 })
    .toBuffer();
}

async function photoRatioFor(photos: PhotosForRender, format: Format): Promise<number> {
  const src = format === 'detail' ? photos.secondary || photos.main : photos.main;
  if (src && fs.existsSync(src)) {
    try {
      const m = await sharp(src).metadata();
      if (m.width && m.height) return m.width / m.height;
    } catch {
      /* noop */
    }
  }
  return 1.05;
}

/**
 * Génère le tampon d'image en mémoire sans enregistrer sur disque (pour aperçu direct).
 */
export async function renderFormatToBuffer(
  format: Format,
  data: TemplateData,
  photos: PhotosForRender,
  logoPath: string | null,
  templateId = 'cyber_luxe_v2'
): Promise<Buffer> {
  const L = LAYOUTS[format];

  let hasLogo = false;
  let logoComposite: sharp.OverlayOptions | null = null;
  if (logoPath && fs.existsSync(logoPath)) {
    try {
      const meta = await sharp(logoPath).metadata();
      if (meta.width && meta.height) {
        const maxH = L.logoMaxH;
        const lw = Math.min(280, Math.round((meta.width / meta.height) * maxH));
        const logoBuf = await sharp(logoPath).ensureAlpha().resize(lw, maxH, { fit: 'contain' }).png().toBuffer();
        logoComposite = { input: logoBuf, left: Math.round((L.W - lw) / 2), top: 16 };
        hasLogo = true;
      }
    } catch {
      hasLogo = false;
    }
  }

  const { svgBase, svgOverlay, photoZone } = buildSvgPairForTemplate(templateId, format, data, hasLogo, await photoRatioFor(photos, format));
  const composites: sharp.OverlayOptions[] = [];

  const src = format === 'detail' ? photos.secondary || photos.main : photos.main;
  if (src && photoZone.w > 0 && fs.existsSync(src)) {
    const photoBg = { r: 11, g: 8, b: 19, alpha: 1 };
    const pBuf = await photoFit(src, photoZone.w, photoZone.h, photoBg);
    composites.push({ input: pBuf, left: photoZone.x, top: photoZone.y });
  }

  // Calques d'overlay (bordures, badges, logos)
  composites.push({ input: Buffer.from(svgOverlay), left: 0, top: 0 });
  if (logoComposite) composites.push(logoComposite);

  return sharp(Buffer.from(svgBase))
    .composite(composites)
    .jpeg({ quality: 94 })
    .toBuffer();
}

/**
 * Génère et enregistre le visuel final sur disque.
 */
export async function renderFormat(
  format: Format,
  data: TemplateData,
  photos: PhotosForRender,
  logoPath: string | null,
  templateId = 'cyber_luxe_v2'
): Promise<{ filename: string; width: number; height: number }> {
  const L = LAYOUTS[format];
  const buffer = await renderFormatToBuffer(format, data, photos, logoPath, templateId);
  const filename = `gen-${uid()}-${templateId}-${format}.jpg`;
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  await sharp(buffer).toFile(path.join(GENERATED_DIR, filename));
  return { filename, width: L.W, height: L.H };
}

export function checkGenerationReadiness(c: ComputerRow): string[] {
  const missing: string[] = [];
  if (!(c.brand || '').trim()) missing.push('Marque');
  if (!(c.model || '').trim()) missing.push('Modèle');
  if (!(c.processor || '').trim()) missing.push('Processeur');
  if (c.ram_gb === null || c.ram_gb === undefined || c.ram_gb < 1) missing.push('RAM');
  if (c.storage_capacity_gb === null || c.storage_capacity_gb === undefined) missing.push('Stockage');
  if (!(c.condition || '').trim()) missing.push('État général');
  if (c.price_amount === null || c.price_amount === undefined || c.price_amount <= 0) missing.push('Prix valide');
  if (!(c.currency || '').trim()) missing.push('Devise');
  return missing;
}
