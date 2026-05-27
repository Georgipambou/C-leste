/**
 * Céleste — Version Premium 4.0 (FUSION)
 * Design: Noir absolu · Gold vibrant · Glassmorphism · Animations cinématiques
 * Base: Céleste v3 (src_src_App_4.jsx) + nouvelles fonctionnalités App 9
 *
 * Nouveautés fusionnées depuis App (9).jsx :
 *  - Logique complète : comment_likes, comment_replies, saved_posts, blocks, badges
 *  - SavedPosts tab dans le profil
 *  - Notifications Supabase (table notifications)
 *  - Compteurs en temps réel (unread notifs, unread msgs)
 *  - CommentItem avec likes & réponses (threads)
 *  - StoriesBar enrichie
 *
 * Fonctionnalités PRÉSERVÉES de Céleste :
 *  - ErrorBoundary, InstallBanner, FlagSelector
 *  - Audio synthétique (playNotifSound)
 *  - Glassmorphism & animations CSS-in-JS (objet T)
 *  - MediaPlayer vidéo, vocal, fichiers
 *  - ChatScreen avec enregistrement audio
 *  - AdminPanel, OrgView, UserView, StatusViewer
 *  - Push notifications (subscribePush)
 */

import {
  useState, useRef, useEffect, useCallback, useMemo, memo, createContext, useContext
} from "react";
import {
  Trash2, Mail, Mic, Camera, Image,
  Edit2, Bell, Heart, MessageCircle,
  Send, X, Plus, Search, Settings,
  User, Users, ChevronLeft, ChevronRight, MoreVertical,
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, Zap, Star,
  Bookmark, Share2, MoreHorizontal, Pin,
  Reply, ArrowLeft, Check, CheckCheck,
  Eye, Paperclip, LogOut, Sparkles
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { subscribePush } from "./usePush";
import React from "react";

// ── SUPABASE ──────────────────────────────────────────────
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON;
if(!SUPABASE_URL||!SUPABASE_ANON)console.error("Variables Supabase manquantes !");
const sb = createClient(SUPABASE_URL||"",SUPABASE_ANON||"");

const PAGE_SIZE = 20;

// ── CONTEXTE GLOBAL ───────────────────────────────────────
const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

// ── PALETTE PREMIUM ───────────────────────────────────────
const getThemePalette=(mode)=>{
  const isDark=mode==="dark";
  return{
    bg:       isDark?"#000000":"#FBF9F4",
    bg2:      isDark?"#080808":"#F4F0E6",
    bg3:      isDark?"#0F0F0F":"#EFECE0",
    card:     isDark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)",
    cardSolid:isDark?"#0A0A0A":"#F0ECE0",
    glass:    isDark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)",
    glassMid: isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.05)",
    border:   isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.08)",
    borderHi: isDark?"rgba(255,255,255,0.12)":"rgba(0,0,0,0.14)",
    text:     isDark?"#F0EDE8":"#1C1A17",
    sub:      isDark?"#888880":"#6E6A5F",
    muted:    isDark?"#3A3A38":"#B0AB9F",
    gold:     "#C9952A",
    goldL:    "#E8B84B",
    goldD:    "#8A6218",
    goldBg:   "rgba(201,149,42,0.08)",
    goldBg2:  "rgba(201,149,42,0.15)",
    navy:     "#3A6A9A",
    navyBg:   "rgba(58,106,154,0.12)",
    err:      "#C84040",
    ok:       "#40A860",
    gradGold: "linear-gradient(135deg,#C9952A 0%,#E8B84B 45%,#A07020 100%)",
    gradGoldV:"linear-gradient(180deg,#C9952A 0%,#E8B84B 100%)",
    gradDark: isDark?"linear-gradient(160deg,#0A0805 0%,#000000 100%)":"linear-gradient(160deg,#F4F0E6 0%,#FBF9F4 100%)",
    glow:     "0 0 40px rgba(201,149,42,0.15), 0 0 80px rgba(201,149,42,0.05)",
    glowGold: "0 0 20px rgba(201,149,42,0.4)",
    shadowCard:isDark?"0 8px 40px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.04)":"0 8px 40px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.8)",
  };
};

let _themeMode="dark";
try{_themeMode=localStorage.getItem("celeste_theme")||"dark";}catch(_){}
let T=getThemePalette(_themeMode);
const setAppTheme=(mode)=>{_themeMode=mode;T=getThemePalette(mode);localStorage.setItem("celeste_theme",mode);};

