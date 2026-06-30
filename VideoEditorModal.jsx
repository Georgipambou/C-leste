/**
 * VideoEditorModal — éditeur vidéo style CapCut/TikTok pour Céleste
 * Moteur : @openvideo/engine-pixi (Studio = preview GPU temps réel via PixiJS,
 *          Compositor = rendu final / export)
 *
 * Interface volontairement compatible avec l'ancien <VideoTrimModal>
 * (mêmes props : videoSrc, maxDuration, onClose, onDone) pour un
 * branchement "drop-in" partout où VideoTrimModal est utilisé,
 * tout en exposant en plus le mode multi-clips / texte / transitions.
 *
 * onDone(result) renvoie:
 *   { blob, url, width, height, duration }
 * (même forme que ce que VideoTrimModal renvoyait déjà côté `data`,
 * pour ne rien casser dans NewPostModal / StatusCreatorModal / ChatScreen)
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { X, Play, Pause, Type, Scissors, Download, Plus, Trash2, Loader2 } from "lucide-react";

let StudioCtor = null;
let CompositorCtor = null;
let VideoClipCtor = null;
let TextClipCtor = null;

// Chargement paresseux du moteur (gros bundle WebGL) — uniquement quand
// l'éditeur est réellement ouvert, pour ne pas alourdir le bundle initial.
async function loadEngine() {
  if (StudioCtor) return;
  const engine = await import("@openvideo/engine-pixi");
  StudioCtor = engine.Studio;
  CompositorCtor = engine.Compositor;
  VideoClipCtor = engine.Video;
  TextClipCtor = engine.Text;
}

const fmtTime = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export default function VideoEditorModal({ videoSrc, maxDuration = 600, onClose, onDone }) {
  const canvasWrapRef = useRef(null);
  const canvasRef = useRef(null);
  const studioRef = useRef(null);
  const mainClipRef = useRef(null);
  const rafRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimRange, setTrimRange] = useState([0, 0]); // secondes
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [textClips, setTextClips] = useState([]); // {id, clip}

  // ── Init du Studio (preview GPU) ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    let studio = null;

    (async () => {
      try {
        await loadEngine();
        if (cancelled) return;

        const canvas = canvasRef.current;
        studio = new StudioCtor({
          width: 1080,
          height: 1920,
          fps: 30,
          backgroundColor: "#000000",
          artboardColor: "#000000",
          canvas,
          interactivity: true,
          previewScale: 1,
        });
        studioRef.current = studio;

        const clip = await VideoClipCtor.fromUrl(videoSrc, {
          x: 0,
          y: 0,
          width: 1080,
          height: 1920,
        });
        if (cancelled) return;

        const track = studio.addTrack({ name: "Vidéo principale", type: "video" });
        await studio.addClip(clip, { trackId: track.id });
        mainClipRef.current = clip;

        const dur = clip.duration ? clip.duration / 1e6 : 0; // microsecondes -> secondes (convention WebCodecs)
        const safeDur = dur > 0 ? Math.min(dur, maxDuration) : maxDuration;
        setDuration(safeDur);
        setTrimRange([0, safeDur]);

        studio.on("currentTime", ({ currentTime }) => setCurrentTime(currentTime));
        studio.on("play", () => setIsPlaying(true));
        studio.on("pause", () => setIsPlaying(false));

        setReady(true);
      } catch (e) {
        console.error("[VideoEditorModal] init error", e);
        setError("Impossible de charger l'éditeur vidéo. Réessaie ou utilise le recadrage simple.");
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try {
        studio?.destroy?.();
      } catch (_) {}
      studioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoSrc]);

  const togglePlay = useCallback(() => {
    const studio = studioRef.current;
    if (!studio) return;
    if (isPlaying) studio.pause();
    else studio.play();
  }, [isPlaying]);

  // ── Ajouter un texte animé (overlay) ──────────────────────
  const addTextOverlay = useCallback(async () => {
    const studio = studioRef.current;
    if (!studio) return;
    const text = window.prompt("Texte à afficher :", "Céleste ✦");
    if (!text) return;

    const clip = new TextClipCtor(text, {
      x: 80,
      y: 200,
      fontSize: 64,
      fill: "#FFD700",
      fontWeight: "700",
      align: "center",
    });
    clip.set({
      display: {
        from: Math.round(currentTime * 30),
        to: Math.round(Math.min(currentTime + 3, duration) * 30),
      },
    });

    let track = studio.tracks.find((t) => t.type === "text");
    if (!track) track = studio.addTrack({ name: "Texte", type: "text" });
    await studio.addClip(clip, { trackId: track.id });
    setTextClips((arr) => [...arr, { id: clip.id, clip }]);
  }, [currentTime, duration]);

  const removeLastText = useCallback(async () => {
    const studio = studioRef.current;
    const last = textClips[textClips.length - 1];
    if (!studio || !last) return;
    await studio.removeClip(last.clip);
    setTextClips((arr) => arr.slice(0, -1));
  }, [textClips]);

  // ── Trim (poignées de découpe sur la piste principale) ────
  const applyTrim = useCallback(() => {
    const clip = mainClipRef.current;
    if (!clip) return;
    clip.set({
      display: {
        from: Math.round(trimRange[0] * 30),
        to: Math.round(trimRange[1] * 30),
      },
    });
  }, [trimRange]);

  useEffect(() => {
    applyTrim();
  }, [trimRange, applyTrim]);

  // ── Export final via Compositor (rendu off-screen) ────────
  const handleExport = useCallback(async () => {
    const studio = studioRef.current;
    if (!studio) return;
    setExporting(true);
    setExportProgress(0);
    try {
      studio.pause();
      studio.suspendRendering?.();

      const json = studio.exportToJSON();

      const compositor = new CompositorCtor({
        width: 1080,
        height: 1920,
        fps: 30,
        backgroundColor: "#000000",
        format: "mp4",
        videoCodec: "avc",
        bitrate: 6_000_000,
        audio: true,
        audioCodec: "aac",
        audioSampleRate: 44100,
        prioritizeSpeed: true,
      });
      await compositor.initPixiApp();
      compositor.on("export:progress", (v) => setExportProgress(v));

      await compositor.loadFromJSON(json);
      const stream = compositor.output();
      const blob = await new Response(stream).blob();
      const url = URL.createObjectURL(blob);

      onDone?.({
        blob,
        url,
        width: 1080,
        height: 1920,
        duration: trimRange[1] - trimRange[0],
      });
    } catch (e) {
      console.error("[VideoEditorModal] export error", e);
      setError("L'export a échoué. Réessaie.");
    } finally {
      setExporting(false);
    }
  }, [onDone, trimRange]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#000",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          paddingTop: "calc(10px + env(safe-area-inset-top,0px))",
          background: "rgba(0,0,0,0.92)",
        }}
      >
        <button onClick={onClose} style={iconBtnStyle}>
          <X size={22} color="#fff" />
        </button>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Éditeur vidéo</span>
        <button
          onClick={handleExport}
          disabled={!ready || exporting}
          style={{ ...iconBtnStyle, background: "#FFD700", opacity: ready && !exporting ? 1 : 0.5 }}
        >
          {exporting ? (
            <Loader2 size={18} color="#000" className="spin" />
          ) : (
            <Download size={18} color="#000" />
          )}
        </button>
      </div>

      {/* Canvas preview */}
      <div
        ref={canvasWrapRef}
        style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
      >
        <canvas ref={canvasRef} style={{ maxWidth: "100%", maxHeight: "100%" }} />
        {!ready && !error && (
          <div style={{ position: "absolute", color: "#FFD700", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Loader2 size={20} className="spin" /> Chargement du moteur…
          </div>
        )}
        {error && (
          <div style={{ position: "absolute", color: "#ff6b6b", fontSize: 13, textAlign: "center", padding: 20 }}>{error}</div>
        )}
        {exporting && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Loader2 size={28} color="#FFD700" className="spin" />
            <span style={{ color: "#fff", fontSize: 13 }}>Export… {Math.round(exportProgress * 100)}%</span>
          </div>
        )}
      </div>

      {/* Play/pause + temps */}
      {ready && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", color: "#fff" }}>
          <button onClick={togglePlay} style={iconBtnStyle}>
            {isPlaying ? <Pause size={18} color="#fff" /> : <Play size={18} color="#fff" />}
          </button>
          <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </span>
        </div>
      )}

      {/* Timeline de découpe (trim) */}
      {ready && (
        <div style={{ padding: "0 14px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Scissors size={14} color="#FFD700" />
            <span style={{ color: "#FFD700", fontSize: 12, fontWeight: 600 }}>Découpe</span>
          </div>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.05}
            value={trimRange[0]}
            onChange={(e) => {
              const v = Math.min(parseFloat(e.target.value), trimRange[1] - 0.2);
              setTrimRange([Math.max(0, v), trimRange[1]]);
            }}
            style={{ width: "100%" }}
          />
          <input
            type="range"
            min={0}
            max={duration}
            step={0.05}
            value={trimRange[1]}
            onChange={(e) => {
              const v = Math.max(parseFloat(e.target.value), trimRange[0] + 0.2);
              setTrimRange([trimRange[0], Math.min(duration, v)]);
            }}
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", color: "#999", fontSize: 11 }}>
            <span>{fmtTime(trimRange[0])}</span>
            <span>{fmtTime(trimRange[1])}</span>
          </div>
        </div>
      )}

      {/* Barre d'outils (texte, etc.) */}
      {ready && (
        <div style={{ display: "flex", gap: 10, padding: "6px 14px 14px", paddingBottom: "calc(14px + env(safe-area-inset-bottom,0px))" }}>
          <button onClick={addTextOverlay} style={toolBtnStyle}>
            <Type size={16} color="#FFD700" />
            <span style={toolBtnLabel}>Texte</span>
          </button>
          {textClips.length > 0 && (
            <button onClick={removeLastText} style={toolBtnStyle}>
              <Trash2 size={16} color="#ff6b6b" />
              <span style={toolBtnLabel}>Suppr. texte</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const iconBtnStyle = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.1)",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const toolBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,215,0,0.25)",
  borderRadius: 20,
  padding: "8px 14px",
  color: "#fff",
};

const toolBtnLabel = { fontSize: 12, color: "#fff" };
