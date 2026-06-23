const fs = require("fs");
const path = require("path");

const filePath = process.argv[2] || path.join(__dirname, "src", "App.jsx");
const lines = fs.readFileSync(filePath, "utf8").split("\n");
let changed = 0;

function replaceLine(lineNum, search, replacement, description) {
  const idx = lineNum - 1;
  if (!lines[idx].includes(search)) {
    console.error(`✗ NON TROUVÉ ligne ${lineNum} : ${description}`);
    console.error(`  Contenu actuel : ${lines[idx].substring(0, 100)}`);
    return;
  }
  lines[idx] = lines[idx].replace(search, replacement);
  changed++;
  console.log(`✓ [L${lineNum}] ${description}`);
}

// 1. MENTIONS — dropdown hors écran (L1729)
replaceLine(1729,
  `position:"fixed",bottom:Math.max(8,window.innerHeight-anchorRect.top+8),left:anchorRect.left,width:anchorRect.width,maxHeight:"50vh",overflowY:"auto"`,
  `position:"fixed",top:Math.min(anchorRect.bottom+8,window.innerHeight-220),left:anchorRect.left,width:anchorRect.width,maxHeight:200,overflowY:"auto"`,
  "Mentions dropdown : bottom → top"
);

// 2. STATUTS durée vidéo (L2668 — useEffect)
replaceLine(2668,
  `const duration=current.type==="text"?5000:10000;`,
  `const duration=current.type==="text"?5000:(isVideo&&videoRef.current?.duration?Math.min(videoRef.current.duration,90)*1000:10000);`,
  "Statuts durée vidéo réelle (useEffect)"
);

// 3. STATUTS durée vidéo (L2683 — togglePause)
replaceLine(2683,
  `const duration=current?.type==="text"?5000:10000;`,
  `const duration=current?.type==="text"?5000:(isVideo&&videoRef.current?.duration?Math.min(videoRef.current.duration,90)*1000:10000);`,
  "Statuts durée vidéo réelle (togglePause)"
);

// 4. STATUTS objectFit cover → contain (L2741)
replaceLine(2741,
  `objectFit:"cover"}}/>`,
  `objectFit:"contain",background:"#000"}}/>`,
  "Statuts vidéo objectFit contain"
);

// 5. STATUTS upload vidéo — limite 25MB → 200MB (L2522)
replaceLine(2522,
  `if(f.size>25*1024*1024){alert("Vidéo max 25MB");return;}`,
  `if(f.size>200*1024*1024){alert("Vidéo max 200MB");return;}`,
  "Statuts upload limite 200MB"
);

// 6. STATUTS upload vidéo — bloc setStatusTrimFile → upload direct si ≤90s (L2523-2526)
// On remplace les 4 lignes 2523..2526 par le nouveau bloc
{
  const idx = 2523 - 1; // ligne 2523 (0-indexed: 2522)
  const expected = `      const src=await new Promise(res=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(f);});`;
  if (!lines[idx].includes("const src=await new Promise")) {
    console.error(`✗ NON TROUVÉ ligne 2523 : bloc upload vidéo statut`);
    console.error(`  Contenu : ${lines[idx].substring(0,100)}`);
  } else {
    // Remplacer lignes 2523-2526 (idx 2522-2525) par le nouveau bloc
    const newLines = [
      `      const src=await new Promise(res=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(f);});`,
      `      const _vid=document.createElement("video");`,
      `      _vid.src=src;`,
      `      await new Promise(res=>{_vid.onloadedmetadata=res;_vid.onerror=res;setTimeout(res,3000);});`,
      `      if(_vid.duration>90){setStatusTrimFile(f);setStatusTrimSrc(src);return;}`,
      `      const r2=new FileReader();r2.onload=ev=>setPreview(ev.target.result);r2.readAsDataURL(f);`,
      `      setUploading(true);`,
      `      try{const publicUrl=await uploadToR2(f,"statuses");setMediaUrl(publicUrl);}catch(e){console.error("Erreur upload vidéo statut:",e);}`,
      `      setUploading(false);`,
      `      return;`,
    ];
    // Supprimer les anciennes lignes 2523-2526 (idx 2522..2525) et insérer les nouvelles
    lines.splice(idx, 4, ...newLines);
    changed++;
    console.log(`✓ [L2523-2526] Statuts upload vidéo : vérif durée + upload direct si ≤90s`);
  }
}

