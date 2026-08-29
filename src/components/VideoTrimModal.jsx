// src/components/VideoTrimModal.jsx
// Extrait de App.jsx pour être réutilisable ailleurs (ex : stickers animés).
// Comportement inchangé.
import { useState, useRef, useEffect } from "react";

export default function VideoTrimModal({videoSrc,onClose,onDone,maxDuration=600}){
  const videoRef=useRef();
  const [duration,setDuration]=useState(0);
  const [start,setStart]=useState(0);
  const [end,setEnd]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [currentTime,setCurrentTime]=useState(0);
  const [trimming,setTrimming]=useState(false);
  const [trimProgress,setTrimProgress]=useState(0);
  const MAX=maxDuration;
  const fmt=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;

  useEffect(()=>{
    const v=videoRef.current;if(!v)return;
    const onLoaded=()=>{const d=Math.min(v.duration,MAX);setDuration(v.duration);setEnd(d);};
    v.addEventListener("loadedmetadata",onLoaded);
    v.addEventListener("timeupdate",()=>setCurrentTime(v.currentTime));
    return()=>{v.removeEventListener("loadedmetadata",onLoaded);};
  },[]);

  useEffect(()=>{
    const v=videoRef.current;if(!v)return;
    if(currentTime>=end){v.pause();v.currentTime=start;setPlaying(false);}
  },[currentTime,end,start]);

  const togglePlay=()=>{
    const v=videoRef.current;
    if(playing){v.pause();setPlaying(false);}
    else{v.currentTime=start;v.play();setPlaying(true);}
  };

  const handleValidate=async()=>{
    if(trimming)return;
    if(start<0.5&&end>=duration-0.5){
      onDone({src:videoSrc,start:0,end:duration,file:null});
      return;
    }
    setTrimming(true);
    setTrimProgress(0);
    try{
      const v=videoRef.current;
      if(typeof v.captureStream!=="function"&&typeof v.mozCaptureStream!=="function"){
        onDone({src:videoSrc,start,end,file:null});
        setTrimming(false);
        return;
      }
      v.currentTime=start;
// Filet de sécurité : "seeked" ne se déclenche pas toujours (ex: currentTime
// déjà égal à start), ce qui bloquait handleValidate indéfiniment et empêchait
// toute preview/upload d'apparaître.
await Promise.race([
  new Promise(res=>v.addEventListener("seeked",res,{once:true})),
  new Promise(res=>setTimeout(res,600)),
]);
      const stream=v.captureStream?v.captureStream():v.mozCaptureStream();
      const chunks=[];
      const mimeType=MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")?"video/webm;codecs=vp8,opus":"video/webm";
      const recorder=new MediaRecorder(stream,{mimeType});
      recorder.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
      recorder.start(100);
      v.play();
      const trimDuration=(end-start)*1000;
      const startedAt=Date.now();
      const interval=setInterval(()=>{
        const elapsed=Date.now()-startedAt;
        setTrimProgress(Math.min(99,Math.round((elapsed/trimDuration)*100)));
      },100);
      await new Promise(res=>{
        setTimeout(()=>{
          clearInterval(interval);
          recorder.stop();
          v.pause();
          res();
        },trimDuration);
      });
      await new Promise(res=>recorder.addEventListener("stop",res,{once:true}));
      setTrimProgress(100);
      const blob=new Blob(chunks,{type:mimeType});
      const trimmedFile=new File([blob],"trimmed.webm",{type:"video/webm"});
      const trimmedSrc=URL.createObjectURL(blob);
      onDone({src:trimmedSrc,start:0,end:end-start,file:trimmedFile});
    }catch(e){
      console.error("Trim error:",e);
      onDone({src:videoSrc,start,end,file:null});
    }finally{
      setTrimming(false);
    }
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:1500,background:"#000",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"12px 20px",paddingTop:"calc(12px + env(safe-area-inset-top,0px))",background:"rgba(0,0,0,0.95)",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#fff",fontSize:15,fontWeight:500,cursor:"pointer",padding:"4px 0"}}>Annuler</button>
        <p style={{margin:0,fontSize:15,fontWeight:600,color:"#fff"}}>Couper la vidéo</p>
        <button onClick={handleValidate} disabled={trimming} style={{background:"none",border:"none",color:trimming?"rgba(201,149,42,0.4)":"#C9952A",fontSize:15,fontWeight:700,cursor:trimming?"default":"pointer",padding:"4px 0"}}>
          {trimming?`Traitement ${trimProgress}%`:"Valider ✦"}
        </button>
      </div>

      {trimming&&(
        <div style={{position:"absolute",inset:0,zIndex:10,background:"rgba(0,0,0,0.85)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
          <div style={{width:64,height:64,borderRadius:"50%",border:"3px solid rgba(201,149,42,0.2)",borderTopColor:"#C9952A",animation:"spin .8s linear infinite"}}/>
          <p style={{margin:0,color:"#C9952A",fontSize:16,fontWeight:700,letterSpacing:1}}>✦ Découpe en cours</p>
          <p style={{margin:"4px 0 0",color:"rgba(255,255,255,0.4)",fontSize:12}}>Ne ferme pas l'application</p>
          <div style={{width:200,height:4,background:"rgba(255,255,255,0.1)",borderRadius:2}}>
            <div style={{height:"100%",width:`${trimProgress}%`,background:"#C9952A",borderRadius:2,transition:"width 0.2s"}}/>
          </div>
          <p style={{margin:0,color:"rgba(255,255,255,0.4)",fontSize:12}}>{trimProgress}%</p>
        </div>
      )}

      <div style={{height:"45vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#000",position:"relative",flexShrink:0}}>
        <video ref={videoRef} src={videoSrc} playsInline style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>
        <button onClick={togglePlay} style={{position:"absolute",width:56,height:56,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"2px solid rgba(255,255,255,0.3)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff",fontSize:22}}>
          {playing?"⏸":"▶"}
        </button>
      </div>

      <div style={{background:"rgba(0,0,0,0.95)",padding:"20px 20px calc(20px + env(safe-area-inset-bottom,0px))",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Début : {fmt(start)}</span>
          <span style={{fontSize:12,color:"#C9952A",fontWeight:700}}>Durée : {fmt(end-start)}</span>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Fin : {fmt(end)}</span>
        </div>
        <p style={{margin:"0 0 8px",fontSize:11,color:"rgba(255,255,255,0.4)",letterSpacing:1}}>DÉBUT</p>
        <input type="range" min={0} max={duration} step={0.1} value={start}
          onChange={e=>{const v=Number(e.target.value);if(v<end-1){setStart(v);videoRef.current.currentTime=v;}}}
          style={{width:"100%",accentColor:"#C9952A",marginBottom:14}}/>
        <p style={{margin:"0 0 8px",fontSize:11,color:"rgba(255,255,255,0.4)",letterSpacing:1}}>FIN</p>
        <input type="range" min={0} max={Math.min(duration,MAX)} step={0.1} value={end}
          onChange={e=>{const v=Number(e.target.value);if(v>start+1){setEnd(v);videoRef.current.currentTime=v;}}}
          style={{width:"100%",accentColor:"#C9952A",marginBottom:12}}/>
        <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,0.25)",textAlign:"center"}}>Maximum {MAX} secondes</p>
      </div>
    </div>
  );
}