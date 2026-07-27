import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Type, Image as ImageIcon, Check,
  Video, Music2, Share2, Archive, Sticker as StickerIcon,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import fixWebmDuration from "fix-webm-duration";

const extFor = (b) => (b?.type?.includes("mp4") ? "mp4" : "webm");

// Convertit un Blob en base64 (sans le préfixe data:...) — requis par
// Filesystem.writeFile côté natif (iOS/Android).
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const FONTS  = ["Space Grotesk", "Cormorant Garamond", "Georgia", "Arial Black", "Courier New"];
const COLORS = ["#FFFFFF", "#000000", "#C9952A", "#FF4B6E", "#00E5FF", "#A8FF3E", "#FF9500", "#FF69B4"];
const SIZES  = [16, 22, 30, 40, 52];
const GRADIENTS = [
  ["#C9952A", "#7A1F3D"], ["#0F2027", "#2C5364"], ["#833AB4", "#FD1D1D"],
  ["#1A1A1A", "#434343"], ["#134E5E", "#71B280"], ["#DA22FF", "#9733EE"],
];
import previewDark from "./assets/preview.webp";
import previewLight from "./assets/preview-light.webp";
import SoundPickerButton from "./components/SoundPickerButton";
import SoundPreviewButton from "./components/SoundPreviewButton";
import StickerPicker from "./components/StickerPicker";

function isLightBg(hex) {
  if (!hex || hex[0] !== "#") return false;
  const h = hex.length === 4 ? hex.replace(/#(.)(.)(.)/, "#$1$1$2$2$3$3") : hex;
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 170;
}

// ── Utilitaire : découpe un texte sur plusieurs lignes pour le canvas ──
// anchorLeft=false (défaut) : x est le CENTRE du bloc (carte de texte plein écran).
// anchorLeft=true : x est le bord GAUCHE du bloc, comme en aperçu live (overlay glissé à la main) —
// sans ça le texte exporté se retrouvait décalé vers la gauche par rapport à sa position à l'écran.
function wrapText(ctx, text, x, y, maxWidth, lineHeight, bgColor, anchorLeft) {
  const paragraphs = String(text || " ").split("\n");
  const lines = [];
  paragraphs.forEach((para) => {
    const words = para.split(" ");
    let line = "";
    words.forEach((w) => {
      const test = line + w + " ";
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w + " ";
      } else line = test;
    });
    lines.push(line);
  });
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l.trim()).width));
  const drawX = anchorLeft ? x + widest / 2 : x;
  if (bgColor) {
    const padX = 14, padY = 8;
    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.fillStyle = bgColor;
    ctx.fillRect(drawX - widest / 2 - padX, startY - lineHeight / 2 - padY, widest + padX * 2, lines.length * lineHeight + padY * 2);
    ctx.restore();
  }
  lines.forEach((l, i) => ctx.fillText(l.trim(), drawX, startY + i * lineHeight));
}