// Recalculer les numéros de ligne après splice (+6 lignes ajoutées)
const offset = 6;

// 7. STATUTS — ajouter VideoTrimModal dans StatusCreatorModal JSX
// Chercher la ligne "{cropSrc&&(" qui est DANS StatusCreatorModal (~L2550 + offset)
{
  const targetLine = 2550 + offset; // ~2556 après splice
  // On cherche dans une fenêtre autour
  let found = -1;
  for (let i = targetLine - 10; i <= targetLine + 10; i++) {
    if (lines[i] && lines[i].includes("{cropSrc&&(")) {
      // Vérifier que c'est bien dans StatusCreatorModal (pas avant L2496+offset)
      if (i > (2496 + offset - 1)) {
        found = i;
        break;
      }
    }
  }
  if (found === -1) {
    console.error(`✗ NON TROUVÉ : {cropSrc&&( dans StatusCreatorModal`);
  } else {
    const videoTrimLine = `{statusTrimSrc&&<VideoTrimModal videoSrc={statusTrimSrc} onClose={()=>{setStatusTrimSrc(null);setStatusTrimFile(null);}} onDone={async trimmedFile=>{setStatusTrimSrc(null);setStatusTrimFile(null);if(!trimmedFile)return;const r=new FileReader();r.onload=ev=>setPreview(ev.target.result);r.readAsDataURL(trimmedFile);setUploading(true);try{const publicUrl=await uploadToR2(trimmedFile,"statuses");setMediaUrl(publicUrl);}catch(e){console.error("Erreur upload vidéo statut:",e);}setUploading(false);}}/>}`;
    lines.splice(found, 0, videoTrimLine);
    changed++;
    console.log(`✓ [L${found+1}] Statuts : VideoTrimModal injecté dans StatusCreatorModal`);
  }
}

// 8. REELS description bottom 92px → 160px
{
  let found = -1;
  for (let i = 3100; i < 3300; i++) {
    if (lines[i] && lines[i].includes(`bottom:"calc(92px + env(safe-area-inset-bottom,0px))"`)) {
      found = i; break;
    }
  }
  if (found === -1) { console.error(`✗ NON TROUVÉ : Reels description bottom 92px`); }
  else {
    lines[found] = lines[found].replace(
      `bottom:"calc(92px + env(safe-area-inset-bottom,0px))"`,
      `bottom:"calc(160px + env(safe-area-inset-bottom,0px))"`
    );
    changed++;
    console.log(`✓ [L${found+1}] Reels description bottom 92px → 160px`);
  }
}

// 9. REELS boutons WhatsApp/lien bottom 60px → 100px
{
  let found = -1;
  for (let i = 3100; i < 3300; i++) {
    if (lines[i] && lines[i].includes(`bottom:'calc(60px + env(safe-area-inset-bottom,0px))'`)) {
      found = i; break;
    }
  }
  if (found === -1) { console.error(`✗ NON TROUVÉ : Reels boutons WhatsApp bottom 60px`); }
  else {
    lines[found] = lines[found].replace(
      `bottom:'calc(60px + env(safe-area-inset-bottom,0px))'`,
      `bottom:'calc(100px + env(safe-area-inset-bottom,0px))'`
    );
    changed++;
    console.log(`✓ [L${found+1}] Reels boutons WhatsApp/lien bottom 60px → 100px`);
  }
}

// 10. REELS avatar position:relative pour bouton +
{
  let found = -1;
  for (let i = 3100; i < 3300; i++) {
    if (lines[i] && lines[i].includes(`width:46,height:46,borderRadius:"50%",background:"rgba(255,255,255,0.2)",overflow:"hidden"`)) {
      found = i; break;
    }
  }
  if (found === -1) { console.error(`✗ NON TROUVÉ : Reels avatar div`); }
  else {
    lines[found] = lines[found].replace(
      `width:46,height:46,borderRadius:"50%",background:"rgba(255,255,255,0.2)",overflow:"hidden"`,
      `position:"relative",width:46,height:46,borderRadius:"50%",background:"rgba(255,255,255,0.2)",overflow:"visible"`
    ).replace(
      `style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""`,
      `style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}} alt=""`
    );
    changed++;
    console.log(`✓ [L${found+1}] Reels avatar position:relative`);
  }
}

fs.writeFileSync(filePath, lines.join("\n"), "utf8");
console.log(`\n✅ ${changed}/10 corrections appliquées → ${filePath}`);
