import { useState, useRef, useEffect, useCallback } from "react";
import { X, Type, Image as ImageIcon, Check, RefreshCw, ChevronDown, ZapOff, Zap } from "lucide-react";
import * as PIXI from "pixi.js";
import { ColorMatrixFilter } from "pixi.js";

// â”€â”€ LUT FILTERS (matrices ColorMatrix pro) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const FILTERS = [
  {
    id:"normal", label:"Original",
    matrix: null,
  },
  {
    id:"vivid", label:"Vivid",
    matrix: (f) => { f.saturate(0.8,true); f.brightness(1.05,true); f.contrast(0.15,true); },
  },
  {
    id:"golden", label:"Golden",
    matrix: (f) => { f.sepia(true); f.saturate(0.5,true); f.colorTone(0xC9952A, 0.3, 0x000000, 0.0, true); f.brightness(1.05,true); },
  },
  {
    id:"arctic", label:"Arctic",
    matrix: (f) => { f.saturate(0.3,true); f.contrast(0.1,true); f.brightness(1.02,true); f.hue(15,true); },
  },
  {
    id:"noir", label:"Noir",
    matrix: (f) => { f.greyscale(0.9,true); f.contrast(0.3,true); f.brightness(0.9,true); },
  },
  {
    id:"warm", label:"Warm",
    matrix: (f) => { f.warmth && f.warmth(true); f.saturate(0.4,true); f.colorTone(0xFF6B35,0.2,0x000000,0.0,true); f.brightness(1.03,true); },
  },
  {
    id:"fade", label:"Fade",
    matrix: (f) => { f.brightness(1.1,true); f.contrast(-0.2,true); f.saturate(-0.4,true); },
  },
  {
    id:"drama", label:"Drama",
    matrix: (f) => { f.contrast(0.4,true); f.saturate(-0.3,true); f.brightness(0.85,true); },
  },
  {
    id:"rose", label:"RosÃ©",
    matrix: (f) => { f.hue(-20,true); f.saturate(0.5,true); f.brightness(1.04,true); f.colorTone(0xFF69B4,0.15,0x000000,0.0,true); },
  },
  {
    id:"cinema", label:"CinÃ©ma",
    matrix: (f) => { f.contrast(0.25,true); f.saturate(-0.5,true); f.brightness(0.83,true); f.sepia(true); f.colorTone(0x8B4513,0.1,0x000000,0.0,true); },
  },
  {
    id:"neon", label:"Neon",
    matrix: (f) => { f.saturate(1.5,true); f.contrast(0.2,true); f.hue(10,true); f.brightness(1.05,true); },
  },
  {
    id:"matte", label:"Matte",
    matrix: (f) => { f.contrast(-0.15,true); f.brightness(1.08,true); f.saturate(-0.2,true); },
  },
];

// CSS fallback pour les previews miniatures (Pixi trop lourd pour 12 instances)
const PREVIEW_CSS = {
  normal:  "none",
  vivid:   "saturate(1.9) contrast(1.15) brightness(1.05)",
  golden:  "sepia(0.5) saturate(1.7) brightness(1.06) contrast(1.05)",
  arctic:  "hue-rotate(15deg) saturate(1.3) brightness(1.02) contrast(1.1)",
  noir:    "grayscale(1) contrast(1.4) brightness(0.88)",
  warm:    "sepia(0.25) saturate(1.5) brightness(1.06) hue-rotate(-10deg)",
  fade:    "brightness(1.12) contrast(0.78) saturate(0.55)",
  drama:   "contrast(1.55) saturate(0.68) brightness(0.8)",
  rose:    "hue-rotate(-22deg) saturate(1.7) brightness(1.05)",
  cinema:  "contrast(1.25) saturate(0.4) brightness(0.82) sepia(0.3)",
  neon:    "saturate(2.2) contrast(1.2) hue-rotate(10deg) brightness(1.05)",
  matte:   "contrast(0.85) brightness(1.1) saturate(0.78)",
};

