/**
 * fix-T-undefined.cjs
 * Ajoute "const T = useApp()?.T || getThemePalette('default');"
 * au début de chaque fonction extraite qui utilise T
 */
const fs = require("fs");
const path = require("path");

const files = [
  "src/components/AdminPanel.jsx",
  "src/components/CelesteChatScreen.jsx",
  "src/components/VideoTrimModal.jsx",
  "src/components/CommentsSection.jsx",
  "src/components/PostDetailModal.jsx",
  "src/components/MatchComponents.jsx",
];

// Ajouter getThemePalette à l'import AppContext
const T_LINE = `\nconst T=useApp()?.T||getThemePalette("default");`;

for (const file of files) {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) { console.log(`⚠️ Introuvable: ${file}`); continue; }
  let content = fs.readFileSync(fullPath, "utf8");

  // Vérifier si T est utilisé dans ce fichier
  if (!content.includes("T.")) {
    console.log(`⏭️ Pas de T: ${file}`);
    continue;
  }

  // Ajouter import getThemePalette depuis App si pas déjà présent
  if (!content.includes("getThemePalette")) {
    content = content.replace(
      `from "../AppContext";`,
      `from "../AppContext";\nimport { getThemePalette } from "../App";`
    );
  }

  // Trouver chaque fonction qui utilise T et injecter la ligne
  // On cherche "function NomComposant(" et on ajoute T_LINE après la première {
  const funcRegex = /^(function\s+\w+\s*\([^)]*\)\s*\{)/gm;
  let modified = content;
  let match;
  const insertions = [];

  while ((match = funcRegex.exec(content)) !== null) {
    // Vérifier si T est utilisé dans le scope de cette fonction
    const restOfFile = content.slice(match.index);
    if (restOfFile.includes("T.")) {
      insertions.push(match.index + match[0].length);
    }
  }

  // Insérer en ordre inverse pour ne pas décaler les positions
  insertions.reverse().forEach(pos => {
    modified = modified.slice(0, pos) + T_LINE + modified.slice(pos);
  });

  fs.writeFileSync(fullPath, modified, "utf8");
  console.log(`✅ T injecté: ${file}`);
}

console.log("\nDone. Lance npm run build pour vérifier.");
