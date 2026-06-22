const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.jsx');
let code = fs.readFileSync(filePath, 'utf8');
let count = 0;

// ─── 1/3 : onOpenComments — garder reelsIndex ouvert, stocker dans reelsCommentPost ───
const OLD1 = `onOpenComments={p=>{setReelsIndex(null);setDetailPost(p);}}`;
const NEW1 = `onOpenComments={p=>{setReelsCommentPost(p);setDetailPost(p);}}`;
if (code.includes(OLD1)) {
  code = code.replace(OLD1, NEW1);
  count++;
  console.log('✓ 1/3 onOpenComments : appliqué.');
} else {
  console.log('✗ 1/3 onOpenComments : ancre non trouvée.');
}

// ─── 2/3 : PostDetailModal onClose — revenir au Reel si ouvert depuis Reel ───
const OLD2 = `{detailPost&&(\r\n        <PostDetailModal\r\n          post={detailPost} myProfile={myProfile} session={session} getM={getM}\r\n          onClose={()=>{\r\n            const pos=savedScroll.current;\r\n            setDetailPost(null);\r\n            setTimeout(()=>{if(scrollRef.current)scrollRef.current.scrollTop=pos;},80);\r\n          }}`;
const NEW2 = `{detailPost&&(\r\n        <PostDetailModal\r\n          post={detailPost} myProfile={myProfile} session={session} getM={getM}\r\n          zIndex={reelsCommentPost?1300:800}\r\n          onClose={()=>{\r\n            const pos=savedScroll.current;\r\n            setDetailPost(null);\r\n            setReelsCommentPost(null);\r\n            setTimeout(()=>{if(scrollRef.current)scrollRef.current.scrollTop=pos;},80);\r\n          }}`;
if (code.includes(OLD2)) {
  code = code.replace(OLD2, NEW2);
  count++;
  console.log('✓ 2/3 PostDetailModal onClose + zIndex : appliqué.');
} else {
  console.log('✗ 2/3 PostDetailModal onClose : ancre non trouvée.');
}

// ─── 3/3 : Mentions — déclarer reelsCommentPost + passer zIndex à PostDetailModal ───
// On injecte useState pour reelsCommentPost juste après la déclaration de reelsIndex
const OLD3 = `reelsIndex,setReelsIndex]=useState(null);`;
const NEW3 = `reelsIndex,setReelsIndex]=useState(null);\r\nconst [reelsCommentPost,setReelsCommentPost]=useState(null);`;
if (code.includes(OLD3)) {
  code = code.replace(OLD3, NEW3);
  count++;
  console.log('✓ 3/3 État reelsCommentPost déclaré : appliqué.');
} else {
  console.log('✗ 3/3 État reelsCommentPost : ancre non trouvée.');
}

// ─── Bonus : PostDetailModal — accepter le prop zIndex ───
const OLD4 = `function PostDetailModal({post,myProfile,session,getM,onClose,onLike,onComment,notify}){`;
const NEW4 = `function PostDetailModal({post,myProfile,session,getM,onClose,onLike,onComment,notify,zIndex=800}){`;
if (code.includes(OLD4)) {
  code = code.replace(OLD4, NEW4);
  console.log('✓ bonus : prop zIndex ajouté à PostDetailModal.');
} else {
  // Essayer avec \r\n
  const OLD4b = `function PostDetailModal({post,myProfile,session,getM,onClose,onLike,onComment,notify}){\r\n`;
  if (code.includes(OLD4b)) {
    code = code.replace(OLD4b, `function PostDetailModal({post,myProfile,session,getM,onClose,onLike,onComment,notify,zIndex=800}){\r\n`);
    console.log('✓ bonus : prop zIndex ajouté à PostDetailModal (v2).');
  } else {
    console.log('  (bonus ignoré — fonction PostDetailModal introuvable exactement)');
  }
}

// ─── Appliquer le zIndex dynamique dans le div racine de PostDetailModal ───
const OLD5 = `{viewImg&&<ImageViewer url={viewImg} onClose={()=>setViewImg(null)}/>}\r\n      <div style={{position:"fixed",inset:0,zIndex:800`;
const NEW5 = `{viewImg&&<ImageViewer url={viewImg} onClose={()=>setViewImg(null)}/>}\r\n      <div style={{position:"fixed",inset:0,zIndex:zIndex`;
if (code.includes(OLD5)) {
  code = code.replace(OLD5, NEW5);
  console.log('✓ bonus2 : zIndex dynamique appliqué dans PostDetailModal.');
} else {
  console.log('  (bonus2 ignoré — div racine PostDetailModal non trouvé)');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log(`\n${count}/3 modifications appliquées. Fichier sauvegardé.`);
