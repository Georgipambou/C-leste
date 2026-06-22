const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.jsx');
let code = fs.readFileSync(filePath, 'utf8');
let count = 0;

// ─── 1/4 : Double vidéo — pauser la vidéo du Reel quand on ouvre les commentaires ───
// On ajoute un état reelsVideosPaused et on le toggle dans onOpenComments
const OLD1 = `Object.entries(videoRefs.current).forEach(([i,v])=>{if(!v)return;if(Number(i)===activeIdx){v.currentTime=0;v.play().catch(()=>{});setPausedMap(p=>({...p,[i]:false}));}else{v.pause();}});`;
const NEW1 = `const activeVideo=videoRefs.current[activeIdx];
  if(activeVideo&&!reelsModalOpen){activeVideo.currentTime=0;activeVideo.play().catch(()=>{});setPausedMap(p=>({...p,[activeIdx]:false}));}
  else if(activeVideo&&reelsModalOpen){activeVideo.pause();}
  Object.entries(videoRefs.current).forEach(([i,v])=>{if(!v)return;if(Number(i)!==activeIdx)v.pause();});`;
if (code.includes(OLD1)) {
  code = code.replace(OLD1, NEW1);
  count++;
  console.log('✓ 1/4 Pause vidéo Reel sur modal : appliqué.');
} else {
  console.log('✗ 1/4 Pause vidéo Reel : ancre non trouvée.');
}

// ─── 2/4 : Ajouter état reelsModalOpen + le toggle dans onOpenComments ───
const OLD2 = `const [pausedMap,setPausedMap]=useState({});`;
const NEW2 = `const [pausedMap,setPausedMap]=useState({});
  const [reelsModalOpen,setReelsModalOpen]=useState(false);`;
if (code.includes(OLD2)) {
  code = code.replace(OLD2, NEW2);
  count++;
  console.log('✓ 2/4 État reelsModalOpen déclaré : appliqué.');
} else {
  console.log('✗ 2/4 État reelsModalOpen : ancre non trouvée.');
}

// ─── 3/4 : onOpenComments — setter reelsModalOpen=true ───
const OLD3 = `onClick={()=>onOpenComments(post)} style={{background:"none",border:"none",color:"#fff",cursor:"pointer",padding:0}}`;
const NEW3 = `onClick={()=>{setReelsModalOpen(true);onOpenComments(post,()=>setReelsModalOpen(false));}} style={{background:"none",border:"none",color:"#fff",cursor:"pointer",padding:0}}`;
if (code.includes(OLD3)) {
  code = code.replace(OLD3, NEW3);
  count++;
  console.log('✓ 3/4 onOpenComments pause + callback : appliqué.');
} else {
  console.log('✗ 3/4 onOpenComments : ancre non trouvée.');
}

// ─── 4/4 : saves_count → savesCount dans le Reel ───
const OLD4 = `post.saves_count||0}`;
const NEW4 = `post.savesCount||0}`;
if (code.includes(OLD4)) {
  code = code.replace(OLD4, NEW4);
  count++;
  console.log('✓ 4/4 saves_count → savesCount : appliqué.');
} else {
  console.log('✗ 4/4 saves_count : ancre non trouvée.');
}

// ─── Bonus 1 : Description alignée à gauche dans le Reel ───
// Le conteneur est déjà left:14, mais la p peut hériter d'un textAlign center global
// On force textAlign:'left' sur le paragraphe de la caption
const OLD5 = `{caption.length>0&&(<p style={{margin:0,fontSize:13,lineHeight:1.5,color:"rgba(255,255,255,0.92)"}}>`;
const NEW5 = `{caption.length>0&&(<p style={{margin:0,fontSize:13,lineHeight:1.5,color:"rgba(255,255,255,0.92)",textAlign:"left"}}>`;
if (code.includes(OLD5)) {
  code = code.replace(OLD5, NEW5);
  console.log('✓ bonus1 : Description alignée à gauche : appliqué.');
} else {
  console.log('  (bonus1 ignoré — ancre caption non trouvée)');
}

// ─── Bonus 2 : Mentions — afficher vers le haut seulement, sinon vers le bas ───
// On change bottom:"110%" en bottom:"auto",top:"110%" et on laisse le composant
// choisir selon position. Solution simple: garder bottom:110% mais ajouter maxHeight + scroll
const OLD6 = `position:"absolute",bottom:"110%",left:0,right:0,background:"rgba(10,10,10,0.98)",border:\`1px solid \${T.border}\`,borderRadius:16,overflow:"hidden",zIndex:100,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",animation:"scaleIn .15s ease"`;
const NEW6 = `position:"absolute",bottom:"auto",top:"auto",left:0,right:0,background:"rgba(10,10,10,0.98)",border:\`1px solid \${T.border}\`,borderRadius:16,overflow:"hidden",zIndex:100,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",animation:"scaleIn .15s ease",transform:"translateY(-105%)"`;
if (code.includes(OLD6)) {
  code = code.replace(OLD6, NEW6);
  console.log('✓ bonus2 : Mentions repositionnées au-dessus : appliqué.');
} else {
  console.log('  (bonus2 ignoré — ancre mentions non trouvée)');
}

// ─── Bonus 3 : PostDetailModal — passer le callback onReelsClose ───
// Mettre à jour onOpenComments dans App pour accepter le callback
const OLD7 = `onOpenComments={p=>{setReelsCommentPost(p);setDetailPost(p);}}`;
const NEW7 = `onOpenComments={(p,onReelsCb)=>{setReelsCommentPost(p);setReelsCloseCallback(()=>onReelsCb);setDetailPost(p);}}`;
if (code.includes(OLD7)) {
  code = code.replace(OLD7, NEW7);
  console.log('✓ bonus3 : callback onReelsCb dans App : appliqué.');
} else {
  console.log('  (bonus3 ignoré)');
}

// ─── Bonus 4 : Déclarer reelsCloseCallback dans App ───
const OLD8 = `const [reelsCommentPost,setReelsCommentPost]=useState(null);`;
const NEW8 = `const [reelsCommentPost,setReelsCommentPost]=useState(null);
const [reelsCloseCallback,setReelsCloseCallback]=useState(null);`;
if (code.includes(OLD8)) {
  code = code.replace(OLD8, NEW8);
  console.log('✓ bonus4 : reelsCloseCallback déclaré : appliqué.');
} else {
  console.log('  (bonus4 ignoré)');
}

// ─── Bonus 5 : Appeler le callback à la fermeture de PostDetailModal ───
const OLD9 = `setDetailPost(null);\r\n            setReelsCommentPost(null);`;
const NEW9 = `setDetailPost(null);\r\n            setReelsCommentPost(null);\r\n            if(reelsCloseCallback){reelsCloseCallback();setReelsCloseCallback(null);}`;
if (code.includes(OLD9)) {
  code = code.replace(OLD9, NEW9);
  console.log('✓ bonus5 : callback appelé à la fermeture PostDetailModal : appliqué.');
} else {
  console.log('  (bonus5 ignoré)');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log(`\n${count}/4 modifications principales appliquées. Fichier sauvegardé.`);
