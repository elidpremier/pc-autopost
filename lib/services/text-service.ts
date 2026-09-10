// Génération des textes de publication (spec §6.1).
// Déterministe : le texte est construit UNIQUEMENT depuis les données validées
// de la fiche (snapshot de génération), jamais depuis des valeurs non confirmées.

import type { TemplateData } from '../types';

export type PlatformTexts = { facebook: string; instagram: string; whatsapp: string };

function nonEmpty(...parts: (string | undefined | null)[]): string {
  return parts.filter((p) => p && String(p).trim()).join(' ');
}

export function buildPlatformTexts(d: TemplateData): PlatformTexts {
  const brandTag = d.brand.replace(/[^A-Za-z0-9]/g, '').slice(0, 20) || 'PC';
  const cityLine = nonEmpty('📍', d.city);
  const phoneLine = nonEmpty('📞', d.phone);

  /* Facebook — annonce complète */
  const fbLines: string[] = [`💻 ${d.title} — ${d.conditionLabel}`, ''];
  fbLines.push(`🔧 ${d.processor}`);
  fbLines.push(`🧠 RAM : ${d.ramText}`);
  fbLines.push(`💾 ${d.storageText}`);
  if (d.screenText) fbLines.push(`🖥️ ${d.screenText}`);
  if (d.graphics) fbLines.push(`🎮 ${d.graphics}`);
  if (d.keyboard) fbLines.push(`⌨️ ${d.keyboard}`);
  if (d.ports.length) fbLines.push(`🔌 ${d.ports.join(', ')}`);
  if (d.accessories.length) fbLines.push(`📦 ${d.accessories.join(', ')}`);
  if (d.warranty) fbLines.push(`🛡️ ${d.warranty}`);
  fbLines.push('', `💰 ${d.priceText}`);
  if (cityLine) fbLines.push(cityLine);
  if (phoneLine) fbLines.push(phoneLine);
  fbLines.push('', `#PCoccasion #Ordinateur #Reconditionne #${brandTag}`);
  const facebook = fbLines.join('\n');

  /* Instagram — court, impact + hashtags */
  const igLines: string[] = [
    `💻 ${d.title} — ${d.conditionLabel}`,
    '',
    [d.processor, d.ramText, d.storageText].filter(Boolean).join(' • '),
  ];
  const extras = [d.screenText, d.warranty].filter(Boolean);
  if (extras.length) igLines.push(extras.join(' • '));
  igLines.push('', `💰 ${d.priceText}`);
  const foot = [cityLine, phoneLine].filter(Boolean).join('  ');
  if (foot) igLines.push(foot);
  igLines.push('', `#pcoccasion #pc #informatique #reconditionne #${brandTag.toLowerCase()}`);
  const instagram = igLines.join('\n');

  /* WhatsApp — direct et lisible */
  const waLines: string[] = ['Bonsoir 👋', '', `Je vous propose un ${d.title.toLowerCase()} (${d.conditionLabel.toLowerCase()}) :`, ''];
  waLines.push(`• Processeur : ${d.processor}`);
  waLines.push(`• RAM : ${d.ramText}`);
  waLines.push(`• Stockage : ${d.storageText}`);
  if (d.screenText) waLines.push(`• Écran : ${d.screenText}`);
  if (d.battery) waLines.push(`• Batterie : ${d.battery}`);
  if (d.warranty) waLines.push(`• Garantie : ${d.warranty}`);
  if (d.accessories.length) waLines.push(`• Accessoires : ${d.accessories.join(', ')}`);
  waLines.push('', `💰 Prix : ${d.priceText}`);
  if (cityLine) waLines.push(cityLine);
  waLines.push(`Pour toute information : ${d.phone || 'me contacter par message'}`);
  const whatsapp = waLines.join('\n');

  return { facebook, instagram, whatsapp };
}
