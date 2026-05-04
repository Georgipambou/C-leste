import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

const PAGE_SIZE = 20;

const T = {
  bg:"#0A0705", card:"#110D0A", glass:"rgba(255,255,255,0.04)",
  border:"rgba(255,220,160,0.10)", borderHi:"rgba(255,220,160,0.25)",
  text:"#F5ECD7", sub:"#A08060", muted:"#5A4030",
  gold:"#D4A050", goldD:"#A07830", goldL:"#F0C070", goldBg:"rgba(212,160,80,0.08)",
  navy:"#4A7AB0", navyBg:"rgba(74,122,176,0.10)",
  err:"#E05050", ok:"#50C080",
  gradGold:"linear-gradient(135deg,#D4A050 0%,#F0C070 50%,#B07030 100%)",
};

const ago = ts => {
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60000) return "maintenant";
  if (d < 3600000) return `${Math.floor(d/60000)}min`;
  if (d < 86400000) return `${Math.floor(d/3600000)}h`;
  return `${Math.floor(d/86400000)}j`;
};
const hm = ts => new Date(ts).toLocaleTimeString("fr", { hour:"2-digit", minute:"2-digit" });
const initials = (p="", n="") => ((p[0]||"")+(n[0]||"")).toUpperCase() || "?";
const PALETTE = ["#D4A050","#C47890","#6090C4","#50A870","#9070C4","#C47040","#60A0A0"];
const colorFor = id => PALETTE[(id?.charCodeAt(0)||0) % PALETTE.length];

const normProfile = p => ({
  id: p.id,
  name: `${p.prenom||""} ${(p.nom||"")[0]||""}.`.trim(),
  fullName: `${p.prenom||""} ${p.nom||""}`.trim(),
  initials: initials(p.prenom, p.nom),
  color: colorFor(p.id),
  badge: p.badge || null,
  status: p.status || "pending",
  paroisse: p.paroisse || "—",
  age: p.age || null,
  online: false,
  joined: p.joined_at?.slice(0,10) || "",
  bio: p.bio || "",
  avatar_url: p.avatar_url || null,
  is_admin: p.is_admin || false,
});

/* ── SOUND NOTIFICATION ── */
const playNotifSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
  } catch(_) {}
};

/* ── PUSH NOTIFICATIONS ── */
const requestPushPermission = async () => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const perm = await Notification.requestPermission();
  return perm === "granted";
};
const sendPushNotif = (title, body, icon="") => {
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon });
  }
};

const GS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=DM+Sans:wght@300;400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; background: ${T.bg}; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 2px; }
  input, textarea, select, button { font-family: 'DM Sans', sans-serif; }
  input::placeholder, textarea::placeholder { color: ${T.muted}; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
  @keyframes shimmer { 0%,100% { opacity:.5; } 50% { opacity:1; } }
  @keyframes glow { 0%,100% { box-shadow: 0 0 20px rgba(212,160,80,0.2); } 50% { box-shadow: 0 0 40px rgba(212,160,80,0.5); } }
  @keyframes slideIn { from { transform: translateX(100%); opacity:0; } to { transform: none; opacity:1; } }
  @keyframes slideUp { from { transform: translateY(100%); opacity:0; } to { transform: none; opacity:1; } }
  @keyframes notifIn { from { opacity:0; transform: translateY(-20px) scale(0.95); } to { opacity:1; transform: none; } }
  @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
`;

function Av({ u, size=40, online=false }) {
  return (
    <div style={{ position:"relative", flexShrink:0, width:size, height:size }}>
      {u?.avatar_url
        ? <img src={u.avatar_url} style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", display:"block", border:`1.5px solid ${T.border}` }} alt="" />
        : <div style={{ width:size, height:size, borderRadius:"50%", background:`radial-gradient(135deg at 30% 30%, ${u?.color||"#888"}aa, ${u?.color||"#555"}44)`, border:`1.5px solid ${u?.color||"#888"}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:Math.round(size*.36), fontWeight:700, color:u?.color||"#fff", fontFamily:"'Cormorant Garamond', serif" }}>
            {u?.initials||"?"}
          </div>
      }
      {online && <div style={{ position:"absolute", bottom:1, right:1, width:Math.round(size*.26), height:Math.round(size*.26), borderRadius:"50%", background:T.ok, border:`2px solid ${T.bg}` }} />}
    </div>
  );
}

function Badge({ type }) {
  if (!type) return null;
  const cfg = type === "confirmed"
    ? { bg:"rgba(212,160,80,0.12)", color:T.gold, border:`1px solid ${T.gold}44`, txt:"✦ Confirmé" }
    : { bg:"rgba(74,122,176,0.12)", color:T.navy, border:`1px solid ${T.navy}44`, txt:"◉ Ami de l'Église" };
  return <span style={{ fontSize:10, padding:"3px 10px", borderRadius:20, fontWeight:600, background:cfg.bg, color:cfg.color, border:cfg.border, whiteSpace:"nowrap", letterSpacing:.5 }}>{cfg.txt}</span>;
}

const Btn = ({ children, onClick, style={}, disabled=false, type="button" }) => (
  <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled}
    style={{ cursor: disabled ? "not-allowed" : "pointer", border:"none", background:"none", outline:"none", ...style }}>
    {children}
  </button>
);

