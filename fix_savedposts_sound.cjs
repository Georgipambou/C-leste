const fs = require("fs");

const file = process.argv[2];
if (!file) { console.error("Usage: node fix_savedposts_sound.cjs src\\App.jsx"); process.exit(1); }
let src = fs.readFileSync(file, "utf8");

const search = `onUser={()=>{}} onOpenComments={(p,onPhotoCb)=>{setPhotoCommentPost(p);setPhotoCloseCallback(()=>onPhotoCb);}} myConnections={[]} onConnect={()=>{}}/>`;
const replace = `onUser={()=>{}} onOpenComments={(p,onPhotoCb)=>{setPhotoCommentPost(p);setPhotoCloseCallback(()=>onPhotoCb);}} myConnections={[]} onConnect={()=>{}} onOpenSound={setOpenSoundId}/>`;

const count = src.split(search).length - 1;
if (count === 0) {
  console.log("⚠️  introuvable — le texte ne correspond toujours pas, colle-moi la ligne exacte.");
} else if (count > 1) {
  console.log(`⚠️  ambigu (${count} occurrences) — appliqué à la 1ère seulement.`);
  src = src.replace(search, replace);
  fs.writeFileSync(file, src, "utf8");
} else {
  src = src.replace(search, replace);
  fs.writeFileSync(file, src, "utf8");
  console.log("✅ appliqué — SavedPostsTab a maintenant onOpenSound sur PhotoViewer.");
}