const FONTS  = ["Space Grotesk","Cormorant Garamond","Arial Black","Georgia","Impact","Courier New"];
const COLORS = ["#FFFFFF","#000000","#C9952A","#FF4B6E","#00E5FF","#A8FF3E","#FF9500","#FF69B4"];
const SIZES  = [16,22,30,40,52];
const MODES  = ["60 s","15 s","PHOTO"];

// â”€â”€ COMPOSANT PRINCIPAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function CameraStudioModal({ onClose, onDone }) {
  const videoRef    = useRef(null);
  const mountRef    = useRef(null);   // conteneur Pixi
  const pixiApp     = useRef(null);
  const pixiSprite  = useRef(null);
  const pixiFilter  = useRef(null);
  const canvasCap   = useRef(null);   // canvas pour capture
  const overlayRef  = useRef(null);
  const streamRef   = useRef(null);
  const recRef      = useRef(null);
  const chunksRef   = useRef([]);
  const timerRef    = useRef(null);
  const fileRef     = useRef(null);
  const imgRef      = useRef(null);
  const dragRef     = useRef({ on:false, id:null, ox:0, oy:0 });

  const [phase,      setPhase]      = useState("camera");
  const [facing,     setFacing]     = useState("user");
  const [filter,     setFilter]     = useState("normal");
  const [mode,       setMode]       = useState("60 s");
  const [recording,  setRecording]  = useState(false);
  const [secs,       setSecs]       = useState(0);
  const [blob,       setBlob]       = useState(null);
  const [url,        setUrl]        = useState(null);
  const [isVid,      setIsVid]      = useState(false);
  const [overlays,   setOverlays]   = useState([]);
  const [activeOv,   setActiveOv]   = useState(null);
  const [panel,      setPanel]      = useState(null);
  const [showFilters,setShowFilters]= useState(false);
  const [newText,    setNewText]    = useState("");
  const [txtColor,   setTxtColor]   = useState("#FFFFFF");
  const [txtSize,    setTxtSize]    = useState(24);
  const [txtFont,    setTxtFont]    = useState("Space Grotesk");
  const [pixiReady,  setPixiReady]  = useState(false);
  const [flashOn,    setFlashOn]    = useState(false);

  // â”€â”€ CamÃ©ra â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const startCam = useCallback(async (f = facing) => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const constraints = {
        video: { facingMode: f, width:{ideal:1920}, height:{ideal:1080} },
        audio: true,
      };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = s;
      const v = videoRef.current;
      if (v) { v.srcObject = s; await v.play(); }
    } catch(e) { console.error("Cam:", e); }
  }, [facing]);

  useEffect(() => {
    startCam();
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      clearInterval(timerRef.current);
      destroyPixi();
    };
  }, []);

  // â”€â”€ Init Pixi â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const initPixi = useCallback(async () => {
    const v = videoRef.current;
    const mount = mountRef.current;
    if (!v || !mount || pixiApp.current) return;
    if (v.readyState < 2 || !v.videoWidth) return;

    try {
      const app = new PIXI.Application();
      await app.init({
        width:  mount.clientWidth  || 390,
        height: mount.clientHeight || 844,
        backgroundAlpha: 0,
        antialias: true,
        resolution: 1,
      });
      mount.appendChild(app.canvas);
      app.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;";

      const tex = PIXI.Texture.from(v);
      const sprite = new PIXI.Sprite(tex);
      sprite.width  = app.screen.width;
      sprite.height = app.screen.height;
      app.stage.addChild(sprite);

      const cmFilter = new ColorMatrixFilter();
      sprite.filters = [cmFilter];

      pixiApp.current    = app;
      pixiSprite.current = sprite;
      pixiFilter.current = cmFilter;

      app.ticker.add(() => {
        tex.source.update();
        sprite.width  = app.screen.width;
        sprite.height = app.screen.height;
      });

      setPixiReady(true);
    } catch(e) {
      console.error("Pixi init:", e);
    }
  }, []);

  const destroyPixi = () => {
    if (pixiApp.current) {
      try { pixiApp.current.destroy(true, { children:true, texture:true }); } catch(e){}
      pixiApp.current    = null;
      pixiSprite.current = null;
      pixiFilter.current = null;
      setPixiReady(false);
    }
  };

  useEffect(() => {
    if (phase !== "camera") return;
    const v = videoRef.current;
    if (!v) return;
    const tryInit = () => { if (v.videoWidth > 0) initPixi(); };
    if (v.readyState >= 2 && v.videoWidth > 0) { setTimeout(initPixi, 300); }
    else { v.addEventListener("loadeddata", tryInit, {once:true}); }
    return () => v.removeEventListener("loadeddata", tryInit);
  }, [phase, initPixi]);

  // â”€â”€ Appliquer filtre Pixi â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const f = pixiFilter.current;
    if (!f) return;
    f.reset();
    const def = FILTERS.find(x => x.id === filter);
    if (def?.matrix) {
      try { def.matrix(f); } catch(e) { console.warn("Filter apply:", e); }
    }
  }, [filter, pixiReady]);

  // â”€â”€ Flip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const flip = () => {
    const n = facing === "user" ? "environment" : "user";
    setFacing(n);
    destroyPixi();
    setTimeout(() => startCam(n).then(() => setTimeout(initPixi, 500)), 100);
  };

  // â”€â”€ Capture photo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const takePhoto = useCallback(() => {
    // Essai 1 : depuis le canvas Pixi
    const pixiCanvas = pixiApp.current?.canvas;
    if (pixiCanvas) {
      pixiCanvas.toBlob(b => {
        if (b) finish(b, URL.createObjectURL(b), false);
        else captureFallback();
      }, "image/jpeg", 0.95);
      return;
    }
    captureFallback();
  }, []);

  const captureFallback = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    const ctx = c.getContext("2d");
    const css = PREVIEW_CSS[filter] || "none";
    if (css !== "none") ctx.filter = css;
    ctx.drawImage(v, 0, 0);
    c.toBlob(b => { if(b) finish(b, URL.createObjectURL(b), false); }, "image/jpeg", 0.95);
  };

  // â”€â”€ Enregistrement vidÃ©o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const startRec = () => {
    const pixiCanvas = pixiApp.current?.canvas;
    const s = streamRef.current;
    if (!pixiCanvas || !s) return;
    const cs = pixiCanvas.captureStream(30);
    s.getAudioTracks().forEach(t => cs.addTrack(t));
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    chunksRef.current = [];
    const r = new MediaRecorder(cs, { mimeType: mime });
    r.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    r.onstop = () => {
      const b = new Blob(chunksRef.current, { type: mime });
      finish(b, URL.createObjectURL(b), true);
    };
    recRef.current = r; r.start(100);
    setRecording(true); setSecs(0);
    const max = mode==="15 s"?15:60;
    timerRef.current = setInterval(() => setSecs(prev => {
      if (prev >= max-1) { stopRec(); return max; }
      return prev+1;
    }), 1000);
  };

  const stopRec = () => {
    if (recRef.current?.state !== "inactive") recRef.current?.stop();
    setRecording(false); clearInterval(timerRef.current);
  };

  // â”€â”€ Galerie â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const pickGallery = () => fileRef.current?.click();
  const onGalleryPick = e => {
    const f = e.target.files?.[0]; if (!f) return;
    finish(f, URL.createObjectURL(f), f.type.startsWith("video/"));
    e.target.value = "";
  };

  const pickOverlayImg = () => imgRef.current?.click();
  const onOverlayImg = e => {
    const f = e.target.files?.[0]; if (!f) return;
    addOverlay({ type:"image", value:URL.createObjectURL(f), size:100 });
    e.target.value = ""; setPanel(null);
  };

  // â”€â”€ Finish â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const finish = (b, u, v) => {
    destroyPixi();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setBlob(b); setUrl(u); setIsVid(v);
    setPhase("preview"); setPanel(null); setShowFilters(false);
  };

  const retake = () => {
    setBlob(null); setUrl(null); setOverlays([]); setActiveOv(null);
    setPhase("camera"); setRecording(false); setSecs(0); setPanel(null); setShowFilters(false);
    startCam().then(() => setTimeout(initPixi, 500));
  };

  // â”€â”€ Overlays â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addOverlay = (patch) => {
    const ov = { id:Date.now(), type:"text", value:"", x:60, y:180, size:24, color:"#FFFFFF", font:"Space Grotesk", ...patch };
    setOverlays(os => [...os, ov]); setActiveOv(ov);
  };
  const updOv = (id, p) => {
    setOverlays(os => os.map(o => o.id===id?{...o,...p}:o));
    setActiveOv(ao => ao?.id===id?{...ao,...p}:ao);
  };
  const delOv = id => { setOverlays(os=>os.filter(o=>o.id!==id)); setActiveOv(null); setPanel(null); };

  // â”€â”€ Drag â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const pDown = (e, id) => {
    e.stopPropagation();
    const ov = overlays.find(o=>o.id===id);
    dragRef.current = {on:true,id,ox:e.clientX-(ov?.x||0),oy:e.clientY-(ov?.y||0)};
    const mv = e2 => {
      if (!dragRef.current.on) return;
      setOverlays(os=>os.map(o=>o.id===dragRef.current.id?{...o,x:e2.clientX-dragRef.current.ox,y:e2.clientY-dragRef.current.oy}:o));
    };
    const up = ()=>{dragRef.current.on=false;window.removeEventListener("pointermove",mv);window.removeEventListener("pointerup",up);};
    window.addEventListener("pointermove",mv); window.addEventListener("pointerup",up);
  };

  const confirmText = () => {
    if (!newText.trim()) { setPanel(null); return; }
    if (activeOv?.type==="text" && activeOv?.id) {
      updOv(activeOv.id, {value:newText,color:txtColor,size:txtSize,font:txtFont});
    } else {
      addOverlay({type:"text",value:newText,color:txtColor,size:txtSize,font:txtFont});
    }
    setNewText(""); setPanel(null); setActiveOv(null);
  };

  // â”€â”€ Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const exportFinal = async () => {
    if (!blob) return;
    if (!isVid && overlays.length > 0) {
      const img = new Image(); img.src = url;
      await new Promise(r=>{img.onload=r;});
      const c = document.createElement("canvas");
      c.width=img.width; c.height=img.height;
      const ctx=c.getContext("2d");
      const css = PREVIEW_CSS[filter]||"none";
      if (css!=="none") ctx.filter=css;
      ctx.drawImage(img,0,0); ctx.filter="none";
      const rect = overlayRef.current?.getBoundingClientRect();
      const sx=img.width/(rect?.width||1), sy=img.height/(rect?.height||1);
      for (const ov of overlays) {
        if (ov.type==="text") {
          ctx.font=`bold ${ov.size*sx}px "${ov.font}"`;
          ctx.fillStyle=ov.color; ctx.shadowColor="rgba(0,0,0,0.85)"; ctx.shadowBlur=10*sx;
          ctx.fillText(ov.value, ov.x*sx, ov.y*sy);
        } else if (ov.type==="image") {
          const oi=new Image(); oi.src=ov.value;
          await new Promise(r=>{oi.onload=r;});
          ctx.drawImage(oi,ov.x*sx,ov.y*sy,ov.size*sx,ov.size*sy);
        }
      }
      c.toBlob(b=>onDone({file:new File([b],"celeste-photo.jpg",{type:"image/jpeg"}),type:"image"}),"image/jpeg",0.95);
    } else {
      const ext=isVid?"webm":"jpg";
      onDone({file:new File([blob],`celeste.${ext}`,{type:isVid?"video/webm":"image/jpeg"}),type:isVid?"video":"image"});
    }
  };

  const fmt = s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const maxSecs = mode==="15 s"?15:60;
  const progress = recording ? (secs/maxSecs)*100 : 0;

  return (
    <div style={{position:"fixed",inset:0,zIndex:600,background:"#000",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <input ref={fileRef} type="file" accept="image/*,video/*" style={{display:"none"}} onChange={onGalleryPick}/>
      <input ref={imgRef}  type="file" accept="image/*" style={{display:"none"}} onChange={onOverlayImg}/>
      <video ref={videoRef} playsInline muted style={{display:"none"}}/>

      {/* â”€â”€ Zone visuelle â”€â”€ */}
      <div style={{position:"relative",flex:1,overflow:"hidden"}}>

        {/* Pixi mount (camÃ©ra live avec filtres WebGL) */}
        <div ref={mountRef} style={{
          position:"absolute",inset:0,
          display: phase==="camera" ? "block" : "none",
        }}/>

        {/* Preview image */}
        {phase==="preview" && !isVid && (
          <img src={url} alt="" style={{
            position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",
            filter: (PREVIEW_CSS[filter]&&PREVIEW_CSS[filter]!=="none") ? PREVIEW_CSS[filter] : undefined,
          }}/>
        )}

        {/* Preview vidÃ©o */}
        {phase==="preview" && isVid && (
          <video src={url} autoPlay loop playsInline muted style={{
            position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",
          }}/>
        )}

        {/* Overlays */}
        {phase==="preview" && (
          <div ref={overlayRef} style={{position:"absolute",inset:0,pointerEvents:"auto"}}>
            {overlays.map(ov=>(
              <div key={ov.id} onPointerDown={e=>pDown(e,ov.id)}
                onClick={()=>{
                  setActiveOv(ov);
                  if(ov.type==="text"){setNewText(ov.value);setTxtColor(ov.color);setTxtSize(ov.size);setTxtFont(ov.font);setPanel("text");}
                }}
                style={{position:"absolute",left:ov.x,top:ov.y,cursor:"move",userSelect:"none",touchAction:"none"}}>
                {ov.type==="text" && (
                  <span style={{fontFamily:`'${ov.font}',sans-serif`,fontSize:ov.size,color:ov.color,fontWeight:700,
                    textShadow:"0 2px 14px rgba(0,0,0,0.95)",whiteSpace:"pre",display:"block"}}>
                    {ov.value}
                  </span>
                )}
                {ov.type==="image" && (
                  <img src={ov.value} style={{width:ov.size,height:ov.size,objectFit:"contain",borderRadius:8,pointerEvents:"none"}}/>
                )}
                {activeOv?.id===ov.id && (
                  <button onClick={e=>{e.stopPropagation();delOv(ov.id);}}
                    style={{position:"absolute",top:-10,right:-10,width:22,height:22,borderRadius:"50%",
                      background:"#dc2626",border:"none",color:"#fff",fontSize:14,cursor:"pointer",
                      display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,fontWeight:700}}>Ã—</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Gradients */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:180,background:"linear-gradient(to bottom,rgba(0,0,0,0.65),transparent)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:320,background:"linear-gradient(to top,rgba(0,0,0,0.75),transparent)",pointerEvents:"none"}}/>

        {/* Barre progression REC */}
        {recording && (
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,zIndex:30,background:"rgba(255,255,255,0.1)"}}>
            <div style={{height:"100%",width:`${progress}%`,background:"linear-gradient(to right,#ff4b6e,#dc2626)",transition:"width 1s linear"}}/>
          </div>
        )}

        {/* Timer */}
        {recording && (
          <div style={{position:"absolute",top:60,left:"50%",transform:"translateX(-50%)",
            background:"rgba(220,38,38,0.9)",borderRadius:20,padding:"5px 16px",
            color:"#fff",fontSize:13,fontWeight:700,letterSpacing:1,
            display:"flex",alignItems:"center",gap:8,zIndex:20,backdropFilter:"blur(8px)"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#fff"}}/>
            {fmt(secs)}
          </div>
        )}

        {/* â”€â”€ Top bar â”€â”€ */}
        <div style={{position:"absolute",top:0,left:0,right:0,display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"52px 16px 0",zIndex:20}}>
          <button onClick={onClose} style={Ic()}><X size={18}/></button>

          {/* Outils droite â€” camÃ©ra */}
          {phase==="camera" && !recording && (
            <div style={{display:"flex",flexDirection:"column",gap:16,alignItems:"center"}}>
              <button onClick={flip} style={Ic()}><RefreshCw size={16}/></button>
              <button onClick={()=>setFlashOn(f=>!f)} style={Ic(flashOn)}>
                {flashOn ? <Zap size={16}/> : <ZapOff size={16}/>}
              </button>
              <button onClick={()=>setShowFilters(s=>!s)} style={Ic(showFilters)}>
                <span style={{fontSize:15}}>âœ¦</span>
              </button>
              <button onClick={pickOverlayImg} style={Ic()}><ImageIcon size={16}/></button>
            </div>
          )}

          {/* Outils droite â€” preview */}
          {phase==="preview" && (
            <div style={{display:"flex",flexDirection:"column",gap:14,alignItems:"center"}}>
              <button onClick={()=>{setNewText("");setActiveOv(null);setPanel("text");}} style={Ic(panel==="text")}><Type size={16}/></button>
              <button onClick={pickOverlayImg} style={Ic()}><ImageIcon size={16}/></button>
              {!isVid && <button onClick={()=>setShowFilters(s=>!s)} style={Ic(showFilters)}><span style={{fontSize:15}}>âœ¦</span></button>}
            </div>
          )}
        </div>

        {/* â”€â”€ Barre filtres â”€â”€ */}
        {showFilters && (
          <div style={{position:"absolute",bottom: phase==="camera" ? 200 : 110,left:0,right:0,zIndex:15,paddingBottom:8}}>
            <div style={{display:"flex",gap:12,overflowX:"auto",padding:"4px 16px",scrollbarWidth:"none"}}>
              {FILTERS.map(f=>{
                const on=f.id===filter;
                const css=PREVIEW_CSS[f.id]||"none";
                return (
                  <div key={f.id} onClick={()=>setFilter(f.id)}
                    style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0}}>
                    <div style={{
                      width:62,height:62,borderRadius:16,overflow:"hidden",
                      border:`2.5px solid ${on?"#C9952A":"rgba(255,255,255,0.18)"}`,
                      boxShadow: on?"0 0 12px rgba(201,149,42,0.5)":"none",
                      transition:"border .2s,box-shadow .2s",
                      position:"relative",
                    }}>
                      {phase==="preview" && url && !isVid
                        ? <img src={url} style={{width:"100%",height:"100%",objectFit:"cover",filter:css!=="none"?css:undefined}}/>
                        : <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#555 0%,#222 100%)",filter:css!=="none"?css:undefined}}/>
                      }
                    </div>
                    <span style={{fontSize:10,color:on?"#C9952A":"rgba(255,255,255,0.5)",fontWeight:on?700:400,letterSpacing:.3}}>
                      {f.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* â”€â”€ Zone bas â”€â”€ */}
      <div style={{position:"relative",zIndex:20,paddingBottom:40}}>

        {/* Panel texte */}
        {panel==="text" && (
          <div style={{background:"rgba(6,6,6,0.97)",borderRadius:"24px 24px 0 0",padding:"20px 18px 10px",backdropFilter:"blur(30px)"}}>
            <input value={newText} onChange={e=>setNewText(e.target.value)}
              placeholder="Votre texteâ€¦" autoFocus
              style={{width:"100%",background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,
                padding:"12px 16px",color:txtColor,
                fontSize:Math.min(txtSize,22),fontFamily:`'${txtFont}',sans-serif`,
                fontWeight:700,outline:"none",marginBottom:14,letterSpacing:.3}}/>
            {/* Couleurs */}
            <div style={{display:"flex",gap:9,marginBottom:12}}>
              {COLORS.map(c=>(
                <div key={c} onClick={()=>setTxtColor(c)}
                  style={{width:30,height:30,borderRadius:"50%",background:c,cursor:"pointer",flexShrink:0,
                    border:`2.5px solid ${txtColor===c?"#C9952A":"rgba(255,255,255,0.08)"}`,
                    transition:"border .15s",boxShadow:"0 1px 6px rgba(0,0,0,0.6)"}}/>
              ))}
            </div>
            {/* Tailles */}
            <div style={{display:"flex",gap:7,marginBottom:11}}>
              {SIZES.map(s=>{
                const on=txtSize===s;
                return <button key={s} onClick={()=>setTxtSize(s)}
                  style={{flex:1,padding:"7px 0",borderRadius:11,cursor:"pointer",fontWeight:on?700:400,fontSize:11,
                    border:`1px solid ${on?"#C9952A":"rgba(255,255,255,0.08)"}`,
                    background:on?"rgba(201,149,42,0.15)":"rgba(255,255,255,0.03)",
                    color:on?"#C9952A":"rgba(255,255,255,0.4)"}}>
                  {s}
                </button>;
              })}
            </div>
            {/* Polices */}
            <div style={{display:"flex",gap:7,overflowX:"auto",marginBottom:14,scrollbarWidth:"none"}}>
              {FONTS.map(f=>{
                const on=txtFont===f;
                return <button key={f} onClick={()=>setTxtFont(f)}
                  style={{flexShrink:0,padding:"6px 14px",borderRadius:20,cursor:"pointer",
                    border:`1px solid ${on?"#C9952A":"rgba(255,255,255,0.08)"}`,
                    background:on?"rgba(201,149,42,0.15)":"rgba(255,255,255,0.03)",
                    color:on?"#C9952A":"rgba(255,255,255,0.4)",
                    fontSize:12,fontFamily:`'${f}',sans-serif`,fontWeight:on?700:400}}>
                  {f.split(" ")[0]}
                </button>;
              })}
            </div>
            {/* Actions */}
            <div style={{display:"flex",gap:9}}>
              <button onClick={()=>{setPanel(null);setActiveOv(null);}}
                style={{flex:1,padding:"12px",borderRadius:15,border:"1px solid rgba(255,255,255,0.08)",
                  background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.45)",cursor:"pointer",fontSize:13}}>
                Annuler
              </button>
              <button onClick={confirmText}
                style={{flex:2,padding:"12px",borderRadius:15,border:"none",
                  background:"linear-gradient(135deg,#C9952A 0%,#E8B84B 100%)",
                  color:"#000",fontWeight:800,fontSize:14,cursor:"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                  boxShadow:"0 3px 16px rgba(201,149,42,0.4)"}}>
                <Check size={15}/> Ajouter
              </button>
            </div>
          </div>
        )}

        {/* Boutons principaux */}
        {!panel && (
          <>
            {phase==="camera" && (
              <>
                {/* SÃ©lecteur mode */}
                <div style={{display:"flex",justifyContent:"center",gap:4,paddingTop:14,paddingBottom:10}}>
                  {MODES.map(m=>{
                    const on=m===mode;
                    return (
                      <button key={m} onClick={()=>setMode(m)}
                        style={{background:on?"rgba(255,255,255,0.15)":"transparent",
                          border:on?"1px solid rgba(255,255,255,0.25)":"1px solid transparent",
                          borderRadius:22,padding:"5px 16px",
                          color:on?"#fff":"rgba(255,255,255,0.4)",
                          fontSize:13,fontWeight:on?700:400,cursor:"pointer",transition:"all .2s"}}>
                        {m}
                      </button>
                    );
                  })}
                </div>

                {/* RangÃ©e capture */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 36px"}}>
                  {/* Galerie */}
                  <button onClick={pickGallery}
                    style={{width:54,height:54,borderRadius:14,overflow:"hidden",
                      border:"2px solid rgba(255,255,255,0.25)",cursor:"pointer",
                      background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <ImageIcon size={22} color="#fff"/>
                  </button>

                  {/* Bouton central */}
                  {mode==="PHOTO"
                    ? <button onClick={takePhoto}
                        style={{width:78,height:78,borderRadius:"50%",background:"#fff",
                          border:"5px solid rgba(255,255,255,0.3)",cursor:"pointer",flexShrink:0,
                          boxShadow:"0 0 0 3px rgba(255,255,255,0.12),0 6px 32px rgba(0,0,0,0.6)"}}/>
                    : !recording
                      ? <button onClick={startRec}
                          style={{width:78,height:78,borderRadius:"50%",
                            background:"linear-gradient(135deg,#ff4b6e,#dc2626)",
                            border:"5px solid rgba(220,38,38,0.25)",cursor:"pointer",flexShrink:0,
                            boxShadow:"0 0 24px rgba(220,38,38,0.6),0 6px 24px rgba(0,0,0,0.5)"}}/>
                      : <button onClick={stopRec}
                          style={{width:78,height:78,borderRadius:"50%",
                            background:"rgba(220,38,38,0.12)",border:"5px solid #dc2626",cursor:"pointer",flexShrink:0,
                            display:"flex",alignItems:"center",justifyContent:"center",
                            boxShadow:"0 0 28px rgba(220,38,38,0.7)"}}>
                          <div style={{width:28,height:28,borderRadius:7,background:"#dc2626"}}/>
                        </button>
                  }

                  {/* Flip */}
                  <button onClick={flip}
                    style={{width:54,height:54,borderRadius:"50%",background:"rgba(255,255,255,0.08)",
                      border:"1px solid rgba(255,255,255,0.2)",cursor:"pointer",
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <RefreshCw size={20} color="#fff"/>
                  </button>
                </div>
              </>
            )}

            {phase==="preview" && (
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 28px 0"}}>
                <button onClick={retake}
                  style={{height:46,borderRadius:23,padding:"0 20px",
                    background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",
                    color:"#fff",fontSize:14,cursor:"pointer"}}>
                  Reprendre
                </button>
                <button onClick={exportFinal}
                  style={{height:50,borderRadius:25,padding:"0 36px",border:"none",
                    background:"linear-gradient(135deg,#C9952A 0%,#E8B84B 100%)",
                    color:"#000",fontWeight:800,fontSize:15,cursor:"pointer",
                    display:"flex",alignItems:"center",gap:9,
                    boxShadow:"0 4px 24px rgba(201,149,42,0.55)"}}>
                  <Check size={17}/> Utiliser
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`::-webkit-scrollbar{display:none}`}</style>
    </div>
  );
}

function Ic(active=false) {
  return {
    background: active ? "rgba(201,149,42,0.2)" : "rgba(0,0,0,0.5)",
    border: `1px solid ${active ? "rgba(201,149,42,0.45)" : "rgba(255,255,255,0.18)"}`,
    borderRadius:"50%", width:42, height:42,
    display:"flex", alignItems:"center", justifyContent:"center",
    cursor:"pointer", color: active ? "#C9952A" : "#fff",
    backdropFilter:"blur(12px)", flexShrink:0, transition:"all .2s",
  };
}
