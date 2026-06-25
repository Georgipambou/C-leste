const fs = require("fs");
const path = require("path");

const filePath = process.argv[2];
if (!filePath) { console.error("Usage: node fix-android-render.cjs src/App.jsx"); process.exit(1); }

let code = fs.readFileSync(filePath, "utf8");
const original = code;

// 1. Ajouter WebkitBackdropFilter partout où backdropFilter existe sans son jumeau
// Pattern: backdropFilter:"blur(Xpx)" → backdropFilter:"blur(Xpx)",WebkitBackdropFilter:"blur(Xpx)"
code = code.replace(
  /backdropFilter:(["']blur\([^"']+\)["'])/g,
  (match, val) => {
    // Vérifier si WebkitBackdropFilter est déjà juste après
    return match; // On fait ça en deux passes
  }
);

// Approche plus fiable : remplacer backdropFilter:X par backdropFilter:X,WebkitBackdropFilter:X
// seulement si WebkitBackdropFilter n'est pas déjà dans les 80 chars suivants
code = code.replace(
  /backdropFilter:("blur\([^"]+\)")/g,
  (match, val, offset) => {
    const after = code.slice(offset, offset + 120);
    if (after.includes("WebkitBackdropFilter")) return match;
    return `backdropFilter:${val},WebkitBackdropFilter:${val}`;
  }
);

// Seconde passe pour les single quotes
code = code.replace(
  /backdropFilter:('blur\([^']+\)')/g,
  (match, val, offset) => {
    const after = code.slice(offset, offset + 120);
    if (after.includes("WebkitBackdropFilter")) return match;
    return `backdropFilter:${val},WebkitBackdropFilter:${val}`;
  }
);

// 2. Ajouter font-smoothing dans le CSS global GS
// Cherche le bloc * { box-sizing... }
code = code.replace(
  /\*\{box-sizing:border-box;margin:0;padding:0;?\}/,
  "*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}"
);

// 3. Ajouter text-rendering dans body
code = code.replace(
  /body\{(background:[^;]+;color:[^;]+;)/,
  "body{$1text-rendering:optimizeLegibility;-webkit-text-size-adjust:100%;"
);

// 4. Ajouter fmtCount si pas déjà présent
if (!code.includes("const fmtCount=")) {
  // Cherche const ago= pour insérer juste après
  code = code.replace(
    /(const ago=n=>\{[^\n]+\n)/,
    '$1const fmtCount=n=>{if(!n&&n!==0)return"0";if(n>=1000000)return(n/1000000).toFixed(n>=10000000?0:1).replace(/\\.0$/,"")+"M";if(n>=1000)return(n/1000).toFixed(n>=10000?0:1).replace(/\\.0$/,"")+"K";return String(n);};\n'
  );
}

if (code === original) {
  console.log("⚠️  Aucun changement détecté — vérifie les patterns");
} else {
  fs.writeFileSync(filePath, code, "utf8");
  const changes = (code.match(/WebkitBackdropFilter/g)||[]).length - (original.match(/WebkitBackdropFilter/g)||[]).length;
  console.log(`✅ Terminé !`);
  console.log(`   +${changes} WebkitBackdropFilter ajoutés`);
  console.log(`   font-smoothing CSS ajouté`);
  console.log(`   text-rendering body ajouté`);
  console.log(`   fmtCount ${code.includes("const fmtCount=") && !original.includes("const fmtCount=") ? "ajouté" : "déjà présent"}`);
}
