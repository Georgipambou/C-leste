/**
 * extract-components.cjs
 * Extrait des composants depuis App.jsx vers src/components/
 * Usage: node extract-components.cjs
 */

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "src", "App.jsx");
const content = fs.readFileSync(APP_PATH, "utf8");
const lines = content.split("\n");

// ── CONFIGURATION DES EXTRACTIONS ─────────────────────────
// Chaque entrée = un fichier à créer
// "starts": lignes où commencent les fonctions à inclure (1-indexé)
// "output": chemin du fichier de sortie
// "imports": imports à ajouter en haut du fichier extrait

const EXTRACTIONS = [
  {
    name: "AdminPanel",
    output: "src/components/AdminPanel.jsx",
    starts: [6810],
    imports: [
      `import React, { useState, useEffect, useRef, useCallback } from "react";`,
      `import { Trash2, Mail, Search, User, Users, Check, X, Eye, EyeOff, Star, AlertTriangle, ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";`,
      `import { sb } from "../lib/supabase";`,
      `import { useApp } from "./AppContext";`,
    ],
  },
  {
    name: "CelesteChatScreen",
    output: "src/components/CelesteChatScreen.jsx",
    starts: [7012],
    imports: [
      `import React, { useState, useEffect, useRef } from "react";`,
      `import { Send, X, Sparkles } from "lucide-react";`,
      `import { useApp } from "./AppContext";`,
    ],
  },
  {
    name: "VideoTrimModal",
    output: "src/components/VideoTrimModal.jsx",
    starts: [1050],
    imports: [
      `import React, { useState, useEffect, useRef } from "react";`,
      `import { X, Play, Pause } from "lucide-react";`,
      `import { useApp } from "./AppContext";`,
    ],
  },
  {
    name: "CommentsSection",
    output: "src/components/CommentsSection.jsx",
    // Inclut CommentsSection + CommentItem (1778 et 1929)
    starts: [1778, 1929],
    imports: [
      `import React, { useState, useEffect, useRef, useCallback } from "react";`,
      `import { Heart, Trash2, Reply, Image, X } from "lucide-react";`,
      `import { sb } from "../lib/supabase";`,
      `import { useApp } from "./AppContext";`,
      `import { uploadToR2 } from "../uploadMedia";`,
    ],
  },
  {
    name: "PostDetailModal",
    output: "src/components/PostDetailModal.jsx",
    starts: [2102],
    imports: [
      `import React, { useState, useEffect } from "react";`,
      `import { X, Heart, Bookmark, Share2, ChevronLeft, ChevronRight } from "lucide-react";`,
      `import { sb } from "../lib/supabase";`,
      `import { useApp } from "./AppContext";`,
    ],
  },
  {
    name: "MatchComponents",
    output: "src/components/MatchComponents.jsx",
    // computeMatchScore, MatchOnboardingModal, getCompatibilityPoints, MatchWriteBtn, MatchSuggestions
    starts: [3155, 3205, 3307, 3336, 3379],
    imports: [
      `import React, { useState, useEffect, useRef, useCallback } from "react";`,
      `import { X, Heart, Star, MapPin, Users, Search } from "lucide-react";`,
      `import { sb } from "../lib/supabase";`,
      `import { useApp } from "./AppContext";`,
    ],
  },
];

// ── FONCTION : trouver la fin d'un bloc fonction ──────────
// Cherche la ligne où les accolades reviennent à 0 après le début
function findBlockEnd(lines, startLine) {
  // startLine est 1-indexé
  let depth = 0;
  let started = false;
  for (let i = startLine - 1; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{") { depth++; started = true; }
      if (ch === "}") { depth--; }
    }
    if (started && depth === 0) {
      return i + 1; // retourne ligne 1-indexée
    }
  }
  return lines.length;
}

// ── EXTRACTION ────────────────────────────────────────────
const linesToRemove = new Set(); // lignes à supprimer de App.jsx (0-indexées)

for (const ext of EXTRACTIONS) {
  let extracted = "";

  for (const startLine of ext.starts) {
    const endLine = findBlockEnd(lines, startLine);
    console.log(`  ${ext.name}: lignes ${startLine}→${endLine}`);
    const block = lines.slice(startLine - 1, endLine).join("\n");
    extracted += block + "\n\n";
    for (let i = startLine - 1; i < endLine; i++) {
      linesToRemove.add(i);
    }
  }

  // Construire le fichier final
  const fileContent = [
    `// ${ext.name} — extrait depuis App.jsx`,
    ...ext.imports,
    "",
    extracted.trimEnd(),
    "",
    `export default ${ext.name};`,
    "",
  ].join("\n");

  const outPath = path.join(__dirname, ext.output);
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, fileContent, "utf8");
  console.log(`✅ Créé: ${ext.output}`);
}

// ── PATCH App.jsx : remplacer les blocs extraits par des imports ──
const importLines = EXTRACTIONS.map(ext => {
  const name = ext.name;
  const rel = "./" + ext.output.replace("src/", "").replace(".jsx", "");
  return `import ${name} from "${rel}";`;
});

// Reconstruire App.jsx sans les lignes extraites
const newLines = lines.filter((_, i) => !linesToRemove.has(i));

// Injecter les imports après le dernier import existant
let lastImportIdx = 0;
for (let i = 0; i < newLines.length; i++) {
  if (newLines[i].startsWith("import ")) lastImportIdx = i;
}
newLines.splice(lastImportIdx + 1, 0, ...importLines);

const newContent = newLines.join("\n");
fs.writeFileSync(APP_PATH, newContent, "utf8");
console.log(`\n✅ App.jsx mis à jour — ${linesToRemove.size} lignes extraites`);
console.log(`📏 Nouvelles lignes App.jsx: ${newLines.length}`);
