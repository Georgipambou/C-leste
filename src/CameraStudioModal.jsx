import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Type, Image as ImageIcon, Check, RefreshCw, ChevronDown, ChevronUp,
  ZapOff, Zap, Clock, Columns, UserPlus, Blend, Video, Music2,
} from "lucide-react";
import * as PIXI from "pixi.js";
import { ColorMatrixFilter } from "pixi.js";

// ── FILTRES CINÉMATIQUES (s'appuient sur les préréglages éprouvés de Pixi.js) ──
// Objectif : peu de filtres, mais un rendu propre et pro plutôt que 12 effets criards.
const FILTERS = [
  { id: "normal",   label: "Original",   matrix: null },
  { id: "cinema",   label: "Cinéma",     matrix: (f) => { f.contrast(0.15, true); f.saturate(-0.15, true); f.brightness(0.96, true); } },
  { id: "kodachrome", label: "Kodachrome", matrix: (f) => { f.kodachrome(true); } },
  { id: "technicolor", label: "Technicolor", matrix: (f) => { f.technicolor(true); f.brightness(1.02, true); } },
  { id: "vintage",  label: "Vintage",    matrix: (f) => { f.vintage(true); } },
  { id: "polaroid", label: "Polaroid",   matrix: (f) => { f.polaroid(true); } },
  { id: "night",    label: "Nuit",       matrix: (f) => { f.night(0.3, true); f.brightness(0.97, true); } },
  { id: "golden",   label: "Doré",       matrix: (f) => { f.sepia(true); f.saturate(0.3, true); f.brightness(1.05, true); } },
  { id: "noir",     label: "Noir & Blanc", matrix: (f) => { f.blackAndWhite(true); f.contrast(0.15, true); } },
  { id: "browni",   label: "Argentique", matrix: (f) => { f.browni(true); } },
  { id: "rose",     label: "Rosé",       matrix: (f) => { f.colorTone(0.15, 0.1, 0xffd1e8, 0x552244, true); f.saturate(0.1, true); } },
  { id: "emeraude", label: "Émeraude",   matrix: (f) => { f.colorTone(0.2, 0.15, 0xbfffe0, 0x003322, true); } },
  { id: "clair",    label: "Clair",      matrix: (f) => { f.brightness(1.15, true); f.contrast(-0.05, true); f.saturate(-0.05, true); } },
];

// Équivalents CSS (thumbnails, capture galerie, export vidéo avec overlays)
const PREVIEW_CSS = {
  normal:      "none",
  cinema:      "contrast(1.15) saturate(0.85) brightness(0.96)",
  kodachrome:  "contrast(1.2) saturate(1.35) sepia(0.15) brightness(1.02)",
  technicolor: "contrast(1.1) saturate(1.5) brightness(1.02) hue-rotate(-5deg)",
  vintage:     "sepia(0.35) contrast(0.9) brightness(1.05) saturate(0.8)",
  polaroid:    "sepia(0.2) contrast(0.85) brightness(1.1) saturate(0.9)",
  night:       "hue-rotate(190deg) saturate(0.7) brightness(0.9) contrast(1.1)",
  golden:      "sepia(0.5) saturate(1.3) brightness(1.05)",
  noir:        "grayscale(1) contrast(1.15)",
  browni:      "sepia(0.45) contrast(1.05) saturate(0.85) brightness(0.98)",
  rose:        "saturate(1.1) hue-rotate(-15deg) brightness(1.03)",
  emeraude:    "hue-rotate(70deg) saturate(1.15) brightness(1.0)",
  clair:       "brightness(1.15) contrast(0.95) saturate(0.95)",
};

const FONTS  = ["Space Grotesk", "Cormorant Garamond", "Georgia", "Arial Black", "Courier New"];
const COLORS = ["#FFFFFF", "#000000", "#C9952A", "#FF4B6E", "#00E5FF", "#A8FF3E", "#FF9500", "#FF69B4"];
const SIZES  = [16, 22, 30, 40, 52];
const MODES  = ["5 min", "60 s", "15 s", "PHOTO", "TEXTE"];
const MAX_SECS = { "5 min": 300, "60 s": 60, "15 s": 15 };
const GRADIENTS = [
  ["#C9952A", "#7A1F3D"], ["#0F2027", "#2C5364"], ["#833AB4", "#FD1D1D"],
  ["#1A1A1A", "#434343"], ["#134E5E", "#71B280"], ["#DA22FF", "#9733EE"],
];

// ── Utilitaire : découpe un texte sur plusieurs lignes pour le canvas ──
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || " ").split(" ");
  const lines = [];
  let line = "";
  words.forEach((w) => {
    const test = line + w + " ";
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w + " ";
    } else line = test;
  });
  lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l.trim(), x, startY + i * lineHeight));
}