function Toast({ msg }) {
  return (
    <div style={{ position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)", background:"rgba(212,160,80,0.95)", backdropFilter:"blur(20px)", color:T.bg, padding:"10px 22px", borderRadius:24, fontSize:13, fontWeight:700, zIndex:9999, boxShadow:"0 8px 32px rgba(212,160,80,0.4)", whiteSpace:"nowrap", animation:"fadeUp .3s ease" }}>
      {msg}
    </div>
  );
}

/* ── IN-APP NOTIFICATION BANNER ── */
function NotifBanner({ notifs, onDismiss, onTap }) {
  if (!notifs.length) return null;
  const n = notifs[0];
  return (
    <div onClick={() => { onTap(n); onDismiss(n.id); }}
      style={{ position:"fixed", top:0, left:0, right:0, zIndex:9998, display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:"rgba(17,13,10,0.97)", borderBottom:`1px solid ${T.gold}44`, backdropFilter:"blur(20px)", animation:"notifIn .4s ease", cursor:"pointer", boxShadow:"0 8px 32px rgba(0,0,0,0.6)" }}>
      <div style={{ width:36, height:36, borderRadius:"50%", background:T.gradGold, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{n.icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ margin:0, fontSize:13, fontWeight:700, color:T.text }}>{n.title}</p>
        <p style={{ margin:0, fontSize:12, color:T.sub, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n.body}</p>
      </div>
      <Btn onClick={e => { e.stopPropagation(); onDismiss(n.id); }} style={{ color:T.muted, fontSize:18, padding:"0 4px" }}>✕</Btn>
    </div>
  );
}

/* ── IMAGE VIEWER avec pinch-zoom ── */
function ImageViewer({ url, onClose }) {
  const ref = useRef();
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x:0, y:0 });
  const lastDist = useRef(null);
  const lastPos = useRef(null);
  const isDragging = useRef(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const getDist = touches => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx*dx + dy*dy);
  };

  const onTouchStart = e => {
    if (e.touches.length === 2) {
      lastDist.current = getDist(e.touches);
    } else if (e.touches.length === 1) {
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      isDragging.current = true;
    }
  };

  const onTouchMove = e => {
    e.preventDefault();
    if (e.touches.length === 2 && lastDist.current) {
      const newDist = getDist(e.touches);
      const delta = newDist / lastDist.current;
      setScale(s => Math.min(Math.max(s * delta, 0.5), 5));
      lastDist.current = newDist;
    } else if (e.touches.length === 1 && isDragging.current && lastPos.current && scale > 1) {
      const dx = e.touches[0].clientX - lastPos.current.x;
      const dy = e.touches[0].clientY - lastPos.current.y;
      setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const onTouchEnd = e => {
    lastDist.current = null; isDragging.current = false; lastPos.current = null;
  };

  const reset = () => { setScale(1); setOffset({ x:0, y:0 }); };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(0,0,0,0.97)", display:"flex", alignItems:"center", justifyContent:"center", touchAction:"none" }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div style={{ position:"absolute", top:16, right:16, display:"flex", gap:10, zIndex:1 }}>
        <Btn onClick={reset} style={{ background:"rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 14px", color:"#fff", fontSize:12, fontWeight:600 }}>↺ Reset</Btn>
        <Btn onClick={onClose} style={{ background:"rgba(255,255,255,0.1)", borderRadius:"50%", width:40, height:40, color:"#fff", fontSize:20, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</Btn>
      </div>
      <img ref={ref} src={url} alt=""
        style={{ maxWidth:"95vw", maxHeight:"90vh", objectFit:"contain", borderRadius:12, transform:`scale(${scale}) translate(${offset.x/scale}px, ${offset.y/scale}px)`, transition: isDragging.current ? "none" : "transform .1s ease", userSelect:"none", WebkitUserSelect:"none" }}
        onDoubleClick={() => scale === 1 ? setScale(2) : reset()}
        draggable={false}
      />
      <p style={{ position:"absolute", bottom:20, left:"50%", transform:"translateX(-50%)", color:"rgba(255,255,255,0.4)", fontSize:11 }}>Pincer pour zoomer · Double-tap pour agrandir</p>
    </div>
  );
}

/* ── MEDIA PLAYER — sans window.open ── */
function MediaPlayer({ url, style={}, onImageClick }) {
  if (!url) return null;
  const isVideo = /\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(url) || url.includes("video");
  if (isVideo) return (
    <video src={url} controls playsInline style={{ width:"100%", maxHeight:420, objectFit:"cover", display:"block", background:"#000", ...style }}
      onError={e => e.target.style.display="none"} />
  );
  return (
    <img src={url} alt=""
      style={{ width:"100%", maxHeight:420, objectFit:"cover", display:"block", cursor:"zoom-in", ...style }}
      onClick={() => onImageClick ? onImageClick(url) : null}
      onError={e => e.target.style.display="none"} />
  );
}

/* ── POST DETAIL MODAL ── */
function PostDetailModal({ post, myProfile, session, getM, onClose, onLike, onComment, notify }) {
  const [cmtTxt, setCmtTxt] = useState("");
  const [viewImg, setViewImg] = useState(null);
  const auth = post.author || getM(post.by);
  const liked = post.likes.includes(session.user.id);

  const addCmt = async () => {
    if (!cmtTxt.trim()) return;
    const { error } = await sb.from("comments").insert({ post_id: post.id, author_id: session.user.id, text: cmtTxt.trim() });
    if (!error) { setCmtTxt(""); onComment(); notify("Commentaire ajouté ✦"); }
  };

  return (
    <>
      {viewImg && <ImageViewer url={viewImg} onClose={() => setViewImg(null)} />}
      <div style={{ position:"fixed", inset:0, zIndex:800, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(8px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}
        onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:640, maxHeight:"92vh", display:"flex", flexDirection:"column", animation:"slideUp .3s ease" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 16px 10px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <Av u={auth} size={38} />
              <div>
                <p style={{ margin:0, fontSize:14, fontWeight:600, color:T.text }}>{auth?.name}</p>
                <p style={{ margin:0, fontSize:11, color:T.muted }}>{ago(post.ts)}</p>
              </div>
            </div>
            <Btn onClick={onClose} style={{ color:T.muted, fontSize:22, padding:"0 6px" }}>✕</Btn>
          </div>

          <div style={{ overflowY:"auto", flex:1 }}>
            {post.type === "event"
              ? <div style={{ margin:"12px 16px", background:T.goldBg, borderRadius:14, padding:16, border:`1px solid ${T.gold}22` }}>
                  <p style={{ margin:"0 0 6px", fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:600, color:T.text }}>{post.title}</p>
                  {post.text && <p style={{ margin:"0 0 10px", fontSize:13, color:T.sub, lineHeight:1.7 }}>{post.text}</p>}
                  {post.eventDate && <p style={{ margin:"0 0 3px", fontSize:12, color:T.gold }}>🗓 {post.eventDate}</p>}
                  {post.eventLoc && <p style={{ margin:0, fontSize:12, color:T.sub }}>📍 {post.eventLoc}</p>}
                </div>
              : <>
                  {post.text && <p style={{ margin:"12px 16px 8px", fontSize:14, color:T.text, lineHeight:1.75, whiteSpace:"pre-line" }}>{post.text}</p>}
                  {post.img && <MediaPlayer url={post.img} onImageClick={setViewImg} />}
                </>
            }

            <div style={{ display:"flex", alignItems:"center", gap:16, padding:"10px 16px", borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}` }}>
              <Btn onClick={() => onLike(post.id)} style={{ display:"flex", alignItems:"center", gap:6, color:liked?T.gold:T.muted, fontSize:13, fontWeight:600 }}>
                <span style={{ fontSize:18, animation: liked ? "pulse .3s ease" : "none" }}>{liked?"❤️":"🤍"}</span>
                {post.likes.length} {post.likes.length > 1 ? "j'aimes" : "j'aime"}
              </Btn>
              <span style={{ color:T.muted, fontSize:13 }}>💬 {post.comments.length} commentaire{post.comments.length > 1 ? "s" : ""}</span>
            </div>

            <div style={{ padding:"12px 16px" }}>
              {post.comments.length === 0 && <p style={{ color:T.muted, fontSize:13, textAlign:"center", padding:"20px 0", fontStyle:"italic" }}>Aucun commentaire encore</p>}
              {post.comments.map(c => {
                const cu = c.author || getM(c.by);
                return (
                  <div key={c.id} style={{ display:"flex", gap:9, marginBottom:14 }}>
                    <Av u={cu} size={32} />
                    <div style={{ flex:1 }}>
                      <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:"0 12px 12px 12px", padding:"9px 13px", border:`1px solid ${T.border}` }}>
                        <p style={{ margin:"0 0 4px", fontSize:12, fontWeight:700, color:T.gold }}>{cu?.name}</p>
                        <p style={{ margin:0, fontSize:13, color:T.text, lineHeight:1.55 }}>{c.text}</p>
                      </div>
                      <span style={{ fontSize:10, color:T.muted, paddingLeft:4 }}>{ago(c.ts)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display:"flex", gap:8, alignItems:"center", padding:"10px 14px", borderTop:`1px solid ${T.border}`, flexShrink:0, paddingBottom:"calc(10px + env(safe-area-inset-bottom, 0px))" }}>
            <Av u={myProfile} size={32} />
            <div style={{ flex:1, display:"flex", gap:6, background:"rgba(255,255,255,0.04)", borderRadius:22, padding:"6px 6px 6px 14px", border:`1px solid ${T.border}` }}>
              <input value={cmtTxt} onChange={e => setCmtTxt(e.target.value)}
                onKeyDown={e => e.key==="Enter" && addCmt()}
                placeholder="Commenter…"
                style={{ flex:1, background:"none", border:"none", color:T.text, fontSize:13, outline:"none" }} />
              <Btn onClick={addCmt} style={{ background:cmtTxt.trim()?T.gradGold:"none", borderRadius:"50%", width:32, height:32, color:cmtTxt.trim()?T.bg:T.muted, fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>↑</Btn>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── AUTH ── */
function AuthScreen({ mode, setMode, onSuccess }) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [paroisse, setParoisse] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const reset = () => { setErr(""); setPrenom(""); setNom(""); setParoisse(""); setEmail(""); setPw(""); };

  const submit = async e => {
    e?.preventDefault(); setErr("");
    if (mode === "register") {
      if (prenom.trim().length < 2) return setErr("Prénom requis");
      if (nom.trim().length < 2) return setErr("Nom requis");
      if (paroisse.trim().length < 2) return setErr("Paroisse requise");
    }
    if (!email.includes("@")) return setErr("Email invalide");
    if (pw.length < 6) return setErr("Mot de passe trop court");
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        onSuccess();
      } else {
        const { error } = await sb.auth.signUp({ email, password: pw, options: { data: { prenom: prenom.trim(), nom: nom.trim(), paroisse: paroisse.trim() } } });
        if (error) throw error;
        onSuccess("pending");
      }
    } catch (e2) { setErr(e2.message || "Erreur réseau"); }
    finally { setBusy(false); }
  };

  const Field = ({ val, set, placeholder, type="text" }) => (
    <div style={{ position:"relative" }}>
      <input value={val} onChange={e => { set(e.target.value); setErr(""); }}
        placeholder={placeholder} type={type === "password" && showPw ? "text" : type}
        onKeyDown={e => e.key === "Enter" && submit()}
        style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, borderRadius:14, padding:"14px 16px", color:T.text, fontSize:14, outline:"none" }}
        onFocus={e => e.target.style.borderColor = T.gold}
        onBlur={e => e.target.style.borderColor = T.border} />
      {type === "password" && (
        <Btn onClick={() => setShowPw(!showPw)} style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", color:T.muted, fontSize:16 }}>
          {showPw ? "🙈" : "👁"}
        </Btn>
      )}
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:20, fontFamily:"'DM Sans',sans-serif", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:"-20%", left:"-10%", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(212,160,80,0.06) 0%, transparent 70%)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:"-20%", right:"-10%", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle, rgba(74,122,176,0.06) 0%, transparent 70%)", pointerEvents:"none" }} />
      <div style={{ width:"100%", maxWidth:420, animation:"fadeUp .5s ease" }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:72, height:72, borderRadius:"50%", background:"rgba(212,160,80,0.10)", border:`1px solid ${T.gold}44`, marginBottom:20, animation:"glow 3s ease infinite" }}>
            <span style={{ fontSize:32, fontFamily:"'Cormorant Garamond',serif" }}>✦</span>
          </div>
          <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:48, fontWeight:300, color:T.text, letterSpacing:4, marginBottom:6 }}>Céleste</h1>
          <p style={{ color:T.muted, fontSize:13, letterSpacing:1 }}>Des rencontres ancrées dans la foi</p>
        </div>
        <div style={{ background:"rgba(255,255,255,0.03)", border:`1px solid ${T.border}`, borderRadius:24, overflow:"hidden", backdropFilter:"blur(20px)" }}>
          <div style={{ display:"flex", borderBottom:`1px solid ${T.border}` }}>
            {["login","register"].map(m => (
              <Btn key={m} onClick={() => { setMode(m); reset(); }} style={{ flex:1, padding:"16px", fontSize:13, fontWeight:600, color: mode===m ? T.gold : T.muted, borderBottom: mode===m ? `2px solid ${T.gold}` : "2px solid transparent", transition:"all .2s", letterSpacing:.5 }}>
                {m === "login" ? "Connexion" : "Inscription"}
              </Btn>
            ))}
          </div>
          <div style={{ padding:"28px 24px 32px", display:"flex", flexDirection:"column", gap:10 }}>
            {mode === "register" && (
              <>
                <div style={{ display:"flex", gap:10 }}>
                  <div style={{ flex:1 }}><Field val={prenom} set={setPrenom} placeholder="Prénom *" /></div>
                  <div style={{ flex:1 }}><Field val={nom} set={setNom} placeholder="Nom *" /></div>
                </div>
                <Field val={paroisse} set={setParoisse} placeholder="Paroisse / Ward *" />
              </>
            )}
            <Field val={email} set={setEmail} placeholder="Email *" type="email" />
            <Field val={pw} set={setPw} placeholder="Mot de passe *" type="password" />
            {err && <div style={{ background:"rgba(224,80,80,0.10)", border:`1px solid ${T.err}44`, borderRadius:10, padding:"10px 14px", color:T.err, fontSize:12 }}>⚠ {err}</div>}
            <Btn type="submit" onClick={submit} disabled={busy} style={{ padding:"15px", background: busy ? T.goldBg : T.gradGold, color:T.bg, borderRadius:14, fontSize:14, fontWeight:700, boxShadow: busy ? "none" : "0 8px 32px rgba(212,160,80,0.3)", opacity: busy ? .6 : 1, transition:"all .2s", marginTop:4 }}>
              {busy ? "⏳ Chargement…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </Btn>
            {mode === "register" && (
              <div style={{ background:T.goldBg, borderRadius:12, padding:"10px 14px", border:`1px solid ${T.gold}22`, textAlign:"center" }}>
                <p style={{ margin:0, fontSize:11, color:T.sub }}>🛡 Validation manuelle sous 24–48h</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── MAIN APP ── */
export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [session, setSession] = useState(undefined);
  const [myProfile, setMyProfile] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const [members, setMembers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [convs, setConvs] = useState([]);
  const [myConnections, setMyConnections] = useState([]); // IDs que je suis
  const [myFollowers, setMyFollowers] = useState([]);     // IDs qui me suivent
  const [tab, setTab] = useState("home");
  const [openConvId, setOpenConvId] = useState(null);
  const [openUserId, setOpenUserId] = useState(null);
  const [showNewPost, setShowNewPost] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [toast, setToast] = useState(null);
  const [postPage, setPostPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [inAppNotifs, setInAppNotifs] = useState([]);
  const [viewImg, setViewImg] = useState(null);
  const prevMsgCount = useRef(0);
  const prevCommentCount = useRef({});

  const notify = useCallback(m => { setToast(m); setTimeout(() => setToast(null), 2800); }, []);

  const addInAppNotif = useCallback((icon, title, body, action) => {
    const id = Date.now() + Math.random();
    setInAppNotifs(p => [...p, { id, icon, title, body, action }]);
    playNotifSound();
    sendPushNotif(title, body);
    setTimeout(() => setInAppNotifs(p => p.filter(n => n.id !== id)), 5000);
  }, []);

  const dismissNotif = useCallback(id => setInAppNotifs(p => p.filter(n => n.id !== id)), []);

  /* ── loadMyProfile ── */
  const loadMyProfile = useCallback(async uid => {
    const { data } = await sb.from("profiles").select("*").eq("id", uid).single();
    if (data) { setMyProfile(normProfile(data)); setIsPending(data.status === "pending"); }
  }, []);

  /* ── loadConnections ── */
  const loadConnections = useCallback(async uid => {
    if (!uid) return;
    const [{ data: following }, { data: followers }] = await Promise.all([
      sb.from("connections").select("to_id").eq("from_id", uid),
      sb.from("connections").select("from_id").eq("to_id", uid),
    ]);
    if (following) setMyConnections(following.map(d => d.to_id));
    if (followers) setMyFollowers(followers.map(d => d.from_id));
  }, []);

  /* ── Auth ── */
  useEffect(() => {
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s || null);
      if (s) { loadMyProfile(s.user.id); requestPushPermission(); }
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s || null);
      if (s) { loadMyProfile(s.user.id); requestPushPermission(); }
      else { setMyProfile(null); setIsPending(false); }
    });
    return () => subscription.unsubscribe();
  }, [loadMyProfile]);

  /* ── Loaders ── */
  const loadMembers = useCallback(async () => {
    const { data } = await sb.from("profiles").select("*").neq("status","pending");
    if (data) setMembers(data.map(normProfile));
  }, []);

  // Pagination: on ne recharge page 1 que si explicitement demandé, pas à chaque event realtime
  const loadPosts = useCallback(async (page = 1) => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data } = await sb.from("posts")
      .select(`*, author:profiles(id,prenom,nom,badge,avatar_url,paroisse), likes(user_id), comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (data) {
      const mapped = data.map(p => ({
        id: p.id, by: p.author_id,
        author: normProfile(p.author || {}),
        type: p.type, text: p.text || "",
        img: p.img_url || null,
        title: p.event_title || null,
        eventDate: p.event_date || null,
        eventLoc: p.event_loc || null,
        likes: (p.likes||[]).map(l => l.user_id),
        comments: (p.comments||[]).map(c => ({ id:c.id, by:c.author?.id, author:normProfile(c.author||{}), text:c.text, ts:new Date(c.created_at).getTime() })),
        saved: [],
        ts: new Date(p.created_at).getTime(),
      }));
      if (page === 1) setPosts(mapped);
      else setPosts(prev => {
        const ids = new Set(prev.map(p => p.id));
        return [...prev, ...mapped.filter(p => !ids.has(p.id))];
      });
      setHasMorePosts(data.length === PAGE_SIZE);
      setPostPage(page);
    }
  }, []);

  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMorePosts) return;
    setLoadingMore(true);
    await loadPosts(postPage + 1);
    setLoadingMore(false);
  }, [loadingMore, hasMorePosts, postPage, loadPosts]);

  // Mise à jour silencieuse d'un post (likes/commentaires) sans pagination
  const refreshPost = useCallback(async pid => {
    const { data } = await sb.from("posts")
      .select(`*, author:profiles(id,prenom,nom,badge,avatar_url,paroisse), likes(user_id), comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`)
      .eq("id", pid).single();
    if (data) {
      const updated = {
        id: data.id, by: data.author_id,
        author: normProfile(data.author || {}),
        type: data.type, text: data.text || "",
        img: data.img_url || null,
        title: data.event_title || null,
        eventDate: data.event_date || null,
        eventLoc: data.event_loc || null,
        likes: (data.likes||[]).map(l => l.user_id),
        comments: (data.comments||[]).map(c => ({ id:c.id, by:c.author?.id, author:normProfile(c.author||{}), text:c.text, ts:new Date(c.created_at).getTime() })),
        saved: [],
        ts: new Date(data.created_at).getTime(),
      };
      setPosts(prev => prev.map(p => p.id === pid ? updated : p));
      return updated;
    }
    return null;
  }, []);

  const loadConvs = useCallback(async myId => {
    if (!myId) return;
    const { data } = await sb.from("conversations")
      .select(`*, messages(id,sender_id,type,text,file_url,file_name,is_read,created_at)`)
      .or(`user1_id.eq.${myId},user2_id.eq.${myId}`)
      .order("created_at", { ascending: false });
    if (data) {
      const mapped = data.map(c => ({
        id: c.id,
        uid: c.user1_id === myId ? c.user2_id : c.user1_id,
        msgs: (c.messages||[]).sort((a,b) => new Date(a.created_at)-new Date(b.created_at)).map(m => ({
          id: m.id, f: m.sender_id === myId ? "me" : m.sender_id,
          type: m.type, text: m.text || "", img: m.file_url,
          fileName: m.file_name, read: m.is_read,
          ts: new Date(m.created_at).getTime(),
        })),
      }));
      setConvs(mapped);
      return mapped;
    }
    return null;
  }, []);

  /* ── Chargement initial ── */
  useEffect(() => {
    if (session?.user && myProfile && !isPending) {
      loadMembers();
      loadPosts(1);
      loadConvs(session.user.id);
      loadConnections(session.user.id);
    }
  }, [session, myProfile, isPending, loadMembers, loadPosts, loadConvs, loadConnections]);

  /* ── REALTIME — notifications intelligentes ── */
  useEffect(() => {
    if (!session?.user) return;
    const myId = session.user.id;

    const ch = sb.channel("celeste_realtime")
      // Nouveau message reçu
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"messages" }, async payload => {
        const newMsg = payload.new;
        if (newMsg.sender_id === myId) return; // mon propre message
        const updated = await loadConvs(myId);
        if (updated) {
          const totalNew = updated.reduce((a, c) => a + c.msgs.filter(m => m.f !== "me" && !m.read).length, 0);
          if (totalNew > prevMsgCount.current) {
            const conv = updated.find(c => c.msgs.some(m => m.id === newMsg.id));
            const sender = members.find(m => m.id === newMsg.sender_id);
            const preview = newMsg.type === "photo" ? "📷 Photo" : newMsg.type === "file" ? "📎 Fichier" : newMsg.text || "";
            addInAppNotif("✉", sender?.name || "Message", preview, () => {
              setOpenConvId(conv?.id);
              setTab("messages");
            });
          }
          prevMsgCount.current = totalNew;
        }
      })
      // Nouveau post
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"posts" }, () => {
        loadPosts(1);
      })
      // Likes
      .on("postgres_changes", { event:"*", schema:"public", table:"likes" }, payload => {
        const pid = payload.new?.post_id || payload.old?.post_id;
        if (pid) refreshPost(pid);
      })
      // Nouveau commentaire — notification si c'est sur mon post
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"comments" }, async payload => {
        const cmt = payload.new;
        if (!cmt) return;
        const updated = await refreshPost(cmt.post_id);
        // Notifier si le post est le mien et que ce n'est pas moi qui commente
        if (updated && updated.by === myId && cmt.author_id !== myId) {
          const commenter = members.find(m => m.id === cmt.author_id);
          addInAppNotif("💬", `${commenter?.name || "Quelqu'un"} a commenté`, cmt.text || "…", () => {
            setTab("home");
          });
        }
      })
      // Profil mis à jour
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"profiles" }, payload => {
        if (payload.new?.id === myId) loadMyProfile(myId);
        loadMembers();
      })
      // Nouvelle connexion vers moi
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"connections" }, async payload => {
        if (payload.new?.to_id === myId) {
          await loadConnections(myId);
          const follower = members.find(m => m.id === payload.new.from_id);
          addInAppNotif("✦", `${follower?.name || "Quelqu'un"} s'est connecté`, "Nouvelle connexion !", () => setTab("discover"));
        } else if (payload.new?.from_id === myId) {
          loadConnections(myId);
        }
      })
      .on("postgres_changes", { event:"DELETE", schema:"public", table:"connections" }, () => {
        loadConnections(myId);
      })
      .subscribe();
    return () => sb.removeChannel(ch);
  }, [session, members, loadConvs, loadPosts, refreshPost, loadMembers, loadMyProfile, loadConnections, addInAppNotif]);

  const goTab = t => { setTab(t); setOpenConvId(null); setOpenUserId(null); };
  const unread = convs.reduce((a,c) => a + c.msgs.filter(m => m.f !== "me" && !m.read).length, 0);
  const pending = members.filter(m => m.status === "pending").length;
  const getM = id => {
    if (id === "me" || id === session?.user?.id) return myProfile;
    return members.find(m => m.id === id) || { id:"?", initials:"?", color:"#888", name:"Inconnu", badge:null };
  };

  if (session === undefined) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{GS}</style>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:52, color:T.gold, marginBottom:24, animation:"shimmer 2s ease infinite" }}>✦</div>
        <div style={{ width:32, height:32, border:`2px solid ${T.border}`, borderTopColor:T.gold, borderRadius:"50%", animation:"spin .8s linear infinite", margin:"0 auto" }} />
      </div>
    </div>
  );

  if (!session) return (<><style>{GS}</style><AuthScreen mode={authMode} setMode={setAuthMode} onSuccess={state => { if (state === "pending") setIsPending(true); }} /></>);

  if (isPending) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"'DM Sans',sans-serif" }}>
      <style>{GS}</style>
      <div style={{ maxWidth:400, width:"100%", textAlign:"center", animation:"fadeUp .5s ease" }}>
        <div style={{ fontSize:56, marginBottom:20 }}>⏳</div>
        <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32, fontWeight:300, color:T.text, marginBottom:12 }}>Compte en attente</h2>
        <p style={{ color:T.sub, fontSize:14, lineHeight:1.8, marginBottom:24 }}>Bonjour <strong style={{color:T.gold}}>{myProfile?.name}</strong> !<br/>Un administrateur vérifiera votre profil sous 24–48h.</p>
        <Btn onClick={() => sb.auth.signOut()} style={{ padding:"12px 28px", background:"rgba(224,80,80,0.1)", border:`1px solid ${T.err}44`, borderRadius:12, color:T.err, fontSize:14, fontWeight:600 }}>Se déconnecter</Btn>
      </div>
    </div>
  );

  const openConv = convs.find(c => c.id === openConvId);
  const openUser = members.find(m => m.id === openUserId);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:T.bg, color:T.text, overflow:"hidden", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{GS}</style>
      {toast && <Toast msg={toast} />}
      {viewImg && <ImageViewer url={viewImg} onClose={() => setViewImg(null)} />}
      <NotifBanner
        notifs={inAppNotifs}
        onDismiss={dismissNotif}
        onTap={n => { n.action?.(); dismissNotif(n.id); }}
      />
      {showNewPost && <NewPostModal myProfile={myProfile} session={session} onClose={() => setShowNewPost(false)} onPost={() => { loadPosts(1); setShowNewPost(false); notify("Publié ✦"); }} />}
      {showAdmin && myProfile?.is_admin && <AdminPanel members={members} setMembers={setMembers} onClose={() => setShowAdmin(false)} notify={notify} reload={loadMembers} />}

      {/* TOP BAR */}
      <div style={{ height:56, background:"rgba(10,7,5,0.95)", backdropFilter:"blur(20px)", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", padding:"0 16px", gap:12, flexShrink:0, zIndex:30 }}>
        {(openConvId || openUserId)
          ? <>
              <Btn onClick={() => { setOpenConvId(null); setOpenUserId(null); }} style={{ color:T.gold, fontSize:22, padding:"0 8px 0 0" }}>←</Btn>
              <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:400, color:T.text }}>
                {openConvId ? getM(openConv?.uid)?.name : openUser?.name}
              </span>
            </>
          : <>
              <div style={{ display:"flex", alignItems:"center", gap:10, flex:1 }}>
                <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, color:T.gold, letterSpacing:2 }}>✦</span>
                <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:300, letterSpacing:3, color:T.text }}>Céleste</span>
              </div>
              {myProfile?.is_admin && (
                <Btn onClick={() => setShowAdmin(true)} style={{ position:"relative", padding:"6px 12px", borderRadius:10, border:`1px solid ${pending > 0 ? T.err+"66" : T.border}`, background: pending > 0 ? "rgba(224,80,80,0.08)" : T.glass, color: pending > 0 ? T.err : T.muted, fontSize:12, fontWeight:600 }}>
                  🛡 {pending > 0 && <span style={{ background:T.err, color:"#fff", borderRadius:"50%", width:16, height:16, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:900, marginLeft:4 }}>{pending}</span>}
                </Btn>
              )}
            </>
        }
      </div>

      {/* CONTENT */}
      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        {openUserId && openUser
          ? <UserView user={openUser} myProfile={myProfile} session={session} posts={posts} onBack={() => setOpenUserId(null)}
              onChat={uid => {
                setOpenUserId(null);
                let c = convs.find(x => x.uid === uid);
                if (!c) { c = { id:"cv"+Date.now(), uid, msgs:[] }; setConvs(p => [...p, c]); }
                setOpenConvId(c.id); setTab("messages");
              }}
              notify={notify}
              myConnections={myConnections}
              myFollowers={myFollowers}
              onConnectionChange={() => loadConnections(session.user.id)}
              onImageView={setViewImg}
            />
          : openConvId && openConv
            ? <ChatScreen conv={openConv} myProfile={myProfile} session={session} members={members} reload={() => loadConvs(session.user.id)} notify={notify} onImageView={setViewImg} />
            : tab === "home"
              ? <HomeTab posts={posts} setPosts={setPosts} myProfile={myProfile} session={session} getM={getM} onNewPost={() => setShowNewPost(true)} onUser={setOpenUserId} notify={notify} reload={() => loadPosts(1)} loadMore={loadMorePosts} hasMore={hasMorePosts} loadingMore={loadingMore} refreshPost={refreshPost} onImageView={setViewImg} />
              : tab === "statuses"
                ? <StatusesTab myProfile={myProfile} session={session} members={members} myConnections={myConnections} myFollowers={myFollowers} notify={notify} />
                : tab === "discover"
                  ? <DiscoverTab members={members} myProfile={myProfile} session={session} onUser={setOpenUserId} notify={notify} myConnections={myConnections} onConnectionChange={() => loadConnections(session.user.id)} />
                  : tab === "messages"
                    ? <MsgsTab convs={convs} members={members} getM={getM} onOpen={id => setOpenConvId(id)} />
                    : <ProfileTab myProfile={myProfile} session={session} posts={posts} onNewPost={() => setShowNewPost(true)} notify={notify} onLogout={() => sb.auth.signOut()} reload={() => { loadPosts(1); loadMyProfile(session.user.id); }} myConnections={myConnections} myFollowers={myFollowers} onImageView={setViewImg} />
        }
      </div>

      {/* BOTTOM NAV */}
      {!openConvId && !openUserId && (
        <div style={{ height:60, background:"rgba(10,7,5,0.97)", backdropFilter:"blur(20px)", borderTop:`1px solid ${T.border}`, display:"flex", flexShrink:0, zIndex:30 }}>
          {[
            { id:"home", ic:"⌂", lb:"Accueil" },
            { id:"statuses", ic:"◑", lb:"Statuts" },
            { id:"discover", ic:"✦", lb:"Découvrir" },
            { id:"messages", ic:"✉", lb:"Messages", badge:unread },
            { id:"profile", ic:"◎", lb:"Profil" }
          ].map(t => (
            <Btn key={t.id} onClick={() => goTab(t.id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, color: tab === t.id ? T.gold : T.muted, position:"relative", transition:"color .2s" }}>
              <span style={{ fontSize: tab === t.id ? 22 : 18, lineHeight:1, filter: tab === t.id ? `drop-shadow(0 0 8px ${T.gold}88)` : "none" }}>{t.ic}</span>
              <span style={{ fontSize:9, fontWeight: tab === t.id ? 700 : 400, letterSpacing:.5 }}>{t.lb}</span>
              {t.badge > 0 && <span style={{ position:"absolute", top:8, right:"calc(50% - 18px)", background:T.err, color:"#fff", borderRadius:10, minWidth:15, height:15, display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:900, padding:"0 3px" }}>{t.badge}</span>}
              {tab === t.id && <div style={{ position:"absolute", bottom:0, width:24, height:2, borderRadius:1, background:T.gradGold }} />}
            </Btn>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── HOME TAB ── */
function HomeTab({ posts, setPosts, myProfile, session, getM, onNewPost, onUser, notify, reload, loadMore, hasMore, loadingMore, refreshPost, onImageView }) {
  const [detailPost, setDetailPost] = useState(null);
  const bottomRef = useRef();

  useEffect(() => {
    const obs = new IntersectionObserver(entries => { if (entries[0].isIntersecting) loadMore(); }, { threshold: 0.1 });
    if (bottomRef.current) obs.observe(bottomRef.current);
    return () => obs.disconnect();
  }, [loadMore]);

  const toggleLike = async pid => {
    const post = posts.find(p => p.id === pid);
    const liked = post?.likes.includes(session.user.id);
    if (liked) {
      await sb.from("likes").delete().eq("post_id",pid).eq("user_id",session.user.id);
      setPosts(pp => pp.map(p => p.id !== pid ? p : { ...p, likes: p.likes.filter(x => x !== session.user.id) }));
    } else {
      await sb.from("likes").insert({ post_id:pid, user_id:session.user.id });
      setPosts(pp => pp.map(p => p.id !== pid ? p : { ...p, likes: [...p.likes, session.user.id] }));
    }
  };

  const deletePost = async pid => {
    await sb.from("posts").delete().eq("id", pid);
    reload(); notify("Publication supprimée");
  };

  // Ouvrir le détail d'un post (commentaires etc.)
  const openDetail = post => setDetailPost(post);

  return (
    <div style={{ flex:1, overflowY:"auto" }}>
      {detailPost && (
        <PostDetailModal
          post={detailPost}
          myProfile={myProfile}
          session={session}
          getM={getM}
          onClose={() => setDetailPost(null)}
          onLike={async pid => {
            await toggleLike(pid);
            const updated = await refreshPost(pid);
            if (updated) setDetailPost(updated);
          }}
          onComment={async () => {
            const updated = await refreshPost(detailPost.id);
            if (updated) setDetailPost(updated);
          }}
          notify={notify}
        />
      )}

      <div style={{ position:"sticky", top:0, zIndex:10, background:"rgba(10,7,5,0.95)", backdropFilter:"blur(20px)", borderBottom:`1px solid ${T.border}`, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <p style={{ margin:0, fontSize:11, color:T.muted, letterSpacing:1 }}>BIENVENUE</p>
          <h2 style={{ margin:0, fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:400, color:T.text }}>{myProfile?.name}</h2>
        </div>
        <Btn onClick={onNewPost} style={{ background:T.gradGold, color:T.bg, borderRadius:12, padding:"9px 18px", fontWeight:700, fontSize:13, boxShadow:"0 4px 20px rgba(212,160,80,0.3)" }}>+ Publier</Btn>
      </div>

      <div style={{ maxWidth:640, margin:"0 auto", padding:"8px 0 80px" }}>
        {posts.length === 0
          ? <div style={{ textAlign:"center", padding:"60px 20px", color:T.muted }}>
              <div style={{ fontSize:40, marginBottom:12 }}>✦</div>
              <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20 }}>Aucune publication encore</p>
            </div>
          : posts.map((p, i) => {
              const auth = p.author || getM(p.by);
              const liked = p.likes.includes(session.user.id);
              const canDelete = p.by === session.user.id || myProfile?.is_admin;
              return (
                <div key={p.id} style={{ background:T.card, marginBottom:1, borderTop:`1px solid ${T.border}`, animation:`fadeUp .4s ease ${Math.min(i,5)*.05}s both` }}>
                  <div style={{ padding:"14px 16px 10px", display:"flex", alignItems:"center", gap:11 }}>
                    <Btn onClick={() => onUser(p.by)} style={{ padding:0 }}><Av u={auth} size={42} /></Btn>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                        <Btn onClick={() => onUser(p.by)} style={{ padding:0, fontSize:14, fontWeight:600, color:T.text }}>{auth?.name}</Btn>
                        <Badge type={auth?.badge} />
                      </div>
                      <span style={{ fontSize:11, color:T.muted }}>{ago(p.ts)}</span>
                    </div>
                    {canDelete && (
                      <Btn onClick={() => deletePost(p.id)} style={{ background:"rgba(224,80,80,0.08)", border:`1px solid ${T.err}33`, borderRadius:8, padding:"4px 10px", color:T.err, fontSize:11 }}>🗑</Btn>
                    )}
                  </div>

                  {p.type === "event"
                    ? <div style={{ margin:"0 16px 12px", background:"linear-gradient(135deg,rgba(212,160,80,0.08),rgba(212,160,80,0.03))", borderRadius:16, padding:16, border:`1px solid ${T.gold}22` }}>
                        <p style={{ margin:"0 0 6px", fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:600, color:T.text }}>{p.title}</p>
                        {p.text && <p style={{ margin:"0 0 10px", fontSize:13, color:T.sub, lineHeight:1.7 }}>{p.text}</p>}
                        {p.eventDate && <p style={{ margin:"0 0 3px", fontSize:12, color:T.gold }}>🗓 {p.eventDate}</p>}
                        {p.eventLoc && <p style={{ margin:0, fontSize:12, color:T.sub }}>📍 {p.eventLoc}</p>}
                      </div>
                    : <>
                        {p.text && <p style={{ margin:"0 16px 12px", fontSize:14, color:T.text, lineHeight:1.75, whiteSpace:"pre-line" }}>{p.text}</p>}
                        {p.img && (
                          <div style={{ overflow:"hidden" }}>
                            <MediaPlayer url={p.img} onImageClick={onImageView} />
                          </div>
                        )}
                      </>
                  }

                  {p.likes.length > 0 && <p style={{ margin:"8px 16px 0", fontSize:11, color:T.muted }}>❤ {p.likes.length} {p.likes.length > 1 ? "personnes aiment" : "personne aime"}</p>}

                  <div style={{ display:"flex", borderTop:`1px solid ${T.border}`, marginTop:10 }}>
                    {[
                      { ic: liked ? "❤️" : "🤍", lb:"J'aime", fn:() => toggleLike(p.id), active:liked },
                      { ic:"💬", lb: p.comments.length || "", fn:() => openDetail(p), active:false },
                      { ic:"↗", lb:"Partager", fn:() => { navigator.clipboard?.writeText(window.location.href); notify("Lien copié 🔗"); } },
                    ].map(a => (
                      <Btn key={a.lb} onClick={a.fn} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, color: a.active ? T.gold : T.muted, fontWeight:600, fontSize:12, padding:"10px 4px" }}>
                        <span style={{ fontSize:15 }}>{a.ic}</span>{a.lb !== "" && <span>{a.lb}</span>}
                      </Btn>
                    ))}
                  </div>
                </div>
              );
            })
        }
        <div ref={bottomRef} style={{ padding:"20px", textAlign:"center" }}>
          {loadingMore && <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, color:T.muted, fontSize:13 }}><div style={{ width:20, height:20, border:`2px solid ${T.border}`, borderTopColor:T.gold, borderRadius:"50%", animation:"spin .8s linear infinite" }} />Chargement…</div>}
          {!hasMore && posts.length > 0 && <p style={{ color:T.muted, fontSize:12, fontStyle:"italic" }}>✦ Vous avez tout vu</p>}
        </div>
      </div>
    </div>
  );
}

/* ── NEW POST MODAL ── */
function NewPostModal({ myProfile, session, onClose, onPost }) {
  const [type, setType] = useState("text");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null);
  const [imgUrl, setImgUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [evTitle, setEvTitle] = useState("");
  const [evDate, setEvDate] = useState("");
  const [evLoc, setEvLoc] = useState("");
  const [busy, setBusy] = useState(false);
  const fRef = useRef();

  const handlePick = async e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = ev => setPreview(ev.target.result); r.readAsDataURL(f);
    setUploading(true);
    const path = `posts/${session.user.id}/${Date.now()}_${f.name}`;
    const { error } = await sb.storage.from("celeste-media").upload(path, f, { upsert:true });
    if (!error) { const { data: { publicUrl } } = sb.storage.from("celeste-media").getPublicUrl(path); setImgUrl(publicUrl); }
    setUploading(false);
  };

  const submit = async () => {
    if (busy) return; setBusy(true);
    const { error } = await sb.from("posts").insert({ author_id:session.user.id, type, text:text.trim()||"", img_url:type==="photo"?imgUrl:null, event_title:type==="event"?evTitle.trim():null, event_date:type==="event"?evDate:null, event_loc:type==="event"?evLoc:null });
    setBusy(false); if (!error) onPost();
  };

  const ok = type==="text" ? text.trim().length>0 : type==="photo" ? imgUrl!==null : evTitle.trim().length>0;

  return (
    <div style={{ position:"fixed", inset:0, zIndex:400, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(8px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:640, padding:"20px 20px 40px", maxHeight:"92vh", overflowY:"auto", animation:"slideUp .3s ease" }}>
        <input ref={fRef} type="file" accept="image/*,video/*" style={{ display:"none" }} onChange={handlePick} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <Av u={myProfile} size={38} />
            <div>
              <p style={{ margin:0, fontSize:14, fontWeight:600, color:T.text }}>{myProfile?.fullName}</p>
              <p style={{ margin:0, fontSize:11, color:T.muted }}>⛪ {myProfile?.paroisse}</p>
            </div>
          </div>
          <Btn onClick={onClose} style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:"50%", width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:T.muted }}>✕</Btn>
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:16, background:"rgba(255,255,255,0.03)", borderRadius:12, padding:4 }}>
          {[{id:"text",l:"✍ Texte"},{id:"photo",l:"📷 Média"},{id:"event",l:"📅 Événement"}].map(t => (
            <Btn key={t.id} onClick={() => setType(t.id)} style={{ flex:1, padding:"8px", borderRadius:9, background:type===t.id?T.goldBg:"none", color:type===t.id?T.gold:T.muted, fontSize:12, fontWeight:type===t.id?700:400, border:type===t.id?`1px solid ${T.gold}44`:"1px solid transparent" }}>{t.l}</Btn>
          ))}
        </div>
        {type==="photo" && (preview
          ? <div style={{ position:"relative", marginBottom:12 }}>
              <MediaPlayer url={preview} style={{ borderRadius:14, maxHeight:280 }} />
              {uploading && <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.6)", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center" }}><div style={{ width:32, height:32, border:`3px solid ${T.border}`, borderTopColor:T.gold, borderRadius:"50%", animation:"spin .8s linear infinite" }} /></div>}
              <Btn onClick={() => { setPreview(null); setImgUrl(null); }} style={{ position:"absolute", top:8, right:8, background:"rgba(0,0,0,0.7)", borderRadius:"50%", width:30, height:30, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</Btn>
            </div>
          : <Btn onClick={() => fRef.current.click()} style={{ width:"100%", height:140, borderRadius:14, border:`2px dashed ${T.gold}44`, background:T.goldBg, color:T.gold, fontSize:13, fontWeight:600, marginBottom:12, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}><span style={{ fontSize:36 }}>📷</span>Photo ou Vidéo</Btn>
        )}
        {type==="event" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:8 }}>
            {[{val:evTitle,set:setEvTitle,ph:"Titre *"},{val:evDate,set:setEvDate,ph:"Date et heure"},{val:evLoc,set:setEvLoc,ph:"Lieu"}].map(({val,set,ph}) => (
              <input key={ph} value={val} onChange={e => set(e.target.value)} placeholder={ph} style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, borderRadius:12, padding:"12px 14px", color:T.text, fontSize:13, outline:"none" }} />
            ))}
          </div>
        )}
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder={type==="photo"?"Légende…":type==="event"?"Description…":"Partagez avec la communauté 🌿"} rows={4}
          style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, borderRadius:14, padding:"13px 14px", color:T.text, fontSize:14, outline:"none", resize:"none", lineHeight:1.65, marginBottom:14 }} />
        <div style={{ display:"flex", gap:8 }}>
          <Btn onClick={onClose} style={{ flex:1, padding:"13px", background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, borderRadius:13, color:T.sub, fontSize:14, fontWeight:600 }}>Annuler</Btn>
          <Btn onClick={submit} disabled={!ok||busy||uploading} style={{ flex:2, padding:"13px", background:ok&&!busy&&!uploading?T.gradGold:"rgba(255,255,255,0.05)", color:ok&&!busy&&!uploading?T.bg:T.muted, borderRadius:13, fontSize:14, fontWeight:700, transition:"all .2s" }}>
            {busy?"Publication…":uploading?"Upload…":"Publier ✦"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ── STATUSES TAB — visibilité basée sur connexion ── */
function StatusesTab({ myProfile, session, members, myConnections, myFollowers, notify }) {
  const [allStatuses, setAllStatuses] = useState([]);
  const [myStatuses, setMyStatuses] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [viewUser, setViewUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // IDs autorisés à voir mes statuts : ceux qui me suivent (si A suit B, B peut voir les statuts de A)
  // Et je peux voir les statuts de ceux que je suis
  // Logique : si A suit B → A voit statuts de B, et B voit statuts de A (automatique dans les deux sens)

  const loadStatuses = useCallback(async () => {
    const cutoff = new Date(Date.now() - 86400000).toISOString();
    const { data } = await sb.from("statuses")
      .select(`*, author:profiles(id,prenom,nom,avatar_url,badge)`)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false });
    if (data) {
      const mapped = data.map(s => ({ id:s.id, userId:s.user_id, author:normProfile(s.author||{}), type:s.type||"text", text:s.text||"", mediaUrl:s.media_url||null, ts:new Date(s.created_at).getTime() }));
      setAllStatuses(mapped);
      setMyStatuses(mapped.filter(s => s.userId === session?.user?.id));
    }
    setLoading(false);
  }, [session]);

  useEffect(() => { loadStatuses(); }, [loadStatuses]);

  const deleteStatus = async id => {
    await sb.from("statuses").delete().eq("id", id);
    loadStatuses(); notify("Statut supprimé");
  };

  // Ensemble des IDs avec qui j'ai une connexion dans un sens ou dans l'autre
  const connectedIds = new Set([...myConnections, ...myFollowers]);

  const byUser = {};
  allStatuses.forEach(s => {
    if (!byUser[s.userId]) byUser[s.userId] = { author:s.author, items:[] };
    byUser[s.userId].items.push(s);
  });

  // Filtrer : seulement moi + les gens avec qui je suis connecté (dans un sens ou l'autre)
  const visibleUsers = Object.entries(byUser).filter(([uid]) =>
    uid === session?.user?.id || connectedIds.has(uid)
  );
  const otherUsers = visibleUsers.filter(([uid]) => uid !== session?.user?.id);

  return (
    <div style={{ flex:1, overflowY:"auto" }}>
      <div style={{ position:"sticky", top:0, zIndex:10, background:"rgba(10,7,5,0.95)", backdropFilter:"blur(20px)", borderBottom:`1px solid ${T.border}`, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <h2 style={{ margin:0, fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:400, color:T.text }}>Statuts</h2>
        <Btn onClick={() => setShowAdd(true)} style={{ background:T.gradGold, color:T.bg, borderRadius:12, padding:"8px 16px", fontWeight:700, fontSize:13 }}>+ Ajouter</Btn>
      </div>
      {showAdd && <AddStatusModal session={session} myStatuses={myStatuses} onClose={() => setShowAdd(false)} onDone={() => { loadStatuses(); setShowAdd(false); notify("Statut publié ✦"); }} />}
      {viewUser && byUser[viewUser] && <StatusViewer statuses={byUser[viewUser].items} author={byUser[viewUser].author} isMe={viewUser===session?.user?.id} onDelete={deleteStatus} onClose={() => setViewUser(null)} />}
      <div style={{ maxWidth:640, margin:"0 auto", padding:"12px 16px 80px" }}>
        <div style={{ marginBottom:20 }}>
          <p style={{ fontSize:11, color:T.muted, letterSpacing:1, marginBottom:10 }}>MON STATUT</p>
          <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", background:T.card, borderRadius:16, border:`1px solid ${T.border}`, cursor:"pointer" }} onClick={() => myStatuses.length>0 ? setViewUser(session.user.id) : setShowAdd(true)}>
            <div style={{ position:"relative" }}>
              <Av u={myProfile} size={52} />
              {myStatuses.length===0 && <div style={{ position:"absolute", bottom:0, right:0, width:20, height:20, borderRadius:"50%", background:T.gradGold, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, border:`2px solid ${T.bg}` }}>+</div>}
              {myStatuses.length>0 && <div style={{ position:"absolute", inset:-3, borderRadius:"50%", border:`2px solid ${T.gold}`, pointerEvents:"none" }} />}
            </div>
            <div style={{ flex:1 }}>
              <p style={{ margin:"0 0 2px", fontSize:14, fontWeight:600, color:T.text }}>Mon statut</p>
              <p style={{ margin:0, fontSize:12, color:T.muted }}>{myStatuses.length===0?"Appuyez pour ajouter un statut":`${myStatuses.length}/10 · ${ago(myStatuses[0].ts)}`}</p>
            </div>
          </div>
        </div>
        {loading
          ? <div style={{ textAlign:"center", padding:30 }}><div style={{ width:24, height:24, border:`2px solid ${T.border}`, borderTopColor:T.gold, borderRadius:"50%", animation:"spin .8s linear infinite", margin:"0 auto" }} /></div>
          : otherUsers.length===0
            ? <div style={{ textAlign:"center", padding:"40px 0", color:T.muted }}>
                <div style={{ fontSize:36, marginBottom:10 }}>◑</div>
                <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18 }}>Aucun statut de vos connexions</p>
                <p style={{ fontSize:12, marginTop:8, color:T.muted }}>Connectez-vous à des membres pour voir leurs statuts</p>
              </div>
            : <>
                <p style={{ fontSize:11, color:T.muted, letterSpacing:1, marginBottom:10 }}>CONNEXIONS RÉCENTES</p>
                {otherUsers.map(([uid, { author, items }]) => (
                  <div key={uid} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:T.card, borderRadius:16, border:`1px solid ${T.border}`, marginBottom:8, cursor:"pointer" }} onClick={() => setViewUser(uid)}>
                    <div style={{ position:"relative" }}>
                      <Av u={author} size={52} />
                      <div style={{ position:"absolute", inset:-3, borderRadius:"50%", border:`2px solid ${T.gold}`, pointerEvents:"none" }} />
                    </div>
                    <div style={{ flex:1 }}>
                      <p style={{ margin:"0 0 2px", fontSize:14, fontWeight:600, color:T.text }}>{author?.name}</p>
                      <p style={{ margin:0, fontSize:12, color:T.muted }}>{items.length} statut{items.length>1?"s":""} · {ago(items[0].ts)}</p>
                    </div>
                  </div>
                ))}
              </>
        }
      </div>
    </div>
  );
}

