const fs = require("fs");
const path = require("path");

const filePath = process.argv[2] || path.join(__dirname, "src", "App.jsx");
let code = fs.readFileSync(filePath, "utf8");
let changed = 0;

function replace(description, search, replacement) {
  if (!code.includes(search)) {
    console.error(`✗ NON TROUVÉ : ${description}`);
    return;
  }
  code = code.replace(search, replacement);
  changed++;
  console.log(`✓ ${description}`);
}

// ─────────────────────────────────────────────────────────────
// 1. MENTIONS — dropdown hors écran (bottom → top)
// ─────────────────────────────────────────────────────────────
replace(
  "Mentions : dropdown hors écran corrigé",
  `position:"fixed",bottom:Math.max(8,window.innerHeight-anchorRect.top+8),left:anchorRect.left,width:anchorRect.width,maxHeight:"50vh",overflowY:"auto",background:"rgba(10,10,10,0.98)",border:\`1px solid \${T.border}\`,borderRadius:16,overflow:"hidden",zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",animation:"scaleIn .15s ease"`,
  `position:"fixed",top:Math.min(anchorRect.bottom+8,window.innerHeight-220),left:anchorRect.left,width:anchorRect.width,maxHeight:200,overflowY:"auto",background:"rgba(10,10,10,0.98)",border:\`1px solid \${T.border}\`,borderRadius:16,overflow:"hidden",zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",animation:"scaleIn .15s ease"`
);

// ─────────────────────────────────────────────────────────────
// 2. STATUTS — durée fixe 10s → vraie durée vidéo (occurrence 1)
// ─────────────────────────────────────────────────────────────
replace(
  "Statuts durée vidéo réelle (occurrence 1 — useEffect)",
  `const duration=current.type==="text"?5000:10000;`,
  `const duration=current.type==="text"?5000:(isVideo&&videoRef.current?.duration?Math.min(videoRef.current.duration,90)*1000:10000);`
);

// ─────────────────────────────────────────────────────────────
// 3. STATUTS — durée fixe 10s → vraie durée vidéo (occurrence 2 togglePause)
// ─────────────────────────────────────────────────────────────
replace(
  "Statuts durée vidéo réelle (occurrence 2 — togglePause)",
  `const duration=current?.type==="text"?5000:10000;`,
  `const duration=current?.type==="text"?5000:(isVideo&&videoRef.current?.duration?Math.min(videoRef.current.duration,90)*1000:10000);`
);

// ─────────────────────────────────────────────────────────────
// 4. STATUTS — objectFit cover → contain pour les vidéos
// ─────────────────────────────────────────────────────────────
replace(
  "Statuts vidéo objectFit contain",
  `?<video ref={videoRef} src={current.mediaUrl} autoPlay playsInline muted={false} loop={false} preload="auto" onLoadedData={()=>setMediaReady(true)} onCanPlay={()=>setMediaReady(true)} onError={()=>setMediaReady(true)} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>`,
  `?<video ref={videoRef} src={current.mediaUrl} autoPlay playsInline muted={false} loop={false} preload="auto" onLoadedData={()=>setMediaReady(true)} onCanPlay={()=>setMediaReady(true)} onError={()=>setMediaReady(true)} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain",background:"#000"}}/>`
);

// ─────────────────────────────────────────────────────────────
// 5. STATUTS — upload vidéo silencieux : bloc video dans handlePick
// ─────────────────────────────────────────────────────────────
replace(
  "Statuts upload vidéo : vérif durée + upload direct si ≤90s",
  `if(f.size>25*1024*1024){alert("Vidéo max 25MB");return;}
      const src=await new Promise(res=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(f);});
      setStatusTrimFile(f);
      setStatusTrimSrc(src);
      return;`,
  `if(f.size>200*1024*1024){alert("Vidéo max 200MB");return;}
      const src=await new Promise(res=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(f);});
      const _vid=document.createElement("video");
      _vid.src=src;
      await new Promise(res=>{_vid.onloadedmetadata=res;_vid.onerror=res;setTimeout(res,3000);});
      if(_vid.duration>90){setStatusTrimFile(f);setStatusTrimSrc(src);return;}
      const r2=new FileReader();r2.onload=ev=>setPreview(ev.target.result);r2.readAsDataURL(f);
      setUploading(true);
      try{const publicUrl=await uploadToR2(f,"statuses");setMediaUrl(publicUrl);}catch(e){console.error("Erreur upload vidéo statut:",e);}
      setUploading(false);
      return;`
);

