const fs = require('fs');
const path = require('path');

const SRC = 'C:/Users/BROU WILLIAMS/Downloads/chrisroi-agence/chrisroi-agence';
const DST = 'C:/chrisroi-agence';

// Nettoyer la destination
if (fs.existsSync(DST)) {
  console.log('Nettoyage destination...');
  fs.rmSync(DST, { recursive: true, force: true });
}

// Fichiers/dossiers à exclure explicites
const EXCLUDE = new Set([
  '.git', '.expo', 'node_modules', 'android', '.idea', 'dist',
  'C:dev', 'Cédev', 'cmdline-tools.zip', 'contrat_chrisroi_agence.docx',
  'logo.png', 'deployment', 'pb_data', 'pocketbase',
  'image_viewer.html', 'README.md.bak_web',
]);

function shouldExclude(name) {
  if (EXCLUDE.has(name)) return true;
  if (/\.(log|tmp|db|db-wal|db-shm|docx|zip|bak|jpg|png|jpeg)$/.test(name)) return true;
  if (/^(check_|fix_|create_|set_|setup_)/.test(name)) return true;
  if (name === 'index.js') return true;
  return false;
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    if (shouldExclude(e.name)) {
      console.log('  skip:', e.name);
      continue;
    }
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

console.log('Copie depuis', SRC, 'vers', DST);
copyDir(SRC, DST);

// Vérification
const dstContents = fs.readdirSync(DST);
console.log('\n=== Contenu destination ===');
console.log(dstContents.join('\n'));

function getDirSize(dir) {
  let total = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += getDirSize(p);
    else total += fs.statSync(p).size;
  }
  return total;
}
const size = getDirSize(DST);
console.log('\n=== Taille ===');
console.log(size > 1024*1024 ? (size / 1024 / 1024).toFixed(1) + ' MB' : (size / 1024).toFixed(1) + ' KB');
