#!/usr/bin/env node
// Usage : node patch-duo.js App.jsx
// Applique tous les patchs "Duo" + le dernier ajustement loadMembers/suspended
// restants. Idempotent : si un motif est déjà patché ou introuvable, il est
// simplement signalé, rien n'est cassé.

const fs = require('fs');
const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage : node patch-duo.js chemin/vers/App.jsx');
  process.exit(1);
}

let raw = fs.readFileSync(filePath, 'utf8');
const hadCRLF = raw.includes('\r\n');
let src = raw.replace(/\r\n/g, '\n');

const applied = [];
const skipped = [];

function patch(label, oldStr, newStr) {
  if (src.includes(newStr)) {
    skipped.push(`${label} — déjà appliqué, rien à faire`);
    return;
  }
  const count = src.split(oldStr).length - 1;
  if (count === 0) {
    skipped.push(`${label} — motif introuvable (fichier différent de celui analysé ?)`);
    return;
  }
  if (count > 1) {
    skipped.push(`${label} — motif trouvé ${count} fois, ambigu, NON appliqué (à faire à la main)`);
    return;
  }
  src = src.replace(oldStr, newStr);
  applied.push(label);
}

patch(
  'Import Duo.jsx',
  `import { ProfileViewsCard, DiscoverPeopleSection, logProfileView, ProfileHeader } from "./ProfileDashboard";`,
  `import { ProfileViewsCard, DiscoverPeopleSection, logProfileView, ProfileHeader } from "./ProfileDashboard";\nimport { DuoButton, DuoBadge, DuoPrivacySetting, saveDuoCollaborators } from "./Duo";`
);

patch(
  'loadMembers : exclure aussi les comptes suspendus',
  `const{data}=await sb.from("profiles").select("id,prenom,nom,avatar_url,badge,paroisse,status,last_seen,country,account_type,latitude,longitude,no_messages,screenshot_protection,hide_online,joined_at").neq("status","pending");`,
  `const{data}=await sb.from("profiles").select("id,prenom,nom,avatar_url,badge,paroisse,status,last_seen,country,account_type,latitude,longitude,no_messages,screenshot_protection,hide_online,joined_at").neq("status","pending").neq("status","suspended");`
);

patch(
  'NewPostModal : état duoCollaborators',
  `const [selectedSound,setSelectedSound]=useState(initialSound);`,
  `const [selectedSound,setSelectedSound]=useState(initialSound);\nconst [duoCollaborators,setDuoCollaborators]=useState([]);`
);

patch(
  'NewPostModal : bouton DuoButton',
  `              <SoundPickerButton sb={sb} value={selectedSound} onChange={setSelectedSound} userId={session?.user?.id} T={T}/>`,
  `              <SoundPickerButton sb={sb} value={selectedSound} onChange={setSelectedSound} userId={session?.user?.id} T={T}/>\n              <DuoButton sb={sb} T={T} Av={Av} Btn={Btn} session={session} value={duoCollaborators} onChange={setDuoCollaborators}/>`
);

patch(
  'NewPostModal : bypass limite 50 posts si duo',
  `    if(!hasBadge&&count>=50){\n      notify(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><Lock size={14}/>Limite de 50 posts atteinte — Obtenez le badge certifié pour publier en illimité ✦</span>);\n      return;\n    }`,
  `    if(!hasBadge&&count>=50&&duoCollaborators.length===0){\n      notify(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><Lock size={14}/>Limite de 50 posts atteinte — Obtenez le badge certifié pour publier en illimité ✦</span>);\n      return;\n    }`
);

patch(
  'NewPostModal : saveDuoCollaborators après création du post',
  `    if(selectedCategories.length>0){\n      await sb.from("post_categories").insert(selectedCategories.map(category=>({post_id:postId,category,source:"manual"})));\n    }`,
  `    if(selectedCategories.length>0){\n      await sb.from("post_categories").insert(selectedCategories.map(category=>({post_id:postId,category,source:"manual"})));\n    }\n    if(duoCollaborators.length>0){\n      await saveDuoCollaborators(sb,postId,uid,duoCollaborators);\n    }`
);

patch(
  'PostCard : badge Duo dans le feed',
  `              <Badge type={post.author?.badge}/>`,
  `              <Badge type={post.author?.badge}/>\n              <DuoBadge sb={sb} T={T} Av={Av} postId={post.id}/>`
);

patch(
  'ParametresModal : état duoPermission',
  `const [screenshotProtection,setScreenshotProtection]=useState(false);`,
  `const [screenshotProtection,setScreenshotProtection]=useState(false);\nconst [duoPermission,setDuoPermission]=useState("everyone");`
);