// ─────────────────────────────────────────────────────────────
// 6. STATUTS — ajouter VideoTrimModal dans le JSX de StatusCreatorModal
// ─────────────────────────────────────────────────────────────
replace(
  "Statuts : rendu VideoTrimModal dans StatusCreatorModal",
  `{cropSrc&&(
  <ImageCropModal
    imageSrc={cropSrc}
    onClose={()=>{setCropSrc(null);cropResolve?.fn(null);setCropResolve(null);}}
    onDone={file=>{setCropSrc(null);cropResolve?.fn(file);setCropResolve(null);}}
  />
)}`,
  `{statusTrimSrc&&<VideoTrimModal videoSrc={statusTrimSrc} onClose={()=>{setStatusTrimSrc(null);setStatusTrimFile(null);}} onDone={async trimmedFile=>{setStatusTrimSrc(null);setStatusTrimFile(null);if(!trimmedFile)return;const r=new FileReader();r.onload=ev=>setPreview(ev.target.result);r.readAsDataURL(trimmedFile);setUploading(true);try{const publicUrl=await uploadToR2(trimmedFile,"statuses");setMediaUrl(publicUrl);}catch(e){console.error("Erreur upload vidéo statut:",e);}setUploading(false);}}/>}
{cropSrc&&(
  <ImageCropModal
    imageSrc={cropSrc}
    onClose={()=>{setCropSrc(null);cropResolve?.fn(null);setCropResolve(null);}}
    onDone={file=>{setCropSrc(null);cropResolve?.fn(file);setCropResolve(null);}}
  />
)}`
);

// ─────────────────────────────────────────────────────────────
// 7. REELS — description trop basse (92px → 160px)
// ─────────────────────────────────────────────────────────────
replace(
  "Reels description bottom 92px → 160px",
  `bottom:"calc(92px + env(safe-area-inset-bottom,0px))"`,
  `bottom:"calc(160px + env(safe-area-inset-bottom,0px))"`
);

// ─────────────────────────────────────────────────────────────
// 8. REELS — boutons WhatsApp/lien trop bas (60px → 100px)
// ─────────────────────────────────────────────────────────────
replace(
  "Reels boutons WhatsApp/lien bottom 60px → 100px",
  `bottom:'calc(60px + env(safe-area-inset-bottom,0px))'`,
  `bottom:'calc(100px + env(safe-area-inset-bottom,0px))'`
);

// ─────────────────────────────────────────────────────────────
// 9. REELS — avatar sans position:relative → bouton + mal placé
// ─────────────────────────────────────────────────────────────
replace(
  "Reels avatar position:relative pour bouton +",
  `<div onClick={()=>onUser?.(post.by)} style={{width:46,height:46,borderRadius:"50%",background:"rgba(255,255,255,0.2)",overflow:"hidden",border:"2px solid #fff",cursor:"pointer"}}>{post.author?.avatar_url&&<img src={post.author.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>}</div>`,
  `<div onClick={()=>onUser?.(post.by)} style={{position:"relative",width:46,height:46,borderRadius:"50%",background:"rgba(255,255,255,0.2)",overflow:"visible",border:"2px solid #fff",cursor:"pointer"}}>{post.author?.avatar_url&&<img src={post.author.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}} alt=""/>}</div>`
);

// ─────────────────────────────────────────────────────────────
// Écriture du fichier
// ─────────────────────────────────────────────────────────────
fs.writeFileSync(filePath, code, "utf8");
console.log(`\n✅ ${changed}/9 corrections appliquées → ${filePath}`);
