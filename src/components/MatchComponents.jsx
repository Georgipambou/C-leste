// MatchComponents — extrait depuis App.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Heart, Star, MapPin, Users, Search } from "lucide-react";
import { sb } from "../lib/supabase";
import { useApp } from "../AppContext";
import { getThemePalette } from "../App";

function computeMatchScore(a,b){
const T=useApp()?.T||getThemePalette("default");
  if(!a||!b)return 0;
  // Éliminatoires absolus
  const genderOk=a.seeking_gender==="peu_importe"||b.seeking_gender==="peu_importe"||(a.seeking_gender===b.gender&&b.seeking_gender===a.gender);
  if(!genderOk)return 0;
  const typeOk=(a.seeking_type==="les_deux"||b.seeking_type==="les_deux")||(a.seeking_type===b.seeking_type);
  if(!typeOk)return 0;
  const bAge=b.age||null;
  const ageOk=!bAge||!a.seeking_age_min||!a.seeking_age_max||(bAge>=a.seeking_age_min&&bAge<=a.seeking_age_max);
  if(!ageOk)return 0;
  // Pénalités critiques -50%
  let penalty=0;
  // Mariage : l'un veut, l'autre dit non
  if((a.marriage_vision==="oui"&&b.marriage_vision==="non")||(a.marriage_vision==="non"&&b.marriage_vision==="oui"))penalty+=50;
  // Intimité : l'un dit attente, l'autre dit central
  if((a.intimacy==="attente"&&b.intimacy==="central")||(a.intimacy==="central"&&b.intimacy==="attente"))penalty+=50;
  // Argent : l'un dit essentiel, l'autre dit secondaire ou peu_importe
  if((a.money_vision==="essentiel"&&(b.money_vision==="secondaire"||b.money_vision==="peu_importe"))||(b.money_vision==="essentiel"&&(a.money_vision==="secondaire"||a.money_vision==="peu_importe")))penalty+=50;
  // Couleur de peau : préférence incompatible = -50%
  if(a.seeking_skin_color&&a.seeking_skin_color!=="peu_importe"&&b.skin_color&&a.seeking_skin_color!==b.skin_color)penalty+=50;
  if(b.seeking_skin_color&&b.seeking_skin_color!=="peu_importe"&&a.skin_color&&b.seeking_skin_color!==a.skin_color)penalty+=50;
  // Distance : les deux veulent sur place mais positions trop éloignées
  if(a.distance_ok==="sur_place"&&b.distance_ok==="sur_place"&&a.latitude&&b.latitude){
    const dx=a.latitude-b.latitude,dy=a.longitude-b.longitude;
    const km=Math.sqrt(dx*dx+dy*dy)*111;
    if(km>25)penalty+=50;
  }
  let score=0,maxScore=0;
  if(penalty>=100)return 0;
  for(const key of Object.keys(Q_WEIGHT)){
    const w=Q_WEIGHT[key];
    maxScore+=w;
    if(!a[key]||!b[key])continue;
    if(SIMILAR_KEYS.includes(key)){
      if(a[key]===b[key])score+=w;
      else score+=Math.round(w*0.2);
    } else if(COMPLEMENT_KEYS.includes(key)){
      const ideal=COMPLEMENT_PAIRS[key]?.[a[key]];
      if(ideal===b[key])score+=w;
      else if(a[key]===b[key])score+=Math.round(w*0.4);
      else score+=Math.round(w*0.2);
    } else {
      if(a[key]===b[key])score+=w;
    }
  }
  const raw=maxScore>0?Math.round((score/maxScore)*100):0;
  return Math.max(0,raw-penalty);
}

