import { useState, useEffect, useCallback } from "react";
import { Share } from "@capacitor/share";
import { Copy, Share2, Flag, RefreshCw, Trash2, HatGlasses, MoreHorizontal, Sparkles } from "lucide-react";
import { shareAnonCard, makeAnonCardImage } from "./anonCard";

const BASE = "https://celesteapp.social/a/";

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return Math.floor(s / 60) + " min";
  if (s < 86400) return Math.floor(s / 3600) + " h";
  return Math.floor(s / 86400) + " j";
}

export default function AnonInbox({ sb, T, session, notify }) {
  const uid = session?.user?.id;
  const [slug, setSlug] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [preview, setPreview] = useState(null);
  const link = slug ? BASE + slug : "";

  const load = useCallback(async () => {
    if (!uid) return;
    const { data: l } = await sb.from("anon_links").select("slug").eq("owner_id", uid).eq("active", true).maybeSingle();
    setSlug(l?.slug || null);
    const { data } = await sb.from("anon_messages").select("id,content,created_at,read_at,reported").eq("owner_id", uid).eq("reported", false).order("created_at", { ascending: false }).limit(200);
    setMsgs(data || []);
    setLoading(false);
    if ((data || []).some(m => !m.read_at)) {
      sb.from("anon_messages").update({ read_at: new Date().toISOString() }).eq("owner_id", uid).is("read_at", null);
    }
  }, [sb, uid]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    const t = setInterval(onVis, 20000);
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  useEffect(() => {
    if (!uid) return;
    const ch = sb.channel("anon-inbox-" + uid)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "anon_messages", filter: "owner_id=eq." + uid },
        p => setMsgs(prev => [p.new, ...prev.filter(x => x.id !== p.new.id)]))
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, uid]);

  const create = async () => {
    setBusy(true);
    const { data, error } = await sb.rpc("anon_get_or_create_link");
    setBusy(false);
    if (error) { notify("Erreur, réessaie"); return; }
    setSlug(data);
  };
  const regen = async () => {
    if (!window.confirm("Générer un nouveau lien ? L'ancien ne fonctionnera plus.")) return;
    setBusy(true);
    const { data, error } = await sb.rpc("anon_regenerate_link");
    setBusy(false);
    if (error) { notify("Erreur, réessaie"); return; }
    setSlug(data); notify("Nouveau lien créé");
  };
  const disable = async () => {
    if (!window.confirm("Désactiver ton lien ? Plus personne ne pourra t'envoyer de messages.")) return;
    setBusy(true);
    const { error } = await sb.rpc("anon_disable_link");
    setBusy(false);
    if (error) { notify("Erreur, réessaie"); return; }
    setSlug(null); notify("Lien désactivé");
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); notify("Lien copié"); } catch (e) { notify(link); }
  };
  const share = async () => {
    try { await Share.share({ title: "Messages anonymes", text: "Envoie-moi un message anonyme", url: link, dialogTitle: "Partager mon lien" }); }
    catch (e) { if (!/cancel/i.test(String(e?.message || e))) copy(); }
  };
  const report = async (m) => {
    if (!window.confirm("Signaler ce message ? Son expéditeur sera bloqué sur ton lien.")) return;
    const { error } = await sb.rpc("anon_report_message", { p_message_id: m.id, p_reason: "anon_message" });
    if (error) { notify("Erreur, réessaie"); return; }
    setMsgs(p => p.filter(x => x.id !== m.id));
    notify("Message signalé · expéditeur bloqué");
  };
  const remove = async (m) => {
    const { error } = await sb.from("anon_messages").delete().eq("id", m.id);
    if (!error) setMsgs(p => p.filter(x => x.id !== m.id));
  };

  const shareCard = async (m) => {
    try {
      const blob = await makeAnonCardImage({ text: m.content, link });
      setPreview({ m, url: URL.createObjectURL(blob) });
    } catch (e) { notify("Aperçu impossible"); }
  };
  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };
  const doShare = async () => {
    try { await shareAnonCard({ text: preview.m.content, link }); }
    catch (e) { notify("Partage impossible, réessaie"); }
  };

  const ghost = { background: "none", border: "none", color: T.muted, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0 };
  const iconBtn = { background: "none", border: "none", color: T.goldL, cursor: "pointer", padding: 6, display: "flex", alignItems: "center", fontSize: 18, lineHeight: 1 };

  const pill = { flex: 1, padding: "10px 12px", borderRadius: 14, border: `1px solid ${T.gold}`, background: T.goldBg, color: T.goldL, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "8px 0 80px" }}>
            <div style={{ margin: "6px 16px 12px", padding: "10px 12px", borderRadius: 16, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.03)" }}>
        {slug ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <HatGlasses size={18} color={T.goldL} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: T.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{link.replace("https://", "")}</div>
              <button onClick={copy} style={iconBtn} aria-label="Copier"><Copy size={15} /></button>
              <button onClick={share} style={iconBtn} aria-label="Partager"><Share2 size={15} /></button>
              <button onClick={() => setMenu(v => !v)} style={iconBtn} aria-label="Plus"><MoreHorizontal size={16} /></button>
            </div>
            {menu && (
              <div style={{ display: "flex", gap: 16, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
                <button onClick={regen} disabled={busy} style={ghost}><RefreshCw size={12} />Nouveau lien</button>
                <button onClick={disable} disabled={busy} style={ghost}>Désactiver</button>
              </div>
            )}
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 8px", fontSize: 12.5, color: T.muted, display: "flex", alignItems: "center", gap: 6 }}><HatGlasses size={16} color={T.goldL} style={{ flexShrink: 0 }} />Reçois des messages anonymes, sans que personne n'ait besoin de compte.</p>
            <button onClick={create} disabled={busy} style={{ ...pill, flex: "none", width: "100%", background: T.gradGold, color: "#000", border: "none" }}>
              {busy ? "…" : <><Sparkles size={15} />Générer mon lien</>}
            </button>
          </>
        )}
      </div>

            {msgs.map(m => (
        <div key={m.id} style={{ margin: "0 16px 16px", borderRadius: 22, overflow: "hidden", border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.04)" }}>
          <div style={{ height: 5, background: T.gradGold }} />
          <div style={{ padding: "14px 16px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.goldL, letterSpacing: 0.3, display: "flex", alignItems: "center", gap: 6 }}><HatGlasses size={15} />Message anonyme</span>
              <span style={{ fontSize: 11, color: T.muted }}>
                {timeAgo(m.created_at)}
                {!m.read_at && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#4A90D9", marginLeft: 6 }} />}
              </span>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 600, lineHeight: 1.4, color: T.text, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</p>
            <button onClick={() => shareCard(m)} style={{ width: "100%", padding: "11px 14px", borderRadius: 14, border: "none", background: T.gradGold, color: "#000", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Share2 size={15} />Partager en statut
            </button>
            <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
              <button onClick={() => report(m)} style={ghost}><Flag size={12} />Signaler</button>
              <button onClick={() => remove(m)} style={ghost}><Trash2 size={12} />Supprimer</button>
            </div>
          </div>
                {preview && (
        <div onClick={closePreview} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.88)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <img src={preview.url} alt="Aperçu" onClick={e => e.stopPropagation()} style={{ maxHeight: "72vh", maxWidth: "100%", borderRadius: 16, boxShadow: "0 10px 40px rgba(0,0,0,0.6)" }} />
          <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 10, marginTop: 16, width: "100%", maxWidth: 360 }}>
            <button onClick={closePreview} style={{ ...pill, color: T.text, border: `1px solid ${T.border}`, background: "transparent" }}>Fermer</button>
            <button onClick={doShare} style={{ ...pill, background: T.gradGold, color: "#000", border: "none" }}><Share2 size={14} />Partager</button>
          </div>
        </div>
      )}
        </div>

      ))}
      
    </div>
  );
}


