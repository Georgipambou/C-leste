#!/usr/bin/env node
// Applique un fichier de patch (===PATCH===/===OLD===/===NEW===/===ENDPATCH===) sur un fichier cible.
// Usage : node apply_patch.js <fichier_cible> <fichier_patch>
// Ex.   : node apply_patch.js App.jsx app.patches.txt
//         node apply_patch.js ChatExtras.jsx chatextras.patches.txt

import fs from "fs";

const [, , targetPath, patchPath] = process.argv;
if (!targetPath || !patchPath) {
  console.error("Usage: node apply_patch.js <fichier_cible> <fichier_patch>");
  process.exit(1);
}

function parsePatches(raw) {
  const patches = [];
  const blocks = raw.split("===PATCH===").slice(1);
  for (const block of blocks) {
    const oldStart = block.indexOf("===OLD===");
    const newStart = block.indexOf("===NEW===");
    const end = block.indexOf("===ENDPATCH===");
    if (oldStart === -1 || newStart === -1 || end === -1) {
      throw new Error("Bloc de patch malformé (marqueurs manquants).");
    }
    let oldStr = block.slice(oldStart + "===OLD===".length, newStart);
    let newStr = block.slice(newStart + "===NEW===".length, end);
    oldStr = oldStr.replace(/^\n/, "").replace(/\n$/, "");
    newStr = newStr.replace(/^\n/, "").replace(/\n$/, "");
    patches.push({ oldStr, newStr });
  }
  return patches;
}

const patchRaw = fs.readFileSync(patchPath, "utf8").replace(/\r\n/g, "\n");
const patches = parsePatches(patchRaw);

const rawTarget = fs.readFileSync(targetPath, "utf8");
const usesCRLF = rawTarget.includes("\r\n");
let content = rawTarget.replace(/\r\n/g, "\n");

let applied = 0;
patches.forEach((p, i) => {
  const count = content.split(p.oldStr).length - 1;
  if (count === 0) {
    throw new Error(
      `Patch ${i + 1}/${patches.length} : bloc OLD introuvable dans ${targetPath}. ` +
      `Le fichier a peut-être déjà été modifié. Extrait recherché :\n---\n${p.oldStr.slice(0, 120)}...\n---`
    );
  }
  if (count > 1) {
    throw new Error(
      `Patch ${i + 1}/${patches.length} : bloc OLD trouvé ${count} fois dans ${targetPath} (doit être unique). ` +
      `Extrait :\n---\n${p.oldStr.slice(0, 120)}...\n---`
    );
  }
  content = content.replace(p.oldStr, p.newStr);
  applied++;
});

if (usesCRLF) content = content.replace(/\n/g, "\r\n");

fs.writeFileSync(targetPath, content, "utf8");
console.log(`${targetPath} : ${applied}/${patches.length} patch(s) appliqué(s) avec succès.`);