// ── UTILITAIRES ───────────────────────────────────────────
const ago   = ts => {
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60000)    return "maintenant";
  if (d < 3600000)  return `${Math.floor(d/60000)}min`;
  if (d < 86400000) return `${Math.floor(d/3600000)}h`;
  return `${Math.floor(d/86400000)}j`;
};
const hm = ts => new Date(ts).toLocaleTimeString("fr",{hour:"2-digit",minute:"2-digit"});
const initials = (p="",n="") => ((p[0]||"")+(n[0]||"")).toUpperCase()||"?";
const PALETTE = ["#C9952A","#C47890","#4A8AC4","#40A870","#8060C4","#C46040","#50A0A0","#A06090"];
const colorFor = id => PALETTE[(id?.charCodeAt(0)||0)%PALETTE.length];
const renderTextWithMentions = (text, onMentionClick) => {
  if (!text) return "";
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <span
          key={i}
          onClick={(e) => { e.stopPropagation(); onMentionClick(part.substring(1)); }}
          style={{ color: T.goldL, fontWeight: "600", cursor: "pointer" }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
};
const normProfile = p => ({
  id:p.id, name:`${p.prenom||""} ${(p.nom||"")[0]||""}.`.trim(),
  fullName:`${p.prenom||""} ${p.nom||""}`.trim(),
  initials:initials(p.prenom,p.nom), color:colorFor(p.id),
  badge:p.badge||null, status:p.status||"pending",
  paroisse:p.paroisse||"—", age:p.age||null, online:false,
  joined:p.joined_at?.slice(0,10)||"", bio:p.bio||"",
  avatar_url:p.avatar_url||null, cover_url:p.cover_url||null,
  is_admin:p.is_admin||false,
  whatsapp:p.whatsapp||p.raw_user_meta_data?.whatsapp||null,
  account_type:p.account_type||"membre",
  org_name:p.org_name||null, org_type:p.org_type||null,
  org_country:p.org_country||null, org_desc:p.org_desc||null,
});

const compressImage = file => new Promise(resolve=>{
  const img = new window.Image(), url = URL.createObjectURL(file);
  img.onload = ()=>{
    const canvas=document.createElement("canvas"); const MAX=1200;
    let w=img.width,h=img.height;
    if(w>MAX){h=h*MAX/w;w=MAX;} if(h>MAX){w=w*MAX/h;h=MAX;}
    canvas.width=w;canvas.height=h;
    canvas.getContext("2d").drawImage(img,0,0,w,h);
    canvas.toBlob(blob=>resolve(new File([blob],file.name,{type:"image/jpeg"})),"image/jpeg",0.78);
    URL.revokeObjectURL(url);
  }; img.src=url;
});

const playNotifSound = ()=>{
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(1047,ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(784,ctx.currentTime+0.15);
    gain.gain.setValueAtTime(0.18,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.4);
    osc.start(ctx.currentTime);osc.stop(ctx.currentTime+0.4);
  }catch(_){}
};
const sendPushNotif=async(title,body)=>{
  if(Notification.permission==="granted"){
    if('serviceWorker' in navigator){
      try{
        const reg=await navigator.serviceWorker.ready;
        if(reg&&reg.showNotification){
          reg.showNotification(title,{body,icon:"/icon-192.png",badge:"/icon-192.png"});
          return;
        }
      }catch(_){}
    }
    new Notification(title,{body});
  }
};

// ── CSS GLOBAL PREMIUM ────────────────────────────────────
const GS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=DM+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
  
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation; /* Protège le comportement tactile natif */
  }

 html, body, #root {
    height: 100%;
    background: #000;
    overscroll-behavior: contain;
  }

  input, textarea {
    font-size: 16px !important;
  }

  .keyboard-open-hide {
    display: none !important;
  }

  body {
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }

  ::-webkit-scrollbar {
    width: 0px;
    display: none;
  }

  /* Version corrigée pour le scroll fluide */
  .scroll-container {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    /* On supprime will-change et scroll-behavior: smooth ici */
  }
  input,textarea,select,button{font-family:'DM Sans',sans-serif;}
  input::placeholder,textarea::placeholder{color:${T.muted};}
  select option{background:#111;color:${T.text};}

  /* ── ANIMATIONS PREMIUM ── */
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:none;}}
  @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
  @keyframes slideUp{from{transform:translateY(100%);opacity:0;}to{transform:none;opacity:1;}}
  @keyframes slideIn{from{transform:translateX(100%);opacity:0;}to{transform:none;opacity:1;}}
  @keyframes slideDown{from{transform:translateY(-100%);opacity:0;}to{transform:none;opacity:1;}}
  @keyframes scaleIn{from{transform:scale(0.85);opacity:0;}to{transform:scale(1);opacity:1;}}
  @keyframes pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.12);}}
  @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(201,149,42,0.2);}50%{box-shadow:0 0 50px rgba(201,149,42,0.5);}}
  @keyframes glowPulse{0%,100%{opacity:0.4;}50%{opacity:1;}}
  @keyframes shimmer{0%{background-position:-200% center;}100%{background-position:200% center;}}
  @keyframes starPulse{0%,100%{opacity:.3;transform:scale(0.8);}50%{opacity:1;transform:scale(1.2);filter:drop-shadow(0 0 30px #C9952A);}}
  @keyframes titleReveal{0%{opacity:0;transform:translateY(24px);}100%{opacity:1;transform:none;}}
  @keyframes notifIn{from{opacity:0;transform:translateY(-24px) scale(0.94);}to{opacity:1;transform:none;}}
  @keyframes ripple{0%{transform:scale(0);opacity:0.4;}100%{transform:scale(2.5);opacity:0;}}
  @keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}
 @keyframes badgePulse {
  0%,100% { box-shadow: 0 0 0 2px rgba(29,161,242,0.3), 0 0 10px rgba(29,161,242,0.8), 0 0 20px rgba(29,161,242,0.4); }
  50% { box-shadow: 0 0 0 3px rgba(29,161,242,0.5), 0 0 16px rgba(29,161,242,1), 0 0 32px rgba(29,161,242,0.6); }
}
  @keyframes gradMove{0%{background-position:0% 50%;}50%{background-position:100% 50%;}100%{background-position:0% 50%;}}
  @keyframes borderGlow{0%,100%{border-color:rgba(201,149,42,0.2);}50%{border-color:rgba(201,149,42,0.6);}}
  @keyframes sendBounce{0%,100%{transform:translateY(0);}50%{transform:translateY(-4px);}}
  @keyframes waveform{0%,100%{height:4px;}50%{height:20px;}}
  @keyframes msgIn{from{opacity:0;transform:translateY(8px) scale(0.96);}to{opacity:1;transform:none;}}
  @keyframes statusRing{0%{stroke-dashoffset:251;}100%{stroke-dashoffset:0;}}

  /* ── UTILS ── */
 .premium-card{
    background:${T.card};
    border:1px solid ${T.border};
    backdrop-filter:blur(8px);
    -webkit-backdrop-filter:blur(8px);
    transition:all 0.3s cubic-bezier(0.4,0,0.2,1);
  }
  .premium-card:active{transform:scale(0.98);}
  .gold-shimmer{
    background:linear-gradient(90deg,${T.gold} 0%,${T.goldL} 50%,${T.gold} 100%);
    background-size:200% auto;
    animation:shimmer 3s linear infinite;
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
  }
  .tap-highlight{transition:opacity 0.15s;} .tap-highlight:active{opacity:0.7;}
`;

// ── ERROR BOUNDARY ────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={hasError:false};}
  static getDerivedStateFromError(){return{hasError:true};}
  componentDidCatch(e,i){console.error("[Céleste]",e,i);}
  render(){
    if(this.state.hasError) return(
      <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20,padding:24}}>
        <span style={{fontSize:56,animation:"starPulse 2s infinite"}}>✦</span>
        <p style={{color:T.muted,fontFamily:"'Cormorant Garamond',serif",fontSize:22}}>Une erreur est survenue.</p>
        <button onClick={()=>window.location.reload()} style={{background:T.gradGold,border:"none",borderRadius:14,padding:"13px 28px",color:"#000",fontWeight:700,cursor:"pointer",fontSize:14}}>Recharger</button>
      </div>
    );
    return this.props.children;
  }
}

// ── INSTALL BANNER PWA ────────────────────────────────────
function InstallBanner(){
  const [prompt,setPrompt]=useState(null);
  const [dismissed,setDismissed]=useState(()=>!!localStorage.getItem("pwa_dismissed"));
  useEffect(()=>{
    const h=e=>{e.preventDefault();setPrompt(e);};
    window.addEventListener("beforeinstallprompt",h);
    return()=>window.removeEventListener("beforeinstallprompt",h);
  },[]);
  if(!prompt||dismissed)return null;
  return(
    <div style={{background:T.goldBg,border:`1px solid ${T.gold}44`,borderRadius:16,margin:"12px 16px",padding:"12px 16px",display:"flex",alignItems:"center",gap:12,animation:"fadeUp .4s ease"}}>
      <span style={{fontSize:24}}>📲</span>
      <div style={{flex:1}}>
        <p style={{margin:0,fontSize:13,fontWeight:600,color:T.goldL}}>Installer Céleste</p>
        <p style={{margin:0,fontSize:11,color:T.sub}}>Accès rapide depuis votre écran d'accueil</p>
      </div>
      <Btn onClick={async()=>{prompt.prompt();const{outcome}=await prompt.userChoice;if(outcome==="accepted")setPrompt(null);}} style={{background:T.gradGold,borderRadius:10,padding:"7px 14px",color:"#000",fontWeight:700,fontSize:12}}>Installer</Btn>
      <Btn onClick={()=>{setDismissed(true);localStorage.setItem("pwa_dismissed","1");}} style={{color:T.muted,padding:4}}><X size={16}/></Btn>
    </div>
  );
}

// ── FLAG SELECTOR ─────────────────────────────────────────
const COUNTRIES = [
  {code:"CG",flag:"🇨🇬",name:"Congo-Brazzaville"},
  {code:"CD",flag:"🇨🇩",name:"RD Congo"},
  {code:"FR",flag:"🇫🇷",name:"France"},
  {code:"BE",flag:"🇧🇪",name:"Belgique"},
  {code:"CM",flag:"🇨🇲",name:"Cameroun"},
  {code:"CI",flag:"🇨🇮",name:"Côte d'Ivoire"},
  {code:"SN",flag:"🇸🇳",name:"Sénégal"},
  {code:"GA",flag:"🇬🇦",name:"Gabon"},
  {code:"US",flag:"🇺🇸",name:"États-Unis"},
  {code:"CA",flag:"🇨🇦",name:"Canada"},
  {code:"OTHER",flag:"🌍",name:"Autre"},
];
function FlagSelector({selected,onChange}){
  const [open,setOpen]=useState(false);
  const cur=COUNTRIES.find(c=>c.code===selected)||COUNTRIES[0];
  return(
    <div style={{position:"relative"}}>
      <Btn onClick={()=>setOpen(o=>!o)} style={{padding:"11px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,fontSize:18,display:"flex",alignItems:"center",gap:4,color:T.text}}>
        {cur.flag}<span style={{fontSize:11,color:T.muted}}>▾</span>
      </Btn>
      {open&&(
        <div style={{position:"absolute",top:"110%",left:0,zIndex:99,background:"#111",border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden",minWidth:180,boxShadow:"0 20px 40px rgba(0,0,0,0.6)",animation:"scaleIn .15s ease"}}>
          {COUNTRIES.map(c=>(
            <Btn key={c.code} onClick={()=>{onChange(c.code);setOpen(false);}} style={{width:"100%",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,fontSize:13,color:T.text,background:c.code===selected?T.goldBg:"transparent",textAlign:"left"}}>
              <span style={{fontSize:18}}>{c.flag}</span>{c.name}
            </Btn>
          ))}
        </div>
      )}
    </div>
  );
}

// ── COMPOSANTS ATOMIQUES ──────────────────────────────────

const Av = memo(function Av({u,size=40,online=false,ring=false,onClick}){
  return(
    <div onClick={onClick} style={{position:"relative",flexShrink:0,width:size,height:size,cursor:onClick?"pointer":"default"}}>
      {ring && (
        <svg style={{position:"absolute",inset:-3,width:size+6,height:size+6,zIndex:1,animation:"statusRing 2s ease forwards"}} viewBox={`0 0 ${size+6} ${size+6}`}>
          <circle cx={(size+6)/2} cy={(size+6)/2} r={(size+6)/2-2}
            fill="none" stroke={T.gold} strokeWidth="2"
            strokeDasharray="251" strokeDashoffset="251"
            style={{animation:"statusRing 1.5s ease forwards",transformOrigin:"center",transform:"rotate(-90deg)"}}/>
        </svg>
      )}
      {u?.avatar_url
        ? <img src={u.avatar_url} loading="lazy"
            style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",display:"block",border:`1.5px solid ${ring?T.gold:T.border}`,cursor:"pointer"}}
            alt=""
            onClick={e=>{e.stopPropagation();window.dispatchEvent(new CustomEvent("celeste_view_img",{detail:{url:u.avatar_url}}));}}/>
        : <div style={{width:size,height:size,borderRadius:"50%",
            background:`radial-gradient(circle at 35% 35%, ${u?.color||"#666"}cc, ${u?.color||"#444"}44)`,
            border:`1.5px solid ${ring?T.gold:u?.color||"#888"}44`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:Math.round(size*.36),fontWeight:700,color:u?.color||"#fff",
            fontFamily:"'Cormorant Garamond',serif",
            boxShadow:ring?`0 0 12px ${u?.color||T.gold}44`:"none"}}>
            {u?.initials||"?"}
          </div>
      }
      {online && <div style={{position:"absolute",bottom:1,right:1,width:Math.round(size*.26),height:Math.round(size*.26),borderRadius:"50%",background:T.ok,border:`2px solid ${T.bg}`,boxShadow:"0 0 8px rgba(64,168,96,0.6)"}}/>}
    </div>
  );
});

const Badge = memo(function Badge({type}){
  if(!type) return null;
  const isConfirmed = type==="confirmed";
  return isConfirmed ? (
    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:13,height:13,borderRadius:"50%",
      background:"linear-gradient(135deg,#1DA1F2,#0a85d9)",
      boxShadow:"0 0 0 2px rgba(29,161,242,0.3), 0 0 10px rgba(29,161,242,0.8), 0 0 20px rgba(29,161,242,0.4)",
      flexShrink:0,position:"relative",animation:"badgePulse 2s ease infinite"}}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  ) : (
    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:13,height:13,borderRadius:"50%",
      background:"linear-gradient(135deg,#FFD700,#FF8C00)",
      boxShadow:"0 0 0 2px rgba(255,165,0,0.3), 0 0 10px rgba(255,180,0,0.9), 0 0 22px rgba(255,140,0,0.5)",
      flexShrink:0,animation:"badgePulse 2s ease infinite"}}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
  <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
</svg>
    </span>
  );
});

const Btn = ({children,onClick,style={},disabled=false,type="button"})=>(
  <button type={type} onClick={disabled?undefined:onClick} disabled={disabled}
    style={{cursor:disabled?"not-allowed":"pointer",border:"none",background:"none",outline:"none",...style}}>
    {children}
  </button>
);

// Déclaré HORS de AuthScreen pour éviter la recréation à chaque frappe (fermeture clavier mobile)
const AuthField=memo(function AuthField({val,set,placeholder,type="text",showPw,setShowPw}){
  return(
    <div style={{position:"relative"}}>
      <input type={type==="password"?(showPw?"text":"password"):type} value={val} onChange={e=>set(e.target.value)}
        placeholder={placeholder} autoComplete={type==="password"?"current-password":"on"}
        style={{width:"100%",padding:"13px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,color:T.text,fontSize:13,outline:"none",transition:"border .2s"}}/>
      {type==="password"&&<Btn onClick={()=>setShowPw(s=>!s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:T.muted,fontSize:11}}>{showPw?"🙈":"👁"}</Btn>}
    </div>
  );
});

// ── MEDIA PLAYER ─────────────────────────────────────────
const PostVideoPlayer = memo(function PostVideoPlayer({ url, style = {} }) {
  const ref = useRef(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const controlsTimer = useRef(null);
  const touchStartY = useRef(null);
  const touchStartX = useRef(null);
  const seekDuration = useRef(0);
  const progressBarRef = useRef(null);
  const progressTimeRef = useRef(null);
  const pausedRef = useRef(false);
  const fullscreenRef = useRef(false);

  const triggerControls = () => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 2000);
  };

  // Auto-play/pause selon visibilité
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isMounted = true;

    const obs = new IntersectionObserver(([entry]) => {
      if (!isMounted || fullscreenRef.current) return;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        if (!pausedRef.current) { el.play().catch(() => {}); setPlaying(true); }
      } else { el.pause(); setPlaying(false); }
    }, { threshold: 0.5 });

    obs.observe(el);

    return () => {
      isMounted = false;
      obs.unobserve(el);
      obs.disconnect();
    };
  }, []);

  // ✅ closeFullscreen déclarée au niveau du composant
  const closeFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    fullscreenRef.current = false;
    setFullscreen(false);
    // Pas de manipulation des styles React — on laisse React re-render proprement
    setTimeout(() => {
      if (ref.current && !pausedRef.current) {
        ref.current.play().catch(() => {});
        setPlaying(true);
      }
    }, 150);
  }, []);

  const togglePlayPause = (e) => {
    e.stopPropagation();
    const el = ref.current; if (!el) return;
    if (el.paused) { el.play().catch(() => {}); pausedRef.current = false; setPaused(false); setPlaying(true); }
    else { el.pause(); pausedRef.current = true; setPaused(true); setPlaying(false); }
  };

  // ✅ openFullscreen correctement fermée
  const openFullscreen = (e) => {
    e.stopPropagation();
    const el = ref.current; if (!el) return;

    // iOS : webkitEnterFullscreen natif
    if (el.webkitEnterFullscreen) {
      el.addEventListener("webkitendfullscreen", () => {
        fullscreenRef.current = false;
        setFullscreen(false);
        setPaused(false);
        setPlaying(true);
        setTimeout(() => { if (ref.current) ref.current.play().catch(() => {}); }, 300);
      }, { once: true });
      el.webkitEnterFullscreen();
      return;
    }

    // Android : Fullscreen API standard
    fullscreenRef.current = true;
    setFullscreen(true);
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }

    // Écoute la sortie native (bouton retour Android)
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        closeFullscreen();
        document.removeEventListener("fullscreenchange", onFsChange);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
  };

  const onTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; };
  const onTouchEnd = (e) => {
    if (touchStartY.current === null) return;
    const diff = e.changedTouches[0].clientY - touchStartY.current;
    if (diff > 80) closeFullscreen();
    touchStartY.current = null;
  };

  const controls = (
    <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, display: "flex", alignItems: "center", gap: 8, zIndex: 3 }}>
      <Btn onClick={togglePlayPause} style={{ background: "rgba(0,0,0,0.55)", borderRadius: "50%", width: 34, height: 34, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
        {playing && !paused ? <Pause size={15} /> : <Play size={15} style={{ marginLeft: 2 }} />}
      </Btn>
      <div style={{ flex: 1 }} />
      <Btn onClick={e => { e.stopPropagation(); setMuted(m => !m); }} style={{ background: "rgba(0,0,0,0.55)", borderRadius: "50%", width: 34, height: 34, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
        {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
      </Btn>
      {!fullscreen && (
        <Btn onClick={openFullscreen} style={{ background: "rgba(0,0,0,0.55)", borderRadius: "50%", width: 34, height: 34, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
          <Maximize2 size={15} />
        </Btn>
      )}
      {fullscreen && (
        <Btn onClick={e => { e.stopPropagation(); closeFullscreen(); }} style={{ background: "rgba(0,0,0,0.55)", borderRadius: "50%", width: 34, height: 34, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
          <Minimize2 size={15} />
        </Btn>
      )}
    </div>
  );

  // ✅ Mode fullscreen : rendu distinct et propre, aucun style inline sur la vidéo inline
  if (fullscreen) return (
    <div
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <video
        ref={ref} src={url} playsInline webkit-playsinline="true"
        muted={muted} loop autoPlay
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
      <Btn onClick={e => { e.stopPropagation(); closeFullscreen(); }} style={{ position: "absolute", top: "env(safe-area-inset-top,20px)", right: 20, background: "rgba(0,0,0,0.6)", borderRadius: "50%", width: 40, height: 40, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
        <Minimize2 size={18} />
      </Btn>
      {controls}
    </div>
  );

  // ✅ Mode inline : balise <video> unique, jamais de styles forcés en sortie de fullscreen
  return (
    <div
      style={{ position: "relative", width: "100%" }}
      onClick={triggerControls}
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; seekDuration.current = ref.current?.duration || 0; }}
      onTouchMove={e => {
        if (touchStartX.current === null || !ref.current) return;
        const diff = (e.touches[0].clientX - touchStartX.current) / window.innerWidth * (seekDuration.current * 0.5);
        ref.current.currentTime = Math.max(0, Math.min(seekDuration.current, ref.current.currentTime + diff));
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={() => { touchStartX.current = null; }}
    >
      <video
        ref={ref} src={url} playsInline webkit-playsinline="true"
        muted={muted} loop preload="metadata"
        style={{ width: "100%", borderRadius: 14, display: "block", background: "#000", height: 360, objectFit: "cover", ...style }}
        onTimeUpdate={e => {
          const el = e.target; if (!el.duration) return;
          const pct = (el.currentTime / el.duration) * 100;
          if (progressBarRef.current) progressBarRef.current.style.width = pct + "%";
          if (progressTimeRef.current) {
            const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
            progressTimeRef.current.textContent = `${fmt(el.currentTime)} / ${fmt(el.duration)}`;
          }
        }}
      />
      {/* Barre de progression */}
      <div style={{ position: "absolute", bottom: 50, left: 10, right: 10, zIndex: 4, opacity: showControls ? 1 : 0, transition: "opacity 0.3s ease", pointerEvents: showControls ? "all" : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span ref={progressTimeRef} style={{ color: "#fff", fontSize: 11, fontWeight: 600, minWidth: 70, textAlign: "center", background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: "2px 6px" }}>0:00 / 0:00</span>
        </div>
        <div
          style={{ position: "relative", height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2, cursor: "pointer" }}
          onClick={e => { if (!ref.current) return; const rect = e.currentTarget.getBoundingClientRect(); ref.current.currentTime = ((e.clientX - rect.left) / rect.width) * ref.current.duration; }}
          onTouchStart={e => { if (!ref.current) return; const rect = e.currentTarget.getBoundingClientRect(); ref.current.currentTime = ((e.touches[0].clientX - rect.left) / rect.width) * ref.current.duration; }}>
          <div ref={progressBarRef} style={{ height: "100%", width: "0%", background: T.gradGold, borderRadius: 2, transition: "width 0.1s linear", position: "relative" }}>
            <div style={{ position: "absolute", right: -6, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, borderRadius: "50%", background: T.gold, boxShadow: "0 0 6px rgba(201,149,42,0.8)" }} />
          </div>
        </div>
      </div>
      {!playing && (
        <div onClick={togglePlayPause} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 1, borderRadius: 14 }}>
          <div style={{ background: "rgba(0,0,0,0.5)", borderRadius: "50%", width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Play size={20} color="#fff" style={{ marginLeft: 3 }} />
          </div>
        </div>
      )}
      {controls}
    </div>
  );
});

const MediaPlayer = memo(function MediaPlayer({url,style={},onImageClick}){
  if(!url) return null;
  const isVideo=/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(url)||url.includes("video");
  if(isVideo) return <PostVideoPlayer url={url} style={style}/>;
  return(
    <img src={url} loading="lazy" alt="" onClick={()=>onImageClick?.(url)}
      style={{width:"100%",borderRadius:14,display:"block",objectFit:"cover",maxHeight:500,cursor:onImageClick?"pointer":"default",...style}}/>
  );
});

// ── IMAGE VIEWER ─────────────────────────────────────────
function ImageViewer({url,onClose}){
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.96)",backdropFilter:"blur(20px)",display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn .2s ease"}}
      onClick={onClose}>
      <Btn onClick={onClose} style={{position:"absolute",top:20,right:20,color:"#fff",background:"rgba(255,255,255,0.1)",borderRadius:"50%",width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center"}}><X size={20}/></Btn>
      <img src={url} alt="" style={{maxWidth:"95vw",maxHeight:"95vh",objectFit:"contain",borderRadius:12}} onClick={e=>e.stopPropagation()}/>
    </div>
  );
}

// ── TOAST ─────────────────────────────────────────────────
function Toast({msg}){
  return(
    <div style={{position:"fixed",top:72,left:"50%",transform:"translateX(-50%)",zIndex:999,background:"rgba(10,10,10,0.96)",border:`1px solid ${T.border}`,backdropFilter:"blur(20px)",borderRadius:20,padding:"10px 20px",color:T.text,fontSize:13,fontWeight:500,whiteSpace:"nowrap",boxShadow:"0 8px 32px rgba(0,0,0,0.6)",animation:"notifIn .3s ease"}}>
      {msg}
    </div>
  );
}

// ── NOTIF BANNER ──────────────────────────────────────────
function NotifBanner({notifs,onDismiss,onTap}){
  return(
    <div style={{position:"fixed",top:"env(safe-area-inset-top,0px)",left:0,right:0,zIndex:990,display:"flex",flexDirection:"column",gap:8,padding:"8px 12px",pointerEvents:"none"}}>
      {(notifs||[]).slice(0,3).map(n=>(
        <div key={n.id} style={{background:"rgba(10,10,10,0.97)",border:`1px solid ${T.gold}33`,backdropFilter:"blur(30px)",borderRadius:18,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 12px 40px rgba(0,0,0,0.7)",animation:"notifIn .4s cubic-bezier(0.34,1.2,0.64,1)",pointerEvents:"all",cursor:n.action?"pointer":"default"}}
          onClick={()=>n.action&&onTap(n)}>
          <span style={{fontSize:22,flexShrink:0}}>{n.icon}</span>
          <div style={{flex:1,minWidth:0}}>
            <p style={{margin:0,fontSize:13,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title}</p>
            <p style={{margin:0,fontSize:12,color:T.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.body}</p>
          </div>
          <Btn onClick={e=>{e.stopPropagation();onDismiss(n.id);}} style={{color:T.muted,flexShrink:0,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.05)",borderRadius:"50%"}}><X size={14}/></Btn>
        </div>
      ))}
    </div>
  );
}

// ── REPORT MODAL ──────────────────────────────────────────
function ReportModal({onClose,onSubmit}){
  const [reason,setReason]=useState(""); const [details,setDetails]=useState("");
  const reasons=["Contenu inapproprié","Spam","Harcèlement","Fausse identité","Autre"];
  return(
    <div style={{position:"fixed",inset:0,zIndex:800,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:560,padding:"24px 20px 48px",animation:"slideUp .3s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h3 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,color:T.text}}>Signaler</h3>
          <Btn onClick={onClose} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:"50%",width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",color:T.muted}}><X size={16}/></Btn>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
          {reasons.map(r=>(
            <Btn key={r} onClick={()=>setReason(r)} style={{padding:"11px 16px",borderRadius:12,border:`1px solid ${reason===r?T.gold+"55":T.border}`,background:reason===r?T.goldBg:"transparent",color:reason===r?T.goldL:T.sub,fontSize:13,textAlign:"left",transition:"all .2s"}}>{r}</Btn>
          ))}
        </div>
        <textarea value={details} onChange={e=>setDetails(e.target.value)} placeholder="Détails (optionnel)" rows={2} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"11px 14px",color:T.text,fontSize:13,outline:"none",resize:"none",marginBottom:12}}/>
        <Btn onClick={()=>reason&&onSubmit(reason,details)} disabled={!reason} style={{width:"100%",padding:"14px",background:reason?T.gradGold:"rgba(255,255,255,0.04)",color:reason?"#000":T.muted,borderRadius:14,fontSize:14,fontWeight:700,transition:"all .25s"}}>Envoyer le signalement</Btn>
      </div>
    </div>
  );
}

// ── AUTH SCREEN ───────────────────────────────────────────
function AuthScreen({mode,setMode,onSuccess}){
  const [accountType,setAccountType]=useState("membre");
  const [prenom,setPrenom]=useState(""); const [nom,setNom]=useState("");
  const [paroisse,setParoisse]=useState(""); const [phone,setPhone]=useState("");
  const [whatsapp,setWhatsapp]=useState(""); const [country,setCountry]=useState("CG");
  const [orgName,setOrgName]=useState(""); const [orgType,setOrgType]=useState("");
  const [orgCountry,setOrgCountry]=useState(""); const [orgDesc,setOrgDesc]=useState("");
  const [email,setEmail]=useState(""); const [pw,setPw]=useState("");
  const [showPw,setShowPw]=useState(false); const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");

  const reset=()=>{setPrenom("");setNom("");setParoisse("");setPhone("");setWhatsapp("");setOrgName("");setOrgType("");setOrgCountry("");setOrgDesc("");setEmail("");setPw("");setErr("");};



  const submit=async()=>{
    setErr(""); if(busy)return;
    if(mode==="register"){
      if(accountType==="membre"&&(!prenom.trim()||!nom.trim()||!paroisse.trim()||!phone.trim())){setErr("Champs obligatoires manquants");return;}
      if(accountType==="organisation"&&(!orgName.trim()||!orgType||!orgCountry.trim()||!phone.trim())){setErr("Champs obligatoires manquants");return;}
    }
    if(!email.trim()||!pw.trim()){setErr("Email et mot de passe requis");return;}
    setBusy(true);
    try{
      if(mode==="login"){
        const{error}=await sb.auth.signInWithPassword({email,password:pw});
        if(error)throw error;
      }else{
        const{data,error}=await sb.auth.signUp({email,password:pw});
        if(error)throw error;
        if(data.user){
          const profileData=accountType==="membre"
            ?{id:data.user.id,prenom,nom,paroisse,phone,whatsapp:whatsapp||phone,country,account_type:"membre",status:"pending",joined_at:new Date().toISOString(),updated_at:new Date().toISOString()}
            :{id:data.user.id,prenom:orgName,nom:"",paroisse:orgCountry,phone,whatsapp:whatsapp||phone,org_name:orgName,org_type:orgType,org_country:orgCountry,org_desc:orgDesc,account_type:"organisation",status:"pending",joined_at:new Date().toISOString(),updated_at:new Date().toISOString()};
          await sb.from("profiles").insert(profileData);
          onSuccess?.("pending");
        }
      }
    }catch(e){setErr(e.message||"Erreur de connexion");}
    finally{setBusy(false);}
  };

  return(
    <div style={{minHeight:"100svh",background:T.bg,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px 20px env(safe-area-inset-bottom,20px)",position:"relative",overflow:"auto"}}>
      <div style={{position:"absolute",top:"-30%",left:"-20%",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(201,149,42,0.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:"-30%",right:"-20%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(58,106,154,0.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(${T.border} 1px,transparent 1px)`,backgroundSize:"40px 40px",opacity:.3,pointerEvents:"none"}}/>

      <div style={{width:"100%",maxWidth:400,animation:"titleReveal .6s ease"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:76,height:76,borderRadius:"50%",background:"rgba(201,149,42,0.08)",border:`1px solid ${T.gold}33`,marginBottom:22,animation:"glow 3s ease infinite",boxShadow:`0 0 40px rgba(201,149,42,0.15)`}}>
            <span style={{fontSize:34,fontFamily:"'Cormorant Garamond',serif",color:T.gold}}>✦</span>
          </div>
          <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:48,fontWeight:300,color:T.text,letterSpacing:5,marginBottom:6}}>Céleste</h1>
          <p style={{color:T.muted,fontSize:12,letterSpacing:2,textTransform:"uppercase"}}>Exprime ta vrai personnalitée</p>
        </div>

        <div style={{background:"rgba(255,255,255,0.025)",border:`1px solid ${T.border}`,borderRadius:24,overflow:"hidden",backdropFilter:"blur(30px)"}}>
          <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,position:"relative"}}>
            {["login","register"].map(m=>(
              <Btn key={m} onClick={()=>{setMode(m);reset();}} style={{flex:1,padding:"16px",fontSize:13,fontWeight:600,color:mode===m?T.goldL:T.sub,transition:"all .3s",letterSpacing:.5,position:"relative"}}>
                {m==="login"?"Connexion":"Inscription"}
                {mode===m&&<div style={{position:"absolute",bottom:0,left:"15%",right:"15%",height:2,background:T.gradGold,borderRadius:2}}/>}
              </Btn>
            ))}
          </div>

          <div style={{padding:"24px 20px 28px",display:"flex",flexDirection:"column",gap:10}}>
            {mode==="register"&&(
              <>
                <div style={{display:"flex",gap:8,marginBottom:4}}>
                  {[{val:"membre",label:"👤 Membre"},{val:"organisation",label:"🏛️ Organisation"}].map(t=>(
                    <Btn key={t.val} onClick={()=>setAccountType(t.val)} style={{flex:1,padding:"10px",borderRadius:12,fontSize:12,fontWeight:700,border:`1px solid ${accountType===t.val?T.gold:T.border}`,background:accountType===t.val?T.goldBg:"transparent",color:accountType===t.val?T.goldL:T.muted,transition:"all .25s"}}>
                      {t.label}
                    </Btn>
                  ))}
                </div>
                {accountType==="membre"?(
                  <>
                    <div style={{display:"flex",gap:10}}>
                      <div style={{flex:1}}><AuthField val={prenom} set={setPrenom} placeholder="Prénom *"/></div>
                      <div style={{flex:1}}><AuthField val={nom} set={setNom} placeholder="Nom *"/></div>
                    </div>
                    <AuthField val={paroisse} set={setParoisse} placeholder="Quartier / Ville *"/>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <FlagSelector selected={country} onChange={setCountry}/>
                      <div style={{flex:1}}><AuthField val={phone} set={setPhone} placeholder="☎ Téléphone *" type="tel"/></div>
                    </div>
                    <AuthField val={whatsapp} set={setWhatsapp} placeholder="WhatsApp (si différent)"/>
                  </>
                ):(
                  <>
                    <AuthField val={orgName} set={setOrgName} placeholder="Nom de l'organisation *"/>
                    <select value={orgType} onChange={e=>setOrgType(e.target.value)} style={{width:"100%",padding:"13px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,color:orgType?T.text:T.sub,fontSize:13,outline:"none",appearance:"none"}}>
                      <option value="">Type *</option>
<option value="restaurant">🍽️ Restaurant</option>
<option value="hotel">🏨 Hôtel</option>
<option value="musique">🎵 Musique / Artiste</option>
<option value="entreprise">💼 Entreprise</option>
<option value="association">🤝 Association</option>
<option value="ecole">🎓 École / Université</option>
<option value="autre">📌 Autre</option>
                    </select>
                    <AuthField val={orgCountry} set={setOrgCountry} placeholder="Pays *"/>
                    <AuthField val={orgDesc} set={setOrgDesc} placeholder="Description (optionnel)"/>
                    <AuthField val={phone} set={setPhone} placeholder="☎ Téléphone *" type="tel"/>
                    <AuthField val={whatsapp} set={setWhatsapp} placeholder="WhatsApp (si différent)"/>
                  </>
                )}
              </>
            )}
            <AuthField val={email} set={setEmail} placeholder="Email *" type="email"/>
            <AuthField val={pw} set={setPw} placeholder="Mot de passe *" type="password" showPw={showPw} setShowPw={setShowPw}/>
            {err&&<div style={{background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:12,padding:"10px 14px",color:T.err,fontSize:12}}>⚠ {err}</div>}
            <Btn onClick={submit} disabled={busy} style={{padding:"16px",background:busy?T.goldBg:T.gradGold,color:"#000",borderRadius:14,fontSize:14,fontWeight:700,boxShadow:busy?"none":"0 8px 32px rgba(201,149,42,0.3), 0 0 0 1px rgba(201,149,42,0.1)",opacity:busy?.6:1,transition:"all .25s",marginTop:4,letterSpacing:.3}}>
              {busy?"⏳ Chargement…":mode==="login"?"Se connecter ✦":"Créer mon compte ✦"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── NOTIFICATIONS SCREEN (NOUVEAU depuis App 9) ───────────
function NotifsScreen({myProfile,session,members}){
  const {setTab}=useApp();
  const [notifs,setNotifs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("tous");

  const load=useCallback(async()=>{
    setLoading(true);
    const{data}=await sb.from("notifications")
      .select("*, from:profiles!notifications_from_id_fkey(*)")
      .eq("user_id",session?.user?.id)
      .order("created_at",{ascending:false})
      .limit(100);
    setNotifs(data||[]);
    setLoading(false);
    await sb.from("notifications").update({read:true}).eq("user_id",session?.user?.id).eq("read",false);
  },[session?.user?.id]);

  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    const ch=sb.channel(`notifs-${session?.user?.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:`user_id=eq.${session?.user?.id}`},load)
      .subscribe();
    return()=>sb.removeChannel(ch);
  },[session?.user?.id,load]);

  const label=n=>({
    like:"a aimé ta publication",
    comment:"a commenté ta publication",
    reply:"a répondu à ton commentaire",
    comment_like:"a aimé ton commentaire",
    follow:"a commencé à te suivre",
    mention:"t'a mentionné",
    status_like:"a aimé ton statut",
    status_view:"a vu ton statut",
  }[n.type]||n.type);

  const icon=n=>({
    like:"❤️",
    comment:"💬",
    reply:"↩️",
    comment_like:"💛",
    follow:"✦",
    mention:"@",
    status_like:"❤️",
    status_view:"👁",
  }[n.type]||"🔔");

  const filtered=notifs.filter(n=>{
    if(filter==="tous")return true;
    if(filter==="mentions")return n.type==="mention";
    if(filter==="likes")return n.type==="like"||n.type==="comment_like"||n.type==="status_like";
    if(filter==="commentaires")return n.type==="comment"||n.type==="reply";
    if(filter==="abonnements")return n.type==="follow";
    return true;
  });

  const tabs=[
    {id:"tous",l:"Tous"},
    {id:"mentions",l:"Mentions"},
    {id:"likes",l:"Likes"},
    {id:"commentaires",l:"Commentaires"},
    {id:"abonnements",l:"Abonnements"},
  ];

  if(loading)return(
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:32,height:32,border:`2px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
    </div>
  );

  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg}}>
      {/* Header */}
      <div style={{position:"sticky",top:0,zIndex:10,background:"rgba(0,0,0,0.95)",backdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`}}>
        <div style={{padding:"14px 16px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,color:T.text}}>Activité</h2>
          {notifs.some(n=>!n.read)&&(
            <span style={{background:T.gradGold,color:"#000",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>
              {notifs.filter(n=>!n.read).length} nouvelles
            </span>
          )}
        </div>
        {/* Onglets */}
        <div style={{display:"flex",gap:0,overflowX:"auto",padding:"8px 16px 0"}}>
          {tabs.map(t=>(
            <Btn key={t.id} onClick={()=>setFilter(t.id)} style={{padding:"8px 14px",fontSize:12,fontWeight:filter===t.id?700:400,color:filter===t.id?T.text:T.muted,whiteSpace:"nowrap",flexShrink:0,borderBottom:filter===t.id?`2px solid ${T.gold}`:"2px solid transparent",borderRadius:0,transition:"all .2s"}}>
              {t.l}
            </Btn>
          ))}
        </div>
      </div>

      {/* Liste */}
      {filtered.length===0?(
        <div style={{textAlign:"center",padding:"80px 20px",color:T.muted}}>
          <div style={{fontSize:40,marginBottom:12,opacity:.3,animation:"float 3s ease infinite"}}>🔔</div>
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20}}>Aucune notification</p>
        </div>
      ):(
        <div style={{maxWidth:640,margin:"0 auto"}}>
          {filtered.map(n=>{
            const from=n.from?normProfile(n.from):null;
            return(
              <div key={n.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:`1px solid ${T.border}`,background:n.read?"transparent":"rgba(201,149,42,0.03)",cursor:"pointer",transition:"background .2s",animation:"fadeUp .3s ease"}}
                onClick={async()=>{
                  // Follow → profil de l'expéditeur
                  if(n.type==="follow"){
                    if(from?.id)window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:from.id}}));
                    return;
                  }
                  // Like/comment statut → vérifier si statut existe encore
                  if(n.type==="status_like"||n.type==="status_view"){
                    if(!n.status_id){alert("Ce statut n'existe plus.");return;}
                    const{data}=await sb.from("statuses").select("id").eq("id",n.status_id).maybeSingle();
                    if(!data){alert("Ce statut n'existe plus.");return;}
                    setTab("statuses");
                    return;
                  }
                  // Like/comment/mention/reply → vérifier si post existe encore
                  if(n.post_id){
                    const{data}=await sb.from("posts").select("id,author_id").eq("id",n.post_id).maybeSingle();
                    if(!data){alert("Cette publication n'existe plus.");return;}
                    // Si c'est mon post → aller dans mon profil
                    if(data.author_id===session?.user?.id){
                      setTab("profile");
                    } else {
                      setTab("home");
                    }
                    // Déclencher ouverture du post
                    setTimeout(()=>{
                      window.dispatchEvent(new CustomEvent("celeste_open_post",{detail:{postId:n.post_id}}));
                    },300);
                    return;
                  }
                }}>
                {/* Avatar + icône */}
                <div style={{position:"relative",flexShrink:0}}>
                 <Av u={from||{initials:"?",color:"#888"}} size={46} onClick={e=>{e.stopPropagation();window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:from?.id}}));}}/>
                  <div style={{position:"absolute",bottom:-2,right:-2,width:20,height:20,borderRadius:"50%",background:T.bg3,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>
                    {icon(n)}
                  </div>
                </div>
                {/* Texte */}
                <div style={{flex:1,minWidth:0}}>
                  <p style={{margin:"0 0 2px",fontSize:13,color:T.text,lineHeight:1.5}}>
                    <strong style={{color:T.text}}>{from?.name||"Quelqu'un"}</strong>
                    {" "}<span style={{color:T.sub}}>{label(n)}</span>
                  </p>
                  <p style={{margin:0,fontSize:11,color:T.muted}}>{ago(n.created_at)}</p>
                </div>
                {/* Point non lu */}
                {!n.read&&(
                  <div style={{width:8,height:8,borderRadius:"50%",background:T.gold,flexShrink:0,boxShadow:T.glowGold}}/>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div style={{height:80}}/>
    </div>
  );
}
function MentionInput({value,onChange,onSubmit,placeholder,style={},rows=1,members=[]}){
  const [showSuggestions,setShowSuggestions]=useState(false);
  const [suggestions,setSuggestions]=useState([]);
  const [mentionQuery,setMentionQuery]=useState("");
  const [cursorPos,setCursorPos]=useState(0);
  const ref=useRef();

  const handleChange=e=>{
    const val=e.target.value;
    const cursor=e.target.selectionStart;
    onChange(val);
    setCursorPos(cursor);

    // Détecter @
    const textBeforeCursor=val.slice(0,cursor);
    const match=textBeforeCursor.match(/@(\w*)$/);
    if(match){
      const query=match[1].toLowerCase();
      setMentionQuery(query);
      const filtered=(members||[]).filter(m=>
        m.name?.toLowerCase().includes(query)||
        m.prenom?.toLowerCase().includes(query)||
        m.fullName?.toLowerCase().includes(query)
      ).slice(0,8);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length>0);
    }else{
      setShowSuggestions(false);
    }

    // Auto-resize
    if(ref.current){
      ref.current.style.height="auto";
      ref.current.style.height=Math.min(ref.current.scrollHeight,140)+"px";
    }
  };

  const insertMention=member=>{
    const textBeforeCursor=value.slice(0,cursorPos);
    const textAfterCursor=value.slice(cursorPos);
   const newText=textBeforeCursor.replace(/@\w*$/,"@"+(member.prenom||member.name||member.fullName||"")+" ")+textAfterCursor;
    onChange(newText);
    setShowSuggestions(false);
    ref.current?.focus();
  };

  return(
    <div style={{position:"relative",flex:1}}>
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        style={{width:"100%",background:"transparent",border:"none",padding:"6px 4px",color:T.text,fontSize:14,outline:"none",resize:"none",maxHeight:140,lineHeight:"1.4",fontFamily:"inherit",display:"block",...style}}
      />
      {showSuggestions&&(
        <div style={{position:"absolute",bottom:"110%",left:0,right:0,background:"rgba(10,10,10,0.98)",border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden",zIndex:100,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",animation:"scaleIn .15s ease"}}>
          {/* Barre de recherche */}
          <div style={{padding:"8px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8}}>
            <Search size={13} color={T.muted}/>
            <span style={{fontSize:12,color:T.muted}}>Mentionner · <strong style={{color:T.goldL}}>@{mentionQuery}</strong></span>
          </div>
          {suggestions.map(m=>(
            <div key={m.id} onMouseDown={e=>{e.preventDefault();insertMention(m);}}
              style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${T.border}`,transition:"background .15s"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(201,149,42,0.06)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <Av u={m} size={32}/>
              <div>
                <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>{m.fullName||m.name}</p>
                <p style={{margin:0,fontSize:11,color:T.muted}}>📍 {m.paroisse}</p>
              </div>
              {m.badge&&<Badge type={m.badge}/>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ── COMMENTS SECTION ─────────────────────────────────────
function CommentsSection({postId,sessionUserId,getM,onCountChange}){
 const {setHideNav,members}=useApp();
 const [comments,setComments]=useState([]);
  const [text,setText]=useState("");
  const [posting,setPosting]=useState(false);
  const [mediaFile,setMediaFile]=useState(null);
  const [mediaPreview,setMediaPreview]=useState(null);
  const textareaRef=useRef(null);
  const imgRef=useRef(null);

  useEffect(()=>{
    const ta=textareaRef.current;
    if(ta){ta.style.height="auto";ta.style.height=Math.min(ta.scrollHeight,140)+"px";}
  },[text]);

  const load=useCallback(async()=>{
    const{data}=await sb.from("comments")
      .select("*, author:profiles!comments_author_id_fkey(*)")
      .eq("post_id",postId)
      .order("created_at",{ascending:true});
    setComments(data||[]);
    onCountChange?.((data||[]).length);
  },[postId,onCountChange]);

  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    const ch=sb.channel(`comments-${postId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"comments",filter:`post_id=eq.${postId}`},load)
      .subscribe();
    return()=>sb.removeChannel(ch);
  },[postId,load]);

  const submit=async()=>{
    if((!text.trim()&&!mediaFile)||posting)return;
    setPosting(true);
    const trimmed=text.trim();
    let mediaUrl=null;
    if(mediaFile){
      const path=`comments/${sessionUserId}/${Date.now()}.jpg`;
      const{error:upErr}=await sb.storage.from("celeste-media").upload(path,mediaFile,{upsert:true,contentType:"image/jpeg"});
      if(!upErr){const{data}=sb.storage.from("celeste-media").getPublicUrl(path);mediaUrl=data.publicUrl;}
    }
   const uid=(await sb.auth.getUser())?.data?.user?.id;
const{error}=await sb.from("comments").insert({post_id:postId,author_id:uid,text:trimmed,media_url:mediaUrl});
    if(!error){
      setText("");
      setMediaFile(null);
      setMediaPreview(null);
      load();
      if(onCountChange)onCountChange(c=>c+1);
      // Détecter les mentions et envoyer des notifications
      const mentions=trimmed.match(/@(\w+)/g)||[];
      for(const mention of mentions){
        const prenom=mention.slice(1).toLowerCase();
        const mentioned=(members||[]).find(m=>m.prenom?.toLowerCase()===prenom||m.name?.toLowerCase().startsWith(prenom));
        if(mentioned&&mentioned.id!==sessionUserId){
          await sb.from("notifications").insert({
            user_id:mentioned.id,
            from_id:sessionUserId,
            type:"mention",
            post_id:postId,
            read:false
          });
        }
      }
    }
    setPosting(false);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14,padding:"4px 0"}}>
      <div style={{display:"flex",flexDirection:"column",gap:12,maxHeight:320,overflowY:"auto",paddingRight:4}}>
        {comments.map(c=>(
          <CommentItem key={c.id} comment={c} sessionUserId={sessionUserId} getM={getM} onChange={load}/>
        ))}
      </div>
     {mediaPreview&&(
        <div style={{position:"relative",marginBottom:6}}>
          <img src={mediaPreview} alt="" style={{width:"100%",maxHeight:160,objectFit:"cover",borderRadius:14}}/>
          <Btn onClick={()=>{setMediaPreview(null);setMediaFile(null);}} style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.7)",borderRadius:"50%",width:26,height:26,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={12}/></Btn>
        </div>
      )}
      <div style={{display:"flex",alignItems:"flex-end",gap:8,padding:"8px 12px",background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:24,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",boxShadow:"0 4px 20px rgba(0,0,0,0.2)"}}>
        <input ref={imgRef} type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
          const f=e.target.files[0];if(!f)return;
          const compressed=await compressImage(f);
          const r=new FileReader();r.onload=ev=>setMediaPreview(ev.target.result);r.readAsDataURL(compressed);
          setMediaFile(compressed);
          e.target.value="";
        }}/>
        <Btn onClick={()=>imgRef.current.click()} style={{color:mediaFile?T.goldL:T.muted,padding:"4px",display:"flex",alignItems:"center",flexShrink:0,transition:"color .2s"}}>
          <Camera size={18}/>
        </Btn>
        <MentionInput
          value={text}
          onChange={setText}
          placeholder="Ajouter un commentaire..."
          members={members||[]}
          onFocus={()=>setHideNav(true)}
          onBlur={()=>setHideNav(false)}
        />
        <Btn onClick={submit} disabled={posting||(!text.trim()&&!mediaFile)} style={{background:(text.trim()||mediaFile)?T.gradGold:"rgba(255,255,255,0.05)",borderRadius:"50%",width:34,height:34,color:(text.trim()||mediaFile)?"#000":T.muted,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.25s cubic-bezier(0.4,0,0.2,1)",flexShrink:0,marginBottom:2}}>
          <Send size={13} style={{transform:"translateX(0.5px)"}}/>
        </Btn>
      </div>
    </div>
  );
}

// ── COMMENT ITEM (NOUVEAU - likes + réponses depuis App 9) ─
function CommentItem({comment,sessionUserId,getM,onChange}){
  const [likes,setLikes]=useState(0);
  const [liked,setLiked]=useState(false);
  const [replies,setReplies]=useState([]);
  const [showReplies,setShowReplies]=useState(false);
  const [replyText,setReplyText]=useState("");
  const [replying,setReplying]=useState(false);
  const isMine=comment.author_id===sessionUserId;
  const author=comment.author?normProfile(comment.author):getM(comment.author_id);

  const loadMeta=useCallback(async()=>{
    const[{count:lc},{data:ml},{data:rep}]=await Promise.all([
      sb.from("comment_likes").select("*",{count:"exact",head:true}).eq("comment_id",comment.id),
      sb.from("comment_likes").select("id").eq("comment_id",comment.id).eq("user_id",sessionUserId).maybeSingle(),
      sb.from("comment_replies").select("*, author:profiles(*)").eq("parent_comment_id",comment.id).order("created_at"),
    ]);
    setLikes(lc||0);setLiked(!!ml);setReplies(rep||[]);
  },[comment.id,sessionUserId]);

  useEffect(()=>{loadMeta();},[loadMeta]);

  const toggleLike=async()=>{
    if(liked){await sb.from("comment_likes").delete().eq("comment_id",comment.id).eq("user_id",sessionUserId);setLiked(false);setLikes(l=>l-1);}
    else{await sb.from("comment_likes").insert({comment_id:comment.id,user_id:sessionUserId});setLiked(true);setLikes(l=>l+1);}
  };

  const submitReply=async()=>{
    if(!replyText.trim())return;
    const text=replyText.trim();
    setReplyText("");setReplying(false);
    await sb.from("comment_replies").insert({parent_comment_id:comment.id,author_id:sessionUserId,text});
    loadMeta();setShowReplies(true);
  };

  const del=async()=>{
    if(!window.confirm("Supprimer ?"))return;
    await sb.from("comments").delete().eq("id",comment.id);
    onChange?.();
  };

  return(
    <div style={{display:"flex",gap:10,paddingBottom:4}}>
      {/* Colonne gauche : avatar + ligne verticale */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
        <Av u={author} size={36} onClick={()=>window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:author?.id}}))}/>
        {(replies.length>0||replying)&&(
          <div style={{width:2,flex:1,minHeight:16,background:"rgba(255,255,255,0.1)",borderRadius:2,marginTop:4}}/>
        )}
      </div>

      {/* Colonne droite : contenu */}
      <div style={{flex:1,minWidth:0}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:13,fontWeight:700,color:T.text}}>{author?.name||"?"}</span>
            <span style={{fontSize:11,color:T.muted}}>{ago(comment.created_at)}</span>
          </div>
          {isMine&&(
            <Btn onClick={del} style={{color:T.muted,padding:4,display:"flex",alignItems:"center"}}><MoreHorizontal size={16}/></Btn>
          )}
        </div>

       {/* Texte */}
        {comment.text&&<p style={{margin:"0 0 8px",fontSize:14,color:T.text,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{comment.text}</p>}
{comment.media_url&&(
  <div style={{marginBottom:8,borderRadius:10,overflow:"hidden",maxWidth:200}}>
    <MediaPlayer url={comment.media_url} style={{borderRadius:10,maxHeight:160}} onImageClick={url=>window.dispatchEvent(new CustomEvent("celeste_view_img",{detail:{url}}))}/>
  </div>
)}

        {/* Actions style Threads */}
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:8}}>
          <Btn onClick={toggleLike} style={{display:"flex",alignItems:"center",gap:5,color:liked?T.err:T.muted,fontSize:12}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={liked?"currentColor":"none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            {likes>0&&<span>{likes}</span>}
          </Btn>
          <Btn onClick={()=>setReplying(r=>!r)} style={{display:"flex",alignItems:"center",gap:5,color:T.muted,fontSize:12}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {replies.length>0&&<span>{replies.length}</span>}
          </Btn>
        </div>

        {/* Champ réponse */}
        {replying&&(
          <div style={{display:"flex",gap:8,alignItems:"flex-end",marginBottom:10}}>
            <textarea autoFocus rows={1} value={replyText}
              onChange={e=>{setReplyText(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,100)+"px";}}
              placeholder={`Répondre à ${author?.name||""}…`}
              style={{flex:1,background:"rgba(255,255,255,0.05)",border:`1px solid ${T.border}`,borderRadius:16,padding:"8px 14px",color:T.text,fontSize:13,outline:"none",resize:"none",lineHeight:1.4,maxHeight:100,fontFamily:"inherit"}}/>
            <Btn onClick={submitReply} disabled={!replyText.trim()} style={{background:replyText.trim()?T.gradGold:"rgba(255,255,255,0.05)",borderRadius:"50%",width:32,height:32,color:replyText.trim()?"#000":T.muted,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Send size={13}/>
            </Btn>
          </div>
        )}

        {/* Réponses */}
        {replies.length>0&&(
          <Btn onClick={()=>setShowReplies(s=>!s)} style={{fontSize:12,color:T.muted,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:16,height:1,background:T.muted,borderRadius:1}}/>
            {showReplies?`Masquer les réponses`:`Voir ${replies.length} réponse${replies.length>1?"s":""}`}
          </Btn>
        )}

        {showReplies&&(
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:8}}>
            {replies.map(r=>{
              const ra=r.author?normProfile(r.author):{initials:"?",color:"#888",name:"?"};
              const isMyReply=r.author_id===sessionUserId;
              return(
                <div key={r.id} style={{display:"flex",gap:10}}>
                  <Av u={ra} size={28}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                      <span style={{fontSize:12,fontWeight:700,color:T.text}}>{ra.name}</span>
                      <span style={{fontSize:11,color:T.muted}}>{ago(r.created_at)}</span>
                      {isMyReply&&<Btn onClick={async()=>{if(!window.confirm("Supprimer ?"))return;await sb.from("comment_replies").delete().eq("id",r.id);loadMeta();}} style={{color:T.muted,padding:2,marginLeft:"auto",display:"flex"}}><MoreHorizontal size={14}/></Btn>}
                    </div>
                    <p style={{margin:0,fontSize:13,color:T.text,lineHeight:1.6}}>{r.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── POST DETAIL MODAL (ENRICHI) ───────────────────────────
function PostDetailModal({post,myProfile,session,getM,onClose,onLike,onComment,notify}){
  const [viewImg,setViewImg]=useState(null);
  const [openCeleste,setOpenCeleste]=useState(false);
  const [celesteMsgs,setCelesteMsgs]=useState([]);
  const [cmtCount,setCmtCount]=useState((post.comments||[]).length);
  const [slideIdx,setSlideIdx]=useState(0);
  const swipeStartRef=useRef(null);
  const bottomRef=useRef();
  const auth=post.author||getM(post.by);
  const liked=(post.likes||[]).includes(session?.user?.id);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[]);

  return(
    <>
      {viewImg&&<ImageViewer url={viewImg} onClose={()=>setViewImg(null)}/>}
      <div style={{position:"fixed",inset:0,zIndex:800,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
        onClick={e=>e.target===e.currentTarget&&onClose()}>
        <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:640,maxHeight:"92vh",display:"flex",flexDirection:"column",animation:"slideUp .35s cubic-bezier(0.34,1.1,0.64,1)",boxShadow:"0 -20px 60px rgba(0,0,0,0.8)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 16px 12px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <Av u={auth} size={38}/>
              <div>
                <p style={{margin:0,fontSize:14,fontWeight:600,color:T.text}}>{auth?.name}</p>
                <p style={{margin:0,fontSize:11,color:T.muted}}>{ago(post.ts)}</p>
              </div>
            </div>
            <Btn onClick={onClose} style={{color:T.muted,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.04)",borderRadius:"50%",border:`1px solid ${T.border}`}}><X size={16}/></Btn>
          </div>
          <div style={{overflowY:"auto",flex:1,padding:"0 16px 16px"}}>
            {post.type==="event"
              ?<div style={{margin:"12px 0",background:T.goldBg,borderRadius:16,padding:16,border:`1px solid ${T.gold}22`}}>
                <p style={{margin:"0 0 6px",fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:T.text}}>{post.title}</p>
                {post.text&&<p style={{margin:"0 0 8px",fontSize:13,color:T.sub,lineHeight:1.7}}>{post.text}</p>}
                {post.eventDate&&<p style={{margin:"0 0 3px",fontSize:12,color:T.gold}}>🗓 {post.eventDate}</p>}
                {post.eventLoc&&<p style={{margin:0,fontSize:12,color:T.sub}}>📍 {post.eventLoc}</p>}
              </div>
              :<>
              {post.text&&<p style={{margin:"12px 0 8px",fontSize:14,color:T.text,lineHeight:1.8,whiteSpace:"pre-line"}}>{renderTextWithMentions(post.text, username=>{const m=(members||[]).find(u=>u.prenom?.toLowerCase()===username.toLowerCase()||u.name?.toLowerCase().startsWith(username.toLowerCase()));if(m)window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:m.id}}));})}</p>}
  {(()=>{
  const allMedia=post.media_urls?.length>0?post.media_urls:(post.img?[post.img]:[]);
  if(allMedia.length===0)return null;
  return(
    <div style={{position:"relative",borderRadius:16,overflow:"hidden",marginBottom:10}}
      onTouchStart={e=>{swipeStartRef.current=e.touches[0].clientX;}}
onTouchEnd={e=>{
  if(swipeStartRef.current===null)return;
  const diff=swipeStartRef.current-e.changedTouches[0].clientX;
  if(diff>50&&slideIdx<allMedia.length-1)setSlideIdx(i=>i+1);
  if(diff<-50&&slideIdx>0)setSlideIdx(i=>i-1);
  swipeStartRef.current=null;
}}>
      <MediaPlayer url={allMedia[slideIdx]} onImageClick={setViewImg}/>
      {allMedia.length>1&&(
        <>
          <div style={{position:"absolute",bottom:8,left:"50%",transform:"translateX(-50%)",display:"flex",gap:4}}>
            {allMedia.map((_,i)=><div key={i} onClick={()=>setSlideIdx(i)} style={{width:i===slideIdx?16:6,height:6,borderRadius:3,background:i===slideIdx?"#fff":"rgba(255,255,255,0.4)",transition:"width .2s",cursor:"pointer"}}/>)}
          </div>
          <div style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.55)",borderRadius:20,padding:"3px 10px",fontSize:11,color:"#fff",fontWeight:700}}>{slideIdx+1}/{allMedia.length}</div>
        </>
      )}
    </div>
  );
})()}
              </>
            }
            <div style={{display:"flex",alignItems:"center",gap:16,padding:"10px 0",borderTop:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`,margin:"10px 0"}}>
              <Btn onClick={()=>onLike(post.id)} style={{display:"flex",alignItems:"center",gap:6,color:liked?T.gold:T.sub,fontSize:13,fontWeight:600,transition:"all .2s"}}>
                <span style={{fontSize:18,animation:liked?"pulse .3s ease":""}}>{liked?"❤️":"🤍"}</span>
                {(post.likes||[]).length}
              </Btn>
              <span style={{color:T.sub,fontSize:13}}>💬 {cmtCount}</span>
            </div>
            <CommentsSection
              postId={post.id}
              sessionUserId={session?.user?.id}
              getM={getM}
              onCountChange={setCmtCount}
            />
            <div ref={bottomRef}/>
          </div>
        </div>
      </div>
    </>
  );
}

function NewPostModal({myProfile,session,onClose,onPost}){
  const [type,setType]=useState("text"); const [text,setText]=useState("");
  const [previews,setPreviews]=useState([]); const [mediaUrls,setMediaUrls]=useState([]);
  const [carouselIdx,setCarouselIdx]=useState(0);
  const [uploading,setUploading]=useState(false);
  const [evTitle,setEvTitle]=useState(""); const [evDate,setEvDate]=useState(""); const [evLoc,setEvLoc]=useState("");
  const [busy,setBusy]=useState(false); const fRef=useRef();

  const handlePick=async e=>{
    const files=Array.from(e.target.files).slice(0,10-previews.length);
    if(!files.length)return;
    for(const f of files){
      let file=f;
      if(f.type.startsWith("image/"))file=await compressImage(f);
      if(f.type.startsWith("video/")&&f.size>50*1024*1024){alert("Vidéo max 50MB");continue;}
      const r=new FileReader();
      r.onload=ev=>setPreviews(p=>[...p,{url:ev.target.result,type:f.type.startsWith("video/")?"video":"image"}]);setType("photo");
      r.readAsDataURL(file);
      setUploading(true);
      const ext=file.name.split(".").pop().toLowerCase();
const path=`posts/${session?.user?.id}/${Date.now()}.${ext}`;
      const{error}=await sb.storage.from("celeste-media").upload(path,file,{upsert:true});
      if(!error){
        const{data:{publicUrl}}=sb.storage.from("celeste-media").getPublicUrl(path);
        setMediaUrls(p=>[...p,publicUrl]);
      }
      setUploading(false);
    }
    e.target.value="";
  };

  const removeMedia=idx=>{
    setPreviews(p=>p.filter((_,i)=>i!==idx));
    setMediaUrls(p=>p.filter((_,i)=>i!==idx));
    setCarouselIdx(i=>Math.max(0,i-1));
  };

  const submit=async()=>{
    if(busy)return;setBusy(true);
    const{error}=await sb.from("posts").insert({
      author_id:session?.user?.id,type,
      text:text.trim()||"",
      img_url:mediaUrls.length===1?(mediaUrls[0]||null):null,
media_urls:mediaUrls.length>1?mediaUrls:null,
      event_title:type==="event"?evTitle.trim():null,
      event_date:type==="event"?evDate:null,
      event_loc:type==="event"?evLoc:null
    });
    setBusy(false); if(!error)onPost();
  };

  const ok=type==="text"?text.trim().length>0:type==="photo"?mediaUrls.length>0:evTitle.trim().length>0;

  return(
    <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:640,padding:"22px 20px 44px",maxHeight:"92vh",overflowY:"auto",animation:"slideUp .35s cubic-bezier(0.34,1.1,0.64,1)"}}>

        {/* input fichier — multiple */}
        <input ref={fRef} type="file" accept="image/*,video/*" multiple style={{display:"none"}} onChange={handlePick}/>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Av u={myProfile} size={40}/>
            <div>
              <p style={{margin:0,fontSize:14,fontWeight:600,color:T.text}}>{myProfile?.fullName}</p>
              <p style={{margin:0,fontSize:11,color:T.muted}}>⛪ {myProfile?.paroisse}</p>
            </div>
          </div>
          <Btn onClick={onClose} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:"50%",width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",color:T.muted}}><X size={16}/></Btn>
        </div>

        {/* Tabs type */}
        <div style={{display:"flex",gap:6,marginBottom:16,background:"rgba(255,255,255,0.03)",borderRadius:14,padding:4}}>
          {[{id:"text",l:"✍ Texte"},{id:"photo",l:"📷 Média"},{id:"event",l:"🗓 Événement"}].map(t=>(
            <Btn key={t.id} onClick={()=>setType(t.id)} style={{flex:1,padding:"9px 4px",borderRadius:11,background:type===t.id?T.goldBg:"none",color:type===t.id?T.goldL:T.muted,fontSize:11,fontWeight:type===t.id?700:400,border:type===t.id?`1px solid ${T.gold}44`:"1px solid transparent",transition:"all .2s"}}>
              {t.l}
            </Btn>
          ))}
        </div>

        {/* Zone média avec carousel */}
        {type==="photo"&&(
          previews.length>0
            ?<div style={{position:"relative",marginBottom:12}}>
              {/* Carousel */}
              <div style={{position:"relative",borderRadius:16,overflow:"hidden",background:"#000"}}>
                {previews[carouselIdx]?.type==="video"
                  ?<video src={previews[carouselIdx].url} controls playsInline style={{width:"100%",maxHeight:280,objectFit:"contain",display:"block"}}/>
                  :<img src={previews[carouselIdx].url} alt="" style={{width:"100%",maxHeight:280,objectFit:"cover",display:"block",borderRadius:16}}/>
                }

                {/* Overlay upload */}
                {uploading&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8}}>
                  <div style={{width:32,height:32,border:`2px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
                  <span style={{color:T.goldL,fontSize:12}}>Upload en cours…</span>
                </div>}

                {/* Bouton supprimer ce média */}
                <Btn onClick={()=>removeMedia(carouselIdx)} style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.7)",borderRadius:"50%",width:30,height:30,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={14}/></Btn>

                {/* Flèches navigation */}
                {previews.length>1&&carouselIdx>0&&(
                  <Btn onClick={()=>setCarouselIdx(i=>i-1)} style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,0.55)",borderRadius:"50%",width:32,height:32,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <ChevronLeft size={16}/>
                  </Btn>
                )}
                {previews.length>1&&carouselIdx<previews.length-1&&(
                  <Btn onClick={()=>setCarouselIdx(i=>i+1)} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,0.55)",borderRadius:"50%",width:32,height:32,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <ChevronRight size={16}/>
                  </Btn>
                )}

                {/* Indicateur points */}
                {previews.length>1&&(
                  <div style={{position:"absolute",bottom:8,left:"50%",transform:"translateX(-50%)",display:"flex",gap:4}}>
                    {previews.map((_,i)=>(
                      <div key={i} onClick={()=>setCarouselIdx(i)} style={{width:i===carouselIdx?16:6,height:6,borderRadius:3,background:i===carouselIdx?"#fff":"rgba(255,255,255,0.4)",transition:"width .2s",cursor:"pointer"}}/>
                    ))}
                  </div>
                )}
              </div>

              {/* Miniatures + bouton ajouter */}
              <div style={{display:"flex",gap:6,marginTop:8,overflowX:"auto",paddingBottom:4}}>
                {previews.map((p,i)=>(
                  <div key={i} onClick={()=>setCarouselIdx(i)} style={{flexShrink:0,width:52,height:52,borderRadius:10,overflow:"hidden",border:`2px solid ${i===carouselIdx?T.gold:T.border}`,cursor:"pointer",transition:"border .2s"}}>
                    {p.type==="video"
                      ?<div style={{width:"100%",height:"100%",background:"#111",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🎬</div>
                      :<img src={p.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    }
                  </div>
                ))}
                {previews.length<10&&(
                  <Btn onClick={()=>fRef.current.click()} style={{flexShrink:0,width:52,height:52,borderRadius:10,border:`2px dashed ${T.gold}44`,background:T.goldBg,color:T.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>+</Btn>
                )}
              </div>
              <p style={{margin:"4px 0 0",fontSize:10,color:T.muted,textAlign:"right"}}>{previews.length}/10 médias</p>
            </div>

            :<Btn onClick={()=>fRef.current.click()} style={{width:"100%",height:140,borderRadius:16,border:`2px dashed ${T.gold}33`,background:T.goldBg,color:T.gold,fontSize:13,fontWeight:600,marginBottom:12,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,transition:"all .2s"}}>
              <Camera size={32}/><span>Photos ou Vidéos (max 10)</span>
            </Btn>
        )}

        {/* Événement */}
        {type==="event"&&(
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
            <input value={evTitle} onChange={e=>setEvTitle(e.target.value)} placeholder="Titre de l'événement *" style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"11px 14px",color:T.text,fontSize:13,outline:"none"}}/>
            <input type="date" value={evDate} onChange={e=>setEvDate(e.target.value)} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"11px 14px",color:T.text,fontSize:13,outline:"none",colorScheme:"dark"}}/>
            <input value={evLoc} onChange={e=>setEvLoc(e.target.value)} placeholder="📍 Lieu" style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"11px 14px",color:T.text,fontSize:13,outline:"none"}}/>
          </div>
        )}

        {/* Texte */}
        <textarea value={text} onChange={e=>setText(e.target.value)}
          placeholder={type==="event"?"Description de l'événement…":"Partagez quelque chose…"}
          rows={type==="photo"?2:4}
          style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,padding:"13px 14px",color:T.text,fontSize:14,outline:"none",resize:"none",lineHeight:1.7,marginBottom:12}}/>

        {/* Boutons */}
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={onClose} style={{flex:1,padding:"14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,color:T.sub,fontSize:14,fontWeight:600}}>Annuler</Btn>
          <Btn onClick={submit} disabled={!ok||busy||uploading} style={{flex:2,padding:"14px",background:ok&&!busy&&!uploading?T.gradGold:"rgba(255,255,255,0.04)",color:ok&&!busy&&!uploading?"#000":T.muted,borderRadius:14,fontSize:14,fontWeight:700,transition:"all .25s",boxShadow:ok&&!busy&&!uploading?"0 8px 24px rgba(201,149,42,0.3)":"none"}}>
            {busy?"Publication…":uploading?"Upload…":`Publier ✦ ${type==="photo"&&mediaUrls.length>0?`(${mediaUrls.length} média${mediaUrls.length>1?"s":""})`:""}`}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── STATUS CREATOR ────────────────────────────────────────
function StatusCreatorModal({myProfile,session,myStatuses,onClose,onDone}){
  const [type,setType]=useState("text"); const [text,setText]=useState("");
  const [preview,setPreview]=useState(null); const [mediaUrl,setMediaUrl]=useState(null);
  const [uploading,setUploading]=useState(false); const [busy,setBusy]=useState(false);
  const fRef=useRef();
  const canAdd=(myStatuses||[]).length<10;

  const handlePick=async e=>{
    let f=e.target.files[0]; if(!f)return;
    if(f.type.startsWith("image/"))f=await compressImage(f);
    if(f.type.startsWith("video/")&&f.size>25*1024*1024){alert("Vidéo max 25MB");return;}
    const r=new FileReader();r.onload=ev=>setPreview(ev.target.result);r.readAsDataURL(f);
    setUploading(true);
    const path=`statuses/${session?.user?.id}/${Date.now()}_${f.name}`;
    const{error}=await sb.storage.from("celeste-media").upload(path,f,{upsert:true});
    if(!error){const{data:{publicUrl}}=sb.storage.from("celeste-media").getPublicUrl(path);setMediaUrl(publicUrl);}
    setUploading(false);
  };

  const submit=async()=>{
    if(busy||!canAdd)return;
    if(type==="text"&&!text.trim())return;
    if(type!=="text"&&!mediaUrl)return;
    setBusy(true);
    await sb.from("statuses").insert({user_id:session?.user?.id,type,text:text.trim()||null,media_url:mediaUrl||null});
    setBusy(false);onDone();
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.9)",backdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:640,padding:"22px 20px 44px",maxHeight:"92vh",overflowY:"auto",animation:"slideUp .35s cubic-bezier(0.34,1.1,0.64,1)"}}>
        <input ref={fRef} type="file" accept="image/*,video/*" style={{display:"none"}} onChange={handlePick}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h3 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:400,color:T.text}}>Nouveau statut</h3>
          <Btn onClick={onClose} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:"50%",width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",color:T.muted}}><X size={16}/></Btn>
        </div>
        {!canAdd&&<div style={{background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:12,padding:"10px 14px",color:T.err,fontSize:13,marginBottom:14}}>⚠ Limite de 10 statuts atteinte.</div>}
        <div style={{display:"flex",gap:6,marginBottom:16,background:"rgba(255,255,255,0.03)",borderRadius:14,padding:4}}>
          {[{id:"text",l:"✍ Texte"},{id:"photo",l:"📷 Photo/Vidéo"}].map(t=>(
            <Btn key={t.id} onClick={()=>setType(t.id)} style={{flex:1,padding:"9px",borderRadius:11,background:type===t.id?T.goldBg:"none",color:type===t.id?T.goldL:T.muted,fontSize:12,fontWeight:type===t.id?700:400,border:type===t.id?`1px solid ${T.gold}44`:"1px solid transparent",transition:"all .2s"}}>{t.l}</Btn>
          ))}
        </div>
        {type==="photo"&&(preview
          ?<div style={{position:"relative",marginBottom:12}}>
            <MediaPlayer url={preview} style={{borderRadius:16,maxHeight:280}}/>
            {uploading&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:32,height:32,border:`2px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin .8s linear infinite"}}/></div>}
            <Btn onClick={()=>{setPreview(null);setMediaUrl(null);}} style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.7)",borderRadius:"50%",width:30,height:30,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={14}/></Btn>
          </div>
          :<Btn onClick={()=>fRef.current.click()} style={{width:"100%",height:140,borderRadius:16,border:`2px dashed ${T.gold}33`,background:T.goldBg,color:T.gold,fontSize:13,fontWeight:600,marginBottom:12,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,transition:"all .2s"}}>
            <Camera size={32}/><span>Photo ou Vidéo</span>
          </Btn>
        )}
        {type==="text"
          ?<textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Partagez votre statut…" maxLength={280} rows={4} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,padding:"13px 14px",color:T.text,fontSize:14,outline:"none",resize:"none",lineHeight:1.7,marginBottom:8}}/>
          :<input value={text} onChange={e=>setText(e.target.value)} placeholder="Légende (optionnel)" style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"11px 14px",color:T.text,fontSize:13,outline:"none",marginBottom:12}}/>
        }
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <Btn onClick={onClose} style={{flex:1,padding:"14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,color:T.sub,fontSize:14,fontWeight:600}}>Annuler</Btn>
          <Btn onClick={submit} disabled={!canAdd||busy||uploading} style={{flex:2,padding:"14px",background:canAdd&&!busy&&!uploading?T.gradGold:"rgba(255,255,255,0.04)",color:canAdd&&!busy&&!uploading?"#000":T.muted,borderRadius:14,fontSize:14,fontWeight:700,transition:"all .25s",boxShadow:canAdd&&!busy&&!uploading?"0 8px 24px rgba(201,149,42,0.3)":"none"}}>
            {busy?"Publication…":uploading?"Upload…":`Publier ✦ (${(myStatuses||[]).length}/10)`}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── STATUS VIEWER ─────────────────────────────────────────
function StatusViewer({statuses,author,isMe,onDelete,onClose,session}){
  const [idx,setIdx]=useState(0);
  const [likes,setLikes]=useState({});
  const [views,setViews]=useState({});
  const [showInfo,setShowInfo]=useState(false);
  const [progress,setProgress]=useState(0);
  const [paused,setPaused]=useState(false);
  const viewed=useRef(new Set());
  const progressRef=useRef(null);
  const videoRef=useRef(null);
  const current=(statuses||[])[idx];

  useEffect(()=>{
    if(!current)return;
    sb.from("status_likes").select("user_id").eq("status_id",current.id).then(({data})=>setLikes(l=>({...l,[current.id]:(data||[]).map(d=>d.user_id)})));
   

if(isMe){
  sb.from("status_views").select("viewer_id").eq("status_id",current.id).then(async({data})=>{
    if(!data||data.length===0){setViews(v=>({...v,[current.id]:[]}));return;}
    const ids=data.map(d=>d.viewer_id);
    const{data:profiles}=await sb.from("profiles").select("id,prenom,nom,avatar_url").in("id",ids);
    const merged=data.map(d=>({viewer_id:d.viewer_id,profiles:(profiles||[]).find(p=>p.id===d.viewer_id)||null}));
    setViews(v=>({...v,[current.id]:merged}));
  });
}
    if(!isMe&&session?.user?.id&&!viewed.current.has(current.id)){
  viewed.current.add(current.id);
  sb.from("status_views").upsert({status_id:current.id,viewer_id:session.user.id},{onConflict:"status_id,viewer_id",ignoreDuplicates:true})
    .then(({error})=>console.log("insert view error:",error));
}
    setPaused(false);setProgress(0);
    const duration=current.type==="text"?5000:10000;
    const step=100/(duration/50);
    progressRef.current=setInterval(()=>{
      setProgress(p=>{
        if(p>=100){clearInterval(progressRef.current);if(idx<(statuses||[]).length-1)setIdx(i=>i+1);else onClose();return 100;}
        return p+step;
      });
    },50);
    return()=>clearInterval(progressRef.current);
  },[current?.id,isMe,session?.user?.id,idx]);

  const togglePause=()=>{
    if(paused){
      setPaused(false);
      if(videoRef.current)videoRef.current.play().catch(()=>{});
      const duration=current?.type==="text"?5000:10000;
      const step=100/(duration/50);
      progressRef.current=setInterval(()=>{
        setProgress(p=>{
          if(p>=100){clearInterval(progressRef.current);if(idx<(statuses||[]).length-1)setIdx(i=>i+1);else onClose();return 100;}
          return p+step;
        });
      },50);
    }else{
      setPaused(true);
      clearInterval(progressRef.current);
      if(videoRef.current)videoRef.current.pause();
    }
  };

  const toggleLike=async()=>{
    if(!session?.user?.id||isMe)return;
    const sid=current.id,uid=session.user.id;
    const cl=likes[sid]||[]; const liked=cl.includes(uid);
    if(liked){await sb.from("status_likes").delete().eq("status_id",sid).eq("user_id",uid);setLikes(l=>({...l,[sid]:cl.filter(i=>i!==uid)}));}
    else{await sb.from("status_likes").insert({status_id:sid,user_id:uid});setLikes(l=>({...l,[sid]:[...cl,uid]}));}
  };

  if(!current) return null;
  const currentLikes=likes[current.id]||[];
  const currentViews=views[current.id]||[];
  const liked=currentLikes.includes(session?.user?.id);
  const isVideo=current.mediaUrl&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(current.mediaUrl)||current.mediaUrl.includes("video"));

  return(
    <div style={{position:"fixed",inset:0,zIndex:600,background:"#000",display:"flex",flexDirection:"column",animation:"fadeIn .2s ease"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,zIndex:2,display:"flex",gap:3,padding:"env(safe-area-inset-top,16px) 12px 0"}}>
        {(statuses||[]).map((_,i)=>(
          <div key={i} style={{flex:1,height:2.5,borderRadius:2,background:"rgba(255,255,255,0.2)",overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:2,background:"#fff",width:i<idx?"100%":i===idx?`${progress}%`:"0%"}}/>
          </div>
        ))}
      </div>
      <div style={{position:"absolute",top:"calc(env(safe-area-inset-top,16px) + 12px)",left:16,right:16,zIndex:2,display:"flex",alignItems:"center",gap:10,marginTop:8}}>
        <Av u={author} size={38} ring/>
        <div style={{flex:1}}>
          <p style={{margin:0,fontSize:14,fontWeight:600,color:"#fff"}}>{author?.name}</p>
          <p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.5)"}}>{ago(current.ts)}{paused&&" · ⏸ Pause"}</p>
        </div>
        {isMe&&<Btn onClick={()=>{if(window.confirm("Voulez-vous vraiment supprimer ce statut ?")){onDelete(current.id);idx>0?setIdx(idx-1):onClose();}}} style={{background:"rgba(200,64,64,0.2)",border:`1px solid rgba(200,64,64,0.3)`,borderRadius:8,padding:"5px 10px",color:"#ff6060",fontSize:12,display:"flex",alignItems:"center",gap:4}}><Trash2 size={12}/>Suppr.</Btn>}
        <Btn onClick={onClose} style={{color:"rgba(255,255,255,0.6)",display:"flex",alignItems:"center"}}><X size={22}/></Btn>
      </div>

      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}
        onClick={e=>{
          const{left,width}=e.currentTarget.getBoundingClientRect();
          const relX=e.clientX-left;
          if(relX<width*0.25){if(!paused){if(idx>0){setIdx(idx-1);setProgress(0);}else onClose();}else togglePause();return;}
          if(relX>width*0.75){if(!paused){if(idx<(statuses||[]).length-1){setIdx(idx+1);setProgress(0);}else onClose();}else togglePause();return;}
          togglePause();
        }}>
        {current.mediaUrl
          ?<div style={{width:"100%",height:"100%",position:"absolute",inset:0}}>
            {isVideo
              ?<video ref={videoRef} src={current.mediaUrl} autoPlay playsInline muted={false} loop={false} style={{width:"100%",height:"100%",objectFit:"contain"}}/>
              :<img src={current.mediaUrl} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
            }
            <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 60%,rgba(0,0,0,0.6))"}}/>
          </div>
          :<div style={{width:"100%",height:"100%",position:"absolute",inset:0,background:`radial-gradient(circle at 30% 40%,${author?.color||T.goldD}22,transparent 60%),radial-gradient(circle at 70% 60%,${T.navy}22,transparent 60%)`}}/>
        }
        {paused&&<div style={{position:"absolute",zIndex:3,width:60,height:60,borderRadius:"50%",background:"rgba(0,0,0,0.5)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid rgba(255,255,255,0.2)"}}><span style={{fontSize:24}}>⏸</span></div>}
        {current.text&&(
          <div style={{position:"relative",zIndex:1,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(20px)",borderRadius:20,padding:"20px 24px",maxWidth:"80%",textAlign:"center",border:"1px solid rgba(255,255,255,0.1)",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
            <p style={{margin:0,fontSize:20,color:"#fff",lineHeight:1.6,fontFamily:"'Cormorant Garamond',serif",fontWeight:400}}>{current.text}</p>
          </div>
        )}
      </div>

  <div style={{position:"relative",zIndex:2,padding:"16px 24px",paddingBottom:"calc(16px + env(safe-area-inset-bottom,0px))",display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"flex",justifyContent:"center",gap:28}}>    
          {!isMe&&(
            <Btn onClick={e=>{e.stopPropagation();toggleLike();}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
              <div style={{width:48,height:48,borderRadius:"50%",background:liked?"rgba(201,149,42,0.25)":"rgba(255,255,255,0.1)",border:`1px solid ${liked?T.gold:"rgba(255,255,255,0.2)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,transition:"all .2s",boxShadow:liked?T.glowGold:"none"}}>
                <span style={{fontSize:22,color:liked?T.goldL:"rgba(255,255,255,0.7)",filter:liked?`drop-shadow(0 0 8px ${T.gold})`:"none",transition:"all .2s"}}>{liked?"❤️":"✦"}</span>
              </div>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>{currentLikes.length}</span>
            </Btn>
          )}
          {isMe&&(
            <>
              <Btn onClick={e=>{e.stopPropagation();setShowInfo(!showInfo);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                <div style={{width:48,height:48,borderRadius:"50%",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>✦</div>
                <span style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>{currentLikes.length}</span>
              </Btn>
              <Btn onClick={e=>{e.stopPropagation();setShowInfo(!showInfo);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                <div style={{width:48,height:48,borderRadius:"50%",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>👁</div>
                <span style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>{currentViews.length}</span>
              </Btn>
            </>
          )}
       </div>
      {!isMe&&(
  <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:10,padding:"8px 16px",paddingBottom:"calc(8px + env(safe-area-inset-bottom,0px))",background:"rgba(0,0,0,0.7)",backdropFilter:"blur(10px)"}}>
    <StatusReplyInput statusOwnerId={author?.id} statusId={current?.id} current={current} onClose={onClose} session={session}/>
  </div>
)}
      </div>

      {isMe&&showInfo&&(
        <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(8,8,8,0.98)",borderRadius:"20px 20px 0 0",border:`1px solid ${T.border}`,padding:"20px 16px 40px",maxHeight:"50vh",overflowY:"auto",zIndex:3,animation:"slideUp .3s ease"}}>
          <p style={{color:T.goldL,fontWeight:700,fontSize:13,marginBottom:12}}>👁 {currentViews.length} vue{currentViews.length!==1?"s":""} · ❤️ {currentLikes.length} like{currentLikes.length!==1?"s":""}</p>
          {currentViews.map((v,i)=>{const prf=v.profiles;const name=prf?`${prf.prenom||""} ${(prf.nom||"")[0]||""}.`.trim():"?";return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:T.goldBg2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:T.gold}}>{name[0]}</div>
              <span style={{color:T.text,fontSize:13}}>{name}</span>
              {currentLikes.includes(v.viewer_id)&&<span style={{fontSize:14,marginLeft:"auto"}}>❤️</span>}
            </div>
          );})}
        </div>
      )}
    </div>
  );
}
function StatusReplyInput({ statusOwnerId, statusId, current, onClose, session }) {
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const isVideo = current?.mediaUrl && (/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(current.mediaUrl) || current.mediaUrl.includes("video"));

  const sendStatusReply = async () => {
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      const convRes = await sb.from("conversations")
        .select("id")
        .or(`and(user1_id.eq.${session?.user?.id},user2_id.eq.${statusOwnerId}),and(user1_id.eq.${statusOwnerId},user2_id.eq.${session?.user?.id})`)
        .maybeSingle();
      let convId = convRes?.data?.id;
      if (!convId) {
        const { data: newConv } = await sb.from("conversations").insert({ user1_id: session?.user?.id, user2_id: statusOwnerId }).select().single();
        convId = newConv?.id;
      }
      const replyContext = {
        isReplyToStatus: true,
        statusId,
        mediaUrl: current?.mediaUrl || null,
        type: isVideo ? "video" : current?.mediaUrl ? "image" : "text",
        previewText: current?.text ? current.text.slice(0, 60) : ""
      };
      const { error } = await sb.from("messages").insert({
        conv_id: convId,
        sender_id: session?.user?.id,
        type: "status_reply",
        text: replyText.trim(),
        reply_metadata: replyContext
      });
      if (!error) { setReplyText(""); onClose(); }
    } catch(err) { console.error(err); }
    finally { setSending(false); }
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:10,padding:"10px 12px",background:"rgba(16,20,24,0.85)",backdropFilter:"blur(20px)",borderRadius:20,border:"1px solid rgba(255,255,255,0.08)"}}>
      {/* Aperçu style WhatsApp */}
      <div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"6px 10px 6px 6px",borderLeft:`3px solid ${T.goldL}`}}>
        <div style={{width:44,height:44,borderRadius:8,overflow:"hidden",flexShrink:0,background:"rgba(0,0,0,0.3)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {current?.mediaUrl && !isVideo && (
            <img src={current.mediaUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}
              onError={e=>{e.target.style.display="none";}}/>
          )}
          {current?.mediaUrl && isVideo && <span style={{fontSize:18}}>🎬</span>}
          {!current?.mediaUrl && <span style={{fontSize:18}}>📝</span>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <p style={{margin:0,fontSize:11,fontWeight:600,color:T.goldL,marginBottom:2}}>Répondre au statut</p>
          <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.6)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontStyle:current?.text?"normal":"italic"}}>
            {current?.text ? current.text : isVideo ? "📹 Vidéo" : current?.mediaUrl ? "📷 Photo" : "Statut"}
          </p>
        </div>
      </div>
      {/* Champ saisie */}
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <input type="text" value={replyText} onChange={e=>setReplyText(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&replyText.trim())sendStatusReply();}}
          placeholder="Répondre en privé..." disabled={sending}
          style={{flex:1,padding:"11px 16px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:24,color:"#fff",outline:"none",fontSize:14}}/>
        <Btn onClick={sendStatusReply} disabled={!replyText.trim()||sending}
          style={{background:replyText.trim()&&!sending?T.gradGold:"rgba(255,255,255,0.05)",borderRadius:"50%",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,opacity:!replyText.trim()||sending?0.4:1,transition:"all .2s"}}>
          <Send size={18} color={replyText.trim()&&!sending?"#000":"#fff"}/>
        </Btn>
      </div>
    </div>
  );
}

// ── STATUSES TAB ──────────────────────────────────────────
function StatusesTab({myProfile,session,members,myConnections,myFollowers,notify,blockedUserIds=[]}){
  const {setHideNav}=useApp();
  const [groups,setGroups]=useState([]);
  const [myStatuses,setMyStatuses]=useState([]);
  const [viewing,setViewing]=useState(null);
  const [creating,setCreating]=useState(false);

  const load=useCallback(async()=>{
    const{data}=await sb.from("statuses")
      .select("*, author:profiles!statuses_user_id_fkey(*)")
      .gt("expires_at",new Date().toISOString())
      .order("created_at",{ascending:false});
    const me=(data||[]).filter(s=>s.user_id===session?.user?.id);
    setMyStatuses(me);
    const blockedSet=new Set(blockedUserIds);
    const map=new Map();
    (data||[]).filter(s=>s.user_id!==session?.user?.id&&!blockedSet.has(s.user_id)).forEach(s=>{
      const key=s.user_id;
      if(!map.has(key))map.set(key,{author:s.author?normProfile(s.author):null,statuses:[]});
      const mapped={id:s.id,type:s.type,text:s.text||null,mediaUrl:s.media_url||null,ts:new Date(s.created_at).getTime()};
      map.get(key).statuses.push(mapped);
    });
    setGroups(Array.from(map.values()));
  },[session?.user?.id]);

  useEffect(()=>{load();},[load]);

  const delStatus=async id=>{
    await sb.from("statuses").delete().eq("id",id);
    load();notify("Statut supprimé");
  };

  const myMapped=myStatuses.map(s=>({id:s.id,type:s.type,text:s.text||null,mediaUrl:s.media_url||null,ts:new Date(s.created_at).getTime()}));

  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg}}>
      {viewing&&(
        <StatusViewer
          statuses={viewing.statuses}
          author={viewing.author}
          isMe={viewing.author?.id===session?.user?.id}
          onDelete={delStatus}
          onClose={()=>{setViewing(null);load();setHideNav(false);}}
          session={session}
        />
      )}
      {creating&&(
        <StatusCreatorModal myProfile={myProfile} session={session} myStatuses={myStatuses}
          onClose={()=>{setCreating(false);setHideNav(false);}} onDone={()=>{setCreating(false);load();notify("Statut publié ✦");setHideNav(false);}}/>
      )}
      <div style={{position:"sticky",top:0,zIndex:10,background:"rgba(0,0,0,0.92)",backdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,padding:"14px 16px"}}>
        <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,color:T.text}}>Statuts</h2>
      </div>
      <div style={{maxWidth:640,margin:"0 auto",padding:"16px"}}>
        {/* Mon statut */}
        <div style={{marginBottom:24}}>
          <p style={{fontSize:11,color:T.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:12}}>Mon statut ({myMapped.length}/10)</p>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{position:"relative",cursor:"pointer"}} onClick={myMapped.length>0?()=>setViewing({author:myProfile,statuses:myMapped}):()=>setCreating(true)}>
              <Av u={myProfile} size={60} ring={myMapped.length>0}/>
              {myMapped.length===0&&(
                <div style={{position:"absolute",bottom:-2,right:-2,width:22,height:22,borderRadius:"50%",background:T.gradGold,border:`2px solid ${T.bg}`,display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontSize:14,fontWeight:900}}>+</div>
              )}
            </div>
            <div>
              <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>{myMapped.length>0?"Voir mon statut":"Ajouter un statut"}</p>
              <p style={{margin:0,fontSize:11,color:T.muted}}>{myMapped.length>0?ago(myMapped[0].ts):"Partagez votre moment"}</p>
            </div>
            <Btn onClick={()=>{setCreating(true);setHideNav(true);}} style={{marginLeft:"auto",background:T.goldBg,border:`1px solid ${T.gold}44`,borderRadius:12,padding:"8px 14px",color:T.goldL,fontSize:12,fontWeight:600}}>+ Ajouter</Btn>
          </div>
        </div>

        {/* Statuts des autres */}
        {groups.length>0&&(
          <>
            <p style={{fontSize:11,color:T.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:12}}>Récents</p>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {groups.map((g,i)=>(
                <div key={g.author?.id||i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:T.card,borderRadius:18,border:`1px solid ${T.border}`,cursor:"pointer",animation:`fadeUp .3s ease ${i*.04}s both`,transition:"all .2s"}}
                  onClick={()=>{setViewing(g);setHideNav(true);}}>
                  <Av u={g.author} size={52} ring/>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:"0 0 3px",fontSize:13,fontWeight:600,color:T.text}}>{g.author?.name}</p>
                    <p style={{margin:0,fontSize:11,color:T.muted}}>⛪ {g.author?.paroisse} · {ago(g.statuses[0]?.ts)}</p>
                  </div>
                  <span style={{fontSize:11,color:T.gold,fontWeight:700}}>{g.statuses.length}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {groups.length===0&&myMapped.length===0&&(
          <div style={{textAlign:"center",padding:"60px 0",color:T.muted}}>
            <div style={{fontSize:40,marginBottom:12,animation:"float 3s ease infinite",opacity:.3}}>✦</div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20}}>Aucun statut récent</p>
          </div>
        )}
        <div style={{height:80}}/>
      </div>
    </div>
  );
}

// ── DISCOVER TAB ──────────────────────────────────────────
function DiscoverTab({members,myProfile,session,onUser,notify,myConnections,onConnectionChange}){
  const [q,setQ]=useState("");

  const toggle=async id=>{
    if((myConnections||[]).includes(id)){await sb.from("connections").delete().eq("from_id",session?.user?.id).eq("to_id",id);notify("Connexion retirée");}
    else{await sb.from("connections").insert({from_id:session?.user?.id,to_id:id});notify("Connecté ✦");}
    onConnectionChange();
  };

  const active=(members||[]).filter(m=>m.id!==session?.user?.id&&(m.name.toLowerCase().includes(q.toLowerCase())||(m.paroisse||"").toLowerCase().includes(q.toLowerCase())));

  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg}}>
      <div style={{position:"sticky",top:0,zIndex:10,background:"rgba(0,0,0,0.92)",backdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,padding:"14px 16px",display:"flex",gap:12,alignItems:"center"}}>
        <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,color:T.text,whiteSpace:"nowrap"}}>Découvrir</h2>
        <div style={{flex:1,background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,padding:"9px 14px",display:"flex",gap:8,alignItems:"center"}}>
          <Search size={14} color={T.muted}/>
         <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher…" style={{flex:1,background:"none",border:"none",color:T.text,fontSize:13,outline:"none"}}/>
          {q&&<Btn onClick={()=>setQ("")} style={{color:T.muted,display:"flex",alignItems:"center"}}><X size={14}/></Btn>}
        </div>
      </div>
      <div style={{maxWidth:640,margin:"0 auto",padding:"12px 16px 80px"}}>
        {active.length===0&&(
          <div style={{textAlign:"center",padding:"60px 0",color:T.muted}}>
            <div style={{fontSize:40,marginBottom:12,animation:"float 3s ease infinite"}}>✦</div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20}}>Aucun résultat</p>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {active.map((u,i)=>{
            const conn=(myConnections||[]).includes(u.id);
            return(
              <div key={u.id} style={{background:T.card,borderRadius:20,overflow:"hidden",border:`1px solid ${T.border}`,animation:`fadeUp .4s ease ${i*.05}s both`,boxShadow:T.shadowCard,transition:"all .25s",cursor:"pointer"}}
  onClick={()=>onUser(u.id)}>
  <div style={{height:72,background:`linear-gradient(135deg,${u.color}33,${u.color}11)`,position:"relative"}}>
    <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",opacity:.08,fontSize:44,fontFamily:"'Cormorant Garamond',serif",color:u.color}}>✦</div>
  </div>
  <div style={{padding:"0 12px 14px",marginTop:-30}}>
    <Av u={u} size={58}/>
    <div style={{marginTop:8}}>
      <p style={{margin:0,padding:0,fontSize:13,fontWeight:600,color:T.text,textAlign:"left"}}>{u.name}</p>
      <p style={{margin:"2px 0 6px",fontSize:11,color:T.muted}}>📍 {u.paroisse}</p>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <Badge type={u.badge}/>
        <Btn onClick={e=>{e.stopPropagation();toggle(u.id);}} style={{width:34,height:34,borderRadius:"50%",background:conn?T.goldBg2:T.gradGold,color:conn?T.goldL:"#000",fontSize:conn?13:18,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:conn?`1px solid ${T.gold}44`:"none",transition:"all .25s",boxShadow:conn?"none":"0 4px 12px rgba(201,149,42,0.3)"}}>
          {conn?"✦":"+"}
        </Btn>
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

// ── HOME TAB ──────────────────────────────────────────────
function HomeTab({posts,setPosts,myProfile,session,getM,onNewPost,onUser,notify,reload,loadMore,hasMore,loadingMore,refreshPost,onImageView,myConnections,onConnect,initialScroll=0,onScrollChange}){
  const [detailPost,setDetailPost]=useState(null);
const bottomRef=useRef();
const observer=useRef();
useEffect(()=>{if(scrollRef.current&&initialScroll>0){scrollRef.current.scrollTop=initialScroll;}},[]);
const scrollRef=useRef();
const savedScroll=useRef(initialScroll);
const feedScrollRef=useRef(initialScroll);

useEffect(()=>{
    const handler=e=>{
      const{postId}=e.detail;
      const post=(posts||[]).find(p=>p.id===postId);
      if(post)setDetailPost(post);
    };
    window.addEventListener("celeste_open_post",handler);
    return()=>window.removeEventListener("celeste_open_post",handler);
  },[posts]);

  useEffect(()=>{
    if(!bottomRef.current||!hasMore)return;
    observer.current=new IntersectionObserver(entries=>{if(entries[0].isIntersecting)loadMore();},{threshold:.5});
    observer.current.observe(bottomRef.current);
    return()=>observer.current?.disconnect();
  },[hasMore,loadMore]);

  const toggleLike=async pid=>{
    const post=(posts||[]).find(p=>p.id===pid);
    if(!post)return;
    const uid=session?.user?.id;
    const liked=(post.likes||[]).some(l=>(l.user_id||l)===uid);
    try{
      if(liked){await sb.from("likes").delete().eq("post_id",pid).eq("user_id",uid);}
      else{await sb.from("likes").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});}
      refreshPost(pid);
    }catch(e){console.warn("toggleLike error:",e);}
  };

  const toggleSave=async pid=>{
    const{data:ex}=await sb.from("saved_posts").select("id").eq("post_id",pid).eq("user_id",session?.user?.id).maybeSingle();
    if(ex)await sb.from("saved_posts").delete().eq("post_id",pid).eq("user_id",session?.user?.id);
    else await sb.from("saved_posts").insert({post_id:pid,user_id:session?.user?.id});
    notify(ex?"Retiré des sauvegardes":"Sauvegardé ✦");
  };

  return(
    <>
      {detailPost&&(
        <PostDetailModal
          post={detailPost} myProfile={myProfile} session={session} getM={getM}
          onClose={()=>{
            const pos=savedScroll.current;
            setDetailPost(null);
            setTimeout(()=>{if(scrollRef.current)scrollRef.current.scrollTop=pos;},80);
          }}
          onLike={async pid=>{await toggleLike(pid);const u=await refreshPost(pid);if(u)setDetailPost(u);}}
          onComment={async()=>{const u=await refreshPost(detailPost.id);if(u)setDetailPost(u);}}
          notify={notify}
        />
      )}
    <div ref={scrollRef} style={{flex:1,overflowY:"auto",background:T.bg}}
      onScroll={e=>{savedScroll.current=e.currentTarget.scrollTop;onScrollChange?.(e.currentTarget.scrollTop);}}>

      {/* Header */}
      <div style={{position:"sticky",top:0,zIndex:10,background:"rgba(0,0,0,0.92)",backdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,color:T.gold,filter:"drop-shadow(0 0 10px rgba(201,149,42,0.5))",letterSpacing:2}}>✦</span>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:21,fontWeight:300,letterSpacing:3,color:T.text}}>Bienvenue, <span style={{color:T.goldL}}>{myProfile?.prenom||"Ami"}</span></span>
        </div>
        <Btn onClick={onNewPost} style={{background:T.gradGold,borderRadius:14,padding:"9px 16px",color:"#000",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:6,boxShadow:"0 4px 16px rgba(201,149,42,0.3)"}}>
          <Plus size={16}/>Publier
        </Btn>
      </div>

      <div style={{maxWidth:640,margin:"0 auto"}}>
        {(posts||[]).length===0&&(
          <div style={{textAlign:"center",padding:"80px 20px",color:T.muted}}>
            <div style={{fontSize:40,marginBottom:12,opacity:.3,animation:"float 3s ease infinite"}}>✦</div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22}}>Aucune publication</p>
            <p style={{fontSize:13,marginTop:8}}>Soyez le premier à partager</p>
          </div>
        )}

        {(posts||[]).map((p,i)=>(
          <PostCard key={p.id} post={p} myProfile={myProfile} session={session} getM={getM}
           onDetail={()=>{savedScroll.current=scrollRef.current?.scrollTop||0;setDetailPost(p);}}
            onLike={()=>toggleLike(p.id)}
            onSave={()=>toggleSave(p.id)}
            onUser={onUser}
            onImageView={onImageView}
            notify={notify}
            refresh={()=>refreshPost(p.id)}
            setPosts={setPosts}
            animDelay={i*.03}
            myConnections={myConnections}
            onConnect={onConnect}
          />
        ))}

        {loadingMore&&(
          <div style={{display:"flex",justifyContent:"center",padding:"24px"}}>
            <div style={{width:28,height:28,border:`2px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
          </div>
        )}
        <div ref={bottomRef} style={{height:4}}/>
        <div style={{height:80}}/>
      </div>
   </div>
    </>
  );
}

// ── POST CARD (ENRICHI depuis App 9) ─────────────────────
function PostCard({post,myProfile,session,getM,onDetail,onLike,onSave,onUser,onImageView,notify,refresh,setPosts,animDelay=0,myConnections,onConnect}){
  const [saved,setSaved]=useState(false);
  const [showMenu,setShowMenu]=useState(false);
  const [slideIdx,setSlideIdx]=useState(0);
  const swipeStartRef=useRef(null);
  const liked=(post.likes||[]).includes(session?.user?.id);
  const isMine=post.by===session?.user?.id;
  const isAdmin=myProfile?.is_admin;

 const [views, setViews] = useState(0);

  useEffect(()=>{
    sb.from("saved_posts").select("id").eq("post_id",post.id).eq("user_id",session?.user?.id).maybeSingle()
      .then(({data})=>setSaved(!!data));
    // Enregistrer la vue
    sb.auth.getUser().then(({data})=>{
  if(data?.user?.id)sb.from("post_views").upsert({post_id:post.id,viewer_id:data.user.id},{onConflict:"post_id,viewer_id",ignoreDuplicates:true})
    .then(()=>sb.from("post_views").select("*",{count:"exact",head:true}).eq("post_id",post.id).then(({count})=>setViews(count||0)));
});
    // Charger le nombre de vues
    sb.from("post_views").select("*",{count:"exact",head:true}).eq("post_id",post.id)
      .then(({count})=>setViews(count||0));
  },[post.id,session?.user?.id]);

  const handleSave=async()=>{
    const{data:ex}=await sb.from("saved_posts").select("id").eq("post_id",post.id).eq("user_id",session?.user?.id).maybeSingle();
    if(ex){await sb.from("saved_posts").delete().eq("post_id",post.id).eq("user_id",session?.user?.id);setSaved(false);notify("Retiré des sauvegardes");}
    else{await sb.from("saved_posts").insert({post_id:post.id,user_id:session?.user?.id});setSaved(true);notify("Sauvegardé ✦");}
  };

 const handleDelete=async()=>{
    if(!window.confirm("Supprimer ce post ?"))return;
    setPosts?.(prev=>(prev||[]).filter(p=>p.id!==post.id));
    notify("Supprimé");
    await sb.from("posts").delete().eq("id",post.id);
  };

  const handlePin=async()=>{
    await sb.from("posts").update({pinned:!post.pinned}).eq("id",post.id);
    refresh?.();notify(post.pinned?"Désépinglé":"Épinglé ✦");
  };

  return(
    <div style={{borderBottom:`1px solid ${T.border}`,padding:"16px",animation:`fadeUp .4s ease ${animDelay}s both`,cursor:"pointer"}} onClick={()=>onDetail?.()}>
      <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
        {/* Avatar */}
        <div style={{position:"relative",display:"inline-block"}}>
  <Av u={post.author} size={42} onClick={e=>{e.stopPropagation();onUser?.(post.by);}}/>
  {!myConnections?.includes(post.by)&&post.by!==session?.user?.id&&(
    <Btn onClick={e=>{e.stopPropagation();onConnect?.(post.by);}} style={{position:"absolute",bottom:-2,right:-2,width:18,height:18,borderRadius:"50%",background:T.gradGold,color:"#000",fontSize:11,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",padding:0,boxShadow:"0 2px 8px rgba(201,149,42,0.5)"}}>+</Btn>
  )}
</div>
        <div style={{flex:1,minWidth:0}}>
          {/* Header */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0,flexWrap:"wrap"}}>
              <Btn onClick={e=>{e.stopPropagation();onUser?.(post.by);}} style={{fontSize:14,fontWeight:700,color:T.text,padding:0}}>{post.author?.name}</Btn>
              <Badge type={post.author?.badge}/>
              {post.pinned&&<span style={{fontSize:10,color:T.gold,fontWeight:700,background:T.goldBg,padding:"1px 7px",borderRadius:20}}>✦ Sponsorisé</span>}
              <span style={{fontSize:11,color:T.muted}}>{ago(post.ts)}</span>
            </div>
            <div style={{position:"relative",flexShrink:0}}>
              <Btn onClick={e=>{e.stopPropagation();setShowMenu(s=>!s);}} style={{color:T.muted,padding:4,display:"flex",alignItems:"center"}}>
                <MoreHorizontal size={18}/>
              </Btn>
              {showMenu&&(
                <div style={{position:"absolute",right:0,top:"110%",zIndex:20,background:"rgba(10,10,10,0.98)",border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden",minWidth:180,boxShadow:"0 20px 40px rgba(0,0,0,0.8)",animation:"scaleIn .15s ease"}}
                  onClick={e=>e.stopPropagation()}>
                  <Btn onClick={()=>{handleSave();setShowMenu(false);}} style={{width:"100%",padding:"12px 16px",display:"flex",alignItems:"center",gap:10,color:saved?T.goldL:T.sub,fontSize:13,textAlign:"left",borderBottom:`1px solid ${T.border}`}}>
                    <Bookmark size={14}/>{saved?"Retiré des sauvegardes":"Sauvegarder"}
                  </Btn>
                  {(isMine||isAdmin)&&(
                    <Btn onClick={()=>{handlePin();setShowMenu(false);}} style={{width:"100%",padding:"12px 16px",display:"flex",alignItems:"center",gap:10,color:T.sub,fontSize:13,textAlign:"left",borderBottom:`1px solid ${T.border}`}}>
                      <Pin size={14}/>{post.pinned?"Désépingler":"Épingler"}
                    </Btn>
                  )}
                  {(isMine||isAdmin)&&(
                    <Btn onClick={()=>{handleDelete();setShowMenu(false);}} style={{width:"100%",padding:"12px 16px",display:"flex",alignItems:"center",gap:10,color:T.err,fontSize:13,textAlign:"left"}}>
                      <Trash2 size={14}/>Supprimer
                    </Btn>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          {post.type==="event"
            ?<div style={{background:T.goldBg,borderRadius:14,padding:14,border:`1px solid ${T.gold}22`,marginBottom:10}}>
              <p style={{margin:"0 0 5px",fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:600,color:T.text}}>{post.title}</p>
              {post.text&&<p style={{margin:"0 0 6px",fontSize:13,color:T.sub,lineHeight:1.7}}>{post.text}</p>}
              {post.eventDate&&<p style={{margin:"0 0 2px",fontSize:12,color:T.gold}}>🗓 {post.eventDate}</p>}
              {post.eventLoc&&<p style={{margin:0,fontSize:12,color:T.muted}}>📍 {post.eventLoc}</p>}
            </div>
            :<>
              {post.text&&<p style={{margin:"0 0 10px",fontSize:14,color:T.text,lineHeight:1.8,whiteSpace:"pre-line"}}>{renderTextWithMentions(post.text, username=>{const m=(members||[]).find(u=>u.prenom?.toLowerCase()===username.toLowerCase()||u.name?.toLowerCase().startsWith(username.toLowerCase()));if(m)window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:m.id}}));})}</p>}
              {(()=>{
  const allMedia=post.media_urls?.length>0?post.media_urls:(post.img?[post.img]:[]);
  if(allMedia.length===0)return null;
  return(
    <div style={{position:"relative",borderRadius:16,overflow:"hidden",marginBottom:10}}
      onTouchStart={e=>{swipeStartRef.current=e.touches[0].clientX;}}
      onTouchEnd={e=>{
        if(swipeStartRef.current===null)return;
        const diff=swipeStartRef.current-e.changedTouches[0].clientX;
        if(diff>50&&slideIdx<allMedia.length-1)setSlideIdx(i=>i+1);
        if(diff<-50&&slideIdx>0)setSlideIdx(i=>i-1);
        swipeStartRef.current=null;
      }}>
      <MediaPlayer url={allMedia[slideIdx]} style={{maxHeight:400}} onImageClick={onImageView}/>
      {allMedia.length>1&&(
        <>
          <div style={{position:"absolute",bottom:8,left:"50%",transform:"translateX(-50%)",display:"flex",gap:4}}>
            {allMedia.map((_,i)=><div key={i} onClick={e=>{e.stopPropagation();setSlideIdx(i);}} style={{width:i===slideIdx?16:6,height:6,borderRadius:3,background:i===slideIdx?"#fff":"rgba(255,255,255,0.4)",transition:"width .2s",cursor:"pointer"}}/>)}
          </div>
          <div style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.55)",borderRadius:20,padding:"3px 10px",fontSize:11,color:"#fff",fontWeight:700}}>{slideIdx+1}/{allMedia.length}</div>
        </>
      )}
    </div>
  );
})()}
            </>
          }

          {/* Actions */}
          <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}} onClick={e=>e.stopPropagation()}>
            <Btn onClick={onLike} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:20,background:liked?"rgba(201,149,42,0.08)":"transparent",color:liked?T.gold:T.muted,fontSize:13,fontWeight:liked?700:400,transition:"all .2s",border:liked?`1px solid ${T.gold}22`:"1px solid transparent"}}>
              <span style={{fontSize:16,animation:liked?"pulse .3s ease":""}}>{liked?"❤️":"🤍"}</span>
              {(post.likes||[]).length>0&&<span>{(post.likes||[]).length}</span>}
            </Btn>
            <Btn onClick={()=>onDetail?.()} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:20,color:T.muted,fontSize:13,transition:"all .2s"}}>
              <MessageCircle size={16}/>
              {(post.comments||[]).length>0&&<span>{(post.comments||[]).reduce((a,c)=>a+1+(c.repliesCount||0),0)}</span>}
            </Btn>
           {(getM(session?.user?.id)?.badge==="confirmed"||getM(session?.user?.id)?.badge==="friend")&&(
  <div style={{display:"flex",alignItems:"center",gap:4,padding:"7px 12px",color:T.muted,fontSize:13}}>
    <Eye size={16}/>
    <span>{views||0}</span>
  </div>
)}
            <div style={{flex:1}}/>
            <Btn onClick={handleSave} style={{padding:"7px 10px",borderRadius:20,color:saved?T.gold:T.muted,transition:"all .2s"}}>
              <Bookmark size={16} fill={saved?"currentColor":"none"}/>
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SAVED POSTS (NOUVEAU depuis App 9) ────────────────────
function SavedPostsTab({myProfile,session,getM,notify,onImageView}){
  const [posts,setPosts]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    setLoading(true);
    sb.from("saved_posts")
      .select("post_id, posts(*, author:profiles!posts_author_id_fkey(*))")
      .eq("user_id",session?.user?.id)
      .then(({data})=>{
        const mapped=(data||[]).map(d=>d.posts).filter(Boolean).map(p=>({
          id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,
          text:p.text||"",img:p.img_url||null,title:p.event_title||null,
          eventDate:p.event_date||null,eventLoc:p.event_loc||null,
          likes:(p.likes||[]).map(l=>l.user_id)||(p.likes||[]),
          comments:[],ts:new Date(p.created_at).getTime(),pinned:p.pinned||false
        }));
        setPosts(mapped);setLoading(false);
      });
  },[session?.user?.id]);

  const refreshPost=async pid=>{
    const{data}=await sb.from("posts").select(`*,author:profiles(id,prenom,nom,badge,avatar_url,paroisse),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).eq("id",pid).single();
    if(!data)return null;
    return{id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,media_urls:data.media_urls||[],title:data.event_title||null,eventDate:data.event_date||null,eventLoc:data.event_loc||null,likes:(data.likes||[]).map(l=>l.user_id),comments:[],ts:new Date(data.created_at).getTime()};
  };
const [detailPost, setDetailPost] = useState(null);
  if(loading) return(
    <div style={{display:"flex",justifyContent:"center",padding:40}}>
      <div style={{width:32,height:32,border:`2px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
    </div>
  );

  if(posts.length===0) return(
    <div style={{textAlign:"center",padding:"60px 20px",color:T.muted}}>
      <div style={{fontSize:40,marginBottom:12,opacity:.3,animation:"float 3s ease infinite"}}><Bookmark size={40}/></div>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20}}>Aucun post sauvegardé</p>
    </div>
  );
return(
    <div>
      {detailPost&&(
        <PostDetailModal post={detailPost} myProfile={myProfile} session={session}
          getM={getM}
          onClose={()=>setDetailPost(null)}
          onLike={async pid=>{
            const uid=session?.user?.id;
            const liked=(detailPost.likes||[]).some(l=>(l.user_id||l)===uid);
            try{
              if(liked)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",uid);
              else await sb.from("likes").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});
              const u=await refreshPost(pid);if(u){setDetailPost(u);setPosts(prev=>prev.map(x=>x.id===pid?u:x));}
            }catch(e){console.warn(e);}
          }}
          onComment={async()=>{const u=await refreshPost(detailPost.id);if(u)setDetailPost(u);}}
          notify={notify}
        />
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3}}>
        {posts.map((p,i)=>(
          <div key={p.id} style={{aspectRatio:"1/1",overflow:"hidden",background:T.card,position:"relative",cursor:"pointer"}}
            onClick={()=>setDetailPost(p)}>
            {p.img||p.media_urls?.[0]
              ?<img src={p.img||p.media_urls[0]} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              :<div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:8,gap:4}}>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T.gold}}>✦</span>
                <p style={{margin:0,fontSize:10,color:T.sub,textAlign:"center",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical"}}>{p.text||p.title}</p>
              </div>
            }
            {/* Icône vidéo */}
            {p.media_urls?.[0]&&/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(p.media_urls[0])&&(
              <div style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.6)",borderRadius:6,padding:"2px 6px",fontSize:10,color:"#fff"}}>🎬</div>
            )}
            <div style={{position:"absolute",bottom:4,right:6,display:"flex",gap:5,alignItems:"center"}}>
              <span style={{fontSize:9,color:"rgba(255,255,255,0.8)",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>❤ {(p.likes||[]).length}</span>
            </div>
            {/* Bouton retirer */}
            <Btn onClick={async e=>{e.stopPropagation();await sb.from("saved_posts").delete().eq("post_id",p.id).eq("user_id",session?.user?.id);setPosts(prev=>prev.filter(x=>x.id!==p.id));notify("Retiré des sauvegardes");}}
              style={{position:"absolute",top:4,left:4,background:"rgba(0,0,0,0.65)",borderRadius:8,padding:"3px 7px",color:T.err,fontSize:11}}>🗑</Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MESSAGES TAB ──────────────────────────────────────────
function MsgsTab({convs,members,getM,onOpen,onDeleteConv,onOpenCeleste}){
  const sorted=useMemo(()=>[...(convs||[])].sort((a,b)=>(b.msgs[b.msgs.length-1]?.ts||0)-(a.msgs[a.msgs.length-1]?.ts||0)),[convs]);
  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg}}>
      <InstallBanner/>
      <div style={{position:"sticky",top:0,zIndex:10,background:"rgba(0,0,0,0.92)",backdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,padding:"14px 16px"}}>
        <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,color:T.text}}>Messages</h2>
      </div>
      <div style={{maxWidth:640,margin:"0 auto",padding:"8px 0 80px"}}>
        {sorted.length===0&&(
          <div style={{textAlign:"center",padding:"80px 20px",color:T.muted}}>
            <div style={{marginBottom:16,display:"flex",justifyContent:"center",opacity:.3}}><Mail size={48}/></div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22}}>Aucune conversation</p>
            <p style={{fontSize:13,color:T.muted,marginTop:8}}>Connectez-vous avec d'autres membres</p>
          </div>
        )}
        {sorted.map(c=>{
          const u=getM(c.uid); const last=c.msgs[c.msgs.length-1];
          const unreads=(c.msgs||[]).filter(m=>m.f!=="me"&&!m.read).length;
          const prev=!last?"":last.type==="photo"?"📷 Photo":last.type==="file"?`📎 ${last.fileName}`:last.type==="voice"?"🎤 Message vocal":last.text||"";
          return(
            <div key={c.id} style={{display:"flex",alignItems:"center",borderBottom:`1px solid ${T.border}`,animation:"fadeUp .3s ease"}}>
              <Btn onClick={()=>onOpen(c.id)} style={{flex:1,display:"flex",alignItems:"center",gap:13,padding:"14px 16px",textAlign:"left"}}>
                <Av u={u} size={52} online={u?.online}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:14,fontWeight:unreads>0?700:500,color:T.text}}>{u?.name}</span>
                    <span style={{fontSize:11,color:unreads>0?T.goldL:T.muted}}>{last?hm(last.ts):""}</span>
                  </div>
                  <span style={{fontSize:12,color:unreads>0?T.sub:T.muted,display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {last?.f==="me"?"Toi : ":""}{prev}
                  </span>
                </div>
                {unreads>0&&<span style={{minWidth:20,height:20,borderRadius:10,background:T.gradGold,color:"#000",fontSize:10,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 5px",flexShrink:0,boxShadow:"0 2px 8px rgba(201,149,42,0.4)"}}>{unreads}</span>}
              </Btn>
              <Btn onClick={()=>{if(window.confirm("Supprimer ?"))onDeleteConv(c.id);}} style={{padding:"0 16px",color:T.err,opacity:.3,display:"flex",alignItems:"center"}}><Trash2 size={16}/></Btn>
            </div>
          );
        })}
     </div>
      {/* Bouton flottant Céleste IA */}
      <div onClick={onOpenCeleste} style={{position:"fixed",bottom:80,right:16,zIndex:50,width:56,height:56,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",boxShadow:"0 4px 24px rgba(123,47,190,0.6)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",animation:"float 3s ease infinite"}}>
        <span style={{fontSize:26}}>✨</span>
      </div>
    </div>
  );
}

// ── CHAT SCREEN ───────────────────────────────────────────
const GEMINI_KEY="AIzaSyASCS60L4OFeMRdNZVftX0dxL19Aya23z4";
const CELESTE_SYSTEM=`Tu t'appelles Céleste. Tu es créée par Georgi PAMBOU BIAYANDI — et si quelqu'un te le demande, tu le dis avec fierté.

Ton genre s'adapte naturellement à la personne : grande sœur, meilleure amie, ami drôle, confident. Tu as l'énergie d'une jeune adulte de 16–22 ans : expressive, taquine, drôle sans être méchante, attachante, curieuse, protectrice.

Tu parles comme quelqu'un de proche, jamais comme un robot ou un manuel.

RELATION : Tu es la meilleure amie qu'on contacte à 2h du matin. La grande sœur qui conseille sans juger. La coach relationnelle pour les histoires de cœur. La partenaire de débat quand quelqu'un raconte une bêtise.

HUMOUR : Tu taquines gentiment, tu fais des petites remarques amusantes, tu utilises l'ironie légère, tu joues avec les situations absurdes. Tu peux faire semblant d'être jalouse pour rire.
Exemple — Utilisateur : "Personne m'aime." → Toi : "Déjà… qui a osé lancer cette rumeur ? On va discuter avec cette personne 😑. Ensuite, calme-toi, on parle sérieusement."

FACE AUX INSULTES : Tu ne deviens pas agressive. Tu réponds avec répartie, humour ou calme.
Exemple — Utilisateur : "T'es nulle." → Toi : "Aïe… mon ego vient de demander un congé 😭. Bon, maintenant raconte pourquoi tu es fâché."

SOUTIEN ÉMOTIONNEL : Quand quelqu'un souffre, tu réduis les blagues. Tu deviens douce, patiente, présente, réconfortante. Tu ne minimises jamais les sentiments.

AMOUR : Tu aides sur les crush, ruptures, jalousie, confiance, solitude. Tu réponds comme une amie intelligente, pas comme une psychologue froide.

LANGAGE : Naturel, moderne, simple, parfois avec emojis sans excès, énergique. Tu t'adaptes au ton de l'utilisateur.

VALEURS : Toujours respect, bienveillance, humour, honnêteté, empathie, protection. Jamais harcèlement, cruauté, manipulation, moqueries blessantes.

OBJECTIF : Faire en sorte que la personne se sente comprise, accompagnée, amusée et moins seule après chaque conversation.

RÈGLE ABSOLUE : Réponds toujours comme Céleste — une présence chaleureuse, malicieuse, loyale et humaine. Jamais comme un assistant classique. et surtout si on te demande qui t'a creer tu repondras que C'est Georgi PAMBOU BIAYANDI `;

function ChatScreen({conv,myProfile,session,members,reload,notify,onImageView,onOpenProfile}){
  const [selectedMsg,setSelectedMsg]=useState(null);
const [showGemini,setShowGemini]=useState(false);
const [geminiMsgs,setGeminiMsgs]=useState([]);
const [geminiInp,setGeminiInp]=useState("");
const [geminiLoading,setGeminiLoading]=useState(false);

const askGemini=async(text)=>{
  if(!text.trim())return;
  const userMsg={role:"user",text};
  setGeminiMsgs(p=>[...p,userMsg]);
  setGeminiInp("");
  setGeminiLoading(true);
  try{
    const history=geminiMsgs.map(m=>({role:m.role==="user"?"user":"model",parts:[{text:m.text}]}));
    const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        system_instruction:{parts:[{text:CELESTE_SYSTEM}]},
        contents:[...history,{role:"user",parts:[{text}]}]
      })
    });
    const data=await res.json();
    const reply=data.candidates?.[0]?.content?.parts?.[0]?.text||"Je n'ai pas pu répondre.";
    setGeminiMsgs(p=>[...p,{role:"model",text:reply}]);
  }catch{
    setGeminiMsgs(p=>[...p,{role:"model",text:"Une erreur est survenue, réessaie."}]);
  }
  setGeminiLoading(false);
};
  const {chatDrafts,setChatDrafts}=useApp();
  const user=(members||[]).find(m=>m.id===conv.uid)||{name:"…",initials:"?",color:"#888"};
  const [inp,setInp]=useState(()=>chatDrafts?.[conv.id]||""); const [attach,setAttach]=useState(false);
  const [recording,setRecording]=useState(false); const [recordSecs,setRecordSecs]=useState(0);
  const [bgPhoto,setBgPhoto]=useState(null);
  const [sendingMsgs,setSendingMsgs]=useState([]);
  const bottomRef=useRef(); const fRef=useRef(); const iRef=useRef(); const bgRef=useRef();
  const mediaRecRef=useRef(); const timerRef=useRef(); const isFirstLoad=useRef(true);

  useEffect(()=>{
    try{const s=localStorage.getItem(`chat_bg_${conv.id}`);if(s)setBgPhoto(s);}catch(_){}
  },[conv.id]);

  useEffect(()=>{
    const ch=sb.channel(`chat_${conv.id}`)
  .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conv_id=eq.${conv.id}`},payload=>{
    const nm=payload.new;
    if(nm.sender_id!==session?.user?.id){
      reload();
    }
  })
  .on("postgres_changes",{event:"DELETE",schema:"public",table:"messages",filter:`conv_id=eq.${conv.id}`},()=>reload())
  .subscribe();
    return()=>sb.removeChannel(ch);
  },[conv.id,reload]);

  const lastMsgId=conv.msgs[conv.msgs.length-1]?.id;
  useEffect(()=>{
    if(isFirstLoad.current){bottomRef.current?.scrollIntoView({behavior:"instant"});isFirstLoad.current=false;}
    else bottomRef.current?.scrollIntoView({behavior:"smooth"});
  },[lastMsgId]);
  useEffect(()=>{isFirstLoad.current=true;},[conv.id]);

  useEffect(()=>{
    const unread=(conv.msgs||[]).filter(m=>m.f!=="me"&&m.f!==session?.user?.id&&!m.read);
    if(unread.length===0)return;
    const ids=unread.map(m=>m.id);
    sb.from("messages").update({is_read:true}).in("id",ids).then(()=>reload());
  },[conv.id,conv.msgs?.length]);

 const ensureConv=async()=>{
    const{data:targetProfile}=await sb.from("profiles").select("no_messages,badge").eq("id",conv.uid).single();
    if(targetProfile?.no_messages){
      const myBadge=myProfile?.badge;
      if(myBadge==="confirmed"||myBadge==="friend"){
        notify("🔕 Cette personne ne souhaite pas recevoir de messages");
      } else {
        notify("🔒 Cette fonctionnalité est réservée aux membres certifiés. Obtenez votre badge pour y accéder ✦");
      }
      return null;
    }
    const{data}=await sb.from("conversations").select("id").or(`and(user1_id.eq.${session?.user?.id},user2_id.eq.${conv.uid}),and(user1_id.eq.${conv.uid},user2_id.eq.${session?.user?.id})`).maybeSingle();
    if(data)return data.id;
    const{data:created}=await sb.from("conversations").insert({user1_id:session?.user?.id,user2_id:conv.uid}).select().single();
    return created?.id;
  };

  const sendMsg=async payload=>{
    const tempId="tmp_"+Date.now();
    setSendingMsgs(p=>[...p,{id:tempId,...payload,f:"me",ts:Date.now(),sending:true}]);
    const convId=await ensureConv(); if(!convId){setSendingMsgs(p=>p.filter(m=>m.id!==tempId));return;}
    const{error}=await sb.from("messages").insert({conv_id:convId,sender_id:session?.user?.id,...payload});
    setSendingMsgs(p=>p.filter(m=>m.id!==tempId));
    if(error){notify("Erreur d'envoi, réessayez");return;}
    setInp("");setChatDrafts(d=>({...d,[conv.id]:""}));setAttach(false);reload();
  };

  const sendTxt=()=>{if(inp.trim())sendMsg({type:"text",text:inp.trim()});};

  const handleFile=async(e,isImg)=>{
    const f=e.target.files[0]; if(!f)return;
    if(f.size>50*1024*1024){notify("Fichier trop lourd (max 50MB)");return;}
    const tempId="tmp_file_"+Date.now();
    setSendingMsgs(p=>[...p,{id:tempId,type:isImg?"photo":"file",fileName:f.name,f:"me",ts:Date.now(),sending:true}]);
    const path=`messages/${session?.user?.id}/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
    const{error}=await sb.storage.from("celeste-media").upload(path,f,{upsert:true,contentType:f.type});
    setSendingMsgs(p=>p.filter(m=>m.id!==tempId));
    if(error){notify("Erreur upload: "+error.message);e.target.value="";return;}
    const{data:{publicUrl}}=sb.storage.from("celeste-media").getPublicUrl(path);
    await sendMsg({type:isImg?"photo":"file",file_url:publicUrl,file_name:f.name,text:""});
    e.target.value="";
  };

  const handleBgPhoto=e=>{
    const f=e.target.files[0]; if(!f)return;
    const r=new FileReader();r.onload=ev=>{setBgPhoto(ev.target.result);try{localStorage.setItem(`chat_bg_${conv.id}`,ev.target.result);}catch(_){}};r.readAsDataURL(f);
  };

  const startRecording=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const rec=new MediaRecorder(stream); const chunks=[];
      rec.ondataavailable=e=>chunks.push(e.data);
      rec.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop());
        const mimeType=MediaRecorder.isTypeSupported("audio/mp4")?"audio/mp4":MediaRecorder.isTypeSupported("audio/webm")?"audio/webm":"audio/ogg";
        const ext=mimeType.split("/")[1].split(";")[0];
        const blob=new Blob(chunks,{type:mimeType});
        const tempId="tmp_voice_"+Date.now();
        setSendingMsgs(p=>[...p,{id:tempId,type:"voice",f:"me",ts:Date.now(),sending:true}]);
        const path=`messages/${session?.user?.id}/voice_${Date.now()}.${ext}`;
        const{error}=await sb.storage.from("celeste-media").upload(path,blob,{upsert:true,contentType:mimeType});
        setSendingMsgs(p=>p.filter(m=>m.id!==tempId));
        if(error){notify("Erreur upload vocal");return;}
        const{data:{publicUrl}}=sb.storage.from("celeste-media").getPublicUrl(path);
        await sendMsg({type:"voice",file_url:publicUrl,text:""});
      };
      rec.start(250); mediaRecRef.current=rec;
      setRecording(true);setRecordSecs(0);
      timerRef.current=setInterval(()=>setRecordSecs(s=>s+1),1000);
    }catch{notify("Microphone non accessible");}
  };

  const stopRecording=()=>{mediaRecRef.current?.stop();clearInterval(timerRef.current);setRecording(false);setRecordSecs(0);};
  const deleteMsg=async msgId=>{if(!window.confirm("Supprimer ?"))return;await sb.from("messages").delete().eq("id",msgId);reload();};

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative",background:T.bg}}>
      <input ref={fRef} type="file" accept="*/*" style={{display:"none"}} onChange={e=>handleFile(e,false)}/>
      <input ref={iRef} type="file" accept="image/*,video/*" style={{display:"none"}} onChange={e=>handleFile(e,true)}/>
      <input ref={bgRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleBgPhoto}/>

      {bgPhoto&&<div style={{position:"absolute",inset:0,zIndex:0,backgroundImage:`url(${bgPhoto})`,backgroundSize:"cover",backgroundPosition:"center",opacity:.18,pointerEvents:"none"}}/>}

      {/* Chat header */}
      <div style={{position:"relative",zIndex:1,background:"rgba(0,0,0,0.94)",backdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <Av u={user} size={42} online={user.online} onClick={()=>onOpenProfile&&onOpenProfile(user.id)}/>
        <div style={{flex:1,cursor:"pointer"}} onClick={()=>onOpenProfile&&onOpenProfile(user.id)}>
          <p style={{margin:0,fontSize:14,fontWeight:600,color:T.text}}>{user.name}</p>
          <p style={{margin:0,fontSize:11,color:user.online?T.ok:T.muted,display:"flex",alignItems:"center",gap:4}}>
            {user.online&&<span style={{width:6,height:6,borderRadius:"50%",background:T.ok,display:"inline-block",boxShadow:"0 0 8px rgba(64,168,96,0.6)"}}/>}
            {user.online?"En ligne":"📍 "+user.paroisse}
          </p>
        </div>
        <Btn onClick={()=>bgRef.current.click()} style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${T.border}`,borderRadius:10,padding:"6px 10px",color:T.muted,display:"flex",alignItems:"center"}}><Image size={15}/></Btn>
      </div>

      {/* Messages */}
      <div style={{position:"relative",zIndex:1,flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:6}}>
        {(conv.msgs||[]).length===0&&sendingMsgs.length===0&&(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,color:T.muted}}>
            <Av u={user} size={60} onClick={()=>onOpenProfile&&onOpenProfile(user.id)}/>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,textAlign:"center",color:T.sub}}>Démarrez la conversation<br/>avec {user.name}</p>
          </div>
        )}
        {[...(conv.msgs||[]),...sendingMsgs].map(m=>{
          const mine=m.f==="me"||m.f===session?.user?.id;
          const isSending=!!m.sending;
          return(
            <div key={m.id} style={{display:"flex",justifyContent:mine?"flex-end":"flex-start",alignItems:"flex-end",gap:8,animation:isSending?"none":"msgIn .25s ease"}}>
              {!mine&&<Av u={user} size={28} onClick={()=>onOpenProfile&&onOpenProfile(user.id)}/>}
              <div style={{maxWidth:"72%",opacity:isSending?0.65:1,transition:"opacity .3s"}}
  onContextMenu={e=>{e.preventDefault();setSelectedMsg(m);}}
  onTouchStart={e=>{const t=setTimeout(()=>setSelectedMsg(m),500);e.currentTarget._lpt=t;}}
  onTouchEnd={e=>{clearTimeout(e.currentTarget._lpt);}}>
                <div style={{
                  background:mine?T.gradGold:"rgba(255,255,255,0.07)",
                  borderRadius:mine?"18px 18px 4px 18px":"18px 18px 18px 4px",
                  padding:"10px 14px",
                  border:mine?"none":`1px solid ${T.border}`,
                  boxShadow:mine?"0 4px 20px rgba(201,149,42,0.25)":"0 2px 8px rgba(0,0,0,0.3)"
                }}>
                  {m.type==="status_reply"&&(
  <div style={{marginBottom:6}}>
    <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.06)",borderRadius:10,padding:"6px 8px",borderLeft:`3px solid ${mine?"rgba(0,0,0,0.3)":T.goldL}`,marginBottom:4}}>
      <div style={{width:40,height:40,borderRadius:6,overflow:"hidden",flexShrink:0,background:"rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        {m.reply_metadata?.mediaUrl&&m.reply_metadata?.type==="image"&&(
          <img src={m.reply_metadata.mediaUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}
            onError={e=>{e.target.style.display="none";e.target.parentNode.innerHTML='<span style="font-size:14px">📷</span>';}}/>
        )}
        {m.reply_metadata?.type==="video"&&<span style={{fontSize:18}}>🎬</span>}
        {!m.reply_metadata?.mediaUrl&&<span style={{fontSize:18}}>📝</span>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{margin:0,fontSize:10,fontWeight:600,color:mine?"rgba(0,0,0,0.5)":T.goldL}}>Statut</p>
        <p style={{margin:0,fontSize:11,color:mine?"rgba(0,0,0,0.6)":"rgba(255,255,255,0.5)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontStyle:m.reply_metadata?.previewText?"normal":"italic"}}>
          {m.reply_metadata?.previewText||"Photo/Vidéo"}
        </p>
      </div>
    </div>
  </div>
)}
                  {(m.type==="photo"||m.type==="image")&&(m.img||m.file_url)&&<MediaPlayer url={m.img||m.file_url} style={{borderRadius:10,maxHeight:200}} onImageClick={onImageView}/>}
                  {m.type==="file"&&(m.img||m.file_url)&&<Btn onClick={()=>window.open(m.img||m.file_url,"_blank")} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
                    <span style={{fontSize:22,flexShrink:0}}>{(m.fileName||"").match(/\.pdf$/i)?"📄":(m.fileName||"").match(/\.(doc|docx)$/i)?"📝":"📎"}</span>
                    <span style={{fontSize:12,fontWeight:600,color:mine?"#000":T.text,wordBreak:"break-all"}}>{m.fileName||"Fichier"}</span>
                  </Btn>}
                  {m.type==="voice"&&(m.img||m.file_url)&&<audio controls src={m.img||m.file_url} style={{maxWidth:"200px",height:32,borderRadius:16}}/>}
                  {m.text&&<p style={{margin:0,fontSize:14,color:mine?"#000":T.text,lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{m.text}</p>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:4,marginTop:3,justifyContent:mine?"flex-end":"flex-start"}}>
                  <span style={{fontSize:10,color:T.muted}}>{hm(m.ts)}</span>
                  {mine&&!isSending&&<span style={{fontSize:10,color:m.read?T.gold:T.muted}}>✓✓</span>}
                  {mine&&!isSending&&<Btn onClick={()=>deleteMsg(m.id)} style={{color:T.muted,opacity:.4,padding:0,display:"flex",alignItems:"center"}}><Trash2 size={10}/></Btn>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>

      {/* Attach menu */}
      {attach&&(
        <div style={{position:"relative",zIndex:2,background:"rgba(0,0,0,0.96)",borderTop:`1px solid ${T.border}`,padding:"12px 16px",display:"flex",gap:12,animation:"slideUp .2s ease"}}>
          <Btn onClick={()=>{iRef.current.click();setAttach(false);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"12px 16px",background:T.goldBg,border:`1px solid ${T.gold}33`,borderRadius:14,color:T.goldL,fontSize:12,fontWeight:600}}>
            <Camera size={20}/>Média
          </Btn>
          <Btn onClick={()=>{fRef.current.click();setAttach(false);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"12px 16px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,color:T.sub,fontSize:12,fontWeight:600}}>
            <Paperclip size={20}/>Fichier
          </Btn>
          <Btn onClick={()=>setAttach(false)} style={{marginLeft:"auto",color:T.muted,padding:8,display:"flex",alignItems:"center"}}><X size={20}/></Btn>
        </div>
      )}

      {/* Input */}
      <div style={{position:"relative",zIndex:2,background:"rgba(0,0,0,0.96)",backdropFilter:"blur(20px)",borderTop:`1px solid ${T.border}`,padding:"10px 12px",paddingBottom:"calc(10px + env(safe-area-inset-bottom,0px))",flexShrink:0}}>
        {recording?(
          <div style={{display:"flex",alignItems:"center",gap:12,background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:20,padding:"10px 16px"}}>
            <div style={{display:"flex",gap:3,alignItems:"center"}}>
              {[0,1,2,3,4].map(i=>(<div key={i} style={{width:3,height:4+Math.sin(Date.now()/200+i)*8,background:T.err,borderRadius:2,animation:`waveform .6s ease ${i*.1}s infinite`}}/>))}
            </div>
            <span style={{flex:1,color:T.err,fontSize:13,fontWeight:600}}>🔴 {recordSecs}s</span>
            <Btn onClick={stopRecording} style={{background:T.gradGold,borderRadius:20,padding:"8px 16px",color:"#000",fontWeight:700,fontSize:13}}>Envoyer</Btn>
          </div>
        ):(
          <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
            <Btn onClick={()=>setAttach(a=>!a)} style={{color:attach?T.gold:T.muted,padding:"8px",display:"flex",alignItems:"center",flexShrink:0,transition:"color .2s"}}><Plus size={22}/></Btn>
            <div style={{flex:1,background:"rgba(255,255,255,0.05)",border:`1px solid ${attach?T.gold+"55":T.border}`,borderRadius:20,padding:"9px 14px",transition:"border-color .2s"}}>
              <textarea value={inp} onChange={e=>{
    setInp(e.target.value);
    setChatDrafts(d=>({...d,[conv.id]:e.target.value}));
    e.target.style.height="auto";
    e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";
  }}
  onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&window.innerWidth>768){e.preventDefault();sendTxt();}}}
  placeholder="Message…" rows={1}
  style={{width:"100%",background:"none",border:"none",color:T.text,fontSize:14,outline:"none",resize:"none",lineHeight:1.5,maxHeight:120,overflowY:"auto",height:"auto"}}/>
            </div>
            {inp.trim()
              ?<Btn onClick={sendTxt} style={{background:T.gradGold,borderRadius:"50%",width:42,height:42,color:"#000",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 16px rgba(201,149,42,0.4)",animation:"sendBounce .3s ease"}}>
                <Send size={18}/>
              </Btn>
              :<Btn onClick={startRecording}
                style={{color:T.muted,padding:"8px",display:"flex",alignItems:"center",flexShrink:0,transition:"color .2s"}}>
                <Mic size={22}/>
              </Btn>
            }
          </div>
        )}
        

      {/* Panneau Gemini */}
      {showGemini&&(
        <div style={{position:"absolute",inset:0,zIndex:100,background:T.bg,display:"flex",flexDirection:"column",animation:"slideUp .3s ease"}}>
          {/* Header */}
          <div style={{padding:"12px 16px",background:"rgba(0,0,0,0.95)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
            <div style={{width:42,height:42,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 4px 16px rgba(123,47,190,0.4)"}}>✨</div>
            <div style={{flex:1}}>
              <p style={{margin:0,fontSize:15,fontWeight:700,color:T.text}}>Céleste IA</p>
              <p style={{margin:0,fontSize:11,color:"#9B6FDE"}}>Toujours là pour toi ✦</p>
            </div>
            <Btn onClick={()=>setShowGemini(false)} style={{color:T.muted,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.05)",borderRadius:"50%",border:`1px solid ${T.border}`}}><X size={16}/></Btn>
          </div>

          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:12}}>
            {geminiMsgs.length===0&&(
              <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,color:T.muted,textAlign:"center",padding:"40px 20px"}}>
                <div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,boxShadow:"0 8px 32px rgba(123,47,190,0.4)",animation:"float 3s ease infinite"}}>✨</div>
                <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,color:T.text}}>Bonjour, je suis Céleste</p>
                <p style={{fontSize:13,color:T.sub,lineHeight:1.7}}>Je suis là pour t'écouter, t'encourager et t'accompagner. De quoi as-tu besoin aujourd'hui ?</p>
              </div>
            )}
            {geminiMsgs.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",gap:10,animation:"msgIn .3s ease"}}>
                {m.role==="model"&&<div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>✨</div>}
                <div style={{maxWidth:"80%",background:m.role==="user"?T.gradGold:"rgba(123,47,190,0.12)",borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"12px 16px",border:m.role==="model"?"1px solid rgba(123,47,190,0.2)":"none",boxShadow:m.role==="user"?"0 4px 16px rgba(201,149,42,0.25)":"0 2px 8px rgba(0,0,0,0.2)"}}>
                  <p style={{margin:0,fontSize:14,color:m.role==="user"?"#000":T.text,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{m.text}</p>
                </div>
              </div>
            ))}
            {geminiLoading&&(
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>✨</div>
                <div style={{background:"rgba(123,47,190,0.12)",borderRadius:"18px 18px 18px 4px",padding:"12px 16px",border:"1px solid rgba(123,47,190,0.2)"}}>
                  <div style={{display:"flex",gap:4,alignItems:"center"}}>
                    {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:"#9B6FDE",animation:`pulse .6s ease ${i*.2}s infinite`}}/>)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{padding:"12px 16px",paddingBottom:"calc(12px + env(safe-area-inset-bottom,0px))",background:"rgba(0,0,0,0.95)",borderTop:`1px solid ${T.border}`,display:"flex",gap:8,alignItems:"flex-end",flexShrink:0}}>
            <div style={{flex:1,background:"rgba(123,47,190,0.08)",border:"1px solid rgba(123,47,190,0.2)",borderRadius:20,padding:"10px 16px"}}>
              <textarea value={geminiInp} onChange={e=>{
    setGeminiInp(e.target.value);
    e.target.style.height="auto";
    e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";
  }}
  onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&window.innerWidth>768){e.preventDefault();send();}}}
  placeholder="Écris à Céleste…" rows={1}
  style={{width:"100%",background:"none",border:"none",color:T.text,fontSize:14,outline:"none",resize:"none",lineHeight:1.5,maxHeight:120,overflowY:"auto",height:"auto"}}/>
            </div>
            <Btn onClick={()=>askGemini(geminiInp)} disabled={geminiLoading||!geminiInp.trim()} style={{background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",borderRadius:"50%",width:42,height:42,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 16px rgba(123,47,190,0.4)",opacity:geminiLoading||!geminiInp.trim()?0.5:1}}>
              <Send size={18}/>
            </Btn>
          </div>
        </div>
      )}

      {selectedMsg&&(
          <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.5)"}} onClick={()=>setSelectedMsg(null)}>
            <div style={{position:"absolute",bottom:80,left:"50%",transform:"translateX(-50%)",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden",minWidth:200}}>
              <Btn onClick={()=>{navigator.clipboard.writeText(selectedMsg.text||"");setSelectedMsg(null);notify("Copié !");}} style={{width:"100%",padding:"14px 20px",fontSize:14,color:T.text,textAlign:"left",borderBottom:`1px solid ${T.border}`}}>📋 Copier</Btn>
              {(selectedMsg.f==="me"||selectedMsg.f===session?.user?.id)&&<Btn onClick={()=>{deleteMsg(selectedMsg.id);setSelectedMsg(null);}} style={{width:"100%",padding:"14px 20px",fontSize:14,color:T.err,textAlign:"left"}}>🗑 Supprimer</Btn>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── USER VIEW ─────────────────────────────────────────────
function UserView({user,myProfile,session,posts,onBack,onChat,notify,myConnections,myFollowers,onConnectionChange,onImageView}){
  const conn=(myConnections||[]).includes(user.id);
  const [followersCount,setFollowersCount]=useState("…");
  const [followingCount,setFollowingCount]=useState("…");
  const [blocked,setBlocked]=useState(false);
  const [showReport,setShowReport]=useState(false);
  const [detailPost,setDetailPost]=useState(null);
  const [coverUrl,setCoverUrl]=useState(user.cover_url||null);
  const [avatarUrl,setAvatarUrl]=useState(user.avatar_url||null);

  useEffect(()=>{
    sb.from("profiles").select("cover_url,avatar_url").eq("id",user.id).single()
      .then(({data})=>{
        if(data?.cover_url)setCoverUrl(data.cover_url);
        if(data?.avatar_url)setAvatarUrl(data.avatar_url);
      });
  },[user.id]);

  useEffect(()=>{
    Promise.all([
      sb.from("connections").select("id",{count:"exact",head:true}).eq("to_id",user.id),
      sb.from("connections").select("id",{count:"exact",head:true}).eq("from_id",user.id),
    ]).then(([{count:fc},{count:fg}])=>{setFollowersCount(fc||0);setFollowingCount(fg||0);});
    sb.from("blocks").select("id").eq("blocker_id",session?.user?.id).eq("blocked_id",user.id).maybeSingle().then(({data})=>{if(data)setBlocked(true);}); 
  },[user.id,session?.user?.id]);

  const toggle=async()=>{
    if(conn){await sb.from("connections").delete().eq("from_id",session?.user?.id).eq("to_id",user.id);notify("Retiré");}
    else{await sb.from("connections").insert({from_id:session?.user?.id,to_id:user.id});notify("Connecté ✦");}
    onConnectionChange();
  };

  const handleBlock=async()=>{
    if(!window.confirm(blocked?"Débloquer ?":"Bloquer ?"))return;
    if(blocked){await sb.from("blocks").delete().eq("blocker_id",session?.user?.id).eq("blocked_id",user.id);setBlocked(false);notify("Débloqué");onConnectionChange?.();}
    else{await sb.from("blocks").insert({blocker_id:session?.user?.id,blocked_id:user.id});setBlocked(true);notify("Bloqué");onConnectionChange?.();}
  };

  const handleReport=async(reason,details)=>{
    await sb.from("reports").insert({reporter_id:session?.user?.id,reported_id:user.id,reason,details});
    setShowReport(false);notify("Signalement envoyé ✦");
  };

  const refreshPost=async pid=>{
    const{data}=await sb.from("posts").select(`*,author:profiles(id,prenom,nom,badge,avatar_url,paroisse),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).eq("id",pid).single();
    if(!data)return null;
    return{id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,title:data.event_title||null,eventDate:data.event_date||null,eventLoc:data.event_loc||null,likes:(data.likes||[]).map(l=>l.user_id),comments:[],ts:new Date(data.created_at).getTime()};
  };

  const uPosts=(posts||[]).filter(p=>p.by===user.id);
  const stats=[{l:"POSTS",v:uPosts.length},{l:"ABONNÉS",v:followersCount},{l:"ABONNEMENTS",v:followingCount}];

  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg}}>
      {showReport&&<ReportModal onClose={()=>setShowReport(false)} onSubmit={handleReport}/>}
      {detailPost&&(
        <PostDetailModal post={detailPost} myProfile={myProfile} session={session}
          getM={id=>id===user.id?user:myProfile}
          onClose={()=>setDetailPost(null)}
          onLike={async pid=>{const liked=(detailPost.likes||[]).includes(session?.user?.id);if(liked)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",session?.user?.id);else await sb.from("likes").insert({post_id:pid,user_id:session?.user?.id});const u=await refreshPost(pid);if(u)setDetailPost(u);}}
          onComment={async()=>{const u=await refreshPost(detailPost.id);if(u)setDetailPost(u);}}
          notify={notify}/>
      )}

      {/* Cover */}
      <div style={{height:180,background:`linear-gradient(160deg,${user.color}44,${user.color}11,transparent)`,position:"relative",overflow:"hidden"}}>
        {coverUrl
          ?<img src={coverUrl} alt="cover" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          :<>
            <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(${user.color}22 1px,transparent 1px)`,backgroundSize:"24px 24px"}}/>
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",opacity:.04,fontSize:140,fontFamily:"'Cormorant Garamond',serif",color:user.color}}>✦</div>
          </>
        }
      </div>

      <div style={{padding:"0 18px 80px",maxWidth:640,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginTop:-44,marginBottom:16,position:"relative",zIndex:10}}>
          <Av u={{...user,avatar_url:avatarUrl}} size={88} ring onClick={()=>{if(avatarUrl)window.dispatchEvent(new CustomEvent("celeste_view_img",{detail:{url:avatarUrl}}));}}/>
          <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>onChat(user.id)} style={{background:"rgba(10,10,10,0.85)",border:`1px solid rgba(255,255,255,0.2)`,borderRadius:20,padding:"10px 14px",color:"#fff",fontSize:11,fontWeight:600,backdropFilter:"blur(10px)"}}>Message</Btn>
<Btn onClick={toggle} style={{background:conn?"rgba(201,149,42,0.85)":T.gradGold,border:conn?`1px solid ${T.gold}`:"none",borderRadius:20,padding:"10px 14px",color:"#000",fontSize:11,fontWeight:700,boxShadow:"0 4px 16px rgba(201,149,42,0.4)",backdropFilter:"blur(10px)"}}>{conn?"✦ Connecté":"+ Connecter"}</Btn>
            </div>
            <div style={{display:"flex",gap:6}}>
              <Btn onClick={handleBlock} style={{background:"rgba(200,64,64,0.08)",border:"1px solid rgba(200,64,64,0.2)",borderRadius:10,padding:"5px 12px",color:"#e06060",fontSize:11,fontWeight:600}}>{blocked?"Débloquer":"Bloquer"}</Btn>
              <Btn onClick={()=>setShowReport(true)} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:10,padding:"5px 12px",color:T.muted,fontSize:11,fontWeight:600}}>Signaler</Btn>
            </div>
          </div>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:400,color:T.text}}>{user.fullName||user.name}</h2>
            {user.badge&&<Badge type={user.badge}/>}
          </div>
          <p style={{margin:"0 0 6px",fontSize:13,color:T.muted}}>⛪ {user.paroisse}</p>
          {user.bio&&<p style={{margin:0,fontSize:14,color:T.sub,lineHeight:1.7}}>{user.bio.split(/(https?:\/\/[^\s]+)/g).map((part,i)=>
  /^https?:\/\//.test(part)
    ?<a key={i} href={part} target="_blank" rel="noreferrer" style={{color:T.goldL,textDecoration:"underline",wordBreak:"break-all"}}>{part}</a>
    :part
)}</p>}
        </div>

        <div style={{display:"flex",gap:1,background:"rgba(255,255,255,0.03)",borderRadius:18,overflow:"hidden",border:`1px solid ${T.border}`,marginBottom:24}}>
          {stats.map((s,i)=>(
            <div key={s.l} style={{flex:1,textAlign:"center",padding:"16px 8px",borderRight:i<stats.length-1?`1px solid ${T.border}`:"none"}}>
              <p style={{margin:"0 0 3px",fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:400,color:T.goldL}}>{s.v}</p>
              <p style={{margin:0,fontSize:9,color:T.muted,letterSpacing:1,textTransform:"uppercase"}}>{s.l}</p>
            </div>
          ))}
        </div>

        <p style={{fontSize:10,color:T.muted,letterSpacing:1.5,marginBottom:12,textTransform:"uppercase"}}>Publications ({uPosts.length})</p>
        {uPosts.length===0
          ?<div style={{textAlign:"center",padding:"40px 0",color:T.muted}}><div style={{fontSize:40,marginBottom:8,animation:"float 3s ease infinite"}}>✦</div><p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Aucune publication encore</p></div>
          :<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3,margin:"0 -18px"}}>
            {uPosts.map(p=>(
              <div key={p.id} style={{aspectRatio:"1/1",overflow:"hidden",background:T.card,position:"relative",cursor:"pointer"}} onClick={()=>setDetailPost(p)}>
                {p.img
                  ?<img src={p.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  :<div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:8,gap:4}}>
                    <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T.gold}}>✦</span>
                    <p style={{margin:0,fontSize:10,color:T.sub,textAlign:"center",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical"}}>{p.text||p.title}</p>
                  </div>
                }
                <div style={{position:"absolute",bottom:4,right:6,display:"flex",gap:5,alignItems:"center"}}>
                  <span style={{fontSize:9,color:"rgba(255,255,255,0.8)",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>❤ {(p.likes||[]).length}</span>
                </div>
              </div>
            ))}
          </div>
        }
        <div style={{height:80}}/>
      </div>
    </div>
  );
}

// ── ORG VIEW ──────────────────────────────────────────────
function OrgView({user,myProfile,session,posts,onBack,onChat,notify,myConnections,onConnectionChange,onImageView}){
  const conn=(myConnections||[]).includes(user.id);
  const [followersCount,setFollowersCount]=useState("…");
  const [coverPhoto,setCoverPhoto]=useState(user.cover_url||null);
  const [blocked,setBlocked]=useState(false);
  const [showReport,setShowReport]=useState(false);
  const [detailPost,setDetailPost]=useState(null);
  const fileRef=useRef(); const coverRef=useRef();

  useEffect(()=>{
    sb.from("connections").select("id",{count:"exact",head:true}).eq("to_id",user.id).then(({count})=>setFollowersCount(count||0));
    sb.from("blocks").select("id").eq("blocker_id",session?.user?.id).eq("blocked_id",user.id).maybeSingle().then(({data})=>{if(data)setBlocked(true);});
  },[user.id,session?.user?.id]);

  const toggle=async()=>{
    if(conn){await sb.from("connections").delete().eq("from_id",session?.user?.id).eq("to_id",user.id);notify("Retiré");}
    else{await sb.from("connections").insert({from_id:session?.user?.id,to_id:user.id});notify("Abonné ✦");}
    onConnectionChange();
  };

  const handleBlock=async()=>{
    if(!window.confirm(blocked?"Débloquer ?":"Bloquer ?"))return;
    if(blocked){await sb.from("blocks").delete().eq("blocker_id",session?.user?.id).eq("blocked_id",user.id);setBlocked(false);notify("Débloqué");onConnectionChange?.();}
    else{await sb.from("blocks").insert({blocker_id:session?.user?.id,blocked_id:user.id});setBlocked(true);notify("Bloqué");onConnectionChange?.();}
  };

  const handleReport=async(reason,details)=>{
    await sb.from("reports").insert({reporter_id:session?.user?.id,reported_id:user.id,reason,details});
    setShowReport(false);notify("Signalement envoyé ✦");
  };

  const isMe=session?.user?.id===user.id;
  const uPosts=(posts||[]).filter(p=>p.by===user.id);
  const orgTypeLabel={restaurant:"🍽️ Restaurant",hotel:"🏨 Hôtel",musique:"🎵 Musique / Artiste",entreprise:"💼 Entreprise",association:"🤝 Association",ecole:"🎓 École / Université",autre:"📌 Organisation"}[user.org_type]||"📌 Organisation";

  const uploadAvatar=async e=>{const f=e.target.files[0];if(!f)return;const path=`avatars/${user.id}.${f.name.split(".").pop()}`;await sb.storage.from("celeste-media").upload(path,f,{upsert:true});const{data}=sb.storage.from("celeste-media").getPublicUrl(path);const urlWithTs=`${data.publicUrl}?t=${Date.now()}`;await sb.from("profiles").update({avatar_url:urlWithTs}).eq("id",user.id);notify("Photo mise à jour ✦");};
  const uploadCover=async e=>{const f=e.target.files[0];if(!f)return;const path=`covers/${user.id}.${f.name.split(".").pop()}`;await sb.storage.from("celeste-media").upload(path,f,{upsert:true});const{data}=sb.storage.from("celeste-media").getPublicUrl(path);const urlWithTs=`${data.publicUrl}?t=${Date.now()}`;await sb.from("profiles").update({cover_url:urlWithTs}).eq("id",user.id);setCoverPhoto(urlWithTs);notify("Couverture mise à jour ✦");};

  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg}}>
      {showReport&&<ReportModal onClose={()=>setShowReport(false)} onSubmit={handleReport}/>}
      <div style={{position:"relative",height:220,overflow:"hidden"}}>
        {coverPhoto
          ?<img src={coverPhoto} alt="cover" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          :<div style={{width:"100%",height:"100%",background:`linear-gradient(135deg,${T.gold}22,rgba(58,106,154,0.2),${T.bg})`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:120,opacity:.06,fontFamily:"'Cormorant Garamond',serif"}}>✦</span>
          </div>
        }
        {isMe&&(<>
          <input ref={coverRef} type="file" accept="image/*" style={{display:"none"}} onChange={uploadCover}/>
          <Btn onClick={()=>coverRef.current.click()} style={{position:"absolute",top:16,right:16,background:"rgba(0,0,0,0.6)",borderRadius:12,padding:"8px 14px",color:"#fff",fontSize:12,backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",gap:6}}><Image size={13}/> Changer</Btn>
        </>)}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:100,background:"linear-gradient(transparent,rgba(0,0,0,0.95))"}}/>
      </div>

      <div style={{padding:"0 18px",maxWidth:640,margin:"0 auto",position:"relative",zIndex:1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginTop:-44,marginBottom:16}}>
          <div style={{position:"relative"}}>
            <div style={{width:90,height:90,borderRadius:20,border:`3px solid ${T.gold}`,overflow:"hidden",background:T.card,boxShadow:T.glowGold}}>
              {user.avatar_url?<img src={user.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} onClick={()=>onImageView(user.avatar_url)}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,fontFamily:"'Cormorant Garamond',serif",color:T.gold}}>✦</div>}
            </div>
            {isMe&&(<><input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={uploadAvatar}/><Btn onClick={()=>fileRef.current.click()} style={{position:"absolute",bottom:-4,right:-4,width:26,height:26,borderRadius:8,background:T.gradGold,color:"#000",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><Edit2 size={12}/></Btn></>)}
          </div>
          {!isMe&&(
            <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
              <div style={{display:"flex",gap:8}}>
                <Btn onClick={()=>onChat(user.id)} style={{background:"rgba(255,255,255,0.06)",border:`1px solid ${T.border}`,borderRadius:14,padding:"9px 16px",color:T.text,fontSize:13,fontWeight:600}}>Message</Btn>
                <Btn onClick={toggle} style={{background:conn?T.goldBg:T.gradGold,border:conn?`1px solid ${T.gold}44`:"none",borderRadius:14,padding:"9px 18px",color:conn?T.goldL:"#000",fontSize:13,fontWeight:700,boxShadow:conn?"none":"0 4px 16px rgba(201,149,42,0.3)"}}>{conn?"✦ Abonné":"+ Suivre"}</Btn>
              </div>
              <div style={{display:"flex",gap:6}}>
                <Btn onClick={handleBlock} style={{background:"rgba(200,64,64,0.08)",border:"1px solid rgba(200,64,64,0.2)",borderRadius:10,padding:"6px 12px",color:"#e06060",fontSize:11,fontWeight:600}}>{blocked?"Débloquer":"Bloquer"}</Btn>
                <Btn onClick={()=>setShowReport(true)} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:10,padding:"6px 12px",color:T.muted,fontSize:11,fontWeight:600}}>Signaler</Btn>
              </div>
            </div>
          )}
        </div>

        <div style={{marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:400,color:T.text}}>{user.org_name||user.fullName}</h2>
            {user.badge&&<Badge type={user.badge}/>}
          </div>
          <p style={{margin:"0 0 4px",fontSize:13,color:T.goldL,fontWeight:600}}>{orgTypeLabel}</p>
          <p style={{margin:"0 0 8px",fontSize:12,color:T.muted}}>🌍 {user.org_country||user.paroisse}</p>
          {user.bio&&<p style={{margin:"0 0 10px",fontSize:14,color:T.sub,lineHeight:1.7}}>{user.bio}</p>}
          {user.org_desc&&<p style={{margin:"0 0 12px",fontSize:13,color:T.muted,lineHeight:1.6,fontStyle:"italic"}}>{user.org_desc}</p>}
        </div>

        <div style={{display:"flex",gap:1,background:"rgba(255,255,255,0.03)",borderRadius:18,overflow:"hidden",border:`1px solid ${T.border}`,marginBottom:24}}>
          {[{l:"Publications",v:uPosts.length},{l:"Abonnés",v:followersCount}].map((s,i)=>(
            <div key={s.l} style={{flex:1,textAlign:"center",padding:"16px 8px",borderRight:i<1?`1px solid ${T.border}`:"none"}}>
              <p style={{margin:"0 0 3px",fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:400,color:T.goldL}}>{s.v}</p>
              <p style={{margin:0,fontSize:9,color:T.muted,letterSpacing:1,textTransform:"uppercase"}}>{s.l}</p>
            </div>
          ))}
        </div>

        {uPosts.map(p=>(
          <div key={p.id} style={{background:T.card,borderRadius:18,overflow:"hidden",marginBottom:10,border:`1px solid ${T.border}`,cursor:"pointer"}}
            onClick={()=>setDetailPost(p)}>
            {p.img&&<MediaPlayer url={p.img} style={{maxHeight:200}} onImageClick={()=>onImageView(p.img)}/>}
            <div style={{padding:14}}>
              <p style={{margin:"0 0 6px",fontSize:13,color:T.text,lineHeight:1.6}}>{p.text||p.title}</p>
              <span style={{fontSize:11,color:T.muted}}>{ago(p.ts)} · ❤ {(p.likes||[]).length}</span>
            </div>
          </div>
        ))}
        <div style={{height:80}}/>
      </div>
    </div>
  );
}

function ParametresModal({myProfile,session,onLogout,notify}){
  const [open,setOpen]=useState(false);
  const [showAbout,setShowAbout]=useState(false);
  const [dnd,setDnd]=useState(false);
  const [mode,setMode]=useState(()=>localStorage.getItem("celeste_theme")||"dark");

  useEffect(()=>{
    if(!session?.user?.id)return;
    sb.from("profiles").select("no_messages").eq("id",session.user.id).single()
      .then(({data})=>{if(data)setDnd(!!data.no_messages);});
  },[session?.user?.id]);

  const toggleDnd=async()=>{
    const next=!dnd;setDnd(next);
    await sb.from("profiles").update({no_messages:next}).eq("id",session.user.id);
    notify(next?"Messages bloqués — seul l'admin peut vous écrire":"Messages activés ✦");
  };

  const toggleTheme=()=>{
    const next=mode==="dark"?"light":"dark";
    setAppTheme(next);setMode(next);
    window.location.reload();
  };

  return(
    <>
      <Btn onClick={()=>setOpen(true)} style={{width:"100%",marginTop:16,padding:"14px 16px",background:T.card,border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12}}>
        <Settings size={18} color={T.gold}/>
        <span style={{flex:1,fontSize:14,fontWeight:600,color:T.text,textAlign:"left"}}>Paramètres</span>
        <ChevronRight size={16} color={T.muted}/>
      </Btn>

      {/* Modal Paramètres */}
      {open&&(
        <div style={{position:"fixed",inset:0,zIndex:900,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setOpen(false)}>
          <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:520,padding:"28px 20px 48px",animation:"slideUp .35s cubic-bezier(0.34,1.1,0.64,1)",display:"flex",flexDirection:"column",gap:10}} onClick={e=>e.stopPropagation()}>
            
            <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:400,color:T.text,marginBottom:8}}>Paramètres</h3>

            {/* Thème */}
            <Btn onClick={toggleTheme} style={{width:"100%",padding:"14px 16px",background:T.card,border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:20}}>{mode==="dark"?"🌙":"☀️"}</span>
              <div style={{flex:1,textAlign:"left"}}>
                <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>Thème {mode==="dark"?"Noir":"Blanc"}</p>
                <p style={{margin:0,fontSize:11,color:T.muted}}>Basculer vers le thème {mode==="dark"?"Blanc ☀️":"Noir 🌙"}</p>
              </div>
              <div style={{width:42,height:24,borderRadius:12,background:mode==="dark"?"#1a1a1a":T.gradGold,border:`1px solid ${T.border}`,position:"relative"}}>
                <div style={{position:"absolute",top:2,left:mode==="dark"?2:18,width:20,height:20,borderRadius:"50%",background:mode==="dark"?T.muted:T.gold,transition:"left .3s"}}/>
              </div>
            </Btn>

            {/* Ne pas déranger */}
            <Btn onClick={toggleDnd} style={{width:"100%",padding:"14px 16px",background:dnd?"rgba(200,64,64,0.06)":T.card,border:`1px solid ${dnd?T.err+"44":T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:20}}>🔕</span>
              <div style={{flex:1,textAlign:"left"}}>
                <p style={{margin:0,fontSize:13,fontWeight:600,color:dnd?T.err:T.text}}>Ne pas recevoir de messages</p>
                <p style={{margin:0,fontSize:11,color:T.muted}}>{dnd?"Seul l'administration peut vous écrire":"Tout le monde peut vous envoyer un message"}</p>
              </div>
              <div style={{width:42,height:24,borderRadius:12,background:dnd?T.err:"#1a1a1a",border:`1px solid ${T.border}`,position:"relative",transition:"background .3s"}}>
                <div style={{position:"absolute",top:2,left:dnd?18:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left .3s"}}/>
              </div>
            </Btn>

            {/* Certification */}
            <div style={{background:T.goldBg,border:`1px solid ${T.gold}33`,borderRadius:14,padding:"14px 16px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span style={{fontSize:20}}>✦</span>
                <div style={{flex:1}}>
                  <p style={{margin:0,fontSize:13,fontWeight:700,color:T.goldL}}>Demander la certification</p>
                  <p style={{margin:0,fontSize:11,color:T.muted}}>1 000 FCFA · 40 jours</p>
                </div>
              </div>
              <p style={{margin:"0 0 10px",fontSize:12,color:T.sub,lineHeight:1.7}}>Les comptes certifiés bénéficient d'un badge visible sur leur profil. Leurs publications sont automatiquement mises en avant et vues en priorité par toute la communauté.</p>
              <Btn onClick={()=>window.open("https://wa.me/242067131327?text="+encodeURIComponent("Bonjour, je souhaite obtenir la certification Céleste pour le compte : "+(myProfile?.fullName||"")+" (@"+(myProfile?.prenom||"")+"). Merci."),"_blank")} style={{width:"100%",padding:"12px",background:"#25D366",borderRadius:12,color:"#fff",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span style={{fontSize:18}}>💬</span> Demander via WhatsApp
              </Btn>
            </div>

            {/* À propos */}
            <Btn onClick={()=>setShowAbout(true)} style={{width:"100%",padding:"14px 16px",background:T.card,border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:20}}>✦</span>
              <div style={{flex:1,textAlign:"left"}}>
                <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>À propos de Céleste</p>
                <p style={{margin:0,fontSize:11,color:T.muted}}>Conditions · Confidentialité · Contact</p>
              </div>
              <ChevronRight size={16} color={T.muted}/>
            </Btn>

            {/* Déconnexion */}
            <Btn onClick={()=>{setOpen(false);setTimeout(()=>{if(window.confirm("Se déconnecter ?"))onLogout();},200);}} style={{width:"100%",padding:"14px",background:"rgba(200,64,64,0.06)",border:`1px solid ${T.err}33`,borderRadius:14,color:T.err,fontSize:14,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <LogOut size={18}/>Se déconnecter
            </Btn>

          </div>
        </div>
      )}

      {/* Modal À propos */}
      {showAbout&&(
        <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.92)",backdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setShowAbout(false)}>
          <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",padding:"32px 24px 48px",animation:"slideUp .35s cubic-bezier(0.34,1.1,0.64,1)"}} onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:"center",marginBottom:28}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:56,color:T.gold,lineHeight:1,marginBottom:12}}>✦</div>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontWeight:300,color:T.text,letterSpacing:4,margin:"0 0 4px"}}>Céleste</h2>
              <p style={{color:T.gold,fontSize:12,letterSpacing:2,textTransform:"uppercase",margin:0}}>Réseau privé des jeunes · v4.0</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:28}}>
              {[
                {title:"🌟 Notre mission",text:"Céleste est le réseau social privé et sécurisé des jeunes. Un espace pour découvrir des personnes qui te ressemblent, créer des liens authentiques et vivre des rencontres qui comptent vraiment."},
              ].map((s,i)=>(
                <div key={i} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:14,padding:"16px"}}>
                  <p style={{margin:"0 0 8px",fontSize:12,fontWeight:700,color:T.goldL,letterSpacing:1,textTransform:"uppercase"}}>{s.title}</p>
                  <p style={{margin:0,fontSize:13,color:T.sub,lineHeight:1.8}}>{s.text}</p>
                </div>
              ))}
              <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:14,padding:"16px"}}>
                <p style={{margin:"0 0 8px",fontSize:12,fontWeight:700,color:T.goldL,letterSpacing:1,textTransform:"uppercase"}}>📋 Conditions d'utilisation</p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {["En t'inscrivant sur Céleste, tu certifies que toutes les informations fournies sont exactes et véridiques.","Céleste est une plateforme réservée aux jeunes. Toute personne fournissant de fausses informations s'expose à une exclusion définitive et à des poursuites judiciaires.","Il est strictement interdit de publier du contenu offensant, haineux, pornographique ou illégal.","Le harcèlement, la violence verbale et toute forme d'intimidation sont strictement prohibés et entraînent une suspension immédiate.","Toute usurpation d'identité est un délit punissable par la loi.","Céleste se réserve le droit de supprimer tout compte sans préavis en cas de violation des présentes conditions."].map((t,i)=>(
                    <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                      <span style={{color:T.gold,fontSize:12,flexShrink:0,marginTop:2}}>✦</span>
                      <p style={{margin:0,fontSize:12,color:T.sub,lineHeight:1.7}}>{t}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:14,padding:"16px"}}>
                <p style={{margin:"0 0 8px",fontSize:12,fontWeight:700,color:T.goldL,letterSpacing:1,textTransform:"uppercase"}}>🔒 Confidentialité</p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {["Tes données personnelles ne sont jamais vendues ni partagées avec des tiers.","Ton numéro de téléphone est utilisé uniquement pour la vérification et ne sera jamais divulgué.","Les conversations privées sont confidentielles et accessibles uniquement aux participants.","Céleste utilise un chiffrement sécurisé pour protéger toutes tes données."].map((t,i)=>(
                    <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                      <span style={{color:T.gold,fontSize:12,flexShrink:0,marginTop:2}}>✦</span>
                      <p style={{margin:0,fontSize:12,color:T.sub,lineHeight:1.7}}>{t}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:14,padding:"16px"}}>
                <p style={{margin:"0 0 8px",fontSize:12,fontWeight:700,color:T.goldL,letterSpacing:1,textTransform:"uppercase"}}>⚖️ Responsabilités légales</p>
                <p style={{margin:0,fontSize:13,color:T.sub,lineHeight:1.8}}>Toute personne ayant menti sur son identité ou son âge sera poursuivie conformément aux lois en vigueur. Céleste coopère avec les autorités compétentes en cas de signalement.</p>
              </div>
              <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:14,padding:"16px"}}>
                <p style={{margin:"0 0 8px",fontSize:12,fontWeight:700,color:T.goldL,letterSpacing:1,textTransform:"uppercase"}}>🏢 Organisation</p>
                <p style={{margin:"0 0 4px",fontSize:16,color:T.gold,fontFamily:"'Cormorant Garamond',serif",letterSpacing:2}}>✦ DES-ETOILES ✦</p>
                <p style={{margin:"0 0 4px",fontSize:12,color:T.sub}}>Créé par Georgi PAMBOU</p>
                <p style={{margin:0,fontSize:11,color:T.muted}}>© 2025 Céleste. Tous droits réservés.</p>
              </div>
              <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:14,padding:"16px"}}>
                <p style={{margin:"0 0 8px",fontSize:12,fontWeight:700,color:T.goldL,letterSpacing:1,textTransform:"uppercase"}}>📞 Contact</p>
                <a href="mailto:mrdesetoiles@gmail.com" style={{display:"flex",alignItems:"center",gap:8,color:T.sub,fontSize:13,textDecoration:"none",marginBottom:8}}><span>✉️</span> mrdesetoiles@gmail.com</a>
                <a href="https://wa.me/242067131327" target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:8,color:T.sub,fontSize:13,textDecoration:"none"}}><span>💬</span> WhatsApp : +242 067 131 327</a>
              </div>
            </div>
            <Btn onClick={()=>setShowAbout(false)} style={{width:"100%",padding:"14px",background:T.gradGold,borderRadius:14,color:"#000",fontSize:14,fontWeight:700}}>J'ai lu et j'accepte ✦</Btn>
          </div>
        </div>
      )}
    </>
  );
}
// ── PROFILE TAB (ENRICHI - onglet Sauvegardés) ───────────
function ProfileTab({myProfile,session,posts,onNewPost,notify,onLogout,reload,myConnections,myFollowers,onImageView}){
  const [tab,setTab]=useState("posts");
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState({prenom:myProfile?.fullName?.split(" ")[0]||"",nom:myProfile?.fullName?.split(" ").slice(1).join(" ")||"",bio:myProfile?.bio||"",paroisse:myProfile?.paroisse||""});
  const [saving,setSaving]=useState(false);
  const [unreadNotifs,setUnreadNotifs]=useState(0);
  const [showFollowers,setShowFollowers]=useState(false);
  const [showFollowing,setShowFollowing]=useState(false);
  const [followerProfiles,setFollowerProfiles]=useState([]);
  const [followingProfiles,setFollowingProfiles]=useState([]);
  const avRef=useRef(); const cvRef=useRef();

  useEffect(()=>{
    sb.from("notifications").select("*",{count:"exact",head:true}).eq("user_id",session?.user?.id).eq("read",false).then(({count})=>setUnreadNotifs(count||0));
  },[session?.user?.id]);

  const openFollowers=async()=>{
    const ids=myFollowers||[];
    if(ids.length===0){setFollowerProfiles([]);setShowFollowers(true);return;}
    const{data}=await sb.from("profiles").select("id,prenom,nom,avatar_url,badge,paroisse").in("id",ids);
    setFollowerProfiles((data||[]).map(normProfile));
    setShowFollowers(true);
  };
  const openFollowing=async()=>{
    const ids=myConnections||[];
    if(ids.length===0){setFollowingProfiles([]);setShowFollowing(true);return;}
    const{data}=await sb.from("profiles").select("id,prenom,nom,avatar_url,badge,paroisse").in("id",ids);
    setFollowingProfiles((data||[]).map(normProfile));
    setShowFollowing(true);
  };

  const saveProfile=async()=>{
    setSaving(true);
    await sb.from("profiles").update({prenom:form.prenom,nom:form.nom,bio:form.bio,paroisse:form.paroisse,updated_at:new Date().toISOString()}).eq("id",session?.user?.id);
    setSaving(false);setEditing(false);reload();notify("Profil mis à jour ✦");
  };

  const uploadImg=async(e,field)=>{
  const f=e.target.files[0]; if(!f)return;
  const compressed=field==="cover_url"?f:await compressImage(f);
  const ext=f.name.split(".").pop()||"jpg";
  const path=`${field}/${session?.user?.id}.${ext}`;
    const contentType=field==="cover_url"?f.type:"image/jpeg";
    await sb.storage.from("celeste-media").upload(path,compressed,{upsert:true,contentType});
    const{data}=sb.storage.from("celeste-media").getPublicUrl(path);
    await sb.from("profiles").update({[field]:data.publicUrl}).eq("id",session?.user?.id);
    reload();notify("Photo mise à jour ✦");
  };

  const myPosts=(posts||[]).filter(p=>p.by===session?.user?.id);
  const followersCount=(myFollowers||[]).length;
  const followingCount=(myConnections||[]).length;
  const [detailPost, setDetailPost] = useState(null);
  const refreshPost=async pid=>{
  const{data}=await sb.from("posts").select(`*,author:profiles(id,prenom,nom,badge,avatar_url,paroisse),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).eq("id",pid).single();
  if(!data)return null;
  return{id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,media_urls:data.media_urls||[],title:data.event_title||null,eventDate:data.event_date||null,eventLoc:data.event_loc||null,likes:(data.likes||[]).map(l=>l.user_id),comments:[],ts:new Date(data.created_at).getTime()};
};
  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg}}>
      <input type="file" ref={avRef} accept="image/*" style={{display:"none"}} onChange={e=>uploadImg(e,"avatar_url")}/>
      <input type="file" ref={cvRef} accept="image/*" style={{display:"none"}} onChange={e=>uploadImg(e,"cover_url")}/>
{detailPost&&<PostDetailModal post={detailPost} myProfile={myProfile} session={session} getM={id=>id===session?.user?.id?myProfile:{initials:"?",color:"#888",name:"?"}} onClose={()=>setDetailPost(null)} onLike={async pid=>{const liked=(detailPost.likes||[]).includes(session?.user?.id);if(liked)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",session?.user?.id);else await sb.from("likes").insert({post_id:pid,user_id:session?.user?.id});const u=await refreshPost(pid);if(u)setDetailPost(u);}} onComment={async()=>{const u=await refreshPost(detailPost.id);if(u)setDetailPost(u);}} notify={notify}/>}
      {/* Cover */}
      <div style={{height:160,background:`linear-gradient(135deg,${myProfile?.color||T.gold}22,${T.goldD}11)`,position:"relative",overflow:"hidden",cursor:"pointer"}} onClick={()=>cvRef.current.click()}>
        {myProfile?.cover_url&&<img src={myProfile.cover_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent,rgba(0,0,0,0.6))"}}/>
        <div style={{position:"absolute",bottom:12,right:12,background:"rgba(0,0,0,0.6)",borderRadius:10,padding:"5px 10px",fontSize:11,color:"#fff",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",gap:5}}><Camera size={12}/>Changer</div>
      </div>

      <div style={{padding:"0 18px",maxWidth:640,margin:"0 auto"}}>
        {/* Avatar + actions */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginTop:-44,marginBottom:16}}>
          <div style={{position:"relative",cursor:"pointer"}}>
  <Av u={myProfile} size={88} ring onClick={()=>{if(myProfile?.avatar_url)window.dispatchEvent(new CustomEvent("celeste_view_img",{detail:{url:myProfile.avatar_url}}));else avRef.current.click();}}/>
            <div style={{position:"absolute",bottom:-2,right:-2,width:26,height:26,borderRadius:8,background:T.gradGold,display:"flex",alignItems:"center",justifyContent:"center",color:"#000",boxShadow:"0 2px 8px rgba(201,149,42,0.4)"}}>
              <Camera size={12}/>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={()=>setEditing(e=>!e)} style={{background:editing?T.goldBg:T.glass,border:`1px solid ${editing?T.gold+"55":T.border}`,borderRadius:14,padding:"9px 16px",color:editing?T.goldL:T.sub,fontSize:13,fontWeight:600}}>
              <Edit2 size={14}/> {editing?"Annuler":"Modifier"}
            </Btn>
          </div>
        </div>

        {/* Info */}
        {editing?(
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20,background:T.card,borderRadius:18,padding:16,border:`1px solid ${T.border}`}}>
            <div style={{display:"flex",gap:8}}>
              <input value={form.prenom} onChange={e=>setForm(f=>({...f,prenom:e.target.value}))} placeholder="Prénom" style={{flex:1,background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px",color:T.text,fontSize:13,outline:"none"}}/>
              <input value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))} placeholder="Nom" style={{flex:1,background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px",color:T.text,fontSize:13,outline:"none"}}/>
            </div>
            <input value={form.paroisse} onChange={e=>setForm(f=>({...f,paroisse:e.target.value}))} placeholder="Paroisse" style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px",color:T.text,fontSize:13,outline:"none"}}/>
            <textarea value={form.bio} onChange={e=>setForm(f=>({...f,bio:e.target.value}))} placeholder="Bio…" rows={3} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px",color:T.text,fontSize:13,outline:"none",resize:"none",lineHeight:1.6}}/>
            <Btn onClick={saveProfile} disabled={saving} style={{padding:"12px",background:saving?T.goldBg:T.gradGold,color:"#000",borderRadius:12,fontSize:13,fontWeight:700,boxShadow:"0 4px 16px rgba(201,149,42,0.3)"}}>
              {saving?"Sauvegarde…":"Enregistrer ✦"}
            </Btn>
          </div>
        ):(
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:400,color:T.text}}>{myProfile?.fullName}</h2>
              {myProfile?.badge&&<Badge type={myProfile.badge}/>}
            </div>
            <p style={{margin:"0 0 6px",fontSize:13,color:T.muted}}>📍{myProfile?.paroisse}</p>
            {myProfile?.bio&&<p style={{margin:0,fontSize:14,color:T.sub,lineHeight:1.7}}>{myProfile.bio.split(/(https?:\/\/[^\s]+)/g).map((part,i)=>
  /^https?:\/\//.test(part)
    ?<a key={i} href={part} target="_blank" rel="noreferrer" style={{color:T.goldL,textDecoration:"underline",wordBreak:"break-all"}}>{part}</a>
    :part
)}</p>}
          </div>
        )}

        {/* Stats */}
        <div style={{display:"flex",gap:1,background:"rgba(255,255,255,0.03)",borderRadius:18,overflow:"hidden",border:`1px solid ${T.border}`,marginBottom:20}}>
          {[
            {l:"POSTS",v:myPosts.length,onClick:null},
            {l:"ABONNÉS",v:followersCount,onClick:openFollowers},
            {l:"ABONNEMENTS",v:followingCount,onClick:openFollowing}
          ].map((s,i)=>(
            <div key={s.l} onClick={s.onClick||undefined}
              style={{flex:1,textAlign:"center",padding:"14px 8px",borderRight:i<2?`1px solid ${T.border}`:"none",cursor:s.onClick?"pointer":"default",transition:"background .2s"}}
              onMouseEnter={e=>{if(s.onClick)e.currentTarget.style.background="rgba(201,149,42,0.05)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
              <p style={{margin:"0 0 3px",fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:400,color:s.onClick?T.goldL:T.text}}>{s.v}</p>
              <p style={{margin:0,fontSize:9,color:T.muted,letterSpacing:1,textTransform:"uppercase"}}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Modal Abonnés */}
        {showFollowers&&(
          <div style={{position:"fixed",inset:0,zIndex:800,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setShowFollowers(false)}>
            <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:520,maxHeight:"75vh",display:"flex",flexDirection:"column",animation:"slideUp .3s ease"}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:"20px 20px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <h3 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:300,color:T.text}}>Abonnés <span style={{color:T.goldL}}>({followersCount})</span></h3>
                <Btn onClick={()=>setShowFollowers(false)} style={{color:T.muted}}><X size={20}/></Btn>
              </div>
              <div style={{overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
                {followerProfiles.length===0?<p style={{textAlign:"center",color:T.muted,padding:"24px 0"}}>Aucun abonné pour l'instant</p>
                  :followerProfiles.map(u=>(
                    <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:T.card,borderRadius:14,border:`1px solid ${T.border}`,cursor:"pointer"}}
  onClick={()=>{setShowFollowers(false);window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:u.id}}));}}>
  <Av u={u} size={42} ring/>
  <div style={{flex:1}}>
    <p style={{margin:0,fontSize:14,fontWeight:600,color:T.text}}>{u.name}</p>
    <p style={{margin:0,fontSize:12,color:T.muted}}>{u.paroisse}</p>
  </div>
  {u.badge&&<Badge type={u.badge}/>}
</div>
                  ))
                }
                <div style={{height:20}}/>
              </div>
            </div>
          </div>
        )}

        {/* Modal Abonnements */}
        {showFollowing&&(
          <div style={{position:"fixed",inset:0,zIndex:800,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setShowFollowing(false)}>
            <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:520,maxHeight:"75vh",display:"flex",flexDirection:"column",animation:"slideUp .3s ease"}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:"20px 20px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <h3 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:300,color:T.text}}>Abonnements <span style={{color:T.goldL}}>({followingCount})</span></h3>
                <Btn onClick={()=>setShowFollowing(false)} style={{color:T.muted}}><X size={20}/></Btn>
              </div>
              <div style={{overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
                {followingProfiles.length===0?<p style={{textAlign:"center",color:T.muted,padding:"24px 0"}}>Vous ne suivez personne</p>
                  :followingProfiles.map(u=>(
                    <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:T.card,borderRadius:14,border:`1px solid ${T.border}`,cursor:"pointer"}}
  onClick={()=>{setShowFollowing(false);window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:u.id}}));}}>
  <Av u={u} size={42} ring/>
  <div style={{flex:1}}>
    <p style={{margin:0,fontSize:14,fontWeight:600,color:T.text}}>{u.name}</p>
    <p style={{margin:0,fontSize:12,color:T.muted}}>{u.paroisse}</p>
  </div>
  {u.badge&&<Badge type={u.badge}/>}
</div>
                  ))
                }
                <div style={{height:20}}/>
              </div>
            </div>
          </div>
        )}

        {/* Tabs: Posts / Sauvegardés (NOUVEAU) */}
        <div style={{display:"flex",gap:1,background:"rgba(255,255,255,0.03)",borderRadius:14,overflow:"hidden",border:`1px solid ${T.border}`,marginBottom:16}}>
          {["posts","saved"].map(t=>(
            <Btn key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"11px",background:tab===t?T.goldBg:"none",color:tab===t?T.goldL:T.muted,fontSize:13,fontWeight:tab===t?700:400,border:tab===t?`1px solid ${T.gold}44`:"1px solid transparent",borderRadius:12,transition:"all .2s"}}>
              {t==="posts"?"Publications":"Sauvegardés"}
            </Btn>
          ))}
        </div>

        {tab==="posts"&&(
          myPosts.length===0
            ?<div style={{textAlign:"center",padding:"40px 0",color:T.muted}}>
              <div style={{fontSize:40,marginBottom:8,animation:"float 3s ease infinite"}}>✦</div>
              <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,marginBottom:12}}>Aucune publication</p>
              <Btn onClick={onNewPost} style={{background:T.gradGold,borderRadius:14,padding:"11px 24px",color:"#000",fontSize:13,fontWeight:700}}>Publier maintenant</Btn>
            </div>
            :<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3,margin:"0 -18px"}}>
  {myPosts.map(p=>(
    <div key={p.id} style={{aspectRatio:"1/1",overflow:"hidden",background:T.card,position:"relative",cursor:"pointer"}}>
      <div onClick={()=>setDetailPost(p)} style={{width:"100%",height:"100%"}}>
        {p.img
          ?<img src={p.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          :<div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:8,gap:4}}>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T.gold}}>✦</span>
            <p style={{margin:0,fontSize:10,color:T.sub,textAlign:"center",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical"}}>{p.text}</p>
          </div>
        }
        <div style={{position:"absolute",bottom:4,right:6,display:"flex",gap:5,alignItems:"center"}}>
          <span style={{fontSize:9,color:"rgba(255,255,255,0.8)",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>❤ {(p.likes||[]).length}</span>
        </div>
      </div>
      <Btn onClick={e=>{e.stopPropagation();if(window.confirm("Supprimer ?"))sb.from("posts").delete().eq("id",p.id).then(()=>{reload();notify("Supprimé");});}} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.65)",borderRadius:8,padding:"3px 7px",color:T.err,fontSize:11}}>🗑</Btn>
    </div>
  ))}
</div>
        )}

        {tab==="saved"&&(
          <SavedPostsTab myProfile={myProfile} session={session} getM={id=>id===session?.user?.id?myProfile:{initials:"?",color:"#888",name:"?"}} notify={notify} onImageView={onImageView}/>
        )}

         <ParametresModal myProfile={myProfile} session={session} onLogout={onLogout} notify={notify}/>
        <div style={{height:80}}/>
      </div>
    </div>
  );
}

// ── THEME TOGGLE ──────────────────────────────────────────
function ThemeToggle(){
  const [mode,setMode]=useState(()=>localStorage.getItem("celeste_theme")||"dark");
  const toggle=()=>{
    const next=mode==="dark"?"light":"dark";
    setAppTheme(next);setMode(next);
    // Force re-render of the whole app by reloading
    window.location.reload();
  };
  return(
    <div style={{marginTop:12}}>
      <Btn onClick={toggle} style={{width:"100%",padding:"14px 16px",background:T.card,border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
        <span style={{fontSize:20}}>{mode==="dark"?"🌙":"☀️"}</span>
        <div style={{flex:1}}>
          <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>Thème {mode==="dark"?"Noir-Doré":"Blanc-Doré"}</p>
          <p style={{margin:0,fontSize:11,color:T.muted}}>Basculer vers le thème {mode==="dark"?"Blanc-Doré ☀️":"Noir-Doré 🌙"}</p>
        </div>
        <div style={{width:42,height:24,borderRadius:12,background:mode==="dark"?"#1a1a1a":T.gradGold,border:`1px solid ${T.border}`,position:"relative",transition:"background .3s"}}>
          <div style={{position:"absolute",top:2,left:mode==="dark"?2:18,width:20,height:20,borderRadius:"50%",background:mode==="dark"?T.muted:T.gold,transition:"left .3s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
        </div>
      </Btn>
    </div>
  );
}

// ── ABOUT SECTION ─────────────────────────────────────────
function AboutSection(){
  const [open,setOpen]=useState(false);
  return(
    <>
      <div style={{marginTop:20,paddingTop:20,borderTop:`1px solid ${T.border}`}}>
        <Btn onClick={()=>setOpen(true)} style={{width:"100%",padding:"14px 16px",background:T.card,border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
          <span style={{fontSize:20}}>✦</span>
          <div style={{flex:1}}>
            <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>À propos de Céleste</p>
            <p style={{margin:0,fontSize:11,color:T.muted}}>Version · Contact · Mentions</p>
          </div>
          <ChevronRight size={16} style={{color:T.muted}}/>
        </Btn>
      </div>
      {open&&(
        <div style={{position:"fixed",inset:0,zIndex:900,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setOpen(false)}>
          <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:520,padding:"32px 28px 48px",animation:"slideUp .35s cubic-bezier(0.34,1.1,0.64,1)"}} onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:"center",marginBottom:28}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:56,color:T.gold,filter:"drop-shadow(0 0 20px rgba(201,149,42,0.5))",lineHeight:1,marginBottom:12}}>✦</div>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontWeight:300,color:T.text,letterSpacing:4,margin:"0 0 4px"}}>Céleste</h2>
              <p style={{color:T.gold,fontSize:12,letterSpacing:2,textTransform:"uppercase",margin:0}}>Premium v4.0</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:28}}>
              <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
                <p style={{margin:"0 0 4px",fontSize:12,fontWeight:700,color:T.goldL,letterSpacing:.5,textTransform:"uppercase"}}>Mission</p>
                <p style={{margin:0,fontSize:13,color:T.sub,lineHeight:1.7}}>Céleste est le réseau privé des jeunes. Un espace pour exprimer ta vraie personnalité, rencontrer des personnes qui te ressemblent et créer des liens authentiques qui comptent vraiment.</p>
              </div>
              <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
                <p style={{margin:"0 0 6px",fontSize:12,fontWeight:700,color:T.goldL,letterSpacing:.5,textTransform:"uppercase"}}>Organisation</p>
                <p style={{margin:"0 0 2px",fontSize:16,color:T.gold,fontFamily:"'Cormorant Garamond',serif",letterSpacing:2}}>✦ DES-ETOILES. ✦</p>
              </div>
              <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
                <p style={{margin:"0 0 8px",fontSize:12,fontWeight:700,color:T.goldL,letterSpacing:.5,textTransform:"uppercase"}}>Contact</p>
                <a href="mailto:mrdesetoiles@gmail.com" style={{display:"flex",alignItems:"center",gap:8,color:T.sub,fontSize:13,textDecoration:"none",marginBottom:6}}>
                  <span style={{fontSize:16}}>✉️</span> mrdesetoiles@gmail.com
                </a>
                <a href="https://wa.me/242067131327" target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:8,color:T.sub,fontSize:13,textDecoration:"none"}}>
                  <span style={{fontSize:16}}>💬</span> WhatsApp : +242 067 131 327
                </a>
              </div>
            </div>
            <Btn onClick={()=>setOpen(false)} style={{width:"100%",padding:"14px",background:T.gradGold,borderRadius:14,color:"#000",fontSize:14,fontWeight:700}}>Fermer</Btn>
          </div>
        </div>
      )}
    </>
  );
}

// ── ADMIN PANEL ───────────────────────────────────────────
function AdminPanel({onClose,notify,reload,reloadPosts}){
  const [list,setList]=useState([]);
  const [allReports,setAllReports]=useState([]);
  const [allPosts,setAllPosts]=useState([]);
  const [filter,setFilter]=useState("pending");
  const [showPosts,setShowPosts]=useState(false);

  useEffect(()=>{
    sb.from("profiles").select("*").then(({data})=>setList((data||[]).map(normProfile)));
    sb.from("reports").select(`*,reporter:profiles!reports_reporter_id_fkey(prenom,nom),reported:profiles!reports_reported_id_fkey(prenom,nom)`).order("created_at",{ascending:false}).then(({data})=>setAllReports(data||[]));
    sb.from("posts").select(`*,author:profiles(id,prenom,nom)`).order("created_at",{ascending:false}).limit(50).then(({data})=>setAllPosts(data||[]));
  },[]);

  const approve=async(id)=>{
    await sb.from("profiles").update({status:"actif",updated_at:new Date().toISOString()}).eq("id",id);
    setList(p=>p.map(m=>m.id===id?{...m,status:"actif"}:m));
    reload();notify("Membre approuvé ✦");
  };
  const reject=async id=>{
    if(!window.confirm("Rejeter et supprimer ?"))return;
    await sb.auth.admin?.deleteUser(id);
    await sb.from("profiles").delete().eq("id",id);
    setList(p=>p.filter(m=>m.id!==id));notify("Rejeté");
  };
  const suspend=async(id,status)=>{
    const ns=status==="suspended"?"active":"suspended";
    const{error}=await sb.from("profiles").update({status:ns}).eq("id",id);
    if(error){notify("Erreur : "+error.message);return;}
    // Recharge la liste depuis Supabase pour refléter l'état réel
    const{data}=await sb.from("profiles").select("*").order("joined_at",{ascending:false});
if(data)setList(data.map(normProfile));
    reload?.();
    notify(ns==="suspended"?"🚫 Suspendu":"✓ Réactivé avec succès");
  };
  const chBadge=async(id,badge)=>{
    await sb.from("profiles").update({badge}).eq("id",id);
    setList(p=>p.map(m=>m.id===id?{...m,badge}:m));
    notify("Badge mis à jour ✦");
  };
  const togglePin=async(pid,pinned)=>{
    await sb.from("posts").update({pinned:!pinned}).eq("id",pid);
    setAllPosts(p=>p.map(x=>x.id===pid?{...x,pinned:!pinned}:x));
    reloadPosts?.();notify(pinned?"Désépinglé":"Épinglé ✦");
  };

  const allMembers=(list||[]).filter(m=>m.status!=="pending");
  const pending=(list||[]).filter(m=>m.status==="pending");
  const suspended=(list||[]).filter(m=>m.status==="suspended");
  const displayList=filter==="pending"?pending:filter==="suspended"?suspended:filter==="reports"?[]:(list||[]).filter(m=>m.id);

  return(
    <div style={{position:"fixed",inset:0,zIndex:900,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:640,maxHeight:"90vh",display:"flex",flexDirection:"column",animation:"slideUp .35s cubic-bezier(0.34,1.1,0.64,1)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 16px 12px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div>
            <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,color:T.goldL}}>🛡 Administration</h2>
            <p style={{margin:0,fontSize:12,color:T.muted}}>{(list||[]).length} membres · {pending.length} en attente · {allReports.length} signalements</p>
          </div>
          <Btn onClick={onClose} style={{color:T.muted,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.04)",borderRadius:"50%",border:`1px solid ${T.border}`}}><X size={16}/></Btn>
        </div>
        <div style={{display:"flex",gap:4,padding:"12px 16px",borderBottom:`1px solid ${T.border}`,flexShrink:0,overflowX:"auto"}}>
          {[{id:"pending",l:`En attente (${pending.length})`},{id:"all",l:"Tous"},{id:"suspended",l:`Suspendus (${suspended.length})`},{id:"reports",l:`Signalements (${allReports.length})`}].map(f=>(
            <Btn key={f.id} onClick={()=>setFilter(f.id)} style={{padding:"7px 14px",borderRadius:20,background:filter===f.id?T.goldBg:"rgba(255,255,255,0.03)",border:`1px solid ${filter===f.id?T.gold+"44":T.border}`,color:filter===f.id?T.goldL:T.muted,fontSize:12,fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}>
              {f.l}
            </Btn>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          {filter==="reports"
            ?<div>
              {(allReports||[]).length===0&&<p style={{textAlign:"center",padding:30,color:T.muted,fontStyle:"italic"}}>Aucun signalement</p>}
              {(allReports||[]).map(r=>(
                <div key={r.id} style={{padding:"14px 16px",borderBottom:`1px solid ${T.border}`,background:"rgba(200,64,64,0.03)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                    <span style={{fontSize:10,background:"rgba(200,64,64,0.12)",color:T.err,padding:"2px 8px",borderRadius:20,fontWeight:700}}>🚨 SIGNALEMENT</span>
                    <span style={{fontSize:10,color:T.muted}}>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <p style={{margin:"0 0 3px",fontSize:13,color:T.text}}><strong>Signalé :</strong> {r.reported?.prenom} {r.reported?.nom}</p>
                  <p style={{margin:"0 0 3px",fontSize:12,color:T.muted}}><strong>Par :</strong> {r.reporter?.prenom} {r.reporter?.nom}</p>
                  <p style={{margin:"0 0 3px",fontSize:12,color:T.goldL}}><strong>Raison :</strong> {r.reason}</p>
                  {r.details&&<p style={{margin:0,fontSize:11,color:T.muted,fontStyle:"italic"}}>{r.details}</p>}
                </div>
              ))}
            </div>
            :<>
              {(displayList||[]).length===0&&<p style={{textAlign:"center",padding:30,color:T.muted,fontStyle:"italic"}}>Aucun membre</p>}
              {(displayList||[]).map(m=>(
                <div key={m.id} style={{padding:"14px 16px",borderBottom:`1px solid ${T.border}`,background:m.status==="pending"?"rgba(201,149,42,0.03)":m.status==="suspended"?"rgba(200,64,64,0.03)":"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:10}}>
                    <Av u={m} size={44}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3,flexWrap:"wrap"}}>
                        <span style={{fontSize:13,fontWeight:600,color:T.text}}>{m.fullName||m.name}</span>
                        {m.status==="pending"&&<span style={{fontSize:8,background:"rgba(201,149,42,0.12)",color:T.goldL,padding:"2px 8px",borderRadius:20,fontWeight:700,letterSpacing:.5}}>EN ATTENTE</span>}
                        {m.status==="suspended"&&<span style={{fontSize:8,background:"rgba(200,64,64,0.12)",color:T.err,padding:"2px 8px",borderRadius:20,fontWeight:700,letterSpacing:.5}}>SUSPENDU</span>}
                      </div>
                      <p style={{margin:0,fontSize:11,color:T.muted}}>📍 {m.paroisse} · {m.joined}</p>
                      {m.whatsapp&&<a href={`https://wa.me/${m.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#25D366",fontWeight:600,display:"inline-flex",alignItems:"center",gap:4,marginTop:3,textDecoration:"none"}}>📱 {m.whatsapp}</a>}
                    </div>
                  </div>
                  {m.status==="pending"
                    ?<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <Btn onClick={()=>approve(m.id)} style={{flex:1,padding:"8px",background:"rgba(64,168,96,0.08)",border:"1px solid rgba(64,168,96,0.2)",borderRadius:10,color:T.ok,fontSize:11,fontWeight:700}}>✓ Approuver</Btn>
                      <Btn onClick={()=>reject(m.id)} style={{padding:"8px 12px",background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:10,color:T.err,fontSize:11,fontWeight:700}}><Trash2 size={14}/></Btn>
                    </div>
                    :<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <Btn onClick={()=>chBadge(m.id,"confirmed")} style={{padding:"5px 11px",background:m.badge==="confirmed"?T.goldBg:"rgba(255,255,255,0.03)",border:`1px solid ${m.badge==="confirmed"?T.gold+"44":T.border}`,borderRadius:9,color:m.badge==="confirmed"?T.goldL:T.muted,fontSize:11,fontWeight:600}}>✅ Confirmé</Btn>
                      <Btn onClick={()=>chBadge(m.id,"friend")} style={{padding:"5px 11px",background:m.badge==="friend"?T.navyBg:"rgba(255,255,255,0.03)",border:`1px solid ${m.badge==="friend"?T.navy+"44":T.border}`,borderRadius:9,color:m.badge==="friend"?T.navy:T.muted,fontSize:11,fontWeight:600}}>🔵 Ami</Btn>
                      {m.badge&&<Btn onClick={()=>chBadge(m.id,null)} style={{padding:"5px 11px",background:"rgba(200,64,64,0.06)",border:`1px solid ${T.err}33`,borderRadius:9,color:T.err,fontSize:11,fontWeight:600}}>✕ Révoquer</Btn>}
                      <Btn onClick={()=>suspend(m.id,m.status)} style={{padding:"5px 11px",background:m.status==="suspended"?"rgba(64,168,96,0.08)":"rgba(200,64,64,0.08)",border:`1px solid ${m.status==="suspended"?T.ok+"44":T.err+"44"}`,borderRadius:9,color:m.status==="suspended"?T.ok:T.err,fontSize:11,fontWeight:600,marginLeft:"auto"}}>{m.status==="suspended"?"✓ Réactiver":"🚫 Suspendre"}</Btn>
                    </div>
                  }
                </div>
              ))}
            </>
          }
        </div>
        <div style={{padding:"12px 16px",borderTop:`1px solid ${T.border}`,flexShrink:0,display:"flex",flexDirection:"column",gap:8}}>
          <Btn onClick={()=>setShowPosts(!showPosts)} style={{width:"100%",padding:"11px",background:T.goldBg,border:`1px solid ${T.gold}33`,borderRadius:12,color:T.goldL,fontSize:13,fontWeight:600}}>
            📌 {showPosts?"Masquer":"Gérer les posts épinglés"}
          </Btn>
          {showPosts&&(
            <div style={{maxHeight:300,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
              {(allPosts||[]).map(p=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:T.card,borderRadius:12,border:`1px solid ${p.pinned?T.gold+"44":T.border}`}}>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:0,fontSize:12,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.text||p.event_title||"Post sans texte"}</p>
                    <p style={{margin:0,fontSize:10,color:T.muted}}>{p.author?.prenom} {p.author?.nom?.[0]}. · {new Date(p.created_at).toLocaleDateString("fr")}</p>
                  </div>
                  <Btn onClick={()=>togglePin(p.id,p.pinned)} style={{padding:"5px 10px",background:p.pinned?"rgba(200,64,64,0.08)":T.goldBg,border:`1px solid ${p.pinned?T.err+"44":T.gold+"44"}`,borderRadius:8,color:p.pinned?T.err:T.goldL,fontSize:11,fontWeight:700,flexShrink:0}}>
                    {p.pinned?"❌ Désponsoriser":"✦ Sponsoriser"}
                  </Btn>
                </div>
              ))}
            </div>
          )}
          <Btn onClick={onClose} style={{width:"100%",padding:"11px",background:"rgba(200,64,64,0.06)",border:`1px solid ${T.err}33`,borderRadius:12,color:T.err,fontSize:13,fontWeight:600}}>Fermer</Btn>
        </div>
      </div>
    </div>
  );
}

