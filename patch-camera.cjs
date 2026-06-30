const fs = require("fs");
const path = require("path");

const APP = path.join(__dirname, "src", "App.jsx");
let code = fs.readFileSync(APP, "utf8");

// 1. Ajouter l'import CameraStudioModal après l'import ReelsViewer
const importTarget = 'import ReelsViewer from "./ReelsViewer";';
const importAdd    = 'import CameraStudioModal from "./CameraStudioModal";';
if (code.includes(importAdd)) {
  console.log("⚠️  Import CameraStudioModal déjà présent — ignoré.");
} else if (!code.includes(importTarget)) {
  console.error("❌ Ligne import ReelsViewer introuvable. Arrêt.");
  process.exit(1);
} else {
  code = code.replace(importTarget, importTarget + "\n" + importAdd);
  console.log("✅ Import ajouté.");
}

// 2. Ajouter state showCameraStudio dans NewPostModal
// On cible la ligne : const [busy,setBusy]=useState(false);
const stateTarget = "const [busy,setBusy]=useState(false);";
const stateAdd    = "\nconst [showCameraStudio,setShowCameraStudio]=useState(false);";
if (code.includes("showCameraStudio")) {
  console.log("⚠️  State showCameraStudio déjà présent — ignoré.");
} else if (!code.includes(stateTarget)) {
  console.error("❌ Ligne useState busy introuvable dans NewPostModal. Arrêt.");
  process.exit(1);
} else {
  code = code.replace(stateTarget, stateTarget + stateAdd);
  console.log("✅ State ajouté.");
}

// 3. Ajouter le bouton Caméra dans la toolbar bas de NewPostModal
// On cible le bouton Texte existant pour insérer avant lui
const toolbarTarget = `<button onClick={()=>setType("text")} style={{background:"none",border:"none",cursor:"pointer",color:type==="text"?T.goldL:T.muted,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:0,transition:"color .2s"}}>
          <span style={{fontSize:18}}>✍</span>
          <span style={{fontSize:9,letterSpacing:.5}}>Texte</span>
        </button>`;

const cameraBtn = `<button onClick={()=>setShowCameraStudio(true)} style={{background:"none",border:"none",cursor:"pointer",color:T.muted,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:0,transition:"color .2s"}}>
          <Camera size={22}/>
          <span style={{fontSize:9,letterSpacing:.5}}>Caméra</span>
        </button>
        `;

if (code.includes("setShowCameraStudio(true)")) {
  console.log("⚠️  Bouton Caméra déjà présent — ignoré.");
} else if (!code.includes(toolbarTarget)) {
  // Essai fallback plus court
  const fallback = 'onClick={()=>setType("text")}';
  if (!code.includes(fallback)) {
    console.error("❌ Bouton Texte introuvable dans toolbar NewPostModal. Arrêt.");
    process.exit(1);
  }
  // Insertion avant le bloc bouton Texte via position indexOf
  const idx = code.indexOf(fallback);
  const btnStart = code.lastIndexOf("<button", idx);
  code = code.slice(0, btnStart) + cameraBtn + code.slice(btnStart);
  console.log("✅ Bouton Caméra ajouté (fallback).");
} else {
  code = code.replace(toolbarTarget, cameraBtn + toolbarTarget);
  console.log("✅ Bouton Caméra ajouté.");
}

// 4. Ajouter le rendu CameraStudioModal dans NewPostModal (avant la div principale)
const renderTarget = '<div style={{position:"fixed",inset:0,zIndex:400,background:T.bg,display:"flex",flexDirection:"column"}}>';
const renderAdd = `{showCameraStudio&&<CameraStudioModal
  onClose={()=>setShowCameraStudio(false)}
  onDone={({file,type:mtype})=>{
    setShowCameraStudio(false);
    const fakeEvent={target:{files:[file]}};
    handlePick(fakeEvent);
  }}
/>}
`;
if (code.includes("showCameraStudio&&<CameraStudioModal")) {
  console.log("⚠️  Rendu CameraStudioModal déjà présent — ignoré.");
} else if (!code.includes(renderTarget)) {
  console.error("❌ Div principale NewPostModal introuvable. Arrêt.");
  process.exit(1);
} else {
  code = code.replace(renderTarget, renderAdd + renderTarget);
  console.log("✅ Rendu CameraStudioModal ajouté.");
}

fs.writeFileSync(APP, code, "utf8");
console.log("\n🎉 patch-camera.cjs appliqué avec succès.");
