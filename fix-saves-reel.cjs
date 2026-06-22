const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.jsx');
let code = fs.readFileSync(filePath, 'utf8');
let count = 0;

// ─── 1/2 : Initialiser savedIds avec les posts déjà sauvegardés + ajouter saveCountMap ───
const OLD1 = `const [savedIds,setSavedIds]=useState(new Set());`;
const NEW1 = `const [savedIds,setSavedIds]=useState(()=>new Set((posts||[]).filter(p=>p.saved&&p.saved.length>0).map(p=>p.id)));
  const [saveCountMap,setSaveCountMap]=useState(()=>{const m={};(posts||[]).forEach(p=>{m[p.id]=p.savesCount||0;});return m;});`;
if (code.includes(OLD1)) {
  code = code.replace(OLD1, NEW1);
  count++;
  console.log('✓ 1/2 savedIds initialisé + saveCountMap créé.');
} else {
  console.log('✗ 1/2 ancre non trouvée.');
}

// ─── 2/2 : Bouton save — mettre à jour saveCountMap localement + afficher le bon compteur ───
const OLD2 = `onClick={()=>{setSavedIds(prev=>{const n=new Set(prev);n.has(post.id)?n.delete(post.id):n.add(post.id);return n;});toggleSave(post.id);}}`;
const NEW2 = `onClick={()=>{const alreadySaved=savedIds.has(post.id);setSavedIds(prev=>{const n=new Set(prev);alreadySaved?n.delete(post.id):n.add(post.id);return n;});setSaveCountMap(prev=>({...prev,[post.id]:Math.max(0,(prev[post.id]||0)+(alreadySaved?-1:1))}));toggleSave(post.id);}}`;
if (code.includes(OLD2)) {
  code = code.replace(OLD2, NEW2);
  count++;
  console.log('✓ 2/2 Compteur saves local mis à jour au clic.');
} else {
  console.log('✗ 2/2 ancre non trouvée.');
}

// ─── Bonus : Afficher saveCountMap[post.id] au lieu de post.savesCount ───
const OLD3 = `{post.savesCount||0}`;
const NEW3 = `{saveCountMap[post.id]??post.savesCount??0}`;
if (code.includes(OLD3)) {
  code = code.replace(OLD3, NEW3);
  console.log('✓ bonus : Affichage compteur depuis saveCountMap.');
} else {
  console.log('  (bonus ignoré)');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log(`\n${count}/2 modifications appliquées. Fichier sauvegardé.`);