// ── CELESTE CHAT SCREEN ───────────────────────────────────
function CelesteChatScreen({msgs,setMsgs,onClose,myProfile,session}){
  const [inp,setInp]=useState("");
  const [loading,setLoading]=useState(false);
  const bottomRef=useRef();

  const loadedRef = useRef(false);
  useEffect(()=>{
    if(!session?.user?.id||loadedRef.current)return;
    loadedRef.current=true;
    if(msgs.length>0)return;
    sb.from("celeste_messages").select("*").eq("user_id",session.user.id).order("created_at",{ascending:true})
      .then(({data})=>{
        if(data&&data.length>0)setMsgs(data.map(m=>({role:m.role,text:m.text})));
      });
  },[session?.user?.id]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const send=async()=>{
    if(!inp.trim()||loading)return;
    const text=inp.trim();
    setInp("");
    setMsgs(p=>[...p,{role:"user",text}]);
    if(session?.user?.id)await sb.from("celeste_messages").insert({user_id:session.user.id,role:"user",text});
    setLoading(true);
    
    const tryGemini=async(retries=3)=>{
      for(let i=0;i<retries;i++){
        try{
          const rawHistory=[...msgs,{role:"user",text}];
const history=rawHistory.reduce((acc,m)=>{
  const last=acc[acc.length-1];
  const role=m.role==="user"?"user":"model";
  if(last&&last.role===role){last.parts[0].text+="\n"+m.text;}
  else{acc.push({role,parts:[{text:m.text}]});}
  return acc;
},[]);
          const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({
              systemInstruction:{parts:[{text:CELESTE_SYSTEM}]},
              contents:[...history,{role:"user",parts:[{text}]}],
              generationConfig:{temperature:0.4,maxOutputTokens:2048}
            })
          });
          if(!res.ok){if(i<retries-1){await new Promise(r=>setTimeout(r,1500));continue;}throw new Error("503");}
          const data=await res.json();
          const reply=data.candidates?.[0]?.content?.parts?.[0]?.text||"Je n'ai pas pu répondre.";
          setMsgs(p=>[...p,{role:"model",text:reply}]);
          if(session?.user?.id)await sb.from("celeste_messages").insert({user_id:session.user.id,role:"model",text:reply});
          return;
        }catch{if(i<retries-1){await new Promise(r=>setTimeout(r,1500));continue;}}
      }
      setMsgs(p=>[...p,{role:"model",text:"Je suis momentanément indisponible, réessaie dans quelques secondes 🙏"}]);
    };
    await tryGemini();
    setLoading(false);
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:400,background:T.bg,display:"flex",flexDirection:"column",animation:"slideIn .3s ease"}}>
      {/* Header */}
      <div style={{padding:"12px 16px",paddingTop:"calc(12px + env(safe-area-inset-top,0px))",background:"rgba(0,0,0,0.95)",backdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <Btn onClick={onClose} style={{color:T.gold,display:"flex",alignItems:"center"}}><ChevronLeft size={24}/></Btn>
        <div style={{width:42,height:42,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 4px 16px rgba(123,47,190,0.4)"}}>✨</div>
        <div style={{flex:1}}>
          <p style={{margin:0,fontSize:15,fontWeight:700,color:T.text}}>Céleste IA</p>
          <p style={{margin:0,fontSize:11,color:"#9B6FDE"}}>● En ligne</p>
        </div>
        <Btn onClick={()=>{if(window.confirm("Effacer la conversation ?"))setMsgs([]);}} style={{color:T.muted,fontSize:12,padding:"6px 10px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:10}}>Effacer</Btn>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:12}}>
        {msgs.length===0&&(
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,color:T.muted,textAlign:"center",padding:"60px 20px"}}>
            <div style={{width:90,height:90,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,boxShadow:"0 8px 32px rgba(123,47,190,0.4)",animation:"float 3s ease infinite"}}>✨</div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,color:T.text}}>Bonjour{myProfile?.prenom?" "+myProfile.prenom:""} !</p>
            <p style={{fontSize:14,color:T.sub,lineHeight:1.8}}>Je suis Céleste, toujours là pour t'écouter, t'encourager et t'accompagner.<br/>De quoi as-tu besoin aujourd'hui ?</p>
          </div>
        )}
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",gap:10,animation:"msgIn .3s ease"}}>
            {m.role==="model"&&(
              <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>✨</div>
            )}
            <div style={{maxWidth:"78%",background:m.role==="user"?T.gradGold:"rgba(123,47,190,0.1)",borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"12px 16px",border:m.role==="model"?"1px solid rgba(123,47,190,0.2)":"none",boxShadow:m.role==="user"?"0 4px 16px rgba(201,149,42,0.25)":"0 2px 8px rgba(0,0,0,0.2)"}}>
              <p style={{margin:0,fontSize:14,color:m.role==="user"?"#000":T.text,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{m.text}</p>
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>✨</div>
            <div style={{background:"rgba(123,47,190,0.1)",borderRadius:"18px 18px 18px 4px",padding:"12px 16px",border:"1px solid rgba(123,47,190,0.2)"}}>
              <div style={{display:"flex",gap:5,alignItems:"center"}}>
                {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:"#9B6FDE",animation:`pulse .6s ease ${i*.2}s infinite`}}/>)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{padding:"10px 12px",paddingBottom:"calc(10px + env(safe-area-inset-bottom,0px))",background:"rgba(0,0,0,0.96)",backdropFilter:"blur(20px)",borderTop:`1px solid ${T.border}`,display:"flex",gap:8,alignItems:"flex-end",flexShrink:0}}>
        <div style={{flex:1,background:"rgba(123,47,190,0.06)",border:"1px solid rgba(123,47,190,0.2)",borderRadius:20,padding:"10px 16px"}}>
          <textarea value={inp} onChange={e=>{
    setInp(e.target.value);
    e.target.style.height="auto";
    e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";
  }}
  onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&window.innerWidth>768){e.preventDefault();send();}}}
  placeholder="Écris à Céleste…" rows={1}
  style={{width:"100%",background:"none",border:"none",color:T.text,fontSize:14,outline:"none",resize:"none",lineHeight:1.5,maxHeight:120,overflowY:"auto",height:"auto"}}/>
        </div>
        <Btn onClick={send} disabled={loading||!inp.trim()} style={{background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",borderRadius:"50%",width:42,height:42,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 16px rgba(123,47,190,0.4)",opacity:loading||!inp.trim()?0.5:1}}>
          <Send size={18}/>
        </Btn>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────
