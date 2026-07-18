const fs = require("fs");

const file = process.argv[2];
if (!file) { console.error("Usage: node apply_patches_sound_extraction.cjs src\\App.jsx"); process.exit(1); }
let src = fs.readFileSync(file, "utf8");

const patches = [
  {
    name: "Import autoExtractAndAttachSound",
    search: `import { uploadToR2 } from "./uploadMedia";`,
    replace: `import { uploadToR2 } from "./uploadMedia";\r\nimport { autoExtractAndAttachSound } from "./lib/soundExtraction";`,
  },
  {
    name: "Ref lastVideoFileRef (NewPostModal)",
    search: `const vRef=useRef();\r\nconst mentionedIdsRef=useRef([]);`,
    replace: `const vRef=useRef();\r\nconst mentionedIdsRef=useRef([]);\r\nconst lastVideoFileRef=useRef(null);`,
  },
  {
    name: "Capture du fichier vidéo — branche caméra",
    search: `try{const publicUrl=await uploadToR2(f,"posts",pct=>setUploadPct(pct));setMediaUrls(p=>[...p,publicUrl]);}\r\ncatch(err){console.error(err);}\r\nfinally{setUploading(false);setUploadPct(0);}\r\ncontinue;`,
    replace: `lastVideoFileRef.current=f;\r\ntry{const publicUrl=await uploadToR2(f,"posts",pct=>setUploadPct(pct));setMediaUrls(p=>[...p,publicUrl]);}\r\ncatch(err){console.error(err);}\r\nfinally{setUploading(false);setUploadPct(0);}\r\ncontinue;`,
  },
  {
    name: "Capture du fichier vidéo — branche trim",
    search: `try{const fileToUpload=trimData.file||f;const publicUrl=await uploadToR2(fileToUpload,"posts",pct=>setUploadPct(pct));setMediaUrls(p=>[...p,publicUrl]);}\r\ncatch(err){console.error(err);}\r\nfinally{setUploading(false);setUploadPct(0);}\r\ncontinue;`,
    replace: `try{const fileToUpload=trimData.file||f;lastVideoFileRef.current=fileToUpload;const publicUrl=await uploadToR2(fileToUpload,"posts",pct=>setUploadPct(pct));setMediaUrls(p=>[...p,publicUrl]);}\r\ncatch(err){console.error(err);}\r\nfinally{setUploading(false);setUploadPct(0);}\r\ncontinue;`,
  },
  {
    name: "Déclenchement extraction auto (submit, après création du post)",
    search: `    if(selectedSound){\r\n      if(selectedSound.isNew&&selectedSound.blob){`,
    replace: `    if(!selectedSound&&lastVideoFileRef.current){\r\n      autoExtractAndAttachSound({sb,uploadToR2,videoFile:lastVideoFileRef.current,postId,uid,authorName:myProfile?.prenom||myProfile?.fullName});\r\n    }\r\n    if(selectedSound){\r\n      if(selectedSound.isNew&&selectedSound.blob){`,
  },
];

let applied = 0, already = 0, warn = 0;

for (const p of patches) {
  const count = src.split(p.search).length - 1;
  if (count === 0) {
    if (src.includes(p.replace)) {
      console.log(`⏭️  [déjà en place] ${p.name}`);
      already++;
    } else {
      console.log(`⚠️  [introuvable] ${p.name} — à vérifier manuellement`);
      warn++;
    }
  } else if (count > 1) {
    console.log(`⚠️  [ambigu, ${count} occurrences] ${p.name} — appliqué à la 1ère seulement`);
    src = src.replace(p.search, p.replace);
    applied++;
  } else {
    src = src.replace(p.search, p.replace);
    console.log(`✅ [appliqué] ${p.name}`);
    applied++;
  }
}

fs.writeFileSync(file, src, "utf8");
console.log(`\n— Terminé : ${applied} appliqué(s), ${already} déjà en place, ${warn} à vérifier manuellement —`);
console.log(`\nN'oublie pas : place aussi le fichier soundExtraction.js dans src/lib/`);
