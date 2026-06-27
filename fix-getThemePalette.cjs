/**
 * fix-getThemePalette.cjs
 * 1. Ajoute export à getThemePalette dans App.jsx
 * 2. Corrige les imports dans les composants extraits
 */
const fs = require("fs");
const path = require("path");

// 1. Ajouter export à getThemePalette dans App.jsx
const appPath = path.join(__dirname, "src", "App.jsx");
let appContent = fs.readFileSync(appPath, "utf8");

if (!appContent.includes("export const getThemePalette")) {
  appContent = appContent.replace(
    "const getThemePalette = (mode) => {",
    "export const getThemePalette = (mode) => {"
  );
  fs.writeFileSync(appPath, appContent, "utf8");
  console.log("✅ App.jsx — getThemePalette exporté");
} else {
  console.log("⏭️ App.jsx — déjà exporté");
}

// 2. Corriger les imports dans les composants extraits
const files = [
  "src/components/AdminPanel.jsx",
  "src/components/CelesteChatScreen.jsx",
  "src/components/VideoTrimModal.jsx",
  "src/components/CommentsSection.jsx",
  "src/components/PostDetailModal.jsx",
  "src/components/MatchComponents.jsx",
];

for (const file of files) {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) continue;
  let content = fs.readFileSync(fullPath, "utf8");
  if (!content.includes("getThemePalette")) continue;

  // Remplacer import depuis ../App par ../App (déjà correct, juste vérifier)
  // S'assurer que l'import est bien présent
  if (!content.includes(`from "../App"`)) {
    content = content.replace(
      `from "../AppContext";`,
      `from "../AppContext";\nimport { getThemePalette } from "../App";`
    );
    fs.writeFileSync(fullPath, content, "utf8");
  }
  console.log(`✅ Vérifié: ${file}`);
}

console.log("\nDone. Lance npm run build.");