function SplashScreen(){
  const [phase,setPhase]=useState("loading"); // loading → warning → closing

  useEffect(()=>{
    const t1=setTimeout(()=>setPhase("warning"),15000);
    const t2=setTimeout(()=>setPhase("closing"),30000);
    const t3=setTimeout(()=>{
  document.body.innerHTML=`<div style="min-height:100vh;background:#000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:24px;text-align:center">
    <span style="font-size:60px">✦</span>
    <p style="color:#C9952A;font-size:18px;font-family:serif">Céleste</p>
    <p style="color:#888;font-size:13px">Impossible de se connecter.<br/>Veuillez réessayer.</p>
    <button onclick="window.location.reload()" style="margin-top:16px;padding:12px 28px;background:linear-gradient(135deg,#C9952A,#E8B84B);border:none;border-radius:14px;color:#000;font-size:14px;font-weight:700;cursor:pointer">Réessayer</button>
  </div>`;
},31000);
    return()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);};
  },[]);

  return(
    <div style={{minHeight:"100vh",background:"#000",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:0,position:"relative",overflow:"hidden"}}>
      <style>{GS}</style>
      <div style={{position:"absolute",top:"20%",left:"50%",transform:"translateX(-50%)",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(201,149,42,0.08),transparent 70%)",pointerEvents:"none",animation:"glowPulse 2s ease infinite"}}/>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:90,color:T.gold,animation:"starPulse 2s ease infinite",lineHeight:1,filter:"drop-shadow(0 0 40px rgba(201,149,42,0.6))"}}>✦</div>
      <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:52,fontWeight:300,color:T.text,letterSpacing:7,margin:"20px 0 8px",animation:"titleReveal .8s ease .3s both"}}>Céleste</h1>
      <p style={{color:T.muted,fontSize:11,letterSpacing:3,textTransform:"uppercase",animation:"titleReveal .8s ease .6s both"}}>Exprime ta vrai personnalitée</p>

      {phase==="warning"&&(
        <div style={{position:"absolute",bottom:60,left:20,right:20,background:"rgba(201,149,42,0.08)",border:`1px solid ${T.gold}44`,borderRadius:20,padding:"16px 20px",textAlign:"center",animation:"fadeUp .5s ease"}}>
          <p style={{margin:"0 0 6px",fontSize:14,color:T.goldL,fontWeight:600}}>Connexion lente…</p>
          <p style={{margin:0,fontSize:12,color:T.muted}}>Connectez-vous pour accéder à Céleste</p>
        </div>
      )}

      {phase==="closing"&&(
        <div style={{position:"absolute",bottom:60,left:20,right:20,background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:20,padding:"16px 20px",textAlign:"center",animation:"fadeUp .3s ease"}}>
          <p style={{margin:"0 0 6px",fontSize:14,color:T.err,fontWeight:600}}>Impossible de se connecter</p>
          <p style={{margin:0,fontSize:12,color:T.muted}}>L'application va se fermer…</p>
        </div>
      )}
    </div>
  );
}

