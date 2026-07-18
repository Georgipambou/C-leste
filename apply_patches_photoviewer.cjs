const fs = require("fs");

const file = process.argv[2];
if (!file) { console.error("Usage: node apply_patches_photoviewer.cjs PhotoViewer.jsx"); process.exit(1); }
let src = fs.readFileSync(file, "utf8");

const patches = [
  {
    name: "Import Volume2/VolumeX",
    search: `import { X, Heart, MessageCircle, Bookmark, MoreVertical, Trash2, Flag, EyeOff, Eye } from "lucide-react";`,
    replace: `import { X, Heart, MessageCircle, Bookmark, MoreVertical, Trash2, Flag, EyeOff, Eye, Volume2, VolumeX } from "lucide-react";`,
  },
  {
    name: "État muted",
    search: `  const soundAudioRef = useRef(null);\r\n\r\n  const uid = session?.user?.id;`,
    replace: `  const soundAudioRef = useRef(null);\r\n  const [muted, setMuted] = useState(false);\r\n\r\n  const uid = session?.user?.id;`,
  },
  {
    name: "Effet son — appliquer muted",
    search: `  // ── Lecture du son attaché à la photo active ──────────────────\r\n  useEffect(() => {\r\n    const post = displayPosts[activeIdx];\r\n    const a = soundAudioRef.current;\r\n    if (!a) return;\r\n    if (post?.sound?.url) {\r\n      if (a.src !== post.sound.url) { a.src = post.sound.url; a.currentTime = 0; }\r\n      a.loop = true;\r\n      a.play().catch(() => {});\r\n    } else {\r\n      a.pause();\r\n    }\r\n    return () => a.pause();\r\n  }, [activeIdx, displayPosts]);`,
    replace: `  // ── Lecture du son attaché à la photo active ──────────────────\r\n  useEffect(() => {\r\n    const post = displayPosts[activeIdx];\r\n    const a = soundAudioRef.current;\r\n    if (!a) return;\r\n    a.muted = muted;\r\n    if (post?.sound?.url) {\r\n      if (a.src !== post.sound.url) { a.src = post.sound.url; a.currentTime = 0; }\r\n      a.loop = true;\r\n      a.play().catch(() => {});\r\n    } else {\r\n      a.pause();\r\n    }\r\n    return () => a.pause();\r\n  }, [activeIdx, displayPosts, muted]);`,
  },
  {
    name: "Bouton mute (haut droite)",
    search: `      {/* Bouton fermer */}\r\n      <button\r\n        onClick={onClose}\r\n        style={{\r\n          position: "absolute",\r\n          top: "calc(14px + env(safe-area-inset-top,0px))",\r\n          left: 14, zIndex: 10,\r\n          background: "rgba(0,0,0,0.45)", border: "none", borderRadius: "50%",\r\n          width: 36, height: 36,\r\n          display: "flex", alignItems: "center", justifyContent: "center",\r\n          color: "#fff", cursor: "pointer",\r\n        }}\r\n      >\r\n        <X size={20} />\r\n      </button>\r\n`,
    replace: `      {/* Bouton fermer */}\r\n      <button\r\n        onClick={onClose}\r\n        style={{\r\n          position: "absolute",\r\n          top: "calc(14px + env(safe-area-inset-top,0px))",\r\n          left: 14, zIndex: 10,\r\n          background: "rgba(0,0,0,0.45)", border: "none", borderRadius: "50%",\r\n          width: 36, height: 36,\r\n          display: "flex", alignItems: "center", justifyContent: "center",\r\n          color: "#fff", cursor: "pointer",\r\n        }}\r\n      >\r\n        <X size={20} />\r\n      </button>\r\n\r\n      {/* Bouton mute */}\r\n      <button\r\n        onClick={() => setMuted(m => !m)}\r\n        style={{\r\n          position: "absolute",\r\n          top: "calc(14px + env(safe-area-inset-top,0px))",\r\n          right: 14, zIndex: 10,\r\n          background: "rgba(0,0,0,0.45)", border: "none", borderRadius: "50%",\r\n          width: 36, height: 36,\r\n          display: "flex", alignItems: "center", justifyContent: "center",\r\n          color: "#fff", cursor: "pointer",\r\n        }}\r\n      >\r\n        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}\r\n      </button>\r\n`,
  },
];

let applied = 0, already = 0, warn = 0;

for (const p of patches) {
  const count = src.split(p.search).length - 1;
  if (count === 0) {
    if (src.includes(p.replace)) {
      console.log(`⏭️  [déjà en place] ${p.name}`);
      already++;
    } else {
      console.log(`⚠️  [introuvable] ${p.name} — à vérifier manuellement`);
      warn++;
    }
  } else if (count > 1) {
    console.log(`⚠️  [ambigu, ${count} occurrences] ${p.name} — appliqué à la 1ère seulement`);
    src = src.replace(p.search, p.replace);
    applied++;
  } else {
    src = src.replace(p.search, p.replace);
    console.log(`✅ [appliqué] ${p.name}`);
    applied++;
  }
}

fs.writeFileSync(file, src, "utf8");
console.log(`\n— Terminé : ${applied} appliqué(s), ${already} déjà en place, ${warn} à vérifier manuellement —`);
