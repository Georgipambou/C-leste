const fs = require("fs");
const path = "src/App.jsx";
let c = fs.readFileSync(path, "utf8");
let ok = 0, total = 0;

function apply(label, oldStr, newStr) {
  total++;
  if (c.includes(oldStr)) {
    c = c.replace(oldStr, newStr);
    ok++;
    console.log(`✓ ${label}`);
  } else {
    console.log(`✗ ${label} — introuvable (déjà appliqué ?)`);
  }
}

// === BUG 1 : Statut photo/vidéo illisible ===
// Le minuteur de progression démarrait immédiatement même si la vidéo
// n'avait pas fini de charger -> il passait au statut suivant avant
// que la vidéo apparaisse.

apply("1/8 état mediaReady",
`  const [hideUI,setHideUI]=useState(false);`,
`  const [hideUI,setHideUI]=useState(false);
  const [mediaReady,setMediaReady]=useState(false);`);

apply("2/8 calcul isVideo déplacé + reset mediaReady",
`  const current=(statuses||[])[idx];`,
`  const current=(statuses||[])[idx];
  const isVideo=current?.mediaUrl&&(/\\.(mp4|mov|webm|ogg|avi)(\\?|$)/i.test(current.mediaUrl)||current.mediaUrl.includes("video"));

  useEffect(()=>{
    setMediaReady(!isVideo);
    const fallback=setTimeout(()=>setMediaReady(true),8000);
    return()=>clearTimeout(fallback);
  },[current?.id,isVideo]);`);

apply("3/8 timer attend que la vidéo soit prête",
`    setPaused(false);setProgress(0);
    const duration=current.type==="text"?5000:10000;
    const step=100/(duration/50);
    progressRef.current=setInterval(()=>{
      setProgress(p=>{
        if(p>=100){clearInterval(progressRef.current);if(idx<(statuses||[]).length-1)setIdx(i=>i+1);else onClose();return 100;}
        return p+step;
      });
    },50);
    return()=>clearInterval(progressRef.current);
  },[current?.id,isMe,session?.user?.id,idx]);`,
`    setPaused(false);setProgress(0);
    if(!mediaReady)return;
    const duration=current.type==="text"?5000:10000;
    const step=100/(duration/50);
    progressRef.current=setInterval(()=>{
      setProgress(p=>{
        if(p>=100){clearInterval(progressRef.current);if(idx<(statuses||[]).length-1)setIdx(i=>i+1);else onClose();return 100;}
        return p+step;
      });
    },50);
    return()=>clearInterval(progressRef.current);
  },[current?.id,isMe,session?.user?.id,idx,mediaReady]);`);

apply("4/8 suppression de l'ancien isVideo dupliqué",
`  const liked=currentLikes.includes(session?.user?.id);
  const isVideo=current.mediaUrl&&(/\\.(mp4|mov|webm|ogg|avi)(\\?|$)/i.test(current.mediaUrl)||current.mediaUrl.includes("video"));`,
`  const liked=currentLikes.includes(session?.user?.id);`);

apply("5/8 vidéo signale son chargement + spinner",
`           {isVideo
  ?<video ref={videoRef} src={current.mediaUrl} autoPlay playsInline muted={false} loop={false} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
  :<img src={current.mediaUrl} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain",objectPosition:"center"}}/>
}`,
`           {isVideo
  ?<video ref={videoRef} src={current.mediaUrl} autoPlay playsInline muted={false} loop={false} preload="auto" onLoadedData={()=>setMediaReady(true)} onCanPlay={()=>setMediaReady(true)} onError={()=>setMediaReady(true)} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
  :<img src={current.mediaUrl} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain",objectPosition:"center"}}/>
}
            {isVideo&&!mediaReady&&(
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>
                <div style={{width:34,height:34,border:"3px solid rgba(255,255,255,0.2)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
              </div>
            )}`);

// === BUG 2 : Menu de mention (@) mal placé / invisible ===
// Il était positionné en absolute par rapport à un petit conteneur
// qui peut être coupé par un parent en overflow:hidden/auto.
// On le passe en position:fixed, ancré aux coordonnées réelles du
// champ de texte -> toujours visible, peu importe le contexte.

apply("6/8 état anchorRect",
`  const [cursorPos,setCursorPos]=useState(0);
  const ref=useRef();`,
`  const [cursorPos,setCursorPos]=useState(0);
  const [anchorRect,setAnchorRect]=useState(null);
  const ref=useRef();`);

apply("7/8 mesure de la position du champ texte",
`      setSuggestions(filtered);
      setShowSuggestions(filtered.length>0);`,
`      setSuggestions(filtered);
      setShowSuggestions(filtered.length>0);
      if(filtered.length>0&&ref.current)setAnchorRect(ref.current.getBoundingClientRect());`);

apply("8/8 menu en position fixed, toujours visible",
`      {showSuggestions&&(
        <div style={{position:"absolute",bottom:"auto",top:"auto",left:0,right:0,background:"rgba(10,10,10,0.98)",border:\`1px solid \${T.border}\`,borderRadius:16,overflow:"hidden",zIndex:100,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",animation:"scaleIn .15s ease",transform:"translateY(-105%)"}}>`,
`      {showSuggestions&&anchorRect&&(
        <div style={{position:"fixed",bottom:Math.max(8,window.innerHeight-anchorRect.top+8),left:anchorRect.left,width:anchorRect.width,maxHeight:"50vh",overflowY:"auto",background:"rgba(10,10,10,0.98)",border:\`1px solid \${T.border}\`,borderRadius:16,overflow:"hidden",zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",animation:"scaleIn .15s ease"}}>`);

fs.writeFileSync(path, c, "utf8");
console.log(`\n${ok}/${total} modifications appliquées.`);
