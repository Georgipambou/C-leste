#!/usr/bin/env node
/**
 * apply-video-editor-patch.mjs
 * ─────────────────────────────────────────────────────────────
 * Patch chirurgical : ajoute l'éditeur vidéo style CapCut à Céleste
 * sans toucher à la logique existante.
 *
 * Ce que fait ce script :
 *   1. Installe les dépendances nécessaires (@openvideo/engine-pixi, pixi.js)
 *   2. Copie src/videoEditor/VideoEditorModal.jsx dans ton projet
 *   3. Ajoute UNE ligne d'import dans ton App.jsx (aucune autre modification)
 *
 * Usage :
 *   1) Place ce script + le dossier "src/videoEditor" à la racine de ton repo
 *      (à côté de package.json), ou ajuste APP_FILE ci-dessous.
 *   2) node apply-video-editor-patch.mjs
 *
 * Le script est idempotent : si le patch est déjà appliqué, il ne fait rien.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config — ajuste si besoin ────────────────────────────────
const REPO_ROOT = process.cwd();
const APP_FILE = process.env.CELESTE_APP_FILE || join(REPO_ROOT, "src", "App.jsx");
const SOURCE_COMPONENT = join(__dirname, "src", "videoEditor", "VideoEditorModal.jsx");
const TARGET_COMPONENT_DIR = join(REPO_ROOT, "src", "videoEditor");
const TARGET_COMPONENT_FILE = join(TARGET_COMPONENT_DIR, "VideoEditorModal.jsx");

const IMPORT_LINE = `import VideoEditorModal from "./videoEditor/VideoEditorModal";`;
const ANCHOR_IMPORT = `import ReelsViewer from "./ReelsViewer";`;

function log(msg) {
  console.log(`[patch] ${msg}`);
}

function fail(msg) {
  console.error(`[patch] ✗ ${msg}`);
  process.exit(1);
}

// ── 1. Vérifications de base ─────────────────────────────────
if (!existsSync(join(REPO_ROOT, "package.json"))) {
  fail("Aucun package.json trouvé ici. Lance ce script depuis la racine du repo Céleste.");
}
if (!existsSync(APP_FILE)) {
  fail(`Fichier App.jsx introuvable à ${APP_FILE}. Définis CELESTE_APP_FILE=/chemin/vers/App.jsx si besoin.`);
}
if (!existsSync(SOURCE_COMPONENT)) {
  fail(`Composant source introuvable : ${SOURCE_COMPONENT}`);
}

// ── 2. Installation des dépendances ──────────────────────────
log("Installation de @openvideo/engine-pixi + pixi.js…");
try {
  execSync("npm install @openvideo/engine-pixi pixi.js --save", {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
} catch (e) {
  fail("npm install a échoué. Vérifie ta connexion / le réseau puis relance le script.");
}

// ── 3. Copie du composant ────────────────────────────────────
if (!existsSync(TARGET_COMPONENT_DIR)) {
  mkdirSync(TARGET_COMPONENT_DIR, { recursive: true });
  log(`Dossier créé : ${TARGET_COMPONENT_DIR}`);
}
copyFileSync(SOURCE_COMPONENT, TARGET_COMPONENT_FILE);
log(`Composant copié → ${TARGET_COMPONENT_FILE}`);

// ── 4. Patch de l'import dans App.jsx ────────────────────────
let appSrc = readFileSync(APP_FILE, "utf8");

if (appSrc.includes(IMPORT_LINE)) {
  log("Import déjà présent dans App.jsx — rien à faire.");
} else if (appSrc.includes(ANCHOR_IMPORT)) {
  appSrc = appSrc.replace(ANCHOR_IMPORT, `${ANCHOR_IMPORT}\n${IMPORT_LINE}`);
  writeFileSync(APP_FILE, appSrc, "utf8");
  log("Import ajouté dans App.jsx, juste après l'import de ReelsViewer.");
} else {
  // Anchor non trouvé (App.jsx modifié entre-temps) : on ajoute en tête de fichier,
  // ce qui reste sûr en JS (les imports ESM sont hoistés).
  appSrc = `${IMPORT_LINE}\n${appSrc}`;
  writeFileSync(APP_FILE, appSrc, "utf8");
  log("Ancre 'ReelsViewer' introuvable — import ajouté en tête de App.jsx à la place (sans danger).");
}

log("");
log("✓ Patch appliqué avec succès.");
log("");
log("Prochaine étape (manuelle, volontairement non automatisée) :");
log("  Remplace un usage de <VideoTrimModal .../> par <VideoEditorModal .../>");
log("  Les deux composants partagent la même interface :");
log("    { videoSrc, maxDuration, onClose, onDone }");
log("  Exemple : dans NewPostModal, remplace temporairement");
log("    {videoTrimSrc && <VideoTrimModal ... />}");
log("  par");
log("    {videoTrimSrc && <VideoEditorModal ... />}");
log("  pour tester le nouvel éditeur sans rien casser (VideoTrimModal reste intact ailleurs).");
