/**
 * patch-reels-extract-v2.cjs
 * Supprime ReelsViewer, ReelVideoSrc et cache vidéo de App.jsx
 * Usage : node patch-reels-extract-v2.cjs
 */

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "src", "App.jsx");

if (!fs.existsSync(APP_PATH)) {
  console.error("❌ App.jsx introuvable :", APP_PATH);
  process.exit(1);
}

let src = fs.readFileSync(APP_PATH, "utf8");
const original = src;

// ── 1. Supprimer le bloc cache vidéo + ReelVideoSrc + ReelsViewer ──
// On cherche depuis le début du cache jusqu'à SkeletonPost
const CACHE_MARKER = `const _vBlobMap=new Map();`;
const AFTER_MARKER = `function SkeletonPost(){`;

const idxStart = src.indexOf(CACHE_MARKER);
const idxEnd   = src.indexOf(AFTER_MARKER);

if (idxStart === -1) {
  console.error("❌ Marqueur de début (_vBlobMap) non trouvé.");
  process.exit(1);
}
if (idxEnd === -1) {
  console.error("❌ Marqueur de fin (SkeletonPost) non trouvé.");
  process.exit(1);
}

console.log(`✅ Bloc trouvé : positions ${idxStart} → ${idxEnd}`);
console.log(`   Taille supprimée : ${idxEnd - idxStart} caractères`);

// On remonte pour inclure le commentaire au-dessus de _vBlobMap s'il existe
let realStart = idxStart;
// Cherche le commentaire "// ── cache vidéo" avant _vBlobMap
const COMMENT_BEFORE = `// ── HOME TAB`;
const idxComment = src.lastIndexOf(COMMENT_BEFORE, idxStart);
if (idxComment !== -1 && idxStart - idxComment < 200) {
  realStart = idxComment;
  console.log(`   (commentaire HOME TAB inclus depuis position ${idxComment})`);
}

src = src.slice(0, realStart) + src.slice(idxEnd);

console.log("✅ ReelsViewer, ReelVideoSrc et cache vidéo supprimés de App.jsx.");

// ── 2. Vérifier que l'import existe déjà ──
if (src.includes(`import ReelsViewer from "./ReelsViewer"`)) {
  console.log("✅ Import ReelsViewer déjà présent.");
} else {
  src = src.replace(
    `import EasyCrop from "react-easy-crop";`,
    `import EasyCrop from "react-easy-crop";\nimport ReelsViewer from "./ReelsViewer";`
  );
  console.log("✅ Import ReelsViewer ajouté.");
}

// ── Sauvegarde + écriture ──
const BACKUP = APP_PATH + ".bak-reels-v2";
fs.writeFileSync(BACKUP, original, "utf8");
fs.writeFileSync(APP_PATH, src, "utf8");

console.log("\n✅ Patch v2 terminé.");
console.log("   Backup :", BACKUP);
console.log("\nVérifie avec : npm run build");
