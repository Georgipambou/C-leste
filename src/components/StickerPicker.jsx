/**
 * StickerPicker.jsx — Céleste
 * Panneau de sélection de stickers façon WhatsApp.
 * Réutilisable dans la messagerie ET les commentaires.
 *
 * Props :
 *   sb        — client Supabase
 *   userId    — id de l'utilisateur courant
 *   T         — palette du thème actif
 *   onSelect  — (sticker) => void   — appelé quand on tape un sticker
 *   onClose   — () => void
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, Clock, Star, User, Plus, Sticker as StickerIcon } from "lucide-react";
import { uploadToR2 } from "../uploadMedia";
import VideoTrimModal from "./VideoTrimModal";

const STICKER_ANIM_MAX_SECS = 5; // durée max d'un sticker animé

const MAX_DIM = 512;
const MAX_STATIC_BYTES = 1 * 1024 * 1024;
const MAX_ANIM_BYTES = 2 * 1024 * 1024;

const TABS = [
  { id: "recent", icon: Clock, label: "Récents" },
  { id: "trending", icon: Star, label: "Tendances" },
  { id: "mine", icon: User, label: "Mes stickers" },
];

const resizeStaticImage = (file) => new Promise((resolve, reject) => {
  const img = new window.Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    let w = img.width, h = img.height;
    if (w > MAX_DIM) { h = h * MAX_DIM / w; w = MAX_DIM; }
    if (h > MAX_DIM) { w = w * MAX_DIM / h; h = MAX_DIM; }
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        URL.revokeObjectURL(url);
        if (!blob) return reject(new Error("Compression impossible"));
        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".png", { type: "image/png" }));
      },
      "image/png"
    );
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image invalide")); };
  img.src = url;
});
async function isFileAnimated(file) {
  const isGif = file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");
  if (isGif) return true;
  const isWebp = file.type === "image/webp" || file.name.toLowerCase().endsWith(".webp");
  if (!isWebp) return false;
  try {
    const buf = await file.slice(0, 40).arrayBuffer();
    const b = new Uint8Array(buf);
    const str = (start, len) => String.fromCharCode(...b.slice(start, start + len));
    if (str(0, 4) !== "RIFF" || str(8, 4) !== "WEBP") return false;
    if (str(12, 4) === "VP8X") return !!(b[20] & 0x02); // bit ANIM
    return false; // WEBP simple, jamais animé
  } catch {
    return false;
  }
}

const RECENTS_KEY = "celeste_recent_stickers";
const loadRecentIds = () => { try { return JSON.parse(localStorage.getItem(RECENTS_KEY)) || []; } catch { return []; } };
const pushRecentId = (id) => {
  const cur = loadRecentIds().filter((x) => x !== id);
  cur.unshift(id);
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(cur.slice(0, 30))); } catch (_) {}
};

export default function StickerPicker({ sb, userId, T, onSelect, onClose }) {
  const muted = T?.muted || "rgba(255,255,255,0.5)";
  const border = T?.border || "rgba(255,255,255,0.12)";
  const text = T?.text || "rgba(255,255,255,0.9)";
  const gold = T?.goldL || T?.gold || "#e0b84a";
  const panelBg = T?.cardSolid || T?.bg2 || "rgba(10,10,10,0.98)";

  const [tab, setTab] = useState("recent");
  const [lists, setLists] = useState({ recent: [], trending: [], mine: [] });
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [videoTrimSrc, setVideoTrimSrc] = useState(null);
  const [pendingVideoName, setPendingVideoName] = useState("");
  const fileRef = useRef(null);

  const fetchTab = useCallback(async (which) => {
    setLoading(true);
    try {
      if (which === "trending") {
        const { data } = await sb.from("stickers").select("*").order("usage_count", { ascending: false }).limit(40);
        setLists((l) => ({ ...l, trending: data || [] }));
      } else if (which === "mine") {
        if (!userId) { setLists((l) => ({ ...l, mine: [] })); return; }
        const { data } = await sb
          .from("user_saved_stickers")
          .select("sticker:stickers(*)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(60);
        setLists((l) => ({ ...l, mine: (data || []).map((r) => r.sticker).filter(Boolean) }));
      } else if (which === "recent") {
        const ids = loadRecentIds();
        if (ids.length === 0) { setLists((l) => ({ ...l, recent: [] })); return; }
        const { data } = await sb.from("stickers").select("*").in("id", ids);
        const byId = Object.fromEntries((data || []).map((s) => [s.id, s]));
        setLists((l) => ({ ...l, recent: ids.map((id) => byId[id]).filter(Boolean) }));
      }
    } finally {
      setLoading(false);
    }
  }, [sb, userId]);

  useEffect(() => { fetchTab("recent"); }, [fetchTab]);

  const switchTab = useCallback(async (id) => {
    setTab(id);
    setSearchOpen(false);
    setQuery("");
    setSearchResults(null);
    await fetchTab(id);
  }, [fetchTab]);

  const runSearch = useCallback(async (q) => {
    setQuery(q);
    if (!q.trim()) { setSearchResults(null); return; }
    const term = q.trim().toLowerCase();
    const { data } = await sb.from("stickers").select("*").or(`name.ilike.%${term}%,tags.cs.{${term}}`).limit(40);
    setSearchResults(data || []);
  }, [sb]);

  const pick = useCallback((sticker) => {
    pushRecentId(sticker.id);
    onSelect?.(sticker);
  }, [onSelect]);

  const uploadSticker = useCallback(async (blob, ext, type, rawName) => {
    setUploading(true);
    try {
      const name = (rawName || "Sticker").slice(0, 40) || "Sticker";
      const path = `stickers/user_${userId}_${Date.now()}.${ext}`;
      const url = await uploadToR2(blob, path);
      const { data, error } = await sb.from("stickers").insert({
        name, url, type, format: ext,
        author_id: userId, added_by_admin: false, usage_count: 0,
      }).select().single();
      if (error) throw error;
      // Auto-save dans "Mes stickers" pour celui qui vient de l'ajouter
      await sb.from("user_saved_stickers").insert({ user_id: userId, sticker_id: data.id });
      setLists((l) => ({ ...l, mine: [data, ...l.mine] }));
      setTab("mine");
    } catch (err) {
      alert("Erreur : " + err.message);
    } finally {
      setUploading(false);
    }
  }, [sb, userId]);

  const onFileChosen = useCallback((e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !userId) return;

    if (f.type.startsWith("video/")) {
      setPendingVideoName(f.name.replace(/\.[^/.]+$/, ""));
      setVideoTrimSrc(URL.createObjectURL(f));
      return;
    }

    (async () => {
      const isAnimated = await isFileAnimated(f);
      const limit = isAnimated ? MAX_ANIM_BYTES : MAX_STATIC_BYTES;
      if (f.size > limit) { alert(`Fichier trop lourd — max ${isAnimated ? "2 Mo" : "1 Mo"}`); return; }
      const isWebp = f.type === "image/webp" || f.name.toLowerCase().endsWith(".webp");
      const toUpload = isAnimated ? f : await resizeStaticImage(f);
      const ext = isAnimated ? (isWebp ? "webp" : "gif") : "png";
      await uploadSticker(toUpload, ext, isAnimated ? "animated" : "static", f.name.replace(/\.[^/.]+$/, ""));
    })();
  }, [uploadSticker, userId]);

  const onVideoTrimDone = useCallback(async (data) => {
    setVideoTrimSrc(null);
    try {
      let blob = data.file;
      if (!blob) {
        const res = await fetch(data.src);
        blob = await res.blob();
      }
      await uploadSticker(blob, "webm", "animated", pendingVideoName);
    } catch (err) {
      alert("Erreur : " + err.message);
    }
  }, [uploadSticker, pendingVideoName]);

  const displayed = searchResults !== null ? searchResults : lists[tab];
  const activeLabel = searchResults !== null ? "Résultats" : TABS.find((t) => t.id === tab)?.label;

  return (
    <div style={{
      background: panelBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      border: `1px solid ${border}`, borderRadius: 18, padding: "10px 12px 8px",
      display: "flex", flexDirection: "column", maxHeight: 340,
    }}>
      {/* Barre du haut */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {searchOpen ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", borderRadius: 20, padding: "6px 12px" }}>
            <Search size={14} color={muted} />
            <input
              autoFocus
              value={query}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="Chercher un sticker…"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: text, fontSize: 13 }}
            />
            <X size={14} color={muted} style={{ cursor: "pointer" }} onClick={() => { setSearchOpen(false); setQuery(""); setSearchResults(null); }} />
          </div>
        ) : (
          <>
            <button type="button" onClick={() => setSearchOpen(true)} style={{ background: "none", border: "none", padding: 4, display: "flex", cursor: "pointer" }}>
              <Search size={17} color={muted} />
            </button>
            <span style={{ flex: 1, color: text, fontSize: 13, fontWeight: 700 }}>{activeLabel}</span>
          </>
        )}
        <button type="button" onClick={onClose} style={{ background: "none", border: "none", padding: 4, display: "flex", cursor: "pointer" }}>
          <X size={17} color={muted} />
        </button>
      </div>

      {/* Grille */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && <p style={{ color: muted, fontSize: 12, textAlign: "center", padding: "20px 0" }}>Chargement…</p>}

        {!loading && tab === "mine" && !userId && (
          <p style={{ color: muted, fontSize: 12, textAlign: "center", padding: "20px 0" }}>Connecte-toi pour voir tes stickers.</p>
        )}

        {!loading && displayed.length === 0 && !(tab === "mine" && !userId) && (
          <p style={{ color: muted, fontSize: 12, textAlign: "center", padding: "20px 0" }}>
            {tab === "recent" && searchResults === null ? "Tu n'as pas encore utilisé de sticker." : "Aucun sticker."}
          </p>
        )}

        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
           {tab === "mine" && searchResults === null && (
  <button
    type="button"
    onClick={() => fileRef.current?.click()}
    disabled={uploading}
    style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
      aspectRatio: "1", borderRadius: 12, border: `1px dashed ${gold}55`, background: "rgba(255,255,255,0.03)",
      cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.5 : 1,
    }}
  >
    <Plus size={18} color={gold} />
    <span style={{ fontSize: 9, color: gold, textAlign: "center", lineHeight: 1.2 }}>{uploading ? "Envoi…" : "Créer un\nsticker"}</span>
  </button>
)}
            {displayed.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s)}
                style={{ background: "rgba(255,255,255,0.03)", border: "none", borderRadius: 12, aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 6 }}
              >
                {s.url ? <img src={s.url} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <StickerIcon size={20} color={muted} />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Rangée d'onglets en bas, façon WhatsApp */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 8, marginTop: 6, borderTop: `1px solid ${border}`, overflowX: "auto" }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id && searchResults === null;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              title={t.label}
              style={{
                flexShrink: 0, width: 34, height: 34, borderRadius: "50%", border: "none",
                background: active ? "rgba(201,149,42,0.18)" : "transparent",
                color: active ? gold : muted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              <Icon size={16} />
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title="Ajouter un sticker"
          disabled={!userId || uploading}
          style={{
            marginLeft: "auto", flexShrink: 0, width: 34, height: 34, borderRadius: "50%",
            border: `1px solid ${gold}55`, background: "rgba(201,149,42,0.1)", color: gold,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: userId ? "pointer" : "default",
            opacity: userId ? 1 : 0.4,
          }}
        >
          <Plus size={16} />
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/webp,image/gif,video/*" style={{ display: "none" }} onChange={onFileChosen} disabled={uploading} />
      {videoTrimSrc && (
        <VideoTrimModal
          videoSrc={videoTrimSrc}
          maxDuration={STICKER_ANIM_MAX_SECS}
          onClose={() => setVideoTrimSrc(null)}
          onDone={onVideoTrimDone}
        />
      )}
    </div>
  );
}