/**
 * fix-imports.cjs
 * Corrige les imports AppContext dans les composants extraits
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

for (const file of files) {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) { console.log(`⚠️ Introuvable: ${file}`); continue; }
  let content = fs.readFileSync(fullPath, "utf8");
  content = content.replace(/from "\.\/AppContext"/g, `from "../App"`);
  fs.writeFileSync(fullPath, content, "utf8");
  console.log(`✅ Corrigé: ${file}`);
}