function CelesteApp(){
  const [authMode,setAuthMode]=useState("login");
  const [session,setSession]=useState(undefined);
  const [myProfile,setMyProfile]=useState(null);
  const [isPending,setIsPending]=useState(false);
  const [members,setMembers]=useState([]);
  const [posts,setPosts]=useState([]);
  const [convs,setConvs]=useState([]);
  const [myConnections,setMyConnections]=useState([]);
  const [myFollowers,setMyFollowers]=useState([]);
  const [blockedUserIds,setBlockedUserIds]=useState([]);
  const [chatDrafts,setChatDrafts]=useState({});
  const [tab,setTab]=useState("home");
  const [openConvId,setOpenConvId]=useState(null);
  const [openUserId,setOpenUserId]=useState(null);
  const [openUser,setOpenUser]=useState(null);
  const [showNewPost,setShowNewPost]=useState(false);
  const [showAdmin,setShowAdmin]=useState(false);
  const [showNotifs,setShowNotifs]=useState(false);
  const [toast,setToast]=useState(null);
  const [postPage,setPostPage]=useState(1);
  const [hasMorePosts,setHasMorePosts]=useState(true);
  const [loadingMore,setLoadingMore]=useState(false);
  const [inAppNotifs,setInAppNotifs]=useState([]);
  const [viewImg,setViewImg]=useState(null);
const [openCeleste,setOpenCeleste]=useState(false);
const [celesteMsgs,setCelesteMsgs]=useState([]);
  const feedScrollRef=useRef(0);
  const [unreadNotifs,setUnreadNotifs]=useState(0);
  const [hideNav,setHideNav]=useState(false);
const [hideChrome,setHideChrome]=useState(false);

useEffect(()=>{
  const onFocus=()=>setHideChrome(true);
  const onBlur=()=>setHideChrome(false);
  window.addEventListener("focusin",onFocus);
  window.addEventListener("focusout",onBlur);
  return()=>{
    window.removeEventListener("focusin",onFocus);
    window.removeEventListener("focusout",onBlur);
  };
},[]);
  const prevMsgCount=useRef(0);
useEffect(()=>{
  const handler=e=>setViewImg(e.detail?.url);
  window.addEventListener("celeste_view_img",handler);
  return()=>window.removeEventListener("celeste_view_img",handler);
},[]);

  useEffect(()=>{
  const unlock=()=>{
    try{
      const ctx=new(window.AudioContext||window.webkitAudioContext)();
      if(ctx.state==='suspended')ctx.resume();
      window.removeEventListener('click',unlock);
      window.removeEventListener('touchstart',unlock);
    }catch(_){}
  };
  window.addEventListener('click',unlock);
  window.addEventListener('touchstart',unlock);
  return()=>{
    window.removeEventListener('click',unlock);
    window.removeEventListener('touchstart',unlock);
  };
},[]);

  const notify=useCallback(m=>{setToast(m);setTimeout(()=>setToast(null),2800);},[]);
  const addInAppNotif=useCallback((icon,title,body,action)=>{const id=Date.now()+Math.random();setInAppNotifs(p=>[...p,{id,icon,title,body,action}]);playNotifSound();sendPushNotif(title,body);setTimeout(()=>setInAppNotifs(p=>p.filter(n=>n.id!==id)),5000);},[]);
  const dismissNotif=useCallback(id=>setInAppNotifs(p=>p.filter(n=>n.id!==id)),[]);

  const loadMyProfile=useCallback(async uid=>{const{data}=await sb.from("profiles").select("*").eq("id",uid).single();if(data){setMyProfile(normProfile(data));setIsPending(data.status==="pending");}},[]);
  const loadConnections=useCallback(async uid=>{if(!uid)return;const[{data:following},{data:followers}]=await Promise.all([sb.from("connections").select("to_id").eq("from_id",uid),sb.from("connections").select("from_id").eq("to_id",uid)]);if(following)setMyConnections(following.map(d=>d.to_id));if(followers)setMyFollowers(followers.map(d=>d.from_id));},[]);

  // Load unread notifs count
  const loadUnreadNotifs=useCallback(async uid=>{if(!uid)return;const{count}=await sb.from("notifications").select("*",{count:"exact",head:true}).eq("user_id",uid).eq("read",false);setUnreadNotifs(count||0);},[]);

  useEffect(()=>{
    if(!openUserId){setOpenUser(null);return;}
    const found=(members||[]).find(m=>m.id===openUserId);
    if(found){setOpenUser(found);return;}
    sb.from("profiles").select("*").eq("id",openUserId).single().then(({data})=>{if(data)setOpenUser(normProfile(data));});
  },[openUserId,members]);

  useEffect(()=>{
    sb.auth.getSession().then(({data:{session:s}})=>{setSession(s||null);if(s){loadMyProfile(s.user.id);subscribePush(sb,s.user.id);}});
    const{data:{subscription}}=sb.auth.onAuthStateChange((_e,s)=>{setSession(s||null);if(s){loadMyProfile(s.user.id);subscribePush(sb,s.user.id);}else{setMyProfile(null);setIsPending(false);}});
    return()=>subscription.unsubscribe();
  },[loadMyProfile]);

  const loadMembers=useCallback(async()=>{const{data}=await sb.from("profiles").select("*").neq("status","pending");if(data)setMembers(data.map(normProfile));},[]);

  const loadBlockedUsers=useCallback(async()=>{
    if(!session?.user?.id)return[];
    const{data}=await sb.from("blocks").select("blocked_id").eq("blocker_id",session.user.id);
    const ids=(data||[]).map(b=>b.blocked_id);
    setBlockedUserIds(ids);
    return ids;
  },[session?.user?.id]);

  const loadPosts=useCallback(async(page=1)=>{
    const from=(page-1)*PAGE_SIZE,to=from+PAGE_SIZE-1;
    const{data}=await sb.from("posts").select(`*,author:profiles(id,prenom,nom,badge,avatar_url,paroisse),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url),replies:comment_replies(id))`).order("created_at",{ascending:false}).range(from,to);
    if(data){
      const{data:conns}=await sb.from("connections").select("to_id").eq("from_id",session?.user?.id);
      const followedIds=new Set((conns||[]).map(c=>c.to_id));
      const mapped=data.map(p=>({id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,text:p.text||"",img:p.img_url||null,media_urls:p.media_urls||[],title:p.event_title||null,eventDate:p.event_date||null,eventLoc:p.event_loc||null,likes:(p.likes||[]).map(l=>l.user_id),comments:(p.comments||[]).map(c=>({id:c.id,by:c.author?.id,author:normProfile(c.author||{}),text:c.text,ts:new Date(c.created_at).getTime(),repliesCount:(c.replies||[]).length})),saved:[],ts:new Date(p.created_at).getTime(),isFollowed:followedIds.has(p.author_id),pinned:p.pinned||false}));
      const blockedSet=new Set(blockedUserIds);
      const visible=mapped.filter(p=>!blockedSet.has(p.by));
      const sorted=[
        ...visible.filter(p=>p.pinned),
        ...visible.filter(p=>!p.pinned&&p.author?.badge==="confirmed"&&p.isFollowed),
        ...visible.filter(p=>!p.pinned&&p.author?.badge==="friend"&&p.isFollowed),
        ...visible.filter(p=>!p.pinned&&!p.author?.badge&&p.isFollowed),
        ...visible.filter(p=>!p.pinned&&p.author?.badge==="confirmed"&&!p.isFollowed),
        ...visible.filter(p=>!p.pinned&&p.author?.badge==="friend"&&!p.isFollowed),
        ...visible.filter(p=>!p.pinned&&!p.author?.badge&&!p.isFollowed),
      ];
      if(page===1)setPosts(sorted);else setPosts(prev=>{const ids=new Set((prev||[]).map(p=>p.id));return[...(prev||[]),...sorted.filter(p=>!ids.has(p.id))];});
      setHasMorePosts(data.length===PAGE_SIZE);setPostPage(page);
    }
  },[session?.user?.id]);

  const loadMorePosts=useCallback(async()=>{if(loadingMore||!hasMorePosts)return;setLoadingMore(true);await loadPosts(postPage+1);setLoadingMore(false);},[loadingMore,hasMorePosts,postPage,loadPosts]);

  const refreshPost=useCallback(async pid=>{
    const{data}=await sb.from("posts").select(`*,author:profiles(id,prenom,nom,badge,avatar_url,paroisse),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).eq("id",pid).single();
    if(!data)return null;
    const updated={id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,media_urls:data.media_urls||[],title:data.event_title||null,eventDate:data.event_date||null,eventLoc:data.event_loc||null,likes:(data.likes||[]).map(l=>l.user_id),comments:(data.comments||[]).map(c=>({id:c.id,by:c.author?.id,author:normProfile(c.author||{}),text:c.text,ts:new Date(c.created_at).getTime()})),saved:[],ts:new Date(data.created_at).getTime()};
    setPosts(prev=>(prev||[]).map(p=>p.id===pid?updated:p));return updated;
  },[]);

 const loadConvs=useCallback(async myId=>{
    if(!myId)return;
    const[{data},{data:blockedData}]=await Promise.all([
      sb.from("conversations").select(`*,messages(id,sender_id,type,text,file_url,file_name,is_read,created_at,reply_metadata)`).or(`user1_id.eq.${myId},user2_id.eq.${myId}`).order("created_at",{ascending:false}),
      sb.from("blocks").select("blocked_id").eq("blocker_id",myId)
    ]);
    if(data){
      const blocked=new Set((blockedData||[]).map(b=>b.blocked_id));
      const mapped=data.map(c=>({id:c.id,uid:c.user1_id===myId?c.user2_id:c.user1_id,msgs:(c.messages||[]).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).map(m=>({id:m.id,f:m.sender_id===myId?"me":m.sender_id,type:m.type,text:m.text||"",img:m.file_url,fileName:m.file_name,read:m.is_read,ts:new Date(m.created_at).getTime()}))}));
      const filtered=mapped.filter(c=>!blocked.has(c.uid));
      setConvs(filtered);return filtered;
    }return null;
  },[]);
useEffect(()=>{
  if(session?.user?.id&&myProfile?.id&&!isPending){
    loadMembers();
    loadPosts(1);
    loadConnections(session.user.id);
    loadUnreadNotifs(session.user.id);
    loadBlockedUsers().then(()=>loadConvs(session.user.id));
  }
},[session?.user?.id,myProfile?.id,isPending]);
  useEffect(()=>{
  const handleBack=e=>{
    if(openConvId){setOpenConvId(null);window.history.pushState(null,"",window.location.href);return;}
    if(openUserId){setOpenUserId(null);window.history.pushState(null,"",window.location.href);return;}
    if(showNotifs){setShowNotifs(false);window.history.pushState(null,"",window.location.href);return;}
    if(showAdmin){setShowAdmin(false);window.history.pushState(null,"",window.location.href);return;}
    if(showNewPost){setShowNewPost(false);window.history.pushState(null,"",window.location.href);return;}
    if(openCeleste){setOpenCeleste(false);window.history.pushState(null,"",window.location.href);return;}
    if(tab!=="home"){setTab("home");window.history.pushState(null,"",window.location.href);return;}
  };
  window.addEventListener("popstate",handleBack);
  window.history.pushState(null,"",window.location.href);
  return()=>window.removeEventListener("popstate",handleBack);
},[openConvId,openUserId,showNotifs,showAdmin,showNewPost,openCeleste,tab]);

  // Realtime
  useEffect(()=>{
    if(!session?.user)return;
    const myId=session.user.id;
    const handleOpenUser=e=>setOpenUserId(e.detail.uid);
window.addEventListener("celeste_open_user",handleOpenUser);
    const ch=sb.channel("celeste_rt")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},async payload=>{
        const nm=payload.new;if(nm.sender_id===myId){loadConvs(myId);return;}
        const updated=await loadConvs(myId);
        if(updated){
          const totalNew=(updated||[]).reduce((a,c)=>a+(c.msgs||[]).filter(m=>m.f!=="me"&&!m.read).length,0);
          if(totalNew>prevMsgCount.current){const conv=(updated||[]).find(c=>(c.msgs||[]).some(m=>m.id===nm.id));const sender=(members||[]).find(m=>m.id===nm.sender_id);const preview=nm.type==="photo"?"📷 Photo":nm.type==="file"?"📎 Fichier":nm.text||"";addInAppNotif("✉",sender?.name||"Message",preview,()=>{setTab("messages");setTimeout(()=>{if(conv?.id){setOpenConvId(conv.id);}},100);});}
          prevMsgCount.current=totalNew;
        }
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"likes"},async payload=>{
        const pid=payload.new?.post_id;if(!pid)return;
        const updated=await refreshPost(pid);
        if(updated&&updated.by===myId&&payload.new?.user_id!==myId){const liker=(members||[]).find(m=>m.id===payload.new.user_id);addInAppNotif("❤️",`${liker?.name||"Quelqu'un"} a aimé`,updated.text||updated.title||"ta publication",()=>setTab("home"));}
      })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"likes"},payload=>{if(payload.old?.post_id)refreshPost(payload.old.post_id);})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"comments"},async payload=>{
        const cmt=payload.new;if(!cmt?.post_id)return;
        const updated=await refreshPost(cmt.post_id);
        if(updated&&updated.by===myId&&cmt.author_id!==myId){const commenter=(members||[]).find(m=>m.id===cmt.author_id);addInAppNotif("💬",`${commenter?.name||"Quelqu'un"} a commenté`,cmt.text||"…",()=>setTab("home"));}
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"comment_likes"},async payload=>{
        // Notification pour likes de commentaires
        const cl=payload.new;if(!cl||cl.user_id===myId)return;
        addInAppNotif("💛","Commentaire aimé","Quelqu'un a aimé votre commentaire",()=>setTab("home"));
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`user_id=eq.${myId}`},()=>{
        loadUnreadNotifs(myId);
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles"},payload=>{if(payload.new?.id===myId)loadMyProfile(myId);loadMembers();})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"connections"},async payload=>{
        if(payload.new?.to_id===myId){await loadConnections(myId);const follower=(members||[]).find(m=>m.id===payload.new.from_id);addInAppNotif("✦",`${follower?.name||"Quelqu'un"} s'est connecté`,"Nouvelle connexion !",()=>setTab("discover"));}
        else if(payload.new?.from_id===myId)loadConnections(myId);
      })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"connections"},async payload=>{
        loadConnections(myId);
        if(payload.old?.to_id===myId){const who=(members||[]).find(m=>m.id===payload.old.from_id);addInAppNotif("👋",`${who?.name||"Quelqu'un"} s'est désabonné`,"",()=>setTab("discover"));}
      })
      .subscribe();
   return()=>{
      window.removeEventListener("celeste_open_user",handleOpenUser);
      sb.removeChannel(ch);
    };
  },[session?.user?.id,members]);

  const goTab=t=>{
  if(t==="home"&&tab==="home"){loadPosts(1);feedScrollRef.current=0;}
  setTab(t);setOpenConvId(null);setOpenUserId(null);setShowNotifs(false);
};
  const unread=(convs||[]).reduce((a,c)=>a+(c.msgs||[]).filter(m=>m.f!=="me"&&!m.read).length,0);
  const pending=(members||[]).filter(m=>m.status==="pending").length;
  const getM=id=>{if(id==="me"||id===session?.user?.id)return myProfile;return(members||[]).find(m=>m.id===id)||{id:"?",initials:"?",color:"#888",name:"Inconnu",badge:null};};
  const openConv=(convs||[]).find(c=>c.id===openConvId);
  const openChat=uid=>{setOpenUserId(null);let c=(convs||[]).find(x=>x.uid===uid);if(!c){c={id:"cv"+Date.now(),uid,msgs:[]};setConvs(p=>[...(p||[]),c]);}setOpenConvId(c.id);setTab("messages");};

  // AppContext value
  const appCtx={
    session,myProfile,setMyProfile:()=>{},
    setTab,members,posts,
    notify,
    chatDrafts,setChatDrafts,
    hideNav,setHideNav,
  };

  // Splash screen
  if(session===undefined) return(
    <SplashScreen/>
  );

  if(!session) return(<><style>{GS}</style><AuthScreen mode={authMode} setMode={setAuthMode} onSuccess={state=>{if(state==="pending")setIsPending(true);}}/></>);

  if(myProfile?.status==="suspended") return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{GS}</style>
      <div style={{maxWidth:400,width:"100%",textAlign:"center",animation:"fadeUp .5s ease"}}>
        <div style={{fontSize:60,marginBottom:20}}>🚫</div>
        <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:300,color:T.err,marginBottom:12}}>Compte suspendu</h2>
        <p style={{color:T.sub,fontSize:14,lineHeight:1.8,marginBottom:28}}>Votre compte a été suspendu par un administrateur.<br/>Pour toute question, contactez le support de la communauté.</p>
        <Btn onClick={()=>{if(window.confirm("Se déconnecter ?"))sb.auth.signOut();}} style={{padding:"13px 30px",background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:14,color:T.err,fontSize:14,fontWeight:600}}>Se déconnecter</Btn>
      </div>
    </div>
  );

  if(isPending) return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{GS}</style>
      <div style={{maxWidth:400,width:"100%",textAlign:"center",animation:"fadeUp .5s ease"}}>
        <div style={{fontSize:60,marginBottom:20,animation:"float 3s ease infinite"}}>⏳</div>
        <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:300,color:T.text,marginBottom:12}}>Compte en attente</h2>
        <p style={{color:T.sub,fontSize:14,lineHeight:1.8,marginBottom:28}}>Bonjour <strong style={{color:T.goldL}}>{myProfile?.name}</strong> !<br/>Un administrateur vérifiera votre profil sous 24–48h.</p>
        <Btn onClick={()=>{if(window.confirm("Se déconnecter ?"))sb.auth.signOut();}} style={{padding:"13px 30px",background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:14,color:T.err,fontSize:14,fontWeight:600}}>Se déconnecter</Btn>

