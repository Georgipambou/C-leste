const fs = require("fs");
const path = "src/App.jsx";
let c = fs.readFileSync(path, "utf8");
let ok = 0;

// 1. Déclaration Av : ajoute la map globale + logique clic statut
const old1 = `const Av = memo(function Av({u,size=40,online=false,ring=false,onClick}){
  return(
    <div onClick={onClick} style={{position:"relative",flexShrink:0,width:size,height:size,cursor:onClick?"pointer":"default"}}>
      {ring && (`;
const new1 = `let _unseenStatusMap=new Map();
const _statusListeners=new Set();
function _setUnseenStatusMap(m){_unseenStatusMap=m;_statusListeners.forEach(fn=>fn());}
const Av = memo(function Av({u,size=40,online=false,ring=false,onClick}){
  const [,_forceTick]=useState(0);
  useEffect(()=>{const fn=()=>_forceTick(t=>t+1);_statusListeners.add(fn);return()=>_statusListeners.delete(fn);},[]);
  const _statusId=u?.id?_unseenStatusMap.get(u.id):null;
  const showRing=ring||!!_statusId;
  const handleStatusCapture=e=>{
    if(_statusId){
      e.stopPropagation();
      window.__celesteSetTab&&window.__celesteSetTab("statuses");
      setTimeout(()=>window.dispatchEvent(new CustomEvent("celeste_open_status",{detail:{statusId:_statusId}})),350);
    }
  };
  return(
    <div onClick={onClick} onClickCapture={handleStatusCapture} style={{position:"relative",flexShrink:0,width:size,height:size,cursor:onClick?"pointer":"default"}}>
      {showRing && (`;
if (c.includes(old1)) { c = c.replace(old1, new1); ok++; } else { console.log("✗ 1/6 introuvable (déjà appliqué ?)"); }

// 2. Bordure de l'image avatar
const old2 = `style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",display:"block",border:\`1.5px solid \${ring?T.gold:T.border}\`,cursor:"pointer"}}`;
const new2 = `style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",display:"block",border:\`1.5px solid \${showRing?T.gold:T.border}\`,cursor:"pointer"}}`;
if (c.includes(old2)) { c = c.replace(old2, new2); ok++; } else { console.log("✗ 2/6 introuvable"); }

// 3. Bordure du fallback initiales
const old3 = `border:\`1.5px solid \${ring?T.gold:u?.color||"#888"}44\`,`;
const new3 = `border:\`1.5px solid \${showRing?T.gold:u?.color||"#888"}44\`,`;
if (c.includes(old3)) { c = c.replace(old3, new3); ok++; } else { console.log("✗ 3/6 introuvable"); }

// 4. boxShadow du fallback initiales
const old4 = `boxShadow:ring?\`0 0 12px \${u?.color||T.gold}44\`:"none"}}>`;
const new4 = `boxShadow:showRing?\`0 0 12px \${u?.color||T.gold}44\`:"none"}}>`;
if (c.includes(old4)) { c = c.replace(old4, new4); ok++; } else { console.log("✗ 4/6 introuvable"); }

// 5. Expose setTab globalement (CelesteApp)
const old5 = `const [tab,setTab]=useState("home");`;
const new5 = `const [tab,setTab]=useState("home");
  useEffect(()=>{window.__celesteSetTab=setTab;return()=>{delete window.__celesteSetTab;};},[]);`;
if (c.includes(old5) && !c.includes("window.__celesteSetTab=setTab")) { c = c.replace(old5, new5); ok++; } else if (c.includes("window.__celesteSetTab=setTab")) { console.log("= 5/6 déjà présent"); ok++; } else { console.log("✗ 5/6 introuvable"); }

// 6. Construction de la map utilisateur -> statut non vu, dans loadUnreadStatuses
const old6a = `if(!followedIds.length){setUnreadStatuses(0);return;}
      const{data:statuses}=await sb.from("statuses").select("id").in("user_id",followedIds).gte("created_at",since);
      if(!statuses?.length){setUnreadStatuses(0);return;}
      const statusIds=statuses.map(s=>s.id);
      const{data:views}=await sb.from("status_views").select("status_id").eq("viewer_id",session.user.id).in("status_id",statusIds);
      const viewedIds=new Set((views||[]).map(v=>v.status_id));
      setUnreadStatuses(statusIds.filter(id=>!viewedIds.has(id)).length);
    };`;
const new6a = `if(!followedIds.length){setUnreadStatuses(0);_setUnseenStatusMap(new Map());return;}
      const{data:statuses}=await sb.from("statuses").select("id,user_id").in("user_id",followedIds).gte("created_at",since);
      if(!statuses?.length){setUnreadStatuses(0);_setUnseenStatusMap(new Map());return;}
      const statusIds=statuses.map(s=>s.id);
      const{data:views}=await sb.from("status_views").select("status_id").eq("viewer_id",session.user.id).in("status_id",statusIds);
      const viewedIds=new Set((views||[]).map(v=>v.status_id));
      const unseen=statuses.filter(s=>!viewedIds.has(s.id));
      setUnreadStatuses(unseen.length);
      const byUser=new Map();
      unseen.forEach(s=>{if(!byUser.has(s.user_id))byUser.set(s.user_id,s.id);});
      _setUnseenStatusMap(byUser);
    };`;
if (c.includes(old6a)) { c = c.replace(old6a, new6a); ok++; } else { console.log("✗ 6/6 introuvable (vérifie loadUnreadStatuses)"); }

fs.writeFileSync(path, c, "utf8");
console.log(`${ok}/6 modifications appliquées.`);
