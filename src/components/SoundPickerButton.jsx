/**
 * SoundPickerButton.jsx — Céleste
 * Bouton discret "Ajouter un son" + panneau enrichi :
 *   - Tendances (les plus utilisés)
 *   - Récents (les derniers ajoutés par tout le monde)
 *   - Mes sons (ceux que CET utilisateur a déjà uploadés)
 *   - Importer depuis le téléphone (vrai fichier audio, pas un message vocal)
 *   - Enregistrer 15s max au micro
 *
 * Props :
 *   sb       — client Supabase (jamais importé, toujours passé)
 *   value    — son actuellement sélectionné ({id,title,url} ou {title,blob,isNew})
 *   onChange — (sound|null) => void
 *   userId   — id de l'utilisateur courant (pour l'onglet "Mes sons")
 *   T        — palette du thème actif (voir getThemePalette dans App.jsx)
 */
import { useState, useRef, useCallback } from "react";
import { Music2, X, Upload } from "lucide-react";

const SOUND_MAX_SECS = 15; // jamais plus de 15s, comme demandé
const TABS = [
  { id: "trending", label: "Tendances" },
  { id: "recent", label: "Récents" },
  { id: "mine", label: "Mes sons" },
];

export default function SoundPickerButton({ sb, value, onChange, userId, T }) {
  const muted = T?.muted || "rgba(255,255,255,0.5)";
  const border = T?.border || "rgba(255,255,255,0.12)";
  const text = T?.text || "rgba(255,255,255,0.8)";
  const gold = T?.goldL || T?.gold || "#e0b84a";
  const panelBg = T?.cardSolid || T?.bg2 || "rgba(10,10,10,0.98)";

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("trending");
  const [loading, setLoading] = useState(false);
  const [lists, setLists] = useState({ trending: [], recent: [], mine: [] });
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [durationWarning, setDurationWarning] = useState("");

  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileRef = useRef(null);

  const fetchTab = useCallback(async (which) => {
    if (!sb) return;
    setLoading(true);
    try {
      let q = sb.from("sounds").select("id,title,url,usage_count,created_by,created_at");
      if (which === "trending") q = q.order("usage_count", { ascending: false }).limit(20);
      else if (which === "recent") q = q.order("created_at", { ascending: false }).limit(20);
      else if (which === "mine") {
        if (!userId) { setLists((l) => ({ ...l, mine: [] })); setLoading(false); return; }
        q = q.eq("created_by", userId).order("created_at", { ascending: false }).limit(50);
      }
      const { data, error } = await q;
      if (!error) setLists((l) => ({ ...l, [which]: data || [] }));
    } finally {
      setLoading(false);
    }
  }, [sb, userId]);

  const openPanel = useCallback(async () => {
    setOpen(true);
    setDurationWarning("");
    await fetchTab(tab);
  }, [fetchTab, tab]);

  const switchTab = useCallback(async (id) => {
    setTab(id);
    if (lists[id].length === 0) await fetchTab(id);
  }, [fetchTab, lists]);

  const stopRecording = useCallback(() => {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        onChange({ title: "Mon son", blob, isNew: true });
        setOpen(false);
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      setSecs(0);
      timerRef.current = setInterval(() => {
        setSecs((s) => {
          if (s + 1 >= SOUND_MAX_SECS) { stopRecording(); return SOUND_MAX_SECS; }
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      console.warn("startRecording:", e);
    }
  }, [onChange, stopRecording]);

  const pickFromPhone = useCallback(() => {
    setDurationWarning("");
    fileRef.current?.click();
  }, []);

  const onFileChosen = useCallback((e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de re-sélectionner le même fichier plus tard
    if (!file) return;

    const cleanTitle = file.name.replace(/\.[^/.]+$/, "").slice(0, 60) || "Mon son";

    // On vérifie la durée juste pour prévenir l'utilisateur — pas de découpe
    // automatique ici (il n'y a pas encore de trim audio côté client).
    const audioEl = document.createElement("audio");
    audioEl.preload = "metadata";
    audioEl.src = URL.createObjectURL(file);
    audioEl.onloadedmetadata = () => {
      URL.revokeObjectURL(audioEl.src);
      if (audioEl.duration > SOUND_MAX_SECS) {
        setDurationWarning(`⚠️ Ce son dure ${Math.round(audioEl.duration)}s — seules les ${SOUND_MAX_SECS} premières secondes seront utilisées à la lecture.`);
      }
    };

    onChange({ title: cleanTitle, blob: file, isNew: true });
    setOpen(false);
  }, [onChange]);

  const currentList = lists[tab];

  return (
    <div style={{ position: "relative" }}>
      <input ref={fileRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={onFileChosen} />

      <button
        type="button"
        onClick={openPanel}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "7px 13px", borderRadius: 20,
          border: `1px solid ${value ? "#C9952A88" : border}`,
          background: value ? "rgba(201,149,42,0.15)" : "transparent",
          color: value ? gold : text,
          fontSize: 12.5, fontWeight: value ? 700 : 400, cursor: "pointer",
          maxWidth: 200,
        }}
      >
        <Music2 size={13} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value ? value.title : "Ajouter un son"}
        </span>
        {value && (
          <X
            size={13}
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            style={{ marginLeft: 2 }}
          />
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "110%", left: 0, zIndex: 50,
            width: 340, maxHeight: 440, overflowY: "auto",
            background: panelBg, backdropFilter: "blur(20px)",
            border: `1px solid ${border}`, borderRadius: 16,
            padding: 14, boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ color: muted, fontSize: 11.5 }}>Choisis un son (15s max)</span>
            <X size={15} color={muted} style={{ cursor: "pointer" }} onClick={() => setOpen(false)} />
          </div>

          {recording ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "16px 0" }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%", background: "#FF2D55",
                display: "flex", alignItems: "center", justifyContent: "center",
                animation: "celeste-sound-pulse 1s ease-in-out infinite",
              }}>
                <Music2 size={20} color="#fff" />
              </div>
              <span style={{ color: text, fontWeight: 700, fontSize: 13 }}>{secs}s / {SOUND_MAX_SECS}s</span>
              <button
                type="button"
                onClick={stopRecording}
                style={{ padding: "8px 18px", borderRadius: 16, border: "none", background: "rgba(255,255,255,0.1)", color: text, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
              >
                Arrêter
              </button>
              <style>{`@keyframes celeste-sound-pulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.08);} }`}</style>
            </div>
          ) : (
            <>
              {/* Actions rapides */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={pickFromPhone}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "10px 8px", borderRadius: 12, border: "1px dashed rgba(201,149,42,0.5)",
                    background: "rgba(201,149,42,0.08)", color: gold, fontWeight: 700, fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  <Upload size={14} /> Depuis mon téléphone
                </button>
                <button
                  type="button"
                  onClick={startRecording}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "10px 8px", borderRadius: 12, border: `1px solid ${border}`,
                    background: "transparent", color: text, fontWeight: 700, fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  <Music2 size={14} /> Enregistrer
                </button>
              </div>

              {durationWarning && (
                <div style={{ marginBottom: 10, fontSize: 11, color: gold, lineHeight: 1.4 }}>
                  {durationWarning}
                </div>
              )}

              {/* Onglets */}
              <div style={{ display: "flex", gap: 6, marginBottom: 10, borderBottom: `1px solid ${border}`, paddingBottom: 8 }}>
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => switchTab(t.id)}
                    style={{
                      flex: 1, padding: "6px 4px", borderRadius: 8, border: "none",
                      background: tab === t.id ? "rgba(201,149,42,0.15)" : "transparent",
                      color: tab === t.id ? gold : muted,
                      fontSize: 11.5, fontWeight: tab === t.id ? 700 : 500, cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {loading && <span style={{ color: muted, fontSize: 11.5 }}>Chargement…</span>}

              {!loading && tab === "mine" && !userId && (
                <span style={{ color: muted, fontSize: 11.5 }}>Connecte-toi pour voir tes sons.</span>
              )}

              {!loading && currentList.length === 0 && !(tab === "mine" && !userId) && (
                <span style={{ color: muted, fontSize: 11.5 }}>
                  {tab === "mine" ? "Tu n'as pas encore ajouté de son." : "Rien à afficher pour l'instant."}
                </span>
              )}

              {!loading && currentList.map((s) => {
                const active = value?.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => { onChange({ id: s.id, title: s.title, url: s.url }); setOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "9px 6px",
                      borderRadius: 10, cursor: "pointer",
                      background: active ? "rgba(201,149,42,0.15)" : "transparent",
                    }}
                  >
                    <Music2 size={13} color={active ? "#C9952A" : muted} />
                    <span style={{ color: text, fontSize: 12.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.title}
                    </span>
                    {tab !== "mine" && (
                      <span style={{ color: muted, fontSize: 10.5 }}>{s.usage_count}</span>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}