/**
 * Céleste — Version Premium
 * Design: Noir absolu · Gold vibrant · Glassmorphism · Animations cinématiques
 * Base: code propre v3 + upgrades visuels sans librairies externes
 */

import {
  useState, useRef, useEffect, useCallback, useMemo, memo
} from "react";
import {
  Trash2, Mail, Mic, Camera, Image,
  Edit2, Bell, Heart, MessageCircle,
  Send, X, Plus, Search, Settings,
  User, Users, ChevronLeft, MoreVertical,
  Play, Pause, Volume2, Zap, Star
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { subscribePush } from "./usePush";
import React from "react";

// ── SUPABASE ──────────────────────────────────────────────
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

const PAGE_SIZE = 20;

// ── PALETTE PREMIUM ───────────────────────────────────────
const T = {
  bg:       "#000000",
  bg2:      "#080808",
  bg3:      "#0F0F0F",
  card:     "rgba(255,255,255,0.03)",
  cardSolid:"#0A0A0A",
  glass:    "rgba(255,255,255,0.04)",
  glassMid: "rgba(255,255,255,0.07)",
  border:   "rgba(255,255,255,0.06)",
  borderHi: "rgba(255,255,255,0.12)",
  text:     "#F0EDE8",
  sub:      "#888880",
  muted:    "#3A3A38",
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
  gradDark: "linear-gradient(160deg,#0A0805 0%,#000000 100%)",
  glow:     "0 0 40px rgba(201,149,42,0.15), 0 0 80px rgba(201,149,42,0.05)",
  glowGold: "0 0 20px rgba(201,149,42,0.4)",
  shadowCard:"0 8px 40px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.04)",
};

// ── UTILITAIRES ───────────────────────────────────────────
const ago = ts => {
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
const sendPushNotif=(title,body)=>{if(Notification.permission==="granted") new Notification(title,{body});};

// ── CSS GLOBAL PREMIUM ────────────────────────────────────
const GS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=DM+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  html,body,#root{height:100%;background:#000;overscroll-behavior:none;}
  body{padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);}
  ::-webkit-scrollbar{width:2px;}
  ::-webkit-scrollbar-thumb{background:rgba(201,149,42,0.3);border-radius:2px;}
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
    backdrop-filter:blur(20px);
    -webkit-backdrop-filter:blur(20px);
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
            style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",display:"block",border:`1.5px solid ${ring?T.gold:T.border}`}}
            alt=""/>
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
  return(
    <span style={{fontSize:13,color:isConfirmed?"#4A8AC4":"#d0d0d0",
      filter:isConfirmed?"drop-shadow(0 0 8px rgba(74,138,196,0.9))":"drop-shadow(0 0 6px rgba(255,255,255,0.6))",
      animation:"glowPulse 3s ease infinite",lineHeight:1}}>✦</span>
  );
});

const Btn = ({children,onClick,style={},disabled=false,type="button"})=>(
  <button type={type} onClick={disabled?undefined:onClick} disabled={disabled}
    style={{cursor:disabled?"not-allowed":"pointer",border:"none",background:"none",outline:"none",...style}}>
    {children}
  </button>
);

const MediaPlayer = memo(function MediaPlayer({url,style={},onImageClick}){
  if(!url) return null;
  const isVideo=/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(url)||url.includes("video");
  if(isVideo) return(
    <video src={url} controls playsInline
      style={{width:"100%",maxHeight:420,objectFit:"cover",display:"block",background:"#000",...style}}
      onError={e=>e.target.style.display="none"}/>
  );
  return(
    <img src={url} alt="" loading="lazy"
      style={{width:"100%",maxHeight:420,objectFit:"cover",display:"block",cursor:"zoom-in",...style}}
      onClick={()=>onImageClick?.(url)}
      onError={e=>e.target.style.display="none"}/>
  );
});

function Toast({msg}){
  return(
    <div style={{position:"fixed",bottom:84,left:"50%",transform:"translateX(-50%)",
      background:"linear-gradient(135deg,rgba(201,149,42,0.95),rgba(232,184,75,0.9))",
      backdropFilter:"blur(20px)",color:"#000",padding:"10px 24px",borderRadius:30,
      fontSize:12,fontWeight:700,zIndex:9999,
      boxShadow:"0 8px 32px rgba(201,149,42,0.4), 0 0 0 1px rgba(201,149,42,0.3)",
      whiteSpace:"nowrap",animation:"scaleIn .25s cubic-bezier(0.34,1.56,0.64,1)",
      letterSpacing:.3}}>
      {msg}
    </div>
  );
}

function NotifBanner({notifs,onDismiss,onTap}){
  if(!notifs?.length) return null;
  const n=notifs[0];
  return(
    <div onClick={()=>{onTap(n);onDismiss(n.id);}}
      style={{position:"fixed",top:0,left:0,right:0,zIndex:9998,
        display:"flex",alignItems:"center",gap:12,padding:"14px 16px",
        background:"rgba(8,8,8,0.97)",
        borderBottom:`1px solid ${T.gold}33`,
        backdropFilter:"blur(30px)",
        animation:"slideDown .4s cubic-bezier(0.34,1.56,0.64,1)",
        cursor:"pointer",
        boxShadow:`0 8px 40px rgba(0,0,0,0.8), 0 1px 0 ${T.gold}22`}}>
      <div style={{width:38,height:38,borderRadius:"50%",background:T.gradGold,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,
        boxShadow:T.glowGold}}>{n.icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text,letterSpacing:.2}}>{n.title}</p>
        <p style={{margin:0,fontSize:11,color:T.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.body}</p>
      </div>
      <Btn onClick={e=>{e.stopPropagation();onDismiss(n.id);}} style={{color:T.muted,padding:"0 4px",display:"flex",alignItems:"center"}}><X size={16}/></Btn>
    </div>
  );
}

function InstallBanner(){
  const [prompt,setPrompt]=useState(null);
  const [show,setShow]=useState(false);
  useEffect(()=>{
    const h=e=>{e.preventDefault();setPrompt(e);setShow(true);};
    window.addEventListener("beforeinstallprompt",h);
    return()=>window.removeEventListener("beforeinstallprompt",h);
  },[]);
  if(!show||!prompt) return null;
  return(
    <div style={{background:`linear-gradient(135deg,${T.goldBg2},${T.goldBg})`,
      border:`1px solid ${T.gold}33`,borderRadius:18,margin:"10px 16px 0",
      padding:"14px 16px",display:"flex",alignItems:"center",gap:12,
      boxShadow:`0 4px 20px rgba(201,149,42,0.1)`}}>
      <span style={{fontSize:26}}>📲</span>
      <div style={{flex:1}}>
        <p style={{margin:"0 0 2px",fontSize:13,fontWeight:700,color:T.goldL}}>Installer Céleste</p>
        <p style={{margin:0,fontSize:11,color:T.sub}}>Accès rapide depuis ton écran d'accueil</p>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setShow(false)} style={{background:"none",border:"none",color:T.muted,fontSize:16,cursor:"pointer",padding:4}}><X size={16}/></button>
        <button onClick={()=>{prompt.prompt();prompt.userChoice.then(()=>setShow(false));}}
          style={{background:T.gradGold,border:"none",borderRadius:12,padding:"8px 16px",color:"#000",fontSize:12,fontWeight:700,cursor:"pointer"}}>
          Installer
        </button>
      </div>
    </div>
  );
}

function ImageViewer({url,onClose}){
  const [scale,setScale]=useState(1);
  const [offset,setOffset]=useState({x:0,y:0});
  const lastDist=useRef(null); const lastPos=useRef(null); const isDragging=useRef(false);
  useEffect(()=>{document.body.style.overflow="hidden";return()=>{document.body.style.overflow="";};},[]);
  const getDist=t=>{const dx=t[0].clientX-t[1].clientX,dy=t[0].clientY-t[1].clientY;return Math.sqrt(dx*dx+dy*dy);};
  const onTS=e=>{if(e.touches.length===2)lastDist.current=getDist(e.touches);else{lastPos.current={x:e.touches[0].clientX,y:e.touches[0].clientY};isDragging.current=true;}};
  const onTM=e=>{e.preventDefault();if(e.touches.length===2&&lastDist.current){const nd=getDist(e.touches);setScale(s=>Math.min(Math.max(s*(nd/lastDist.current),0.5),5));lastDist.current=nd;}else if(e.touches.length===1&&isDragging.current&&lastPos.current&&scale>1){const dx=e.touches[0].clientX-lastPos.current.x,dy=e.touches[0].clientY-lastPos.current.y;setOffset(o=>({x:o.x+dx,y:o.y+dy}));lastPos.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}};
  const onTE=()=>{lastDist.current=null;isDragging.current=false;lastPos.current=null;};
  const reset=()=>{setScale(1);setOffset({x:0,y:0});};
  return(
    <div style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(0,0,0,0.98)",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"none",animation:"fadeIn .2s ease"}}
      onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
      <div style={{position:"absolute",top:20,right:20,display:"flex",gap:10,zIndex:1}}>
        <Btn onClick={reset} style={{background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"8px 14px",color:T.text,fontSize:12,fontWeight:600,border:`1px solid ${T.border}`}}>↺</Btn>
        <Btn onClick={onClose} style={{background:"rgba(255,255,255,0.08)",borderRadius:"50%",width:40,height:40,color:T.text,fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${T.border}`}}><X size={18}/></Btn>
      </div>
      <img src={url} alt=""
        style={{maxWidth:"95vw",maxHeight:"90vh",objectFit:"contain",borderRadius:16,
          transform:`scale(${scale}) translate(${offset.x/scale}px,${offset.y/scale}px)`,
          transition:isDragging.current?"none":"transform .1s ease",userSelect:"none"}}
        onDoubleClick={()=>scale===1?setScale(2):reset()} draggable={false}/>
    </div>
  );
}

function SwipeToDelete({onDelete,children}){
  const startX=useRef(null); const [offset,setOffset]=useState(0);
  return(
    <div style={{position:"relative"}} onTouchStart={e=>{startX.current=e.touches[0].clientX;}} onTouchMove={e=>{if(startX.current===null)return;const dx=e.touches[0].clientX-startX.current;if(dx<0)setOffset(Math.max(dx,-70));}} onTouchEnd={()=>{if(offset<-55)onDelete();setOffset(0);startX.current=null;}}>
      <div style={{transform:`translateX(${offset}px)`,transition:offset===0?"transform .3s cubic-bezier(0.4,0,0.2,1)":"none"}}>{children}</div>
      {offset<-10&&<div style={{position:"absolute",right:0,top:0,bottom:0,width:70,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(200,64,64,0.15)",borderRadius:"0 14px 14px 0"}}><Trash2 size={18} color={T.err} style={{opacity:Math.min(Math.abs(offset)/55,1)}}/></div>}
    </div>
  );
}

function ReportModal({onClose,onSubmit}){
  const [reason,setReason]=useState(""); const [details,setDetails]=useState("");
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:900,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(8px)"}}>
      <div style={{background:T.bg3,borderRadius:24,padding:24,width:"100%",maxWidth:380,border:`1px solid ${T.border}`,boxShadow:T.shadowCard,animation:"scaleIn .3s cubic-bezier(0.34,1.56,0.64,1)"}}>
        <h3 style={{margin:"0 0 18px",fontFamily:"'Cormorant Garamond',serif",fontSize:24,color:T.text,fontWeight:400}}>Signaler</h3>
        <select value={reason} onChange={e=>setReason(e.target.value)} style={{width:"100%",padding:"13px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,color:reason?T.text:T.sub,fontSize:13,marginBottom:10,outline:"none",appearance:"none"}}>
          <option value="">Raison *</option>
          <option value="contenu_inapproprie">Contenu inapproprié</option>
          <option value="harcelement">Harcèlement</option>
          <option value="fausse_identite">Fausse identité</option>
          <option value="spam">Spam</option>
          <option value="autre">Autre</option>
        </select>
        <textarea value={details} onChange={e=>setDetails(e.target.value)} placeholder="Détails (optionnel)" style={{width:"100%",padding:"13px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,color:T.text,fontSize:13,marginBottom:16,outline:"none",resize:"none",height:80}}/>
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={onClose} style={{flex:1,padding:"13px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,color:T.muted,fontSize:13}}>Annuler</Btn>
          <Btn onClick={()=>{if(!reason)return;onSubmit(reason,details);}} style={{flex:1,padding:"13px",background:T.gradGold,borderRadius:14,color:"#000",fontSize:13,fontWeight:700}}>Envoyer</Btn>
        </div>
      </div>
    </div>
  );
}

// ── FLAG SELECTOR ─────────────────────────────────────────
const FLAGS=[
  {code:"CG",flag:"🇨🇬",name:"Congo"},
  {code:"CD",flag:"🇨🇩",name:"RD Congo"},
  {code:"FR",flag:"🇫🇷",name:"France"},
  {code:"BE",flag:"🇧🇪",name:"Belgique"},
  {code:"CM",flag:"🇨🇲",name:"Cameroun"},
  {code:"CI",flag:"🇨🇮",name:"Côte d'Ivoire"},
  {code:"SN",flag:"🇸🇳",name:"Sénégal"},
  {code:"MG",flag:"🇲🇬",name:"Madagascar"},
  {code:"US",flag:"🇺🇸",name:"USA"},
  {code:"CA",flag:"🇨🇦",name:"Canada"},
  {code:"GB",flag:"🇬🇧",name:"UK"},
  {code:"CH",flag:"🇨🇭",name:"Suisse"},
];
function FlagSelector({selected,onChange}){
  const [open,setOpen]=useState(false);
  const cur=FLAGS.find(f=>f.code===selected)||FLAGS[0];
  return(
    <div style={{position:"relative"}}>
      <Btn onClick={()=>setOpen(!open)} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 14px",fontSize:18}}>
        <span>{cur.flag}</span><span style={{fontSize:12,color:T.sub}}>{cur.name}</span><span style={{fontSize:10,color:T.muted}}>▾</span>
      </Btn>
      {open&&(
        <div style={{position:"absolute",top:"110%",left:0,zIndex:999,background:T.bg3,border:`1px solid ${T.border}`,borderRadius:16,padding:8,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,minWidth:220,boxShadow:T.shadowCard,animation:"scaleIn .2s ease"}}>
          {FLAGS.map(f=>(
            <Btn key={f.code} onClick={()=>{onChange(f.code);setOpen(false);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"8px 6px",borderRadius:10,background:f.code===selected?T.goldBg:"none",border:f.code===selected?`1px solid ${T.gold}44`:"1px solid transparent"}}>
              <span style={{fontSize:22}}>{f.flag}</span><span style={{fontSize:9,color:T.muted}}>{f.name}</span>
            </Btn>
          ))}
        </div>
      )}
    </div>
  );
}
const AuthField=({val,set,placeholder,type="text",showPw,setShowPw})=>(
  <div style={{position:"relative"}}>
    <input value={val} onChange={e=>set(e.target.value)} placeholder={placeholder}
      type={type==="password"&&showPw?"text":type}
      enterKeyHint="done" autoCorrect="off" autoCapitalize="off" spellCheck="false"
      style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px",color:T.text,fontSize:15,outline:"none",transition:"border-color .2s"}}
      onFocus={e=>e.target.style.borderColor=`${T.gold}66`}
      onBlur={e=>e.target.style.borderColor=T.border}/>
    {type==="password"&&<Btn onClick={()=>setShowPw(!showPw)} style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",color:T.muted,fontSize:14}}>{showPw?"🙈":"👁"}</Btn>}
  </div>
);

function AuthScreen({mode,setMode,onSuccess}){
  const [accountType,setAccountType]=useState("membre");
  const [prenom,setPrenom]=useState(""); const [nom,setNom]=useState("");
  const [paroisse,setParoisse]=useState(""); const [whatsapp,setWhatsapp]=useState("");
  const [phone,setPhone]=useState("");
  const [country,setCountry]=useState("CG"); // Congo par défaut
  const [orgName,setOrgName]=useState(""); const [orgType,setOrgType]=useState("");
  const [orgCountry,setOrgCountry]=useState(""); const [orgDesc,setOrgDesc]=useState("");
  const [email,setEmail]=useState(""); const [pw,setPw]=useState("");
  const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  const [showPw,setShowPw]=useState(false);

  const reset=()=>{setErr("");setPrenom("");setNom("");setParoisse("");setEmail("");setPw("");setWhatsapp("");setPhone("");setAccountType("membre");setOrgName("");setOrgType("");setOrgCountry("");setOrgDesc("");};

  const submit=async()=>{
    setErr("");
    if(mode==="register"){
      if(!phone.trim()||phone.trim().length<6)return setErr("Numéro de téléphone requis ☎");
      if(accountType==="organisation"){
        if(orgName.trim().length<2)return setErr("Nom de l'organisation requis");
        if(!orgType)return setErr("Type requis");
        if(!orgCountry)return setErr("Pays requis");
      }else{
        if(prenom.trim().length<2)return setErr("Prénom requis");
        if(nom.trim().length<2)return setErr("Nom requis");
        if(paroisse.trim().length<2)return setErr("Paroisse requise");
      }
    }
    if(!email.includes("@"))return setErr("Email invalide");
    if(pw.length<6)return setErr("Mot de passe trop court");
    setBusy(true);
    try{
      if(mode==="login"){
        const{error}=await sb.auth.signInWithPassword({email,password:pw});
        if(error)throw error; onSuccess();
      }else{
        const{error}=await sb.auth.signUp({email,password:pw,options:{data:{
          account_type:accountType,
          prenom:accountType==="membre"?prenom.trim():orgName.trim(),
          nom:accountType==="membre"?nom.trim():orgType,
          paroisse:accountType==="membre"?paroisse.trim():orgCountry,
          whatsapp:whatsapp.trim()||phone.trim(),
          phone:phone.trim(),
          country:country,
          org_name:orgName.trim(),org_type:orgType,org_country:orgCountry,org_desc:orgDesc.trim(),
        }}});
        if(error)throw error; onSuccess("pending");
      }
    }catch(e){setErr(e.message||"Erreur réseau");}
    finally{setBusy(false);}
  };

  return(
    <div style={{minHeight:"100svh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px 20px env(safe-area-inset-bottom,20px)",position:"relative",overflow:"hidden"}}>
      {/* Ambient background */}
      <div style={{position:"absolute",top:"-30%",left:"-20%",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(201,149,42,0.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:"-30%",right:"-20%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(58,106,154,0.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(${T.border} 1px,transparent 1px)`,backgroundSize:"40px 40px",opacity:.3,pointerEvents:"none"}}/>

      <div style={{width:"100%",maxWidth:400,animation:"titleReveal .6s ease"}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:76,height:76,borderRadius:"50%",background:"rgba(201,149,42,0.08)",border:`1px solid ${T.gold}33`,marginBottom:22,animation:"glow 3s ease infinite",boxShadow:`0 0 40px rgba(201,149,42,0.15)`}}>
            <span style={{fontSize:34,fontFamily:"'Cormorant Garamond',serif",color:T.gold}}>✦</span>
          </div>
          <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:48,fontWeight:300,color:T.text,letterSpacing:5,marginBottom:6}}>Céleste</h1>
          <p style={{color:T.muted,fontSize:12,letterSpacing:2,textTransform:"uppercase"}}>Des rencontres ancrées dans la foi</p>
        </div>

        <div style={{background:"rgba(255,255,255,0.025)",border:`1px solid ${T.border}`,borderRadius:24,overflow:"hidden",backdropFilter:"blur(30px)"}}>
          {/* Tabs */}
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
                      <div style={{flex:1}}><AuthField val={prenom} set={setPrenom} placeholder="Prénom *" showPw={showPw} setShowPw={setShowPw}/></div>
                      <div style={{flex:1}}><AuthField val={nom} set={setNom} placeholder="Nom *" showPw={showPw} setShowPw={setShowPw}/></div>
                    </div>
                    <AuthField val={paroisse} set={setParoisse} placeholder="Paroisse / Ward *" showPw={showPw} setShowPw={setShowPw}/>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <FlagSelector selected={country} onChange={setCountry}/>
                      <div style={{flex:1}}><AuthField val={phone} set={setPhone} placeholder="☎ Téléphone * (ex: +242…)" type="tel" showPw={showPw} setShowPw={setShowPw}/></div>
                    </div>
                    <AuthField val={whatsapp} set={setWhatsapp} placeholder="WhatsApp (si différent)" showPw={showPw} setShowPw={setShowPw}/>
                  </>
                ):(
                  <>
                    <AuthField val={orgName} set={setOrgName} placeholder="Nom de l'organisation *" showPw={showPw} setShowPw={setShowPw}/>
                    <select value={orgType} onChange={e=>setOrgType(e.target.value)} style={{width:"100%",padding:"13px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,color:orgType?T.text:T.sub,fontSize:13,outline:"none",appearance:"none"}}>
                      <option value="">Type *</option>
                      <option value="paroisse">⛪ Paroisse / Ward</option>
                      <option value="pieu">🏛️ Pieu</option>
                      <option value="mission">✈️ Mission</option>
                      <option value="seminaire">📚 Séminaire</option>
                      <option value="association">🤝 Association</option>
                      <option value="autre">📌 Autre</option>
                    </select>
                    <AuthField val={orgCountry} set={setOrgCountry} placeholder="Pays *" showPw={showPw} setShowPw={setShowPw}/>
                    <AuthField val={orgDesc} set={setOrgDesc} placeholder="Description (optionnel)" showPw={showPw} setShowPw={setShowPw}/>
                    <AuthField val={phone} set={setPhone} placeholder="☎ Téléphone * (ex: +242…)" type="tel" showPw={showPw} setShowPw={setShowPw}/>
                    <AuthField val={whatsapp} set={setWhatsapp} placeholder="WhatsApp (si différent)" showPw={showPw} setShowPw={setShowPw}/>
                  </>
                )}
              </>
            )}
            <AuthField val={email} set={setEmail} placeholder="Email *" type="email" showPw={showPw} setShowPw={setShowPw}/>
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

