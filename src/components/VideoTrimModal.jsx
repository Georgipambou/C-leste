// VideoTrimModal — extrait depuis App.jsx
import React, { useState, useEffect, useRef } from "react";
import { X, Play, Pause } from "lucide-react";
import { useApp } from "../AppContext";

function VideoTrimModal({videoSrc,onClose,onDone,maxDuration=600}){
  const videoRef=useRef();
  const [duration,setDuration]=useState(0);
  const [start,setStart]=useState(0);
  const [end,setEnd]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [currentTime,setCurrentTime]=useState(0);
  const [trimming,setTrimming]=useState(false);
  const trimAbortRef=useRef(false);
  const [trimProgress,setTrimProgress]=useState(0);
  const ffmpegRef=useRef(null);
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
    // Si pas de trim significatif, on retourne le src tel quel
    if(start<0.5&&end>=duration-0.5){
      onDone({src:videoSrc,start:0,end:duration,file:null});
      return;
    }
    setTrimming(true);
    setTrimProgress(0);
    try{
      const {FFmpeg}=await import("@ffmpeg/ffmpeg");
      const {fetchFile,toBlobURL}=await import("@ffmpeg/util");
      if(!ffmpegRef.current){
        const ff=new FFmpeg();
        ff.on("progress",({progress})=>setTrimProgress(Math.round(progress*100)));
       await ff.load({
  coreURL:await toBlobURL(`${window.location.origin}/ffmpeg-core.js`,"text/javascript"),
  wasmURL:await toBlobURL(`${window.location.origin}/ffmpeg-core.wasm`,"application/wasm"),
});
        ffmpegRef.current=ff;
      }
      const ff=ffmpegRef.current;
      const inputData=await fetchFile(videoSrc);
      await ff.writeFile("input.mp4",inputData);
      await ff.exec([
        "-ss",String(start.toFixed(3)),
        "-to",String(end.toFixed(3)),
        "-i","input.mp4",
        "-c","copy",
        "-avoid_negative_ts","make_zero",
        "output.mp4"
      ]);
      const data=await ff.readFile("output.mp4");
      const blob=new Blob([data.buffer],{type:"video/mp4"});
      const trimmedFile=new File([blob],"trimmed.mp4",{type:"video/mp4"});
      const trimmedSrc=URL.createObjectURL(blob);
      onDone({src:trimmedSrc,start:0,end:end-start,file:trimmedFile});
    }catch(e){
      console.error("FFmpeg trim error:",e);
      // Fallback : on envoie l'original
      onDone({src:videoSrc,start,end,file:null});
    }finally{
      setTrimming(false);
    }
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:1100,background:"#000",display:"flex",flexDirection:"column"}}>
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
          <p style={{margin:0,color:"#fff",fontSize:15,fontWeight:600}}>Découpe en cours…</p>
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

export default VideoTrimModal;
