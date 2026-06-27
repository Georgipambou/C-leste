const fs = require("fs");

const PATH = "src/App.jsx";
let code = fs.readFileSync(PATH, "utf8");
// Normaliser CRLF -> LF pour les recherches
const crlf = code.includes("\r\n");
let c = code.replace(/\r\n/g, "\n");
let count = 0;

function replace(search, replacement, label) {
  if (!c.includes(search)) {
    console.log(`⚠️  Non trouvé: ${label}`);
    return;
  }
  c = c.replace(search, replacement);
  count++;
  console.log(`✅ ${label}`);
}

// 1. Statuts abonnés — dépendance myConnections
replace(
  `    return{me,groups};\n  },[session?.user?.id]);`,
  `    return{me,groups};\n  },[session?.user?.id,myConnections]);`,
  "Statuts abonnés — dépendance myConnections ajoutée"
);

// 2. Badge dans requête vues
replace(
  `const{data:profiles}=await sb.from("profiles").select("id,prenom,nom,avatar_url").in("id",ids);`,
  `const{data:profiles}=await sb.from("profiles").select("id,prenom,nom,avatar_url,badge").in("id",ids);`,
  "Vues statut — badge ajouté dans la requête"
);

// 3. Photo + badge dans panel des vues
replace(
  `              <div style={{width:36,height:36,borderRadius:"50%",background:T.goldBg2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:T.gold}}>{name[0]}</div>\n              <span style={{color:T.text,fontSize:13}}>{name}</span>\n              {currentLikes.includes(v.viewer_id)&&<Heart size={14} fill="currentColor" style={{color:T.gold,marginLeft:"auto"}}/>}`,
  `              <div style={{width:36,height:36,borderRadius:"50%",overflow:"hidden",background:T.goldBg2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:T.gold}}>
                {prf?.avatar_url?<img src={prf.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span>{name[0]}</span>}
              </div>
              <span style={{color:T.text,fontSize:13}}>{name}</span>
              {prf?.badge&&<span style={{fontSize:12,marginLeft:4}}>{prf.badge}</span>}
              {currentLikes.includes(v.viewer_id)&&<Heart size={14} fill="currentColor" style={{color:T.gold,marginLeft:"auto"}}/>}`,
  "Vues statut — photo de profil et badge affichés"
);

// 4. Nom auteur StatusViewer
replace(
  `<p style={{margin:0,fontSize:14,fontWeight:600,color:T.text}}>{author?.name}</p>`,
  `<p style={{margin:0,fontSize:14,fontWeight:600,color:T.text}}>{author?.prenom} {author?.nom?.[0]?author.nom[0]+".":""}</p>`,
  "StatusViewer — nom auteur corrigé"
);

