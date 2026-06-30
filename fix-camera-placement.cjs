const fs = require('fs');
const file = 'src/App.jsx';
let code = fs.readFileSync(file, 'utf8');

const anchor = `{videoTrimSrc&&<VideoTrimModal
  videoSrc={videoTrimSrc.src}
  onClose={()=>{setVideoTrimSrc(null);videoTrimSrc.resolve(null);}}
  onDone={data=>{videoTrimSrc.resolve(data);}}
/>}`;

const goodBlock = `
{showCameraStudio&&<CameraStudioModal
  onClose={()=>setShowCameraStudio(false)}
  onDone={({file,type:mtype})=>{
    setShowCameraStudio(false);
    const fakeEvent={target:{files:[file]}};
    handlePick(fakeEvent);
  }}
/>}`;

if (!code.includes(anchor)) {
  console.error('❌ Ancre introuvable. Arrêt.');
  process.exit(1);
}

if (code.includes('showCameraStudio&&<CameraStudioModal')) {
  console.log('⚠️  Bloc déjà présent — ignoré.');
} else {
  code = code.replace(anchor, anchor + goodBlock);
  console.log('✅ CameraStudioModal inséré au bon endroit.');
}

fs.writeFileSync(file, code, 'utf8');
console.log('🎉 Fix appliqué.');
