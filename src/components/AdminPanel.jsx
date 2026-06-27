// AdminPanel — extrait depuis App.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Trash2, Mail, Search, User, Users, Check, X, Eye, EyeOff, Star, AlertTriangle, ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";
import { sb } from "../lib/supabase";
import { useApp } from "../AppContext";
import { getThemePalette } from "../App";

function AdminPanel({onClose,notify,reload,reloadPosts}){
const T=useApp()?.T||getThemePalette("default");
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
  const{error}=await sb.from("profiles").update({status:"active"}).eq("id",id);
  if(error){notify("Erreur : "+error.message);console.error(error);return;}
  setList(p=>p.map(m=>m.id===id?{...m,status:"active"}:m));
  await sb.from("notifications").insert({user_id:id,from_id:id,type:"approved",read:false});
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
  const{error}=await sb.from("profiles").update({badge}).eq("id",id);
  if(error){notify("Erreur : "+error.message);console.error(error);return;}
  setList(p=>p.map(m=>m.id===id?{...m,badge}:m));
  notify("Badge mis à jour ✦");
};
  const togglePin=async(pid,pinned)=>{
    const{error}=await sb.from("posts").update({pinned:!pinned}).eq("id",pid);
    if(error){notify("Erreur : "+error.message);console.error(error);return;}
    setAllPosts(p=>p.map(x=>x.id===pid?{...x,pinned:!pinned}:x));
    reloadPosts?.();notify(pinned?"Désépinglé":"Épinglé ✦");
  };

  const allMembers=(list||[]).filter(m=>m.status!=="pending");
  const pending=(list||[]).filter(m=>m.status==="pending");
  const suspended=(list||[]).filter(m=>m.status==="suspended");
  const displayList=filter==="pending"?pending:filter==="suspended"?suspended:filter==="reports"?[]:(list||[]).filter(m=>m.id);

  return(
    <div style={{position:"fixed",inset:0,zIndex:900,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
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
         <Btn onClick={async()=>{
            if(!window.confirm("Distribuer le pool de ce mois à tous les membres ?"))return;
            const month=new Date().toISOString().slice(0,7);
            // Récupérer tous les likes valides du mois
            const{data:likes}=await sb.from("valid_likes").select("author_id").eq("month",month);
            if(!likes||likes.length===0){notify("Aucun like valide ce mois");return;}
            // Récupérer le pool
            const{data:pool}=await sb.from("badge_pool").select("*").eq("month",month).maybeSingle();
            
            if(!pool||pool.distributed){notify("Pool inexistant ou déjà distribué");return;}
           // Compter les likes par auteur
            const likeCounts={};
            likes.forEach(l=>{likeCounts[l.author_id]=(likeCounts[l.author_id]||0)+1;});

            // Compter les posts actifs du mois (publiés dans le mois)
            const{data:monthPosts}=await sb.from("posts").select("author_id,created_at").gte("created_at",`${month}-01`);
            const postCounts={};
            (monthPosts||[]).forEach(p=>{postCounts[p.author_id]=(postCounts[p.author_id]||0)+1;});

            // Calculer le score = likes × posts
            const scores={};
            const allUserIds=new Set([...Object.keys(likeCounts),...Object.keys(postCounts)]);
            allUserIds.forEach(uid=>{
              const l=likeCounts[uid]||0;
              const p=postCounts[uid]||0;
              if(l>0&&p>0)scores[uid]=l*p;
            });

            const totalScore=Object.values(scores).reduce((a,b)=>a+b,0);
            // Distribuer
            for(const[userId,score] of Object.entries(scores)){
              const share=Math.floor((score/totalScore)*pool.pool_amount);
              if(share<=0)continue;
              // Créer ou mettre à jour le wallet
              const{data:w}=await sb.from("wallets").select("*").eq("user_id",userId).maybeSingle();
              if(w){
                await sb.from("wallets").update({balance:w.balance+share,total_earned:w.total_earned+share,updated_at:new Date().toISOString()}).eq("user_id",userId);
              }else{
                await sb.from("wallets").insert({user_id:userId,balance:share,total_earned:share});
              }
              // Transaction
              await sb.from("wallet_transactions").insert({user_id:userId,type:"earning",amount:share,description:`Gains likes — ${month}`,month,status:"completed"});
              // Notification
              await sb.from("notifications").insert({user_id:userId,from_id:userId,type:"earning",text:`✦ Tu as reçu ${share.toLocaleString("fr-FR")} F CFA pour tes likes du mois de ${month}`,read:false});
            }
            // Marquer comme distribué
            await sb.from("badge_pool").update({distributed:true}).eq("month",month);
            notify(`✦ Distribution effectuée — ${Object.keys(scores).length} membres récompensés`);
          }} style={{width:"100%",padding:"11px",background:"rgba(61,184,116,0.08)",border:"1px solid rgba(61,184,116,0.3)",borderRadius:12,color:"#4ade80",fontSize:13,fontWeight:600}}>
            💰 Distribuer le pool du mois
          </Btn>

          {/* Retraits en attente */}
          <WithdrawalRequests notify={notify}/>
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
