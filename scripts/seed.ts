// Crée un produit d'exemple complet (fiche source, photo nettoyée, secondaire)
// pour pouvoir tester immédiatement le parcours complet.
import fs from 'node:fs';
import path from 'node:path';
import { createComputer, listComputers, addImage, listImages, ORIGINALS_DIR, SECONDARY_DIR } from '../lib/db';
import { saveImage, cropBottom } from '../lib/services/image-service';

async function main(): Promise<void> {
  const existing = listComputers().find((c) => c.brand === 'Dell' && c.model === 'Latitude 5420');
  if (existing) {
    console.log(`Produit d'exemple déjà présent : ${existing.id}`);
    process.exit(0);
  }

  const computer = createComputer({
    brand: 'Dell',
    model: 'Latitude 5420',
    processor: 'Intel Core i5-1145G7',
    ram_gb: 16,
    storage_capacity_gb: 512,
    storage_type: 'SSD',
    screen_size: 14,
    screen_resolution: 'Full HD',
    graphics: 'Intel Iris Xe',
    keyboard: 'AZERTY',
    ports: ['USB', 'RJ45', 'HDMI', 'USB-C'],
    accessories: ['Sac', 'Chargeur'],
    warranty: '3 mois',
    condition: 'bon',
    battery_condition: 'non_renseignee',
    price_amount: 250000,
    currency: 'FCFA',
    status: 'available',
    notes: 'Produit d’exemple créé par le seed — s’affiche aussi comme source du pipeline OCR.',
  });
  console.log(`Produit créé : ${computer.id} — ${computer.brand} ${computer.model}`);

  const samples = path.join(process.cwd(), 'samples');
  const fiche = fs.readFileSync(path.join(samples, 'fiche_example.jpg'));
  const mainSaved = await saveImage(fiche, 'originals', 'jpg');
  const mainRow = addImage(computer.id, 'main', mainSaved.filename, mainSaved.width, mainSaved.height, 470, 'manual', null);

  const cleaned = await cropBottom(path.join(ORIGINALS_DIR, mainSaved.filename), mainSaved.width, mainSaved.height, 470);
  const cleanedRow = addImage(computer.id, 'cleaned', cleaned.filename, cleaned.width, cleaned.height, 470, 'manual', mainRow.id);

  const secondary = fs.readFileSync(path.join(samples, 'laptop_raw.jpg'));
  const secSaved = await saveImage(secondary, 'secondary', 'jpg');
  addImage(computer.id, 'secondary', secSaved.filename, secSaved.width, secSaved.height, null, 'none', null);

  console.log(`Images : ${listImages(computer.id).length} (main, nettoyée, secondaire) — cleaned=${cleanedRow.id}`);
  console.log('Ouvrez le produit depuis le tableau de bord pour générer ses contenus.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
