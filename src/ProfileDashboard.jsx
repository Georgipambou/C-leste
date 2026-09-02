import { useState, useEffect, useCallback } from "react";
import { Eye, ChevronRight, X, BarChart3 } from "lucide-react";

// Mélange pseudo-aléatoire déterministe : mêmes suggestions toute la journée,
// mélange différent le lendemain (seed = userId + date du jour)
function seededShuffle(arr, seedStr) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// À appeler quand on OUVRE le profil de quelqu'un d'autre (pas le sien) —
// dans UserView, jamais dans ProfileTab.
export async function logProfileView(sb, viewerId, viewedId) {
  if (!sb || !viewerId || !viewedId || viewerId === viewedId) return;
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: existing } = await sb.from("profile_views").select("id")
      .eq("viewer_id", viewerId).eq("viewed_id", viewedId).gte("created_at", since).limit(1);
    if (existing && existing.length > 0) return;
    await sb.from("profile_views").insert({ viewer_id: viewerId, viewed_id: viewedId });
  } catch (_) {}
}

// ── Carte "Tableau de bord" (vues du profil) ──────────────
export function ProfileViewsCard({ sb, T, Btn, Av, Badge, fmtCount, session, pushNav, popNav }) {
  const [count, setCount] = useState(null);
  const [uniqueCount, setUniqueCount] = useState(null);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [loadingViewers, setLoadingViewers] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    sb.from("profile_views").select("viewer_id")
      .eq("viewed_id", session.user.id).gte("created_at", since)
      .then(({ data }) => {
        const rows = data || [];
        setCount(rows.length);
        setUniqueCount(new Set(rows.map(r => r.viewer_id)).size);
      });
  }, [session?.user?.id]);

  const openViewers = async () => {
    pushNav(() => setShowViewers(false));
    setShowViewers(true); setLoadingViewers(true);
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: rows, error } = await sb.from("profile_views")
      .select("viewer_id,created_at")
      .eq("viewed_id", session?.user?.id).gte("created_at", since)
      .order("created_at", { ascending: false }).limit(100);
    if (error) console.error("profile_views error:", error);

    const countsMap = new Map();
    (rows || []).forEach(r => countsMap.set(r.viewer_id, (countsMap.get(r.viewer_id) || 0) + 1));
    const uniqueIds = [...countsMap.keys()];
    if (uniqueIds.length === 0) { setViewers([]); setLoadingViewers(false); return; }

    const { data: profiles, error: pErr } = await sb.from("profiles")
      .select("id,prenom,nom,avatar_url,badge,paroisse")
      .in("id", uniqueIds);
    if (pErr) console.error("profiles error:", pErr);

    const byId = new Map((profiles || []).map(p => [p.id, p]));
    const list = uniqueIds.map(id => byId.get(id) ? { ...byId.get(id), visitCount: countsMap.get(id) } : null).filter(Boolean);
    setViewers(list); setLoadingViewers(false);
  };

  return (
    <>
      <div onClick={openViewers} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, cursor: "pointer", marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: T.goldBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <BarChart3 size={18} color={T.goldL} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text }}>Votre tableau de bord</p>
          <p style={{ margin: 0, fontSize: 12, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}>
            {count === null ? "…" : <><Eye size={11} /> {fmtCount(count)} vue{count > 1 ? "s" : ""} · {fmtCount(uniqueCount || 0)} visiteur{uniqueCount > 1 ? "s" : ""} (30j)</>}
          </p>
        </div>
        <ChevronRight size={18} color={T.muted} />
      </div>

      {showViewers && (
        <div style={{ position: "fixed", inset: 0, zIndex: 800, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => { popNav(); setShowViewers(false); }}>
          <div style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 520, maxHeight: "75vh", display: "flex", flexDirection: "column", animation: "slideUp .3s ease" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 20px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 300, color: T.text }}>Visiteurs <span style={{ color: T.goldL }}>(30j)</span></h3>
              <Btn onClick={() => { popNav(); setShowViewers(false); }} style={{ color: T.muted }}><X size={20} /></Btn>
            </div>
            <div style={{ overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {loadingViewers ? <p style={{ textAlign: "center", color: T.muted, padding: "24px 0" }}>Chargement…</p>
                : viewers.length === 0 ? <p style={{ textAlign: "center", color: T.muted, padding: "24px 0" }}>Aucune visite pour l'instant</p>
                : viewers.map(u => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: T.card, borderRadius: 14, border: `1px solid ${T.border}`, cursor: "pointer" }}
                    onClick={() => { setShowViewers(false); window.dispatchEvent(new CustomEvent("celeste_open_user", { detail: { uid: u.id } })); }}>
                    <Av u={{ ...u, fullName: `${u.prenom || ""} ${u.nom || ""}`.trim(), name: `${u.prenom || ""} ${u.nom || ""}`.trim() }} size={42} ring />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.text }}>{u.prenom} {u.nom}</p>
                      <p style={{ margin: 0, fontSize: 12, color: T.muted }}>{u.paroisse}</p>
                    </div>
                    {u.visitCount > 1 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: T.goldL, background: T.goldBg, padding: "3px 8px", borderRadius: 20, flexShrink: 0 }}>
                        vu {u.visitCount}×
                      </span>
                    )}
                    {u.badge && <Badge type={u.badge} />}
                  </div>
                ))
              }
              <div style={{ height: 20 }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Section "Personnes à découvrir" ───────────────────────
export function DiscoverPeopleSection({ sb, T, Btn, Av, Badge, session, notify, computeMatchScore, onUser, onConnectionChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const build = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    const myId = session.user.id;

    const { data: myConns } = await sb.from("connections").select("to_id").eq("from_id", myId);
    const { data: myFollowersRows } = await sb.from("connections").select("from_id").eq("to_id", myId);
    const { data: dismissedRows } = await sb.from("dismissed_suggestions").select("dismissed_id").eq("user_id", myId);
    const myConnections = (myConns || []).map(c => c.to_id);
    const myFollowers = (myFollowersRows || []).map(c => c.from_id);

    const excludeIds = new Set([myId, ...myConnections, ...(dismissedRows || []).map(r => r.dismissed_id)]);
    const { data: blocks } = await sb.from("blocks").select("blocker_id,blocked_id").or(`blocker_id.eq.${myId},blocked_id.eq.${myId}`);
    (blocks || []).forEach(b => excludeIds.add(b.blocker_id === myId ? b.blocked_id : b.blocker_id));

    const pool = new Map();
    myFollowers.forEach(id => { if (!excludeIds.has(id)) pool.set(id, { id, reason: "followsYou" }); });

    try {
      const { data: myMatch } = await sb.from("match_profiles").select("*").eq("user_id", myId).maybeSingle();
      if (myMatch?.is_active) {
        const { data: others } = await sb.from("match_profiles").select("*").eq("is_active", true).neq("user_id", myId);
        (others || []).forEach(op => {
          if (excludeIds.has(op.user_id) || pool.has(op.user_id)) return;
          const score = computeMatchScore ? computeMatchScore(myMatch, op) : 0;
          if (score >= 50) pool.set(op.user_id, { id: op.user_id, reason: "match" });
        });
      }
    } catch (_) {}

    try {
      const { data: myPosts } = await sb.from("posts").select("id").eq("author_id", myId).limit(200);
      const postIds = (myPosts || []).map(p => p.id);
      if (postIds.length) {
        const { data: likers } = await sb.from("likes").select("user_id").in("post_id", postIds);
        const counts = {};
        (likers || []).forEach(l => { if (!excludeIds.has(l.user_id)) counts[l.user_id] = (counts[l.user_id] || 0) + 1; });
        Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([id]) => { if (!pool.has(id)) pool.set(id, { id, reason: "likesYou" }); });
      }
    } catch (_) {}

    // Repli : si les 3 signaux ne remplissent pas assez, on complète avec
    // des profils découvrables au hasard pour que le carrousel ne soit jamais vide/pauvre.
    const need = 12 - pool.size;
    if (need > 0) {
      const excludeAndPoolIds = [...excludeIds, ...pool.keys()];
      let q = sb.from("profiles").select("id,prenom,nom,avatar_url,badge,paroisse,is_discoverable").eq("status", "active").neq("is_discoverable", false).limit(need * 5);
      if (excludeAndPoolIds.length > 0) q = q.not("id", "in", `(${excludeAndPoolIds.join(",")})`);
      const { data: extra } = await q;
      const shuffledExtra = (extra || []).sort(() => Math.random() - 0.5).slice(0, need);
      shuffledExtra.forEach(p => { if (!pool.has(p.id)) pool.set(p.id, { id: p.id, reason: "discover" }); });
    }

    const candidateIds = [...pool.keys()];
    if (candidateIds.length === 0) { setSuggestions([]); setLoading(false); return; }

    const { data: profiles } = await sb.from("profiles").select("id,prenom,nom,avatar_url,badge,paroisse").eq("status", "active").in("id", candidateIds);
    const merged = (profiles || []).map(p => ({ ...pool.get(p.id), ...p }));
    const today = new Date().toISOString().slice(0, 10);
    setSuggestions(seededShuffle(merged, `${myId}_${today}`).slice(0, 12));
    setLoading(false);
  }, [session?.user?.id, computeMatchScore]);

  useEffect(() => {
    build();
    // Se rafraîchit tout seul toutes les 5 minutes (nouvelles connexions/matches sans recharger la page)
    const interval = setInterval(build, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [build]);

  const follow = async id => {
    await sb.from("connections").insert({ from_id: session?.user?.id, to_id: id });
    notify?.("Connecté ✦");
    onConnectionChange?.();
    setSuggestions(s => s.filter(u => u.id !== id));
  };

  const dismiss = async id => {
    setSuggestions(s => s.filter(u => u.id !== id)); // disparaît immédiatement
    await sb.from("dismissed_suggestions").upsert({ user_id: session?.user?.id, dismissed_id: id }, { onConflict: "user_id,dismissed_id" });
  };

  const reasonLabel = { followsYou: "Vous suit déjà", match: "Compatible avec vous", likesYou: "Aime vos publications", discover: "À découvrir" };
  if (!loading && suggestions.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ margin: "0 0 10px", fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: "uppercase" }}>Personnes à découvrir</p>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", margin: "0 -18px", padding: "0 18px 4px" }}>
        {loading ? <p style={{ color: T.muted, fontSize: 12 }}>Chargement…</p>
          : suggestions.map(u => (
            <div key={u.id} style={{ position: "relative", flexShrink: 0, width: 132, background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
              <Btn onClick={() => dismiss(u.id)} style={{ position: "absolute", top: 6, right: 6, color: T.muted, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></Btn>
              <div style={{ cursor: "pointer" }}>
                <Av u={{ ...u, fullName: `${u.prenom || ""} ${u.nom || ""}`.trim(), name: `${u.prenom || ""} ${u.nom || ""}`.trim() }} size={54} ring onClick={() => onUser?.(u.id)} />
              </div>
              <div style={{ minWidth: 0, width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.prenom} {u.nom}</p>
                  {u.badge && <Badge type={u.badge} />}
                </div>
                <p style={{ margin: "2px 0 0", fontSize: 10, color: T.muted }}>{reasonLabel[u.reason] || "Suggestion"}</p>
              </div>
              <Btn onClick={() => follow(u.id)} style={{ width: "100%", padding: "7px 0", borderRadius: 12, background: T.gradGold, color: "#000", fontSize: 11, fontWeight: 700 }}>Suivre</Btn>
            </div>
          ))
        }
      </div>
    </div>
  );
}

export function ProfileHeader({T, Av, Badge, fmtCount, coverUrl, color, avatarShape="circle", avatarUrl, user, onAvatarClick, title, subtitle, extraLines, stats, actions, note, onNoteClick}) {
  return (
    <>
      <div style={{height:210,position:"relative",overflow:"hidden",background:coverUrl?undefined:`linear-gradient(150deg,${color}3a,${color}10,transparent)`}}>
        {coverUrl
          ? <img src={coverUrl} alt="cover" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          : <>
              <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(${color}22 1px,transparent 1px)`,backgroundSize:"26px 26px"}}/>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",opacity:.05,fontSize:150,fontFamily:"'Cormorant Garamond',serif",color}}>✦</div>
            </>
        }
        <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,transparent 35%, rgba(6,6,8,0.92) 100%)"}}/>
      </div>

      <div style={{padding:"0 18px",maxWidth:640,margin:"0 auto",position:"relative"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginTop:-54,marginBottom:16}}>
          <div style={{position:"relative",flexShrink:0}}>
            <div style={{position:"absolute",inset:-5,borderRadius:avatarShape==="circle"?"50%":24,background:`conic-gradient(from 120deg, ${color}, transparent 60%, ${color})`,filter:"blur(7px)",opacity:.55}}/>
            {note&&(
              <div onClick={onNoteClick} style={{position:"absolute",bottom:"100%",left:"50%",transform:"translateX(-50%)",marginBottom:6,background:T.glass,border:`1px solid ${T.border}`,borderRadius:14,padding:"6px 10px",fontSize:11,color:T.text,whiteSpace:"nowrap",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",backdropFilter:"blur(10px)",cursor:onNoteClick?"pointer":"default",zIndex:2}}>{note}</div>
            )}
            {avatarShape==="circle"
              ? <div style={{position:"relative"}}><Av u={{...user,avatar_url:avatarUrl}} size={92} ring onClick={onAvatarClick}/></div>
              : <div onClick={onAvatarClick} style={{position:"relative",width:92,height:92,borderRadius:22,border:`3px solid ${color}`,overflow:"hidden",background:T.card,cursor:onAvatarClick?"pointer":"default"}}>
                  {avatarUrl?<img src={avatarUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,fontFamily:"'Cormorant Garamond',serif",color}}>✦</div>}
                </div>
            }
          </div>
          <div style={{paddingBottom:4}}>{actions}</div>
        </div>

        <div style={{marginBottom:18}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,minWidth:0}}>
            <h2 style={{margin:0,minWidth:0,fontFamily:"'Cormorant Garamond',serif",fontWeight:400,fontSize:Math.max(16,27-Math.max(0,(title?.length||0)-16)*0.7),color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{title}</h2>
            {user?.badge&&<Badge type={user.badge}/>}
          </div>
          {subtitle&&<p style={{margin:"0 0 6px",fontSize:13,color:T.muted,display:"flex",alignItems:"center",gap:5}}>{subtitle}</p>}
          {extraLines}
        </div>

        <div style={{display:"flex",gap:1,background:"rgba(255,255,255,0.03)",borderRadius:18,overflow:"hidden",border:`1px solid ${T.border}`,marginBottom:22}}>
          {stats.map((s,i)=>(
            <div key={s.l} style={{flex:1,textAlign:"center",padding:"15px 6px",borderRight:i<stats.length-1?`1px solid ${T.border}`:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
              <span style={{color:T.goldL,opacity:.85}}>{s.icon}</span>
              <p style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:23,fontWeight:400,color:T.goldL}}>{fmtCount(s.v)}</p>
              <p style={{margin:0,fontSize:9,color:T.muted,letterSpacing:1,textTransform:"uppercase"}}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}