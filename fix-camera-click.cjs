const fs = require('fs');
const file = 'src/CameraStudioModal.jsx';
let code = fs.readFileSync(file, 'utf8');

// Fix 1 — onPointerDown → onClick sur le bouton capture
code = code.replace(
  '<button onPointerDown={takePhoto}',
  '<button onClick={takePhoto}'
);

// Fix 2 — ajouter un console.log dans takePhoto pour debug + vérifier canvas
const oldTake = `const takePhoto = () => {
    canvasRef.current?.toBlob(b => {
      finish(b, URL.createObjectURL(b), false);
    }, "image/jpeg", 0.95);
  };`;

const newTake = `const takePhoto = () => {
    const canvas = canvasRef.current;
    if (!canvas) { console.error("Canvas null"); return; }
    try {
      canvas.toBlob(b => {
        if (!b) { console.error("Blob null"); return; }
        finish(b, URL.createObjectURL(b), false);
      }, "image/jpeg", 0.95);
    } catch(e) { console.error("takePhoto error", e); }
  };`;

if (code.includes(oldTake)) {
  code = code.replace(oldTake, newTake);
  console.log('✅ takePhoto renforcé.');
} else {
  console.log('⚠️  takePhoto déjà modifié ou introuvable.');
}

fs.writeFileSync(file, code, 'utf8');
console.log('🎉 Fix appliqué.');
