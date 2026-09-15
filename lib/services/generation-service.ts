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
  cyber_luxe_v2: { version: '2', name: 'Cyber Luxe v2 — Premium Tech', description: 'Design PSD Cyber Premium avec typographie d\'impact, néon et capsule flottante (Défaut)' },
  promo_banner: { version: '2', name: 'Bannière Promo — High Impact', description: 'Mise en page promotionnelle haute visibilité avec bloc prix géant et badges promo' },
};

const FONT = 'DejaVu Sans, Liberation Sans, Arial, sans-serif';

/* ------------------------------------------------------------------ */
/* Design Tokens & Helper Couleurs Dynamiques                         */
/* ------------------------------------------------------------------ */

function resolveColors(d: TemplateData) {
  const primary = d.colorPrimary && d.colorPrimary.trim().startsWith('#') ? d.colorPrimary.trim() : '#7C3AED';
  const accent = d.colorAccent && d.colorAccent.trim().startsWith('#') ? d.colorAccent.trim() : '#CCFF00';
  return { primary, accent };
}

/* ------------------------------------------------------------------ */
/* Construction des données normalisées                                */
/* ------------------------------------------------------------------ */

export function buildTemplateData(
  c: ComputerRow,
  s: {
    shop_name: string; tagline: string; phone: string; city: string;
    color_primary: string; color_accent: string; currency: string;
  },
  overrideColors?: { primaryColor?: string; accentColor?: string }
): TemplateData {
  const brand = (c.brand || '').trim() || 'Marque';
  const model = (c.model || '').trim();
  const size = c.screen_size && !Number.isNaN(c.screen_size) ? String(Math.round(c.screen_size * 10) / 10).replace('.', ',') : '';
  return {
    shopName: s.shop_name || 'Ma Boutique PC',
    tagline: s.tagline || 'PC occasion & reconditionnés certifiés',
    phone: s.phone || '',
    city: s.city || '',
    colorPrimary: (overrideColors?.primaryColor || s.color_primary || '#7C3AED').trim(),
    colorAccent: (overrideColors?.accentColor || s.color_accent || '#CCFF00').trim(),
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

function fitSize(str: string, maxW: number, baseSize: number, minSize = 14): number {
  const charWidthRatio = 0.65;
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
/* Générateurs SVG Cyber Luxe v2 (Style PSD d'Origine avec Couleurs Dynamiques) */
/* ------------------------------------------------------------------ */

function buildCyberLuxeSquareSvgPair(format: Format, d: TemplateData, hasLogo: boolean, photoRatio: number): SvgPair {
  const L = LAYOUTS[format];
  const { W, H } = L;
  const { primary, accent } = resolveColors(d);

  const base: string[] = [];
  base.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  base.push(`<defs>
    <linearGradient id="cyberBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B0813"/>
      <stop offset="45%" stop-color="#120A20"/>
      <stop offset="100%" stop-color="${primary}" stop-opacity="0.35"/>
    </linearGradient>
    <radialGradient id="neonGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${primary}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#0b0813" stop-opacity="0"/>
    </radialGradient>
  </defs>`);

  // 1. Fond Cyber Gradient + Polygones Décoratifs Dynamiques
  base.push(rect(0, 0, W, H, 'url(#cyberBg)'));
  base.push(`<polygon points="800,0 1080,0 1080,280" fill="${accent}" opacity="0.14"/>`);
  base.push(`<polygon points="0,850 0,1080 230,1080" fill="${primary}" opacity="0.22"/>`);

  // Filigrane d'ambiance
  base.push(`<text x="540" y="380" font-size="140" fill="#ffffff" opacity="0.03" font-weight="900" font-style="italic" text-anchor="middle" transform="rotate(-6 540 380)">CYBER TECH</text>`);

  // 2. En-tête (Logo / Boutique)
  if (hasLogo) {
    base.push(T(W / 2, 74, 22, d.shopName.toUpperCase(), { fill: '#ffffff', weight: 800, anchor: 'middle', spacing: 2 }));
    base.push(T(W / 2, 96, 14, (d.tagline || 'PC OCCASIONS & RECONDITIONNÉS CERTIFIÉS').toUpperCase(), { fill: accent, weight: 800, anchor: 'middle', spacing: 1.5 }));
    base.push(`<line x1="180" y1="112" x2="900" y2="112" stroke="${accent}" stroke-width="1.5" opacity="0.4"/>`);
  } else {
    base.push(T(W / 2, 44, 28, d.shopName.toUpperCase(), { fill: '#ffffff', weight: 900, anchor: 'middle', spacing: 3 }));
    base.push(T(W / 2, 72, 15, (d.tagline || 'PC OCCASIONS & RECONDITIONNÉS CERTIFIÉS').toUpperCase(), { fill: accent, weight: 800, anchor: 'middle', spacing: 2 }));
    base.push(`<line x1="180" y1="92" x2="900" y2="92" stroke="${accent}" stroke-width="1.5" opacity="0.4"/>`);
  }

  // 3. Section Hero Produit
  const topY = hasLogo ? 124 : 108;
  const heroH = format === 'portrait' ? 560 : (format === 'story' ? 680 : 465);
  const photoW = format === 'story' ? 992 : 490;
  const photoH = heroH;
  const photoX = 44;

  const photoZone: Zone = { x: photoX, y: topY, w: photoW, h: photoH };

  // Halo Lumineux derrière la photo
  base.push(`<ellipse cx="${photoZone.x + photoZone.w / 2}" cy="${photoZone.y + photoZone.h / 2}" rx="${photoZone.w / 1.1}" ry="${photoZone.h / 1.1}" fill="url(#neonGlow)"/>`);
  // Cadre de la photo
  base.push(rect(photoZone.x - 3, photoZone.y - 3, photoZone.w + 6, photoZone.h + 6, '#180e2b', 18, 'rgba(255, 255, 255, 0.18)', 1.5));

  // Colonne Droite (Square / Portrait)
  if (format !== 'story') {
    const R = { x: photoZone.x + photoZone.w + 32, w: W - 44 - (photoZone.x + photoZone.w + 32), top: topY };

    // Marque
    const brandSz = fitSize(d.brand.toUpperCase(), R.w, 22, 14);
    base.push(T(R.x, R.top + 28, brandSz, d.brand.toUpperCase(), { fill: '#A1A1AA', weight: 800, spacing: 3 }));
    
    // Modèle (anti-débordement dynamique)
    const modelText = d.model.toUpperCase().trim();
    const modelLines = wrapText(modelText, 16).slice(0, 2);
    const line1Sz = fitSize(modelLines[0] || modelText, R.w, 40, 18);
    
    let nextY = R.top + 74;
    base.push(T(R.x, nextY, line1Sz, modelLines[0] ?? '', { fill: '#ffffff', weight: 900, italic: true }));
    if (modelLines[1]) {
      const line2Sz = fitSize(modelLines[1], R.w, line1Sz, 18);
      nextY += line2Sz + 6;
      base.push(T(R.x, nextY, line2Sz, modelLines[1], { fill: '#ffffff', weight: 900, italic: true }));
    }

    // Pill de certification
    nextY += 34;
    base.push(rect(R.x, nextY, R.w, 38, 'rgba(255, 255, 255, 0.05)', 10, accent, 1));
    base.push(icon('check', R.x + 10, nextY + 8, 22, accent));
    base.push(T(R.x + 38, nextY + 25, 15, 'PC TESTÉ & CERTIFIÉ — PRÊT À L\'EMPLOI', { fill: accent, weight: 900 }));

    // Bloc Prix Géant
    nextY += 72;
    base.push(T(R.x, nextY, 14, 'PRIX PROMOTIONNEL', { fill: '#A1A1AA', weight: 800, spacing: 2 }));
    
    const priceSz = fitSize(d.priceText, R.w, 50, 32);
    base.push(T(R.x, nextY + priceSz * 0.9 + 4, priceSz, d.priceText, { fill: accent, weight: 900, italic: true }));

    // Pill Statut sous le prix
    nextY += priceSz + 30;
    base.push(rect(R.x, nextY, R.w, 46, '#180e2b', 12, 'rgba(255, 255, 255, 0.18)', 1));
    base.push(icon('shield', R.x + 12, nextY + 11, 24, accent));
    const statusStr = d.warranty ? `GARANTIE : ${d.warranty.toUpperCase()}` : `ÉTAT : ${d.conditionLabel.toUpperCase()}`;
    base.push(T(R.x + 44, nextY + 29, 15, truncate(statusStr, 28), { fill: '#ffffff', weight: 800 }));
  } else {
    // Format Story : Cartouche de Titre et Prix sous l'image
    const ovY = photoZone.y + photoZone.h - 125;
    base.push(rect(photoZone.x + 16, ovY, photoZone.w - 32, 110, '#120a20', 16, accent, 1.5, 0.92));
    const titleText = `${d.brand} ${d.model}`.toUpperCase().trim();
    const titleSz = fitSize(titleText, photoZone.w - 64, 32, 18);
    base.push(T(photoZone.x + 32, ovY + 42, titleSz, titleText, { fill: '#ffffff', weight: 900, italic: true }));
    
    const priceSz = fitSize(d.priceText, photoZone.w - 64, 40, 26);
    base.push(T(photoZone.x + 32, ovY + 88, priceSz, d.priceText, { fill: accent, weight: 900 }));
  }

  // 4. Conteneur Grille des Spécifications
  const specsBoxY = topY + heroH + 16;
  const specsBoxH = format === 'portrait' ? 470 : (format === 'story' ? 700 : 340);
  const specsBoxW = W - 88; // 992px
  const specsBoxX = 44;

  base.push(rect(specsBoxX, specsBoxY, specsBoxW, specsBoxH, '#120a20', 20, 'rgba(255, 255, 255, 0.14)', 1.5));

  // Titre Fiche Technique
  base.push(T(specsBoxX + 24, specsBoxY + 34, 16, 'FICHE TECHNIQUE & CONFIGURATION', { fill: accent, weight: 900, spacing: 2 }));
  base.push(`<line x1="${specsBoxX + 24}" y1="${specsBoxY + 44}" x2="${specsBoxX + 380}" y2="${specsBoxY + 44}" stroke="${accent}" stroke-width="2"/>`);

  const items: { icon: string; label: string; value: string }[] = [
    { icon: 'bolt', label: 'PROCESSEUR', value: d.processor },
    { icon: 'ram', label: 'MÉMOIRE RAM', value: d.ramText },
    { icon: 'hdd', label: 'STOCKAGE', value: d.storageText },
    { icon: 'screen', label: 'ÉCRAN & AFFICHAGE', value: d.screenText || 'Écran HD High Definition' },
    { icon: 'gpu', label: 'CARTE GRAPHIQUE', value: d.graphics || 'Graphiques Intégrés HD' },
    { icon: 'box', label: 'ACCESSOIRES INCLUS', value: d.accessories.length ? d.accessories.join(', ') : 'Sac de transport, Chargeur' },
  ];

  const gridY = specsBoxY + 58;
  const colW = (specsBoxW - 60) / 2; // ~466px
  const cardH = format === 'portrait' ? 115 : (format === 'story' ? 180 : 78);

  items.forEach((item, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);

    const cx = specsBoxX + 20 + col * (colW + 20);
    const cy = gridY + row * (cardH + 12);

    base.push(rect(cx, cy, colW, cardH, '#180e2b', 14, 'rgba(255, 255, 255, 0.08)', 1));
    base.push(icon(item.icon, cx + 16, cy + (cardH - 26) / 2, 26, accent));
    
    const valStr = (item.value || '').trim();
    const maxSingleLineChars = format === 'story' ? 28 : (format === 'portrait' ? 36 : 42);
    const maxTextW = colW - 52 - 16; // ~398px

    if (valStr.length <= maxSingleLineChars) {
      let labelY = cy + 22;
      let valY = cy + 51;
      let labelSz = 12;
      let baseValSz = 16.5;

      if (format === 'portrait') {
        labelY = cy + 28;
        valY = cy + 68;
        labelSz = 13;
        baseValSz = 18.5;
      } else if (format === 'story') {
        labelY = cy + 38;
        valY = cy + 102;
        labelSz = 15;
        baseValSz = 23;
      }

      const valSz = fitSize(valStr, maxTextW, baseValSz, 13.5);
      base.push(T(cx + 52, labelY, labelSz, item.label, { fill: '#A1A1AA', weight: 800, spacing: 1 }));
      base.push(T(cx + 52, valY, valSz, valStr, { fill: '#ffffff', weight: 800 }));
    } else {
      const valLines = wrapText(valStr, Math.floor(maxSingleLineChars * 0.9)).slice(0, 2);
      
      let labelY = cy + 19;
      let line1Y = cy + 41;
      let line2Y = cy + 60;
      let labelSz = 11;
      let lineSz = 14.5;

      if (format === 'portrait') {
        labelY = cy + 24;
        line1Y = cy + 58;
        line2Y = cy + 84;
        labelSz = 12.5;
        lineSz = 16.5;
      } else if (format === 'story') {
        labelY = cy + 35;
        line1Y = cy + 88;
        line2Y = cy + 125;
        labelSz = 14.5;
        lineSz = 20;
      }

      base.push(T(cx + 52, labelY, labelSz, item.label, { fill: '#A1A1AA', weight: 800, spacing: 1 }));
      base.push(T(cx + 52, line1Y, lineSz, valLines[0] || '', { fill: '#ffffff', weight: 800 }));
      if (valLines[1]) {
        base.push(T(cx + 52, line2Y, lineSz, valLines[1], { fill: '#ffffff', weight: 800 }));
      }
    }
  });

  // 5. Pied de Page : Capsule Flottante Flou Translucide
  const capW = 992;
  const capX = 44;
  const capY = H - 110;
  const capH = 72;

  base.push(rect(capX, capY, capW, capH, '#180e2b', 36, 'rgba(255, 255, 255, 0.18)', 1.5));

  // WhatsApp
  if (d.phone) {
    base.push(icon('phone', capX + 24, capY + 20, 32, '#ffffff'));
    const phoneSz = fitSize(d.phone, 320, 24, 16);
    base.push(T(capX + 68, capY + 44, phoneSz, d.phone, { fill: '#ffffff', weight: 800 }));
  }

  // Bouton COMMANDER ➔ Accent Néon
  const btnW = 260;
  const btnX = capX + (capW - btnW) / 2;
  base.push(rect(btnX, capY + 10, btnW, capH - 20, accent, 26));
  base.push(T(btnX + 38, capY + 34, 18, 'COMMANDER', { fill: '#0b0813', weight: 900, spacing: 1 }));
  base.push(icon('arrowRight', btnX + 195, capY + 17, 20, '#0b0813'));

  // Ville
  if (d.city) {
    base.push(T(capX + capW - 24, capY + 44, 20, d.city.toUpperCase(), { fill: '#A1A1AA', weight: 800, anchor: 'end', spacing: 1 }));
  }

  base.push('</svg>');

  // 6. Calque Supérieur (Badge Circulaire)
  const over: string[] = [];
  over.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  
  const badgeCx = photoZone.x + 70;
  const badgeCy = photoZone.y + photoZone.h - 44;
  const badgeR = 56;

  over.push(`<circle cx="${badgeCx}" cy="${badgeCy}" r="${badgeR}" fill="${primary}" stroke="${accent}" stroke-width="3"/>`);
  
  if (d.warranty) {
    over.push(T(badgeCx, badgeCy - 6, 13, 'GARANTIE', { fill: '#ffffff', weight: 900, anchor: 'middle' }));
    over.push(T(badgeCx, badgeCy + 16, 20, truncate(d.warranty.toUpperCase(), 10), { fill: accent, weight: 900, anchor: 'middle' }));
  } else {
    over.push(T(badgeCx, badgeCy - 6, 13, 'CERTIFIÉ', { fill: '#ffffff', weight: 900, anchor: 'middle' }));
    over.push(T(badgeCx, badgeCy + 16, 17, truncate(d.conditionLabel.toUpperCase(), 10), { fill: accent, weight: 900, anchor: 'middle' }));
  }
  
  over.push('</svg>');

  return { svgBase: base.join(''), svgOverlay: over.join(''), photoZone };
}

/* ------------------------------------------------------------------ */
/* Générateur SVG Bannière Promo — High Impact                         */
/* ------------------------------------------------------------------ */

function buildPromoBannerSvgPair(format: Format, d: TemplateData, hasLogo: boolean, photoRatio: number): SvgPair {
  const L = LAYOUTS[format];
  const { W, H } = L;
  const { primary, accent } = resolveColors(d);

  const base: string[] = [];
  base.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  base.push(`<defs>
    <linearGradient id="promoBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F0918"/>
      <stop offset="50%" stop-color="${primary}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#05030A"/>
    </linearGradient>
    <radialGradient id="promoGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#0b0813" stop-opacity="0"/>
    </radialGradient>
  </defs>`);

  // Fond Promo Gradient
  base.push(rect(0, 0, W, H, 'url(#promoBg)'));
  base.push(`<polygon points="750,0 1080,0 1080,320" fill="${primary}" opacity="0.25"/>`);
  base.push(`<polygon points="0,800 0,1080 300,1080" fill="${accent}" opacity="0.18"/>`);

  // Filigrane PROMO
  base.push(`<text x="540" y="380" font-size="160" fill="#ffffff" opacity="0.04" font-weight="900" font-style="italic" text-anchor="middle" transform="rotate(-8 540 380)">SPECIAL PROMO</text>`);

  // Header Banner Banneret
  base.push(rect(140, 24, 800, 44, primary, 14, accent, 1.5));
  base.push(T(W / 2, 53, 16, '🔥 VENTE PROMO EXCLUSIVE — STOCK LIMITÉ', { fill: '#ffffff', weight: 900, anchor: 'middle', spacing: 2 }));

  if (hasLogo) {
    base.push(T(W / 2, 94, 20, d.shopName.toUpperCase(), { fill: '#ffffff', weight: 800, anchor: 'middle', spacing: 2 }));
  }

  // Hero Produit
  const topY = 114;
  const heroH = format === 'portrait' ? 560 : (format === 'story' ? 680 : 465);
  const photoW = format === 'story' ? 992 : 490;
  const photoH = heroH;
  const photoX = 44;

  const photoZone: Zone = { x: photoX, y: topY, w: photoW, h: photoH };

  base.push(`<ellipse cx="${photoZone.x + photoZone.w / 2}" cy="${photoZone.y + photoZone.h / 2}" rx="${photoZone.w / 1.1}" ry="${photoZone.h / 1.1}" fill="url(#promoGlow)"/>`);
  base.push(rect(photoZone.x - 3, photoZone.y - 3, photoZone.w + 6, photoZone.h + 6, '#180e2b', 18, accent, 2));

  // Colonne Droite : Bloc Prix Géant Promo
  if (format !== 'story') {
    const R = { x: photoZone.x + photoZone.w + 32, w: W - 44 - (photoZone.x + photoZone.w + 32), top: topY };

    // Marque
    const brandSz = fitSize(d.brand.toUpperCase(), R.w, 22, 14);
    base.push(T(R.x, R.top + 28, brandSz, d.brand.toUpperCase(), { fill: '#A1A1AA', weight: 800, spacing: 3 }));
    
    // Modèle (anti-débordement dynamique)
    const modelText = d.model.toUpperCase().trim();
    const modelLines = wrapText(modelText, 16).slice(0, 2);
    const line1Sz = fitSize(modelLines[0] || modelText, R.w, 40, 18);
    
    let nextY = R.top + 74;
    base.push(T(R.x, nextY, line1Sz, modelLines[0] ?? '', { fill: '#ffffff', weight: 900, italic: true }));
    if (modelLines[1]) {
      const line2Sz = fitSize(modelLines[1], R.w, line1Sz, 18);
      nextY += line2Sz + 6;
      base.push(T(R.x, nextY, line2Sz, modelLines[1], { fill: '#ffffff', weight: 900, italic: true }));
    }

    // Pill Promo Tag
    nextY += 34;
    base.push(rect(R.x, nextY, R.w, 38, primary, 10));
    base.push(T(R.x + 16, nextY + 25, 14, '⚡ MEILLEUR RAPPORT QUALITÉ / PRIX', { fill: '#ffffff', weight: 900, spacing: 1 }));

    // Bloc Prix Géant Néon Plein (High Impact)
    nextY += 72;
    base.push(rect(R.x, nextY, R.w, 92, accent, 18));
    base.push(T(R.x + 16, nextY + 28, 12, 'PRIX OFFRE SPECIALE', { fill: '#0b0813', weight: 900, spacing: 2 }));
    
    const priceSz = fitSize(d.priceText, R.w - 32, 48, 30);
    base.push(T(R.x + 16, nextY + 74, priceSz, d.priceText, { fill: '#0b0813', weight: 900, italic: true }));

    // Pill Statut sous le prix
    nextY += 122;
    base.push(rect(R.x, nextY, R.w, 44, '#180e2b', 12, 'rgba(255, 255, 255, 0.18)', 1));
    base.push(icon('shield', R.x + 12, nextY + 10, 24, accent));
    const statusStr = d.warranty ? `GARANTIE : ${d.warranty.toUpperCase()}` : `ÉTAT : ${d.conditionLabel.toUpperCase()}`;
    base.push(T(R.x + 44, nextY + 28, 14, truncate(statusStr, 28), { fill: '#ffffff', weight: 800 }));
  } else {
    // Format Story : Cartouche de Titre et Prix sous l'image
    const ovY = photoZone.y + photoZone.h - 125;
    base.push(rect(photoZone.x + 16, ovY, photoZone.w - 32, 110, '#120a20', 16, accent, 1.5, 0.92));
    const titleText = `${d.brand} ${d.model}`.toUpperCase().trim();
    const titleSz = fitSize(titleText, photoZone.w - 64, 32, 18);
    base.push(T(photoZone.x + 32, ovY + 42, titleSz, titleText, { fill: '#ffffff', weight: 900, italic: true }));
    
    const priceSz = fitSize(d.priceText, photoZone.w - 64, 40, 26);
    base.push(T(photoZone.x + 32, ovY + 88, priceSz, d.priceText, { fill: accent, weight: 900 }));
  }

  // Conteneur Grille des Spécifications
  const specsBoxY = topY + heroH + 16;
  const specsBoxH = format === 'portrait' ? 470 : (format === 'story' ? 700 : 340);
  const specsBoxW = W - 88;
  const specsBoxX = 44;

  base.push(rect(specsBoxX, specsBoxY, specsBoxW, specsBoxH, '#120a20', 20, accent, 1.5));

  // Titre Fiche Technique
  base.push(T(specsBoxX + 24, specsBoxY + 34, 16, 'SPÉCIFICATIONS COMPLÈTES', { fill: accent, weight: 900, spacing: 2 }));
  base.push(`<line x1="${specsBoxX + 24}" y1="${specsBoxY + 44}" x2="${specsBoxX + 340}" y2="${specsBoxY + 44}" stroke="${accent}" stroke-width="2"/>`);

  const items: { icon: string; label: string; value: string }[] = [
    { icon: 'bolt', label: 'PROCESSEUR', value: d.processor },
    { icon: 'ram', label: 'MÉMOIRE RAM', value: d.ramText },
    { icon: 'hdd', label: 'STOCKAGE', value: d.storageText },
    { icon: 'screen', label: 'ÉCRAN & AFFICHAGE', value: d.screenText || 'Écran HD High Definition' },
    { icon: 'gpu', label: 'CARTE GRAPHIQUE', value: d.graphics || 'Graphiques Intégrés HD' },
    { icon: 'box', label: 'ACCESSOIRES INCLUS', value: d.accessories.length ? d.accessories.join(', ') : 'Sac de transport, Chargeur' },
  ];

  const gridY = specsBoxY + 58;
  const colW = (specsBoxW - 60) / 2;
  const cardH = format === 'portrait' ? 115 : (format === 'story' ? 180 : 78);

  items.forEach((item, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const cx = specsBoxX + 20 + col * (colW + 20);
    const cy = gridY + row * (cardH + 12);

    base.push(rect(cx, cy, colW, cardH, '#180e2b', 14, 'rgba(255, 255, 255, 0.08)', 1));
    base.push(icon(item.icon, cx + 16, cy + (cardH - 26) / 2, 26, accent));

    const valStr = (item.value || '').trim();
    const maxSingleLineChars = format === 'story' ? 28 : (format === 'portrait' ? 36 : 42);
    const maxTextW = colW - 52 - 16;

    if (valStr.length <= maxSingleLineChars) {
      let labelY = cy + 22;
      let valY = cy + 51;
      let labelSz = 12;
      let baseValSz = 16.5;

      if (format === 'portrait') {
        labelY = cy + 28;
        valY = cy + 68;
        labelSz = 13;
        baseValSz = 18.5;
      } else if (format === 'story') {
        labelY = cy + 38;
        valY = cy + 102;
        labelSz = 15;
        baseValSz = 23;
      }

      const valSz = fitSize(valStr, maxTextW, baseValSz, 13.5);
      base.push(T(cx + 52, labelY, labelSz, item.label, { fill: '#A1A1AA', weight: 800, spacing: 1 }));
      base.push(T(cx + 52, valY, valSz, valStr, { fill: '#ffffff', weight: 800 }));
    } else {
      const valLines = wrapText(valStr, Math.floor(maxSingleLineChars * 0.9)).slice(0, 2);
      let labelY = cy + 19;
      let line1Y = cy + 41;
      let line2Y = cy + 60;
      let labelSz = 11;
      let lineSz = 14.5;

      if (format === 'portrait') {
        labelY = cy + 24;
        line1Y = cy + 58;
        line2Y = cy + 84;
        labelSz = 12.5;
        lineSz = 16.5;
      } else if (format === 'story') {
        labelY = cy + 35;
        line1Y = cy + 88;
        line2Y = cy + 125;
        labelSz = 14.5;
        lineSz = 20;
      }

      base.push(T(cx + 52, labelY, labelSz, item.label, { fill: '#A1A1AA', weight: 800, spacing: 1 }));
      base.push(T(cx + 52, line1Y, lineSz, valLines[0] || '', { fill: '#ffffff', weight: 800 }));
      if (valLines[1]) {
        base.push(T(cx + 52, line2Y, lineSz, valLines[1], { fill: '#ffffff', weight: 800 }));
      }
    }
  });

  // Footer Capsule
  const capW = 992;
  const capX = 44;
  const capY = H - 110;
  const capH = 72;

  base.push(rect(capX, capY, capW, capH, '#180e2b', 36, accent, 1.5));

  if (d.phone) {
    base.push(icon('phone', capX + 24, capY + 20, 32, '#ffffff'));
    const phoneSz = fitSize(d.phone, 320, 24, 16);
    base.push(T(capX + 68, capY + 44, phoneSz, d.phone, { fill: '#ffffff', weight: 800 }));
  }

  // CTA COMMANDER MAINTENANT
  const btnW = 310;
  const btnX = capX + (capW - btnW) / 2;
  base.push(rect(btnX, capY + 10, btnW, capH - 20, accent, 26));
  base.push(T(btnX + 24, capY + 34, 17, 'COMMANDER VITE', { fill: '#0b0813', weight: 900, spacing: 1 }));
  base.push(icon('arrowRight', btnX + 250, capY + 17, 20, '#0b0813'));

  if (d.city) {
    base.push(T(capX + capW - 24, capY + 44, 20, d.city.toUpperCase(), { fill: '#A1A1AA', weight: 800, anchor: 'end', spacing: 1 }));
  }

  base.push('</svg>');

  // Calque Overlay Promo Badge
  const over: string[] = [];
  over.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  
  const badgeCx = photoZone.x + 70;
  const badgeCy = photoZone.y + photoZone.h - 44;
  const badgeR = 56;

  over.push(`<circle cx="${badgeCx}" cy="${badgeCy}" r="${badgeR}" fill="${accent}" stroke="#0b0813" stroke-width="3"/>`);
  over.push(T(badgeCx, badgeCy - 6, 14, 'OFFRE', { fill: '#0b0813', weight: 900, anchor: 'middle' }));
  over.push(T(badgeCx, badgeCy + 16, 18, 'PROMO', { fill: '#0b0813', weight: 900, anchor: 'middle' }));

  over.push('</svg>');

  return { svgBase: base.join(''), svgOverlay: over.join(''), photoZone };
}

// --- Fiche Technique Détaillée ---
function buildCyberLuxeDetailSvgPair(format: Format, d: TemplateData, hasLogo: boolean, photoRatio: number): SvgPair {
  const L = LAYOUTS[format];
  const { W, H } = L;
  const headerEnd = L.headerH(hasLogo);
  const { primary, accent } = resolveColors(d);

  const base: string[] = [];
  base.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  base.push(`<defs>
    <linearGradient id="cyberBg2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B0813"/>
      <stop offset="60%" stop-color="#120A20"/>
      <stop offset="100%" stop-color="${primary}" stop-opacity="0.4"/>
    </linearGradient>
  </defs>`);

  base.push(rect(0, 0, W, H, 'url(#cyberBg2)'));

  // Header Profil Technique
  base.push(T(W / 2, 44, 17, 'FICHE TECHNIQUE DÉTAILLÉE COMPLÈTE', { fill: accent, weight: 900, anchor: 'middle', spacing: 3 }));
  const fullTitle = `${d.brand} ${d.model}`.toUpperCase().trim();
  const titleSz = fitSize(fullTitle, 960, 34, 18);
  base.push(T(W / 2, 85, titleSz, fullTitle, { fill: '#ffffff', weight: 900, anchor: 'middle' }));
  base.push(`<line x1="140" y1="102" x2="940" y2="102" stroke="${accent}" stroke-width="1.5" opacity="0.4"/>`);

  // Grille 2 colonnes x 5 lignes (10 blocs de spécifications)
  const topY = 120;
  const colW = 472;
  const cardH = 72;
  const cardGap = 12;

  const techList: { label: string; val: string; iconName: string }[] = [
    { label: 'Processeur', val: d.processor, iconName: 'bolt' },
    { label: 'Mémoire RAM', val: d.ramText, iconName: 'ram' },
    { label: 'Stockage Principal', val: d.storageText, iconName: 'hdd' },
    { label: 'Écran & Affichage', val: d.screenText || 'Non renseigné', iconName: 'screen' },
    { label: 'Carte Graphique', val: d.graphics || 'Graphiques intégrés', iconName: 'gpu' },
    { label: 'Clavier & Ergonomie', val: d.keyboard || 'Standard', iconName: 'box' },
    { label: 'Ports & Connectique', val: d.ports.length ? d.ports.join(', ') : 'Non spécifiés', iconName: 'box' },
    { label: 'Accessoires Inclus', val: d.accessories.length ? d.accessories.join(', ') : 'Chargeur d\'origine', iconName: 'box' },
    { label: 'État du Matériel', val: `${d.conditionLabel.toUpperCase()} — Testé & Certifié`, iconName: 'shield' },
    { label: 'Garantie & Batterie', val: [d.warranty ? `Garantie : ${d.warranty}` : '', d.battery ? `Batterie : ${d.battery}` : ''].filter(Boolean).join(' • ') || 'Garantie boutique', iconName: 'shield' },
  ];

  techList.forEach((item, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const cx = col === 0 ? 44 : 564;
    const cy = topY + row * (cardH + cardGap);

    base.push(rect(cx, cy, colW, cardH, '#180e2b', 14, 'rgba(255, 255, 255, 0.16)', 1));
    base.push(icon(item.iconName, cx + 14, cy + 23, 24, accent));

    base.push(T(cx + 48, cy + 26, 12, item.label.toUpperCase(), { fill: '#A1A1AA', weight: 800, spacing: 1 }));
    const valSz = fitSize(item.val, colW - 60, 16.5, 12.5);
    base.push(T(cx + 48, cy + 54, valSz, item.val, { fill: '#ffffff', weight: 800 }));
  });

  // Footer Prix & Contact
  const footerY = H - 120;
  base.push(rect(44, footerY, W - 88, 82, '#180e2b', 24, accent, 1.5));
  base.push(T(74, footerY + 52, 34, d.priceText, { fill: accent, weight: 900, italic: true }));
  if (d.phone) {
    base.push(T(W - 74, footerY + 52, 22, `Contact : ${d.phone}`, { fill: '#ffffff', weight: 800, anchor: 'end' }));
  }

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

  if (templateId === 'promo_banner') {
    return buildPromoBannerSvgPair(format, d, hasLogo, photoRatio);
  }

  return buildCyberLuxeSquareSvgPair(format, d, hasLogo, photoRatio);
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
