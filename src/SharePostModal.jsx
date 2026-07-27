// SharePostModal.jsx — Céleste
// Composant "Envoyer à" : partage d'un post vers une conversation interne à l'app.
// Autonome : si T/Av/members/convs/blockedUserIds ne sont pas fournis, le composant
// se débrouille seul (thème sombre par défaut, avatar simple, requêtes Supabase directes).
// Utilisable depuis n'importe où (feed, ReelsViewer, PhotoViewer) sans faire remonter
// des props supplémentaires dans tout App.jsx.

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { X, Search, Check } from "lucide-react";

const FALLBACK_T = {
  bg3: "#15151a",
  text: "#f4f1ea",
  sub: "rgba(244,241,234,0.75)",
  muted: "rgba(244,241,234,0.45)",
  border: "rgba(255,255,255,0.1)",
  gold: "#C9952A",
  goldL: "#e0b658",
};

function DefaultAv({ u, size = 46 }) {
  return u?.avatar_url ? (
    <img src={u.avatar_url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#555,#222)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: Math.round(size * 0.36), fontFamily: "'Cormorant Garamond',serif" }}>
      {(u?.name || "?")[0]?.toUpperCase() || "?"}
    </div>
  );
}

export default function SharePostModal({
  post, sb, session, notify, onClose, onShared,
  T: TProp, Av: AvProp, members: membersProp, convs: convsProp, blockedUserIds: blockedProp,
}) {
  const T = TProp || FALLBACK_T;
  const Av = AvProp || DefaultAv;
  const uid = session?.user?.id;

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sentIds, setSentIds] = useState(() => new Set());
  const [selfConvs, setSelfConvs] = useState(null);
  const [selfMembers, setSelfMembers] = useState(null);
  const [selfBlocked, setSelfBlocked] = useState(null);
  const debounceRef = useRef(null);

  const needsSelfFetch = !convsProp || !membersProp;

  // Repli : si l'appelant ne fournit pas convs/members (cas de ReelsViewer/PhotoViewer),
  // on va chercher les conversations existantes nous-mêmes.
  useEffect(() => {
    if (!needsSelfFetch || !uid) return;
    let alive = true;
    (async () => {
      const { data: convData } = await sb
        .from("conversations")
        .select("id,user1_id,user2_id")
        .or(`user1_id.eq.${uid},user2_id.eq.${uid}`);
      const otherIds = [...new Set((convData || []).map(c => (c.user1_id === uid ? c.user2_id : c.user1_id)))];
      const { data: profiles } = otherIds.length
        ? await sb.from("profiles").select("id,prenom,nom,avatar_url,badge,status").in("id", otherIds)
        : { data: [] };
      if (!alive) return;
      setSelfMembers((profiles || []).map(p => ({ id: p.id, name: [p.prenom, p.nom].filter(Boolean).join(" ") || "…", avatar_url: p.avatar_url, badge: p.badge, status: p.status })));
      setSelfConvs((convData || []).map(c => ({ id: c.id, uid: c.user1_id === uid ? c.user2_id : c.user1_id })));
    })();
    return () => { alive = false; };
  }, [needsSelfFetch, uid, sb]);

  useEffect(() => {
    if (blockedProp || !uid) return;
    sb.from("blocks").select("blocker_id,blocked_id")
      .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`)
      .then(({ data }) => {
        setSelfBlocked((data || []).map(b => (b.blocker_id === uid ? b.blocked_id : b.blocker_id)));
      });
  }, [blockedProp, uid, sb]);

  const members = membersProp || selfMembers || [];
  const convs = convsProp || selfConvs || [];
  const blockedSet = useMemo(() => new Set(blockedProp || selfBlocked || []), [blockedProp, selfBlocked]);

  // Recherche globale d'utilisateurs
  useEffect(() => {
    clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) { setSearchResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const { data } = await sb.rpc("search_profiles_unaccent", { q, exclude_id: uid });
      setSearchResults((data || []).filter(p => !blockedSet.has(p.id)));
      setSearching(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, sb, uid, blockedSet]);

  const isSearchMode = query.trim().length > 0;

  const list = useMemo(() => {
    if (isSearchMode) {
      return searchResults.map(p => ({
        id: p.id,
        name: [p.prenom, p.nom].filter(Boolean).join(" ") || "…",
        avatar_url: p.avatar_url, badge: p.badge, status: p.status,
      }));
    }
    return convs
      .filter(c => !blockedSet.has(c.uid))
      .map(c => {
        const m = members.find(x => x.id === c.uid);
        if (!m || m.status === "suspended") return null;
        return { id: c.uid, name: m.name || [m.prenom, m.nom].filter(Boolean).join(" ") || "…", avatar_url: m.avatar_url, badge: m.badge, status: m.status };
      })
      .filter(Boolean);
  }, [isSearchMode, searchResults, convs, members, blockedSet]);

  const ensureConvId = useCallback(async recipientId => {
    const { data } = await sb
      .from("conversations")
      .select("id")
      .or(`and(user1_id.eq.${uid},user2_id.eq.${recipientId}),and(user1_id.eq.${recipientId},user2_id.eq.${uid})`)
      .maybeSingle();
    if (data) return data.id;
    const { data: created } = await sb
      .from("conversations")
      .insert({ user1_id: uid, user2_id: recipientId })
      .select()
      .single();
    return created?.id;
  }, [sb, uid]);

  const handleSend = useCallback(async recipient => {
    if (sentIds.has(recipient.id)) return;
    if (blockedSet.has(recipient.id)) { notify?.("Envoi impossible avec cette personne"); return; }
    if (recipient.status === "suspended") { notify?.("Ce compte est suspendu"); return; }
    setSentIds(prev => new Set([...prev, recipient.id]));
    try {
      const convId = await ensureConvId(recipient.id);
      if (!convId) throw new Error("no conv");
      await sb.from("messages").insert({
        conv_id: convId,
        sender_id: uid,
        type: "post_share",
        text: "📎 a partagé une publication",
        shared_post_id: post.id,
        reply_metadata: JSON.stringify({
          mediaUrl: (post.media_urls && post.media_urls[0]) || post.img || null,
          previewText: post.text || "",
          authorName: post.author?.name || post.author?.fullName || "",
        }),
      });
      await sb.from("post_shares").insert({ post_id: post.id, sender_id: uid, recipient_id: recipient.id });
      notify?.(`Envoyé à ${recipient.name} ✦`);
      onShared?.(post.id);
    } catch (e) {
      notify?.("Erreur lors de l'envoi");
      setSentIds(prev => { const n = new Set(prev); n.delete(recipient.id); return n; });
    }
  }, [sentIds, blockedSet, ensureConvId, sb, uid, post, notify, onShared]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 480, maxHeight: "78vh", background: T.bg3, borderRadius: "24px 24px 0 0", display: "flex", flexDirection: "column", boxShadow: "0 -8px 40px rgba(0,0,0,0.5)", animation: "shareSlideUp .28s cubic-bezier(.22,1,.36,1)" }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 10 }}>
          <div style={{ width: 36, height: 4, borderRadius: 4, background: T.border }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px" }}>
          <div style={{ width: 30 }} />
          <span style={{ fontSize: 17, fontWeight: 700, color: T.text, fontFamily: "'Cormorant Garamond',serif", letterSpacing: .3 }}>Envoyer à</span>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: T.sub, cursor: "pointer" }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: "0 18px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, borderRadius: 14, padding: "10px 13px" }}>
            <Search size={16} color={T.muted} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher une personne…"
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: T.text, fontSize: 14 }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "6px 14px 24px" }}>
          {searching && <p style={{ textAlign: "center", color: T.muted, fontSize: 12, marginTop: 24 }}>Recherche…</p>}
          {!searching && list.length === 0 && (
            <p style={{ textAlign: "center", color: T.muted, fontSize: 12, marginTop: 24 }}>
              {isSearchMode ? "Aucun résultat" : "Aucune conversation pour l'instant"}
            </p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))", gap: 16 }}>
            {list.map(u => {
              const sent = sentIds.has(u.id);
              return (
                <button
                  key={u.id}
                  onClickCapture={e => { e.stopPropagation(); e.preventDefault(); handleSend(u); }}
                  style={{ background: "none", border: "none", cursor: sent ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "4px 2px" }}
                >
                  <div style={{ position: "relative", width: 60, height: 60 }}>
                    <Av u={u} size={60} />
                    {sent && (
                      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", animation: "sharePopIn .25s cubic-bezier(.34,1.56,.64,1)" }}>
                        <Check size={22} color="#4ade80" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 11.5, color: T.sub, textAlign: "center", maxWidth: 74, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes shareSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes sharePopIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}