/* ── ADD STATUS MODAL ── */
function AddStatusModal({ session, myStatuses, onClose, onDone }) {
  const [type, setType] = useState("text");
  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fRef = useRef();
  const canAdd = myStatuses.length < 10;

  const handlePick = async e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = ev => setPreview(ev.target.result); r.readAsDataURL(f);
    setUploading(true);
    const path = `statuses/${session.user.id}/${Date.now()}_${f.name}`;
    const { error } = await sb.storage.from("celeste-media").upload(path, f, { upsert:true });
    if (!error) { const { data: { publicUrl } } = sb.storage.from("celeste-media").getPublicUrl(path); setMediaUrl(publicUrl); }
    setUploading(false);
  };

  const submit = async () => {
    if (busy || !canAdd) return;
    if (type==="text" && !text.trim()) return;
    if (type!=="text" && !mediaUrl) return;
    setBusy(true);
    await sb.from("statuses").insert({ user_id:session.user.id, type, text:text.trim()||null, media_url:mediaUrl||null });
    setBusy(false); onDone();
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:400, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(8px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:640, padding:"20px 20px 40px", maxHeight:"92vh", overflowY:"auto", animation:"slideUp .3s ease" }}>
        <input ref={fRef} type="file" accept="image/*,video/*" style={{ display:"none" }} onChange={handlePick} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h3 style={{ margin:0, fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:400, color:T.text }}>Nouveau statut</h3>
          <Btn onClick={onClose} style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:"50%", width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:T.muted }}>✕</Btn>
        </div>
        {!canAdd && <div style={{ background:"rgba(224,80,80,0.10)", border:`1px solid ${T.err}44`, borderRadius:12, padding:"10px 14px", color:T.err, fontSize:13, marginBottom:14, textAlign:"center" }}>⚠ Limite de 10 statuts atteinte.</div>}
        <div style={{ display:"flex", gap:8, marginBottom:16, background:"rgba(255,255,255,0.03)", borderRadius:12, padding:4 }}>
          {[{id:"text",l:"✍ Texte"},{id:"photo",l:"📷 Photo/Vidéo"}].map(t => (
            <Btn key={t.id} onClick={() => setType(t.id)} style={{ flex:1, padding:"8px", borderRadius:9, background:type===t.id?T.goldBg:"none", color:type===t.id?T.gold:T.muted, fontSize:12, fontWeight:type===t.id?700:400, border:type===t.id?`1px solid ${T.gold}44`:"1px solid transparent" }}>{t.l}</Btn>
          ))}
        </div>
        {type==="photo" && (preview
          ? <div style={{ position:"relative", marginBottom:12 }}>
              <MediaPlayer url={preview} style={{ borderRadius:14, maxHeight:280 }} />
              {uploading && <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.6)", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center" }}><div style={{ width:32, height:32, border:`3px solid ${T.border}`, borderTopColor:T.gold, borderRadius:"50%", animation:"spin .8s linear infinite" }} /></div>}
              <Btn onClick={() => { setPreview(null); setMediaUrl(null); }} style={{ position:"absolute", top:8, right:8, background:"rgba(0,0,0,0.7)", borderRadius:"50%", width:30, height:30, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</Btn>
            </div>
          : <Btn onClick={() => fRef.current.click()} style={{ width:"100%", height:140, borderRadius:14, border:`2px dashed ${T.gold}44`, background:T.goldBg, color:T.gold, fontSize:13, fontWeight:600, marginBottom:12, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}><span style={{ fontSize:36 }}>📷</span>Photo ou Vidéo</Btn>
        )}
        {type==="text"
          ? <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Partagez votre statut…" maxLength={280} rows={4} style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, borderRadius:14, padding:"13px 14px", color:T.text, fontSize:14, outline:"none", resize:"none", lineHeight:1.65, marginBottom:8 }} />
          : <input value={text} onChange={e => setText(e.target.value)} placeholder="Légende (optionnel)" style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, borderRadius:12, padding:"11px 14px", color:T.text, fontSize:13, outline:"none", marginBottom:12 }} />
        }
        <div style={{ display:"flex", gap:8, marginTop:8 }}>
          <Btn onClick={onClose} style={{ flex:1, padding:"13px", background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, borderRadius:13, color:T.sub, fontSize:14, fontWeight:600 }}>Annuler</Btn>
          <Btn onClick={submit} disabled={!canAdd||busy||uploading} style={{ flex:2, padding:"13px", background:canAdd&&!busy&&!uploading?T.gradGold:"rgba(255,255,255,0.05)", color:canAdd&&!busy&&!uploading?T.bg:T.muted, borderRadius:13, fontSize:14, fontWeight:700 }}>
            {busy?"Publication…":uploading?"Upload…":`Publier ✦ (${myStatuses.length}/10)`}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ── STATUS VIEWER ── */
