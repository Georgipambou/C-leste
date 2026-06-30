import { useState, useRef, useEffect, useCallback } from "react";
import { X, RotateCcw, Type, Check, Trash2, RefreshCw, Images, Zap } from "lucide-react";

// ── FILTRES ────────────────────────────────────────────────
const FILTERS = [
  { id:"normal",  label:"Naturel",  css:"none" },
  { id:"vivid",   label:"Éclatant", css:"saturate(1.9) contrast(1.1)" },
  { id:"golden",  label:"Or",       css:"sepia(0.5) saturate(1.7) brightness(1.06)" },
  { id:"cold",    label:"Glacial",  css:"hue-rotate(18deg) saturate(1.3) brightness(0.96)" },
  { id:"noir",    label:"Noir",     css:"grayscale(1) contrast(1.35) brightness(0.88)" },
  { id:"fade",    label:"Fondu",    css:"brightness(1.12) contrast(0.82) saturate(0.65)" },
  { id:"warm",    label:"Chaud",    css:"sepia(0.3) saturate(1.5) brightness(1.07) hue-rotate(-12deg)" },
  { id:"drama",   label:"Drame",    css:"contrast(1.55) saturate(0.75) brightness(0.82)" },
  { id:"rose",    label:"Rose",     css:"hue-rotate(-22deg) saturate(1.6) brightness(1.04)" },
  { id:"matte",   label:"Mat",      css:"contrast(0.88) brightness(1.08) saturate(0.8) sepia(0.1)" },
];

const FONTS  = ["Space Grotesk","Cormorant Garamond","Arial","Georgia","Impact","Courier New"];
const COLORS = ["#FFFFFF","#C9952A","#FF4B6E","#00E5FF","#A8FF3E","#FF9500","#FF69B4","#000000"];
const SIZES  = [16,22,30,40,52];

