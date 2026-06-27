/**
 * fix-match-exports.cjs
 * Corrige les exports de MatchComponents.jsx et l'import dans App.jsx
 */
const fs = require("fs");
const path = require("path");

// 1. Corriger MatchComponents.jsx — remplacer "export default MatchComponents" par des exports nommés
const matchPath = path.join(__dirname, "src", "components", "MatchComponents.jsx");
let matchContent = fs.readFileSync(matchPath, "utf8");

// Supprimer la ligne "export default MatchComponents;" qui ne correspond à rien
matchContent = matchContent.replace(/\nexport default MatchComponents;\n?$/, "");

// Ajouter les exports nommés à la fin
matchContent += `
export { computeMatchScore, MatchOnboardingModal, getCompatibilityPoints, MatchWriteBtn, MatchSuggestions };
`;

fs.writeFileSync(matchPath, matchContent, "utf8");
console.log("✅ MatchComponents.jsx corrigé — exports nommés");

// 2. Corriger App.jsx — remplacer "import MatchComponents from..." par imports nommés
const appPath = path.join(__dirname, "src", "App.jsx");
let appContent = fs.readFileSync(appPath, "utf8");

appContent = appContent.replace(
  `import MatchComponents from "./components/MatchComponents";`,
  `import { computeMatchScore, MatchOnboardingModal, getCompatibilityPoints, MatchWriteBtn, MatchSuggestions } from "./components/MatchComponents";`
);

fs.writeFileSync(appPath, appContent, "utf8");
console.log("✅ App.jsx corrigé — imports nommés MatchComponents");