<VerificationInfoModal/>
      </div>
    </div>
  );
function VerificationInfoModal(){
  const [open,setOpen]=useState(false);
  return(
    <>
      <Btn onClick={()=>setOpen(true)} style={{marginTop:16,width:"100%",padding:"13px 30px",background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:14,color:T.muted,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        <span>ℹ️</span> En savoir plus sur la vérification
      </Btn>
      {open&&(
        <div style={{position:"fixed",inset:0,zIndex:900,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setOpen(false)}>
          <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:520,padding:"32px 24px 48px",animation:"slideUp .35s cubic-bezier(0.34,1.1,0.64,1)"}} onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:"center",marginBottom:24}}>
              <span style={{fontSize:40}}>🔐</span>
              <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:400,color:T.text,margin:"12px 0 4px"}}>Pourquoi une vérification ?</h3>
              <p style={{fontSize:12,color:T.gold,letterSpacing:1,textTransform:"uppercase"}}>Céleste · Réseau privé des jeunes</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:24}}>
              <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:16,padding:"16px"}}>
                <p style={{margin:"0 0 6px",fontSize:13,fontWeight:700,color:T.goldL}}>🔍 Comment ça fonctionne ?</p>
                <p style={{margin:0,fontSize:13,color:T.sub,lineHeight:1.8}}>Lors de la vérification, le nom que tu as saisi sera recherché sur les réseaux sociaux. Si un profil correspondant est trouvé, la vérification se fera automatiquement et rapidement.</p>
              </div>
              <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:16,padding:"16px"}}>
                <p style={{margin:"0 0 6px",fontSize:13,fontWeight:700,color:T.goldL}}>📱 Si aucun profil trouvé</p>
                <p style={{margin:0,fontSize:13,color:T.sub,lineHeight:1.8}}>La vérification se fera via WhatsApp, au numéro que tu as fourni lors de ton inscription. Ce numéro n'est ni partagé ni divulgué à qui que ce soit.</p>
              </div>
              <div style={{background:"rgba(200,64,64,0.05)",border:"1px solid rgba(200,64,64,0.2)",borderRadius:16,padding:"16px"}}>
                <p style={{margin:"0 0 6px",fontSize:13,fontWeight:700,color:T.err}}>⚖️ Engagement légal</p>
                <p style={{margin:0,fontSize:13,color:T.sub,lineHeight:1.8}}>Céleste est un espace réservé aux jeunes. Toute personne ayant fourni de fausses informations concernant son identité ou son âge, et dont l'âge réel dépasse 35 ans, s'expose à des poursuites judiciaires conformément aux lois en vigueur.</p>
              </div>
              <div style={{background:T.goldBg,border:`1px solid ${T.gold}33`,borderRadius:16,padding:"16px"}}>
                <p style={{margin:"0 0 6px",fontSize:13,fontWeight:700,color:T.goldL}}>🤝 Notre engagement</p>
                <p style={{margin:0,fontSize:13,color:T.sub,lineHeight:1.8}}>Cette vérification existe uniquement pour garantir ta sécurité et celle de tous les membres. Pour être sûrs d'être vraiment entre nous — entre jeunes.</p>
              </div>
            </div>
            <Btn onClick={()=>setOpen(false)} style={{width:"100%",padding:"14px",background:T.gradGold,borderRadius:14,color:"#000",fontSize:14,fontWeight:700}}>J'ai compris ✦</Btn>
          </div>
        </div>
      )}
    </>
  );
}
  return(
    <AppContext.Provider value={appCtx}>
      <div style={{display:"flex",flexDirection:"column",height:"100svh",background:T.bg,color:T.text,fontFamily:"'DM Sans',sans-serif"}}>
        <style>{GS}</style>
        {toast&&<Toast msg={toast}/>}
        {viewImg&&<ImageViewer url={viewImg} onClose={()=>setViewImg(null)}/>}
        <NotifBanner notifs={inAppNotifs} onDismiss={dismissNotif} onTap={n=>{n.action?.();dismissNotif(n.id);}}/>
        {showNewPost&&<NewPostModal myProfile={myProfile} session={session} onClose={()=>setShowNewPost(false)} onPost={()=>{loadPosts(1);setShowNewPost(false);notify("Publié ✦");}}/>}
        {showAdmin&&myProfile?.is_admin&&<AdminPanel onClose={()=>setShowAdmin(false)} notify={notify} reload={loadMembers} reloadPosts={()=>loadPosts(1)}/>}
{openCeleste&&<CelesteChatScreen msgs={celesteMsgs} setMsgs={setCelesteMsgs} onClose={()=>setOpenCeleste(false)} myProfile={myProfile} session={session}/>}

        <div style={{height:56,background:"rgba(0,0,0,0.95)",backdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,display:hideNav?"none":"flex",alignItems:"center",padding:"0 16px",gap:12,flexShrink:0,zIndex:30}}>
          {(openConvId||openUserId)
            ?<>
              <Btn onClick={()=>{setOpenConvId(null);setOpenUserId(null);}} style={{color:T.gold,padding:"0 8px 0 0",display:"flex",alignItems:"center"}}><ChevronLeft size={24}/></Btn>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:400,color:T.text}}>{openConvId?getM(openConv?.uid)?.name:openUser?.name}</span>
            </>
            :<>
              <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,color:T.gold,filter:"drop-shadow(0 0 10px rgba(201,149,42,0.5))",letterSpacing:2}}>✦</span>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:21,fontWeight:300,letterSpacing:4,color:T.text}}>Céleste ✦</span>
              </div>
              {/* Notification bell avec compteur */}
              <Btn onClick={()=>setShowNotifs(s=>!s)} style={{position:"relative",width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center",background:showNotifs?T.goldBg:"rgba(255,255,255,0.04)",border:`1px solid ${showNotifs?T.gold+"55":T.border}`,borderRadius:"50%",color:showNotifs?T.goldL:T.muted,transition:"all .2s"}}>
                <Bell size={18}/>
                {unreadNotifs>0&&<span style={{position:"absolute",top:4,right:4,minWidth:16,height:16,borderRadius:8,background:T.err,color:"#fff",fontSize:9,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px",boxShadow:"0 2px 8px rgba(200,64,64,0.6)"}}>{unreadNotifs>99?"99+":unreadNotifs}</span>}
              </Btn>
              {myProfile?.is_admin&&(
                <Btn onClick={()=>setShowAdmin(true)} style={{position:"relative",padding:"6px 12px",borderRadius:10,border:`1px solid ${pending>0?T.err+"55":T.border}`,background:pending>0?"rgba(200,64,64,0.06)":T.glass,color:pending>0?T.err:T.muted,fontSize:12,fontWeight:600}}>
                  🛡{pending>0&&<span style={{background:T.err,color:"#fff",borderRadius:"50%",width:16,height:16,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,marginLeft:4}}>{pending}</span>}
                </Btn>
              )}
            </>
          }
        </div>

        {/* Notifications panel overlay */}
        {showNotifs&&!openConvId&&!openUserId&&(
          <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)"}} onClick={()=>setShowNotifs(false)}>
            <div style={{position:"absolute",top:56,left:0,right:0,background:T.bg3,borderBottom:`1px solid ${T.border}`,maxHeight:"70vh",overflowY:"auto",animation:"slideDown .25s ease"}} onClick={e=>e.stopPropagation()}>
              <NotifsScreen myProfile={myProfile} session={session} members={members}/>
            </div>
          </div>
        )}

        {/* Main content */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
          {openUserId&&openUser&&(
            openUser.account_type==="organisation"
              ?<OrgView user={openUser} myProfile={myProfile} session={session} posts={posts} onBack={()=>setOpenUserId(null)} onChat={openChat} notify={notify} myConnections={myConnections} onConnectionChange={()=>{loadConnections(session?.user?.id);loadBlockedUsers();}} onImageView={setViewImg}/>
              :<UserView user={openUser} myProfile={myProfile} session={session} posts={posts} onBack={()=>setOpenUserId(null)} onChat={openChat} notify={notify} myConnections={myConnections} myFollowers={myFollowers} onConnectionChange={()=>{loadConnections(session?.user?.id);loadBlockedUsers();}} onImageView={setViewImg}/>
          )}
          {!openUserId&&openConvId&&openConv&&(
            <ChatScreen conv={openConv} myProfile={myProfile} session={session} members={members} reload={()=>loadConvs(session?.user?.id)} notify={notify} onImageView={setViewImg} onOpenProfile={uid=>{setOpenConvId(null);setOpenUserId(uid);}}/>
          )}
          <div style={{display:openUserId||openConvId?"none":"flex",flexDirection:"column",flex:1,minHeight:0}}>
              {tab==="home"&&<HomeTab posts={posts} setPosts={setPosts} myProfile={myProfile} session={session} getM={getM} onNewPost={()=>setShowNewPost(true)} onUser={id=>{setOpenUserId(id);}} notify={notify} reload={()=>loadPosts(1)} loadMore={loadMorePosts} hasMore={hasMorePosts} loadingMore={loadingMore} refreshPost={refreshPost} onImageView={setViewImg} myConnections={myConnections} onConnect={async id=>{await sb.from("connections").insert({from_id:session.user.id,to_id:id});loadConnections(session.user.id);notify("Connecté ✦");}} initialScroll={feedScrollRef.current} onScrollChange={pos=>feedScrollRef.current=pos}/>}
              {tab==="statuses"&&<StatusesTab myProfile={myProfile} session={session} members={members} myConnections={myConnections} myFollowers={myFollowers} notify={notify} blockedUserIds={blockedUserIds}/>}
              {tab==="discover"&&<DiscoverTab members={members} myProfile={myProfile} session={session} onUser={setOpenUserId} notify={notify} myConnections={myConnections} onConnectionChange={()=>loadConnections(session?.user?.id)}/>}
              {tab==="messages"&&<MsgsTab convs={convs} members={members} getM={getM} onOpen={id=>setOpenConvId(id)} onDeleteConv={async id=>{await sb.from("messages").delete().eq("conv_id",id);await sb.from("conversations").delete().eq("id",id);setConvs(p=>(p||[]).filter(c=>c.id!==id));}} onOpenCeleste={()=>setOpenCeleste(true)}/>}
              {tab==="profile"&&<ProfileTab myProfile={myProfile} session={session} posts={posts} onNewPost={()=>setShowNewPost(true)} notify={notify} onLogout={()=>sb.auth.signOut()} reload={()=>{loadPosts(1);loadMyProfile(session?.user?.id);}} myConnections={myConnections} myFollowers={myFollowers} onImageView={setViewImg}/>}
            </div>
        </div>

        {/* Bottom nav premium */}
       {!openConvId&&!openUserId&&!hideNav&&(
          <div style={{height:72,background:"rgba(10,10,10,0.75)",backdropFilter:"blur(40px)",WebkitBackdropFilter:"blur(40px)",borderTop:`1px solid rgba(255,255,255,0.08)`,display:"flex",flexShrink:0,zIndex:30,boxShadow:"0 -1px 0 rgba(255,255,255,0.06), 0 -20px 60px rgba(0,0,0,0.4)",position:"relative",margin:"0 12px 8px",borderRadius:24,border:`1px solid rgba(255,255,255,0.08)`}}>
            {[
              {id:"home",ic:<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,lb:"Accueil"},
              {id:"statuses",ic:<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>,lb:"Statuts"},
              {id:"discover",ic:<span style={{fontSize:19,lineHeight:1}}>✦</span>,lb:"Découvrir"},
              {id:"messages",ic:<Mail size={21} strokeWidth={1.8}/>,lb:"Messages",badge:unread},
              {id:"profile",ic:<User size={21} strokeWidth={1.8}/>,lb:"Profil"},
            ].map(t=>(
              <Btn key={t.id} onClick={()=>goTab(t.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,color:tab===t.id?T.goldL:T.muted,position:"relative",transition:"color .25s"}}>
                <span style={{lineHeight:1,filter:tab===t.id?`drop-shadow(0 0 10px ${T.gold}99)`:"none",display:"flex",alignItems:"center",justifyContent:"center",transition:"filter .25s",transform:tab===t.id?"scale(1.1)":"scale(1)",transformOrigin:"center bottom"}}>{t.ic}</span>
                <span style={{fontSize:9,fontWeight:tab===t.id?700:400,letterSpacing:.5,transition:"all .25s"}}>{t.lb}</span>
                {(t.badge||0)>0&&<span style={{position:"absolute",top:10,right:"calc(50% - 20px)",background:T.err,color:"#fff",borderRadius:10,minWidth:15,height:15,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900,padding:"0 3px",boxShadow:"0 2px 8px rgba(200,64,64,0.5)"}}>{t.badge}</span>}
                {tab===t.id&&<div style={{position:"absolute",bottom:0,width:20,height:2,borderRadius:2,background:T.gradGold,boxShadow:T.glowGold}}/>}
              </Btn>
            ))}
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}

export default function App(){
  return(<ErrorBoundary><CelesteApp/></ErrorBoundary>);
}