// ── Utilitaire : réincruste les overlays (texte/image/vidéo) sur une vidéo capturée ──
// Rejoue la vidéo source, la dessine frame par frame sur un canvas avec les overlays
// par-dessus, puis réenregistre le tout. Si l'API n'est pas dispo ou s'il n'y a aucun
// overlay, on renvoie simplement la vidéo brute (aucune erreur ne remonte à l'appelant).
async function bakeOverlaysOnVideo(sourceBlob, ovs, filterId, rect, onProgress) {
  try {
    const css0 = PREVIEW_CSS[filterId] || "none";
    if (!ovs.length && css0 === "none") return sourceBlob;

    const mainVideo = document.createElement("video");
    mainVideo.src = URL.createObjectURL(sourceBlob);
    mainVideo.muted = true;
    mainVideo.playsInline = true;
    await new Promise((r) => { mainVideo.onloadedmetadata = r; });

    if (typeof mainVideo.captureStream !== "function") return sourceBlob;

    const loaded = await Promise.all(
      ovs.map(async (ov) => {
        if (ov.type === "image") {
          const img = new Image();
          img.src = ov.value;
          await new Promise((r) => { img.onload = r; img.onerror = r; });
          return { ...ov, el: img };
        }
        if (ov.type === "video") {
          const v = document.createElement("video");
          // Le son de l'overlay est mixé séparément via Web Audio si !ov.muted —
          // l'élément lui-même reste toujours muted pour éviter un double-son.
          v.src = ov.value; v.muted = true; v.loop = true; v.playsInline = true;
          await new Promise((r) => { v.onloadedmetadata = r; v.onerror = r; });
          const trimStart = ov.trimStart || 0;
          const trimEnd = ov.trimEnd && ov.trimEnd > trimStart ? ov.trimEnd : v.duration;
          v.currentTime = trimStart;
          v.addEventListener("timeupdate", () => {
            if (v.currentTime >= trimEnd) v.currentTime = trimStart;
          });
          return { ...ov, el: v, trimStart, trimEnd };
        }
        return ov;
      })
    );

    const canvas = document.createElement("canvas");
    canvas.width = mainVideo.videoWidth;
    canvas.height = mainVideo.videoHeight;
    const ctx = canvas.getContext("2d");
    const sx = canvas.width / (rect?.width || canvas.width);
    const sy = canvas.height / (rect?.height || canvas.height);

    const canvasStream = canvas.captureStream(30);
    try {
      mainVideo.captureStream().getAudioTracks().forEach((t) => canvasStream.addTrack(t));
    } catch (e) { /* pas de piste audio dispo, on continue sans son */ }

    // Mixage du son des vidéos overlay non muettes dans le flux final
    try {
      const unmutedVideoOvs = loaded.filter((ov) => ov.type === "video" && !ov.muted);
      if (unmutedVideoOvs.length) {
        const actx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = actx.createMediaStreamDestination();
        unmutedVideoOvs.forEach((ov) => {
          try {
            const src = actx.createMediaElementSource(ov.el);
            src.connect(dest);
          } catch (e) { /* source déjà connectée ailleurs, on ignore */ }
        });
        dest.stream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
      }
    } catch (e) { /* Web Audio indisponible, on continue sans le son des overlays */ }

    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm";
    const rec = new MediaRecorder(canvasStream, { mimeType: mime });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const finished = new Promise((resolve) => { rec.onstop = () => resolve(new Blob(chunks, { type: mime })); });

    rec.start(200);
    mainVideo.currentTime = 0;
    await mainVideo.play();
    loaded.forEach((ov) => { if (ov.type === "video") ov.el.play().catch(() => {}); });

    const css = PREVIEW_CSS[filterId] || "none";
    const draw = () => {
      if (mainVideo.ended || mainVideo.paused) { rec.stop(); return; }
      if (onProgress && mainVideo.duration) {
        onProgress(Math.min(99, Math.round((mainVideo.currentTime / mainVideo.duration) * 100)));
      }
      ctx.filter = css;
      ctx.drawImage(mainVideo, 0, 0, canvas.width, canvas.height);
      ctx.filter = "none";
      loaded.forEach((ov) => {
        if (ov.type === "text") {
          ctx.font = `bold ${ov.size * sx}px "${ov.font}"`;
          ctx.fillStyle = ov.color;
          ctx.shadowColor = "rgba(0,0,0,0.85)";
          ctx.shadowBlur = 10 * sx;
          ctx.fillText(ov.value, ov.x * sx, ov.y * sy);
        } else if (ov.el) {
          ctx.drawImage(ov.el, ov.x * sx, ov.y * sy, ov.size * sx, ov.size * sy);
        }
      });
      requestAnimationFrame(draw);
    };
    draw();

    return await finished;
  } catch (e) {
    console.error("bakeOverlaysOnVideo:", e);
    return sourceBlob; // en cas de souci, on renvoie la vidéo brute plutôt que planter
  }
}

// ── Pastille de progression en arrière-plan ─────────────────────────
// Créée en DOM natif (pas via React) pour continuer à s'afficher même
// après la fermeture du modal caméra, pendant que la vidéo se traite.
function showBackgroundProgress() {
  const pill = document.createElement("div");
  pill.style.cssText = `
    position:fixed;bottom:26px;left:50%;transform:translateX(-50%);
    background:rgba(20,20,20,0.95);color:#fff;padding:10px 18px;border-radius:22px;
    font-family:sans-serif;font-size:13px;font-weight:600;z-index:99999;
    display:flex;align-items:center;gap:10px;box-shadow:0 6px 24px rgba(0,0,0,0.5);
  `;
  const spinner = document.createElement("div");
  spinner.style.cssText = `width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,0.25);border-top-color:#C9952A;`;
  let deg = 0;
  const spin = setInterval(() => { deg = (deg + 30) % 360; spinner.style.transform = `rotate(${deg}deg)`; }, 60);
  const label = document.createElement("span");
  label.textContent = "Publication en cours… 0%";
  pill.appendChild(spinner); pill.appendChild(label);
  document.body.appendChild(pill);
  return {
    update: (pct) => { label.textContent = `Publication en cours… ${pct}%`; },
    done: (msg) => { clearInterval(spin); spinner.remove(); label.textContent = msg || "Publié ✓"; setTimeout(() => pill.remove(), 1800); },
    fail: (msg) => { clearInterval(spin); spinner.remove(); label.textContent = msg || "Échec de la publication"; setTimeout(() => pill.remove(), 2500); },
  };
}

