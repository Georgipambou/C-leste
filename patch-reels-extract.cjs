/**
 * patch-reels-extract.cjs
 * Extrait ReelsViewer de App.jsx et le remplace par un import
 * Usage : node patch-reels-extract.cjs
 */

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "src", "App.jsx");

if (!fs.existsSync(APP_PATH)) {
  console.error("❌ App.jsx introuvable :", APP_PATH);
  process.exit(1);
}

let src = fs.readFileSync(APP_PATH, "utf8");

// ── 1. Ajouter l'import ReelsViewer après le premier import existant ──
const IMPORT_LINE = `import ReelsViewer from "./ReelsViewer";`;

if (src.includes(IMPORT_LINE)) {
  console.log("⚠️  Import ReelsViewer déjà présent — étape 1 ignorée.");
} else {
  // Insère après la dernière ligne d'import du bloc initial
  src = src.replace(
    `import EasyCrop from "react-easy-crop";`,
    `import EasyCrop from "react-easy-crop";\n${IMPORT_LINE}`
  );
  console.log("✅ Étape 1 : import ReelsViewer ajouté.");
}

// ── 2. Supprimer le cache vidéo (déplacé dans ReelsViewer.jsx) ──
const CACHE_START = `// ── cache vidéo session ──────────────────────────────────────────\nconst _vBlobMap=new Map();`;
const CACHE_END   = `function ReelVideoSrc({rawSrc,nearActive,onSrc}){`;

const idxCacheStart = src.indexOf(CACHE_START);
const idxCacheEnd   = src.indexOf(CACHE_END);

if (idxCacheStart !== -1 && idxCacheEnd !== -1) {
  src = src.slice(0, idxCacheStart) + src.slice(idxCacheEnd);
  console.log("✅ Étape 2 : bloc cache vidéo supprimé.");
} else {
  console.log("⚠️  Bloc cache vidéo non trouvé — étape 2 ignorée.");
}

// ── 3. Supprimer ReelVideoSrc ──
const RVS_START = `function ReelVideoSrc({rawSrc,nearActive,onSrc}){`;
const RVS_END   = `// ─────────────────────────────────────────────────────────────────\nfunction ReelsViewer(`;

const idxRVSStart = src.indexOf(RVS_START);
const idxRVSEnd   = src.indexOf(RVS_END);

if (idxRVSStart !== -1 && idxRVSEnd !== -1) {
  src = src.slice(0, idxRVSStart) + src.slice(idxRVSEnd);
  console.log("✅ Étape 3 : ReelVideoSrc supprimé.");
} else {
  console.log("⚠️  ReelVideoSrc non trouvé — étape 3 ignorée.");
}

// ── 4. Supprimer la fonction ReelsViewer complète ──
// On cherche le début et la fin du composant
const RV_START = `// ─────────────────────────────────────────────────────────────────\nfunction ReelsViewer(`;
const RV_AFTER = `function SkeletonPost(){`;

const idxRVStart = src.indexOf(RV_START);
const idxRVAfter = src.indexOf(RV_AFTER);

if (idxRVStart !== -1 && idxRVAfter !== -1) {
  src = src.slice(0, idxRVStart) + src.slice(idxRVAfter);
  console.log("✅ Étape 4 : fonction ReelsViewer supprimée de App.jsx.");
} else {
  console.log("⚠️  Fonction ReelsViewer non trouvée — étape 4 ignorée.");
  console.log("   idxRVStart:", idxRVStart, "idxRVAfter:", idxRVAfter);
}

// ── Sauvegarde ──
const BACKUP = APP_PATH + ".bak-before-reels-extract";
fs.copyFileSync(APP_PATH, BACKUP);
fs.writeFileSync(APP_PATH, src, "utf8");

console.log("\n✅ Patch terminé.");
console.log("   Backup :", BACKUP);
console.log("\nÉtapes suivantes :");
console.log("  1. Copie ReelsViewer.jsx dans src/");
console.log("  2. npx vite build (ou npm run build) pour vérifier");
