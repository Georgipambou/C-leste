const fs = require("fs");
const PATH = "src/App.jsx";
let code = fs.readFileSync(PATH, "utf8");
const crlf = code.includes("\r\n");
let c = code.replace(/\r\n/g, "\n");
let count = 0;

function replace(search, replacement, label) {
  if (!c.includes(search)) { console.log(`⚠️  Non trouvé: ${label}`); return; }
  c = c.replace(search, replacement);
  count++;
  console.log(`✅ ${label}`);
}

// ─── 1. Mentions commentaires ───
replace(
  `renderTextWithMentions(comment.text,username=>{const m=(members||[]).find(u=>u.name?.toLowerCase().startsWith(username.toLowerCase())||u.fullName?.toLowerCase().includes(username.toLowerCase()));if(m)window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:m.id}}));})`,
  `renderTextWithMentions(comment.text,username=>{const m=(members||[]).find(u=>u.prenom?.toLowerCase()===username.toLowerCase()||`+"`${u.prenom||\"\"} ${u.nom||\"\"}`.toLowerCase().includes(username.toLowerCase())"+`);if(m)window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:m.id}}));})`,
  "Mentions commentaires — recherche par prenom/nom"
);

// ─── 2. Mentions posts (PostDetailModal ligne ~2163) ───
replace(
  `renderTextWithMentions(post.text, username=>{const m=(members||[]).find(u=>u.prenom?.toLowerCase()===username.toLowerCase()||u.name?.toLowerCase().startsWith(username.toLowerCase()));if(m)window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:m.id}}));})`,
  `renderTextWithMentions(post.text,username=>{const m=(members||[]).find(u=>u.prenom?.toLowerCase()===username.toLowerCase()||`+"`${u.prenom||\"\"} ${u.nom||\"\"}`.toLowerCase().includes(username.toLowerCase())"+`);if(m)window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:m.id}}));})`,
  "Mentions PostDetailModal — recherche par prenom/nom"
);

// ─── 3. Mentions posts (PostCard étendu) ───
// Deux occurrences identiques dans le expanded/collapsed
const mentionFix = `username=>{const m=(members||[]).find(u=>u.prenom?.toLowerCase()===username.toLowerCase()||`+"`${u.prenom||\"\"} ${u.nom||\"\"}`.toLowerCase().includes(username.toLowerCase())"+`);if(m)window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:m.id}}));}`;
const mentionOld = `username=>{const m=(members||[]).find(u=>u.prenom?.toLowerCase()===username.toLowerCase()||u.name?.toLowerCase().startsWith(username.toLowerCase()));if(m)window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:m.id}}));}`;

// Remplacer toutes les occurrences restantes
let prev = c;
c = c.split(mentionOld).join(mentionFix);
if (c !== prev) { count++; console.log("✅ Mentions PostCard — toutes occurrences corrigées"); }
else { console.log("⏭️  Mentions PostCard — déjà corrigées ou non trouvées"); }

// ─── 4. Messages instantanés — realtime local chat ───
replace(
  `    const nm=payload.new;\n    if(nm.sender_id!==session?.user?.id){\n      playChatSound("receive");reload();\n    }`,
  `    const nm=payload.new;\n    if(nm.sender_id!==session?.user?.id){playChatSound("receive");}\n    reload();`,
  "Chat realtime — reload pour tous les messages"
);

// ─── 5. Messages instantanés — realtime global ───
replace(
  `        const nm=payload.new;if(nm.sender_id===myId){loadConvs(myId);return;}`,
  `        const nm=payload.new;\n        setConvs(prev=>(prev||[]).map(cv=>{\n          if(cv.id!==nm.conv_id)return cv;\n          const alreadyExists=(cv.msgs||[]).some(m=>m.id===nm.id);\n          if(alreadyExists)return cv;\n          const newMsg={id:nm.id,f:nm.sender_id===myId?"me":nm.sender_id,type:nm.type,text:nm.text||"",img:nm.file_url,fileName:nm.file_name,read:nm.is_read,ts:new Date(nm.created_at).getTime(),reply_metadata:nm.reply_metadata||null};\n          return{...cv,msgs:[...(cv.msgs||[]),newMsg]};\n        }));\n        if(nm.sender_id===myId)return;`,
  "Chat global — message ajouté instantanément sans reload"
);

if (crlf) c = c.replace(/\n/g, "\r\n");
fs.writeFileSync(PATH, c, "utf8");
console.log(`\n${count} modification(s) appliquée(s). Lance: npm run build`);
