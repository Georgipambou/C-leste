const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.jsx');
let code = fs.readFileSync(filePath, 'utf8');
let count = 0;

// 1. Ajouter fromReel=false dans la signature de PostDetailModal
const sig_old = `function PostDetailModal({post,myProfile,session,getM,onClose,onLike,onComment,notify,zIndex=800}){`;
const sig_new = `function PostDetailModal({post,myProfile,session,getM,onClose,onLike,onComment,notify,zIndex=800,fromReel=false}){`;
if (code.includes(sig_old)) {
  code = code.replace(sig_old, sig_new);
  count++;
  console.log('✓ 1/3 Paramètre fromReel ajouté à PostDetailModal.');
} else {
  console.log('✗ 1/3 ÉCHEC — ancre signature non trouvée.');
}

// 2. Masquer le MediaPlayer vidéo quand fromReel=true
const media_old = `      <MediaPlayer url={allMedia[slideIdx]} onImageClick={setViewImg}/>`;
const media_new = `      {!fromReel&&<MediaPlayer url={allMedia[slideIdx]} onImageClick={setViewImg}/>}`;
if (code.includes(media_old)) {
  code = code.replace(media_old, media_new);
  count++;
  console.log('✓ 2/3 MediaPlayer masqué quand fromReel=true.');
} else {
  console.log('✗ 2/3 ÉCHEC — ancre MediaPlayer non trouvée.');
}

// 3. Passer fromReel={!!reelsCommentPost} dans l'appel depuis les Reels
const call_old = `          zIndex={reelsCommentPost?1300:800}`;
const call_new = `          zIndex={reelsCommentPost?1300:800}\n          fromReel={!!reelsCommentPost}`;
if (code.includes(call_old)) {
  code = code.replace(call_old, call_new);
  count++;
  console.log('✓ 3/3 fromReel passé à PostDetailModal depuis Reels.');
} else {
  console.log('✗ 3/3 ÉCHEC — ancre appel Reels non trouvée.');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log(`\n${count}/3 modifications appliquées. Fichier sauvegardé.`);