// ── COMPOSANT PRINCIPAL ─────────────────────────────────────────────
export default function CameraStudioModal({ onClose, onDone }) {
  const videoRef    = useRef(null);
  const mountRef    = useRef(null);
  const pixiApp     = useRef(null);
  const pixiSprite  = useRef(null);
  const pixiFilter  = useRef(null);
  const overlayRef  = useRef(null);
  const streamRef   = useRef(null);
  const recRef      = useRef(null);
  const chunksRef   = useRef([]);
  const timerRef    = useRef(null);
  const fileRef     = useRef(null);
  const imgRef      = useRef(null);
  const vidOvRef    = useRef(null);
  const dragRef     = useRef({ on: false, id: null, ox: 0, oy: 0 });
  const resizeRef   = useRef({ on: false, id: null, startX: 0, startSize: 0 });
  const facingRef   = useRef("user");

  const [phase,      setPhase]      = useState("camera"); // camera | preview | textcard
  const [facing,     setFacing]     = useState("user");
  const [filter,     setFilter]     = useState("normal");
  const [mode,       setMode]       = useState("60 s");
  const [recording,  setRecording]  = useState(false);
  const [paused,     setPaused]     = useState(false);
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
  const [cameraError,setCameraError]= useState(null);
  const [toolsCollapsed, setToolsCollapsed] = useState(false);
  const [countdownOn, setCountdownOn] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownVal, setCountdownVal] = useState(3);
  const [toast,      setToast]      = useState(null);
  const [gradIdx,    setGradIdx]    = useState(0);
  const [cardText,   setCardText]   = useState("");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1800); };

  // Garde facingRef synchro + met à jour le miroir en direct si le canvas existe déjà
  useEffect(() => {
    facingRef.current = facing;
    if (pixiApp.current?.canvas) {
      pixiApp.current.canvas.style.transform = facing === "user" ? "scaleX(-1)" : "none";
    }
  }, [facing]);

  // ── Caméra ──────────────────────────────────────────────────────
  const startCam = useCallback(async (f = facing) => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: f, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      streamRef.current = s;
      setCameraError(null);
      if (s.getAudioTracks().length === 0) {
        console.warn("Aucune piste audio dans le flux getUserMedia — vérifie la permission micro (Android: RECORD_AUDIO).");
      }
      const v = videoRef.current;
      if (v) { v.srcObject = s; await v.play(); }
    } catch (e) {
      console.error("Cam:", e);
      setCameraError("Impossible d'accéder à la caméra. Vérifie les autorisations de l'application.");
    }
  }, [facing]);

  useEffect(() => {
    startCam();
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      clearInterval(timerRef.current);
      destroyPixi();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Init Pixi ───────────────────────────────────────────────────
  const initPixi = useCallback(async () => {
    const v = videoRef.current;
    const mount = mountRef.current;
    if (!v || !mount || pixiApp.current) return;
    if (v.readyState < 2 || !v.videoWidth) return;

    try {
      const app = new PIXI.Application();
      await app.init({
        width: mount.clientWidth || 390,
        height: mount.clientHeight || 844,
        backgroundAlpha: 0,
        antialias: true,
        resolution: 1,
      });
      mount.appendChild(app.canvas);
      app.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;";
      // Effet miroir uniquement à l'affichage (caméra avant) — n'affecte jamais les pixels capturés
      app.canvas.style.transform = facingRef.current === "user" ? "scaleX(-1)" : "none";

      const tex = PIXI.Texture.from(v);
      const sprite = new PIXI.Sprite(tex);
      sprite.width = app.screen.width;
      sprite.height = app.screen.height;
      app.stage.addChild(sprite);

      const cmFilter = new ColorMatrixFilter();
      sprite.filters = [cmFilter];

      pixiApp.current = app;
      pixiSprite.current = sprite;
      pixiFilter.current = cmFilter;

      app.ticker.add(() => {
        tex.source.update();
        sprite.width = app.screen.width;
        sprite.height = app.screen.height;
      });

      setPixiReady(true);
    } catch (e) {
      console.error("Pixi init:", e);
    }
  }, []);

  const destroyPixi = () => {
    if (pixiApp.current) {
      try { pixiApp.current.destroy(true, { children: true, texture: true }); } catch (e) {}
      pixiApp.current = null;
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
    if (v.readyState >= 2 && v.videoWidth > 0) setTimeout(initPixi, 300);
    else v.addEventListener("loadeddata", tryInit, { once: true });
    return () => v.removeEventListener("loadeddata", tryInit);
  }, [phase, initPixi]);

  useEffect(() => {
    const f = pixiFilter.current;
    if (!f) return;
    f.reset();
    const def = FILTERS.find((x) => x.id === filter);
    if (def?.matrix) {
      try { def.matrix(f); } catch (e) { console.warn("Filter apply:", e); }
    }
  }, [filter, pixiReady]);

  const flip = () => {
    const n = facing === "user" ? "environment" : "user";
    setFacing(n);
    destroyPixi();
    setTimeout(() => startCam(n).then(() => setTimeout(initPixi, 500)), 100);
  };

  const toggleFlash = async () => {
    const next = !flashOn;
    setFlashOn(next);
    try {
      const track = streamRef.current?.getVideoTracks()?.[0];
      const caps = track?.getCapabilities?.();
      if (track && caps && caps.torch) {
        await track.applyConstraints({ advanced: [{ torch: next }] });
      } else {
        showToast("Flash non disponible sur cet appareil");
      }
    } catch (e) { /* torche non supportée, on ignore silencieusement */ }
  };

  // ── Capture photo ───────────────────────────────────────────────
  // Toujours une capture BRUTE (non filtrée, non miroir) depuis la vidéo source.
  // Le filtre choisi n'est appliqué qu'une seule fois, à l'export final —
  // ça évite le bug de double-filtrage (Pixi qui filtre PUIS le CSS qui refiltre par-dessus).
  const takePhoto = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(v, 0, 0);
    c.toBlob((b) => { if (b) finish(b, URL.createObjectURL(b), false); }, "image/jpeg", 0.95);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Enregistrement vidéo (avec pause/reprise) ──────────────────
  // On enregistre directement le flux caméra brut (vidéo + micro déjà synchronisés
  // par getUserMedia) au lieu de repasser par le canvas Pixi — plus fiable pour le son,
  // et la capture reste non filtrée (le filtre est appliqué une seule fois, à l'export).
  const startRec = () => {
    const s = streamRef.current;
    if (!s) return;
    if (s.getAudioTracks().length === 0) {
      showToast("⚠️ Micro non détecté — vérifie les autorisations de l'app");
    }
    const mimeCandidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=h264,opus",
      "video/webm",
    ];
    const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
    chunksRef.current = [];
    setShowFilters(false);
    const r = new MediaRecorder(s, { mimeType: mime });
    r.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    r.onstop = () => {
      const b = new Blob(chunksRef.current, { type: mime });
      finish(b, URL.createObjectURL(b), true);
    };
    recRef.current = r; r.start(100);
    setRecording(true); setPaused(false); setSecs(0);
    const max = MAX_SECS[mode] || 60;
    timerRef.current = setInterval(() => setSecs((prev) => {
      if (prev >= max - 1) { stopRec(); return max; }
      return prev + 1;
    }), 1000);
  };

  const stopRec = () => {
    if (recRef.current?.state !== "inactive") recRef.current?.stop();
    setRecording(false); setPaused(false); clearInterval(timerRef.current);
  };

  const pauseRec = () => {
    try { recRef.current?.pause(); } catch (e) {}
    setPaused(true);
    clearInterval(timerRef.current);
  };

  const resumeRec = () => {
    try { recRef.current?.resume(); } catch (e) {}
    setPaused(false);
    const max = MAX_SECS[mode] || 60;
    timerRef.current = setInterval(() => setSecs((prev) => {
      if (prev >= max - 1) { stopRec(); return max; }
      return prev + 1;
    }), 1000);
  };

  // ── Décompte 3-2-1 avant capture ────────────────────────────────
  const doCapture = () => {
    setShowFilters(false);
    if (mode === "PHOTO") takePhoto();
    else startRec();
  };

  const beginCapture = () => {
    if (countdownOn && !recording) {
      setCountdownVal(3);
      setShowCountdown(true);
    } else {
      doCapture();
    }
  };

  useEffect(() => {
    if (!showCountdown) return;
    if (countdownVal <= 0) { setShowCountdown(false); doCapture(); return; }
    const t = setTimeout(() => setCountdownVal((v) => v - 1), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCountdown, countdownVal]);

  // ── Galerie ─────────────────────────────────────────────────────
  const pickGallery = () => fileRef.current?.click();
  const onGalleryPick = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    finish(f, URL.createObjectURL(f), f.type.startsWith("video/"));
    e.target.value = "";
  };

  const pickOverlayImg = () => imgRef.current?.click();
  const onOverlayImg = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    addOverlay({ type: "image", value: URL.createObjectURL(f), size: 120 });
    e.target.value = ""; setPanel(null);
  };

  const pickOverlayVideo = () => vidOvRef.current?.click();
  const onOverlayVideo = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const tmp = document.createElement("video");
    tmp.src = URL.createObjectURL(f);
    tmp.onloadedmetadata = () => {
      addOverlay({
        type: "video", value: tmp.src, size: 150,
        muted: false, trimStart: 0, trimEnd: tmp.duration, duration: tmp.duration,
      });
      setPanel("video-edit");
    };
    e.target.value = "";
  };

  // ── Finish / Retake ─────────────────────────────────────────────
  const finish = (b, u, v) => {
    destroyPixi();
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    setBlob(b); setUrl(u); setIsVid(v);
    setPhase("preview"); setPanel(null); setShowFilters(false);
  };

  const retake = () => {
    setBlob(null); setUrl(null); setOverlays([]); setActiveOv(null);
    setPhase("camera"); setRecording(false); setPaused(false); setSecs(0); setPanel(null); setShowFilters(false);
    startCam().then(() => setTimeout(initPixi, 500));
  };

  // ── Overlays (texte / image / vidéo) ────────────────────────────
  const addOverlay = (patch) => {
    const ov = { id: Date.now(), type: "text", value: "", x: 60, y: 180, size: 24, color: "#FFFFFF", font: "Space Grotesk", ...patch };
    setOverlays((os) => [...os, ov]); setActiveOv(ov);
  };
  const updOv = (id, p) => {
    setOverlays((os) => os.map((o) => (o.id === id ? { ...o, ...p } : o)));
    setActiveOv((ao) => (ao?.id === id ? { ...ao, ...p } : ao));
  };
  const delOv = (id) => { setOverlays((os) => os.filter((o) => o.id !== id)); setActiveOv(null); setPanel(null); };

  const pDown = (e, id) => {
    e.stopPropagation();
    e.preventDefault();
    const ov = overlays.find((o) => o.id === id);
    const box = overlayRef.current?.getBoundingClientRect();
    const bx = box?.left || 0, by = box?.top || 0;
    dragRef.current = { on: true, id, ox: (e.clientX - bx) - (ov?.x || 0), oy: (e.clientY - by) - (ov?.y || 0) };
    const mv = (e2) => {
      if (!dragRef.current.on) return;
      const b2 = overlayRef.current?.getBoundingClientRect();
      const bx2 = b2?.left || 0, by2 = b2?.top || 0;
      setOverlays((os) => os.map((o) => (o.id === dragRef.current.id
        ? { ...o, x: (e2.clientX - bx2) - dragRef.current.ox, y: (e2.clientY - by2) - dragRef.current.oy }
        : o)));
    };
    const up = () => { dragRef.current.on = false; window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };

  // Poignée de redimensionnement (agrandir / rétrécir un overlay)
  const rDown = (e, id) => {
    e.stopPropagation();
    const ov = overlays.find((o) => o.id === id);
    const startSize = ov?.type === "text" ? ov.size : ov.size;
    resizeRef.current = { on: true, id, startX: e.clientX, startSize };
    const mv = (e2) => {
      if (!resizeRef.current.on) return;
      const delta = e2.clientX - resizeRef.current.startX;
      const o = overlays.find((x) => x.id === resizeRef.current.id);
      if (!o) return;
      if (o.type === "text") {
        const next = Math.max(12, Math.min(96, resizeRef.current.startSize + delta * 0.4));
        updOv(resizeRef.current.id, { size: Math.round(next) });
      } else {
        const next = Math.max(40, Math.min(320, resizeRef.current.startSize + delta));
        updOv(resizeRef.current.id, { size: Math.round(next) });
      }
    };
    const up = () => { resizeRef.current.on = false; window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };

  const confirmText = () => {
    if (!newText.trim()) { setPanel(null); return; }
    if (activeOv?.type === "text" && activeOv?.id) {
      updOv(activeOv.id, { value: newText, color: txtColor, size: txtSize, font: txtFont });
    } else {
      addOverlay({ type: "text", value: newText, color: txtColor, size: txtSize, font: txtFont });
    }
    setNewText(""); setPanel(null); setActiveOv(null);
  };

  // ── Export final ────────────────────────────────────────────────
  // Point UNIQUE d'application du filtre — la capture est toujours brute,
  // donc plus jamais de double-filtrage, et on peut changer de filtre après coup.
  const exportFinal = async () => {
    if (!blob) return;
    const css = PREVIEW_CSS[filter] || "none";
    const needsWork = overlays.length > 0 || css !== "none";

    if (!isVid) {
      if (!needsWork) {
        onDone({ file: new File([blob], "celeste-photo.jpg", { type: "image/jpeg" }), type: "image" });
        return;
      }
      const img = new Image(); img.src = url;
      await new Promise((r) => { img.onload = r; });
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d");
      if (css !== "none") ctx.filter = css;
      ctx.drawImage(img, 0, 0); ctx.filter = "none";
      const rect = overlayRef.current?.getBoundingClientRect();
      const sx = img.width / (rect?.width || 1), sy = img.height / (rect?.height || 1);
      for (const ov of overlays) {
        if (ov.type === "text") {
          ctx.font = `bold ${ov.size * sx}px "${ov.font}"`;
          ctx.fillStyle = ov.color; ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 10 * sx;
          ctx.fillText(ov.value, ov.x * sx, ov.y * sy);
        } else if (ov.type === "image" || ov.type === "video") {
          const oi = ov.el || new Image();
          if (!ov.el) { oi.src = ov.value; await new Promise((r) => { oi.onload = r; oi.onerror = r; }); }
          ctx.drawImage(oi, ov.x * sx, ov.y * sy, ov.size * sx, ov.size * sy);
        }
      }
      c.toBlob((b) => onDone({ file: new File([b], "celeste-photo.jpg", { type: "image/jpeg" }), type: "image" }), "image/jpeg", 0.95);
      return;
    }

    // Vidéo
    if (!needsWork) {
      onDone({ file: new File([blob], "celeste.webm", { type: "video/webm" }), type: "video" });
      return;
    }

    // On capture tout ce dont on a besoin AVANT de fermer le modal,
    // car les refs React (overlayRef) ne seront plus valides après.
    const rect = overlayRef.current?.getBoundingClientRect();
    const ovsSnapshot = overlays;
    const filterSnapshot = filter;
    const blobSnapshot = blob;

    const progress = showBackgroundProgress();
    onClose(); // on rend la main tout de suite : l'utilisateur continue d'utiliser l'app

    bakeOverlaysOnVideo(blobSnapshot, ovsSnapshot, filterSnapshot, rect, (pct) => progress.update(pct))
      .then((finalBlob) => {
        progress.done();
        onDone({ file: new File([finalBlob], "celeste.webm", { type: "video/webm" }), type: "video" });
      })
      .catch(() => progress.fail());
  };

  // ── Mode TEXTE (carte de statut texte, sans caméra) ─────────────
  const publishTextCard = () => {
    const c = document.createElement("canvas");
    c.width = 1080; c.height = 1920;
    const ctx = c.getContext("2d");
    const [c1, c2] = GRADIENTS[gradIdx];
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = txtColor; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `bold ${txtSize * 2.4}px "${txtFont}"`;
    wrapText(ctx, cardText, c.width / 2, c.height / 2, c.width - 140, txtSize * 2.8);
    c.toBlob((b) => onDone({ file: new File([b], "celeste-texte.jpg", { type: "image/jpeg" }), type: "image" }), "image/jpeg", 0.95);
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const maxSecs = MAX_SECS[mode] || 60;
  const progress = recording ? (secs / maxSecs) * 100 : 0;
  const quickFilters = FILTERS.filter((f) => f.id !== "normal").slice(0, 2);

  // ── Écran mode TEXTE ─────────────────────────────────────────────
  if (phase === "textcard") {
    const [c1, c2] = GRADIENTS[gradIdx];
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 600, background: `linear-gradient(160deg, ${c1}, ${c2})`, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "52px 16px 0" }}>
          <button onClick={() => setPhase("camera")} style={Ic()}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 32px" }}>
          <textarea
            value={cardText} onChange={(e) => setCardText(e.target.value)}
            placeholder="Écris quelque chose…" autoFocus rows={4}
            style={{ width: "100%", background: "transparent", border: "none", outline: "none", resize: "none",
              color: txtColor, fontFamily: `'${txtFont}',sans-serif`, fontWeight: 800, fontSize: 32,
              textAlign: "center", textShadow: "0 2px 20px rgba(0,0,0,0.4)" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, paddingBottom: 16 }}>
          {GRADIENTS.map((g, i) => (
            <div key={i} onClick={() => setGradIdx(i)}
              style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${g[0]},${g[1]})`,
                cursor: "pointer", border: gradIdx === i ? "2.5px solid #fff" : "2.5px solid rgba(255,255,255,0.25)" }} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 9, padding: "0 18px 40px" }}>
          {COLORS.slice(0, 6).map((c) => (
            <div key={c} onClick={() => setTxtColor(c)}
              style={{ width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer",
                border: `2px solid ${txtColor === c ? "#C9952A" : "rgba(255,255,255,0.3)"}` }} />
          ))}
        </div>
        <div style={{ padding: "0 28px 40px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={publishTextCard}
            style={{ height: 50, borderRadius: 25, padding: "0 32px", border: "none",
              background: "linear-gradient(135deg,#C9952A 0%,#E8B84B 100%)", color: "#000", fontWeight: 800,
              fontSize: 15, cursor: "pointer", boxShadow: "0 4px 24px rgba(201,149,42,0.55)" }}>
            Publier
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, background: "#000", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={onGalleryPick} />
      <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onOverlayImg} />
      <input ref={vidOvRef} type="file" accept="video/*" style={{ display: "none" }} onChange={onOverlayVideo} />
      <video ref={videoRef} playsInline muted style={{ display: "none" }} />

      {/* ── Zone visuelle ── */}
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <div ref={mountRef} style={{ position: "absolute", inset: 0, display: phase === "camera" ? "block" : "none" }} />

        {phase === "preview" && !isVid && (
          <img src={url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
            filter: (PREVIEW_CSS[filter] && PREVIEW_CSS[filter] !== "none") ? PREVIEW_CSS[filter] : undefined }} />
        )}
        {phase === "preview" && isVid && (
          <video src={url} autoPlay loop playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
            filter: (PREVIEW_CSS[filter] && PREVIEW_CSS[filter] !== "none") ? PREVIEW_CSS[filter] : undefined }} />
        )}

        {phase === "preview" && (
          <div ref={overlayRef} style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}>
            {overlays.map((ov) => (
              <div key={ov.id} onPointerDown={(e) => pDown(e, ov.id)}
                onClick={() => {
                  setActiveOv(ov);
                  if (ov.type === "text") { setNewText(ov.value); setTxtColor(ov.color); setTxtSize(ov.size); setTxtFont(ov.font); setPanel("text"); }
                }}
                style={{ position: "absolute", left: ov.x, top: ov.y, cursor: "move", userSelect: "none", touchAction: "none" }}>
                {ov.type === "text" && (
                  <span style={{ fontFamily: `'${ov.font}',sans-serif`, fontSize: ov.size, color: ov.color, fontWeight: 700,
                    textShadow: "0 2px 14px rgba(0,0,0,0.95)", whiteSpace: "pre", display: "block" }}>
                    {ov.value}
                  </span>
                )}
                {ov.type === "image" && (
                  <img src={ov.value} style={{ width: ov.size, height: ov.size, objectFit: "contain", borderRadius: 8, pointerEvents: "none" }} />
                )}
                {ov.type === "video" && (
                  <video src={ov.value} autoPlay loop muted={!!ov.muted} playsInline
                    ref={(el) => {
                      if (!el || el.dataset.trimBound) return;
                      el.dataset.trimBound = "1";
                      el.addEventListener("loadedmetadata", () => { el.currentTime = ov.trimStart || 0; });
                      el.addEventListener("timeupdate", () => {
                        const end = ov.trimEnd && ov.trimEnd > (ov.trimStart || 0) ? ov.trimEnd : el.duration;
                        if (el.currentTime >= end) el.currentTime = ov.trimStart || 0;
                      });
                    }}
                    style={{ width: ov.size, height: ov.size, objectFit: "cover", borderRadius: 8, pointerEvents: "none" }} />
                )}
                {activeOv?.id === ov.id && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); delOv(ov.id); }}
                      style={{ position: "absolute", top: -10, right: -10, width: 22, height: 22, borderRadius: "50%",
                        background: "#dc2626", border: "none", color: "#fff", fontSize: 14, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, fontWeight: 700 }}>×</button>
                    {ov.type === "video" && (
                      <button onClick={(e) => { e.stopPropagation(); setActiveOv(ov); setPanel("video-edit"); }}
                        style={{ position: "absolute", top: -10, left: -10, width: 22, height: 22, borderRadius: "50%",
                          background: "#C9952A", border: "2px solid #fff", color: "#000", fontSize: 11, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, fontWeight: 700 }}>⚙</button>
                    )}
                    <div onPointerDown={(e) => rDown(e, ov.id)}
                      style={{ position: "absolute", bottom: -10, right: -10, width: 20, height: 20, borderRadius: "50%",
                        background: "#C9952A", border: "2px solid #fff", cursor: "nwse-resize", touchAction: "none" }} />
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {cameraError && phase === "camera" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.75)", padding: "0 36px", textAlign: "center", zIndex: 25 }}>
            <div>
              <p style={{ color: "#fff", fontSize: 15, marginBottom: 16, lineHeight: 1.5 }}>{cameraError}</p>
              <button onClick={() => startCam()} style={{ padding: "10px 24px", borderRadius: 20, border: "none",
                background: "linear-gradient(135deg,#C9952A 0%,#E8B84B 100%)", color: "#000", fontWeight: 700, cursor: "pointer" }}>
                Réessayer
              </button>
            </div>
          </div>
        )}

        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 180, background: "linear-gradient(to bottom,rgba(0,0,0,0.65),transparent)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 320, background: "linear-gradient(to top,rgba(0,0,0,0.75),transparent)", pointerEvents: "none" }} />

        {recording && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, zIndex: 30, background: "rgba(255,255,255,0.1)" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: paused ? "#f5a623" : "linear-gradient(to right,#ff4b6e,#dc2626)", transition: "width 1s linear" }} />
          </div>
        )}

        {recording && (
          <div style={{ position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)",
            background: paused ? "rgba(245,166,35,0.9)" : "rgba(220,38,38,0.9)", borderRadius: 20, padding: "5px 16px",
            color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: 1,
            display: "flex", alignItems: "center", gap: 8, zIndex: 20, backdropFilter: "blur(8px)" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />
            {paused ? "Pause" : fmt(secs)}
          </div>
        )}

        {showCountdown && (
          <div style={{ position: "absolute", inset: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)" }}>
            <div key={countdownVal} className="celeste-countdown" style={{ fontSize: 120, fontWeight: 800, color: "#fff",
              textShadow: "0 0 40px rgba(201,149,42,0.7)" }}>
              {countdownVal > 0 ? countdownVal : ""}
            </div>
          </div>
        )}

        {toast && (
          <div style={{ position: "absolute", top: 100, left: "50%", transform: "translateX(-50%)", background: "rgba(20,20,20,0.92)",
            color: "#fff", padding: "8px 18px", borderRadius: 20, fontSize: 12.5, zIndex: 45, whiteSpace: "nowrap" }}>
            {toast}
          </div>
        )}

        {/* ── Top bar ── */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "52px 16px 0", zIndex: 20 }}>
          <button onClick={onClose} style={Ic()}><X size={18} /></button>

          {phase === "camera" && !recording && (
            <button onClick={() => showToast("Bientôt disponible : ajout de son")}
              style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 20,
                padding: "8px 16px", color: "#fff", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center",
                gap: 7, cursor: "pointer", backdropFilter: "blur(12px)" }}>
              <Music2 size={14} /> Ajouter un son
            </button>
          )}

          {phase === "camera" && !recording && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
              {!toolsCollapsed && (
                <>
                  <button onClick={flip} style={Ic()}><RefreshCw size={16} /></button>
                  <button onClick={toggleFlash} style={Ic(flashOn)}>{flashOn ? <Zap size={16} /> : <ZapOff size={16} />}</button>
                  <button onClick={() => setCountdownOn((c) => !c)} style={Ic(countdownOn)}><Clock size={16} /></button>
                  <button onClick={() => showToast("Écran partagé — bientôt disponible")} style={Ic()}><Columns size={16} /></button>
                  <button onClick={() => showToast("Inviter un ami — bientôt disponible")} style={Ic()}><UserPlus size={16} /></button>
                  <button onClick={() => setShowFilters((s) => !s)} style={Ic(showFilters)}><Blend size={16} /></button>
                </>
              )}
              <button onClick={() => setToolsCollapsed((c) => !c)} style={Ic()}>
                {toolsCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          )}

          {phase === "preview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
              <button onClick={() => { setNewText(""); setActiveOv(null); setPanel("text"); }} style={Ic(panel === "text")}><Type size={16} /></button>
              <button onClick={pickOverlayImg} style={Ic()}><ImageIcon size={16} /></button>
              {isVid && <button onClick={pickOverlayVideo} style={Ic()}><Video size={16} /></button>}
              <button onClick={() => setShowFilters((s) => !s)} style={Ic(showFilters)}><Blend size={16} /></button>
            </div>
          )}
        </div>

        {/* ── Barre filtres ── */}
        {showFilters && (
          <div style={{ position: "absolute", bottom: phase === "camera" ? 210 : 110, left: 0, right: 0, zIndex: 15, paddingBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 16px 4px" }}>
              <button onClick={() => setShowFilters(false)}
                style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 14,
                  padding: "3px 12px", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Fermer ✕</button>
            </div>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "4px 16px", scrollbarWidth: "none" }}>
              {FILTERS.map((f) => {
                const on = f.id === filter;
                const css = PREVIEW_CSS[f.id] || "none";
                return (
                  <div key={f.id} onClick={() => setFilter(f.id)}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", flexShrink: 0 }}>
                    <div style={{ width: 62, height: 62, borderRadius: 16, overflow: "hidden",
                      border: `2.5px solid ${on ? "#C9952A" : "rgba(255,255,255,0.18)"}`,
                      boxShadow: on ? "0 0 12px rgba(201,149,42,0.5)" : "none", transition: "border .2s,box-shadow .2s", position: "relative" }}>
                      {phase === "preview" && url && !isVid
                        ? <img src={url} style={{ width: "100%", height: "100%", objectFit: "cover", filter: css !== "none" ? css : undefined }} />
                        : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#555 0%,#222 100%)", filter: css !== "none" ? css : undefined }} />}
                    </div>
                    <span style={{ fontSize: 10, color: on ? "#C9952A" : "rgba(255,255,255,0.5)", fontWeight: on ? 700 : 400, letterSpacing: .3 }}>{f.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Zone bas ── */}
      <div style={{ position: "relative", zIndex: 20, paddingBottom: 40 }}>
        {panel === "text" && (
          <div style={{ background: "rgba(6,6,6,0.97)", borderRadius: "24px 24px 0 0", padding: "20px 18px 10px", backdropFilter: "blur(30px)" }}>
            <input value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="Votre texte…" autoFocus
              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16,
                padding: "12px 16px", color: txtColor, fontSize: Math.min(txtSize, 22), fontFamily: `'${txtFont}',sans-serif`,
                fontWeight: 700, outline: "none", marginBottom: 14, letterSpacing: .3 }} />
            <div style={{ display: "flex", gap: 9, marginBottom: 12 }}>
              {COLORS.map((c) => (
                <div key={c} onClick={() => setTxtColor(c)}
                  style={{ width: 30, height: 30, borderRadius: "50%", background: c, cursor: "pointer", flexShrink: 0,
                    border: `2.5px solid ${txtColor === c ? "#C9952A" : "rgba(255,255,255,0.08)"}`, transition: "border .15s", boxShadow: "0 1px 6px rgba(0,0,0,0.6)" }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 7, marginBottom: 11 }}>
              {SIZES.map((s) => {
                const on = txtSize === s;
                return <button key={s} onClick={() => setTxtSize(s)}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 11, cursor: "pointer", fontWeight: on ? 700 : 400, fontSize: 11,
                    border: `1px solid ${on ? "#C9952A" : "rgba(255,255,255,0.08)"}`, background: on ? "rgba(201,149,42,0.15)" : "rgba(255,255,255,0.03)",
                    color: on ? "#C9952A" : "rgba(255,255,255,0.4)" }}>{s}</button>;
              })}
            </div>
            <div style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 14, scrollbarWidth: "none" }}>
              {FONTS.map((f) => {
                const on = txtFont === f;
                return <button key={f} onClick={() => setTxtFont(f)}
                  style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                    border: `1px solid ${on ? "#C9952A" : "rgba(255,255,255,0.08)"}`, background: on ? "rgba(201,149,42,0.15)" : "rgba(255,255,255,0.03)",
                    color: on ? "#C9952A" : "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: `'${f}',sans-serif`, fontWeight: on ? 700 : 400 }}>{f.split(" ")[0]}</button>;
              })}
            </div>
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={() => { setPanel(null); setActiveOv(null); }}
                style={{ flex: 1, padding: "12px", borderRadius: 15, border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 13 }}>Annuler</button>
              <button onClick={confirmText}
                style={{ flex: 2, padding: "12px", borderRadius: 15, border: "none", background: "linear-gradient(135deg,#C9952A 0%,#E8B84B 100%)",
                  color: "#000", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  boxShadow: "0 3px 16px rgba(201,149,42,0.4)" }}>
                <Check size={15} /> Ajouter
              </button>
            </div>
          </div>
        )}

        {panel === "video-edit" && activeOv && (
          <div style={{ background: "rgba(6,6,6,0.97)", borderRadius: "24px 24px 0 0", padding: "20px 18px 10px", backdropFilter: "blur(30px)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>Réglages de la vidéo</span>
              <button onClick={() => updOv(activeOv.id, { muted: !activeOv.muted })}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                  border: `1px solid ${activeOv.muted ? "rgba(255,255,255,0.15)" : "#C9952A"}`,
                  background: activeOv.muted ? "rgba(255,255,255,0.04)" : "rgba(201,149,42,0.15)",
                  color: activeOv.muted ? "rgba(255,255,255,0.5)" : "#C9952A", fontSize: 12, fontWeight: 700 }}>
                {activeOv.muted ? "Son désactivé" : "Son activé"}
              </button>
            </div>
            {activeOv.duration > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>
                  <span>Début : {Number(activeOv.trimStart || 0).toFixed(1)}s</span>
                  <span>Fin : {Number(activeOv.trimEnd || activeOv.duration).toFixed(1)}s</span>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <input type="range" min={0} max={activeOv.duration} step={0.1}
                    value={activeOv.trimStart || 0}
                    onChange={(e) => {
                      const v = Math.min(Number(e.target.value), (activeOv.trimEnd || activeOv.duration) - 0.2);
                      updOv(activeOv.id, { trimStart: v });
                    }}
                    style={{ width: "100%" }} />
                  <input type="range" min={0} max={activeOv.duration} step={0.1}
                    value={activeOv.trimEnd || activeOv.duration}
                    onChange={(e) => {
                      const v = Math.max(Number(e.target.value), (activeOv.trimStart || 0) + 0.2);
                      updOv(activeOv.id, { trimEnd: v });
                    }}
                    style={{ width: "100%" }} />
                </div>
              </>
            )}
            <div style={{ display: "flex", gap: 9, marginTop: 6 }}>
              <button onClick={() => { setPanel(null); setActiveOv(null); }}
                style={{ flex: 1, padding: "12px", borderRadius: 15, border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 13 }}>Fermer</button>
              <button onClick={() => setPanel(null)}
                style={{ flex: 2, padding: "12px", borderRadius: 15, border: "none", background: "linear-gradient(135deg,#C9952A 0%,#E8B84B 100%)",
                  color: "#000", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  boxShadow: "0 3px 16px rgba(201,149,42,0.4)" }}>
                <Check size={15} /> OK
              </button>
            </div>
          </div>
        )}

        {!panel && (
          <>
            {phase === "camera" && (
              <>
                <div style={{ display: "flex", justifyContent: "center", gap: 4, paddingTop: 14, paddingBottom: 10, flexWrap: "wrap" }}>
                  {MODES.map((m) => {
                    const on = m === mode;
                    return (
                      <button key={m} onClick={() => {
                        if (recording) return;
                        setMode(m);
                        if (m === "TEXTE") setPhase("textcard");
                      }}
                        style={{ background: on ? "rgba(255,255,255,0.15)" : "transparent", border: on ? "1px solid rgba(255,255,255,0.25)" : "1px solid transparent",
                          borderRadius: 22, padding: "5px 16px", color: on ? "#fff" : "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: on ? 700 : 400,
                          cursor: "pointer", transition: "all .2s" }}>{m}</button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 26px" }}>
                  <button onClick={pickGallery} style={{ width: 46, height: 46, borderRadius: 14, overflow: "hidden",
                    border: "2px solid rgba(255,255,255,0.25)", cursor: "pointer", background: "rgba(255,255,255,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <ImageIcon size={19} color="#fff" />
                  </button>

                  {!recording && quickFilters[0] && (
                    <button onClick={() => setFilter(quickFilters[0].id)}
                      style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
                        border: `2px solid ${filter === quickFilters[0].id ? "#C9952A" : "rgba(255,255,255,0.25)"}`,
                        background: "linear-gradient(135deg,#555,#222)", filter: PREVIEW_CSS[quickFilters[0].id] }} />
                  )}

                  {mode === "PHOTO"
                    ? <button onClick={beginCapture}
                        style={{ width: 78, height: 78, borderRadius: "50%", background: "#fff", border: "5px solid rgba(255,255,255,0.3)",
                          cursor: "pointer", flexShrink: 0, boxShadow: "0 0 0 3px rgba(255,255,255,0.12),0 6px 32px rgba(0,0,0,0.6)" }} />
                    : !recording
                      ? <button onClick={beginCapture}
                          style={{ width: 78, height: 78, borderRadius: "50%", background: "linear-gradient(135deg,#ff4b6e,#dc2626)",
                            border: "5px solid rgba(220,38,38,0.25)", cursor: "pointer", flexShrink: 0,
                            boxShadow: "0 0 24px rgba(220,38,38,0.6),0 6px 24px rgba(0,0,0,0.5)" }} />
                      : (
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <button onClick={paused ? resumeRec : pauseRec}
                            style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(255,255,255,0.12)",
                              border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {paused
                              ? <div style={{ width: 0, height: 0, borderTop: "8px solid transparent", borderBottom: "8px solid transparent", borderLeft: "13px solid #fff", marginLeft: 3 }} />
                              : <div style={{ display: "flex", gap: 4 }}><div style={{ width: 5, height: 16, background: "#fff", borderRadius: 1 }} /><div style={{ width: 5, height: 16, background: "#fff", borderRadius: 1 }} /></div>}
                          </button>
                          <button onClick={stopRec}
                            style={{ width: 78, height: 78, borderRadius: "50%", background: "rgba(220,38,38,0.12)", border: "5px solid #dc2626",
                              cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 28px rgba(220,38,38,0.7)" }}>
                            <div style={{ width: 28, height: 28, borderRadius: 7, background: "#dc2626" }} />
                          </button>
                          <div style={{ width: 46 }} />
                        </div>
                      )
                  }

                  {!recording && quickFilters[1] && (
                    <button onClick={() => setFilter(quickFilters[1].id)}
                      style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
                        border: `2px solid ${filter === quickFilters[1].id ? "#C9952A" : "rgba(255,255,255,0.25)"}`,
                        background: "linear-gradient(135deg,#555,#222)", filter: PREVIEW_CSS[quickFilters[1].id] }} />
                  )}

                  <button onClick={flip} style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <RefreshCw size={18} color="#fff" />
                  </button>
                </div>

                <div style={{ display: "flex", justifyContent: "center", gap: 26, paddingTop: 16 }}>
                  <button onClick={() => showToast("Live — bientôt disponible")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer" }}>LIVE</button>
                  <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>PUBLIER</span>
                  <button onClick={() => showToast("Créer — bientôt disponible")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer" }}>CRÉER</button>
                </div>
              </>
            )}

            {phase === "preview" && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 28px 0" }}>
                <button onClick={retake}
                  style={{ height: 46, borderRadius: 23, padding: "0 20px", background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 14, cursor: "pointer" }}>
                  Reprendre
                </button>
                <button onClick={exportFinal}
                  style={{ height: 50, borderRadius: 25, padding: "0 36px", border: "none",
                    background: "linear-gradient(135deg,#C9952A 0%,#E8B84B 100%)", color: "#000", fontWeight: 800, fontSize: 15,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 9, boxShadow: "0 4px 24px rgba(201,149,42,0.55)" }}>
                  <Check size={17} /> Utiliser
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        ::-webkit-scrollbar{display:none}
        @keyframes celesteSpin{to{transform:rotate(360deg)}}
        @keyframes celesteCountdown{0%{transform:scale(0.5);opacity:0}30%{transform:scale(1.15);opacity:1}60%{transform:scale(1)}100%{transform:scale(0.85);opacity:0}}
        .celeste-countdown{animation:celesteCountdown 0.7s ease-out forwards}
      `}</style>
    </div>
  );
}

function Ic(active = false) {
  return {
    background: active ? "rgba(201,149,42,0.2)" : "rgba(0,0,0,0.5)",
    border: `1px solid ${active ? "rgba(201,149,42,0.45)" : "rgba(255,255,255,0.18)"}`,
    borderRadius: "50%", width: 42, height: 42,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", color: active ? "#C9952A" : "#fff",
    backdropFilter: "blur(12px)", flexShrink: 0, transition: "all .2s",
  };
}