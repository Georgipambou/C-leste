const fs = require('fs');
const file = 'src/CameraStudioModal.jsx';
let code = fs.readFileSync(file, 'utf8');
const before = 'color:"#fff",fontSize:16,outline:"none",marginBottom:14,';
const after  = 'fontSize:16,outline:"none",marginBottom:14,';
if (!code.includes(before)) { console.error('Ligne introuvable'); process.exit(1); }
code = code.replace(before, after);
fs.writeFileSync(file, code, 'utf8');
console.log('✅ Doublon color supprimé.');