// ── COMPOSANT ──────────────────────────────────────────────
export default function CameraStudioModal({ onClose, onDone }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const overlayRef  = useRef(null);
  const streamRef   = useRef(null);
  const recRef      = useRef(null);
  const chunksRef   = useRef([]);
  const rafRef      = useRef(null);
  const timerRef    = useRef(null);
  const dragRef     = useRef({ on:false, id:null, ox:0, oy:0 });
  const fileRef     = useRef(null);

  const [phase,      setPhase]      = useState("camera"); // camera | preview
  const [facing,     setFacing]     = useState("user");
  const [filter,     setFilter]     = useState("normal");
  const [recording,  setRecording]  = useState(false);
  const [secs,       setSecs]       = useState(0);
  const [blob,       setBlob]       = useState(null);
  const [url,        setUrl]        = useState(null);
  const [isVid,      setIsVid]      = useState(false);
  const [texts,      setTexts]      = useState([]);
  const [activeText, setActiveText] = useState(null);
  const [panel,      setPanel]      = useState(null); // null | "filter" | "text"

  // ── Caméra ─────────────────────────────────────────────
  const startCam = useCallback(async (f = facing) => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: f, width:{ideal:1920}, height:{ideal:1080} },
        audio: true,
      });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play(); }
    } catch(e) { console.error(e); }
  }, [facing]);

  useEffect(() => {
    startCam();
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(rafRef.current);
      clearInterval(timerRef.current);
    };
  }, []);

  // ── Canvas loop ─────────────────────────────────────────
  const drawLoop = useCallback(() => {
    const v = videoRef.current, c = canvasRef.current;
    if (v && c && v.readyState >= 2) {
      const ctx = c.getContext("2d");
      c.width  = v.videoWidth  || 720;
      c.height = v.videoHeight || 1280;
      const f = FILTERS.find(x => x.id === filter);
      ctx.filter = f?.css === "none" ? "none" : (f?.css || "none");
      ctx.drawImage(v, 0, 0, c.width, c.height);
      ctx.filter = "none";
    }
    rafRef.current = requestAnimationFrame(drawLoop);
  }, [filter]);

  useEffect(() => {
    if (phase === "camera") {
      rafRef.current = requestAnimationFrame(drawLoop);
      return () => cancelAnimationFrame(rafRef.current);
    }
  }, [phase, drawLoop]);

  // ── Flip ───────────────────────────────────────────────
  const flip = () => {
    const n = facing === "user" ? "environment" : "user";
    setFacing(n); startCam(n);
  };

  // ── Photo ──────────────────────────────────────────────
  const takePhoto = () => {
    canvasRef.current?.toBlob(b => {
      finish(b, URL.createObjectURL(b), false);
    }, "image/jpeg", 0.95);
  };

  // ── Vidéo ──────────────────────────────────────────────
  const startRec = () => {
    const c = canvasRef.current, s = streamRef.current;
    if (!c || !s) return;
    const cs = c.captureStream(30);
    s.getAudioTracks().forEach(t => cs.addTrack(t));
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9" : "video/webm";
    chunksRef.current = [];
    const r = new MediaRecorder(cs, { mimeType: mime });
    r.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    r.onstop = () => {
      const b = new Blob(chunksRef.current, { type: mime });
      finish(b, URL.createObjectURL(b), true);
    };
    recRef.current = r;
    r.start(100);
    setRecording(true); setSecs(0);
    timerRef.current = setInterval(() => setSecs(s => {
      if (s >= 59) { stopRec(); return 60; }
      return s + 1;
    }), 1000);
  };

  const stopRec = () => {
    if (recRef.current?.state !== "inactive") recRef.current.stop();
    setRecording(false); clearInterval(timerRef.current);
  };

  // ── Import galerie ─────────────────────────────────────
  const pickGallery = () => fileRef.current?.click();

  const onGalleryPick = async e => {
    const f = e.target.files?.[0]; if (!f) return;
    const u = URL.createObjectURL(f);
    const isV = f.type.startsWith("video/");
    finish(f, u, isV);
    e.target.value = "";
  };

  // ── Transition vers preview ────────────────────────────
  const finish = (b, u, v) => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setBlob(b); setUrl(u); setIsVid(v);
    setPhase("preview"); setPanel(null);
  };

  // ── Retake ─────────────────────────────────────────────
  const retake = () => {
    setBlob(null); setUrl(null); setTexts([]); setActiveText(null);
    setPhase("camera"); setRecording(false); setSecs(0); setPanel(null);
    startCam();
  };

  // ── Textes ─────────────────────────────────────────────
  const addText = () => {
    const t = { id:Date.now(), value:"Votre texte", color:"#FFFFFF", size:24, font:"Space Grotesk", x:40, y:200 };
    setTexts(ts => [...ts, t]); setActiveText(t); setPanel("text");
  };

  const upd = (id, patch) => {
    setTexts(ts => ts.map(t => t.id===id ? {...t,...patch} : t));
    setActiveText(at => at?.id===id ? {...at,...patch} : at);
  };

  const delText = id => {
    setTexts(ts => ts.filter(t => t.id!==id));
    setActiveText(null); setPanel(null);
  };

  // ── Drag ───────────────────────────────────────────────
  const pDown = (e, id) => {
    e.stopPropagation();
    dragRef.current = { on:true, id, ox: e.clientX-(texts.find(t=>t.id===id)?.x||0), oy: e.clientY-(texts.find(t=>t.id===id)?.y||0) };
    const mv = e2 => { if (!dragRef.current.on) return; setTexts(ts=>ts.map(t=>t.id===dragRef.current.id?{...t,x:e2.clientX-dragRef.current.ox,y:e2.clientY-dragRef.current.oy}:t)); };
    const up = () => { dragRef.current.on=false; window.removeEventListener("pointermove",mv); window.removeEventListener("pointerup",up); };
    window.addEventListener("pointermove",mv);
    window.addEventListener("pointerup",up);
  };

  // ── Export ─────────────────────────────────────────────
  const exportFinal = async () => {
    if (!blob) return;
    if (!isVid && texts.length > 0) {
      const img = new Image(); img.src = url;
      await new Promise(r => { img.onload = r; });
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const rect = overlayRef.current?.getBoundingClientRect();
      const sx = img.width / (rect?.width || 1);
      const sy = img.height / (rect?.height || 1);
      texts.forEach(t => {
        ctx.font        = `bold ${t.size*sx}px "${t.font}"`;
        ctx.fillStyle   = t.color;
        ctx.shadowColor = "rgba(0,0,0,0.7)";
        ctx.shadowBlur  = 10*sx;
        ctx.fillText(t.value, t.x*sx, t.y*sy);
      });
      c.toBlob(b => onDone({ file: new File([b],"celeste-photo.jpg",{type:"image/jpeg"}), type:"image" }), "image/jpeg", 0.95);
    } else {
      const ext = isVid ? "webm" : "jpg";
      const mime = isVid ? "video/webm" : "image/jpeg";
      onDone({ file: new File([blob],`celeste-media.${ext}`,{type:mime}), type: isVid?"video":"image" });
    }
  };

  // ── Filtre CSS actif ───────────────────────────────────
  const activeCss = FILTERS.find(f => f.id===filter)?.css || "none";

  // ── Secs formatés ─────────────────────────────────────
  const fmt = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  return (
    <div style={{position:"fixed",inset:0,zIndex:600,background:"#000",display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* Input galerie caché */}
      <input ref={fileRef} type="file" accept="image/*,video/*" style={{display:"none"}} onChange={onGalleryPick}/>

      {/* ── Zone visuelle plein écran ── */}
      <div style={{position:"relative",flex:1,overflow:"hidden"}}>

        {/* Canvas live */}
        <canvas ref={canvasRef} style={{
          width:"100%", height:"100%", objectFit:"cover",
          display: phase==="camera" ? "block" : "none",
          filter: activeCss === "none" ? undefined : activeCss,
        }}/>

        {/* Preview image */}
        {phase==="preview" && !isVid && (
          <img src={url} alt="" style={{
            width:"100%", height:"100%", objectFit:"cover", display:"block",
            filter: activeCss === "none" ? undefined : activeCss,
          }}/>
        )}

        {/* Preview vidéo */}
        {phase==="preview" && isVid && (
          <video src={url} autoPlay loop playsInline muted style={{
            width:"100%", height:"100%", objectFit:"cover", display:"block",
          }}/>
        )}

        {/* Video caméra (hidden, source pour canvas) */}
        <video ref={videoRef} playsInline muted style={{display:"none"}}/>

        {/* Overlay textes draggables */}
        {phase==="preview" && (
          <div ref={overlayRef} style={{position:"absolute",inset:0,pointerEvents:"auto"}}>
            {texts.map(t => (
              <div key={t.id}
                onPointerDown={e => pDown(e, t.id)}
                onClick={() => { setActiveText(t); setPanel("text"); }}
                style={{
                  position:"absolute", left:t.x, top:t.y,
                  fontFamily:`'${t.font}',sans-serif`,
                  fontSize:t.size, color:t.color,
                  fontWeight:700,
                  textShadow:"0 1px 12px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.6)",
                  cursor:"move", userSelect:"none", touchAction:"none",
                  whiteSpace:"pre", letterSpacing:"0.3px",
                }}>
                {t.value}
              </div>
            ))}
          </div>
        )}

        {/* Gradient top */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:140,
          background:"linear-gradient(to bottom,rgba(0,0,0,0.55) 0%,transparent 100%)",
          pointerEvents:"none"}}/>

        {/* Gradient bottom */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:260,
          background:"linear-gradient(to top,rgba(0,0,0,0.75) 0%,transparent 100%)",
          pointerEvents:"none"}}/>

        {/* ── Top bar ── */}
        <div style={{position:"absolute",top:0,left:0,right:0,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"52px 20px 0",zIndex:10}}>
          <button onClick={onClose} style={Ic()}><X size={18}/></button>
          <div style={{display:"flex",gap:10}}>
            {phase==="camera" && <button onClick={flip} style={Ic()}><RefreshCw size={17}/></button>}
            {phase==="preview" && <button onClick={addText} style={Ic()}><Type size={17}/></button>}
            {phase==="preview" && !isVid && (
              <button onClick={()=>setPanel(p=>p==="filter"?null:"filter")} style={Ic(panel==="filter")}>
                <Zap size={17}/>
              </button>
            )}
          </div>
        </div>

        {/* Timer REC */}
        {recording && (
          <div style={{position:"absolute",top:60,left:"50%",transform:"translateX(-50%)",
            background:"rgba(220,38,38,0.85)",borderRadius:20,padding:"5px 14px",
            fontSize:13,fontWeight:700,letterSpacing:1,
            display:"flex",alignItems:"center",gap:7,backdropFilter:"blur(10px)",zIndex:20}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#fff",animation:"pulse 1s infinite"}}/>
            {fmt(secs)}
          </div>
        )}
      </div>

      {/* ── Bas ── */}
      <div style={{position:"relative",zIndex:20,background:"transparent",paddingBottom:44}}>

        {/* Barre filtres */}
        {panel==="filter" && phase==="preview" && (
          <div style={{padding:"12px 0 8px",borderTop:"none"}}>
            <div style={{display:"flex",gap:10,overflowX:"auto",padding:"0 20px",scrollbarWidth:"none"}}>
              {FILTERS.map(f => {
                const on = f.id===filter;
                return (
                  <div key={f.id} onClick={()=>setFilter(f.id)}
                    style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0}}>
                    <div style={{
                      width:56,height:56,borderRadius:14,
                      overflow:"hidden",
                      border:`2px solid ${on?"#C9952A":"rgba(255,255,255,0.15)"}`,
                      background:"linear-gradient(135deg,#666,#333)",
                      filter: f.css==="none"?"none":f.css,
                      transition:"border-color .2s",
                    }}/>
                    <span style={{fontSize:10,color:on?"#C9952A":"rgba(255,255,255,0.5)",fontWeight:on?700:400,letterSpacing:.3}}>
                      {f.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Panel texte */}
        {panel==="text" && activeText && (
          <div style={{background:"rgba(10,10,10,0.96)",borderRadius:"22px 22px 0 0",padding:"20px 20px 8px",backdropFilter:"blur(24px)"}}>
            {/* Input */}
            <input
              value={activeText.value}
              onChange={e=>upd(activeText.id,{value:e.target.value})}
              placeholder="Votre texte…"
              autoFocus
              style={{width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:14,padding:"11px 16px",fontSize:16,outline:"none",marginBottom:14,fontFamily:`'${activeText.font}',sans-serif`,color:activeText.color}}
            />
            {/* Couleurs */}
            <div style={{display:"flex",gap:9,marginBottom:12}}>
              {COLORS.map(c=>(
                <div key={c} onClick={()=>upd(activeText.id,{color:c})}
                  style={{width:30,height:30,borderRadius:"50%",background:c,
                    border:`2.5px solid ${activeText.color===c?"#C9952A":"transparent"}`,
                    cursor:"pointer",transition:"border .15s",
                    boxShadow:"0 1px 4px rgba(0,0,0,0.4)"}}/>
              ))}
            </div>
            {/* Tailles */}
            <div style={{display:"flex",gap:7,marginBottom:12}}>
              {SIZES.map(s=>{
                const on=activeText.size===s;
                return (
                  <button key={s} onClick={()=>upd(activeText.id,{size:s})}
                    style={{flex:1,padding:"7px 0",borderRadius:10,
                      border:`1px solid ${on?"#C9952A":"rgba(255,255,255,0.12)"}`,
                      background:on?"rgba(201,149,42,0.15)":"rgba(255,255,255,0.04)",
                      color:on?"#C9952A":"rgba(255,255,255,0.5)",fontSize:12,cursor:"pointer",
                      fontWeight:on?700:400}}>
                    {s}
                  </button>
                );
              })}
            </div>
            {/* Polices */}
            <div style={{display:"flex",gap:7,overflowX:"auto",marginBottom:14,scrollbarWidth:"none"}}>
              {FONTS.map(f=>{
                const on=activeText.font===f;
                return (
                  <button key={f} onClick={()=>upd(activeText.id,{font:f})}
                    style={{flexShrink:0,padding:"6px 13px",borderRadius:20,
                      border:`1px solid ${on?"#C9952A":"rgba(255,255,255,0.12)"}`,
                      background:on?"rgba(201,149,42,0.15)":"rgba(255,255,255,0.04)",
                      color:on?"#C9952A":"rgba(255,255,255,0.5)",
                      fontSize:12,fontFamily:`'${f}',sans-serif`,cursor:"pointer",
                      fontWeight:on?700:400}}>
                    {f.split(" ")[0]}
                  </button>
                );
              })}
            </div>
            {/* Actions */}
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>delText(activeText.id)}
                style={{flex:1,padding:"11px",borderRadius:14,
                  border:"1px solid rgba(220,38,38,0.3)",background:"rgba(220,38,38,0.1)",
                  color:"#f87171",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontSize:13,fontWeight:600}}>
                <Trash2 size={14}/> Supprimer
              </button>
              <button onClick={()=>{setPanel(null);setActiveText(null);}}
                style={{flex:2,padding:"11px",borderRadius:14,border:"none",
                  background:"linear-gradient(135deg,#C9952A,#E8B84B)",
                  color:"#000",fontWeight:700,cursor:"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontSize:14}}>
                <Check size={15}/> Valider
              </button>
            </div>
          </div>
        )}

        {/* ── Boutons principaux ── */}
        {panel !== "text" && (
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-around",padding:"20px 40px 0"}}>

            {phase==="camera" && (
              <>
                {/* Galerie */}
                <button onClick={pickGallery} style={Ic()}>
                  <Images size={20}/>
                </button>

                {/* Déclencheur central */}
                {!recording
                  ? <button onPointerDown={takePhoto}
                      style={{width:74,height:74,borderRadius:"50%",
                        background:"#fff",border:"4px solid rgba(255,255,255,0.35)",
                        cursor:"pointer",flexShrink:0,
                        boxShadow:"0 0 0 2px rgba(255,255,255,0.1), 0 4px 24px rgba(0,0,0,0.5)"}}>
                      <div style={{width:"100%",height:"100%",borderRadius:"50%",background:"#fff"}}/>
                    </button>
                  : <button onClick={stopRec}
                      style={{width:74,height:74,borderRadius:"50%",
                        background:"rgba(220,38,38,0.2)",border:"4px solid #dc2626",
                        cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                        boxShadow:"0 0 20px rgba(220,38,38,0.4)"}}>
                      <div style={{width:24,height:24,borderRadius:5,background:"#dc2626"}}/>
                    </button>
                }

                {/* REC */}
                <button onClick={recording ? stopRec : startRec}
                  style={{...Ic(recording), border: recording?"1px solid #dc2626":"1px solid rgba(255,255,255,0.15)"}}>
                  <div style={{width:9,height:9,borderRadius:"50%",background:recording?"#dc2626":"#fff",marginRight:3}}/>
                  <span style={{fontSize:10,color:"#fff",fontWeight:700,letterSpacing:.5}}>{recording?"STOP":"REC"}</span>
                </button>
              </>
            )}

            {phase==="preview" && panel===null && (
              <>
                <button onClick={retake} style={Ic()}>
                  <RotateCcw size={18}/>
                </button>
                <button onClick={exportFinal}
                  style={{height:52,borderRadius:26,padding:"0 36px",border:"none",
                    background:"linear-gradient(135deg,#C9952A 0%,#E8B84B 100%)",
                    color:"#000",fontWeight:800,fontSize:15,cursor:"pointer",
                    display:"flex",alignItems:"center",gap:9,letterSpacing:.3,
                    boxShadow:"0 4px 20px rgba(201,149,42,0.45)"}}>
                  <Check size={17}/> Utiliser
                </button>
                <button onClick={()=>setPanel("filter")} style={Ic(panel==="filter")}>
                  <Zap size={18}/>
                </button>
              </>
            )}
          </div>
        )}

        {/* Barre filtres — phase caméra */}
        {phase==="camera" && panel!=="text" && (
          <div style={{marginTop:14,padding:"0 4px"}}>
            <div style={{display:"flex",gap:10,overflowX:"auto",padding:"0 20px",scrollbarWidth:"none"}}>
              {FILTERS.map(f=>{
                const on=f.id===filter;
                return (
                  <div key={f.id} onClick={()=>setFilter(f.id)}
                    style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer",flexShrink:0}}>
                    <div style={{
                      width:50,height:50,borderRadius:12,
                      background:"linear-gradient(135deg,#555,#222)",
                      border:`2px solid ${on?"#C9952A":"rgba(255,255,255,0.12)"}`,
                      filter:f.css==="none"?"none":f.css,
                      transition:"border-color .2s",
                    }}/>
                    <span style={{fontSize:9,color:on?"#C9952A":"rgba(255,255,255,0.4)",fontWeight:on?700:400,letterSpacing:.2}}>{f.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}

// ── Icône bouton helper ────────────────────────────────────
function Ic(active=false) {
  return {
    background: active ? "rgba(201,149,42,0.25)" : "rgba(255,255,255,0.1)",
    border: `1px solid ${active?"rgba(201,149,42,0.5)":"rgba(255,255,255,0.15)"}`,
    borderRadius:"50%", width:44, height:44,
    display:"flex", alignItems:"center", justifyContent:"center",
    cursor:"pointer", color: active?"#C9952A":"#fff",
    backdropFilter:"blur(12px)", flexShrink:0,
    transition:"all .2s",
  };
}
