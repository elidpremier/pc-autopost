// Test complet du pipeline (spec §23 : prototype sur photos réelles).
// 1. Zone supérieure -> OCR -> 2. Parsing structuré -> 3. Recadrage nettoyé
// 4. Rendu des 4 formats -> 5. Textes de publication.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { extractTopZone, cropBottom } from '../lib/services/image-service';
import { ocrImage, terminateOcrWorker } from '../lib/services/ocr-service';
import { parseSpecText } from '../lib/services/spec-parser';
import { renderFormat, buildTemplateData } from '../lib/services/generation-service';
import { buildPlatformTexts } from '../lib/services/text-service';
import type { ComputerRow } from '../lib/db';

async function main(): Promise<void> {
  const root = path.join(process.cwd(), 'samples');
  const SAMPLE = path.join(root, 'fiche_example.jpg');
  const CROP_TOP = 470; // ligne de séparation connue du fichier d'exemple
  const OUT_DIR = path.join(root, 'out');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('== 1. OCR de la zone de la fiche ==');
  const zone = await extractTopZone(SAMPLE, CROP_TOP);
  const ocr = await ocrImage(zone);
  console.log(ocr.text);

  console.log('\n== 2. Parsing structuré ==');
  const parsed = parseSpecText(ocr.text, 'FCFA');
  for (const f of parsed.fields) {
    console.log(
      `${f.label.padEnd(20)} ${String(f.value ?? '—').slice(0, 60).padEnd(62)} conf=${f.confidence}${f.note ? ` (${f.note})` : ''}`
    );
  }

  console.log('\n== 3. Recadrage (photo nettoyée) ==');
  const meta = await sharp(SAMPLE).metadata();
  const cleaned = await cropBottom(SAMPLE, meta.width!, meta.height!, CROP_TOP);
  const cleanedAbs = path.join(path.join(process.cwd(), 'uploads', 'cleaned'), cleaned.filename);
  fs.copyFileSync(cleanedAbs, path.join(OUT_DIR, 'cleaned.jpg'));
  console.log(`OK ${cleaned.width} × ${cleaned.height} -> samples/out/cleaned.jpg`);

  console.log('\n== 4. Rendu des formats (template pro v1) ==');
  const fakeComputer = {
    id: 'sample', brand: 'Dell', model: 'Latitude 5420',
    processor: 'Intel Core i5-1145G7', ram_gb: 16,
    storage_capacity_gb: 512, storage_type: 'SSD',
    screen_size: 14, screen_resolution: 'Full HD', graphics: 'Intel Iris Xe',
    keyboard: 'AZERTY', ports: ['USB', 'RJ45', 'HDMI', 'USB-C'],
    accessories: ['Sac', 'Chargeur'], warranty: '3 mois',
    condition: 'bon', battery_condition: 'non_renseignee', battery_note: null,
    price_amount: 250000, currency: 'FCFA', status: 'available', notes: '',
  } as unknown as ComputerRow;

  const data = buildTemplateData(fakeComputer, {
    shop_name: 'TechDeal Burkina', tagline: 'PC occasion & reconditionnés',
    phone: '+226 70 00 11 22', city: 'Ouagadougou',
    color_primary: '#1d4ed8', color_accent: '#f59e0b', currency: 'FCFA',
  });

  for (const format of ['square', 'portrait', 'story', 'detail'] as const) {
    const t0 = Date.now();
    const r = await renderFormat(format, data, {
      main: cleanedAbs,
      secondary: path.join(root, 'laptop_raw.jpg'),
    }, null);
    fs.copyFileSync(path.join(process.cwd(), 'uploads', 'generated', r.filename), path.join(OUT_DIR, `${format}.jpg`));
    console.log(`${format.padEnd(8)} -> samples/out/${format}.jpg (${r.width} × ${r.height}, ${Date.now() - t0} ms)`);
  }

  console.log('\n== 5. Textes de publication ==');
  const texts = buildPlatformTexts(data);
  for (const [k, v] of Object.entries(texts)) {
    console.log(`\n----- ${k.toUpperCase()} -----\n${v}`);
  }
  console.log('\nPipeline OK ✓');
  await terminateOcrWorker();
  process.exit(0);

}

main().catch((e) => { console.error(e); process.exit(1); });
