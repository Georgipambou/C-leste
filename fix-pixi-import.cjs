const fs = require('fs');
const file = 'src/CameraStudioModal.jsx';
let code = fs.readFileSync(file, 'utf8');

// Fix import Pixi — utiliser ColorMatrixFilter depuis pixi.js v8
code = code.replace(
  "import * as PIXI from \"pixi.js\";",
  "import * as PIXI from \"pixi.js\";\nimport { ColorMatrixFilter } from \"pixi.js\";"
);

// Vérifier que l'import est bien là
if (!code.includes('ColorMatrixFilter') ) {
  console.error('❌ Import ColorMatrixFilter introuvable');
  process.exit(1);
}

fs.writeFileSync(file, code, 'utf8');
console.log('✅ Import Pixi v8 natif appliqué.');