// 5. VideoTrimModal — remplacer FFmpeg par MediaRecorder
replace(
  `  const handleValidate=async()=>{\n    if(trimming)return;\n    // Si pas de trim significatif, on retourne le src tel quel\n    if(start<0.5&&end>=duration-0.5){\n      onDone({src:videoSrc,start:0,end:duration,file:null});\n      return;\n    }\n    setTrimming(true);\n    setTrimProgress(0);\n    try{\n      const {FFmpeg}=await import("@ffmpeg/ffmpeg");\n      const {fetchFile,toBlobURL}=await import("@ffmpeg/util");\n      if(!ffmpegRef.current){\n        const ff=new FFmpeg();\n        ff.on("progress",({progress})=>setTrimProgress(Math.round(progress*100)));\n       await ff.load({\n  coreURL:await toBlobURL(\`\${window.location.origin}/ffmpeg-core.js\`,"text/javascript"),\n  wasmURL:await toBlobURL(\`\${window.location.origin}/ffmpeg-core.wasm\`,"application/wasm"),\n});\n        ffmpegRef.current=ff;\n      }\n      const ff=ffmpegRef.current;\n      const inputData=await fetchFile(videoSrc);\n      await ff.writeFile("input.mp4",inputData);\n      await ff.exec([\n        "-ss",String(start.toFixed(3)),\n        "-to",String(end.toFixed(3)),\n        "-i","input.mp4",\n        "-c","copy",\n        "-avoid_negative_ts","make_zero",\n        "output.mp4"\n      ]);\n      const data=await ff.readFile("output.mp4");\n      const blob=new Blob([data.buffer],{type:"video/mp4"});\n      const trimmedFile=new File([blob],"trimmed.mp4",{type:"video/mp4"});\n      const trimmedSrc=URL.createObjectURL(blob);\n      onDone({src:trimmedSrc,start:0,end:end-start,file:trimmedFile});\n    }catch(e){\n      console.error("FFmpeg trim error:",e);\n      // Fallback : on envoie l'original\n      onDone({src:videoSrc,start,end,file:null});\n    }finally{\n      setTrimming(false);\n    }\n  };`,
  `  const handleValidate=async()=>{\n    if(trimming)return;\n    if(start<0.5&&end>=duration-0.5){\n      onDone({src:videoSrc,start:0,end:duration,file:null});\n      return;\n    }\n    setTrimming(true);\n    setTrimProgress(0);\n    try{\n      const v=videoRef.current;\n      v.currentTime=start;\n      await new Promise(res=>v.addEventListener("seeked",res,{once:true}));\n      const stream=v.captureStream();\n      const chunks=[];\n      const mimeType=MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")?"video/webm;codecs=vp8,opus":"video/webm";\n      const recorder=new MediaRecorder(stream,{mimeType});\n      recorder.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};\n      recorder.start(100);\n      v.play();\n      const trimDuration=(end-start)*1000;\n      const startedAt=Date.now();\n      const interval=setInterval(()=>{\n        const elapsed=Date.now()-startedAt;\n        setTrimProgress(Math.min(99,Math.round((elapsed/trimDuration)*100)));\n      },100);\n      await new Promise(res=>{\n        setTimeout(()=>{\n          clearInterval(interval);\n          recorder.stop();\n          v.pause();\n          res();\n        },trimDuration);\n      });\n      await new Promise(res=>recorder.addEventListener("stop",res,{once:true}));\n      setTrimProgress(100);\n      const blob=new Blob(chunks,{type:mimeType});\n      const trimmedFile=new File([blob],"trimmed.webm",{type:"video/webm"});\n      const trimmedSrc=URL.createObjectURL(blob);\n      onDone({src:trimmedSrc,start:0,end:end-start,file:trimmedFile});\n    }catch(e){\n      console.error("Trim error:",e);\n      onDone({src:videoSrc,start,end,file:null});\n    }finally{\n      setTrimming(false);\n    }\n  };`,
  "VideoTrimModal — FFmpeg remplacé par MediaRecorder"
);

// 6. Supprimer refs inutiles
replace(
  `  const trimAbortRef=useRef(false);\n  const [trimProgress,setTrimProgress]=useState(0);\n  const ffmpegRef=useRef(null);`,
  `  const [trimProgress,setTrimProgress]=useState(0);`,
  "VideoTrimModal — refs FFmpeg supprimées"
);

// 7. Loader visuel amélioré
replace(
  `<p style={{margin:0,color:"#fff",fontSize:15,fontWeight:600}}>Découpe en cours…</p>`,
  `<p style={{margin:0,color:"#C9952A",fontSize:16,fontWeight:700,letterSpacing:1}}>✦ Découpe en cours</p>\n          <p style={{margin:"4px 0 0",color:"rgba(255,255,255,0.4)",fontSize:12}}>Ne ferme pas l'application</p>`,
  "VideoTrimModal — loader visuel amélioré"
);

// Remettre CRLF si le fichier original en avait
if (crlf) c = c.replace(/\n/g, "\r\n");
fs.writeFileSync(PATH, c, "utf8");
console.log(`\n${count}/7 modification(s) appliquée(s). Lance: npm run build`);