// ── Utilitaire : réincruste les overlays (texte/image/vidéo) sur une vidéo capturée ──
// Rejoue la vidéo source, la dessine frame par frame sur un canvas avec les overlays
// par-dessus, puis réenregistre le tout. Si l'API n'est pas dispo ou s'il n'y a aucun
// overlay, on renvoie simplement la vidéo brute (aucune erreur ne remonte à l'appelant).
async function bakeOverlaysOnVideo(sourceBlob, ovs, rect, onProgress, cancelToken, soundMix) {
  try {
    if (!ovs.length && !soundMix) return sourceBlob;

    const mainVideo = document.createElement("video");
    mainVideo.src = URL.createObjectURL(sourceBlob);
    mainVideo.muted = true;
    mainVideo.playsInline = true;
    await new Promise((r) => { mainVideo.onloadedmetadata = r; });

    const loaded = await Promise.all(
      ovs.map(async (ov) => {
        if (ov.type === "video") {
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  let broken = false;
  await new Promise((r) => {
    v.onloadedmetadata = r;
    v.onerror = () => { broken = true; r(); };
    v.src = ov.value; v.muted = true; v.loop = true; v.playsInline = true;
  });
  if (broken) { console.warn("Overlay vidéo illisible, ignoré au bake :", ov.value); return { ...ov, el: v, broken: true }; }
  const trimStart = ov.trimStart || 0;
  const trimEnd = ov.trimEnd && ov.trimEnd > trimStart ? ov.trimEnd : v.duration;
  v.currentTime = trimStart;
  v.addEventListener("timeupdate", () => {
    if (v.currentTime >= trimEnd) v.currentTime = trimStart;
  });
  return { ...ov, el: v, trimStart, trimEnd, broken: false };
}if (ov.type === "video") {
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  let broken = false;
  await new Promise((r) => {
    v.onloadedmetadata = r;
    v.onerror = () => { broken = true; r(); };
    v.src = ov.value; v.muted = true; v.loop = true; v.playsInline = true;
  });
  if (broken) { console.warn("Overlay vidéo illisible, ignoré au bake :", ov.value); return { ...ov, el: v, broken: true }; }
  const trimStart = ov.trimStart || 0;
  const trimEnd = ov.trimEnd && ov.trimEnd > trimStart ? ov.trimEnd : v.duration;
  v.currentTime = trimStart;
  v.addEventListener("timeupdate", () => {
    if (v.currentTime >= trimEnd) v.currentTime = trimStart;
  });
  return { ...ov, el: v, trimStart, trimEnd, broken: false };
}
        if (ov.type === "video") {
          const v = document.createElement("video");
          // Le son de l'overlay est mixé séparément via Web Audio si !ov.muted —
          // l'élément lui-même reste toujours muted pour éviter un double-son.
          v.crossOrigin = "anonymous";
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
    const rw = rect?.width || canvas.width, rh = rect?.height || canvas.height;
    const s = Math.min(canvas.width / rw, canvas.height / rh);
    const offsetX = (canvas.width - rw * s) / 2;
    const offsetY = (canvas.height - rh * s) / 2;

    // captureStream() sur <canvas> est très largement supporté (contrairement à
    // captureStream() sur <video>, absent sur certains WebView Android — c'était
    // la cause du bug "rien ne s'applique" : le bake plantait puis retombait sur
    // la vidéo brute). Pour le son, on passe TOUJOURS par Web Audio, qui fonctionne
    // même sur les éléments <video> muted et ne dépend pas de video.captureStream().
    const canvasStream = canvas.captureStream(30);
    let soundEl = null;
    try {
      const actx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = actx.createMediaStreamDestination();

      const mainGain = actx.createGain();
      mainGain.gain.value = soundMix ? (soundMix.mainVolume ?? 100) / 100 : 1;
      try { actx.createMediaElementSource(mainVideo).connect(mainGain).connect(dest); } catch (e) { /* déjà connectée ailleurs */ }

      loaded.filter((ov) => ov.type === "video" && !ov.muted).forEach((ov) => {
        try { actx.createMediaElementSource(ov.el).connect(dest); } catch (e) { /* déjà connectée ailleurs */ }
      });

      if (soundMix?.src) {
        soundEl = document.createElement("audio");
        soundEl.src = soundMix.src;
        soundEl.crossOrigin = "anonymous";
        await new Promise((r) => { soundEl.onloadedmetadata = r; soundEl.onerror = r; });
        const soundStart = soundMix.offset || 0;
        const soundStop = soundMix.trimEnd && soundMix.trimEnd > soundStart ? soundMix.trimEnd : soundEl.duration;
        soundEl.currentTime = soundStart;
        soundEl.loop = true;
        soundEl.addEventListener("timeupdate", () => {
          if (soundEl.currentTime >= soundStop) soundEl.currentTime = soundStart;
        });        const soundGain = actx.createGain();
        soundGain.gain.value = (soundMix.volume ?? 100) / 100;
        try { actx.createMediaElementSource(soundEl).connect(soundGain).connect(dest); } catch (e) { /* déjà connectée ailleurs */ }
      }

      dest.stream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
    } catch (e) {
      console.error("bake audio mix:", e);
    }

    const mimeCandidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/mp4";
    const rec = new MediaRecorder(canvasStream, { mimeType: mime, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const finished = new Promise((resolve) => {
      rec.onstop = () => {
        const raw = new Blob(chunks, { type: mime });
        fixWebmDuration(raw, mainVideo.duration * 1000, (fixed) => resolve(fixed));
      };
    });

    rec.start(200);
    mainVideo.currentTime = 0;
    await mainVideo.play();
    loaded.forEach((ov) => { if (ov.type === "video") ov.el.play().catch(() => {}); });
    if (soundEl) soundEl.play().catch(() => {});

    const draw = () => {
      if (cancelToken?.cancelled) { if (rec.state !== "inactive") rec.stop(); return; }
      if (mainVideo.ended || mainVideo.paused) { rec.stop(); return; }
      if (onProgress && mainVideo.duration) {
        onProgress(Math.min(99, Math.round((mainVideo.currentTime / mainVideo.duration) * 100)));
      }
      ctx.drawImage(mainVideo, 0, 0, canvas.width, canvas.height);
      loaded.forEach((ov) => {
        if (ov.type === "text") {
          ctx.font = `bold ${ov.size * s}px "${ov.font}"`;
          ctx.fillStyle = ov.color;
          ctx.shadowColor = "rgba(0,0,0,0.85)";
          ctx.shadowBlur = 10 * s;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          wrapText(ctx, ov.value, ov.x * s + offsetX, ov.y * s + offsetY, 0.72 * canvas.width, ov.size * s * 1.2, ov.bg, true);
        } else if (ov.el && !ov.broken) {
  try { ctx.drawImage(ov.el, ov.x * s + offsetX, ov.y * s + offsetY, ov.size * s, ov.size * s); }
  catch (e) { /* overlay cassé : on l'ignore plutôt que d'arrêter tout le bake */ }
}
      });
      requestAnimationFrame(draw);
    };
    draw();

    // Filet de sécurité : si le traitement dépasse 45s (vidéo anormalement
    // longue, WebView lente, etc.), on force l'arrêt plutôt que de rester
    // bloqué indéfiniment sur "Publication en cours…".
    const safetyTimeout = setTimeout(() => {
      if (rec.state !== "inactive") rec.stop();
    }, 45000);

    const result = await finished;
    clearTimeout(safetyTimeout);
    if (cancelToken?.cancelled) return null;
    return result;
  } catch (e) {
    console.error("bakeOverlaysOnVideo:", e);
    return sourceBlob; // en cas de souci, on renvoie la vidéo brute plutôt que planter
  }
}

// ── Recadre une vidéo importée entre [start,end] (re-encodage réel, pas juste un marqueur) ──
async function trimVideoBlob(sourceFile, start, end, onProgress, cancelToken) {
  try {
    const mainVideo = document.createElement("video");
    mainVideo.src = URL.createObjectURL(sourceFile);
    mainVideo.muted = false;
    mainVideo.playsInline = true;
    await new Promise((r) => { mainVideo.onloadedmetadata = r; });

    const canvas = document.createElement("canvas");
    canvas.width = mainVideo.videoWidth;
    canvas.height = mainVideo.videoHeight;
    const ctx = canvas.getContext("2d");
    const canvasStream = canvas.captureStream(30);

    try {
      const actx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = actx.createMediaStreamDestination();
      actx.createMediaElementSource(mainVideo).connect(dest);
      dest.stream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
    } catch (e) { console.error("trimVideoBlob audio:", e); }

    const mimeCandidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/mp4";
    const rec = new MediaRecorder(canvasStream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    const finished = new Promise((resolve) => {
      rec.onstop = () => {
        const raw = new Blob(chunks, { type: mime });
        fixWebmDuration(raw, (end - start) * 1000, (fixed) => resolve(fixed));
      };
    });

    rec.start(200);
    mainVideo.currentTime = start;
    await mainVideo.play();

    const draw = () => {
      if (cancelToken?.cancelled) { if (rec.state !== "inactive") rec.stop(); return; }
      if (mainVideo.ended || mainVideo.currentTime >= end) { rec.stop(); return; }
      if (onProgress) onProgress(Math.min(99, Math.round(((mainVideo.currentTime - start) / (end - start)) * 100)));
      ctx.drawImage(mainVideo, 0, 0, canvas.width, canvas.height);
      requestAnimationFrame(draw);
    };
    draw();

    const safetyTimeout = setTimeout(() => { if (rec.state !== "inactive") rec.stop(); }, 45000);
    const result = await finished;
    clearTimeout(safetyTimeout);
    mainVideo.pause();
    if (cancelToken?.cancelled) return null;
    return result;
  } catch (e) {
    console.error("trimVideoBlob:", e);
    return sourceFile; // en cas de souci, on renvoie le fichier brut plutôt que planter
  }
}

// ── Pastille de progression en arrière-plan ─────────────────────────
// Créée en DOM natif (pas via React) pour continuer à s'afficher même
// après la fermeture du modal caméra, pendant que la vidéo se traite.
// onCancel (optionnel) affiche un bouton "Annuler" tant que le traitement tourne.
function showBackgroundProgress(onCancel) {
  const pill = document.createElement("div");
  pill.style.cssText = `
    position:fixed;bottom:26px;left:50%;transform:translateX(-50%);
    background:rgba(20,20,20,0.95);color:#fff;padding:10px 14px 10px 18px;border-radius:22px;
    font-family:sans-serif;font-size:13px;font-weight:600;z-index:99999;
    display:flex;align-items:center;gap:10px;box-shadow:0 6px 24px rgba(0,0,0,0.5);
  `;
  const spinner = document.createElement("div");
  spinner.style.cssText = `width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,0.25);border-top-color:#C9952A;flex-shrink:0;`;
  let deg = 0;
  const spin = setInterval(() => { deg = (deg + 30) % 360; spinner.style.transform = `rotate(${deg}deg)`; }, 60);
  const label = document.createElement("span");
  label.textContent = "Publication en cours… 0%";
  pill.appendChild(spinner); pill.appendChild(label);

  let cancelBtn = null;
  if (onCancel) {
    cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Annuler";
    cancelBtn.style.cssText = `
      background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);color:#fff;
      border-radius:14px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;
    `;
    cancelBtn.onclick = () => { cancelBtn.disabled = true; cancelBtn.style.opacity = "0.5"; onCancel(); };
    pill.appendChild(cancelBtn);
  }
  document.body.appendChild(pill);

  return {
    update: (pct) => { label.textContent = `Publication en cours… ${pct}%`; },
    done: (msg) => { clearInterval(spin); spinner.remove(); if (cancelBtn) cancelBtn.remove(); label.textContent = msg || "Publié ✓"; setTimeout(() => pill.remove(), 1800); },
    fail: (msg) => { clearInterval(spin); spinner.remove(); if (cancelBtn) cancelBtn.remove(); label.textContent = msg || "Échec de la publication"; setTimeout(() => pill.remove(), 2500); },
  };
}

// ── COMPOSANT PRINCIPAL ─────────────────────────────────────────────
export default function CameraStudioModal({ onClose, onDone, onSaveDraft, onOpenDrafts, sb, initialSound, initialDraft, T, userId }) {
  const overlayRef  = useRef(null);
  const recRef      = useRef(null);
  const chunksRef   = useRef([]);
  const timerRef    = useRef(null);
  const fileRef     = useRef(null);
  const imgRef      = useRef(null);
  const vidOvRef    = useRef(null);

   const previewVidRef = useRef(null);
  const previewSoundElRef = useRef(null); // <audio> qui joue le son ajouté PENDANT la preview (avant export)

  const [phase,      setPhase]      = useState("camera"); // camera(=choix) | preview | textcard | trim
  const [blob,       setBlob]       = useState(null);
  const [url,        setUrl]        = useState(null);
  const [isVid,      setIsVid]      = useState(false);
  const [videoDuration, setVideoDuration] = useState(0); // durée réelle de la vidéo choisie/recadrée
  const [overlays,   setOverlays]   = useState([]);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [activeOv,   setActiveOv]   = useState(null);
  const [panel,      setPanel]      = useState(null);
  const [newText,    setNewText]    = useState("");
  const [txtColor,   setTxtColor]   = useState("#FFFFFF");
  const [txtBg,      setTxtBg]      = useState(null); // null | "#FFFFFF" | "#000000"
  const [txtSize,    setTxtSize]    = useState(24);
  const [txtFont,    setTxtFont]    = useState("Space Grotesk");

  const [toast,      setToast]      = useState(null);
  const [mainVolume,  setMainVolume]  = useState(100); // volume du son ORIGINAL de la vidéo (0-100)
  const [soundVolume, setSoundVolume] = useState(100); // volume du son AJOUTÉ (0-100)
   const [soundOffset, setSoundOffset] = useState(0);   // point de départ (s) du segment choisi dans le son ajouté
  const [soundEnd,    setSoundEnd]    = useState(0);   // point de fin (s) du segment choisi dans le son ajouté
  const [selectedSoundDuration, setSelectedSoundDuration] = useState(0);
  const [pendingTrim,  setPendingTrim]  = useState(null); // {file,url,duration} — vidéo importée en attente de recadrage
  const [pendingCrop,  setPendingCrop]  = useState(null); // {file,url,naturalW,naturalH} — photo importée en attente de rognage
  const [cropScale,    setCropScale]    = useState(1);
  const [cropX,        setCropX]        = useState(0);
  const [cropY,        setCropY]        = useState(0);
  const cropFrameRef = useRef(null);
  const [trimStart,    setTrimStart]    = useState(0);
  const [trimEnd,      setTrimEnd]      = useState(0);
  const [trimming,     setTrimming]     = useState(false);
  const [trimProgress, setTrimProgress] = useState(0);
  const [gradIdx,    setGradIdx]    = useState(0);
  const [cardText,   setCardText]   = useState("");
  const [sharing,    setSharing]    = useState(false);

  // ── Son attaché au post (existant depuis la bibliothèque, ou fraîchement enregistré) ──
  const [selectedSound, setSelectedSound] = useState(initialSound || null); // {id,title,url} existant OU {title,blob,isNew:true} nouveau

  const handleSoundPicked = (sound) => {
    setSelectedSound(sound);
    if (!sound || !isVid) return;
    const previewUrl = sound.url || (sound.blob ? URL.createObjectURL(sound.blob) : null);
    if (!previewUrl) return;
    const a = new Audio(previewUrl);
    a.onloadedmetadata = () => {
      setSelectedSoundDuration(a.duration || 0);
      setSoundOffset(0);
      setMainVolume(100); setSoundVolume(100);
      setPanel("sound-mix");
    };
  };
  const [soundPanelLoading, setSoundPanelLoading] = useState(false);
  const [trendingSounds, setTrendingSounds] = useState([]);
  const [recordingSound, setRecordingSound] = useState(false);
  const [soundSecs, setSoundSecs] = useState(0);
  const soundRecRef = useRef(null);
  const soundChunksRef = useRef([]);
  const soundTimerRef = useRef(null);
  const recSoundRef = useRef(null); // <audio> qui joue le son choisi PENDANT le tournage (monitoring, pour pouvoir danser/synchroniser)
  const SOUND_MAX_SECS = 15; // contrainte demandée : jamais plus de 15s

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1800); };

  // ── Ouvre le panel son, charge les sons tendance ──────────────────
  const openSoundPanel = useCallback(async () => {
    setPanel("sound");
    if (!sb) return;
    setSoundPanelLoading(true);
    try {
      const { data, error } = await sb.from("sounds").select("id,title,url,usage_count").order("usage_count", { ascending: false }).limit(20);
      if (!error) setTrendingSounds(data || []);
    } finally {
      setSoundPanelLoading(false);
    }
  }, [sb]);

  // ── Enregistrer un son original, 15s max, compressé (32kbps) ──────
  const stopSoundRecording = useCallback(() => {
    if (soundRecRef.current && soundRecRef.current.state !== "inactive") soundRecRef.current.stop();
    clearInterval(soundTimerRef.current);
    setRecordingSound(false);
  }, []);

  const startSoundRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "audio/webm";
      // 32kbps : largement suffisant pour un son de fond, garde le fichier très léger (essentiel pour le scroll fluide du feed)
      const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 });
      soundChunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) soundChunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const soundBlob = new Blob(soundChunksRef.current, { type: mime });
        setSelectedSound({ title: "Mon son", blob: soundBlob, url: URL.createObjectURL(soundBlob), isNew: true });
        if (!isVid) { setPanel(null); return; }
        setSelectedSoundDuration(soundSecs);
        setSoundOffset(0);
        setSoundEnd(soundSecs);
        setMainVolume(100); setSoundVolume(100);
        setPanel("sound-mix");      };
      soundRecRef.current = rec;
      rec.start();
      setRecordingSound(true);
      setSoundSecs(0);
      soundTimerRef.current = setInterval(() => {
        setSoundSecs((s) => {
          if (s + 1 >= SOUND_MAX_SECS) { stopSoundRecording(); return SOUND_MAX_SECS; }
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      showToast("Micro indisponible — vérifie les autorisations");
    }
  }, [stopSoundRecording]);

  // ── Lecture du son PENDANT le tournage (monitoring) ─────────────
  // Ne fait pas partie de l'enregistrement (le flux capturé reste caméra+micro
  // brut) : c'est juste pour que tu puisses te caler dessus / danser dessus.
  // Le vrai mixage propre (celui qui finit dans le fichier exporté) se fait
  // séparément via bakeOverlaysOnVideo. On boucle le son pour ne pas qu'il
  // s'arrête en plein milieu d'une prise plus longue que le son lui-même.
  const startSoundMonitor = useCallback(() => {
    if (!selectedSound?.url) return;
    const a = new Audio(selectedSound.url);
    a.loop = true;
    a.currentTime = soundOffset || 0;
    a.volume = (soundVolume ?? 100) / 100;
    a.play().catch(() => {});
    recSoundRef.current = a;
  }, [selectedSound, soundOffset, soundVolume]);

  const pauseSoundMonitor = () => { recSoundRef.current?.pause(); };
  const resumeSoundMonitor = () => { recSoundRef.current?.play().catch(() => {}); };
  const stopSoundMonitor = () => {
    if (recSoundRef.current) {
      recSoundRef.current.pause();
      recSoundRef.current.currentTime = 0;
      recSoundRef.current = null;
    }
  };

   // Prévisualisation vidéo avec son (tente non-muet, retombe en muet si le navigateur bloque l'autoplay avec son)
  useEffect(() => {
    if (phase === "preview" && isVid && previewVidRef.current) {
      previewVidRef.current.volume = (mainVolume ?? 100) / 100;
      previewVidRef.current.muted = false;
      previewVidRef.current.play().catch(() => {
        if (previewVidRef.current) { previewVidRef.current.muted = true; previewVidRef.current.play().catch(() => {}); }
      });
    }
  }, [phase, isVid, url]);

  // Le volume du son ORIGINAL de la vidéo réagit en direct au curseur, sans redémarrer la lecture
  useEffect(() => {
    if (previewVidRef.current) previewVidRef.current.volume = (mainVolume ?? 100) / 100;
  }, [mainVolume]);

  // ── Prévisualisation en direct du son AJOUTÉ (avant export) ──────
  useEffect(() => {
    if (previewSoundElRef.current) {
      previewSoundElRef.current.pause();
      previewSoundElRef.current = null;
    }
    if (phase !== "preview" || !selectedSound?.url) return;
    const a = new Audio(selectedSound.url);
    a.volume = (soundVolume ?? 100) / 100;
    const start = soundOffset || 0;
    a.currentTime = start;
    a.addEventListener("loadedmetadata", () => { a.currentTime = start; });
    a.addEventListener("timeupdate", () => {
      const stop = soundEnd && soundEnd > start ? soundEnd : a.duration;
      if (a.currentTime >= stop) a.currentTime = start;
    });
    const playIfNeeded = () => { if (!isVid || !previewVidRef.current?.paused) a.play().catch(() => {}); };
    playIfNeeded();
    previewSoundElRef.current = a;
    const vid = previewVidRef.current;
    const onPlay = () => a.play().catch(() => {});
    const onPause = () => a.pause();
    vid?.addEventListener("play", onPlay);
    vid?.addEventListener("pause", onPause);
    return () => {
      a.pause();
      vid?.removeEventListener("play", onPlay);
      vid?.removeEventListener("pause", onPause);
    };
  }, [phase, selectedSound, soundOffset, soundEnd, isVid]);

  // Volume du son AJOUTÉ : mise à jour en direct, sans relancer la lecture
  useEffect(() => {
    if (previewSoundElRef.current) previewSoundElRef.current.volume = (soundVolume ?? 100) / 100;
  }, [soundVolume]);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      stopSoundMonitor();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Galerie ─────────────────────────────────────────────────────
  const pickGallery = () => fileRef.current?.click();
  const onGalleryPick = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    e.target.value = "";
    if (!f.type.startsWith("video/")) {
      const img = new Image();
      img.src = URL.createObjectURL(f);
      img.onload = () => {
        setPendingCrop({ file: f, url: img.src, naturalW: img.naturalWidth, naturalH: img.naturalHeight });
        setCropScale(1); setCropX(0); setCropY(0);
        setPhase("crop");
      };
      return;
    }
    const tmp = document.createElement("video");
    tmp.src = URL.createObjectURL(f);
    tmp.onloadedmetadata = () => {
      setPendingTrim({ file: f, url: tmp.src, duration: tmp.duration });
      setTrimStart(0);
      setTrimEnd(Math.min(tmp.duration, 60));
      setPhase("trim");
    };
  };

  const cancelTrim = () => {
    if (blob) { setPhase("preview"); return; }
    setPendingTrim(null); setPhase("camera");
  };

  const confirmTrim = async () => {
    if (!pendingTrim) return;
    // Si l'utilisateur n'a rien coupé (garde la vidéo entière), on évite le
    // ré-encodage temps réel — c'est lui qui abîmait la vidéo (saccades).
    const noRealCut = trimStart <= 0.05 && trimEnd >= pendingTrim.duration - 0.05;
    if (noRealCut) {
      setVideoDuration(pendingTrim.duration);
      finish(pendingTrim.file, pendingTrim.url, true);
      return;
    }
    setTrimming(true);
    const cancelToken = { cancelled: false };
    const cut = await trimVideoBlob(pendingTrim.file, trimStart, trimEnd, setTrimProgress, cancelToken);
    setTrimming(false);
    if (!cut) return;
    setVideoDuration(trimEnd - trimStart);
    finish(cut, URL.createObjectURL(cut), true);
  };

  // ── Rognage photo (zoom + déplacement dans le cadre 9:16) ────────
  const cropBounds = () => {
    const frame = cropFrameRef.current;
    if (!frame || !pendingCrop) return { maxX: 0, maxY: 0 };
    const fw = frame.clientWidth, fh = frame.clientHeight;
    const cover = Math.max(fw / pendingCrop.naturalW, fh / pendingCrop.naturalH);
    const total = cover * cropScale;
    const dw = pendingCrop.naturalW * total, dh = pendingCrop.naturalH * total;
    return { maxX: Math.max(0, (dw - fw) / 2), maxY: Math.max(0, (dh - fh) / 2) };
  };
  const clampCrop = (x, y) => {
    const { maxX, maxY } = cropBounds();
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };
  const onCropScale = (v) => {
    setCropScale(v);
    setCropX((x) => clampCrop(x, cropY).x);
    setCropY((y) => clampCrop(cropX, y).y);
  };
  const cropDown = (e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const pointerId = e.pointerId;
    const startX = e.clientX, startY = e.clientY;
    const ox = cropX, oy = cropY;
    const mv = (e2) => {
      if (e2.pointerId !== pointerId) return;
      const c = clampCrop(ox + (e2.clientX - startX), oy + (e2.clientY - startY));
      setCropX(c.x); setCropY(c.y);
    };
    const end = () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };
  const cancelCrop = () => {
    if (blob) { setPhase("preview"); return; }
    setPendingCrop(null); setPhase("camera");
  };
  const confirmCrop = () => {
    const frame = cropFrameRef.current;
    if (!frame || !pendingCrop) return;
    const fw = frame.clientWidth, fh = frame.clientHeight;
    const cover = Math.max(fw / pendingCrop.naturalW, fh / pendingCrop.naturalH);
    const total = cover * cropScale;
    const dw = pendingCrop.naturalW * total, dh = pendingCrop.naturalH * total;
    const imgLeft = (fw - dw) / 2 + cropX, imgTop = (fh - dh) / 2 + cropY;
    const sx = -imgLeft / total, sy = -imgTop / total;
    const sw = fw / total, sh = fh / total;
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = Math.round(1080 * (fh / fw));
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => { if (b) finish(b, URL.createObjectURL(b), false); }, "image/jpeg", 0.92);
    };
    img.src = pendingCrop.url;
  };
  const pickOverlayImg = () => imgRef.current?.click();
  const onOverlayImg = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    addOverlay({ type: "image", value: URL.createObjectURL(f), size: 120 });
    e.target.value = ""; setPanel(null);
  };
  const onStickerPicked = (sticker) => {
    addOverlay({ type: "image", value: sticker.url, size: 120 });
    setShowStickerPicker(false); setPanel(null);
    if (sticker.id) Promise.resolve(sb?.rpc?.("increment_sticker_usage", { sticker_id: sticker.id })).catch(() => {});
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
    setBlob(b); setUrl(u); setIsVid(v);
    setPhase("preview"); setPanel(null);
  };

  // Restaure un brouillon ouvert depuis la galerie
  useEffect(() => {
    if (!initialDraft) return;
    const u = URL.createObjectURL(initialDraft.blob);
    finish(initialDraft.blob, u, initialDraft.type === "video");
    if (initialDraft.overlays) setOverlays(initialDraft.overlays);
  }, []);
  const retake = () => {
    stopSoundMonitor();
    setBlob(null); setUrl(null); setOverlays([]); setActiveOv(null);
    setPhase("camera"); setPanel(null);
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
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  const ov = overlays.find((o) => o.id === id);
  const box = overlayRef.current?.getBoundingClientRect();
  const bx = box?.left || 0, by = box?.top || 0;
  const startX = e.clientX, startY = e.clientY;
  const pointerId = e.pointerId;
  let moved = false;
  const ox = (e.clientX - bx) - (ov?.x || 0), oy = (e.clientY - by) - (ov?.y || 0);
  const mv = (e2) => {
    if (e2.pointerId !== pointerId) return;
    e2.preventDefault?.();
    if (!moved && (Math.abs(e2.clientX - startX) > 6 || Math.abs(e2.clientY - startY) > 6)) moved = true;
    if (!moved) return;
    const b2 = overlayRef.current?.getBoundingClientRect();
    const bx2 = b2?.left || 0, by2 = b2?.top || 0;
    setOverlays((os) => os.map((o) => (o.id === id
      ? { ...o, x: (e2.clientX - bx2) - ox, y: (e2.clientY - by2) - oy }
      : o)));
  };
  const end = (evEnd) => {
    window.removeEventListener("pointermove", mv);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", cancel);
    if (!moved && evEnd?.type !== "pointercancel") {
      setActiveOv(ov);
      if (ov?.type === "text") { setNewText(ov.value); setTxtColor(ov.color); setTxtBg(ov.bg || null); setTxtSize(ov.size); setTxtFont(ov.font); setPanel("text"); }
    }
  };
  const cancel = (evCancel) => end(evCancel);
  window.addEventListener("pointermove", mv);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", cancel);
};

  // Poignée de redimensionnement (agrandir / rétrécir un overlay)
  const rDown = (e, id) => {
    e.stopPropagation();
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const ov = overlays.find((o) => o.id === id);
    const startSize = ov?.size;
    const pointerId = e.pointerId;
    const startX = e.clientX;
    let on = true;
    const mv = (e2) => {
      if (!on || e2.pointerId !== pointerId) return;
      const delta = e2.clientX - startX;
      const o = overlays.find((x) => x.id === id);
      if (!o) return;
      if (o.type === "text") {
        const next = Math.max(12, Math.min(96, startSize + delta * 0.4));
        updOv(id, { size: Math.round(next) });
      } else {
        const next = Math.max(40, Math.min(320, startSize + delta));
        updOv(id, { size: Math.round(next) });
      }
    };
    const end = () => {
      on = false;
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  const confirmText = () => {
    if (!newText.trim()) { setPanel(null); return; }
    if (activeOv?.type === "text" && activeOv?.id) {
      updOv(activeOv.id, { value: newText, color: txtColor, bg: txtBg, size: txtSize, font: txtFont });
    } else {
      addOverlay({ type: "text", value: newText, color: txtColor, bg: txtBg, size: txtSize, font: txtFont });
    }
    setNewText(""); setPanel(null); setActiveOv(null);
  };

  // ── Export final ────────────────────────────────────────────────
  const exportFinal = async () => {
    if (!blob) return;
    const soundSrcForVideo = isVid && selectedSound
      ? (selectedSound.url || (selectedSound.blob ? URL.createObjectURL(selectedSound.blob) : null))
      : null;
    const needsWork = overlays.length > 0 || !!soundSrcForVideo || (isVid && mainVolume !== 100);

    if (!isVid) {
      if (!needsWork) {
        onDone({ file: new File([blob], "celeste-photo.jpg", { type: "image/jpeg" }), type: "image", sound: selectedSound });
        return;
      }
      const img = new Image(); img.src = url;
      await new Promise((r) => { img.onload = r; });
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const rect = overlayRef.current?.getBoundingClientRect();
      const rw = rect?.width || img.width, rh = rect?.height || img.height;
      const s = Math.min(img.width / rw, img.height / rh);
      const offsetX = (img.width - rw * s) / 2;
      const offsetY = (img.height - rh * s) / 2;
      for (const ov of overlays) {
        if (ov.type === "text") {
          ctx.font = `bold ${ov.size * s}px "${ov.font}"`;
          ctx.fillStyle = ov.color; ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 10 * s;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          wrapText(ctx, ov.value, ov.x * s + offsetX, ov.y * s + offsetY, 0.72 * c.width, ov.size * s * 1.2, ov.bg, true);
        } else if (ov.type === "image" || ov.type === "video") {
  const oi = ov.el || new Image();
  if (!ov.el) { oi.crossOrigin = "anonymous"; oi.src = ov.value; await new Promise((r) => { oi.onload = r; oi.onerror = r; }); }
  const broken = oi.tagName === "IMG" ? oi.naturalWidth === 0 : oi.videoWidth === 0;
  if (!broken) {
    try { ctx.drawImage(oi, ov.x * s + offsetX, ov.y * s + offsetY, ov.size * s, ov.size * s); }
    catch (e) { console.warn("Overlay illisible, ignoré :", ov.value, e); }
  } else {
    console.warn("Overlay illisible (URL invalide ?), ignoré :", ov.value);
  }
}
      }
      c.toBlob((b) => onDone({ file: new File([b], "celeste-photo.jpg", { type: "image/jpeg" }), type: "image", sound: selectedSound }), "image/jpeg", 0.95);
      return;
    }

    // Vidéo
    if (!needsWork) {
      onDone({ file: new File([blob], `celeste.${extFor(blob)}`, { type: blob.type || "video/webm" }), type: "video", sound: selectedSound });
      return;
    }

    // On capture tout ce dont on a besoin AVANT de fermer le modal,
    // car les refs React (overlayRef) ne seront plus valides après.
    const rect = overlayRef.current?.getBoundingClientRect();
    const ovsSnapshot = overlays;
    const blobSnapshot = blob;
    const modeSnapshot = isVid ? "VIDEO" : "PHOTO";
   const soundMixSnapshot = (soundSrcForVideo || mainVolume !== 100)
      ? { src: soundSrcForVideo, offset: soundOffset, trimEnd: soundEnd, volume: soundVolume, mainVolume }
      : null;
    const saveDraft = onSaveDraft; // référence capturée : reste utilisable après le unmount

    const cancelToken = { cancelled: false };
    const progress = showBackgroundProgress(async () => {
      cancelToken.cancelled = true;
      progress.fail("Annulé — brouillon enregistré");
      if (saveDraft) {
        try {
          await saveDraft({ blob: blobSnapshot, overlays: ovsSnapshot, mode: modeSnapshot, type: "video" });
        } catch (e) {
          console.error("saveDraft:", e);
        }
      }
    });
    onClose(); // on rend la main tout de suite : l'utilisateur continue d'utiliser l'app

    bakeOverlaysOnVideo(blobSnapshot, ovsSnapshot, rect, (pct) => progress.update(pct), cancelToken, soundMixSnapshot)
      .then((finalBlob) => {
        if (cancelToken.cancelled || !finalBlob) return; // déjà géré par le bouton Annuler
        progress.done();
        onDone({ file: new File([finalBlob], `celeste.${extFor(finalBlob)}`, { type: finalBlob.type || "video/webm" }), type: "video", sound: selectedSound });
      })
      .catch(() => { if (!cancelToken.cancelled) progress.fail(); });
  };

  // ── Éditer ailleurs ──────────────────────────────────────────────
  // Envoie le fichier capturé vers le partage natif (CapCut, Photos, etc.).
  // Techniquement impossible de "récupérer" automatiquement le résultat édité —
  // aucune app tierce ne peut renvoyer un fichier à Céleste. À la place, on
  // ramène directement l'utilisateur sur la sélection galerie : il choisit le
  // fichier fraîchement édité (enregistré par l'autre app) en un seul geste.
  const editElsewhere = async () => {
    if (!blob || sharing) return;
    setSharing(true);
    try {
      const fileName = `celeste-edit-${Date.now()}.${isVid ? extFor(blob) : "jpg"}`;
      if (Capacitor.isNativePlatform()) {
        const base64 = await blobToBase64(blob);
        const written = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        await Share.share({ title: "Modifier avec…", dialogTitle: "Modifier avec…", files: [written.uri] });
      } else if (navigator.share && navigator.canShare) {
        const file = new File([blob], fileName, { type: blob.type || (isVid ? "video/webm" : "image/jpeg") });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Modifier avec…" });
        } else {
          showToast("Partage de fichier non disponible sur ce navigateur");
          setSharing(false);
          return;
        }
      } else {
        showToast("Partage non disponible sur cet appareil");
        setSharing(false);
        return;
      }
      showToast("Choisis le fichier édité dans ta galerie");
      setTimeout(() => { setSharing(false); pickGallery(); }, 700);
    } catch (e) {
      console.error("editElsewhere:", e);
      // AbortError = l'utilisateur a juste fermé le menu de partage, pas une vraie erreur
      if (e?.name !== "AbortError") showToast("Impossible de partager ce fichier");
      setSharing(false);
    }
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
    c.toBlob((b) => onDone({ file: new File([b], "celeste-texte.jpg", { type: "image/jpeg" }), type: "image", sound: selectedSound }), "image/jpeg", 0.95);
  };

  // ── Écran mode TEXTE ─────────────────────────────────────────────
  if (phase === "textcard") {
    const [c1, c2] = GRADIENTS[gradIdx];
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 600, background: `linear-gradient(160deg, ${c1}, ${c2})`, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "52px 16px 0" }}>
          <button onClick={() => setPhase("camera")} style={Ic()}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px" }}>
          <textarea
            value={cardText} onChange={(e) => setCardText(e.target.value.slice(0, 200))}
            placeholder="Écris quelque chose…" autoFocus rows={4} maxLength={200}
            style={{ width: "100%", background: "transparent", border: "none", outline: "none", resize: "none",
              color: txtColor, fontFamily: `'${txtFont}',sans-serif`, fontWeight: 800, fontSize: 32,
              textAlign: "center", textShadow: "0 2px 20px rgba(0,0,0,0.4)" }} />
          <p style={{ margin: "10px 0 0", fontSize: 12, color: cardText.length >= 200 ? "#FF6B6B" : "rgba(255,255,255,0.5)", textAlign: "center" }}>{cardText.length}/200</p>
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

  if (phase === "crop" && pendingCrop) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 600, background: "#000", display: "flex", flexDirection: "column" }}>
        <div style={{ position: "relative", flex: 1, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div ref={cropFrameRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
            onPointerDown={cropDown}>
            <img src={pendingCrop.url} alt="" draggable={false}
              style={{ position: "absolute", top: "50%", left: "50%", width: "100%", height: "100%", objectFit: "cover",
                transform: `translate(-50%,-50%) translate(${cropX}px,${cropY}px) scale(${cropScale})`,
                pointerEvents: "none", userSelect: "none" }} />
          </div>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "52px 16px 0", display: "flex", justifyContent: "space-between", pointerEvents: "none" }}>
            <button onClick={cancelCrop} style={{ ...Ic(), pointerEvents: "auto" }}><X size={18} /></button>
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 700, background: "rgba(0,0,0,0.5)", padding: "8px 14px", borderRadius: 20 }}>
              Déplace et zoome l'image
            </span>
          </div>
        </div>
        <div style={{ background: "rgba(6,6,6,0.97)", padding: "18px 20px 34px" }}>
          <input type="range" min={1} max={3} step={0.01} value={cropScale}
            onChange={(e) => onCropScale(Number(e.target.value))}
            style={{ width: "100%" }} />
          <button onClick={confirmCrop}
            style={{ marginTop: 16, width: "100%", padding: "14px", borderRadius: 20, border: "none",
              background: "linear-gradient(135deg,#C9952A 0%,#E8B84B 100%)", color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
            Valider ce cadrage
          </button>
        </div>
      </div>
    );
  }

  if (phase === "trim" && pendingTrim) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 600, background: "#000", display: "flex", flexDirection: "column" }}>
        <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
          <video src={pendingTrim.url} autoPlay loop muted playsInline
            onTimeUpdate={(e) => { if (e.target.currentTime >= trimEnd) e.target.currentTime = trimStart; }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "52px 16px 0", display: "flex", justifyContent: "space-between" }}>
            <button onClick={cancelTrim} style={Ic()}><X size={18} /></button>
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 700, background: "rgba(0,0,0,0.5)", padding: "8px 14px", borderRadius: 20 }}>
              Choisis le début et la fin
            </span>
          </div>
        </div>
        <div style={{ background: "rgba(6,6,6,0.97)", padding: "18px 20px 34px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
            <span>Début : {trimStart.toFixed(1)}s</span>
            <span>Fin : {trimEnd.toFixed(1)}s</span>
            <span>Durée : {(trimEnd - trimStart).toFixed(1)}s</span>
          </div>
          <input type="range" min={0} max={pendingTrim.duration} step={0.1} value={trimStart}
            onChange={(e) => setTrimStart(Math.min(Number(e.target.value), trimEnd - 0.3))}
            style={{ width: "100%" }} />
          <input type="range" min={0} max={pendingTrim.duration} step={0.1} value={trimEnd}
            onChange={(e) => setTrimEnd(Math.max(Number(e.target.value), trimStart + 0.3))}
            style={{ width: "100%", marginTop: 6 }} />
          <button onClick={confirmTrim} disabled={trimming}
            style={{ marginTop: 16, width: "100%", padding: "14px", borderRadius: 20, border: "none",
              background: "linear-gradient(135deg,#C9952A 0%,#E8B84B 100%)", color: "#000", fontWeight: 800, fontSize: 15,
              cursor: trimming ? "default" : "pointer", opacity: trimming ? 0.6 : 1 }}>
            {trimming ? `Découpage… ${trimProgress}%` : "Valider ce passage"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, backgroundImage: `url(${isLightBg(T?.bg) ? previewLight : previewDark})`, backgroundSize: "cover", backgroundPosition: "center", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={onGalleryPick} />
      <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onOverlayImg} />
      <input ref={vidOvRef} type="file" accept="video/*" style={{ display: "none" }} onChange={onOverlayVideo} />

      {/* ── Zone visuelle ── */}
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        {phase === "preview" && !isVid && (
          <img src={url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {phase === "preview" && isVid && (
          <video src={url} autoPlay loop playsInline ref={previewVidRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}

        {phase === "preview" && (
          <div ref={overlayRef} style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}>
            {overlays.map((ov) => (
               <div key={ov.id} onPointerDown={(e) => pDown(e, ov.id)}
                style={{ position: "absolute", left: ov.x, top: ov.y, cursor: "move", userSelect: "none", touchAction: "none" }}>                {ov.type === "text" && (
                   <span style={{ fontFamily: `'${ov.font}',sans-serif`, fontSize: ov.size, color: ov.color, fontWeight: 700,
                    textShadow: ov.bg ? "none" : "0 2px 14px rgba(0,0,0,0.95)", whiteSpace: "pre-wrap", wordBreak: "break-word",
                    display: "block", maxWidth: "72vw", textAlign: "center", background: ov.bg || "transparent",
                    padding: ov.bg ? "6px 12px" : 0, borderRadius: ov.bg ? 6 : 0,
                    pointerEvents: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}>
                    {ov.value}
                  </span>
                )}
                {ov.type === "image" && (
                  <img src={ov.value} draggable={false} style={{ width: ov.size, height: ov.size, objectFit: "contain", borderRadius: 8, pointerEvents: "none" }} />
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

        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 180, background: "linear-gradient(to bottom,rgba(0,0,0,0.65),transparent)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 320, background: "linear-gradient(to top,rgba(0,0,0,0.75),transparent)", pointerEvents: "none" }} />

        {toast && (
          <div style={{ position: "absolute", top: 100, left: "50%", transform: "translateX(-50%)", background: "rgba(20,20,20,0.92)",
            color: "#fff", padding: "8px 18px", borderRadius: 20, fontSize: 12.5, zIndex: 45, whiteSpace: "nowrap" }}>
            {toast}
          </div>
        )}

        {/* ── Top bar ── */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "52px 16px 0", zIndex: 20, pointerEvents: "none" }}>
          <button onClick={onClose} style={{ ...Ic(), pointerEvents: "auto" }}><X size={18} /></button>

         {phase === "camera" && onOpenDrafts && (
            <button onClick={onOpenDrafts} style={{ ...Ic(), pointerEvents: "auto" }}><Archive size={16} /></button>
          )}

          {phase === "preview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center", pointerEvents: "auto" }}>
              <button onClick={() => { setNewText(""); setTxtBg(null); setActiveOv(null); setPanel("text"); }} style={Ic(panel === "text")}><Type size={16} /></button>
              <button onClick={pickOverlayImg} style={Ic()}><ImageIcon size={16} /></button>
              {isVid && <button onClick={pickOverlayVideo} style={Ic()}><Video size={16} /></button>}
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowStickerPicker(v => !v)} style={Ic(showStickerPicker)}><StickerIcon size={16} /></button>
                {showStickerPicker && (
                  <div style={{ position: "absolute", top: 0, right: "calc(100% + 8px)", width: 280, maxWidth: "80vw", zIndex: 50 }}>
                    <StickerPicker sb={sb} userId={userId} T={T} onClose={() => setShowStickerPicker(false)} onSelect={onStickerPicked} />
                  </div>
                )}
              </div>
             <SoundPickerButton sb={sb} value={selectedSound} onChange={handleSoundPicked} userId={userId} T={T} />
              {selectedSound && isVid && (
                <button onClick={() => setPanel("sound-mix")} style={Ic(panel === "sound-mix")}><Music2 size={16} /></button>
              )}
              <button onClick={editElsewhere} disabled={sharing} style={Ic()}><Share2 size={16} /></button>
            </div>
          )}
        </div>
      </div>
      {/* ── Zone bas ── */}
      <div style={{ position: "relative", zIndex: 20, paddingBottom: 40 }}>
        {panel === "sound" && (
          <div style={{ background: "rgba(6,6,6,0.97)", borderRadius: "24px 24px 0 0", padding: "20px 18px 14px", backdropFilter: "blur(30px)", maxHeight: "60vh", display: "flex", flexDirection: "column" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 12 }}>Choisis un son ou enregistre le tien (15s max)</span>

            {recordingSound ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "20px 0" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#FF2D55", display: "flex", alignItems: "center", justifyContent: "center", animation: "celeste-pulse 1s ease-in-out infinite" }}>
                  <Music2 size={26} color="#fff" />
                </div>
                <span style={{ color: "#fff", fontWeight: 700 }}>{soundSecs}s / {SOUND_MAX_SECS}s</span>
                <button onClick={stopSoundRecording}
                  style={{ padding: "10px 22px", borderRadius: 20, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                  Arrêter
                </button>
                <style>{`@keyframes celeste-pulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.08);} }`}</style>
              </div>
            ) : (
              <>
                <button onClick={startSoundRecording}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 14, border: "1px dashed rgba(201,149,42,0.5)",
                    background: "rgba(201,149,42,0.08)", color: "#e0b84a", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 14 }}>
                  <Music2 size={16} /> Enregistrer mon propre son
                </button>

                <div style={{ overflowY: "auto", flex: 1 }}>
                  {soundPanelLoading && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Chargement des sons…</span>}
                  {!soundPanelLoading && trendingSounds.length === 0 && (
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Aucun son tendance pour l'instant — sois le premier à en créer un !</span>
                  )}
                  {trendingSounds.map((s) => {
                    const active = selectedSound?.id === s.id;
                    return (
                      <div key={s.id} onClick={() => {
                        setSelectedSound({ id: s.id, title: s.title, url: s.url });
                        if (!isVid) { setPanel(null); return; }
                        const a = new Audio(s.url);
                        a.onloadedmetadata = () => {
                          setSelectedSoundDuration(a.duration || 0);
                          setSoundOffset(0);
                          setMainVolume(100); setSoundVolume(100);
                          setPanel("sound-mix");
                        };
                        a.onerror = () => setPanel(null);
                      }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderRadius: 12, cursor: "pointer",
                          background: active ? "rgba(201,149,42,0.15)" : "transparent", marginBottom: 4 }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", border: `2px solid ${active ? "#C9952A" : "rgba(255,255,255,0.2)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Music2 size={14} color={active ? "#C9952A" : "rgba(255,255,255,0.5)"} />
                        </div>
                        <span style={{ color: "#fff", fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                        <SoundPreviewButton url={s.url} />
                        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>{s.usage_count} posts</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <button onClick={() => setPanel(null)}
              style={{ marginTop: 12, padding: "10px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 13 }}>
              Fermer
            </button>
          </div>
        )}

        {panel === "sound-mix" && (
          <div style={{ background: "rgba(6,6,6,0.97)", borderRadius: "24px 24px 0 0", padding: "20px 18px 14px", backdropFilter: "blur(30px)" }}>
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, display: "block", marginBottom: 16 }}>Mixage du son</span>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>
                <span>Son original de la vidéo</span><span>{mainVolume}%</span>
              </div>
              <input type="range" min={0} max={100} value={mainVolume} onChange={(e) => setMainVolume(Number(e.target.value))} style={{ width: "100%" }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>
                <span>Son ajouté{selectedSound?.title ? ` — ${selectedSound.title}` : ""}</span><span>{soundVolume}%</span>
              </div>
              <input type="range" min={0} max={100} value={soundVolume} onChange={(e) => setSoundVolume(Number(e.target.value))} style={{ width: "100%" }} />
            </div>

           {selectedSoundDuration > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>
                  <span>Passage utilisé : {soundOffset.toFixed(1)}s → {soundEnd.toFixed(1)}s</span>
                  <span>sur {selectedSoundDuration.toFixed(0)}s</span>
                </div>
                <div style={{ marginBottom: 4 }}>
                  <input type="range" min={0} max={selectedSoundDuration} step={0.1}
                    value={soundOffset}
                    onChange={(e) => {
                      const v = Math.min(Number(e.target.value), soundEnd - 0.3);
                      setSoundOffset(Math.max(0, v));
                    }} style={{ width: "100%" }} />
                  <input type="range" min={0} max={selectedSoundDuration} step={0.1}
                    value={soundEnd}
                    onChange={(e) => {
                      const v = Math.max(Number(e.target.value), soundOffset + 0.3);
                      setSoundEnd(Math.min(selectedSoundDuration, v));
                    }} style={{ width: "100%" }} />
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Glisse le début et la fin pour choisir librement le passage.</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 9, marginTop: 6 }}>
              <button onClick={() => { setSelectedSound(null); setPanel(null); }}
                style={{ flex: 1, padding: "12px", borderRadius: 15, border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 13 }}>Retirer le son</button>
              <button onClick={() => setPanel(null)}
                style={{ flex: 2, padding: "12px", borderRadius: 15, border: "none", background: "linear-gradient(135deg,#C9952A 0%,#E8B84B 100%)",
                  color: "#000", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  boxShadow: "0 3px 16px rgba(201,149,42,0.4)" }}>
                <Check size={15} /> OK
              </button>
            </div>
          </div>
        )}

        {panel === "text" && (
          <div style={{ background: "rgba(6,6,6,0.97)", borderRadius: "24px 24px 0 0", padding: "20px 18px 10px", backdropFilter: "blur(30px)" }}>
            <textarea value={newText} onChange={(e) => setNewText(e.target.value.slice(0, 120))} placeholder="Votre texte…" autoFocus rows={3} maxLength={120}
              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16,
                padding: "12px 16px", color: txtColor, fontSize: Math.min(txtSize, 22), fontFamily: `'${txtFont}',sans-serif`,
                fontWeight: 700, outline: "none", marginBottom: 4, letterSpacing: .3, resize: "none", lineHeight: 1.3 }} />
            <p style={{ margin: "0 0 10px", fontSize: 11, color: newText.length >= 120 ? "#FF6B6B" : "rgba(255,255,255,0.35)", textAlign: "right" }}>{newText.length}/120</p>
            <div style={{ display: "flex", gap: 9, marginBottom: 12, alignItems: "center" }}>
              {COLORS.map((c) => (
                <div key={c} onClick={() => setTxtColor(c)}
                  style={{ width: 30, height: 30, borderRadius: "50%", background: c, cursor: "pointer", flexShrink: 0,
                    border: `2.5px solid ${txtColor === c ? "#C9952A" : "rgba(255,255,255,0.08)"}`, transition: "border .15s", boxShadow: "0 1px 6px rgba(0,0,0,0.6)" }} />
              ))}
              <button onClick={() => setTxtBg(txtBg === null ? "#FFFFFF" : txtBg === "#FFFFFF" ? "#000000" : null)}
                title="Fond du texte"
                style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, cursor: "pointer", fontSize: 12, fontWeight: 800,
                  border: `2.5px solid ${txtBg ? "#C9952A" : "rgba(255,255,255,0.08)"}`,
                  background: txtBg || "rgba(255,255,255,0.04)", color: txtBg === "#FFFFFF" ? "#000" : "#fff" }}>Aa</button>
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
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 22, padding: "0 32px" }}>
                <button onClick={pickGallery}
                  style={{ width: "100%", maxWidth: 320, padding: "18px", borderRadius: 22, border: "none",
                    background: "linear-gradient(135deg,#C9952A 0%,#E8B84B 100%)", color: "#000", fontWeight: 800, fontSize: 15,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                    boxShadow: "0 4px 24px rgba(201,149,42,0.4)" }}>
                  <ImageIcon size={18} /> Choisir une photo ou vidéo
                </button>
                <button onClick={() => setPhase("textcard")}
                  style={{ width: "100%", maxWidth: 320, padding: "16px", borderRadius: 22,
                    border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)", color: "#fff",
                    fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
                  <Type size={17} /> Créer une carte de texte
                </button>
              </div>
            )}

            {phase === "preview" && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 28px 0", gap: 8 }}>
                <button onClick={retake}
                  style={{ height: 46, borderRadius: 23, padding: "0 20px", background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 14, cursor: "pointer" }}>
                  Reprendre
                </button>
                {isVid && pendingTrim && (
                  <button onClick={() => setPhase("trim")}
                    style={{ height: 46, borderRadius: 23, padding: "0 18px", background: "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 13, cursor: "pointer" }}>
                    Ajuster la coupe
                  </button>
                )}
                {!isVid && pendingCrop && (
                  <button onClick={() => setPhase("crop")}
                    style={{ height: 46, borderRadius: 23, padding: "0 18px", background: "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 13, cursor: "pointer" }}>
                    Ajuster le cadrage
                  </button>
                )}
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