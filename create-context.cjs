/**
 * create-context.cjs
 * Crée src/AppContext.jsx et corrige les imports dans les composants extraits
 */
const fs = require("fs");
const path = require("path");

// 1. Créer src/AppContext.jsx
const contextContent = `import { createContext, useContext } from "react";

export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
`;

const ctxPath = path.join(__dirname, "src", "AppContext.jsx");
fs.writeFileSync(ctxPath, contextContent, "utf8");
console.log("✅ Créé: src/AppContext.jsx");

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
  if (!fs.existsSync(fullPath)) { console.log(`⚠️ Introuvable: ${file}`); continue; }
  let content = fs.readFileSync(fullPath, "utf8");
  content = content.replace(/from "\.\.\/App"/g, `from "../AppContext"`);
  fs.writeFileSync(fullPath, content, "utf8");
  console.log(`✅ Corrigé: ${file}`);
}

// 3. Corriger App.jsx : remplacer la déclaration locale par un import
const appPath = path.join(__dirname, "src", "App.jsx");
let appContent = fs.readFileSync(appPath, "utf8");

// Remplacer les deux lignes de définition par un import
appContent = appContent.replace(
  `const AppContext = createContext(null);\nconst useApp = () => useContext(AppContext);`,
  `import { AppContext, useApp } from "./AppContext";`
);

// Aussi version \r\n
appContent = appContent.replace(
  `const AppContext = createContext(null);\r\nconst useApp = () => useContext(AppContext);`,
  `import { AppContext, useApp } from "./AppContext";`
);

fs.writeFileSync(appPath, appContent, "utf8");
console.log("✅ App.jsx mis à jour — AppContext importé");
