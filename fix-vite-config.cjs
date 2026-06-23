const fs = require('fs');
const path = require('path');
const filePath = process.argv[2];
if (!filePath) { console.error('Usage: node fix-vite-config.cjs <path/to/vite.config.js>'); process.exit(1); }

let src = fs.readFileSync(filePath, 'utf8');

const oldStr = `    rollupOptions: {
      output: {`;

const newStr = `    rollupOptions: {
      external: [
        '@capacitor/app',
        '@capacitor/core',
        '@capacitor/camera',
        '@capacitor/filesystem',
        '@capacitor/push-notifications',
        '@capacitor-community/privacy-screen',
        '@onesignal/capacitor-plugin',
      ],
      output: {`;

if (!src.includes(oldStr)) {
  console.log('✗ rollupOptions non trouvé — vérifie le fichier');
  process.exit(1);
}

src = src.replace(oldStr, newStr);
fs.writeFileSync(filePath, src, 'utf8');
console.log('✓ externals Capacitor ajoutés dans vite.config.js');
