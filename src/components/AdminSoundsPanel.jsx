// src/components/AdminSoundsPanel.jsx
import { useState, useEffect, useCallback } from "react";
import { Search, X, Upload, Trash2, Music2 } from "lucide-react";
import { uploadToR2 } from "../uploadMedia";

export default function AdminSoundsPanel({ sb, notify, T }) {
  const [sounds, setSounds] = useState([]);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const loadSounds = useCallback(async () => {
    const { data } = await sb.from("sounds").select("*").order("created_at", { ascending: false }).limit(200);
    setSounds(data || []);
  }, [sb]);

  useEffect(() => { loadSounds(); }, [loadSounds]);

  const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filtered = search.trim()
    ? sounds.filter((s) =>
        norm(s.title).includes(norm(search)) ||
        norm(s.author_name).includes(norm(search)) ||
        (s.tags || []).some((t) => norm(t).includes(norm(search)))
      )
    : sounds;

  const handleUpload = async () => {
    if (!file || !title.trim()) { notify("Fichier et titre requis"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `sounds/admin_${Date.now()}.${ext}`;
      const url = await uploadToR2(file, path);
      const tagList = tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      const { error } = await sb.from("sounds").insert({
        title: title.trim(),
        author_name: author.trim() || null,
        url,
        tags: tagList,
        added_by_admin: true,
        usage_count: 0,
      });
      if (error) throw error;
      notify("Son ajouté ✦");
      setTitle(""); setAuthor(""); setTags(""); setFile(null);
      loadSounds();
    } catch (e) {
      notify("Erreur : " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (s) => {
    if (!window.confirm(`Supprimer "${s.title}" de toute l'application ?`)) return;
    const { error } = await sb.from("sounds").delete().eq("id", s.id);
    if (error) {
      notify(error.code === "23503"
        ? "Impossible : ce son est encore utilisé par des publications"
        : "Erreur : " + error.message);
      return;
    }
    setSounds((p) => p.filter((x) => x.id !== s.id));
    notify("Son supprimé");
  };

  return (
    <div style={{ padding: "12px 16px" }}>
      {/* Formulaire d'ajout */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: `1px dashed ${T.gold}55`, cursor: "pointer", marginBottom: 10, color: T.goldL, fontSize: 12.5, fontWeight: 600 }}>
          <Upload size={14} />
          {file ? file.name : "Choisir un fichier audio"}
          <input type="file" accept="audio/*" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du son"
          style={{ width: "100%", marginBottom: 8, padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: "transparent", color: T.text, fontSize: 13 }} />
        <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Auteur (optionnel)"
          style={{ width: "100%", marginBottom: 8, padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: "transparent", color: T.text, fontSize: 13 }} />
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags séparés par virgule (ex: rire, ambiance)"
          style={{ width: "100%", marginBottom: 10, padding: "9px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: "transparent", color: T.text, fontSize: 13 }} />
        <button onClick={handleUpload} disabled={uploading}
          style={{ width: "100%", padding: 11, borderRadius: 12, border: "none", background: T.gradGold, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: uploading ? 0.6 : 1 }}>
          {uploading ? "Ajout en cours…" : "Ajouter le son"}
        </button>
      </div>

      {/* Recherche + liste */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 12, padding: "9px 12px", marginBottom: 10 }}>
        <Search size={15} color={T.muted} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher un son (titre, auteur, tag)…"
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: T.text, fontSize: 13 }} />
        {search && <X size={14} color={T.muted} style={{ cursor: "pointer" }} onClick={() => setSearch("")} />}
      </div>

      {filtered.length === 0 && <p style={{ textAlign: "center", padding: 20, color: T.muted, fontStyle: "italic", fontSize: 12 }}>Aucun son trouvé</p>}
      {filtered.map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, background: "rgba(255,255,255,0.02)", marginBottom: 6 }}>
          <Music2 size={14} color={T.goldL} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: T.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
            <div style={{ fontSize: 10.5, color: T.muted }}>{s.author_name || "—"} · {s.usage_count || 0} utilisations</div>
          </div>
          <Trash2 size={14} color={T.err} style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => remove(s)} />
        </div>
      ))}
    </div>
  );
}