function StatusViewer({ statuses, author, isMe, onDelete, onClose }) {
  const [idx, setIdx] = useState(0);
  const current = statuses[idx];
  if (!current) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:600, background:"rgba(0,0,0,0.95)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ position:"absolute", top:16, left:16, right:16, display:"flex", gap:4 }}>
        {statuses.map((_,i) => <div key={i} style={{ flex:1, height:3, borderRadius:2, background: i<=idx ? T.gold : "rgba(255,255,255,0.3)", opacity: i===idx ? 1 : 0.5 }} />)}
      </div>
      <div style={{ position:"absolute", top:36, left:16, right:16, display:"flex", alignItems:"center", gap:10 }}>
        <Av u={author} size={38} />
        <div style={{ flex:1 }}>
          <p style={{ margin:0, fontSize:14, fontWeight:600, color:"#fff" }}>{author?.name}</p>
          <p style={{ margin:0, fontSize:11, color:"rgba(255,255,255,0.6)" }}>{ago(current.ts)}</p>
        </div>
        {isMe && <Btn onClick={() => { onDelete(current.id); if(idx>0) setIdx(idx-1); else onClose(); }} style={{ background:"rgba(224,80,80,0.2)", border:`1px solid ${T.err}44`, borderRadius:8, padding:"5px 10px", color:T.err, fontSize:12 }}>🗑</Btn>}
        <Btn onClick={onClose} style={{ color:"rgba(255,255,255,0.7)", fontSize:22 }}>✕</Btn>
      </div>
      <div style={{ width:"100%", maxWidth:480, padding:"80px 20px 100px", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
        {current.mediaUrl && <MediaPlayer url={current.mediaUrl} style={{ borderRadius:16, maxHeight:400 }} />}
        {current.text && <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:16, padding:"16px 20px", width:"100%", textAlign:"center" }}><p style={{ margin:0, fontSize:18, color:"#fff", lineHeight:1.6, fontFamily:"'Cormorant Garamond',serif" }}>{current.text}</p></div>}
      </div>
      <div style={{ position:"absolute", bottom:40, left:16, right:16, display:"flex", justifyContent:"space-between" }}>
        <Btn onClick={() => setIdx(Math.max(0,idx-1))} disabled={idx===0} style={{ background:"rgba(255,255,255,0.1)", borderRadius:"50%", width:44, height:44, color:"#fff", fontSize:20, display:"flex", alignItems:"center", justifyContent:"center", opacity:idx===0?.3:1 }}>←</Btn>
        <span style={{ color:"rgba(255,255,255,0.5)", fontSize:13, alignSelf:"center" }}>{idx+1} / {statuses.length}</span>
        <Btn onClick={() => { if(idx<statuses.length-1) setIdx(idx+1); else onClose(); }} style={{ background:"rgba(255,255,255,0.1)", borderRadius:"50%", width:44, height:44, color:"#fff", fontSize:20, display:"flex", alignItems:"center", justifyContent:"center" }}>→</Btn>
      </div>
    </div>
  );
}

