const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src', 'App.jsx');
let code = fs.readFileSync(file, 'utf8');
let changes = 0;

function applyOnce(label, search, replace) {
  const count = code.split(search).length - 1;
  if (count !== 1) {
    console.log(`✗ ${label} : ancre trouvée ${count} fois — AUCUNE modif.`);
    return;
  }
  code = code.replace(search, replace);
  changes++;
  console.log(`✓ ${label} : appliqué.`);
}

// 1) Son plus grave (220-300Hz au lieu de 1100-1500Hz)
applyOnce(
  '1/4 Son grave',
  'o.frequency.setValueAtTime(1100,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(1500,ctx.currentTime+0.08);g.gain.setValueAtTime(0.18,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.15);o.start(ctx.currentTime);o.stop(ctx.currentTime+0.16);',
  'o.frequency.setValueAtTime(260,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(320,ctx.currentTime+0.12);g.gain.setValueAtTime(0.22,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.25);o.start(ctx.currentTime);o.stop(ctx.currentTime+0.26);'
);

// 2) Fix bug unlike : supprimer le 2e setPosts qui re-inverse
applyOnce(
  '2/4 Fix bug unlike',
  '      setPosts(prev=>(prev||[]).map(p=>{\r\n  if(p.id!==pid)return p;\r\n  const liked=(p.likes||[]).some(l=>(l.user_id||l)===uid);\r\n  const next={...p,likes:liked?(p.likes||[]).filter(l=>(l.user_id||l)!==uid):[...(p.likes||[]),uid]};\r\n  console.log(\"toggleLike result text_background:\", next.text_background);\r\n  return next;\r\n}));\r\n    // Push notif',
  '      // Push notif'
);

// 3) Ajouter compteur saves dans le Reel
applyOnce(
  '3/4 Compteur saves dans Reel',
  '<button onClick={()=>{setSavedIds(prev=>{const n=new Set(prev);n.has(post.id)?n.delete(post.id):n.add(post.id);return n;});toggleSave(post.id);}} style={{background:"none",border:"none",color:"#fff",cursor:"pointer",padding:0}}><Bookmark size={28} fill={savedIds.has(post.id)?"#C9952A":"none"} color={savedIds.has(post.id)?"#C9952A":"#fff"}/></button>\r\n                </div>',
  '<button onClick={()=>{setSavedIds(prev=>{const n=new Set(prev);n.has(post.id)?n.delete(post.id):n.add(post.id);return n;});toggleSave(post.id);}} style={{background:"none",border:"none",color:"#fff",cursor:"pointer",padding:0}}><Bookmark size={28} fill={savedIds.has(post.id)?"#C9952A":"none"} color={savedIds.has(post.id)?"#C9952A":"#fff"}/></button>\r\n                  <span style={{fontSize:12,fontWeight:600,color:"#fff"}}>{post.saves_count||0}</span>\r\n                </div>'
);

// 4) Likes live dans Reel — ancre unique avec contexte posts.map
applyOnce(
  '4/4 Likes live dans Reel',
  '{posts.map((post,idx)=>{\r\n          const liked=(post.likes||[]).some(l=>(l.user_id||l)===uid);',
  '{posts.map((post,idx)=>{\r\n          const livePost=(posts||[]).find(p=>p.id===post.id)||post;\r\n          const liked=(livePost.likes||[]).some(l=>(l.user_id||l)===uid);'
);

fs.writeFileSync(file, code, 'utf8');
console.log(`\n${changes}/4 modifications appliquées. Fichier sauvegardé.`);
