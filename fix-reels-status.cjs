const fs = require('fs');
const path = process.argv[2] || 'App.jsx';
let src = fs.readFileSync(path, 'utf8');
let report = [];

function replaceOnce(label, oldStr, newStr) {
  const count = src.split(oldStr).length - 1;
  if (count === 0) {
    report.push(`✗ ${label} : chaîne introuvable (déjà modifiée ou code différent ?)`);
    return;
  }
  if (count > 1) {
    report.push(`✗ ${label} : trouvé ${count} fois, attendu 1 — abandon pour éviter une mauvaise modif`);
    return;
  }
  src = src.replace(oldStr, newStr);
  report.push(`✓ ${label}`);
}

// ── FIX 1a : hauteur des items Reels en dvh ────────────────────────────────
replaceOnce(
  'Reels: 100vh -> 100dvh sur chaque slide',
  `return(<div key={post.id} style={{height:"100vh",width:"100%",scrollSnapAlign:"start",position:"relative",display:"flex",alignItems:"center",justifyContent:"center",background:"#000",flexShrink:0,overflow:"hidden"}}>`,
  `return(<div key={post.id} style={{height:"100dvh",width:"100%",scrollSnapAlign:"start",position:"relative",display:"flex",alignItems:"center",justifyContent:"center",background:"#000",flexShrink:0,overflow:"hidden"}}>`
);

// ── FIX 1b : scroll initial basé sur la hauteur réelle du conteneur ────────
replaceOnce(
  'Reels: scrollTo initial basé sur el.clientHeight',
  `useEffect(()=>{const el=containerRef.current;if(el)el.scrollTo({top:startIndex*window.innerHeight,behavior:"auto"});},[]);`,
  `useEffect(()=>{const el=containerRef.current;if(el)el.scrollTo({top:startIndex*el.clientHeight,behavior:"auto"});},[]);`
);

// ── FIX 1c : calcul de l'index actif basé sur la hauteur réelle ───────────
replaceOnce(
  'Reels: handleScroll basé sur el.clientHeight',
  `const handleScroll=()=>{if(scrollTimeout.current)clearTimeout(scrollTimeout.current);scrollTimeout.current=setTimeout(()=>{const el=containerRef.current;if(!el)return;const idx=Math.round(el.scrollTop/window.innerHeight);if(idx!==activeIdx){setActiveIdx(idx);setExpandedCaption(false);}},80);};`,
  `const handleScroll=()=>{if(scrollTimeout.current)clearTimeout(scrollTimeout.current);scrollTimeout.current=setTimeout(()=>{const el=containerRef.current;if(!el)return;const idx=Math.round(el.scrollTop/el.clientHeight);if(idx!==activeIdx){setActiveIdx(idx);setExpandedCaption(false);}},80);};`
);

// ── FIX 2a : remplacer les states cassés du trim vidéo statut ─────────────
replaceOnce(
  'StatusCreatorModal: remplacement des states statusTrimSrc/File par videoTrimSrc',
  `const [statusTrimSrc,setStatusTrimSrc]=useState(null);
const [statusTrimFile,setStatusTrimFile]=useState(null);`,
  `const [videoTrimSrc,setVideoTrimSrc]=useState(null);`
);

// ── FIX 2b : réparer le flux vidéo (trim + upload réel) ────────────────────
replaceOnce(
  'StatusCreatorModal: flux vidéo complet (trim modal + upload R2 + mediaUrl)',
  `    if(f.type.startsWith("video/")){
      if(f.size>25*1024*1024){alert("Vidéo max 25MB");return;}
      const src=await new Promise(res=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(f);});
      setStatusTrimFile(f);
      setStatusTrimSrc(src);
      return;
    }`,
  `    if(f.type.startsWith("video/")){
      if(f.size>25*1024*1024){alert("Vidéo max 25MB");return;}
      const src=await new Promise(res=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(f);});
      const trimData=await new Promise(resolve=>setVideoTrimSrc({src,resolve}));
      setVideoTrimSrc(null);
      if(!trimData)return;
      setPreview(trimData.src);
      setUploading(true);
      try{
        const publicUrl=await uploadToR2(f,"statuses");
        setMediaUrl(publicUrl);
      }catch(err){
        console.error("Erreur upload statut vidéo:",err);
      }
      setUploading(false);
      return;
    }`
);

// ── FIX 2c : rendre le VideoTrimModal dans le JSX du composant ────────────
replaceOnce(
  'StatusCreatorModal: rendu du <VideoTrimModal> avant ImageCropModal',
  `  return(
    <>
{cropSrc&&(
  <ImageCropModal
    imageSrc={cropSrc}
    onClose={()=>{setCropSrc(null);cropResolve?.fn(null);setCropResolve(null);}}
    onDone={file=>{setCropSrc(null);cropResolve?.fn(file);setCropResolve(null);}}
  />
)}
    <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.9)",backdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>`,
  `  return(
    <>
{videoTrimSrc&&<VideoTrimModal
  videoSrc={videoTrimSrc.src}
  onClose={()=>{setVideoTrimSrc(null);videoTrimSrc.resolve(null);}}
  onDone={data=>{videoTrimSrc.resolve(data);}}
/>}
{cropSrc&&(
  <ImageCropModal
    imageSrc={cropSrc}
    onClose={()=>{setCropSrc(null);cropResolve?.fn(null);setCropResolve(null);}}
    onDone={file=>{setCropSrc(null);cropResolve?.fn(file);setCropResolve(null);}}
  />
)}
    <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.9)",backdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>`
);

fs.writeFileSync(path, src, 'utf8');
console.log(report.join('\n'));
console.log('\nTerminé.');
