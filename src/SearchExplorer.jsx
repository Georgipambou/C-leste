/**
 * SearchExplorer.jsx — Céleste
 * Composant plein écran ouvert depuis la barre de recherche du feed.
 * Onglets Top / Utilisateurs / Publications, grille carrée façon TikTok/Instagram.
 * Taper un nom d'utilisateur puis appuyer dessus "pivote" vers une vue dédiée :
 * grille de SES publications + grille des publications où il est mentionné.
 * Ne gère aucune préservation de scroll lui-même : il est monté en overlay
 * par-dessus le feed (comme PhotoViewer/ReelsViewer), donc le feed en dessous
 * ne se démonte jamais et son scroll reste intact tel quel.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, ChevronLeft, Play, Grid3x3, Music2 } from "lucide-react";
import SoundPreviewButton from "./components/SoundPreviewButton";


// ── Utilitaires locaux (mêmes règles que dans App.jsx) ─────────────
const normalizeSearch = s => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const isVideoUrl = u => /\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(u || "");
const postThumb = p => {
  const allMedia = p.media_urls?.length > 0 ? p.media_urls : (p.img ? [p.img] : []);
  return allMedia[0] || null;
};
const postIsVideo = p => isVideoUrl(p.img) || (p.media_urls || []).some(isVideoUrl);

const POSTS_SELECT = `id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_loc,pinned,profile_pinned,post_phase,text_background,is_for_sale,is_private,whatsapp_contact,contact_link,expires_at,visibility,phase_views,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection,latitude,longitude),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url),replies:comment_replies(id)),saved_posts(count)`;

// ── Sous-composants hoistés hors du composant principal ────────────
// (avant : redéfinis à chaque rendu de SearchExplorer, donc remontés en
// intégralité à chaque frappe dans la barre de recherche — probable cause
// du blocage des onglets Utilisateurs/Publications)
function TabBtn({ label, active, onClick, T }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", padding: "10px 4px", marginRight: 22, fontSize: 14, fontWeight: 700, cursor: "pointer",
      color: active ? T.text : T.muted,
      borderBottom: active ? `2px solid ${T.gold}` : "2px solid transparent",
    }}>{label}</button>
  );
}

function PostGrid({ list, list2, emptyLabel, T, onOpenPost }) {
  if (!list || list.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: T.muted }}>
        <div style={{ fontSize: 30, marginBottom: 10, opacity: .3 }}>✦</div>
        <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18 }}>{emptyLabel}</p>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2 }}>
      {list.map(p => {
        const thumb = postThumb(p);
        const video = postIsVideo(p);
        return (
          <div key={p.id} onClick={() => onOpenPost(p, list2 || list)}
            style={{ position: "relative", aspectRatio: "1", overflow: "hidden", background: T.bg3 || T.bg2, cursor: "pointer" }}>
            {thumb ? (
              video ? (
                <video src={thumb} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <img src={thumb} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
                <p style={{ fontSize: 11, color: T.muted, textAlign: "center", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" }}>{p.text}</p>
              </div>
            )}
            {video && <Play size={16} color="#fff" fill="#fff" style={{ position: "absolute", bottom: 6, left: 6, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }} />}
          </div>
        );
      })}
    </div>
  );
}

function UserRow({ u, T, onClick }) {
  return (
    <div onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", cursor: "pointer" }}>
      {u.avatar_url
        ? <img src={u.avatar_url} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        : <div style={{ width: 44, height: 44, borderRadius: "50%", background: u.color || T.goldBg, display: "flex", alignItems: "center", justifyContent: "center", color: T.gold, fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{u.initials}</div>}
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.fullName}</p>
        <p style={{ margin: 0, fontSize: 12, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.paroisse !== "—" ? u.paroisse : "Céleste"}</p>
      </div>
    </div>
  );
}

function SoundRow({ s, T, onUse }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px" }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: T.goldBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Music2 size={16} color={T.gold} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</p>
        {s.author_name && <p style={{ margin: 0, fontSize: 11.5, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.author_name}</p>}
      </div>
      <SoundPreviewButton url={s.url} color={T.goldL || T.gold} />
      <button onClick={() => onUse(s)} style={{ background: T.goldBg, border: `1px solid ${T.gold}44`, borderRadius: 12, padding: "6px 12px", color: T.goldL || T.gold, fontSize: 11.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
        Utiliser
      </button>
    </div>
  );
}

export default function SearchExplorer({ sb, T, myProfile, onClose, onOpenPost, onUseSound, mapDbPost, normProfile }) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("top"); // top | users | posts
  const [users, setUsers] = useState([]);
  const [postResults, setPostResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const [pivotUser, setPivotUser] = useState(null); // profil normalisé
  const [pivotTab, setPivotTab] = useState("posts"); // posts | mentions
  const [pivotPosts, setPivotPosts] = useState([]);
  const [pivotMentions, setPivotMentions] = useState([]);
  const [pivotLoading, setPivotLoading] = useState(false);

  const [sounds, setSounds] = useState([]);
  const [soundsLoading, setSoundsLoading] = useState(false);

  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // ── Recherche debouncée (utilisateurs + publications + sons) ───
  // NB : ilike côté Postgres est sensible aux accents (é ≠ e), donc taper
  // son propre nom sans accent — ou avec un accent différent de celui
  // stocké en base — ne remontait rien. On récupère un lot large côté
  // serveur (tri par pertinence/récence) puis on filtre nous-mêmes avec
  // normalizeSearch (minuscule + accents retirés) des deux côtés.
  useEffect(() => {
    const q = query.trim();
    if (!q) { setUsers([]); setPostResults([]); setSounds([]); return; }
    const nq = normalizeSearch(q);
    let cancelled = false;
    setLoading(true);
    setSoundsLoading(true);
    const t = setTimeout(async () => {
      const [{ data: uData }, { data: pData }, { data: sData }] = await Promise.all([
        sb.from("profiles").select("id,prenom,nom,avatar_url,badge,paroisse")
          .eq("is_discoverable", true)
          .limit(300),
        sb.from("posts").select(POSTS_SELECT)
          .not("visibility", "eq", "hidden")
          .order("created_at", { ascending: false })
          .limit(300),
        sb.from("sounds").select("id,title,url,usage_count,author_name,tags")
          .eq("is_deleted", false)
          .order("usage_count", { ascending: false })
          .limit(200),
      ]);
      if (cancelled) return;

      const matchedUsers = (uData || [])
        .map(normProfile)
        .filter(u => normalizeSearch(u.fullName).includes(nq) || normalizeSearch(u.paroisse).includes(nq));

      const matchedPosts = (pData || [])
        .filter(p =>
          normalizeSearch(p.text).includes(nq) ||
          normalizeSearch(p.event_title).includes(nq) ||
          normalizeSearch(p.author?.prenom).includes(nq) ||
          normalizeSearch(p.author?.nom).includes(nq)
        )
        .map(p => mapDbPost(p, new Set()));

      const matchedSounds = (sData || []).filter(s =>
        !!(s.url || "").trim() && (
          normalizeSearch(s.title).includes(nq) ||
          normalizeSearch(s.author_name).includes(nq) ||
          (s.tags || []).some(tg => normalizeSearch(tg).includes(nq))
        )
      );

      setUsers(matchedUsers);
      setPostResults(matchedPosts);
      setSounds(matchedSounds);
      setLoading(false);
      setSoundsLoading(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  // ── Ouverture du profil "pivot" (posts + mentions) ─────────────
  const openPivot = useCallback(async (user) => {
    setPivotUser(user);
    setPivotTab("posts");
    setPivotPosts([]);
    setPivotMentions([]);
    setPivotLoading(true);
    const [{ data: ownData }, { data: mentionData }] = await Promise.all([
      sb.from("posts").select(POSTS_SELECT)
        .eq("author_id", user.id)
        .not("visibility", "eq", "hidden")
        .order("created_at", { ascending: false })
        .limit(60),
      sb.from("posts").select(POSTS_SELECT)
        .not("mentions", "is", null)
        .neq("author_id", user.id)
        .not("visibility", "eq", "hidden")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    setPivotPosts((ownData || []).map(p => mapDbPost(p, new Set())));
    const mentioned = (mentionData || [])
      .filter(p => (p.mentions || []).some(m => m?.id === user.id))
      .map(p => mapDbPost(p, new Set()));
    setPivotMentions(mentioned);
    setPivotLoading(false);
  }, [sb, mapDbPost]);

  const closePivot = () => { setPivotUser(null); setPivotPosts([]); setPivotMentions([]); };

  const handleBack = () => {
    if (pivotUser) { closePivot(); return; }
    onClose();
  };

  const handleUseSound = (s) => {
    onUseSound?.({ id: s.id, title: s.title, url: s.url });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: T.bg, display: "flex", flexDirection: "column" }}>
      {/* Barre du haut */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
        <button onClick={handleBack} style={{ background: "none", border: "none", color: T.text, display: "flex", padding: 4, cursor: "pointer" }}>
          <ChevronLeft size={22} />
        </button>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: T.glass, border: `1px solid ${T.border}`, borderRadius: 20, padding: "8px 14px" }}>
          <Search size={15} color={T.gold} />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher une publication, un utilisateur, un son…"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: T.text, fontSize: 14 }} />
          {query && <button onClick={() => setQuery("")} style={{ background: "none", border: "none", color: T.muted, display: "flex", cursor: "pointer" }}><X size={15} /></button>}
        </div>
      </div>

      {pivotUser ? (
        <>
          {/* En-tête du profil pivot */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px" }}>
            {pivotUser.avatar_url
              ? <img src={pivotUser.avatar_url} style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} />
              : <div style={{ width: 56, height: 56, borderRadius: "50%", background: T.goldBg, display: "flex", alignItems: "center", justifyContent: "center", color: T.gold, fontWeight: 700, fontSize: 18 }}>{pivotUser.initials}</div>}
            <div>
              <p style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: T.text }}>{pivotUser.fullName}</p>
              <p style={{ margin: 0, fontSize: 12, color: T.muted }}>{pivotUser.paroisse !== "—" ? pivotUser.paroisse : "Céleste"}</p>
            </div>
          </div>
          <div style={{ display: "flex", padding: "0 16px", borderBottom: `1px solid ${T.border}` }}>
            <TabBtn T={T} label={`Publications (${pivotPosts.length})`} active={pivotTab === "posts"} onClick={() => setPivotTab("posts")} />
            <TabBtn T={T} label={`Mentions (${pivotMentions.length})`} active={pivotTab === "mentions"} onClick={() => setPivotTab("mentions")} />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {pivotLoading ? (
              <div style={{ textAlign: "center", padding: 60, color: T.muted }}>Chargement…</div>
            ) : pivotTab === "posts" ? (
              <PostGrid T={T} onOpenPost={onOpenPost} list={pivotPosts} emptyLabel="Aucune publication" />
            ) : (
              <PostGrid T={T} onOpenPost={onOpenPost} list={pivotMentions} emptyLabel="Aucune mention trouvée" />
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", padding: "0 16px", borderBottom: `1px solid ${T.border}`, overflowX: "auto" }}>
            <TabBtn T={T} label="Top" active={tab === "top"} onClick={() => setTab("top")} />
            <TabBtn T={T} label="Utilisateurs" active={tab === "users"} onClick={() => setTab("users")} />
            <TabBtn T={T} label="Publications" active={tab === "posts"} onClick={() => setTab("posts")} />
            <TabBtn T={T} label="Sons" active={tab === "sounds"} onClick={() => setTab("sounds")} />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {!query.trim() ? (
              <div style={{ textAlign: "center", padding: "80px 20px", color: T.muted }}>
                <Grid3x3 size={30} style={{ opacity: .3, marginBottom: 10 }} />
                <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18 }}>Recherchez une publication, un utilisateur ou un son</p>
              </div>
            ) : loading ? (
              <div style={{ textAlign: "center", padding: 60, color: T.muted }}>Recherche…</div>
            ) : tab === "top" ? (
              <>
                {users.length > 0 && (
                  <div style={{ padding: "14px 16px 4px" }}>
                    <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 1 }}>Utilisateurs</p>
                    <div style={{ display: "flex", gap: 18, overflowX: "auto", paddingBottom: 6 }}>
                      {users.slice(0, 8).map(u => (
                        <div key={u.id} onClick={() => openPivot(u)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", flexShrink: 0, width: 64 }}>
                          {u.avatar_url
                            ? <img src={u.avatar_url} style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover" }} />
                            : <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.goldBg, display: "flex", alignItems: "center", justifyContent: "center", color: T.gold, fontWeight: 700 }}>{u.initials}</div>}
                          <p style={{ margin: 0, fontSize: 11, color: T.text, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>{u.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ padding: "10px 16px 0" }}>
                  <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 1 }}>Publications</p>
                </div>
                <PostGrid T={T} onOpenPost={onOpenPost} list={postResults} emptyLabel="Aucune publication trouvée" />
              </>
            ) : tab === "users" ? (
              users.length > 0
                ? <div style={{ paddingTop: 8 }}>{users.map(u => <UserRow key={u.id} u={u} T={T} onClick={() => openPivot(u)} />)}</div>
                : <div style={{ textAlign: "center", padding: 60, color: T.muted }}>Aucun utilisateur trouvé</div>
            ) : tab === "sounds" ? (
              soundsLoading ? (
                <div style={{ textAlign: "center", padding: 60, color: T.muted }}>Recherche…</div>
              ) : sounds.length > 0 ? (
                <div style={{ paddingTop: 8 }}>{sounds.map(s => <SoundRow key={s.id} s={s} T={T} onUse={handleUseSound} />)}</div>
              ) : (
                <div style={{ textAlign: "center", padding: 60, color: T.muted }}>Aucun son trouvé</div>
              )
            ) : (
              <PostGrid T={T} onOpenPost={onOpenPost} list={postResults} emptyLabel="Aucune publication trouvée" />
            )}
          </div>
        </>
      )}
    </div>
  );
}