// ── POST DETAIL MODAL ─────────────────────────────────────
function PostDetailModal({post,myProfile,session,getM,onClose,onLike,onComment,notify}){
  const [cmtTxt,setCmtTxt]=useState(""); const [viewImg,setViewImg]=useState(null);
  const bottomRef=useRef();
  const auth=post.author||getM(post.by);
  const liked=(post.likes||[]).includes(session?.user?.id);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[]);

  const addCmt=async()=>{
    if(!cmtTxt.trim())return;
    const{error}=await sb.from("comments").insert({post_id:post.id,author_id:session?.user?.id,text:cmtTxt.trim()});
    if(!error){setCmtTxt("");onComment();notify("Commentaire ajouté ✦");}
  };

  const deleteCmt=async id=>{
    if(!window.confirm("Supprimer ?"))return;
    await sb.from("comments").delete().eq("id",id);
    onComment();notify("Supprimé");
  };

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
          <div style={{overflowY:"auto",flex:1}}>
            {post.type==="event"
              ?<div style={{margin:"12px 16px",background:T.goldBg,borderRadius:16,padding:16,border:`1px solid ${T.gold}22`}}>
                <p style={{margin:"0 0 6px",fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:T.text}}>{post.title}</p>
                {post.text&&<p style={{margin:"0 0 8px",fontSize:13,color:T.sub,lineHeight:1.7}}>{post.text}</p>}
                {post.eventDate&&<p style={{margin:"0 0 3px",fontSize:12,color:T.gold}}>🗓 {post.eventDate}</p>}
                {post.eventLoc&&<p style={{margin:0,fontSize:12,color:T.sub}}>📍 {post.eventLoc}</p>}
              </div>
              :<>
                {post.text&&<p style={{margin:"12px 16px 8px",fontSize:14,color:T.text,lineHeight:1.8,whiteSpace:"pre-line"}}>{post.text}</p>}
                {post.img&&<MediaPlayer url={post.img} onImageClick={setViewImg}/>}
              </>
            }
            <div style={{display:"flex",alignItems:"center",gap:16,padding:"10px 16px",borderTop:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`}}>
              <Btn onClick={()=>onLike(post.id)} style={{display:"flex",alignItems:"center",gap:6,color:liked?T.gold:T.sub,fontSize:13,fontWeight:600,transition:"all .2s"}}>
                <span style={{fontSize:18,animation:liked?"pulse .3s ease":""}}>{liked?"❤️":"🤍"}</span>
                {(post.likes||[]).length} j'aime{(post.likes||[]).length>1?"s":""}
              </Btn>
              <span style={{color:T.sub,fontSize:13}}>💬 {(post.comments||[]).length}</span>
            </div>
            <div style={{padding:"12px 16px"}}>
              {(post.comments||[]).length===0&&<p style={{color:T.muted,fontSize:13,textAlign:"center",padding:"20px 0",fontStyle:"italic"}}>Soyez le premier à commenter…</p>}
              {(post.comments||[]).map(c=>{
                const cu=c.author||getM(c.by);
                const canDel=c.by===session?.user?.id||myProfile?.is_admin;
                return(
                  <div key={c.id} style={{display:"flex",gap:9,marginBottom:14,animation:"msgIn .3s ease"}}>
                    <Av u={cu} size={32}/>
                    <div style={{flex:1}}>
                      <div style={{background:"rgba(255,255,255,0.04)",borderRadius:"0 14px 14px 14px",padding:"10px 13px",border:`1px solid ${T.border}`,display:"flex",alignItems:"flex-start",gap:8}}>
                        <div style={{flex:1}}>
                          <p style={{margin:"0 0 4px",fontSize:12,fontWeight:700,color:T.goldL}}>{cu?.name}</p>
                          <p style={{margin:0,fontSize:13,color:T.text,lineHeight:1.6}}>{c.text}</p>
                        </div>
                        {canDel&&<button onClick={()=>deleteCmt(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:T.err,opacity:.5,flexShrink:0,padding:0}}><Trash2 size={14}/></button>}
                      </div>
                      <span style={{fontSize:10,color:T.muted,paddingLeft:4}}>{ago(c.ts)}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef}/>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",padding:"10px 14px",borderTop:`1px solid ${T.border}`,flexShrink:0,paddingBottom:"calc(10px + env(safe-area-inset-bottom,0px))"}}>
            <Av u={myProfile} size={32}/>
            <div style={{flex:1,display:"flex",gap:6,background:"rgba(255,255,255,0.04)",borderRadius:24,padding:"7px 7px 7px 14px",border:`1px solid ${T.border}`}}>
              <input value={cmtTxt} onChange={e=>setCmtTxt(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&window.innerWidth>768){e.preventDefault();addCmt();}}}
                placeholder="Commenter…"
                style={{flex:1,background:"none",border:"none",color:T.text,fontSize:13,outline:"none"}}/>
              <Btn onClick={addCmt} style={{background:cmtTxt.trim()?T.gradGold:"none",borderRadius:"50%",width:32,height:32,color:cmtTxt.trim()?"#000":T.muted,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s"}}>
                <Send size={14}/>
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── NEW POST MODAL ────────────────────────────────────────
function NewPostModal({myProfile,session,onClose,onPost}){
  const [type,setType]=useState("text"); const [text,setText]=useState("");
  const [preview,setPreview]=useState(null); const [imgUrl,setImgUrl]=useState(null);
  const [uploading,setUploading]=useState(false);
  const [evTitle,setEvTitle]=useState(""); const [evDate,setEvDate]=useState(""); const [evLoc,setEvLoc]=useState("");
  const [busy,setBusy]=useState(false); const fRef=useRef();

  const handlePick=async e=>{
    let f=e.target.files[0]; if(!f) return;
    if(f.type.startsWith("image/"))f=await compressImage(f);
    if(f.type.startsWith("video/")&&f.size>25*1024*1024){alert("Vidéo max 25MB");return;}
    const r=new FileReader();r.onload=ev=>setPreview(ev.target.result);r.readAsDataURL(f);
    setUploading(true);
    const path=`posts/${session?.user?.id}/${Date.now()}_${f.name}`;
    const{error}=await sb.storage.from("celeste-media").upload(path,f,{upsert:true});
    if(!error){const{data:{publicUrl}}=sb.storage.from("celeste-media").getPublicUrl(path);setImgUrl(publicUrl);}
    setUploading(false);
  };

  const submit=async()=>{
    if(busy)return;setBusy(true);
    const{error}=await sb.from("posts").insert({author_id:session?.user?.id,type,text:text.trim()||"",img_url:type==="photo"?imgUrl:null,event_title:type==="event"?evTitle.trim():null,event_date:type==="event"?evDate:null,event_loc:type==="event"?evLoc:null});
    setBusy(false); if(!error)onPost();
  };

  const ok=type==="text"?text.trim().length>0:type==="photo"?imgUrl!==null:evTitle.trim().length>0;

  return(
    <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:640,padding:"22px 20px 44px",maxHeight:"92vh",overflowY:"auto",animation:"slideUp .35s cubic-bezier(0.34,1.1,0.64,1)"}}>
        <input ref={fRef} type="file" accept="image/*,video/*" style={{display:"none"}} onChange={handlePick}/>
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

        <div style={{display:"flex",gap:6,marginBottom:16,background:"rgba(255,255,255,0.03)",borderRadius:14,padding:4}}>
          {[{id:"text",l:"✍ Texte"},{id:"photo",l:"📷 Photo"},{id:"event",l:"🗓 Événement"}].map(t=>(
            <Btn key={t.id} onClick={()=>setType(t.id)} style={{flex:1,padding:"9px 4px",borderRadius:11,background:type===t.id?T.goldBg:"none",color:type===t.id?T.goldL:T.muted,fontSize:11,fontWeight:type===t.id?700:400,border:type===t.id?`1px solid ${T.gold}44`:"1px solid transparent",transition:"all .2s"}}>
              {t.l}
            </Btn>
          ))}
        </div>

        {type==="photo"&&(preview
          ?<div style={{position:"relative",marginBottom:12}}>
            <MediaPlayer url={preview} style={{borderRadius:16,maxHeight:280}}/>
            {uploading&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:32,height:32,border:`2px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin .8s linear infinite"}}/></div>}
            <Btn onClick={()=>{setPreview(null);setImgUrl(null);}} style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.7)",borderRadius:"50%",width:30,height:30,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={14}/></Btn>
          </div>
          :<Btn onClick={()=>fRef.current.click()} style={{width:"100%",height:140,borderRadius:16,border:`2px dashed ${T.gold}33`,background:T.goldBg,color:T.gold,fontSize:13,fontWeight:600,marginBottom:12,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,transition:"all .2s"}}>
            <Camera size={32}/><span>Photo ou Vidéo</span>
          </Btn>
        )}

        {type==="event"&&(
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:8}}>
            {[{val:evTitle,set:setEvTitle,ph:"Titre *"},{val:evDate,set:setEvDate,ph:"Date et heure"},{val:evLoc,set:setEvLoc,ph:"Lieu"}].map(({val,set,ph})=>(
              <input key={ph} value={val} onChange={e=>set(e.target.value)} placeholder={ph} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px",color:T.text,fontSize:13,outline:"none"}}/>
            ))}
          </div>
        )}

        <textarea value={text} onChange={e=>setText(e.target.value)}
          placeholder={type==="photo"?"Légende…":type==="event"?"Description…":"Partagez avec la communauté 🌿"}
          rows={4}
          style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,padding:"13px 14px",color:T.text,fontSize:14,outline:"none",resize:"none",lineHeight:1.7,marginBottom:14,transition:"border-color .2s"}}
          onFocus={e=>e.target.style.borderColor=`${T.gold}44`}
          onBlur={e=>e.target.style.borderColor=T.border}/>

        <div style={{display:"flex",gap:8}}>
          <Btn onClick={onClose} style={{flex:1,padding:"14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,color:T.sub,fontSize:14,fontWeight:600}}>Annuler</Btn>
          <Btn onClick={submit} disabled={!ok||busy||uploading} style={{flex:2,padding:"14px",background:ok&&!busy&&!uploading?T.gradGold:"rgba(255,255,255,0.04)",color:ok&&!busy&&!uploading?"#000":T.muted,borderRadius:14,fontSize:14,fontWeight:700,transition:"all .25s",boxShadow:ok&&!busy&&!uploading?"0 8px 24px rgba(201,149,42,0.3)":"none"}}>
            {busy?"Publication…":uploading?"Upload…":"Publier ✦"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── HOME TAB ──────────────────────────────────────────────
function HomeTab({posts,setPosts,myProfile,session,getM,onNewPost,onUser,notify,reload,loadMore,hasMore,loadingMore,refreshPost,onImageView}){
  const [detailPost,setDetailPost]=useState(null);
  const bottomRef=useRef();

  useEffect(()=>{
    const obs=new IntersectionObserver(entries=>{if(entries[0].isIntersecting)loadMore();},{threshold:0.1});
    if(bottomRef.current)obs.observe(bottomRef.current);
    return()=>obs.disconnect();
  },[loadMore]);

  const toggleLike=useCallback(async pid=>{
    const post=(posts||[]).find(p=>p.id===pid);
    const liked=(post?.likes||[]).includes(session?.user?.id);
    if(liked){
      await sb.from("likes").delete().eq("post_id",pid).eq("user_id",session?.user?.id);
      setPosts(pp=>(pp||[]).map(p=>p.id!==pid?p:{...p,likes:p.likes.filter(x=>x!==session?.user?.id)}));
    }else{
      await sb.from("likes").insert({post_id:pid,user_id:session?.user?.id});
      setPosts(pp=>(pp||[]).map(p=>p.id!==pid?p:{...p,likes:[...(p.likes||[]),session?.user?.id]}));
    }
  },[posts,session?.user?.id,setPosts]);

  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg}}>
      <InstallBanner/>
      {detailPost&&(
        <PostDetailModal post={detailPost} myProfile={myProfile} session={session} getM={getM}
          onClose={()=>setDetailPost(null)}
          onLike={async pid=>{await toggleLike(pid);const u=await refreshPost(pid);if(u)setDetailPost(u);}}
          onComment={async()=>{const u=await refreshPost(detailPost.id);if(u)setDetailPost(u);}}
          notify={notify}/>
      )}

      {/* Header premium */}
      <div style={{position:"sticky",top:0,zIndex:10,background:"rgba(0,0,0,0.92)",backdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20,color:T.gold,filter:"drop-shadow(0 0 8px rgba(201,149,42,0.6))"}}>✦</span>
          <div>
            <p style={{margin:0,fontSize:10,color:T.muted,letterSpacing:1.5,textTransform:"uppercase"}}>Bienvenue</p>
            <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:400,color:T.text}}>{myProfile?.name}</h2>
          </div>
        </div>
        <Btn onClick={onNewPost} style={{background:T.gradGold,color:"#000",borderRadius:20,padding:"9px 18px",fontWeight:700,fontSize:12,boxShadow:"0 4px 20px rgba(201,149,42,0.35), 0 0 0 1px rgba(201,149,42,0.2)",letterSpacing:.3}}>+ Publier</Btn>
      </div>

      <div style={{maxWidth:640,margin:"0 auto",padding:"0 0 80px"}}>
        {(posts||[]).length===0
          ?<div style={{textAlign:"center",padding:"80px 20px",color:T.muted}}>
            <div style={{fontSize:48,marginBottom:16,animation:"float 3s ease infinite"}}>✦</div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T.sub}}>Aucune publication encore</p>
          </div>
          :(posts||[]).map((p,i)=>{
            const auth=p.author||getM(p.by);
            const liked=(p.likes||[]).includes(session?.user?.id);
            const canDelete=p.by===session?.user?.id||myProfile?.is_admin;
            return(
              <div key={p.id} style={{borderBottom:`1px solid ${T.border}`,animation:`fadeUp .4s ease ${Math.min(i,6)*.06}s both`,background:T.bg}}>
                {/* Post header */}
                <div style={{padding:"14px 16px 10px",display:"flex",alignItems:"center",gap:11}}>
                  <Btn onClick={()=>onUser(p.by)} style={{padding:0}}><Av u={auth} size={42}/></Btn>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
                      <Btn onClick={()=>onUser(p.by)} style={{padding:0,fontSize:14,fontWeight:600,color:T.text}}>{auth?.name}</Btn>
                      <Badge type={auth?.badge}/>
                      {p.pinned&&<span style={{fontSize:9,background:T.goldBg2,color:T.goldL,border:`1px solid ${T.gold}44`,borderRadius:20,padding:"2px 8px",fontWeight:700}}>✦ Sponsorisé</span>}
                    </div>
                    <span style={{fontSize:11,color:T.muted}}>{ago(p.ts)}</span>
                  </div>
                  {canDelete&&<Btn onClick={async()=>{if(window.confirm("Supprimer ?")){await sb.from("posts").delete().eq("id",p.id);reload();notify("Supprimé");}}} style={{color:T.err,opacity:.4,padding:4,display:"flex",alignItems:"center"}}><Trash2 size={16}/></Btn>}
                </div>

                {/* Post content */}
                {p.type==="event"
                  ?<div style={{margin:"0 14px 12px",background:`linear-gradient(135deg,${T.goldBg2},${T.goldBg})`,borderRadius:18,padding:16,border:`1px solid ${T.gold}22`}}>
                    <p style={{margin:"0 0 6px",fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:T.text}}>{p.title}</p>
                    {p.text&&<p style={{margin:"0 0 8px",fontSize:13,color:T.sub,lineHeight:1.7}}>{p.text}</p>}
                    {p.eventDate&&<p style={{margin:"0 0 3px",fontSize:12,color:T.goldL}}>🗓 {p.eventDate}</p>}
                    {p.eventLoc&&<p style={{margin:0,fontSize:12,color:T.sub}}>📍 {p.eventLoc}</p>}
                  </div>
                  :<>
                    {p.text&&<p style={{margin:"0 16px 12px",fontSize:14,color:T.text,lineHeight:1.8,whiteSpace:"pre-line"}}>{p.text}</p>}
                    {p.img&&<div style={{overflow:"hidden"}}><MediaPlayer url={p.img} onImageClick={onImageView}/></div>}
                  </>
                }

                {/* Like count */}
                {(p.likes||[]).length>0&&<p style={{margin:"8px 16px 0",fontSize:11,color:T.muted,display:"flex",alignItems:"center",gap:5}}><span style={{color:T.err}}>❤</span> {p.likes.length} {p.likes.length>1?"personnes aiment":"personne aime"}</p>}

                {/* Actions */}
                <div style={{display:"flex",borderTop:`1px solid ${T.border}`,marginTop:10}}>
                  {[
                    {ic:liked?"❤️":"🤍",lb:"J'aime",fn:()=>toggleLike(p.id),active:liked},
                    {ic:"💬",lb:(p.comments||[]).length||"",fn:()=>setDetailPost(p),active:false},
                    {ic:"↗",lb:"Partager",fn:()=>{navigator.clipboard?.writeText(window.location.href);notify("Lien copié 🔗");}},
                  ].map(a=>(
                    <Btn key={a.lb} onClick={a.fn} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,color:a.active?T.gold:T.sub,fontWeight:600,fontSize:12,padding:"11px 4px",transition:"all .2s"}}>
                      <span style={{fontSize:16,transition:"transform .15s",display:"flex"}}>{a.ic}</span>
                      {a.lb!==""&&<span>{a.lb}</span>}
                    </Btn>
                  ))}
                </div>
              </div>
            );
          })
        }
        <div ref={bottomRef} style={{padding:"20px",textAlign:"center"}}>
          {loadingMore&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,color:T.muted,fontSize:13}}><div style={{width:18,height:18,border:`2px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>Chargement…</div>}
          {!hasMore&&(posts||[]).length>0&&<p style={{color:T.muted,fontSize:12,fontStyle:"italic",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><span style={{color:T.gold,fontSize:10}}>✦</span>Vous avez tout vu<span style={{color:T.gold,fontSize:10}}>✦</span></p>}
        </div>
      </div>
    </div>
  );
}

// ── STATUSES TAB — STYLE INSTAGRAM/TIKTOK ────────────────
function StatusesTab({myProfile,session,myConnections,myFollowers,notify}){
  const [allStatuses,setAllStatuses]=useState([]);
  const [myStatuses,setMyStatuses]=useState([]);
  const [showAdd,setShowAdd]=useState(false);
  const [viewUser,setViewUser]=useState(null);
  const [loading,setLoading]=useState(true);

  const loadStatuses=useCallback(async()=>{
    const cutoff=new Date(Date.now()-86400000).toISOString();
    const{data}=await sb.from("statuses").select(`*,author:profiles(id,prenom,nom,avatar_url,badge)`).gte("created_at",cutoff).order("created_at",{ascending:false});
    if(data){
      const mapped=data.map(s=>({id:s.id,userId:s.user_id,author:normProfile(s.author||{}),type:s.type||"text",text:s.text||"",mediaUrl:s.media_url||null,ts:new Date(s.created_at).getTime()}));
      setAllStatuses(mapped);
      setMyStatuses(mapped.filter(s=>s.userId===session?.user?.id));
    }
    setLoading(false);
  },[session?.user?.id]);

  useEffect(()=>{loadStatuses();},[loadStatuses]);

  const deleteStatus=async id=>{
    if(!window.confirm("Supprimer ?"))return;
    await sb.from("statuses").delete().eq("id",id);
    loadStatuses();notify("Statut supprimé");
  };

  const connectedIds=new Set([...(myConnections||[]),...(myFollowers||[])]);
  const byUser={};
  (allStatuses||[]).forEach(s=>{if(!byUser[s.userId])byUser[s.userId]={author:s.author,items:[]};byUser[s.userId].items.push(s);});
  const visibleUsers=Object.entries(byUser).filter(([uid])=>uid===session?.user?.id||connectedIds.has(uid));
  const otherUsers=visibleUsers.filter(([uid])=>uid!==session?.user?.id);

  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg}}>
      {/* Header */}
      <div style={{position:"sticky",top:0,zIndex:10,background:"rgba(0,0,0,0.92)",backdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,color:T.text}}>Statuts</h2>
        <Btn onClick={()=>setShowAdd(true)} style={{background:T.gradGold,color:"#000",borderRadius:20,padding:"8px 18px",fontWeight:700,fontSize:12,boxShadow:"0 4px 16px rgba(201,149,42,0.3)"}}>+ Ajouter</Btn>
      </div>

      {showAdd&&<AddStatusModal session={session} myStatuses={myStatuses} onClose={()=>setShowAdd(false)} onDone={()=>{loadStatuses();setShowAdd(false);notify("Statut publié ✦");}}/>}
      {viewUser&&byUser[viewUser]&&<StatusViewer statuses={byUser[viewUser].items} author={byUser[viewUser].author} isMe={viewUser===session?.user?.id} onDelete={deleteStatus} onClose={()=>setViewUser(null)} session={session}/>}

      <div style={{maxWidth:640,margin:"0 auto",padding:"16px 16px 80px"}}>
        {/* Story row horizontal */}
        <div style={{display:"flex",gap:14,overflowX:"auto",paddingBottom:16,scrollbarWidth:"none",marginBottom:4}}>
          {/* Mon statut */}
          <div onClick={()=>myStatuses.length>0?setViewUser(session?.user?.id):setShowAdd(true)}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer",flexShrink:0}}>
            <div style={{position:"relative",width:64,height:64}}>
              <div style={{width:64,height:64,borderRadius:"50%",background:myStatuses.length>0?`conic-gradient(${T.gold} 0deg, ${T.goldL} 180deg, ${T.gold} 360deg)`:"rgba(255,255,255,0.08)",padding:2,boxShadow:myStatuses.length>0?T.glowGold:"none"}}>
                <div style={{width:"100%",height:"100%",borderRadius:"50%",overflow:"hidden",border:`2px solid ${T.bg}`}}>
                  <Av u={myProfile} size={60}/>
                </div>
              </div>
              {myStatuses.length===0&&(
                <div style={{position:"absolute",bottom:0,right:0,width:22,height:22,borderRadius:"50%",background:T.gradGold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,border:`2px solid ${T.bg}`,boxShadow:T.glowGold}}>+</div>
              )}
            </div>
            <span style={{fontSize:10,color:T.text,fontWeight:500,maxWidth:64,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Moi</span>
          </div>

          {/* Autres statuts */}
          {otherUsers.map(([uid,{author,items}])=>(
            <div key={uid} onClick={()=>setViewUser(uid)}
              style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer",flexShrink:0}}>
              <div style={{width:64,height:64,borderRadius:"50%",background:`conic-gradient(${T.gold} 0deg,${T.goldL} 180deg,${T.gold} 360deg)`,padding:2,boxShadow:T.glowGold}}>
                <div style={{width:"100%",height:"100%",borderRadius:"50%",overflow:"hidden",border:`2px solid ${T.bg}`}}>
                  <Av u={author} size={60}/>
                </div>
              </div>
              <span style={{fontSize:10,color:T.text,fontWeight:500,maxWidth:64,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{author?.name?.split(" ")[0]}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{height:1,background:`linear-gradient(90deg,transparent,${T.border},transparent)`,margin:"8px 0 16px"}}/>

        {loading
          ?<div style={{textAlign:"center",padding:40}}><div style={{width:24,height:24,border:`2px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto"}}/></div>
          :otherUsers.length===0
            ?<div style={{textAlign:"center",padding:"40px 0",color:T.muted}}><div style={{fontSize:40,marginBottom:12,animation:"float 3s ease infinite"}}>◑</div><p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Aucun statut de vos connexions</p></div>
            :<>
              <p style={{fontSize:10,color:T.muted,letterSpacing:1.5,marginBottom:12,textTransform:"uppercase"}}>Connexions récentes</p>
              {otherUsers.map(([uid,{author,items}])=>(
                <div key={uid} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:T.card,borderRadius:18,border:`1px solid ${T.border}`,marginBottom:8,cursor:"pointer",transition:"all .2s",animation:"fadeUp .4s ease"}}
                  onClick={()=>setViewUser(uid)}>
                  <div style={{width:54,height:54,borderRadius:"50%",background:`conic-gradient(${T.gold},${T.goldL},${T.gold})`,padding:2.5,boxShadow:`0 0 16px rgba(201,149,42,0.3)`}}>
                    <div style={{width:"100%",height:"100%",borderRadius:"50%",overflow:"hidden",border:`2px solid ${T.bg}`}}>
                      <Av u={author} size={49}/>
                    </div>
                  </div>
                  <div style={{flex:1}}>
                    <p style={{margin:"0 0 2px",fontSize:14,fontWeight:600,color:T.text}}>{author?.name}</p>
                    <p style={{margin:0,fontSize:11,color:T.muted}}>{items.length} statut{items.length>1?"s":""} · {ago(items[0].ts)}</p>
                  </div>
                  <div style={{width:8,height:8,borderRadius:"50%",background:T.gradGold,boxShadow:T.glowGold}}/>
                </div>
              ))}
            </>
        }
      </div>
    </div>
  );
}

