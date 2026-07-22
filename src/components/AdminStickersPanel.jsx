// src/components/AdminStickersPanel.jsx
import { useState, useEffect, useCallback } from "react";
import { Search, X, Upload, Trash2, Sticker as StickerIcon } from "lucide-react";
import { uploadToR2 } from "../uploadMedia";

const MAX_DIM = 512;          // dimension max (comme WhatsApp)
const MAX_STATIC_BYTES = 1 * 1024 * 1024;   // 1 Mo pour un sticker statique
const MAX_ANIM_BYTES = 2 * 1024 * 1024;     // 2 Mo pour un sticker animé (gif/webp animé)

// Redimensionne une image STATIQUE en conservant la transparence (PNG).
// Ne touche jamais aux GIF/WebP animés — un passage par <canvas> détruirait l'animation.
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

export default function AdminStickersPanel({ sb, notify, T }) {
  const [stickers, setStickers] = useState([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [detectedType, setDetectedType] = useState("static"); // 'static' | 'animated'
  const [uploading, setUploading] = useState(false);

  const loadStickers = useCallback(async () => {
    const { data } = await sb.from("stickers").select("*").order("created_at", { ascending: false }).limit(300);
    setStickers(data || []);
  }, [sb]);

  useEffect(() => { loadStickers(); }, [loadStickers]);

  const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filtered = search.trim()
    ? stickers.filter((s) =>
        norm(s.name).includes(norm(search)) ||
        (s.tags || []).some((t) => norm(t).includes(norm(search)))
      )
    : stickers;

  const onFileChosen = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const isAnimated = f.type === "image/gif" || f.name.toLowerCase().endsWith(".gif");
    const limit = isAnimated ? MAX_ANIM_BYTES : MAX_STATIC_BYTES;
    if (f.size > limit) {
      notify(`Fichier trop lourd — max ${isAnimated ? "2 Mo (animé)" : "1 Mo (statique)"}`);
      return;
    }
    setDetectedType(isAnimated ? "animated" : "static");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!file || !name.trim()) { notify("Fichier et nom requis"); return; }
    setUploading(true);
    try {
      let toUpload = file;
      if (detectedType === "static" && file.type !== "image/gif") {
        toUpload = await resizeStaticImage(file);
      }
      const ext = detectedType === "animated" ? "gif" : "png";
      const path = `stickers/admin_${Date.now()}.${ext}`;
      const url = await uploadToR2(toUpload, path);
      const tagList = tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      const { error } = await sb.from("stickers").insert({
        name: name.trim(),
        url,
        type: detectedType,
        format: ext,
        tags: tagList,
        added_by_admin: true,
        author_id: null,
        usage_count: 0,
      });
      if (error) throw error;
      notify("Sticker ajouté ✦");
      setName(""); setTags(""); setFile(null); setPreview(null);
      loadStickers();
    } catch (e) {
      notify("Erreur : " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (s) => {
    if (!window.confirm(`Supprimer "${s.name}" de toute l'application ?`)) return;
    const { error } = await sb.from("stickers").delete().eq("id", s.id);
    if (error) { notify("Erreur : " + error.message); return; }
    setStickers((p) => p.filter((x) => x.id !== s.id));
    notify("Sticker supprimé");
  };

  return (
    <div style={{ padding: "12px 16px" }}>
      <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
          <label style={{
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            width: 72, height: 72, borderRadius: 12, border: `1px dashed ${T.gold}55`,
            cursor: "pointer", overflow: "hidden", background: "rgba(0,0,0,0.2)",
          }}>
            {preview
              ? <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              : <Upload size={20} color={T.goldL} />}
            <input type="file" accept="image/png,image/webp,image/gif" style={{ display: "none" }} onChange={onFileChosen} />
          </label>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du sticker"
              style={{ width: "100%", marginBottom: 8, padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: "transparent", color: T.text, fontSize: 13 }} />
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags séparés par virgule (ex: fête, rire)"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: "transparent", color: T.text, fontSize: 13 }} />
          </div>
        </div>
        {file && (
          <p style={{ margin: "0 0 10px", fontSize: 11, color: T.muted }}>
            Type détecté : <strong style={{ color: T.goldL }}>{detectedType === "animated" ? "Animé" : "Statique"}</strong> · {(file.size / 1024).toFixed(0)} Ko
          </p>
        )}
        <button onClick={handleUpload} disabled={uploading}
          style={{ width: "100%", padding: 11, borderRadius: 12, border: "none", background: T.gradGold, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: uploading ? 0.6 : 1 }}>
          {uploading ? "Ajout en cours…" : "Ajouter le sticker"}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 12, padding: "9px 12px", marginBottom: 12 }}>
        <Search size={15} color={T.muted} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher un sticker (nom, tag)…"
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: T.text, fontSize: 13 }} />
        {search && <X size={14} color={T.muted} style={{ cursor: "pointer" }} onClick={() => setSearch("")} />}
      </div>

      {filtered.length === 0 && <p style={{ textAlign: "center", padding: 20, color: T.muted, fontStyle: "italic", fontSize: 12 }}>Aucun sticker trouvé</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {filtered.map((s) => (
          <div key={s.id} style={{ position: "relative", background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <Trash2 size={13} color={T.err} style={{ position: "absolute", top: 6, right: 6, cursor: "pointer", background: "rgba(0,0,0,0.5)", borderRadius: "50%", padding: 3 }} onClick={() => remove(s)} />
            {s.url
              ? <img src={s.url} alt={s.name} style={{ width: 56, height: 56, objectFit: "contain" }} />
              : <StickerIcon size={24} color={T.goldL} />}
            <span style={{ fontSize: 10, color: T.text, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{s.name}</span>
            <span style={{ fontSize: 9, color: T.muted }}>{s.author_id ? "Utilisateur" : "Admin"} · {s.usage_count || 0}×</span>
          </div>
        ))}
      </div>
    </div>
  );
}