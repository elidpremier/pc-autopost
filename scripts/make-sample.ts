// Génère la photo-fiche d'exemple : zone de caractéristiques en haut,
// bordure bleue, puis la photo réelle du PC (samples/laptop_raw.jpg).
import sharp from 'sharp';
import path from 'node:path';

async function main(): Promise<void> {
  const W = 1080;
  const ZONE_H = 470;
  const BORDER_H = 10;
  const BOTTOM_H = 1030;

  const lines: [string, number, number][] = [
    ['MARQUE : Dell', 36, 700],
    ['MODELE : Latitude 5420', 36, 700],
    ['PROCESSEUR : Intel Core i5-1145G7 (11e generation)', 32, 400],
    ['RAM : 16 Go DDR4', 32, 400],
    ['STOCKAGE : SSD 512 Go', 32, 400],
    ['ECRAN : 14 pouces Full HD', 32, 400],
    ['CLAVIER : AZERTY', 32, 400],
    ['GARANTIE : 3 mois', 32, 400],
    ['ACCESSOIRES : sac, chargeur', 32, 400],
  ];

  let textSvg = '';
  let y = 56;
  for (const [txt, size, weight] of lines) {
    textSvg += `<text x="48" y="${y}" font-size="${size}" font-weight="${weight}" fill="#111827" font-family="DejaVu Sans, sans-serif">${txt}</text>`;
    y += size + (size > 34 ? 18 : 14);
  }

  const zoneSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${ZONE_H}">
    <rect width="${W}" height="${ZONE_H}" fill="#ffffff"/>
    ${textSvg}
    <rect x="0" y="${ZONE_H - BORDER_H}" width="${W}" height="${BORDER_H}" fill="#2563eb"/>
  </svg>`;

  const root = path.join(process.cwd(), 'samples');
  const laptop = path.join(root, 'laptop_raw.jpg');
  const out = path.join(root, 'fiche_example.jpg');

  await sharp({ create: { width: W, height: ZONE_H + BOTTOM_H, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .composite([
      { input: Buffer.from(zoneSvg), left: 0, top: 0 },
      {
        input: await sharp(laptop).resize(W, BOTTOM_H, { fit: 'cover', position: 'centre' }).jpeg({ quality: 92 }).toBuffer(),
        left: 0,
        top: ZONE_H,
      },
    ])
    .jpeg({ quality: 92 })
    .toFile(out);

  console.log(`Photo-fiche d'exemple créée : ${out} (${W} × ${ZONE_H + BOTTOM_H}, ligne de séparation à y=${ZONE_H})`);

}

main().catch((e) => { console.error(e); process.exit(1); });
