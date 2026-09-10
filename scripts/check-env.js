// Vérifie l'environnement avant dev/build/start et affiche des solutions claires.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

if (!fs.existsSync(path.join(root, 'node_modules', 'next'))) {
  console.error('\n❌ Dépendances introuvables (erreur « next: not found »).');
  console.error('   → Lancez d’abord :  npm install');
  console.error('     (le dossier node_modules n’est pas inclus dans les archives de téléchargement)\n');
  process.exit(1);
}

const major = parseInt(process.versions.node.split('.')[0], 10);
if (major < 18) {
  console.error(`\n❌ Node.js ${process.versions.node} est trop ancien (≥ 18.17 requis).`);
  console.error('   → Installez Node 20 LTS : https://nodejs.org  (ou  nvm install 20)\n');
  process.exit(1);
}
if (major > 22) {
  console.warn(`\n⚠️  Node.js ${process.versions.node} : versions officiellement testées jusqu’à 22.`);
  console.warn('   Si un problème de binaire apparaît (SWC, better-sqlite3), utilisez Node 20 LTS :');
  console.warn('   nvm install 20 && nvm use 20\n');
}
