/**
 * patch-doubletap-fix.cjs
 * Corrige le bug pause/like au double tap dans ReelsViewer.jsx
 * Usage : node patch-doubletap-fix.cjs
 */

const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "src", "ReelsViewer.jsx");

if (!fs.existsSync(FILE)) {
  console.error("❌ ReelsViewer.jsx introuvable :", FILE);
  process.exit(1);
}

let src = fs.readFileSync(FILE, "utf8");

const OLD = `  const handleTap = useCallback((idx, post, e) => {
    const now  = Date.now();
    const last = lastTapRef.current[idx] || 0;
    if (now - last < 320) {
      // Double tap
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = ++heartIdRef.current;
      setHearts(h => [...h, { id, x, y }]);
      const liked = (post.likes || []).some(l => (l.user_id || l) === uid);
      if (!liked) toggleLike(post.id);
    } else {
      // Simple tap → pause/play
      togglePause(idx);
    }
    lastTapRef.current[idx] = now;
  }, [toggleLike, togglePause, uid]);`;

const NEW = `  const handleTap = useCallback((idx, post, e) => {
    const now  = Date.now();
    const last = lastTapRef.current[idx] || 0;
    // Annule le simple tap en attente
    clearTimeout(window[\`_tap_\${idx}\`]);
    if (now - last < 320) {
      // Double tap confirmé → like + cœur
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = ++heartIdRef.current;
      setHearts(h => [...h, { id, x, y }]);
      const liked = (post.likes || []).some(l => (l.user_id || l) === uid);
      if (!liked) toggleLike(post.id);
    } else {
      // Premier tap → attend 320ms pour voir si un 2e tap arrive
      window[\`_tap_\${idx}\`] = setTimeout(() => togglePause(idx), 320);
    }
    lastTapRef.current[idx] = now;
  }, [toggleLike, togglePause, uid]);`;

if (!src.includes(OLD)) {
  console.error("❌ Marqueur handleTap non trouvé — fichier modifié ?");
  process.exit(1);
}

const BACKUP = FILE + ".bak-doubletap";
fs.writeFileSync(BACKUP, src, "utf8");

src = src.replace(OLD, NEW);
fs.writeFileSync(FILE, src, "utf8");

console.log("✅ Fix double tap appliqué dans ReelsViewer.jsx");
console.log("   Backup :", BACKUP);
console.log("\nVérifie avec : npm run build");