/* ── DISCOVER TAB ── */
function DiscoverTab({ members, myProfile, session, onUser, notify, myConnections, onConnectionChange }) {
  const [q, setQ] = useState("");

  const toggle = async id => {
    if (myConnections.includes(id)) {
      await sb.from("connections").delete().eq("from_id",session.user.id).eq("to_id",id);
      notify("Connexion retirée");
    } else {
      await sb.from("connections").insert({ from_id:session.user.id, to_id:id });
      notify("Connecté ✦");
    }
    onConnectionChange();
  };

  const active = members.filter(m => m.id!==session?.user?.id && (m.name.toLowerCase().includes(q.toLowerCase())||m.paroisse.toLowerCase().includes(q.toLowerCase())));

  return (
    <div style={{ flex:1, overflowY:"auto" }}>
      <div style={{ position:"sticky", top:0, zIndex:10, background:"rgba(10,7,5,0.95)", backdropFilter:"blur(20px)", borderBottom:`1px solid ${T.border}`, padding:"12px 16px", display:"flex", gap:12, alignItems:"center" }}>
        <h2 style={{ margin:0, fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:400, color:T.text, whiteSpace:"nowrap" }}>Découvrir</h2>
        <div style={{ flex:1, background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, borderRadius:12, padding:"9px 14px", display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:13, color:T.muted }}>🔍</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nom, paroisse…" style={{ flex:1, background:"none", border:"none", color:T.text, fontSize:13, outline:"none" }} />
          {q && <Btn onClick={() => setQ("")} style={{ color:T.muted, fontSize:13 }}>✕</Btn>}
        </div>
      </div>
      <div style={{ maxWidth:640, margin:"0 auto", padding:"12px 16px 80px" }}>
        {active.length===0 && <div style={{ textAlign:"center", padding:"50px 0", color:T.muted }}><div style={{ fontSize:36, marginBottom:10 }}>✦</div><p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18 }}>Aucun résultat</p></div>}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {active.map((u,i) => {
            const conn = myConnections.includes(u.id);
            return (
              <div key={u.id} style={{ background:T.card, borderRadius:18, overflow:"hidden", border:`1px solid ${T.border}`, animation:`fadeUp .4s ease ${i*.05}s both` }}>
                <div style={{ height:70, background:`linear-gradient(135deg, ${u.color}33, ${u.color}11)`, position:"relative" }}>
                  <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", opacity:.1, fontSize:40, fontFamily:"'Cormorant Garamond',serif" }}>✦</div>
                </div>
                <div style={{ padding:"0 12px 14px", marginTop:-28 }}>
                  <Btn onClick={() => onUser(u.id)} style={{ padding:0, display:"block" }}><Av u={u} size={56} /></Btn>
                  <div style={{ marginTop:8 }}>
                    <Btn onClick={() => onUser(u.id)} style={{ padding:0, fontSize:13, fontWeight:600, color:T.text, textAlign:"left", display:"block" }}>{u.name}</Btn>
                    <p style={{ margin:"2px 0 6px", fontSize:11, color:T.muted }}>⛪ {u.paroisse}</p>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <Badge type={u.badge} />
                      <Btn onClick={() => toggle(u.id)} style={{ width:32, height:32, borderRadius:"50%", background:conn?T.goldBg:T.gradGold, color:conn?T.gold:T.bg, fontSize:conn?14:18, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, border:conn?`1px solid ${T.gold}44`:"none", transition:"all .2s" }}>{conn?"✦":"+"}</Btn>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── USER VIEW ── */
function UserView({ user, myProfile, session, posts, onBack, onChat, notify, myConnections, myFollowers, onConnectionChange, onImageView }) {
  const conn = myConnections.includes(user.id);

  const toggle = async () => {
    if (conn) {
      await sb.from("connections").delete().eq("from_id",session.user.id).eq("to_id",user.id);
      notify("Retiré");
    } else {
      await sb.from("connections").insert({ from_id:session.user.id, to_id:user.id });
      notify("Connecté ✦");
    }
    onConnectionChange();
  };

  const [userFollowersCount, setUserFollowersCount] = useState("…");
  const [userFollowingCount, setUserFollowingCount] = useState("…");

  useEffect(() => {
    Promise.all([
      sb.from("connections").select("id", { count:"exact", head:true }).eq("to_id", user.id),
      sb.from("connections").select("id", { count:"exact", head:true }).eq("from_id", user.id),
    ]).then(([{ count: fc }, { count: fg }]) => {
      setUserFollowersCount(fc || 0);
      setUserFollowingCount(fg || 0);
    });
  }, [user.id]);

  const uPosts = posts.filter(p => p.by===user.id);
  const [detailPost, setDetailPost] = useState(null);

  return (
    <div style={{ flex:1, overflowY:"auto" }}>
      {detailPost && (
        <PostDetailModal
          post={detailPost}
          myProfile={myProfile}
          session={session}
          getM={id => id === user.id ? user : myProfile}
          onClose={() => setDetailPost(null)}
          onLike={async pid => {
            const liked = detailPost.likes.includes(session.user.id);
            if (liked) await sb.from("likes").delete().eq("post_id",pid).eq("user_id",session.user.id);
            else await sb.from("likes").insert({ post_id:pid, user_id:session.user.id });
          }}
          onComment={() => {}}
          notify={notify}
        />
      )}
      <div style={{ height:160, background:`linear-gradient(160deg, ${user.color}44, ${user.color}11, transparent)`, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", opacity:.05, fontSize:120, fontFamily:"'Cormorant Garamond',serif" }}>✦</div>
      </div>
      <div style={{ padding:"0 18px 80px", maxWidth:640, margin:"0 auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginTop:-50, marginBottom:16 }}>
          <Av u={user} size={90} />
          <div style={{ display:"flex", gap:8 }}>
            <Btn onClick={() => onChat(user.id)} style={{ background:"rgba(255,255,255,0.06)", border:`1px solid ${T.border}`, borderRadius:12, padding:"9px 16px", color:T.text, fontSize:13, fontWeight:600 }}>✉ Message</Btn>
            <Btn onClick={toggle} style={{ background:conn?T.goldBg:T.gradGold, border:conn?`1px solid ${T.gold}44`:"none", borderRadius:12, padding:"9px 18px", color:conn?T.gold:T.bg, fontSize:13, fontWeight:700, transition:"all .2s" }}>{conn?"✦ Connecté":"+ Connecter"}</Btn>
          </div>
        </div>
        <h2 style={{ margin:"0 0 4px", fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:400, color:T.text }}>{user.fullName||user.name}{user.age&&<span style={{ fontSize:16, color:T.muted, fontWeight:300 }}>, {user.age} ans</span>}</h2>
        <p style={{ margin:"0 0 8px", fontSize:12, color:T.muted }}>⛪ {user.paroisse}</p>
        {user.bio && <p style={{ margin:"0 0 12px", fontSize:14, color:T.sub, lineHeight:1.7 }}>{user.bio}</p>}
        <div style={{ marginBottom:16 }}><Badge type={user.badge} /></div>

        <div style={{ display:"flex", gap:1, background:T.card, borderRadius:16, overflow:"hidden", border:`1px solid ${T.border}`, marginBottom:20 }}>
          {[
            { l:"Publications", v:uPosts.length },
            { l:"Abonnés", v:userFollowersCount },
            { l:"Abonnements", v:userFollowingCount }
          ].map((s,i) => (
            <div key={s.l} style={{ flex:1, textAlign:"center", padding:"14px 8px", borderRight:i<2?`1px solid ${T.border}`:"none" }}>
              <p style={{ margin:"0 0 3px", fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:400, color:T.gold }}>{s.v}</p>
              <p style={{ margin:0, fontSize:10, color:T.muted, letterSpacing:.5 }}>{s.l}</p>
            </div>
          ))}
        </div>

        <h3 style={{ fontSize:13, fontWeight:600, color:T.muted, letterSpacing:1, marginBottom:12 }}>PUBLICATIONS ({uPosts.length})</h3>
        {uPosts.length===0
          ? <p style={{ color:T.muted, fontSize:13, fontStyle:"italic" }}>Aucune publication.</p>
          : uPosts.map(p => (
            <div key={p.id} onClick={() => setDetailPost(p)} style={{ background:T.card, borderRadius:14, overflow:"hidden", marginBottom:10, border:`1px solid ${T.border}`, cursor:"pointer" }}>
              {p.img && <MediaPlayer url={p.img} style={{ maxHeight:200 }} onImageClick={e => { e.stopPropagation(); onImageView(p.img); }} />}
              <div style={{ padding:12 }}>
                <p style={{ margin:"0 0 6px", fontSize:13, color:T.text, lineHeight:1.6 }}>{p.text||p.title}</p>
                <span style={{ fontSize:11, color:T.muted }}>{ago(p.ts)} · ❤ {p.likes.length} · 💬 {p.comments.length}</span>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

/* ── MESSAGES TAB ── */
function MsgsTab({ convs, members, getM, onOpen }) {
  const sorted = [...convs].sort((a,b) => (b.msgs[b.msgs.length-1]?.ts||0)-(a.msgs[a.msgs.length-1]?.ts||0));
  return (
    <div style={{ flex:1, overflowY:"auto" }}>
      <div style={{ position:"sticky", top:0, zIndex:10, background:"rgba(10,7,5,0.95)", backdropFilter:"blur(20px)", borderBottom:`1px solid ${T.border}`, padding:"12px 16px" }}>
        <h2 style={{ margin:0, fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:400, color:T.text }}>Messages</h2>
      </div>
      <div style={{ maxWidth:640, margin:"0 auto", padding:"8px 0 80px" }}>
        {sorted.length===0 && <div style={{ textAlign:"center", padding:"60px 20px", color:T.muted }}><div style={{ fontSize:40, marginBottom:12 }}>✉</div><p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20 }}>Aucune conversation</p></div>}
        {sorted.map(c => {
          const u = getM(c.uid);
          const last = c.msgs[c.msgs.length-1];
          const unreads = c.msgs.filter(m => m.f!=="me"&&!m.read).length;
          const prev = !last?"":last.type==="photo"?"📷 Photo":last.type==="file"?`📎 ${last.fileName}`:last.text||"";
          return (
            <Btn key={c.id} onClick={() => onOpen(c.id)} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderBottom:`1px solid ${T.border}`, width:"100%", textAlign:"left" }}>
              <Av u={u} size={52} online={u?.online} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:14, fontWeight:unreads>0?700:500, color:T.text }}>{u?.name}</span>
                  <span style={{ fontSize:11, color:unreads>0?T.gold:T.muted }}>{last?hm(last.ts):""}</span>
                </div>
                <span style={{ fontSize:12, color:unreads>0?T.sub:T.muted, display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{last?.f==="me"?"Toi : ":""}{prev}</span>
              </div>
              {unreads>0 && <span style={{ minWidth:20, height:20, borderRadius:10, background:T.gradGold, color:T.bg, fontSize:10, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 5px", flexShrink:0 }}>{unreads}</span>}
            </Btn>
          );
        })}
      </div>
    </div>
  );
}

/* ── CHAT SCREEN ── */
function ChatScreen({ conv, myProfile, session, members, reload, notify, onImageView }) {
  const user = members.find(m => m.id===conv.uid) || { name:"…", initials:"?", color:"#888" };
  const [inp, setInp] = useState("");
  const [attach, setAttach] = useState(false);
  const bottomRef = useRef();
  const fRef = useRef();
  const iRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [conv.msgs.length]);

  // Marquer comme lu
  useEffect(() => {
    const unread = conv.msgs.filter(m => m.f !== "me" && !m.read);
    if (unread.length > 0) {
      sb.from("messages").update({ is_read: true }).in("id", unread.map(m => m.id)).then(() => reload());
    }
  }, [conv.id]);

  const ensureConv = async () => {
    const { data } = await sb.from("conversations").select("id")
      .or(`and(user1_id.eq.${session.user.id},user2_id.eq.${conv.uid}),and(user1_id.eq.${conv.uid},user2_id.eq.${session.user.id})`)
      .single();
    if (data) return data.id;
    const { data: created } = await sb.from("conversations").insert({ user1_id:session.user.id, user2_id:conv.uid }).select("id").single();
    return created?.id;
  };

  const sendMsg = async payload => {
    const convId = await ensureConv(); if (!convId) return;
    await sb.from("messages").insert({ conv_id:convId, sender_id:session.user.id, ...payload });
    setInp(""); setAttach(false); reload();
  };

  const sendTxt = () => { if (inp.trim()) sendMsg({ type:"text", text:inp.trim() }); };

  const handleFile = async (e, isImg) => {
    const f = e.target.files[0]; if (!f) return;
    const path = `messages/${session.user.id}/${Date.now()}_${f.name}`;
    const { error } = await sb.storage.from("celeste-media").upload(path, f, { upsert:true });
    if (!error) { const { data: { publicUrl } } = sb.storage.from("celeste-media").getPublicUrl(path); sendMsg(isImg?{type:"photo",file_url:publicUrl,file_name:f.name}:{type:"file",file_url:publicUrl,file_name:f.name}); }
    e.target.value = "";
  };

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <input ref={fRef} type="file" style={{ display:"none" }} onChange={e => handleFile(e,false)} />
      <input ref={iRef} type="file" accept="image/*,video/*" style={{ display:"none" }} onChange={e => handleFile(e,true)} />
      <div style={{ background:"rgba(10,7,5,0.95)", backdropFilter:"blur(20px)", borderBottom:`1px solid ${T.border}`, padding:"10px 16px", display:"flex", alignItems:"center", gap:11, flexShrink:0 }}>
        <Av u={user} size={40} online={user.online} />
        <div style={{ flex:1 }}>
          <p style={{ margin:0, fontSize:14, fontWeight:600, color:T.text }}>{user.name}</p>
          <p style={{ margin:0, fontSize:11, color:T.muted }}>⛪ {user.paroisse}</p>
        </div>
        <div style={{ width:8, height:8, borderRadius:"50%", background:user.online?T.ok:T.muted }} />
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
        {conv.msgs.length===0 && (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12, color:T.muted }}>
            <Av u={user} size={60} />
            <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, textAlign:"center" }}>Démarrez la conversation<br/>avec {user.name}</p>
          </div>
        )}
        {conv.msgs.map(m => {
          const mine = m.f==="me"||m.f===session.user.id;
          return (
            <div key={m.id} style={{ display:"flex", justifyContent:mine?"flex-end":"flex-start", alignItems:"flex-end", gap:7 }}>
              {!mine && <Av u={user} size={28} />}
              <div style={{ maxWidth:"72%" }}>
                <div style={{ background:mine?T.gradGold:"rgba(255,255,255,0.06)", borderRadius:mine?"18px 18px 4px 18px":"18px 18px 18px 4px", padding:"10px 14px", border:mine?"none":`1px solid ${T.border}` }}>
                  {(m.type==="photo"||m.type==="image")&&m.img && (
                    <MediaPlayer url={m.img} style={{ maxWidth:240, maxHeight:220, borderRadius:10, marginBottom:m.text?6:0 }} onImageClick={onImageView} />
                  )}
                  {m.type==="file" && (
                    <Btn onClick={() => onImageView ? window.open(m.img,"_blank") : null}
                      style={{ display:"flex", alignItems:"center", gap:9, background:"none", padding:0 }}>
                      <span style={{ fontSize:22 }}>📄</span>
                      <span style={{ fontSize:12, fontWeight:600, color:mine?T.bg:T.text }}>{m.fileName}</span>
                    </Btn>
                  )}
                  {m.text && <p style={{ margin:0, fontSize:14, color:mine?T.bg:T.text, lineHeight:1.55, whiteSpace:"pre-wrap" }}>{m.text}</p>}
                </div>
                <div style={{ display:"flex", gap:4, alignItems:"center", marginTop:3, justifyContent:mine?"flex-end":"flex-start" }}>
                  <span style={{ fontSize:10, color:T.muted }}>{hm(m.ts)}</span>
                  {mine && <span style={{ fontSize:11, color:m.read?T.gold:T.muted }}>✓✓</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {attach && (
        <div style={{ background:"rgba(17,13,10,0.98)", borderTop:`1px solid ${T.border}`, padding:"14px 16px", flexShrink:0 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
            {[
              {ic:"📷",l:"Photo/Vidéo",fn:()=>iRef.current.click()},
              {ic:"📎",l:"Fichier",fn:()=>fRef.current.click()},
              {ic:"📖",l:"Verset",fn:()=>sendMsg({type:"text",text:'📖 « Je puis tout par celui qui me fortifie. » — Phil. 4:13'})},
              {ic:"📅",l:"Événement",fn:()=>sendMsg({type:"text",text:"📅 Invitation : réunion du ward ce samedi"})},
            ].map(a => (
              <Btn key={a.l} onClick={() => { a.fn(); setAttach(false); }} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:7, background:T.goldBg, border:`1px solid ${T.gold}22`, borderRadius:14, padding:"12px 8px" }}>
                <span style={{ fontSize:24 }}>{a.ic}</span>
                <span style={{ fontSize:10, color:T.sub, fontWeight:600 }}>{a.l}</span>
              </Btn>
            ))}
          </div>
        </div>
      )}
      <div style={{ background:"rgba(10,7,5,0.98)", borderTop:`1px solid ${T.border}`, padding:"8px 12px", display:"flex", alignItems:"center", gap:8, flexShrink:0, paddingBottom:"calc(8px + env(safe-area-inset-bottom, 0px))" }}>
        <Btn onClick={() => setAttach(!attach)} style={{ background:attach?T.gradGold:"rgba(255,255,255,0.06)", border:`1px solid ${attach?"transparent":T.border}`, borderRadius:"50%", width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, color:attach?T.bg:T.gold, flexShrink:0, transition:"all .2s" }}>+</Btn>
        <div style={{ flex:1, background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, borderRadius:22, display:"flex", alignItems:"center", padding:"6px 6px 6px 14px" }}>
          <input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),sendTxt())} placeholder="Message…" style={{ flex:1, background:"none", border:"none", color:T.text, fontSize:14, outline:"none" }} />
        </div>
        <Btn onClick={sendTxt} style={{ background:inp.trim()?T.gradGold:"rgba(255,255,255,0.06)", border:inp.trim()?"none":`1px solid ${T.border}`, borderRadius:"50%", width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, color:inp.trim()?T.bg:T.muted, flexShrink:0, transition:"all .2s" }}>↑</Btn>
      </div>
    </div>
  );
}

/* ── PROFILE TAB ── */
function ProfileTab({ myProfile, session, posts, onNewPost, notify, onLogout, reload, myConnections, myFollowers, onImageView }) {
  const [edit, setEdit] = useState(false);
  const [bio, setBio] = useState(myProfile?.bio||"");
  const [ptab, setPtab] = useState("posts");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [detailPost, setDetailPost] = useState(null);
  const avRef = useRef();

  const myPosts = posts.filter(p => p.by===session?.user?.id);
  const savedPosts = posts.filter(p => p.saved?.includes("me"));

  const handleAvatar = async e => {
    const f = e.target.files[0]; if (!f) return;
    setUploading(true);
    const path = `avatars/${session.user.id}/avatar_${Date.now()}`;
    const { error } = await sb.storage.from("celeste-media").upload(path, f, { upsert:true });
    if (!error) {
      const { data: { publicUrl } } = sb.storage.from("celeste-media").getPublicUrl(path);
      await sb.from("profiles").update({ avatar_url:publicUrl }).eq("id", session.user.id);
      reload(); notify("Photo mise à jour ✦");
    } else notify("Erreur upload : "+error.message);
    setUploading(false); e.target.value="";
  };

  const saveBio = async () => {
    setBusy(true);
    await sb.from("profiles").update({ bio }).eq("id", session.user.id);
    setBusy(false); setEdit(false); reload(); notify("Profil mis à jour ✦");
  };

  return (
    <div style={{ flex:1, overflowY:"auto" }}>
      {detailPost && (
        <PostDetailModal
          post={detailPost}
          myProfile={myProfile}
          session={session}
          getM={id => myProfile}
          onClose={() => setDetailPost(null)}
          onLike={async pid => {
            const liked = detailPost.likes.includes(session.user.id);
            if (liked) await sb.from("likes").delete().eq("post_id",pid).eq("user_id",session.user.id);
            else await sb.from("likes").insert({ post_id:pid, user_id:session.user.id });
          }}
          onComment={reload}
          notify={notify}
        />
      )}
      <input ref={avRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleAvatar} />
      <div style={{ height:140, background:"linear-gradient(160deg,rgba(212,160,80,0.15),rgba(212,160,80,0.03))", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", opacity:.04, fontSize:160, fontFamily:"'Cormorant Garamond',serif" }}>✦</div>
      </div>
      <div style={{ padding:"0 18px 80px", maxWidth:640, margin:"0 auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginTop:-52, marginBottom:16 }}>
          <div onClick={() => avRef.current.click()} style={{ cursor:"pointer", position:"relative" }}>
            <Av u={myProfile} size={96} />
            <div style={{ position:"absolute", bottom:2, right:0, width:28, height:28, borderRadius:"50%", background:T.gradGold, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, border:`2px solid ${T.bg}` }}>
              {uploading ? <div style={{ width:12, height:12, border:"2px solid rgba(0,0,0,.4)", borderTopColor:T.bg, borderRadius:"50%", animation:"spin .6s linear infinite" }} /> : "📷"}
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn onClick={edit?saveBio:()=>{setEdit(true);setBio(myProfile?.bio||"");}} style={{ background:edit?T.gradGold:"rgba(255,255,255,0.06)", border:edit?"none":`1px solid ${T.border}`, borderRadius:12, padding:"9px 18px", color:edit?T.bg:T.text, fontSize:13, fontWeight:600 }}>
              {busy?"…":edit?"Enregistrer ✦":"✏ Modifier"}
            </Btn>
            {edit && <Btn onClick={() => setEdit(false)} style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, borderRadius:12, padding:"9px 14px", color:T.muted, fontSize:13 }}>✕</Btn>}
          </div>
        </div>
        <h2 style={{ margin:"0 0 4px", fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:400, color:T.text }}>{myProfile?.fullName}{myProfile?.age&&<span style={{ fontSize:16, color:T.muted, fontWeight:300 }}> · {myProfile.age} ans</span>}</h2>
        <p style={{ margin:"0 0 8px", fontSize:12, color:T.muted }}>⛪ {myProfile?.paroisse}</p>
        {edit
          ? <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Parlez de vous…" style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:`1px solid ${T.gold}44`, borderRadius:12, padding:"10px 13px", color:T.text, fontSize:14, outline:"none", resize:"none", marginBottom:10, lineHeight:1.65 }} />
          : <p style={{ margin:"0 0 12px", fontSize:14, color:myProfile?.bio?T.sub:T.muted, lineHeight:1.7, fontStyle:myProfile?.bio?"normal":"italic" }}>{myProfile?.bio||"Ajoutez une biographie…"}</p>
        }
        <div style={{ marginBottom:20, display:"flex", gap:8, flexWrap:"wrap" }}>{myProfile?.badge && <Badge type={myProfile.badge} />}</div>

        {/* VRAIES STATS */}
        <div style={{ display:"flex", gap:1, background:T.card, borderRadius:16, overflow:"hidden", border:`1px solid ${T.border}`, marginBottom:20 }}>
          {[
            { l:"Publications", v:myPosts.length },
            { l:"Abonnés", v:myFollowers.length },
            { l:"Abonnements", v:myConnections.length }
          ].map((s,i) => (
            <div key={s.l} style={{ flex:1, textAlign:"center", padding:"14px 8px", borderRight:i<2?`1px solid ${T.border}`:"none" }}>
              <p style={{ margin:"0 0 3px", fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:400, color:T.gold }}>{s.v}</p>
              <p style={{ margin:0, fontSize:10, color:T.muted, letterSpacing:.5 }}>{s.l}</p>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", borderBottom:`1px solid ${T.border}`, marginBottom:14 }}>
          {[{id:"posts",l:"📷 Posts"},{id:"saved",l:"🔖 Sauvegardés"},{id:"about",l:"ℹ À propos"}].map(t => (
            <Btn key={t.id} onClick={() => setPtab(t.id)} style={{ flex:1, padding:"10px 4px", color:ptab===t.id?T.gold:T.muted, fontWeight:ptab===t.id?700:400, fontSize:12, borderBottom:ptab===t.id?`2px solid ${T.gold}`:"2px solid transparent", transition:"all .2s" }}>{t.l}</Btn>
          ))}
        </div>
        {ptab==="posts" && (
          <>
            <Btn onClick={onNewPost} style={{ width:"100%", background:T.goldBg, border:`1.5px dashed ${T.gold}44`, borderRadius:14, padding:"13px", color:T.gold, fontSize:13, fontWeight:600, marginBottom:12, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>✦ Nouvelle publication</Btn>
            {myPosts.length===0
              ? <p style={{ color:T.muted, textAlign:"center", padding:"30px 0", fontStyle:"italic", fontFamily:"'Cormorant Garamond',serif", fontSize:18 }}>Aucune publication encore</p>
              : <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {myPosts.map(p => (
                    <div key={p.id} onClick={() => setDetailPost(p)} style={{ background:T.card, borderRadius:12, overflow:"hidden", border:`1px solid ${T.border}`, cursor:"pointer" }}>
                      {p.img
                        ? <MediaPlayer url={p.img} style={{ height:120, objectFit:"cover" }} onImageClick={e => { e.stopPropagation(); onImageView(p.img); }} />
                        : <div style={{ height:80, background:`linear-gradient(135deg,${T.goldBg},transparent)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, fontFamily:"'Cormorant Garamond',serif", color:T.gold }}>✦</div>
                      }
                      <div style={{ padding:"8px 10px" }}>
                        <p style={{ margin:"0 0 4px", fontSize:12, color:T.text, lineHeight:1.4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.text||p.title||"Publication"}</p>
                        <span style={{ fontSize:10, color:T.muted }}>❤ {p.likes.length} · 💬 {p.comments.length} · {ago(p.ts)}</span>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </>
        )}
        {ptab==="saved" && (
          savedPosts.length===0
            ? <p style={{ color:T.muted, textAlign:"center", padding:"30px 0", fontStyle:"italic" }}>Aucune publication sauvegardée</p>
            : savedPosts.map(p => (
              <div key={p.id} style={{ background:T.card, borderRadius:12, padding:12, marginBottom:8, border:`1px solid ${T.border}` }}>
                <p style={{ margin:"0 0 4px", fontSize:13, color:T.text }}>{p.text||p.title}</p>
                <span style={{ fontSize:11, color:T.muted }}>{ago(p.ts)}</span>
              </div>
            ))
        )}
        {ptab==="about" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[
              {ic:"⛪",l:"Paroisse / Ward",v:myProfile?.paroisse},
              {ic:"📅",l:"Membre depuis",v:myProfile?.joined},
              {ic:"🛡",l:"Badge",v:myProfile?.badge==="confirmed"?"✅ Confirmé":myProfile?.badge==="friend"?"🔵 Ami de l'Église":"—"},
              {ic:"📧",l:"Email",v:session?.user?.email},
            ].map(it => (
              <div key={it.l} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px", background:T.card, borderRadius:14, border:`1px solid ${T.border}` }}>
                <span style={{ fontSize:22, flexShrink:0 }}>{it.ic}</span>
                <div>
                  <p style={{ margin:"0 0 2px", fontSize:10, color:T.muted, letterSpacing:.5 }}>{it.l.toUpperCase()}</p>
                  <p style={{ margin:0, fontSize:13, fontWeight:500, color:T.text }}>{it.v||"—"}</p>
                </div>
              </div>
            ))}
            <Btn onClick={onLogout} style={{ padding:"13px", background:"rgba(224,80,80,0.08)", border:`1px solid ${T.err}44`, borderRadius:13, color:T.err, fontSize:14, fontWeight:600, marginTop:8 }}>Se déconnecter</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── ADMIN PANEL ── */
function AdminPanel({ members, setMembers, onClose, notify, reload }) {
  const [filter, setFilter] = useState("all");
  const [allM, setAllM] = useState([]);

  useEffect(() => {
    sb.from("profiles").select("*").then(({ data }) => { if (data) setAllM(data.map(normProfile)); });
  }, []);

  const approve = async (id, badge) => {
    await sb.from("profiles").update({ status:"active", badge }).eq("id", id);
    setAllM(p => p.map(m => m.id===id?{...m,status:"active",badge}:m));
    reload(); notify("Approuvé ✦");
  };
  const reject = async id => {
    await sb.from("profiles").delete().eq("id", id);
    setAllM(p => p.filter(m => m.id!==id)); reload(); notify("Supprimé");
  };
  const chBadge = async (id, badge) => {
    await sb.from("profiles").update({ badge }).eq("id", id);
    setAllM(p => p.map(m => m.id===id?{...m,badge}:m)); notify("Badge mis à jour ✦");
  };
  const suspend = async (id, currentStatus) => {
    const ns = currentStatus==="suspended"?"active":"suspended";
    await sb.from("profiles").update({ status:ns }).eq("id", id);
    setAllM(p => p.map(m => m.id===id?{...m,status:ns}:m)); notify("Statut modifié");
  };

  const cnt = { all:allM.length, pending:allM.filter(m=>m.status==="pending").length, confirmed:allM.filter(m=>m.badge==="confirmed"&&m.status==="active").length, friend:allM.filter(m=>m.badge==="friend"&&m.status==="active").length };
  const list = filter==="pending"?allM.filter(m=>m.status==="pending"):filter==="confirmed"?allM.filter(m=>m.badge==="confirmed"&&m.status==="active"):filter==="friend"?allM.filter(m=>m.badge==="friend"&&m.status==="active"):allM;

  return (
    <div style={{ position:"fixed", inset:0, zIndex:500, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(8px)", display:"flex", alignItems:"stretch", justifyContent:"flex-end" }} onClick={e => e.target===e.currentTarget&&onClose()}>
      <div style={{ width:"100%", maxWidth:480, background:T.bg, border:`1px solid ${T.border}`, display:"flex", flexDirection:"column", animation:"slideIn .3s ease" }}>
        <div style={{ background:"linear-gradient(160deg,rgba(212,160,80,0.1),transparent)", borderBottom:`1px solid ${T.border}`, padding:"20px 20px 16px", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <p style={{ margin:"0 0 4px", fontSize:10, color:T.muted, letterSpacing:2 }}>PANNEAU ADMIN</p>
              <h2 style={{ margin:0, fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:400, color:T.text }}>🛡 Gestion</h2>
            </div>
            <Btn onClick={onClose} style={{ background:"rgba(255,255,255,0.06)", border:`1px solid ${T.border}`, borderRadius:"50%", width:36, height:36, color:T.muted, fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</Btn>
          </div>
        </div>
        <div style={{ padding:"10px 14px", background:T.card, borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
          <div style={{ display:"flex", gap:6, overflowX:"auto", scrollbarWidth:"none" }}>
            {[{id:"all",l:"Tous",v:cnt.all},{id:"pending",l:"⏳ Attente",v:cnt.pending},{id:"confirmed",l:"✅ Confirmés",v:cnt.confirmed},{id:"friend",l:"🔵 Amis",v:cnt.friend}].map(f => (
              <Btn key={f.id} onClick={() => setFilter(f.id)} style={{ flexShrink:0, padding:"6px 12px", borderRadius:10, border:`1px solid ${filter===f.id?T.gold+"66":T.border}`, background:filter===f.id?T.goldBg:"none", color:filter===f.id?T.gold:T.muted, fontSize:12, fontWeight:filter===f.id?700:400, display:"flex", alignItems:"center", gap:5 }}>
                {f.l} <span style={{ background:filter===f.id?T.gold+"33":T.glass, borderRadius:8, fontSize:9, padding:"1px 5px", fontWeight:700, color:filter===f.id?T.gold:T.muted }}>{f.v}</span>
              </Btn>
            ))}
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto" }}>
          {list.length===0 && <p style={{ textAlign:"center", padding:30, color:T.muted, fontStyle:"italic" }}>Aucun membre ici</p>}
          {list.map(m => (
            <div key={m.id} style={{ padding:"14px 16px", borderBottom:`1px solid ${T.border}`, background:m.status==="pending"?"rgba(212,160,80,0.04)":m.status==="suspended"?"rgba(224,80,80,0.04)":"none" }}>
              <div style={{ display:"flex", alignItems:"center", gap:11, marginBottom:10 }}>
                <Av u={m} size={44} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:3, flexWrap:"wrap" }}>
                    <span style={{ fontSize:13, fontWeight:600, color:T.text }}>{m.fullName||m.name}</span>
                    {m.status==="pending" && <span style={{ fontSize:9, background:"rgba(212,160,80,0.15)", color:T.gold, padding:"2px 8px", borderRadius:20, fontWeight:700 }}>EN ATTENTE</span>}
                    {m.status==="suspended" && <span style={{ fontSize:9, background:"rgba(224,80,80,0.15)", color:T.err, padding:"2px 8px", borderRadius:20, fontWeight:700 }}>SUSPENDU</span>}
                  </div>
                  <p style={{ margin:0, fontSize:11, color:T.muted }}>⛪ {m.paroisse} · {m.joined}</p>
                </div>
                {m.badge && <Badge type={m.badge} />}
              </div>
              {m.status==="pending"
                ? <div style={{ display:"flex", gap:6 }}>
                    <Btn onClick={() => approve(m.id,"confirmed")} style={{ flex:1, padding:"8px", background:"rgba(80,192,128,0.1)", border:"1px solid rgba(80,192,128,0.3)", borderRadius:10, color:T.ok, fontSize:11, fontWeight:700 }}>✅ Confirmé</Btn>
                    <Btn onClick={() => approve(m.id,"friend")} style={{ flex:1, padding:"8px", background:T.navyBg, border:`1px solid ${T.navy}44`, borderRadius:10, color:T.navy, fontSize:11, fontWeight:700 }}>🔵 Ami</Btn>
                    <Btn onClick={() => reject(m.id)} style={{ padding:"8px 12px", background:"rgba(224,80,80,0.1)", border:`1px solid ${T.err}44`, borderRadius:10, color:T.err, fontSize:11, fontWeight:700 }}>🗑</Btn>
                  </div>
                : <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    <Btn onClick={() => chBadge(m.id,"confirmed")} style={{ padding:"5px 11px", background:m.badge==="confirmed"?T.goldBg:"rgba(255,255,255,0.04)", border:`1px solid ${m.badge==="confirmed"?T.gold+"66":T.border}`, borderRadius:9, color:m.badge==="confirmed"?T.gold:T.muted, fontSize:11, fontWeight:600 }}>✅ Confirmé</Btn>
                    <Btn onClick={() => chBadge(m.id,"friend")} style={{ padding:"5px 11px", background:m.badge==="friend"?T.navyBg:"rgba(255,255,255,0.04)", border:`1px solid ${m.badge==="friend"?T.navy+"66":T.border}`, borderRadius:9, color:m.badge==="friend"?T.navy:T.muted, fontSize:11, fontWeight:600 }}>🔵 Ami</Btn>
                    <Btn onClick={() => suspend(m.id,m.status)} style={{ padding:"5px 11px", background:m.status==="suspended"?"rgba(80,192,128,0.1)":"rgba(224,80,80,0.1)", border:`1px solid ${m.status==="suspended"?T.ok+"44":T.err+"44"}`, borderRadius:9, color:m.status==="suspended"?T.ok:T.err, fontSize:11, fontWeight:600, marginLeft:"auto" }}>
                      {m.status==="suspended"?"✓ Réactiver":"🚫 Suspendre"}
                    </Btn>
                  </div>
              }
            </div>
          ))}
        </div>
        <div style={{ padding:"12px 16px", borderTop:`1px solid ${T.border}`, flexShrink:0 }}>
          <Btn onClick={onClose} style={{ width:"100%", padding:"11px", background:"rgba(224,80,80,0.08)", border:`1px solid ${T.err}44`, borderRadius:12, color:T.err, fontSize:13, fontWeight:600 }}>Fermer ✕</Btn>
        </div>
      </div>
    </div>
  );
}