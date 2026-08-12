// fix-messaging-bugs.cjs
// Corrige 4 bugs de messagerie diagnostiqués dans App.jsx :
//  1) INSERT realtime global (celeste_rt) : mapping de message incomplet
//  2) UPDATE realtime global (celeste_rt) : mauvais mapping des champs (is_read -> read etc.)
//  3) Aperçu vide dans la liste de conversations pour sticker / post_share / status_reply
//  4) Envoi hors-ligne qui contourne la vérification "utilisateur bloqué"
//
// Usage : node fix-messaging-bugs.cjs
// Ajuste TARGET si ton App.jsx n'est pas à la racine du projet (ex: "src/App.jsx").

const fs = require("fs");
const TARGET = "src/App.jsx";

let src = fs.readFileSync(TARGET, "utf8");
let count = 0;

// Le fichier peut être en CRLF (Windows) ou LF : on adapte les motifs multi-lignes
// écrits ici en LF pour qu'ils matchent quel que soit le format du fichier cible.
const usesCRLF = src.includes("\r\n");
function normalizeEOL(str) {
  return usesCRLF ? str.replace(/\n/g, "\r\n") : str;
}

function replaceOnce(label, oldStrRaw, newStrRaw) {
  const oldStr = normalizeEOL(oldStrRaw);
  const newStr = normalizeEOL(newStrRaw);
  const idx = src.indexOf(oldStr);
  if (idx === -1) {
    console.error(`❌ [${label}] motif introuvable — patch non appliqué (le fichier a peut-être déjà changé).`);
    return;
  }
  const secondIdx = src.indexOf(oldStr, idx + 1);
  if (secondIdx !== -1) {
    console.error(`❌ [${label}] motif trouvé plusieurs fois — abandon pour éviter une mauvaise substitution.`);
    return;
  }
  src = src.slice(0, idx) + newStr + src.slice(idx + oldStr.length);
  count++;
  console.log(`✅ [${label}] appliqué`);
}

/* ============================================================
   1) INSERT realtime global — mapping de message complet
   ============================================================ */
replaceOnce(
  "1/4 - INSERT celeste_rt : champs manquants",
  `          const newMsg={id:nm.id,f:nm.sender_id===myId?"me":nm.sender_id,type:nm.type,text:nm.text||"",img:nm.file_url,fileName:nm.file_name,read:nm.is_read,ts:new Date(nm.created_at).getTime(),reply_metadata:nm.reply_metadata||null};`,
  `          const newMsg={id:nm.id,f:nm.sender_id===myId?"me":nm.sender_id,type:nm.type,text:nm.text||"",img:nm.file_url,fileName:nm.file_name,read:nm.is_read,ts:new Date(nm.created_at).getTime(),reply_metadata:typeof nm.reply_metadata==="string"?JSON.parse(nm.reply_metadata):nm.reply_metadata||null,reply_to_id:nm.reply_to_id||null,reply_to_text:nm.reply_to_text||null,reply_to_author:nm.reply_to_author||null,reactions:nm.reactions||null,edited_at:nm.edited_at||null,sticker_id:nm.sticker_id||null,shared_post_id:nm.shared_post_id||null,view_once:!!nm.view_once,viewed_at:nm.viewed_at||null};`
);

/* ============================================================
   2) UPDATE realtime global — mapping correct is_read -> read
   ============================================================ */
replaceOnce(
  "2/4 - UPDATE celeste_rt : is_read non mappé sur read",
  `      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages"},payload=>{
        const updated=payload.new;
        setConvs(prev=>(prev||[]).map(c=>({
          ...c,
          msgs:(c.msgs||[]).map(m=>m.id===updated.id?{...m,...updated}:m)
        })));
      })`,
  `      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages"},payload=>{
        const updated=payload.new;
        setConvs(prev=>(prev||[]).map(c=>({
          ...c,
          msgs:(c.msgs||[]).map(m=>m.id===updated.id?{...m,text:updated.text??m.text,read:updated.is_read,reactions:updated.reactions||null,edited_at:updated.edited_at||null,view_once:!!updated.view_once,viewed_at:updated.viewed_at||null}:m)
        })));
      })`
);

/* ============================================================
   3) Aperçu manquant pour sticker / post_share / status_reply
   ============================================================ */
replaceOnce(
  "3/4 - MsgsTab : aperçu vide pour sticker/post_share/status_reply",
  `    const previewIcon=locked?null:!last?null:last.type==="photo"?<Image size={13}/>:last.type==="file"?<Paperclip size={13}/>:last.type==="voice"?<Mic size={13}/>:null;
    const prev=locked?"Conversation verrouillée":!last?"":last.type==="photo"?"Photo":last.type==="file"?(last.fileName||"Fichier"):last.type==="voice"?"Message vocal":last.f==="me"?\`Toi : \${last.text||""}\`:last.text||"";`,
  `    const previewIcon=locked?null:!last?null:last.type==="photo"?<Image size={13}/>:last.type==="file"?<Paperclip size={13}/>:last.type==="voice"?<Mic size={13}/>:last.type==="sticker"?<span style={{fontSize:13}}>🙂</span>:last.type==="post_share"?<Share2 size={13}/>:null;
    const prev=locked?"Conversation verrouillée":!last?"":last.type==="photo"?"Photo":last.type==="file"?(last.fileName||"Fichier"):last.type==="voice"?"Message vocal":last.type==="sticker"?"Autocollant":last.type==="post_share"?"Publication partagée":last.type==="status_reply"?"A répondu à votre statut":last.f==="me"?\`Toi : \${last.text||""}\`:last.text||"";`
);

/* ============================================================
   4) Envoi hors-ligne qui contourne la vérification "bloqué"
   ============================================================ */
replaceOnce(
  "4/4 - sendMsg : vérification isBlocked même hors-ligne",
  `  const sendMsg=async payload=>{
  let convId=conv.id;
  if(navigator.onLine){`,
  `  const sendMsg=async payload=>{
  if(isBlocked){notify(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><Ban size={14}/>Impossible d'envoyer ce message</span>);return;}
  let convId=conv.id;
  if(navigator.onLine){`
);

if (count === 5 - 1) { /* noop, garde-fou lisible */ }

fs.writeFileSync(TARGET, src, "utf8");
console.log(`\n${count}/4 patch(s) appliqué(s) sur ${TARGET}.`);
