const fs = require('fs');

const filePath = process.argv[2];
if (!filePath) { console.error('Usage: node fix-share-intent.cjs src/App.jsx'); process.exit(1); }

let code = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// 1. Import SendIntent
if (!code.includes("from 'send-intent'")) {
  code = code.replace(
    `import { App as CapApp } from '@capacitor/app';`,
    `import { App as CapApp } from '@capacitor/app';\nimport { SendIntent } from 'send-intent';`
  );
  changes++; console.log('✅ Import SendIntent ajouté');
} else console.log('⏭️  Import déjà présent');

// 2. useState sharedMedia
if (!code.includes('sharedMedia,setSharedMedia')) {
  code = code.replace(
    `const viewedPostIdsRef=useRef(new Set());`,
    `const viewedPostIdsRef=useRef(new Set());\nconst [sharedMedia,setSharedMedia]=useState(null);`
  );
  changes++; console.log('✅ useState sharedMedia ajouté');
} else console.log('⏭️  sharedMedia déjà présent');

// 3. checkIntent
if (!code.includes('checkSendIntentReceived')) {
  code = code.replace(
    `useEffect(()=>{window.__celesteSetTab=setTab;return()=>{delete window.__celesteSetTab;};},[]);`,
    `useEffect(()=>{
  const checkIntent=async()=>{
    try{
      const result=await SendIntent.checkSendIntentReceived();
      if(result&&result.url){
        const res=await fetch(result.url);
        const blob=await res.blob();
        const name=decodeURIComponent(result.url.split("/").pop()||"media");
        const file=new File([blob],name,{type:result.type||blob.type});
        setSharedMedia(file);
        await SendIntent.finish();
      }
    }catch(e){}
  };
  checkIntent();
  const sub=CapApp.addListener("appStateChange",({isActive})=>{if(isActive)checkIntent();});
  return()=>{sub.then&&sub.then(s=>s.remove()).catch(()=>{});};
},[]);
useEffect(()=>{window.__celesteSetTab=setTab;return()=>{delete window.__celesteSetTab;};},[]);`
  );
  changes++; console.log('✅ checkIntent ajouté');
} else console.log('⏭️  checkIntent déjà présent');

// 4. Modal choix POST/STATUT
if (!code.includes('Partager sur C\u00e9leste')) {
  code = code.replace(
    `{showNewPost&&<NewPostModal`,
    `{sharedMedia&&<div style={{position:"fixed",inset:0,zIndex:1200,background:"rgba(0,0,0,0.92)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20}}>
  <p style={{color:"#fff",fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:300,letterSpacing:2}}>Partager sur C\u00e9leste</p>
  <div style={{display:"flex",gap:16}}>
    <button onClick={()=>{window.__celesteSharedFile=sharedMedia;setSharedMedia(null);pushNav(()=>setShowNewPost(false));setShowNewPost(true);}} style={{padding:"14px 28px",background:"linear-gradient(135deg,#C9952A,#e8b84b)",border:"none",borderRadius:16,color:"#000",fontWeight:700,fontSize:15,cursor:"pointer"}}>Post</button>
    <button onClick={()=>{window.__celesteSharedFile=sharedMedia;setSharedMedia(null);window.__celesteOpenStatus=true;setTab("statuses");}} style={{padding:"14px 28px",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:16,color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer"}}>Statut</button>
  </div>
  <button onClick={()=>setSharedMedia(null)} style={{color:"rgba(255,255,255,0.4)",background:"none",border:"none",fontSize:13,cursor:"pointer",marginTop:4}}>Annuler</button>
</div>}
{showNewPost&&<NewPostModal`
  );
  changes++; console.log('✅ Modal partage ajouté');
} else console.log('⏭️  Modal déjà présent');

// 5. Injection dans NewPostModal
if (!code.includes('__celesteSharedFile')) {
  code = code.replace(
    `const fRef=useRef();\nconst vRef=useRef();`,
    `const fRef=useRef();\nconst vRef=useRef();\nuseEffect(()=>{if(window.__celesteSharedFile){const f=window.__celesteSharedFile;delete window.__celesteSharedFile;setTimeout(()=>handlePick({target:{files:[f]}}),100);}},[]);`
  );
  changes++; console.log('✅ Injection NewPostModal ajoutée');
} else console.log('⏭️  Injection NewPostModal déjà présente');

// 6. Injection dans StatusCreatorModal
if (!code.includes('__celesteOpenStatus')) {
  const statusIdx = code.indexOf('function StatusCreatorModal(');
  if (statusIdx !== -1) {
    const fRefIdx = code.indexOf('const fRef=useRef();', statusIdx);
    if (fRefIdx !== -1) {
      const insert = `\nuseEffect(()=>{if(window.__celesteOpenStatus&&window.__celesteSharedFile){const f=window.__celesteSharedFile;delete window.__celesteSharedFile;delete window.__celesteOpenStatus;setTimeout(()=>handlePick({target:{files:[f]}}),100);}},[]);`;
      code = code.slice(0, fRefIdx + 'const fRef=useRef();'.length) + insert + code.slice(fRefIdx + 'const fRef=useRef();'.length);
      changes++; console.log('✅ Injection StatusCreatorModal ajoutée');
    }
  }
} else console.log('⏭️  Injection StatusCreatorModal déjà présente');

fs.writeFileSync(filePath, code, 'utf8');
console.log('\n✅ Terminé ! ' + changes + ' modifications appliquées.');