function MatchOnboardingModal({myProfile,session,onClose,onDone,notify,initialData=null}){
const T=useApp()?.T||getThemePalette("default");
  const [step,setStep]=useState(0);
  const ageReverseMap={[JSON.stringify([16,20])]:"16-20",[JSON.stringify([20,25])]:"20-25",[JSON.stringify([25,30])]:"25-30",[JSON.stringify([30,99])]:"30+"};
  const initialAnswers=initialData?{...initialData,seeking_age:ageReverseMap[JSON.stringify([initialData.seeking_age_min,initialData.seeking_age_max])]||undefined}:{};
  const [answers,setAnswers]=useState(initialAnswers);
  const [saving,setSaving]=useState(false);
  const total=MATCH_QUESTIONS.length;
  const q=MATCH_QUESTIONS[step];
  const progress=((step)/total)*100;
  const isEdit=!!initialData;

  const select=async v=>{
    const next={...answers,[q.id]:v};
    setAnswers(next);
    if(step<total-1){
      setTimeout(()=>setStep(s=>s+1),280);
    } else {
      setSaving(true);
      const ageMap={"16-20":[16,20],"20-25":[20,25],"25-30":[25,30],"30+":[30,99]};
      const [ageMin,ageMax]=ageMap[next.seeking_age]||[16,30];
      const{seeking_age:_,...rest}=next;
      let lat=myProfile?.latitude||null,lng=myProfile?.longitude||null;
if(next.distance_ok==="sur_place"&&!lat){
  try{const pos=await Geolocation.getCurrentPosition({enableHighAccuracy:false,timeout:8000});lat=pos.coords.latitude;lng=pos.coords.longitude;await sb.from("profiles").update({latitude:lat,longitude:lng}).eq("id",session?.user?.id);}
  catch(e){notify("GPS non disponible — tu verras tout le monde");}
}
const payload={user_id:session?.user?.id,...rest,seeking_age_min:ageMin,seeking_age_max:ageMax,is_active:true,updated_at:new Date().toISOString(),age:myProfile?.age||null,latitude:lat,longitude:lng};
      const{error}=await sb.from("match_profiles").upsert (payload,{onConflict:"user_id"}); 
      setSaving(false); 
      if(!error){notify("✦ Profil Céleste Match enregistré !");onDone(next);}
      else notify("Erreur — réessaie"); 
    }
  };

  const chosen=answers[q.id];

  return(
    <div style={{position:"fixed",inset:0,zIndex:1200,background:T.bg,display:"flex",flexDirection:"column",fontFamily:"'DM Sans',sans-serif"}}>
      {/* Header barre progression */}
      <div style={{padding:"calc(env(safe-area-inset-top,0px) + 16px) 20px 0",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          {step>0&&<Btn onClick={()=>setStep(s=>s-1)} style={{color:T.muted,display:"flex"}}><ChevronLeft size={22}/></Btn>}
          <div style={{flex:1,height:3,background:"rgba(255,255,255,0.08)",borderRadius:2}}>
            <div style={{height:"100%",width:`${progress}%`,background:T.gradGold,borderRadius:2,transition:"width .4s ease"}}/>
          </div>
          <span style={{fontSize:11,color:T.muted,minWidth:32,textAlign:"right"}}>{step+1}/{total}</span>
          <Btn onClick={onClose} style={{color:T.muted,display:"flex",marginLeft:4}}><X size={20}/></Btn>
        </div>
      </div>

      {/* Corps */}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",padding:"0 24px 40px"}}>
        {/* Emoji + Question */}
        <div style={{textAlign:"center",padding:"32px 0 28px",animation:"fadeUp .3s ease"}}>
          <div style={{fontSize:52,marginBottom:16,filter:`drop-shadow(0 0 20px ${T.gold}55)`}}>{q.emoji}</div>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:400,color:T.text,margin:0,lineHeight:1.4}}>{q.label}</h2>
          {!isEdit&&step===0&&(
            <p style={{fontSize:13,color:T.muted,marginTop:10,lineHeight:1.7}}>
              Réponds honnêtement — plus tu es authentique, plus les suggestions seront justes ✦
            </p>
          )}
        </div>

        {/* Options */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {q.options.map((opt,i)=>{
            const selected=chosen===opt.v;
            return(
              <button key={opt.v} onClick={()=>select(opt.v)}
                style={{
                  width:"100%",padding:"16px 20px",
                  background:selected?T.goldBg2:"rgba(255,255,255,0.04)",
                  border:`1.5px solid ${selected?T.gold:"rgba(255,255,255,0.08)"}`,
                  borderRadius:18,color:selected?T.goldL:T.text,
                  fontSize:15,fontWeight:selected?700:400,
                  cursor:"pointer",textAlign:"left",
                  display:"flex",alignItems:"center",gap:14,
                  transition:"all .2s",
                  animation:`fadeUp .3s ease ${i*0.06}s both`,
                  boxShadow:selected?`0 0 0 1px ${T.gold}44, 0 8px 24px rgba(201,149,42,0.15)`:"none",
                  transform:selected?"scale(1.02)":"scale(1)",
                }}>
                <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${selected?T.gold:"rgba(255,255,255,0.15)"}`,background:selected?T.gold:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s"}}>
                  {selected&&<div style={{width:8,height:8,borderRadius:"50%",background:"#000"}}/>}
                </div>
                <span>{opt.l}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loader sauvegarde */}
      {saving&&(
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,zIndex:10}}>
          <div style={{width:48,height:48,borderRadius:"50%",border:`3px solid ${T.goldBg2}`,borderTopColor:T.gold,animation:"spin .8s linear infinite"}}/>
          <p style={{color:T.goldL,fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Enregistrement ✦</p>
        </div>
      )}
    </div>
  );
}

function getCompatibilityPoints(a,b,score){
const T=useApp()?.T||getThemePalette("default");
  const points=[];
  const labels={
    faith:{centrale:"Foi centrale",importante:"Foi importante",secondaire:"Foi secondaire",aucune:"Sans religion"},
    marriage_vision:{oui:"Veut se marier",peut_etre:"Ouvert au mariage",non:"Pas de mariage"},
    children:{en_veux:"Veut des enfants",deja:"A déjà des enfants",pas_sur:"Incertain sur les enfants",non:"Pas d'enfants"},
    life_vision:{stabilite:"Cherche la stabilité",voyages:"Aime voyager",carriere:"Axé carrière",incertain:"Ouvert à tout"},
    intimacy:{central:"Intimité prioritaire",important:"Intimité importante",secondaire:"Intimité secondaire",attente:"Préfère attendre"},
    seeking_type:{amour:"Cherche l'amour",amitie:"Cherche l'amitié",les_deux:"Ouvert à tout"},
    conflict_style:{parle:"Communication directe",digere:"Prend du recul",reagis:"Réactif mais passe vite"},
    expression_level:{expressif:"Très expressif",reserve:"Réservé",milieu:"Équilibré"},
    life_rhythm:{calme:"Rythme calme",social:"Vie sociale active",melange:"Rythme varié"},
    family_vs_freedom:{famille:"Famille avant tout",liberte:"Liberté individuelle",equilibre:"Équilibre famille/liberté"},
    app_expectation:{serieux:"Cherche du sérieux",amis:"Cherche des amis",decouverte:"Ouvert à la découverte",verra:"Verra ce qui arrive"},
  };
  const complementPairs=COMPLEMENT_PAIRS;
  for(const key of Object.keys(Q_WEIGHT)){
    if(!a[key]||!b[key])continue;
    let match=false;
    if(SIMILAR_KEYS.includes(key)&&a[key]===b[key])match=true;
    if(COMPLEMENT_KEYS.includes(key)&&complementPairs[key]?.[a[key]]===b[key])match=true;
    if(match&&labels[key]?.[a[key]]){
      points.push({emoji:key==="faith"?"🙏":key==="marriage_vision"?"💍":key==="children"?"👶":key==="life_vision"?"🌅":key==="intimacy"?"🔥":key==="seeking_type"?"✨":key==="conflict_style"?"🌊":key==="expression_level"?"🎭":key==="life_rhythm"?"🌙":key==="family_vs_freedom"?"⚖️":"💎",label:labels[key][a[key]]});
    }
  }
  const maxPoints=score>=100?points.length:score>=90?5:score>=80?4:score>=65?3:2;
  return points.slice(0,maxPoints);
}

function MatchWriteBtn({u,score,onChat,notify,onWriteOpen}){
const T=useApp()?.T||getThemePalette("default");
  const [open,setOpen]=useState(false);
  const [msg,setMsg]=useState(`Salut ${u.name?.split(" ")[0]} ✦ Céleste nous affiche à ${score}% de compatibilité — j'aimerais qu'on discute, si tu es partant·e !`);
  const [sending,setSending]=useState(false);
  if(!open) return(
    <button onClick={()=>{setOpen(true);onWriteOpen?.(true);}} style={{flexShrink:0,padding:"8px 14px",background:T.gradGold,border:"none",borderRadius:12,color:"#000",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",boxShadow:"0 3px 12px rgba(201,149,42,0.3)"}}>
      Écrire ✦
    </button>
  );
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:99999,background:T.bg,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"14px 16px",paddingTop:"calc(60px + env(safe-area-inset-top,0px))",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        <Btn onClick={()=>{setOpen(false);onWriteOpen?.(false);}} style={{color:T.text,display:"flex",alignItems:"center",gap:6}}>
          <ChevronLeft size={22}/><span style={{fontSize:15,fontWeight:600}}>Retour</span>
        </Btn>
        <div style={{flex:1}}>
          <p style={{margin:0,fontSize:14,fontWeight:700,color:T.text}}>{u.name}</p>
          <p style={{margin:0,fontSize:11,color:T.goldL}}>Compatibilité {score}% ✦</p>
        </div>
        <Av u={u} size={34}/>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",padding:"20px 16px",gap:12}}>
        <textarea value={msg} onChange={e=>setMsg(e.target.value)}
          rows={6}
          style={{width:"100%",background:"rgba(255,255,255,0.05)",border:`1px solid ${T.border}`,borderRadius:14,padding:"12px",color:T.text,fontSize:14,lineHeight:1.6,resize:"none",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
        <button disabled={sending||!msg.trim()} onClick={async()=>{
          setSending(true);
          try{
            await onChat(u.id,msg.trim());
            notify(`Message envoyé à ${u.name?.split(" ")[0]} ✦`);
            setOpen(false);onWriteOpen?.(false);
          }catch(e){
            notify("Erreur — réessaie");
            setSending(false);
          }
        }} style={{width:"100%",padding:"14px",background:sending?"rgba(201,149,42,0.4)":T.gradGold,border:"none",borderRadius:14,color:"#000",fontSize:14,fontWeight:700,cursor:sending?"default":"pointer"}}>
          {sending?"Envoi…":"Envoyer ✦"}
        </button>
      </div>
    </div>
  );
}

function MatchSuggestions({myProfile,session,members,onUser,onChat,notify,onWriteOpen}){
const T=useApp()?.T||getThemePalette("default");
  const [matchProfile,setMatchProfile]=useState(null);
  const [suggestions,setSuggestions]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showOnboarding,setShowOnboarding]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const [autoPopup,setAutoPopup]=useState(false);

  useEffect(()=>{
    if(!session?.user?.id)return;
    (async()=>{
      setLoading(true);
      const{data}=await sb.from("match_profiles").select("*").eq("user_id",session.user.id).maybeSingle();
      setMatchProfile(data);
      if(!data||!data.is_active){
        const shown=localStorage.getItem("celeste_match_popup_shown");
        if(!shown&&!data){localStorage.setItem("celeste_match_popup_shown","1");setAutoPopup(true);}
      }
      if(data?.is_active&&members?.length>0){
        // Charger les profils des autres membres
        const otherIds=members.filter(m=>m.id!==session.user.id).map(m=>m.id);
        const{data:otherProfiles}=await sb.from("match_profiles").select("*").in("user_id",otherIds).eq("is_active",true);
        if(otherProfiles){
          const scored=(otherProfiles||[]).map(op=>{
            const score=computeMatchScore(data,op);
            const member=members.find(m=>m.id===op.user_id);
            return{...op,score,member};
          }).filter(s=>s.score>=50&&s.member).sort((a,b)=>b.score-a.score).slice(0,20);
          setSuggestions(scored);
        }
      }
      setLoading(false);
    })();
  },[session?.user?.id,members?.length]);

  useEffect(()=>{
    if(!session?.user?.id)return;
    const sub=sb.channel("match_realtime").on("postgres_changes",{event:"*",schema:"public",table:"match_profiles"},()=>{
      sb.from("match_profiles").select("*").eq("user_id",session.user.id).maybeSingle().then(({data:myData})=>{
        if(!myData?.is_active||!members?.length)return;
        const otherIds=members.filter(m=>m.id!==session.user.id).map(m=>m.id);
        sb.from("match_profiles").select("*").in("user_id",otherIds).eq("is_active",true).then(({data:others})=>{
          if(!others)return;
          const scored=others.map(op=>{const score=computeMatchScore(myData,op);const member=members.find(m=>m.id===op.user_id);return{...op,score,member};}).filter(s=>s.score>=50&&s.member).sort((a,b)=>b.score-a.score).slice(0,20);
          setSuggestions(scored);
        });
      });
    }).subscribe();
    return()=>sb.removeChannel(sub);
  },[session?.user?.id,members?.length]);

  const scoreColor=s=>s>=80?T.ok:s>=65?T.goldL:T.gold;
  const scoreLabel=s=>s>=90?"Connexion rare ✦":s>=80?"Très compatible":s>=65?"Bonne affinité":s>=50?"Affinité modérée":"";

  if(loading)return(
    <div style={{padding:"20px 16px 8px"}}>
      <div style={{height:160,background:"rgba(255,255,255,0.03)",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{width:24,height:24,borderRadius:"50%",border:`2px solid ${T.border}`,borderTopColor:T.gold,animation:"spin .7s linear infinite"}}/>
      </div>
    </div>
  );

  // Pas encore de profil match
  if(!matchProfile||!matchProfile.is_active) return(
    <div style={{padding:"16px 16px 8px"}}>
      <div style={{background:`linear-gradient(135deg,${T.goldBg} 0%,rgba(201,149,42,0.04) 100%)`,border:`1px solid ${T.gold}33`,borderRadius:22,padding:"22px 20px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-20,right:-20,fontSize:80,opacity:.06}}>✦</div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <span style={{fontSize:24}}>💫</span>
          <h3 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:400,color:T.text}}>Céleste Match</h3>
          <span style={{fontSize:10,color:T.goldL,fontWeight:700,background:T.goldBg2,padding:"2px 8px",borderRadius:20,border:`1px solid ${T.gold}33`}}>NOUVEAU</span>
        </div>
        <p style={{margin:"0 0 16px",fontSize:13,color:T.sub,lineHeight:1.7}}>
          Découvre des personnes qui te ressemblent vraiment — pas au hasard, mais selon tes valeurs, ta vision de la vie et ta façon d'être.
        </p>
        <button onClick={()=>setShowOnboarding(true)}
          style={{width:"100%",padding:"14px",background:T.gradGold,borderRadius:14,border:"none",color:"#000",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 20px rgba(201,149,42,0.35)",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span>✦</span> {matchProfile?"Réactiver Céleste Match":"Créer mon profil Match"}
        </button>
      </div>
      {(showOnboarding||autoPopup)&&<MatchOnboardingModal myProfile={myProfile} session={session} notify={notify}
        onClose={()=>{setShowOnboarding(false);setAutoPopup(false);}}
        onDone={data=>{setMatchProfile({...data,is_active:true});setShowOnboarding(false);setAutoPopup(false);}}/>}
    </div>
  );

  // Pas de suggestions
  if(suggestions.length===0) return(
    <div style={{padding:"16px 16px 8px"}}>
      <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:22,padding:"20px",textAlign:"center"}}>
        <span style={{fontSize:36,display:"block",marginBottom:8}}>💫</span>
        <p style={{margin:"0 0 4px",fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:T.text}}>Céleste Match</p>
        <p style={{margin:"0 0 12px",fontSize:12,color:T.muted}}>Pas encore de suggestions — la communauté grandit ✦</p>
        <button onClick={()=>setShowOnboarding(true)} style={{fontSize:12,color:T.goldL,background:"none",border:`1px solid ${T.gold}33`,borderRadius:10,padding:"6px 14px",cursor:"pointer"}}>
          Modifier mon profil
        </button>
      </div>
      {showOnboarding&&<MatchOnboardingModal myProfile={myProfile} session={session} notify={notify} initialData={matchProfile}
        onClose={()=>setShowOnboarding(false)} onDone={data=>{setMatchProfile({...data,is_active:true});setShowOnboarding(false);}}/>}
    </div>
  );

  const visible=suggestions;

  return(
    <div style={{padding:"16px 16px 4px"}}>
      {/* Titre section */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>💫</span>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:T.text,fontWeight:400}}>Céleste Match</span>
          <span style={{fontSize:10,color:T.goldL,fontWeight:700,background:T.goldBg2,padding:"2px 8px",borderRadius:20,border:`1px solid ${T.gold}33`}}>{suggestions.length}</span>
        </div>
        <button onClick={()=>setShowOnboarding(true)} style={{fontSize:11,color:T.muted,background:"none",border:"none",cursor:"pointer",padding:"4px 8px"}}>
          Modifier ✏️
        </button>
      </div>

      {/* Cartes scroll horizontal */}
      <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8,scrollSnapType:"x mandatory",WebkitOverflowScrolling:"touch",msOverflowStyle:"none",scrollbarWidth:"none"}}>
        {visible.map((s,i)=>{
          const u=s.member;
          const col=scoreColor(s.score);
          return(
            <div key={u.id} style={{background:s.score===100?"rgba(201,149,42,0.06)":"rgba(255,255,255,0.03)",border:`1.5px solid ${s.score===100?T.gold:T.border}`,borderRadius:20,overflow:"hidden",boxShadow:s.score===100?"0 0 24px rgba(201,149,42,0.2)":"none",flexShrink:0,width:260,scrollSnapAlign:"start"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 14px 10px"}}>
                {/* Avatar */}
                <div style={{position:"relative",flexShrink:0}} onClick={()=>onUser(u.id)}>
                  <Av u={u} size={54} ring/>
                  {u.isOnline&&<div style={{position:"absolute",bottom:1,right:1,width:11,height:11,borderRadius:"50%",background:T.ok,border:"2px solid "+T.bg,boxShadow:"0 0 6px rgba(34,197,94,0.6)"}}/>}
                </div>
                {/* Infos */}
                <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>onUser(u.id)}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={{fontSize:14,fontWeight:700,color:T.text}}>{u.name}</span>
                    <Badge type={u.badge}/>
                  </div>
                  <span style={{fontSize:11,color:T.muted}}><MapPin size={10} style={{display:"inline",marginRight:3}}/>{u.paroisse||"Congo"}</span>
                </div>
                {/* Score */}
                <div style={{flexShrink:0,textAlign:"center"}}>
                  <div style={{width:52,height:52,borderRadius:"50%",border:`2.5px solid ${col}`,display:"flex",alignItems:"center",justifyContent:"center",background:`${col}11`,position:"relative"}}>
                    <span style={{fontSize:15,fontWeight:900,color:col}}>{s.score}%</span>
                  </div>
                  <span style={{fontSize:9,color:col,fontWeight:600,display:"block",marginTop:3}}>{scoreLabel(s.score)}</span>
                </div>
              </div>
              {/* Points de compatibilité */}
              {(()=>{
                const pts=getCompatibilityPoints(matchProfile,s,s.score);
                return pts.length>0&&(
                  <div style={{padding:"0 14px 10px",display:"flex",flexWrap:"wrap",gap:6}}>
                    {s.score===100&&<div style={{width:"100%",marginBottom:4,fontSize:11,color:T.goldL,fontWeight:700,fontStyle:"italic"}}>✦ Connexion parfaite — cela n'arrive presque jamais</div>}
                    {pts.map((pt,pi)=>(
                      <span key={pi} style={{fontSize:11,padding:"4px 10px",borderRadius:20,background:"rgba(201,149,42,0.1)",border:`1px solid ${T.gold}33`,color:T.goldL,display:"flex",alignItems:"center",gap:4}}>
                        {pt.emoji} {pt.label}
                      </span>
                    ))}
                  </div>
                );
              })()}
              {/* Message pré-rédigé */}
              <div style={{borderTop:`1px solid ${T.border}`,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:T.muted,flex:1,fontStyle:"italic",lineHeight:1.5}}>
                  "{u.name?.split(" ")[0]} et moi, {s.score}% — ça mérite qu'on discute ✦"
                </span>
                <MatchWriteBtn u={u} score={s.score} onChat={onChat} notify={notify} onWriteOpen={onWriteOpen}/>
              </div>
            </div>
          );
        })}
      </div>

      

      {showOnboarding&&<MatchOnboardingModal myProfile={myProfile} session={session} notify={notify} initialData={matchProfile}
        onClose={()=>setShowOnboarding(false)} onDone={data=>{setMatchProfile({...data,is_active:true});setShowOnboarding(false);}}/>}
    </div>
  );
}

export { computeMatchScore, MatchOnboardingModal, getCompatibilityPoints, MatchWriteBtn, MatchSuggestions };
