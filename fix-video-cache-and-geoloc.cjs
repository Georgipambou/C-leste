const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.jsx');
let code = fs.readFileSync(filePath, 'utf8');
let fixes = 0;

// ── FIX 1 : import Geolocation natif ──────────────────────────────────────────
const OLD_IMPORTS = `import { Capacitor } from '@capacitor/core';`;
const NEW_IMPORTS = `import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';`;

if (code.includes(OLD_IMPORTS) && !code.includes("from '@capacitor/geolocation'")) {
  code = code.replace(OLD_IMPORTS, NEW_IMPORTS);
  fixes++;
  console.log('✓ 1/3 import Geolocation ajouté');
} else {
  console.log('⚠ 1/3 import déjà présent ou non trouvé');
}

// ── FIX 2 : remplacer navigator.geolocation.watchPosition par plugin natif ────
const OLD_GEO = `if(navigator.geolocation){navigator.geolocation.watchPosition(pos=>{sb.from("profiles").update({latitude:pos.coords.latitude,longitude:pos.coords.longitude}).eq("id",s.user.id);},()=>{},{enableHighAccuracy:false,maximumAge:300000,timeout:10000});}`;
const NEW_GEO = `(async()=>{try{const pos=await Geolocation.getCurrentPosition({enableHighAccuracy:false,timeout:10000});await sb.from("profiles").update({latitude:pos.coords.latitude,longitude:pos.coords.longitude}).eq("id",s.user.id);}catch(e){console.warn("geo:",e);}})();`;

if (code.includes(OLD_GEO)) {
  code = code.replace(OLD_GEO, NEW_GEO);
  fixes++;
  console.log('✓ 2/3 géolocalisation native (Capacitor)');
} else {
  console.log('⚠ 2/3 bloc géolocalisation non trouvé exactement – recherche partielle…');
  // fallback : cherche juste watchPosition
  const fallback = /navigator\.geolocation\.watchPosition\([^;]+;[^}]+\}[^}]+\}/;
  if (fallback.test(code)) {
    code = code.replace(fallback, NEW_GEO);
    fixes++;
    console.log('✓ 2/3 géolocalisation corrigée (fallback regex)');
  } else {
    console.log('✗ 2/3 bloc introuvable, correction manuelle nécessaire');
  }
}

// ── FIX 3 : cache vidéo dans ReelsViewer ──────────────────────────────────────
// Ajoute le helper de cache juste avant la déclaration du composant ReelsViewer
const CACHE_HELPER = `// ── cache vidéo session ──────────────────────────────────────────
const _vBlobMap=new Map();
async function getCachedVideoSrc(url){
  if(!url)return url;
  if(_vBlobMap.has(url))return _vBlobMap.get(url);
  try{
    const cache=await caches.open('celeste-videos');
    let resp=await cache.match(url);
    if(!resp){resp=await fetch(url);if(!resp.ok)throw new Error('fetch fail');await cache.put(url,resp.clone());}
    const blob=await resp.blob();
    const blobUrl=URL.createObjectURL(blob);
    _vBlobMap.set(url,blobUrl);
    return blobUrl;
  }catch(e){console.warn('video cache:',e);return url;}
}
// ─────────────────────────────────────────────────────────────────\n`;

// Repère la fonction ReelsViewer
const REEL_MARKER = `function ReelsViewer(`;
if (!code.includes('getCachedVideoSrc') && code.includes(REEL_MARKER)) {
  code = code.replace(REEL_MARKER, CACHE_HELPER + REEL_MARKER);
  fixes++;
  console.log('✓ 3a/3 helper getCachedVideoSrc ajouté');
} else if (code.includes('getCachedVideoSrc')) {
  console.log('⚠ 3a/3 helper déjà présent');
  fixes++;
} else {
  console.log('✗ 3a/3 ReelsViewer non trouvé');
}

// Ajoute useEffect de résolution du src dans ReelsViewer :
// On cherche la déclaration du state progressMap dans ReelsViewer pour y accrocher l'effet
const OLD_NEAR = `const nearActive=Math.abs(idx-activeIdx)<=2;
          const videoSrc=(post.media_urls||[]).find(u=>(u||"").match(/\\.(mp4|mov|webm)/i))||post.img;`;
const NEW_NEAR = `const nearActive=Math.abs(idx-activeIdx)<=2;
          const rawVideoSrc=(post.media_urls||[]).find(u=>(u||"").match(/\\.(mp4|mov|webm)/i))||post.img;
          const [videoSrc,setVideoSrc]=useState(rawVideoSrc);
          useEffect(()=>{if(nearActive&&rawVideoSrc){getCachedVideoSrc(rawVideoSrc).then(setVideoSrc);}else{setVideoSrc(rawVideoSrc);}},[nearActive,rawVideoSrc]);`;

if (code.includes(OLD_NEAR)) {
  code = code.replace(OLD_NEAR, NEW_NEAR);
  fixes++;
  console.log('✓ 3b/3 cache vidéo branché dans ReelsViewer');
} else {
  // essaie sans les backslashes d'échappement
  const OLD2 = `const nearActive=Math.abs(idx-activeIdx)<=2;\n          const videoSrc=(post.media_urls||[]).find(u=>(u||"").match(/\\.(mp4|mov|webm)/i))||post.img;`;
  if (code.includes(OLD2)) {
    code = code.replace(OLD2, NEW_NEAR);
    fixes++;
    console.log('✓ 3b/3 cache vidéo branché (alt)');
  } else {
    console.log('✗ 3b/3 nearActive/videoSrc non trouvé exactement');
  }
}

fs.writeFileSync(filePath, code, 'utf8');
console.log(`\n${fixes}/5 modifications appliquées.`);
