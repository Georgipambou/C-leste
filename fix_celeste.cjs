const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src", "App.jsx");
let code = fs.readFileSync(filePath, "utf8");
let changes = 0;

// ── FIX 1 : Supprimer le bloc statusTrimSrc mal placé dans NewPostModal ──
const badBlock = `{statusTrimSrc&&(\n  <VideoTrimModal\n    videoSrc={statusTrimSrc}\n    onClose={()=>{setStatusTrimSrc(null);setStatusTrimFile(null);}}\n    onDone={async trimmedFile=>{\n      setStatusTrimSrc(null);\n      const file=trimmedFile||statusTrimFile;\n      setStatusTrimFile(null);\n      const r=new FileReader();r.onload=ev=>setPreview(ev.target.result);r.readAsDataURL(file);\n      setUploading(true);\n      try{const publicUrl=await uploadToR2(file,\"statuses\");setMediaUrl(publicUrl);}\n      catch(e){console.error(\"Erreur upload statut:\",e);}\n      setUploading(false);\n    }}\n  />\n)}\n`;
if (code.includes(badBlock)) {
  code = code.replace(badBlock, "");
  console.log("✅ Fix 1 : bloc statusTrimSrc supprimé de NewPostModal");
  changes++;
} else {
  console.log("⚠️  Fix 1 : bloc non trouvé (déjà corrigé ?)");
}

// ── FIX 2 : Lecture de son propre statut depuis celeste_open_status ──
const oldHandler = `  const handler=async e=>{\n    const{statusId}=e.detail;\n    await load();\n    setGroups(prev=>{\n      for(const g of prev){\n        const found=g.statuses.find(s=>s.id===statusId);\n        if(found){\n          Promise.resolve().then(()=>{pushNav(()=>{setViewing(null);setHideNav(false);});setViewing(g);setHideNav(true);});\n          break;\n        }\n      }\n      return prev;\n    });\n  };`;
const newHandler = `  const handler=async e=>{\n    const{statusId}=e.detail;\n    await load();\n    setMyStatuses(prevMy=>{\n      const foundMine=prevMy.find(s=>s.id===statusId);\n      if(foundMine){\n        const myMappedNow=prevMy.map(s=>({id:s.id,type:s.type,text:s.text||null,mediaUrl:s.media_url||null,ts:new Date(s.created_at).getTime(),text_background:s.text_background||null}));\n        Promise.resolve().then(()=>{pushNav(()=>{setViewing(null);setHideNav(false);});setViewing({author:myProfile,statuses:myMappedNow});setHideNav(true);});\n        return prevMy;\n      }\n      setGroups(prev=>{\n        for(const g of prev){\n          const found=g.statuses.find(s=>s.id===statusId);\n          if(found){\n            Promise.resolve().then(()=>{pushNav(()=>{setViewing(null);setHideNav(false);});setViewing(g);setHideNav(true);});\n            break;\n          }\n        }\n        return prev;\n      });\n      return prevMy;\n    });\n  };`;
if (code.includes(oldHandler)) {
  code = code.replace(oldHandler, newHandler);
  console.log("✅ Fix 2 : lecture de son propre statut corrigée");
  changes++;
} else {
  console.log("⚠️  Fix 2 : handler non trouvé");
}

// ── FIX 3a : Barre de progression du Reels ──
const oldBar = `style={{position:\"absolute\",bottom:\"calc(4px + env(safe-area-inset-bottom,0px))\",left:0,right:0,height:6,background:\"rgba(255,255,255,0.25)\",zIndex:5,cursor:\"pointer\"}}`;
const newBar = `style={{position:\"absolute\",bottom:0,left:0,right:0,height:4,background:\"rgba(255,255,255,0.20)\",zIndex:5,cursor:\"pointer\"}}`;
if (code.includes(oldBar)) {
  code = code.replace(oldBar, newBar);
  console.log("✅ Fix 3a : barre de progression repositionnée");
  changes++;
} else {
  console.log("⚠️  Fix 3a : barre non trouvée");
}

// ── FIX 3b : Bouton WhatsApp dans Reels ──
const oldWa = `bottom:'calc(28px + env(safe-area-inset-bottom,0px))'`;
const newWa = `bottom:'calc(60px + env(safe-area-inset-bottom,0px))'`;
if (code.includes(oldWa)) {
  code = code.replace(oldWa, newWa);
  console.log("✅ Fix 3b : bouton WhatsApp remonté");
  changes++;
} else {
  console.log("⚠️  Fix 3b : bouton WhatsApp non trouvé");
}

// ── FIX 3c : Caption du reel remonté ──
const oldCaption = `bottom:\"calc(80px + env(safe-area-inset-bottom,0px))\",color:\"#fff\",zIndex:2}}`;
const newCaption = `bottom:\"calc(92px + env(safe-area-inset-bottom,0px))\",color:\"#fff\",zIndex:2}}`;
if (code.includes(oldCaption)) {
  code = code.replace(oldCaption, newCaption);
  console.log("✅ Fix 3c : caption remonté");
  changes++;
} else {
  console.log("⚠️  Fix 3c : caption non trouvé");
}

fs.writeFileSync(filePath, code, "utf8");
console.log(`\n✅ ${changes} correction(s) appliquée(s) sur src/App.jsx`);