patch(
  'ParametresModal : chargement duoPermission',
  `        if(data){setDnd(!!data.no_messages);setDiscoverable(data.is_discoverable!==false);setHideOnline(!!data.hide_online);setScreenshotProtection(!!data.screenshot_protection);}`,
  `        if(data){setDnd(!!data.no_messages);setDiscoverable(data.is_discoverable!==false);setHideOnline(!!data.hide_online);setScreenshotProtection(!!data.screenshot_protection);}\n        sb.from("profiles").select("duo_permission").eq("id",session.user.id).maybeSingle().then(({data:d})=>{if(d?.duo_permission)setDuoPermission(d.duo_permission);});`
);

patch(
  'ParametresModal : affichage DuoPrivacySetting dans Confidentialité',
  `    <MatchPrivacyToggle session={session} notify={notify} myProfile={myProfile}/>`,
  `    <DuoPrivacySetting sb={sb} T={T} Btn={Btn} Av={Av} session={session} value={duoPermission} onChange={setDuoPermission} notify={notify}/>\n\n    <MatchPrivacyToggle session={session} notify={notify} myProfile={myProfile}/>`
);

patch(
  'loadPosts : fetch des collaborateurs + filtre blocage étendu',
  `const{data:completedRows}=myId?await sb.from("video_engagement_events").select("post_id").eq("viewer_id",myId).eq("completed",true).in("post_id",mapped.map(p=>p.id)):{data:[]};\nconst completedIds=new Set((completedRows||[]).map(r=>r.post_id));\n\nconst visible=mapped.filter(p=>{\n  if(blockedSet.has(p.by))return false;\n  if(p.author?.status==="suspended")return false;`,
  `const{data:completedRows}=myId?await sb.from("video_engagement_events").select("post_id").eq("viewer_id",myId).eq("completed",true).in("post_id",mapped.map(p=>p.id)):{data:[]};\nconst completedIds=new Set((completedRows||[]).map(r=>r.post_id));\nconst{data:collabRows}=await sb.from("post_collaborators").select("post_id,collaborator_id").in("post_id",mapped.map(p=>p.id));\nconst collaboratorsByPost=new Map();\n(collabRows||[]).forEach(r=>{\n  if(!collaboratorsByPost.has(r.post_id))collaboratorsByPost.set(r.post_id,[]);\n  collaboratorsByPost.get(r.post_id).push(r.collaborator_id);\n});\n\nconst visible=mapped.filter(p=>{\n  if(blockedSet.has(p.by))return false;\n  if((collaboratorsByPost.get(p.id)||[]).some(id=>blockedSet.has(id)))return false;\n  if(p.author?.status==="suspended")return false;`
);

patch(
  'loadPosts : portée "testing" étendue aux abonnés des collaborateurs',
  `if(p.visibility==="testing"&&p.by!==myId&&!followedIds.has(p.by))return false;`,
  `if(p.visibility==="testing"&&p.by!==myId&&!followedIds.has(p.by)&&!(collaboratorsByPost.get(p.id)||[]).some(id=>followedIds.has(id)))return false;`
);

patch(
  'PostDetailModal : anti-capture via is_post_protected (prend en compte les collaborateurs)',
  `useEffect(()=>{\n  if(post?.author?.screenshot_protection)enableScreenProtection();else disableScreenProtection();\n  const ch=sb.channel(\`privacy_post_\${post?.by}-\${Math.random()}\`)\n    .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles",filter:\`id=eq.\${post?.by}\`},payload=>{\n      if(payload.new?.screenshot_protection)enableScreenProtection();else disableScreenProtection();\n    })\n    .subscribe();\n  return()=>{sb.removeChannel(ch);disableScreenProtection();};\n},[post?.by]);`,
  `useEffect(()=>{\n  let active=true;\n  const check=()=>sb.rpc("is_post_protected",{p_post_id:post?.id}).then(({data})=>{if(active)(data?enableScreenProtection():disableScreenProtection());});\n  check();\n  const ch=sb.channel(\`privacy_post_\${post?.by}-\${Math.random()}\`)\n    .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles",filter:\`id=eq.\${post?.by}\`},check)\n    .subscribe();\n  return()=>{active=false;sb.removeChannel(ch);disableScreenProtection();};\n},[post?.id,post?.by]);`
);

if (hadCRLF) src = src.replace(/\n/g, '\r\n');

fs.writeFileSync(filePath, src, 'utf8');

console.log(`✅ Appliqués (${applied.length}) :`);
applied.forEach(a => console.log('  - ' + a));
if (skipped.length) {
  console.log(`\n⚠️  Non appliqués (${skipped.length}) :`);
  skipped.forEach(s => console.log('  - ' + s));
}