// ── ADD STATUS MODAL ──────────────────────────────────────
function AddStatusModal({session,myStatuses,onClose,onDone}){
  const [type,setType]=useState("text"); const [text,setText]=useState("");
  const [mediaUrl,setMediaUrl]=useState(null); const [preview,setPreview]=useState(null);
  const [uploading,setUploading]=useState(false); const [busy,setBusy]=useState(false);
  const fRef=useRef(); const canAdd=(myStatuses||[]).length<10;

  const handlePick=async e=>{
    let f=e.target.files[0]; if(!f)return;
    if(f.type.startsWith("image/"))f=await compressImage(f);
    if(f.type.startsWith("video/")&&f.size>25*1024*1024){alert("Max 25MB");return;}
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

// ── STATUS VIEWER — FULLSCREEN PREMIUM ───────────────────
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
    if(isMe)sb.from("status_views").select("viewer_id,profiles(prenom,nom,avatar_url)").eq("status_id",current.id).then(({data})=>setViews(v=>({...v,[current.id]:data||[]})));
    if(!isMe&&session?.user?.id&&!viewed.current.has(current.id)){viewed.current.add(current.id);sb.from("status_views").insert({status_id:current.id,viewer_id:session.user.id});}
    setPaused(false);
    setProgress(0);
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

  // Pause/resume progress and video
  const togglePause=()=>{
    if(paused){
      // Resume
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
      // Pause
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
      {/* Progress bars */}
      <div style={{position:"absolute",top:0,left:0,right:0,zIndex:2,display:"flex",gap:3,padding:"env(safe-area-inset-top,16px) 12px 0"}}>
        {(statuses||[]).map((_,i)=>(
          <div key={i} style={{flex:1,height:2.5,borderRadius:2,background:"rgba(255,255,255,0.2)",overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:2,background:"#fff",width:i<idx?"100%":i===idx?`${progress}%`:"0%",transition:i===idx?"none":"none"}}/>
          </div>
        ))}
      </div>

      {/* Author */}
      <div style={{position:"absolute",top:"calc(env(safe-area-inset-top,16px) + 12px)",left:16,right:16,zIndex:2,display:"flex",alignItems:"center",gap:10,marginTop:8}}>
        <Av u={author} size={38} ring/>
        <div style={{flex:1}}>
          <p style={{margin:0,fontSize:14,fontWeight:600,color:"#fff"}}>{author?.name}</p>
          <p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.5)"}}>{ago(current.ts)}{paused&&" · ⏸ Pause"}</p>
        </div>
        {isMe&&<Btn onClick={()=>{onDelete(current.id);idx>0?setIdx(idx-1):onClose();}} style={{background:"rgba(200,64,64,0.2)",border:`1px solid rgba(200,64,64,0.3)`,borderRadius:8,padding:"5px 10px",color:"#ff6060",fontSize:12,display:"flex",alignItems:"center",gap:4}}><Trash2 size={12}/>Suppr.</Btn>}
        <Btn onClick={onClose} style={{color:"rgba(255,255,255,0.6)",display:"flex",alignItems:"center"}}><X size={22}/></Btn>
      </div>

      {/* Content */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}
        onClick={e=>{
          // Tap anywhere to pause/resume
          const{left,width}=e.currentTarget.getBoundingClientRect();
          const relX=e.clientX-left;
          if(relX<width*0.25){
            // left 25% = prev
            if(!paused){if(idx>0){setIdx(idx-1);setProgress(0);}else onClose();}
            else togglePause();
            return;
          }
          if(relX>width*0.75){
            // right 25% = next
            if(!paused){if(idx<(statuses||[]).length-1){setIdx(idx+1);setProgress(0);}else onClose();}
            else togglePause();
            return;
          }
          // Center = pause/resume
          togglePause();
        }}>
        {current.mediaUrl
          ?<div style={{width:"100%",height:"100%",position:"absolute",inset:0}}>
            {isVideo
              ?<video ref={videoRef} src={current.mediaUrl} autoPlay playsInline muted={false} loop={false} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={()=>{}}/>
              :<img src={current.mediaUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
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

      {/* Bottom actions */}
      <div style={{position:"relative",zIndex:2,padding:"16px 24px",paddingBottom:"calc(16px + env(safe-area-inset-bottom,0px))"}}>
        <div style={{display:"flex",justifyContent:"center",gap:28}}>
          {!isMe&&(
            <Btn onClick={e=>{e.stopPropagation();toggleLike();}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
              <div style={{width:48,height:48,borderRadius:"50%",background:liked?"rgba(201,149,42,0.25)":"rgba(255,255,255,0.1)",border:`1px solid ${liked?T.gold:"rgba(255,255,255,0.2)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,transition:"all .2s",boxShadow:liked?T.glowGold:"none"}}>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:liked?T.goldL:"rgba(255,255,255,0.7)",filter:liked?`drop-shadow(0 0 8px ${T.gold})`:"none",transition:"all .2s"}}>✦</span>
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
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Nom, paroisse…" style={{flex:1,background:"none",border:"none",color:T.text,fontSize:13,outline:"none"}}/>
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
              <div key={u.id} style={{background:T.card,borderRadius:20,overflow:"hidden",border:`1px solid ${T.border}`,animation:`fadeUp .4s ease ${i*.05}s both`,boxShadow:T.shadowCard,transition:"all .25s"}}>
                <div style={{height:72,background:`linear-gradient(135deg,${u.color}33,${u.color}11)`,position:"relative"}}>
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",opacity:.08,fontSize:44,fontFamily:"'Cormorant Garamond',serif",color:u.color}}>✦</div>
                </div>
                <div style={{padding:"0 12px 14px",marginTop:-30}}>
                  <Btn onClick={()=>onUser(u.id)} style={{padding:0,display:"block"}}><Av u={u} size={58}/></Btn>
                  <div style={{marginTop:8}}>
                    <Btn onClick={()=>onUser(u.id)} style={{padding:0,fontSize:13,fontWeight:600,color:T.text,textAlign:"left",display:"block"}}>{u.name}</Btn>
                    <p style={{margin:"2px 0 6px",fontSize:11,color:T.muted}}>⛪ {u.paroisse}</p>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <Badge type={u.badge}/>
                      <Btn onClick={()=>toggle(u.id)} style={{width:34,height:34,borderRadius:"50%",background:conn?T.goldBg2:T.gradGold,color:conn?T.goldL:"#000",fontSize:conn?13:18,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:conn?`1px solid ${T.gold}44`:"none",transition:"all .25s",boxShadow:conn?"none":"0 4px 12px rgba(201,149,42,0.3)"}}>
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

// ── USER VIEW ─────────────────────────────────────────────
function UserView({user,myProfile,session,posts,onBack,onChat,notify,myConnections,myFollowers,onConnectionChange,onImageView}){
  const conn=(myConnections||[]).includes(user.id);
  const [followersCount,setFollowersCount]=useState("…");
  const [followingCount,setFollowingCount]=useState("…");
  const [blocked,setBlocked]=useState(false);
  const [showReport,setShowReport]=useState(false);
  const [detailPost,setDetailPost]=useState(null);

  useEffect(()=>{
    Promise.all([
      sb.from("connections").select("id",{count:"exact",head:true}).eq("to_id",user.id),
      sb.from("connections").select("id",{count:"exact",head:true}).eq("from_id",user.id),
    ]).then(([{count:fc},{count:fg}])=>{setFollowersCount(fc||0);setFollowingCount(fg||0);});
    sb.from("blocks").select("id").eq("blocker_id",session?.user?.id).eq("blocked_id",user.id).single().then(({data})=>{if(data)setBlocked(true);});
  },[user.id,session?.user?.id]);

  const toggle=async()=>{
    if(conn){await sb.from("connections").delete().eq("from_id",session?.user?.id).eq("to_id",user.id);notify("Retiré");}
    else{await sb.from("connections").insert({from_id:session?.user?.id,to_id:user.id});notify("Connecté ✦");}
    onConnectionChange();
  };

  const handleBlock=async()=>{
    if(!window.confirm(blocked?"Débloquer ?":"Bloquer ?"))return;
    if(blocked){await sb.from("blocks").delete().eq("blocker_id",session?.user?.id).eq("blocked_id",user.id);setBlocked(false);notify("Débloqué");}
    else{await sb.from("blocks").insert({blocker_id:session?.user?.id,blocked_id:user.id});setBlocked(true);notify("Bloqué");}
  };

  const handleReport=async(reason,details)=>{
    await sb.from("reports").insert({reporter_id:session?.user?.id,reported_id:user.id,reason,details});
    setShowReport(false);notify("Signalement envoyé ✦");
  };

  const refreshPost=async pid=>{
    const{data}=await sb.from("posts").select(`*,author:profiles(id,prenom,nom,badge,avatar_url,paroisse),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).eq("id",pid).single();
    if(!data)return null;
    return{id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,title:data.event_title||null,eventDate:data.event_date||null,eventLoc:data.event_loc||null,likes:(data.likes||[]).map(l=>l.user_id),comments:(data.comments||[]).map(c=>({id:c.id,by:c.author?.id,author:normProfile(c.author||{}),text:c.text,ts:new Date(c.created_at).getTime()})),saved:[],ts:new Date(data.created_at).getTime()};
  };

  const uPosts=(posts||[]).filter(p=>p.by===user.id);
  const stats=[{l:"POSTS",v:uPosts.length},{l:"ABONNÉS",v:followersCount},{l:"ABONNEMENTS",v:followingCount}];

  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg}}>
      {showReport&&<ReportModal onClose={()=>setShowReport(false)} onSubmit={handleReport}/>}
      {detailPost&&(
        <PostDetailModal post={detailPost} myProfile={myProfile} session={session} getM={id=>id===user.id?user:myProfile}
          onClose={()=>setDetailPost(null)}
          onLike={async pid=>{const liked=(detailPost.likes||[]).includes(session?.user?.id);if(liked)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",session?.user?.id);else await sb.from("likes").insert({post_id:pid,user_id:session?.user?.id});const u=await refreshPost(pid);if(u)setDetailPost(u);}}
          onComment={async()=>{const u=await refreshPost(detailPost.id);if(u)setDetailPost(u);}}
          notify={notify}/>
      )}

      {/* Cover / banner */}
      <div style={{height:180,background:`linear-gradient(160deg,${user.color}44,${user.color}11,transparent)`,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(${user.color}22 1px,transparent 1px)`,backgroundSize:"24px 24px"}}/>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",opacity:.04,fontSize:140,fontFamily:"'Cormorant Garamond',serif",color:user.color}}>✦</div>
      </div>

      <div style={{padding:"0 18px 80px",maxWidth:640,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginTop:-52,marginBottom:16}}>
          <Av u={user} size={90}/>
          <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>onChat(user.id)} style={{background:"rgba(255,255,255,0.06)",border:`1px solid ${T.border}`,borderRadius:14,padding:"9px 16px",color:T.text,fontSize:13,fontWeight:600,backdropFilter:"blur(10px)"}}>Message</Btn>
              <Btn onClick={toggle} style={{background:conn?T.goldBg:T.gradGold,border:conn?`1px solid ${T.gold}44`:"none",borderRadius:14,padding:"9px 18px",color:conn?T.goldL:"#000",fontSize:13,fontWeight:700,boxShadow:conn?"none":"0 4px 16px rgba(201,149,42,0.3)"}}>{conn?"✦ Connecté":"+ Connecter"}</Btn>
            </div>
            <div style={{display:"flex",gap:6}}>
              <Btn onClick={handleBlock} style={{background:"rgba(200,64,64,0.08)",border:"1px solid rgba(200,64,64,0.2)",borderRadius:10,padding:"6px 12px",color:"#e06060",fontSize:11,fontWeight:600}}>{blocked?"Débloquer":"Bloquer"}</Btn>
              <Btn onClick={()=>setShowReport(true)} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:10,padding:"6px 12px",color:T.muted,fontSize:11,fontWeight:600}}>Signaler</Btn>
            </div>
          </div>
        </div>

        <h2 style={{margin:"0 0 4px",fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:400,color:T.text}}>
          {user.fullName||user.name}
          {user.age&&<span style={{fontSize:16,color:T.muted,fontWeight:300}}>, {user.age} ans</span>}
        </h2>
        {user.bio&&<p style={{margin:"0 0 6px",fontSize:14,color:T.sub,lineHeight:1.7}}>{user.bio}</p>}
        <p style={{margin:"0 0 20px",fontSize:12,color:T.muted}}>⛪ {user.paroisse}</p>

        {/* Stats */}
        <div style={{display:"flex",gap:1,background:"rgba(255,255,255,0.03)",borderRadius:18,overflow:"hidden",border:`1px solid ${T.border}`,marginBottom:24,backdropFilter:"blur(10px)"}}>
          {stats.map((s,i)=>(
            <div key={s.l} style={{flex:1,textAlign:"center",padding:"16px 8px",borderRight:i<2?`1px solid ${T.border}`:"none"}}>
              <p style={{margin:"0 0 3px",fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:400,color:T.goldL}}>{s.v}</p>
              <p style={{margin:0,fontSize:9,color:T.muted,letterSpacing:1,textTransform:"uppercase"}}>{s.l}</p>
            </div>
          ))}
        </div>

        <p style={{fontSize:10,color:T.muted,letterSpacing:1.5,marginBottom:12,textTransform:"uppercase"}}>Publications ({uPosts.length})</p>
        {uPosts.length===0
          ?<p style={{color:T.muted,fontSize:13,fontStyle:"italic",textAlign:"center",padding:"30px 0"}}>Aucune publication.</p>
          :uPosts.map(p=>(
            <div key={p.id} onClick={()=>setDetailPost(p)} style={{background:T.card,borderRadius:18,overflow:"hidden",marginBottom:10,border:`1px solid ${T.border}`,cursor:"pointer",transition:"all .2s",boxShadow:T.shadowCard}}>
              {p.img&&<MediaPlayer url={p.img} style={{maxHeight:200}} onImageClick={e=>{e.stopPropagation?.();onImageView(p.img);}}/>}
              <div style={{padding:14}}>
                <p style={{margin:"0 0 6px",fontSize:13,color:T.text,lineHeight:1.6}}>{p.text||p.title}</p>
                <span style={{fontSize:11,color:T.muted}}>{ago(p.ts)} · ❤ {(p.likes||[]).length} · 💬 {(p.comments||[]).length}</span>
              </div>
            </div>
          ))
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
    sb.from("blocks").select("id").eq("blocker_id",session?.user?.id).eq("blocked_id",user.id).single().then(({data})=>{if(data)setBlocked(true);});
  },[user.id,session?.user?.id]);

  const toggle=async()=>{
    if(conn){await sb.from("connections").delete().eq("from_id",session?.user?.id).eq("to_id",user.id);notify("Retiré");}
    else{await sb.from("connections").insert({from_id:session?.user?.id,to_id:user.id});notify("Abonné ✦");}
    onConnectionChange();
  };

  const handleBlock=async()=>{
    if(!window.confirm(blocked?"Débloquer ?":"Bloquer ?"))return;
    if(blocked){await sb.from("blocks").delete().eq("blocker_id",session?.user?.id).eq("blocked_id",user.id);setBlocked(false);notify("Débloqué");}
    else{await sb.from("blocks").insert({blocker_id:session?.user?.id,blocked_id:user.id});setBlocked(true);notify("Bloqué");}
  };

  const handleReport=async(reason,details)=>{
    await sb.from("reports").insert({reporter_id:session?.user?.id,reported_id:user.id,reason,details});
    setShowReport(false);notify("Signalement envoyé ✦");
  };

  const isMe=session?.user?.id===user.id;
  const uPosts=(posts||[]).filter(p=>p.by===user.id);
  const orgTypeLabel={paroisse:"⛪ Paroisse / Ward",pieu:"🏛️ Pieu",mission:"✈️ Mission",seminaire:"📚 Séminaire",association:"🤝 Association",autre:"📌 Organisation"}[user.org_type]||"🏛️ Organisation";

  const uploadAvatar=async e=>{const f=e.target.files[0];if(!f)return;const path=`avatars/${user.id}.${f.name.split(".").pop()}`;await sb.storage.from("avatars").upload(path,f,{upsert:true});const{data}=sb.storage.from("avatars").getPublicUrl(path);await sb.from("profiles").update({avatar_url:data.publicUrl}).eq("id",user.id);notify("Photo mise à jour ✦");};
  const uploadCover=async e=>{const f=e.target.files[0];if(!f)return;const path=`covers/${user.id}.${f.name.split(".").pop()}`;await sb.storage.from("avatars").upload(path,f,{upsert:true});const{data}=sb.storage.from("avatars").getPublicUrl(path);await sb.from("profiles").update({cover_url:data.publicUrl}).eq("id",user.id);setCoverPhoto(data.publicUrl);notify("Couverture mise à jour ✦");};

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
        <Btn onClick={onBack} style={{position:"absolute",top:16,left:16,background:"rgba(0,0,0,0.6)",borderRadius:12,padding:"8px 14px",color:"#fff",fontSize:13,backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.1)"}}>← Retour</Btn>
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

        <p style={{fontSize:10,color:T.muted,letterSpacing:1.5,marginBottom:12,textTransform:"uppercase"}}>Publications ({uPosts.length})</p>
        {uPosts.length===0
          ?<div style={{textAlign:"center",padding:"40px 0",color:T.muted}}><div style={{fontSize:40,marginBottom:8,animation:"float 3s ease infinite"}}>✦</div><p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Aucune publication encore</p></div>
          :uPosts.map(p=>(
            <div key={p.id} onClick={()=>setDetailPost(p)} style={{background:T.card,borderRadius:18,overflow:"hidden",marginBottom:10,border:`1px solid ${T.border}`,cursor:"pointer",transition:"all .2s"}}>
              {p.img&&<MediaPlayer url={p.img} style={{maxHeight:200}} onImageClick={()=>onImageView(p.img)}/>}
              <div style={{padding:14}}>
                <p style={{margin:"0 0 6px",fontSize:13,color:T.text,lineHeight:1.6}}>{p.text||p.title}</p>
                <span style={{fontSize:11,color:T.muted}}>{ago(p.ts)} · ❤ {(p.likes||[]).length} · 💬 {(p.comments||[]).length}</span>
              </div>
            </div>
          ))
        }
        <div style={{height:80}}/>
      </div>
    </div>
  );
}

// ── MESSAGES TAB ──────────────────────────────────────────
function MsgsTab({convs,members,getM,onOpen,onDeleteConv}){
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
          const prev=!last?"":last.type==="photo"?"📷 Photo":last.type==="file"?`📎 ${last.fileName}`:last.text||"";
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
              <Btn onClick={()=>{if(window.confirm(`Supprimer ?`))onDeleteConv(c.id);}} style={{padding:"0 16px",color:T.err,opacity:.3,display:"flex",alignItems:"center"}}><Trash2 size={16}/></Btn>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── CHAT SCREEN ───────────────────────────────────────────
function ChatScreen({conv,myProfile,session,members,reload,notify,onImageView,onOpenProfile}){
  const user=(members||[]).find(m=>m.id===conv.uid)||{name:"…",initials:"?",color:"#888"};
  const [inp,setInp]=useState(""); const [attach,setAttach]=useState(false);
  const [recording,setRecording]=useState(false); const [recordSecs,setRecordSecs]=useState(0);
  const [bgPhoto,setBgPhoto]=useState(null);
  const [sendingMsgs,setSendingMsgs]=useState([]); // optimistic pending msgs
  const bottomRef=useRef(); const fRef=useRef(); const iRef=useRef(); const bgRef=useRef();
  const mediaRecRef=useRef(); const timerRef=useRef(); const isFirstLoad=useRef(true);

  useEffect(()=>{
    try{const s=localStorage.getItem(`chat_bg_${conv.id}`);if(s)setBgPhoto(s);}catch(_){}
  },[conv.id]);

  useEffect(()=>{
    const ch=sb.channel(`chat_${conv.id}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conv_id=eq.${conv.id}`},()=>reload()).on("postgres_changes",{event:"DELETE",schema:"public",table:"messages",filter:`conv_id=eq.${conv.id}`},()=>reload()).subscribe();
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
    sb.from("messages").update({is_read:true}).in("id",ids).then(()=>{
      // After marking read, reload to sync unread counters
      reload();
    });
  },[conv.id,conv.msgs?.length]);

  const ensureConv=async()=>{
    const{data}=await sb.from("conversations").select("id").or(`and(user1_id.eq.${session?.user?.id},user2_id.eq.${conv.uid}),and(user1_id.eq.${conv.uid},user2_id.eq.${session?.user?.id})`).maybeSingle();
    if(data)return data.id;
    const{data:created}=await sb.from("conversations").insert({user1_id:session?.user?.id,user2_id:conv.uid}).select().single();
    return created?.id;
  };

  const sendMsg=async payload=>{
    // Optimistic local bubble
    const tempId="tmp_"+Date.now();
    setSendingMsgs(p=>[...p,{id:tempId,...payload,f:"me",ts:Date.now(),sending:true}]);
    const convId=await ensureConv(); if(!convId){setSendingMsgs(p=>p.filter(m=>m.id!==tempId));return;}
    const{error}=await sb.from("messages").insert({conv_id:convId,sender_id:session?.user?.id,...payload});
    setSendingMsgs(p=>p.filter(m=>m.id!==tempId));
    if(error){notify("Erreur d'envoi, réessayez");return;}
    setInp("");setAttach(false);reload();
  };

  const sendTxt=()=>{if(inp.trim())sendMsg({type:"text",text:inp.trim()});};

  const handleFile=async(e,isImg)=>{
    const f=e.target.files[0]; if(!f)return;
    // Validate file size
    if(f.size>50*1024*1024){notify("Fichier trop lourd (max 50MB)");return;}
    const tempId="tmp_file_"+Date.now();
    setSendingMsgs(p=>[...p,{id:tempId,type:isImg?"photo":"file",fileName:f.name,f:"me",ts:Date.now(),sending:true}]);
    const path=`messages/${session?.user?.id}/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
    const{error,data}=await sb.storage.from("celeste-media").upload(path,f,{upsert:true,contentType:f.type});
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
      rec.start(); mediaRecRef.current=rec;
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
            {user.online?"En ligne":"⛪ "+user.paroisse}
          </p>
        </div>
        <Btn onClick={()=>bgRef.current.click()} style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${T.border}`,borderRadius:10,padding:"6px 10px",color:T.muted,display:"flex",alignItems:"center"}}><Image size={15}/></Btn>
      </div>

      {/* Messages */}
      <div style={{position:"relative",zIndex:1,flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:6}}>
        {(conv.msgs||[]).length===0&&sendingMsgs.length===0&&(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,color:T.muted}}>
            <div style={{width:80,height:80,borderRadius:"50%",background:`radial-gradient(${user.color}22,transparent)`,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Av u={user} size={60} onClick={()=>onOpenProfile&&onOpenProfile(user.id)}/>
            </div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,textAlign:"center",color:T.sub}}>Démarrez la conversation<br/>avec {user.name}</p>
          </div>
        )}
        {[...(conv.msgs||[]),...sendingMsgs].map(m=>{
          const mine=m.f==="me"||m.f===session?.user?.id;
          const isSending=!!m.sending;
          const bubble=(
            <div style={{display:"flex",justifyContent:mine?"flex-end":"flex-start",alignItems:"flex-end",gap:8,animation:isSending?"none":"msgIn .25s ease"}}>
              {!mine&&<Av u={user} size={28} onClick={()=>onOpenProfile&&onOpenProfile(user.id)}/>}
              <div style={{maxWidth:"72%",opacity:isSending?0.65:1,transition:"opacity .3s"}}>
                <div style={{
                  background:mine?T.gradGold:"rgba(255,255,255,0.07)",
                  borderRadius:mine?"18px 18px 4px 18px":"18px 18px 18px 4px",
                  padding:"10px 14px",
                  border:mine?"none":`1px solid ${T.border}`,
                  boxShadow:mine?"0 4px 20px rgba(201,149,42,0.25)":"0 2px 8px rgba(0,0,0,0.3)"
                }}>
                  {m.type==="photo"&&m.img&&<MediaPlayer url={m.img} style={{borderRadius:10,maxHeight:200}} onImageClick={onImageView}/>}
                  {m.type==="file"&&(m.img||m.file_url)&&<Btn onClick={()=>window.open(m.img||m.file_url,"_blank")} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
                    <span style={{fontSize:22,flexShrink:0}}>
                      {(m.fileName||"").match(/\.pdf$/i)?"📄":(m.fileName||"").match(/\.(doc|docx)$/i)?"📝":(m.fileName||"").match(/\.(xls|xlsx)$/i)?"📊":"📎"}
                    </span>
                    <span style={{fontSize:12,fontWeight:600,color:mine?"#000":T.text,wordBreak:"break-all"}}>{m.fileName||"Fichier"}</span>
                  </Btn>}
                  {m.type==="voice"&&(m.img||m.file_url)&&<audio controls src={m.img||m.file_url} style={{maxWidth:"200px",height:32,borderRadius:16}}/>}
                  {m.type==="voice"&&isSending&&<div style={{display:"flex",alignItems:"center",gap:6,color:mine?"#000":T.text}}><div style={{display:"flex",gap:2,alignItems:"center"}}>{[1,2,3,4,5].map(i=><div key={i} style={{width:3,background:"currentColor",borderRadius:2,animation:`waveform ${0.4+i*.1}s ease infinite`,animationDelay:`${i*.08}s`,opacity:.6}}/>)}</div><span style={{fontSize:11,opacity:.7}}>Envoi…</span></div>}
                  {m.text&&<p style={{margin:0,fontSize:14,color:mine?"#000":T.text,lineHeight:1.55,whiteSpace:"pre-wrap"}}>{m.text}</p>}
                </div>
                <div style={{display:"flex",gap:4,alignItems:"center",marginTop:4,justifyContent:mine?"flex-end":"flex-start"}}>
                  <span style={{fontSize:10,color:T.muted}}>{isSending?"⏳":hm(m.ts)}</span>
                  {mine&&!isSending&&(
                    <span style={{
                      fontSize:12,
                      fontWeight:700,
                      color:m.read?"#4A8AC4":T.muted,
                      filter:m.read?"drop-shadow(0 0 4px rgba(74,138,196,0.8))":"none",
                      transition:"all .3s"
                    }}>✓✓</span>
                  )}
                  {mine&&isSending&&<span style={{fontSize:10,color:T.muted,animation:"pulse 1s infinite"}}>✓</span>}
                </div>
              </div>
            </div>
          );
          return mine?<SwipeToDelete key={m.id} onDelete={()=>!isSending&&deleteMsg(m.id)}>{bubble}</SwipeToDelete>:<div key={m.id}>{bubble}</div>;
        })}
        <div ref={bottomRef}/>
      </div>

      {/* Attach menu */}
      {attach&&(
        <div style={{position:"relative",zIndex:1,background:"rgba(8,8,8,0.98)",borderTop:`1px solid ${T.border}`,padding:"16px",flexShrink:0,animation:"slideUp .25s ease"}}>
          <div style={{display:"flex",gap:12}}>
            {[{ic:<Camera size={22}/>,l:"Photo/Vidéo",fn:()=>iRef.current.click()},{ic:<Image size={22}/>,l:"Fichier",fn:()=>fRef.current.click()}].map(a=>(
              <Btn key={a.l} onClick={()=>{a.fn();setAttach(false);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,background:T.goldBg,border:`1px solid ${T.gold}22`,borderRadius:16,padding:"14px 8px",flex:1,color:T.goldL}}>
                {a.ic}<span style={{fontSize:10,fontWeight:600}}>{a.l}</span>
              </Btn>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div style={{position:"relative",zIndex:1,background:"rgba(0,0,0,0.96)",borderTop:`1px solid ${T.border}`,padding:"8px 12px",display:"flex",alignItems:"center",gap:8,flexShrink:0,paddingBottom:"calc(8px + env(safe-area-inset-bottom,0px))"}}>
        <Btn onClick={()=>setAttach(!attach)} style={{background:attach?T.gradGold:"rgba(255,255,255,0.06)",border:`1px solid ${attach?"transparent":T.border}`,borderRadius:"50%",width:42,height:42,display:"flex",alignItems:"center",justifyContent:"center",color:attach?"#000":T.gold,flexShrink:0,transition:"all .2s",fontSize:20}}>+</Btn>
        <div style={{flex:1,background:"rgba(255,255,255,0.05)",border:`1px solid ${T.border}`,borderRadius:24,display:"flex",alignItems:"center",padding:"7px 7px 7px 14px",transition:"border-color .2s"}}>
          {recording
            ?<div style={{flex:1,display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:T.err,animation:"pulse 1s infinite",boxShadow:"0 0 8px rgba(200,64,64,0.6)"}}/>
              <span style={{fontSize:13,color:T.text,fontWeight:600}}>{String(Math.floor(recordSecs/60)).padStart(2,"0")}:{String(recordSecs%60).padStart(2,"0")}</span>
              <div style={{display:"flex",gap:2,alignItems:"center"}}>
                {[1,2,3,4,5].map(i=><div key={i} style={{width:3,background:T.gold,borderRadius:2,animation:`waveform ${0.4+i*.1}s ease infinite`,animationDelay:`${i*.08}s`}}/>)}
              </div>
            </div>
            :<textarea value={inp}
              onChange={e=>{setInp(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";}}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&window.innerWidth>768){e.preventDefault();sendTxt();}}}
              placeholder="Message…" rows={1}
              style={{flex:1,background:"none",border:"none",color:T.text,fontSize:14,outline:"none",resize:"none",lineHeight:1.5,maxHeight:120,overflowY:"auto",fontFamily:"'DM Sans',sans-serif",padding:0}}/>
          }
        </div>
        {inp.trim()
          ?<Btn onClick={sendTxt} style={{background:T.gradGold,borderRadius:"50%",width:42,height:42,display:"flex",alignItems:"center",justifyContent:"center",color:"#000",flexShrink:0,boxShadow:"0 4px 16px rgba(201,149,42,0.4)"}}><Send size={16}/></Btn>
          :<button onClick={recording?stopRecording:startRecording} style={{background:recording?"rgba(200,64,64,0.3)":"rgba(255,255,255,0.06)",border:`1px solid ${recording?T.err:T.border}`,borderRadius:"50%",width:42,height:42,display:"flex",alignItems:"center",justifyContent:"center",color:recording?T.err:T.muted,flexShrink:0,transition:"all .2s",cursor:"pointer"}}><Mic size={18}/></button>
        }
      </div>
    </div>
  );
}

// ── PROFILE TAB ───────────────────────────────────────────
function ProfileTab({myProfile,session,posts,onNewPost,notify,onLogout,reload,myConnections,myFollowers,onImageView}){
  const [edit,setEdit]=useState(false);
  const [prenom,setPrenom]=useState(myProfile?.fullName?.split(" ")[0]||"");
  const [nom,setNom]=useState(myProfile?.fullName?.split(" ").slice(1).join(" ")||"");
  const [bio,setBio]=useState(myProfile?.bio||"");
  const [paroisse,setParoisse]=useState(myProfile?.paroisse||"");
  const [ptab,setPtab]=useState("posts");
  const [busy,setBusy]=useState(false); const [uploading,setUploading]=useState(false);
  const [detailPost,setDetailPost]=useState(null);
  const [showFollowers,setShowFollowers]=useState(false); const [showFollowing,setShowFollowing]=useState(false);
  const [followersList,setFollowersList]=useState([]); const [followingList,setFollowingList]=useState([]);
  const avRef=useRef();

  const loadFollowers=async()=>{const{data}=await sb.from("connections").select("from_id,profiles!connections_from_id_fkey(id,prenom,nom,avatar_url,badge)").eq("to_id",session?.user?.id);if(data)setFollowersList(data.map(d=>normProfile(d.profiles)));setShowFollowers(true);};
  const loadFollowing=async()=>{const{data}=await sb.from("connections").select("to_id,profiles!connections_to_id_fkey(id,prenom,nom,avatar_url,badge)").eq("from_id",session?.user?.id);if(data)setFollowingList(data.map(d=>normProfile(d.profiles)));setShowFollowing(true);};

  const myPosts=(posts||[]).filter(p=>p.by===session?.user?.id);
  const savedPosts=(posts||[]).filter(p=>(p.saved||[]).includes("me"));

  const handleAvatar=async e=>{
    const f=e.target.files[0]; if(!f)return;
    setUploading(true);
    const path=`avatars/${session?.user?.id}/avatar_${Date.now()}`;
    const{error}=await sb.storage.from("celeste-media").upload(path,f,{upsert:true});
    if(!error){const{data:{publicUrl}}=sb.storage.from("celeste-media").getPublicUrl(path);await sb.from("profiles").update({avatar_url:publicUrl}).eq("id",session?.user?.id);reload();notify("Photo mise à jour ✦");}
    else notify("Erreur upload");
    setUploading(false);e.target.value="";
  };

  const saveBio=async()=>{
    setBusy(true);
    await sb.from("profiles").update({bio,prenom:prenom.trim(),nom:nom.trim(),paroisse:paroisse.trim()}).eq("id",session?.user?.id);
    setBusy(false);setEdit(false);reload();notify("Profil mis à jour ✦");
  };

  const stats=[
    {l:"POSTS",v:myPosts.length,fn:null},
    {l:"ABONNÉS",v:(myFollowers||[]).length,fn:loadFollowers},
    {l:"ABONNEMENTS",v:(myConnections||[]).length,fn:loadFollowing},
  ];

  const FollowerModal=({list,title,onClose})=>(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:900,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(8px)"}}>
      <div style={{background:T.bg3,borderRadius:"24px 24px 0 0",padding:24,width:"100%",maxWidth:640,maxHeight:"70vh",overflow:"auto",border:`1px solid ${T.border}`,animation:"slideUp .3s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h3 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T.text}}>{title} ({list.length})</h3>
          <Btn onClick={onClose} style={{color:T.muted,display:"flex",alignItems:"center"}}><X size={20}/></Btn>
        </div>
        {list.map(u=>(
          <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
            <Av u={u} size={44}/><div style={{flex:1}}><p style={{margin:"0 0 2px",fontSize:14,fontWeight:600,color:T.text}}>{u.fullName}</p><p style={{margin:0,fontSize:11,color:T.muted}}>{u.paroisse}</p></div>
            {u.badge&&<Badge type={u.badge}/>}
          </div>
        ))}
      </div>
    </div>
  );

  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg}}>
      {detailPost&&(
        <PostDetailModal post={detailPost} myProfile={myProfile} session={session} getM={()=>myProfile}
          onClose={()=>setDetailPost(null)}
          onLike={async pid=>{const liked=(detailPost.likes||[]).includes(session?.user?.id);if(liked)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",session?.user?.id);else await sb.from("likes").insert({post_id:pid,user_id:session?.user?.id});}}
          onComment={reload} notify={notify}/>
      )}
      {showFollowers&&<FollowerModal list={followersList} title="Abonnés" onClose={()=>setShowFollowers(false)}/>}
      {showFollowing&&<FollowerModal list={followingList} title="Abonnements" onClose={()=>setShowFollowing(false)}/>}

      <input ref={avRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatar}/>

      {/* Banner */}
      <div style={{height:160,background:"linear-gradient(160deg,rgba(201,149,42,0.12),rgba(201,149,42,0.03),transparent)",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(${T.border} 1px,transparent 1px)`,backgroundSize:"30px 30px",opacity:.4}}/>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",opacity:.03,fontSize:160,fontFamily:"'Cormorant Garamond',serif"}}>✦</div>
      </div>

      <div style={{padding:"0 18px 80px",maxWidth:640,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginTop:-54,marginBottom:16}}>
          <div style={{position:"relative"}}>
            <div onClick={()=>myProfile?.avatar_url&&onImageView(myProfile.avatar_url)} style={{cursor:myProfile?.avatar_url?"pointer":"default"}}>
              <Av u={myProfile} size={96}/>
            </div>
            <div onClick={()=>avRef.current.click()} style={{position:"absolute",bottom:2,right:0,width:30,height:30,borderRadius:"50%",background:T.gradGold,display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${T.bg}`,cursor:"pointer",boxShadow:T.glowGold}}>
              {uploading?<div style={{width:13,height:13,border:"2px solid rgba(0,0,0,.4)",borderTopColor:"#000",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>:<Camera size={13} color="#000"/>}
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={()=>edit?saveBio():setEdit(true)} style={{background:T.gradGold,borderRadius:14,padding:"9px 18px",color:"#000",fontSize:13,fontWeight:700,boxShadow:"0 4px 16px rgba(201,149,42,0.3)"}}>
              {busy?"…":edit?"Enregistrer ✦":"✏ Modifier"}
            </Btn>
            {edit&&<Btn onClick={()=>setEdit(false)} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,padding:"9px 14px",color:T.muted,fontSize:13}}><X size={14}/></Btn>}
          </div>
        </div>

        <h2 style={{margin:"0 0 4px",fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:400,color:T.text}}>
          {myProfile?.fullName}
          {myProfile?.age&&<span style={{fontSize:16,color:T.muted,fontWeight:300}}> · {myProfile.age} ans</span>}
        </h2>
        <p style={{margin:"0 0 8px",fontSize:12,color:T.muted}}>⛪ {myProfile?.paroisse}</p>

        {edit
          ?<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
            {[{val:prenom,set:setPrenom,ph:"Prénom"},{val:nom,set:setNom,ph:"Nom"},{val:paroisse,set:setParoisse,ph:"Paroisse"}].map(({val,set,ph})=>(
              <input key={ph} value={val} onChange={e=>set(e.target.value)} placeholder={ph} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.gold}44`,borderRadius:12,padding:"10px 13px",color:T.text,fontSize:14,outline:"none"}}/>
            ))}
            <textarea value={bio} onChange={e=>setBio(e.target.value)} rows={3} placeholder="Biographie…" style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.gold}44`,borderRadius:12,padding:"10px 13px",color:T.text,fontSize:14,outline:"none",resize:"none",lineHeight:1.65}}/>
          </div>
          :<p style={{margin:"0 0 14px",fontSize:14,color:myProfile?.bio?T.sub:T.muted,lineHeight:1.7,fontStyle:myProfile?.bio?"normal":"italic"}}>{myProfile?.bio||"Ajoutez une biographie…"}</p>
        }

        {myProfile?.badge&&<div style={{marginBottom:18}}><Badge type={myProfile.badge}/></div>}

        {/* Stats */}
        <div style={{display:"flex",gap:1,background:"rgba(255,255,255,0.03)",borderRadius:18,overflow:"hidden",border:`1px solid ${T.border}`,marginBottom:22}}>
          {stats.map((s,i)=>(
            <div key={s.l} onClick={s.fn||undefined} style={{flex:1,textAlign:"center",padding:"16px 8px",borderRight:i<2?`1px solid ${T.border}`:"none",cursor:s.fn?"pointer":"default",transition:"background .2s"}}
              onMouseEnter={e=>{if(s.fn)e.currentTarget.style.background="rgba(201,149,42,0.05)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="none";}}>
              <p style={{margin:"0 0 3px",fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:400,color:T.goldL}}>{s.v}</p>
              <p style={{margin:0,fontSize:9,color:T.muted,letterSpacing:1.5,textTransform:"uppercase"}}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,marginBottom:16}}>
          {[{id:"posts",l:"📷 Posts"},{id:"saved",l:"🔖 Sauvegardés"},{id:"about",l:"ℹ À propos"}].map(t=>(
            <Btn key={t.id} onClick={()=>setPtab(t.id)} style={{flex:1,padding:"10px 4px",color:ptab===t.id?T.goldL:T.muted,fontWeight:ptab===t.id?700:400,fontSize:12,borderBottom:ptab===t.id?`2px solid ${T.gold}`:"2px solid transparent",transition:"all .2s"}}>
              {t.l}
            </Btn>
          ))}
        </div>

        {ptab==="posts"&&(
          <>
            <Btn onClick={onNewPost} style={{width:"100%",background:T.goldBg,border:`1.5px dashed ${T.gold}33`,borderRadius:16,padding:"14px",color:T.goldL,fontSize:13,fontWeight:600,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all .2s"}}>
              <Plus size={16}/>Nouvelle publication
            </Btn>
            {myPosts.length===0
              ?<p style={{color:T.muted,textAlign:"center",padding:"30px 0",fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Aucune publication encore</p>
              :<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {myPosts.map(p=>(
                  <div key={p.id} onClick={()=>setDetailPost(p)} style={{background:T.card,borderRadius:16,overflow:"hidden",border:`1px solid ${T.border}`,cursor:"pointer",transition:"all .2s",boxShadow:T.shadowCard}}>
                    {p.img
                      ?<MediaPlayer url={p.img} style={{height:120,objectFit:"cover"}} onImageClick={e=>{e.stopPropagation?.();onImageView(p.img);}}/>
                      :<div style={{height:80,background:`linear-gradient(135deg,${T.goldBg},transparent)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontFamily:"'Cormorant Garamond',serif",color:T.gold}}>✦</div>
                    }
                    <div style={{padding:"8px 10px"}}>
                      <p style={{margin:"0 0 4px",fontSize:12,color:T.text,lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.text||p.title||"Publication"}</p>
                      <span style={{fontSize:10,color:T.muted}}>❤ {(p.likes||[]).length} · 💬 {(p.comments||[]).length} · {ago(p.ts)}</span>
                    </div>
                  </div>
                ))}
              </div>
            }
          </>
        )}

        {ptab==="saved"&&(
          savedPosts.length===0
            ?<p style={{color:T.muted,textAlign:"center",padding:"30px 0",fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Aucune publication sauvegardée</p>
            :savedPosts.map(p=>(
              <div key={p.id} style={{background:T.card,borderRadius:14,overflow:"hidden",marginBottom:10,border:`1px solid ${T.border}`}}>
                <div style={{padding:12}}><p style={{margin:"0 0 4px",fontSize:13,color:T.text,lineHeight:1.4}}>{p.text||p.title}</p><span style={{fontSize:10,color:T.muted}}>❤ {(p.likes||[]).length} · {ago(p.ts)}</span></div>
              </div>
            ))
        )}

        {ptab==="about"&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[{ic:"📅",l:"Membre depuis",v:myProfile?.joined},{ic:"🛡",l:"Badge",v:myProfile?.badge==="confirmed"?"✅ Confirmé":myProfile?.badge==="friend"?"🔵 Ami de l'Église":"—"},{ic:"📧",l:"Email",v:session?.user?.email}].map(it=>(
              <div key={it.l} style={{display:"flex",alignItems:"center",gap:12,padding:"14px",background:T.card,borderRadius:16,border:`1px solid ${T.border}`}}>
                <span style={{fontSize:22,flexShrink:0}}>{it.ic}</span>
                <div><p style={{margin:"0 0 2px",fontSize:9,color:T.muted,letterSpacing:1.5,textTransform:"uppercase"}}>{it.l}</p><p style={{margin:0,fontSize:13,fontWeight:500,color:T.text}}>{it.v||"—"}</p></div>
              </div>
            ))}
            <div style={{background:T.card,borderRadius:16,border:`1px solid ${T.border}`,padding:18,marginTop:4}}>
              <p style={{margin:"0 0 10px",fontSize:9,color:T.muted,letterSpacing:1.5,textTransform:"uppercase"}}>À propos de Céleste</p>
              <p style={{margin:"0 0 12px",fontSize:13,color:T.sub,lineHeight:1.8}}>Céleste est une application de rencontres amicales pensée pour les membres de l'Église de Jésus-Christ des Saints des Derniers Jours.</p>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <a href="mailto:georgipamboubiayandi8@gmail.com" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:10,color:T.goldL,fontSize:13,textDecoration:"none"}}>📧 georgipamboubiayandi8@gmail.com</a>
                <a href="https://wa.me/242067131327" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:10,color:T.goldL,fontSize:13,textDecoration:"none"}}>📱 +242 067 131 327</a>
              </div>
            </div>
            <Btn onClick={()=>subscribePush(sb,session?.user?.id).then(s=>s?notify("Notifications activées ✦"):notify("Permission refusée"))} style={{padding:"14px",background:T.goldBg,border:`1px solid ${T.gold}33`,borderRadius:14,color:T.goldL,fontSize:14,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><Bell size={16}/>Activer les notifications</Btn>
            <Btn onClick={()=>{if(window.confirm("Se déconnecter ?"))onLogout();}} style={{padding:"14px",background:"rgba(200,64,64,0.06)",border:`1px solid ${T.err}33`,borderRadius:14,color:T.err,fontSize:14,fontWeight:600}}>Se déconnecter</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ADMIN PANEL ───────────────────────────────────────────
function AdminPanel({onClose,notify,reload,reloadPosts}){
  const [filter,setFilter]=useState("all"); const [allM,setAllM]=useState([]);
  const [showPosts,setShowPosts]=useState(false); const [allPosts,setAllPosts]=useState([]);
  const [allReports,setAllReports]=useState([]);

  useEffect(()=>{
    sb.from("profiles").select("*").then(({data})=>{if(data)setAllM(data.map(normProfile));});
    sb.from("posts").select(`*,author:profiles(prenom,nom)`).order("created_at",{ascending:false}).limit(50).then(({data})=>{if(data)setAllPosts(data);});
    sb.from("reports").select(`*,reporter:profiles!reporter_id(prenom,nom),reported:profiles!reported_id(prenom,nom)`).order("created_at",{ascending:false}).then(({data})=>{if(data)setAllReports(data);});
  },[]);

  const togglePin=async(pid,pinned)=>{await sb.from("posts").update({pinned:!pinned}).eq("id",pid);setAllPosts(p=>(p||[]).map(x=>x.id===pid?{...x,pinned:!pinned}:x));reloadPosts();notify(pinned?"Non-sponsorisé":"Sponsorisé ✦");};
  const approve=async(id,badge)=>{const upd={status:"active"};if(badge)upd.badge=badge;await sb.from("profiles").update(upd).eq("id",id);setAllM(p=>(p||[]).map(m=>m.id===id?{...m,status:"active",badge:badge||m.badge}:m));reload();notify("Approuvé ✦");};
  const reject=async id=>{if(!window.confirm("Supprimer ?"))return;await sb.from("profiles").delete().eq("id",id);setAllM(p=>(p||[]).filter(m=>m.id!==id));reload();notify("Supprimé");};
  const chBadge=async(id,badge)=>{await sb.from("profiles").update({badge}).eq("id",id);setAllM(p=>(p||[]).map(m=>m.id===id?{...m,badge}:m));notify("Badge mis à jour ✦");};
  const suspend=async(id,st)=>{const ns=st==="suspended"?"active":"suspended";await sb.from("profiles").update({status:ns}).eq("id",id);setAllM(p=>(p||[]).map(m=>m.id===id?{...m,status:ns}:m));notify("Statut modifié");};

  const cnt={all:(allM||[]).length,pending:(allM||[]).filter(m=>m.status==="pending").length,confirmed:(allM||[]).filter(m=>m.badge==="confirmed"&&m.status==="active").length,friend:(allM||[]).filter(m=>m.badge==="friend"&&m.status==="active").length};
  const list=filter==="pending"?(allM||[]).filter(m=>m.status==="pending"):filter==="confirmed"?(allM||[]).filter(m=>m.badge==="confirmed"&&m.status==="active"):filter==="friend"?(allM||[]).filter(m=>m.badge==="friend"&&m.status==="active"):allM;

  return(
    <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",display:"flex",alignItems:"stretch",justifyContent:"flex-end"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{width:"100%",maxWidth:480,background:T.bg,border:`1px solid ${T.border}`,display:"flex",flexDirection:"column",animation:"slideIn .3s cubic-bezier(0.34,1.1,0.64,1)"}}>
        <div style={{background:"linear-gradient(160deg,rgba(201,149,42,0.08),transparent)",borderBottom:`1px solid ${T.border}`,padding:"20px 20px 16px",flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><p style={{margin:"0 0 4px",fontSize:9,color:T.muted,letterSpacing:2,textTransform:"uppercase"}}>Panneau Admin</p><h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:400,color:T.text}}>🛡 Gestion</h2></div>
            <Btn onClick={onClose} style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${T.border}`,borderRadius:"50%",width:36,height:36,color:T.muted,display:"flex",alignItems:"center",justifyContent:"center"}}><X size={16}/></Btn>
          </div>
        </div>
        <div style={{padding:"10px 14px",background:T.card,borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div style={{display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none"}}>
            {[{id:"all",l:"Tous",v:cnt.all},{id:"pending",l:"⏳",v:cnt.pending},{id:"confirmed",l:"✅",v:cnt.confirmed},{id:"friend",l:"🔵",v:cnt.friend},{id:"reports",l:"🚨",v:(allReports||[]).length}].map(f=>(
              <Btn key={f.id} onClick={()=>setFilter(f.id)} style={{flexShrink:0,padding:"6px 12px",borderRadius:10,border:`1px solid ${filter===f.id?T.gold+"66":T.border}`,background:filter===f.id?T.goldBg:"none",color:filter===f.id?T.goldL:T.muted,fontSize:12,fontWeight:filter===f.id?700:400,display:"flex",alignItems:"center",gap:5}}>
                {f.l}<span style={{background:"rgba(255,255,255,0.06)",borderRadius:8,fontSize:9,padding:"1px 5px",fontWeight:700}}>{f.v}</span>
              </Btn>
            ))}
          </div>
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
              {(list||[]).length===0&&<p style={{textAlign:"center",padding:30,color:T.muted,fontStyle:"italic"}}>Aucun membre</p>}
              {(list||[]).map(m=>(
                <div key={m.id} style={{padding:"14px 16px",borderBottom:`1px solid ${T.border}`,background:m.status==="pending"?"rgba(201,149,42,0.03)":m.status==="suspended"?"rgba(200,64,64,0.03)":"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:10}}>
                    <Av u={m} size={44}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3,flexWrap:"wrap"}}>
                        <span style={{fontSize:13,fontWeight:600,color:T.text}}>{m.fullName||m.name}</span>
                        {m.status==="pending"&&<span style={{fontSize:8,background:"rgba(201,149,42,0.12)",color:T.goldL,padding:"2px 8px",borderRadius:20,fontWeight:700,letterSpacing:.5}}>EN ATTENTE</span>}
                        {m.status==="suspended"&&<span style={{fontSize:8,background:"rgba(200,64,64,0.12)",color:T.err,padding:"2px 8px",borderRadius:20,fontWeight:700,letterSpacing:.5}}>SUSPENDU</span>}
                      </div>
                      <p style={{margin:0,fontSize:11,color:T.muted}}>⛪ {m.paroisse} · {m.joined}</p>
                      {m.whatsapp&&<a href={`https://wa.me/${m.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#25D366",fontWeight:600,display:"inline-flex",alignItems:"center",gap:4,marginTop:3,textDecoration:"none"}}>📱 {m.whatsapp}</a>}
                    </div>
                  </div>
                  {m.badge&&<div style={{marginBottom:8}}><Badge type={m.badge}/></div>}
                  {m.status==="pending"
                    ?<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <Btn onClick={()=>approve(m.id,null)} style={{flex:1,padding:"8px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:10,color:T.sub,fontSize:11,fontWeight:700}}>✓ Confirmer</Btn>
                      <Btn onClick={()=>approve(m.id,"confirmed")} style={{flex:1,padding:"8px",background:"rgba(64,168,96,0.08)",border:"1px solid rgba(64,168,96,0.2)",borderRadius:10,color:T.ok,fontSize:11,fontWeight:700}}>✅ Confirmé</Btn>
                      <Btn onClick={()=>approve(m.id,"friend")} style={{flex:1,padding:"8px",background:T.navyBg,border:`1px solid ${T.navy}44`,borderRadius:10,color:T.navy,fontSize:11,fontWeight:700}}>🔵 Ami</Btn>
                      <Btn onClick={()=>reject(m.id)} style={{padding:"8px 12px",background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:10,color:T.err,fontSize:11,fontWeight:700}}><Trash2 size={14}/></Btn>
                    </div>
                    :<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <Btn onClick={()=>chBadge(m.id,"confirmed")} style={{padding:"5px 11px",background:m.badge==="confirmed"?T.goldBg:"rgba(255,255,255,0.03)",border:`1px solid ${m.badge==="confirmed"?T.gold+"44":T.border}`,borderRadius:9,color:m.badge==="confirmed"?T.goldL:T.muted,fontSize:11,fontWeight:600}}>✅ Confirmé</Btn>
                      <Btn onClick={()=>chBadge(m.id,"friend")} style={{padding:"5px 11px",background:m.badge==="friend"?T.navyBg:"rgba(255,255,255,0.03)",border:`1px solid ${m.badge==="friend"?T.navy+"44":T.border}`,borderRadius:9,color:m.badge==="friend"?T.navy:T.muted,fontSize:11,fontWeight:600}}>🔵 Ami</Btn>
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

// ── MAIN APP ──────────────────────────────────────────────
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
  const [tab,setTab]=useState("home");
  const [openConvId,setOpenConvId]=useState(null);
  const [openUserId,setOpenUserId]=useState(null);
  const [openUser,setOpenUser]=useState(null);
  const [showNewPost,setShowNewPost]=useState(false);
  const [showAdmin,setShowAdmin]=useState(false);
  const [toast,setToast]=useState(null);
  const [postPage,setPostPage]=useState(1);
  const [hasMorePosts,setHasMorePosts]=useState(true);
  const [loadingMore,setLoadingMore]=useState(false);
  const [inAppNotifs,setInAppNotifs]=useState([]);
  const [viewImg,setViewImg]=useState(null);
  const prevMsgCount=useRef(0);

  const notify=useCallback(m=>{setToast(m);setTimeout(()=>setToast(null),2800);},[]);
  const addInAppNotif=useCallback((icon,title,body,action)=>{const id=Date.now()+Math.random();setInAppNotifs(p=>[...p,{id,icon,title,body,action}]);playNotifSound();sendPushNotif(title,body);setTimeout(()=>setInAppNotifs(p=>p.filter(n=>n.id!==id)),5000);},[]);
  const dismissNotif=useCallback(id=>setInAppNotifs(p=>p.filter(n=>n.id!==id)),[]);

  const loadMyProfile=useCallback(async uid=>{const{data}=await sb.from("profiles").select("*").eq("id",uid).single();if(data){setMyProfile(normProfile(data));setIsPending(data.status==="pending");}},[]);
  const loadConnections=useCallback(async uid=>{if(!uid)return;const[{data:following},{data:followers}]=await Promise.all([sb.from("connections").select("to_id").eq("from_id",uid),sb.from("connections").select("from_id").eq("to_id",uid)]);if(following)setMyConnections(following.map(d=>d.to_id));if(followers)setMyFollowers(followers.map(d=>d.from_id));},[]);

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

  const loadPosts=useCallback(async(page=1)=>{
    const from=(page-1)*PAGE_SIZE,to=from+PAGE_SIZE-1;
    const{data}=await sb.from("posts").select(`*,author:profiles(id,prenom,nom,badge,avatar_url,paroisse),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).order("created_at",{ascending:false}).range(from,to);
    if(data){
      const{data:conns}=await sb.from("connections").select("to_id").eq("from_id",session?.user?.id);
      const followedIds=new Set((conns||[]).map(c=>c.to_id));
      const mapped=data.map(p=>({id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,text:p.text||"",img:p.img_url||null,title:p.event_title||null,eventDate:p.event_date||null,eventLoc:p.event_loc||null,likes:(p.likes||[]).map(l=>l.user_id),comments:(p.comments||[]).map(c=>({id:c.id,by:c.author?.id,author:normProfile(c.author||{}),text:c.text,ts:new Date(c.created_at).getTime()})),saved:[],ts:new Date(p.created_at).getTime(),isFollowed:followedIds.has(p.author_id),pinned:p.pinned||false}));
      const sorted=[...mapped.filter(p=>p.pinned),...mapped.filter(p=>!p.pinned&&p.isFollowed),...mapped.filter(p=>!p.pinned&&!p.isFollowed)];
      if(page===1)setPosts(sorted);else setPosts(prev=>{const ids=new Set((prev||[]).map(p=>p.id));return[...(prev||[]),...sorted.filter(p=>!ids.has(p.id))];});
      setHasMorePosts(data.length===PAGE_SIZE);setPostPage(page);
    }
  },[session?.user?.id]);

  const loadMorePosts=useCallback(async()=>{if(loadingMore||!hasMorePosts)return;setLoadingMore(true);await loadPosts(postPage+1);setLoadingMore(false);},[loadingMore,hasMorePosts,postPage,loadPosts]);

  const refreshPost=useCallback(async pid=>{
    const{data}=await sb.from("posts").select(`*,author:profiles(id,prenom,nom,badge,avatar_url,paroisse),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).eq("id",pid).single();
    if(!data)return null;
    const updated={id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,title:data.event_title||null,eventDate:data.event_date||null,eventLoc:data.event_loc||null,likes:(data.likes||[]).map(l=>l.user_id),comments:(data.comments||[]).map(c=>({id:c.id,by:c.author?.id,author:normProfile(c.author||{}),text:c.text,ts:new Date(c.created_at).getTime()})),saved:[],ts:new Date(data.created_at).getTime()};
    setPosts(prev=>(prev||[]).map(p=>p.id===pid?updated:p));return updated;
  },[]);

  const loadConvs=useCallback(async myId=>{
    if(!myId)return;
    const{data}=await sb.from("conversations").select(`*,messages(id,sender_id,type,text,file_url,file_name,is_read,created_at)`).or(`user1_id.eq.${myId},user2_id.eq.${myId}`).order("created_at",{ascending:false});
    if(data){
      const mapped=data.map(c=>({id:c.id,uid:c.user1_id===myId?c.user2_id:c.user1_id,msgs:(c.messages||[]).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).map(m=>({id:m.id,f:m.sender_id===myId?"me":m.sender_id,type:m.type,text:m.text||"",img:m.file_url,fileName:m.file_name,read:m.is_read,ts:new Date(m.created_at).getTime()}))}));
      setConvs(mapped);return mapped;
    }return null;
  },[]);

  useEffect(()=>{
    if(session?.user&&myProfile&&!isPending){loadMembers();loadPosts(1);loadConvs(session.user.id);loadConnections(session.user.id);}
  },[session?.user?.id,myProfile?.id,isPending]);

  // Realtime
  useEffect(()=>{
    if(!session?.user)return;
    const myId=session.user.id;
    const ch=sb.channel("celeste_rt")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},async payload=>{
        const nm=payload.new;if(nm.sender_id===myId){loadConvs(myId);return;}
        const updated=await loadConvs(myId);
        if(updated){
          const totalNew=(updated||[]).reduce((a,c)=>a+(c.msgs||[]).filter(m=>m.f!=="me"&&!m.read).length,0);
          if(totalNew>prevMsgCount.current){const conv=(updated||[]).find(c=>(c.msgs||[]).some(m=>m.id===nm.id));const sender=(members||[]).find(m=>m.id===nm.sender_id);const preview=nm.type==="photo"?"📷 Photo":nm.type==="file"?"📎 Fichier":nm.text||"";addInAppNotif("✉",sender?.name||"Message",preview,()=>{setOpenConvId(conv?.id);setTab("messages");});}
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
    return()=>sb.removeChannel(ch);
  },[session?.user?.id,members]);

  const goTab=t=>{setTab(t);setOpenConvId(null);setOpenUserId(null);};
  const unread=(convs||[]).reduce((a,c)=>a+(c.msgs||[]).filter(m=>m.f!=="me"&&!m.read).length,0);
  const pending=(members||[]).filter(m=>m.status==="pending").length;
  const getM=id=>{if(id==="me"||id===session?.user?.id)return myProfile;return(members||[]).find(m=>m.id===id)||{id:"?",initials:"?",color:"#888",name:"Inconnu",badge:null};};
  const openConv=(convs||[]).find(c=>c.id===openConvId);
  const openChat=uid=>{setOpenUserId(null);let c=(convs||[]).find(x=>x.uid===uid);if(!c){c={id:"cv"+Date.now(),uid,msgs:[]};setConvs(p=>[...(p||[]),c]);}setOpenConvId(c.id);setTab("messages");};

  // Splash screen
  if(session===undefined) return(
    <div style={{minHeight:"100vh",background:"#000",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:0,position:"relative",overflow:"hidden"}}>
      <style>{GS}</style>
      <div style={{position:"absolute",top:"20%",left:"50%",transform:"translateX(-50%)",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(201,149,42,0.08),transparent 70%)",pointerEvents:"none",animation:"glowPulse 2s ease infinite"}}/>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:90,color:T.gold,animation:"starPulse 2s ease infinite",lineHeight:1,filter:"drop-shadow(0 0 40px rgba(201,149,42,0.6))"}}>✦</div>
      <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:52,fontWeight:300,color:T.text,letterSpacing:7,margin:"20px 0 8px",animation:"titleReveal .8s ease .3s both"}}>Céleste</h1>
      <p style={{color:T.muted,fontSize:11,letterSpacing:3,textTransform:"uppercase",animation:"titleReveal .8s ease .6s both"}}>Des rencontres ancrées dans la foi</p>
    </div>
  );

  if(!session) return(<><style>{GS}</style><AuthScreen mode={authMode} setMode={setAuthMode} onSuccess={state=>{if(state==="pending")setIsPending(true);}}/></>);

  if(isPending) return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{GS}</style>
      <div style={{maxWidth:400,width:"100%",textAlign:"center",animation:"fadeUp .5s ease"}}>
        <div style={{fontSize:60,marginBottom:20,animation:"float 3s ease infinite"}}>⏳</div>
        <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:300,color:T.text,marginBottom:12}}>Compte en attente</h2>
        <p style={{color:T.sub,fontSize:14,lineHeight:1.8,marginBottom:28}}>Bonjour <strong style={{color:T.goldL}}>{myProfile?.name}</strong> !<br/>Un administrateur vérifiera votre profil sous 24–48h.</p>
        <Btn onClick={()=>{if(window.confirm("Se déconnecter ?"))sb.auth.signOut();}} style={{padding:"13px 30px",background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:14,color:T.err,fontSize:14,fontWeight:600}}>Se déconnecter</Btn>
      </div>
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100svh",background:T.bg,color:T.text,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{GS}</style>
      {toast&&<Toast msg={toast}/>}
      {viewImg&&<ImageViewer url={viewImg} onClose={()=>setViewImg(null)}/>}
      <NotifBanner notifs={inAppNotifs} onDismiss={dismissNotif} onTap={n=>{n.action?.();dismissNotif(n.id);}}/>
      {showNewPost&&<NewPostModal myProfile={myProfile} session={session} onClose={()=>setShowNewPost(false)} onPost={()=>{loadPosts(1);setShowNewPost(false);notify("Publié ✦");}}/>}
      {showAdmin&&myProfile?.is_admin&&<AdminPanel onClose={()=>setShowAdmin(false)} notify={notify} reload={loadMembers} reloadPosts={()=>loadPosts(1)}/>}

      {/* Top bar */}
      <div style={{height:56,background:"rgba(0,0,0,0.95)",backdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",padding:"0 16px",gap:12,flexShrink:0,zIndex:30}}>
        {(openConvId||openUserId)
          ?<>
            <Btn onClick={()=>{setOpenConvId(null);setOpenUserId(null);}} style={{color:T.gold,padding:"0 8px 0 0",display:"flex",alignItems:"center"}}><ChevronLeft size={24}/></Btn>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:400,color:T.text}}>{openConvId?getM(openConv?.uid)?.name:openUser?.name}</span>
          </>
          :<>
            <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,color:T.gold,filter:"drop-shadow(0 0 10px rgba(201,149,42,0.5))",letterSpacing:2}}>✦</span>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:21,fontWeight:300,letterSpacing:4,color:T.text}}>Céleste</span>
            </div>
            {/* Notification bell */}
            <Btn onClick={()=>{notify("Notifications — Bientôt disponible 🔔");}} style={{position:"relative",width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:"50%",color:T.muted}}>
              <Bell size={18}/>
              {(inAppNotifs||[]).length>0&&<span style={{position:"absolute",top:6,right:6,width:8,height:8,borderRadius:"50%",background:T.err,boxShadow:"0 0 6px rgba(200,64,64,0.8)"}}/>}
            </Btn>
            {myProfile?.is_admin&&(
              <Btn onClick={()=>setShowAdmin(true)} style={{position:"relative",padding:"6px 12px",borderRadius:10,border:`1px solid ${pending>0?T.err+"55":T.border}`,background:pending>0?"rgba(200,64,64,0.06)":T.glass,color:pending>0?T.err:T.muted,fontSize:12,fontWeight:600}}>
                🛡{pending>0&&<span style={{background:T.err,color:"#fff",borderRadius:"50%",width:16,height:16,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,marginLeft:4}}>{pending}</span>}
              </Btn>
            )}
          </>
        }
      </div>

      {/* Main content */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
        {openUserId&&openUser&&(
          openUser.account_type==="organisation"
            ?<OrgView user={openUser} myProfile={myProfile} session={session} posts={posts} onBack={()=>setOpenUserId(null)} onChat={openChat} notify={notify} myConnections={myConnections} onConnectionChange={()=>loadConnections(session?.user?.id)} onImageView={setViewImg}/>
            :<UserView user={openUser} myProfile={myProfile} session={session} posts={posts} onBack={()=>setOpenUserId(null)} onChat={openChat} notify={notify} myConnections={myConnections} myFollowers={myFollowers} onConnectionChange={()=>loadConnections(session?.user?.id)} onImageView={setViewImg}/>
        )}
        {!openUserId&&openConvId&&openConv&&(
          <ChatScreen conv={openConv} myProfile={myProfile} session={session} members={members} reload={()=>loadConvs(session?.user?.id)} notify={notify} onImageView={setViewImg} onOpenProfile={uid=>{setOpenConvId(null);setOpenUserId(uid);}}/>
        )}
        {!openUserId&&!openConvId&&(
          <>
            {tab==="home"&&<HomeTab posts={posts} setPosts={setPosts} myProfile={myProfile} session={session} getM={getM} onNewPost={()=>setShowNewPost(true)} onUser={setOpenUserId} notify={notify} reload={()=>loadPosts(1)} loadMore={loadMorePosts} hasMore={hasMorePosts} loadingMore={loadingMore} refreshPost={refreshPost} onImageView={setViewImg}/>}
            {tab==="statuses"&&<StatusesTab myProfile={myProfile} session={session} members={members} myConnections={myConnections} myFollowers={myFollowers} notify={notify}/>}
            {tab==="discover"&&<DiscoverTab members={members} myProfile={myProfile} session={session} onUser={setOpenUserId} notify={notify} myConnections={myConnections} onConnectionChange={()=>loadConnections(session?.user?.id)}/>}
            {tab==="messages"&&<MsgsTab convs={convs} members={members} getM={getM} onOpen={id=>setOpenConvId(id)} onDeleteConv={async id=>{await sb.from("messages").delete().eq("conv_id",id);await sb.from("conversations").delete().eq("id",id);setConvs(p=>(p||[]).filter(c=>c.id!==id));}}/>}
            {tab==="profile"&&<ProfileTab myProfile={myProfile} session={session} posts={posts} onNewPost={()=>setShowNewPost(true)} notify={notify} onLogout={()=>sb.auth.signOut()} reload={()=>{loadPosts(1);loadMyProfile(session?.user?.id);}} myConnections={myConnections} myFollowers={myFollowers} onImageView={setViewImg}/>}
          </>
        )}
      </div>

      {/* Bottom nav premium */}
      {!openConvId&&!openUserId&&(
        <div style={{height:62,background:"rgba(0,0,0,0.98)",backdropFilter:"blur(30px)",borderTop:`1px solid ${T.border}`,display:"flex",flexShrink:0,zIndex:30,boxShadow:"0 -8px 30px rgba(0,0,0,0.5)"}}>
          {[
            {id:"home",ic:<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,lb:"Accueil"},
            {id:"statuses",ic:<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>,lb:"Statuts"},
            {id:"discover",ic:<span style={{fontSize:19,lineHeight:1}}>✦</span>,lb:"Découvrir"},
            {id:"messages",ic:<Mail size={21} strokeWidth={1.8}/>,lb:"Messages",badge:unread},
            {id:"profile",ic:<User size={21} strokeWidth={1.8}/>,lb:"Profil"},
          ].map(t=>(
            <Btn key={t.id} onClick={()=>goTab(t.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,color:tab===t.id?T.goldL:T.muted,position:"relative",transition:"color .25s"}}>
              <span style={{lineHeight:1,filter:tab===t.id?`drop-shadow(0 0 10px ${T.gold}99)`:"none",display:"flex",alignItems:"center",justifyContent:"center",transition:"filter .25s",transform:tab===t.id?"scale(1.1)":"scale(1)",transformOrigin:"center bottom",transition:"all .25s"}}>{t.ic}</span>
              <span style={{fontSize:9,fontWeight:tab===t.id?700:400,letterSpacing:.5,transition:"all .25s"}}>{t.lb}</span>
              {t.badge>0&&<span style={{position:"absolute",top:10,right:"calc(50% - 20px)",background:T.err,color:"#fff",borderRadius:10,minWidth:15,height:15,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900,padding:"0 3px",boxShadow:"0 2px 8px rgba(200,64,64,0.5)"}}>{t.badge}</span>}
              {tab===t.id&&<div style={{position:"absolute",bottom:0,width:20,height:2,borderRadius:2,background:T.gradGold,boxShadow:T.glowGold}}/>}
            </Btn>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App(){
  return(<ErrorBoundary><CelesteApp/></ErrorBoundary>);
}