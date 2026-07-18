#!/usr/bin/env node
/**
 * Patch script pour App.jsx — Céleste
 * Usage : node apply_patches.js chemin/vers/App.jsx
 * (par défaut, cherche ./App.jsx dans le dossier courant)
 *
 * Chaque patch est idempotent : s'il est déjà appliqué, il est sauté
 * sans erreur. S'il ne trouve ni l'ancien ni le nouveau texte, il
 * affiche un avertissement (le fichier a peut-être changé depuis).
 */
const fs = require("fs");
const path = require("path");

const filePath = process.argv[2] || path.join(process.cwd(), "App.jsx");
if (!fs.existsSync(filePath)) {
  console.error(`❌ Fichier introuvable : ${filePath}`);
  process.exit(1);
}
let src = fs.readFileSync(filePath, "utf8");

let applied = 0, skipped = 0, warned = 0;

function patch(name, oldStr, newStr) {
  if (src.includes(newStr)) {
    console.log(`⏭️  [déjà appliqué] ${name}`);
    skipped++;
    return;
  }
  if (!src.includes(oldStr)) {
    console.warn(`⚠️  [introuvable] ${name} — à vérifier manuellement`);
    warned++;
    return;
  }
  const count = src.split(oldStr).length - 1;
  if (count > 1) {
    console.warn(`⚠️  [ambigu, ${count} occurrences] ${name} — appliqué à la 1ère seulement`);
  }
  src = src.replace(oldStr, newStr);
  console.log(`✅ [appliqué] ${name}`);
  applied++;
}

/* ── P1 : double-tap pour fermer les commentaires (fix robuste Capacitor) ── */
patch(
  "P1 — délai sur onBlur du champ commentaire",
  `onFocus={()=>setHideNav(true)}\r\n          onBlur={()=>setHideNav(false)}`,
  `onFocus={()=>setHideNav(true)}\r\n          onBlur={()=>setTimeout(()=>setHideNav(false),150)}`
);
// variante sans \r\n si le fichier a des fins de ligne LF
patch(
  "P1bis — délai sur onBlur (LF)",
  `onFocus={()=>setHideNav(true)}\n          onBlur={()=>setHideNav(false)}`,
  `onFocus={()=>setHideNav(true)}\n          onBlur={()=>setTimeout(()=>setHideNav(false),150)}`
);

/* ── P2 : LikedPostsTab — ajouter sound au select + au mapping ── */
patch(
  "P2 — LikedPostsTab: sound dans la requête + le mapping",
  `sb.from("likes").select("post_id,posts(*,author:profiles(id,prenom,nom,badge,avatar_url,paroisse,latitude,longitude),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url)))").eq("user_id",session?.user?.id).order("created_at",{referencedTable:"posts",ascending:false}).then(({data})=>{\r\n      setLikedPosts((data||[]).map(l=>l.posts).filter(Boolean).map(p=>({id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,text:p.text||"",img:p.img_url||null,media_urls:p.media_urls||[],title:p.event_title||null,eventDate:p.event_date||null,eventLoc:p.event_loc||null,likes:(p.likes||[]).map(l=>l.user_id),comments:(p.comments||[]).map(c=>({id:c.id,by:c.author?.id,author:normProfile(c.author||{}),text:c.text,ts:new Date(c.created_at).getTime()})),saved:[],savesCount:0,ts:new Date(p.created_at).getTime(),text_background:p.text_background||null,is_for_sale:p.is_for_sale||false,is_private:p.is_private||false})));`,
  `sb.from("likes").select("post_id,posts(*,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles(id,prenom,nom,badge,avatar_url,paroisse,latitude,longitude),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url)))").eq("user_id",session?.user?.id).order("created_at",{referencedTable:"posts",ascending:false}).then(({data})=>{\r\n      setLikedPosts((data||[]).map(l=>l.posts).filter(Boolean).map(p=>({id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,text:p.text||"",img:p.img_url||null,media_urls:p.media_urls||[],title:p.event_title||null,eventDate:p.event_date||null,eventLoc:p.event_loc||null,likes:(p.likes||[]).map(l=>l.user_id),comments:(p.comments||[]).map(c=>({id:c.id,by:c.author?.id,author:normProfile(c.author||{}),text:c.text,ts:new Date(c.created_at).getTime()})),saved:[],savesCount:0,ts:new Date(p.created_at).getTime(),text_background:p.text_background||null,is_for_sale:p.is_for_sale||false,is_private:p.is_private||false,sound:p.sound?{id:p.sound.id,title:p.sound.title,url:p.sound.url,owner_avatar:p.sound.owner?.avatar_url||null}:null})));`
);

/* ── P3 : LikedPostsTab — wrapper local toggleLike ── */
patch(
  "P3 — LikedPostsTab: wrapper localToggleLike",
  `},[session?.user?.id]);\r\n  if(loading)return<div style={{textAlign:"center",padding:40,color:T.muted}}>Chargement…</div>;`,
  `},[session?.user?.id]);\r\n  const localToggleLike=async pid=>{\r\n    const uid=session?.user?.id;\r\n    const post=likedPosts.find(p=>p.id===pid);\r\n    if(!post)return;\r\n    const liked=(post.likes||[]).some(l=>(l.user_id||l)===uid);\r\n    if(liked){\r\n      setLikedPosts(prev=>prev.filter(p=>p.id!==pid));\r\n    }else{\r\n      setLikedPosts(prev=>prev.map(p=>p.id!==pid?p:{...p,likes:[...(p.likes||[]),uid]}));\r\n    }\r\n    await toggleLike(pid);\r\n  };\r\n  if(loading)return<div style={{textAlign:"center",padding:40,color:T.muted}}>Chargement…</div>;`
);
patch(
  "P3b — LikedPostsTab: brancher localToggleLike sur ReelsViewer",
  `<ReelsViewer posts={videoPosts} sb={sb} startIndex={reelsIndex} onClose={()=>setReelsIndex(null)}\r\n          toggleLike={toggleLike} toggleSave={toggleSave} session={session} myProfile={myProfile} notify={notify}`,
  `<ReelsViewer posts={videoPosts} sb={sb} startIndex={reelsIndex} onClose={()=>setReelsIndex(null)}\r\n          toggleLike={localToggleLike} toggleSave={toggleSave} session={session} myProfile={myProfile} notify={notify}`
);
patch(
  "P3c — LikedPostsTab: brancher localToggleLike sur PhotoViewer",
  `<PhotoViewer posts={likedPosts.filter(p=>!isVid(p)&&(p.img||(p.media_urls&&p.media_urls.length>0)))} sb={sb} startIndex={photoViewerIndex} onClose={()=>setPhotoViewerIndex(null)}\r\n          toggleLike={toggleLike} toggleSave={toggleSave} session={session} myProfile={myProfile} notify={notify}`,
  `<PhotoViewer posts={likedPosts.filter(p=>!isVid(p)&&(p.img||(p.media_urls&&p.media_urls.length>0)))} sb={sb} startIndex={photoViewerIndex} onClose={()=>setPhotoViewerIndex(null)}\r\n          toggleLike={localToggleLike} toggleSave={toggleSave} session={session} myProfile={myProfile} notify={notify}`
);

/* ── P4 : UserView — ajouter media_urls + sound au mapping loadUPosts ── */
patch(
  "P4 — UserView: media_urls + sound dans loadUPosts",
  `const mapped=data.map(p=>({id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,text:p.text||"",img:p.img_url||null,is_private:p.is_private||false,likes:(p.likes||[]).map(l=>l.user_id),comments:[],ts:new Date(p.created_at).getTime(),profile_pinned:p.profile_pinned||false}));`,
  `const mapped=data.map(p=>({id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,text:p.text||"",img:p.img_url||null,media_urls:p.media_urls||[],is_private:p.is_private||false,likes:(p.likes||[]).map(l=>l.user_id),comments:[],ts:new Date(p.created_at).getTime(),profile_pinned:p.profile_pinned||false,sound:p.sound?{id:p.sound.id,title:p.sound.title,url:p.sound.url,owner_avatar:p.sound.owner?.avatar_url||null}:null}));`
);

/* ── P5 : UserView — wrapper local toggleLike (état uPosts) ── */
patch(
  "P5 — UserView: wrapper localToggleLike",
  `const [uPosts,setUPosts]=useState((posts||[]).filter(p=>p.by===user.id));\r\n const [userReelsIndex,setUserReelsIndex]=useState(null);`,
  `const [uPosts,setUPosts]=useState((posts||[]).filter(p=>p.by===user.id));\r\n  const localToggleLike=async pid=>{\r\n    const uid=session?.user?.id;\r\n    const post=uPosts.find(p=>p.id===pid);\r\n    if(!post)return;\r\n    const liked=(post.likes||[]).some(l=>(l.user_id||l)===uid);\r\n    setUPosts(prev=>prev.map(p=>p.id!==pid?p:{...p,likes:liked?(p.likes||[]).filter(l=>(l.user_id||l)!==uid):[...(p.likes||[]),uid]}));\r\n    await toggleLike(pid);\r\n  };\r\n const [userReelsIndex,setUserReelsIndex]=useState(null);`
);
patch(
  "P5b — UserView: brancher localToggleLike sur ReelsViewer",
  `startIndex={userReelsIndex}\r\n          onClose={()=>setUserReelsIndex(null)}\r\n          toggleLike={toggleLike}\r\n          toggleSave={toggleSave}`,
  `startIndex={userReelsIndex}\r\n          onClose={()=>setUserReelsIndex(null)}\r\n          toggleLike={localToggleLike}\r\n          toggleSave={toggleSave}`
);
patch(
  "P5c — UserView: brancher localToggleLike sur PhotoViewer",
  `startIndex={photoViewerIndex}\r\n          onClose={()=>setPhotoViewerIndex(null)}\r\n          toggleLike={toggleLike}\r\n          toggleSave={toggleSave}\r\n          session={session}\r\n          myProfile={myProfile}\r\n          notify={notify}\r\n          onUser={()=>{}}\r\n          onOpenComments={(p,onPhotoCb)=>{setPhotoCommentPost(p);setPhotoCloseCallback(()=>onPhotoCb);}}\r\n          myConnections={myConnections}`,
  `startIndex={photoViewerIndex}\r\n          onClose={()=>setPhotoViewerIndex(null)}\r\n          toggleLike={localToggleLike}\r\n          toggleSave={toggleSave}\r\n          session={session}\r\n          myProfile={myProfile}\r\n          notify={notify}\r\n          onUser={()=>{}}\r\n          onOpenComments={(p,onPhotoCb)=>{setPhotoCommentPost(p);setPhotoCloseCallback(()=>onPhotoCb);}}\r\n          myConnections={myConnections}`
);

/* ── P6 : ProfileTab — ajouter sound au mapping loadMyPosts ── */
patch(
  "P6 — ProfileTab: sound dans loadMyPosts",
  `const mapped=data.map(p=>({id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,text:p.text||"",img:p.img_url||null,media_urls:p.media_urls||[],title:p.event_title||null,likes:(p.likes||[]).map(l=>l.user_id),comments:(p.comments||[]),ts:new Date(p.created_at).getTime(),text_background:p.text_background||null,visibility:p.visibility||null,profile_pinned:p.profile_pinned||false}));`,
  `const mapped=data.map(p=>({id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,text:p.text||"",img:p.img_url||null,media_urls:p.media_urls||[],title:p.event_title||null,likes:(p.likes||[]).map(l=>l.user_id),comments:(p.comments||[]),ts:new Date(p.created_at).getTime(),text_background:p.text_background||null,visibility:p.visibility||null,profile_pinned:p.profile_pinned||false,sound:p.sound?{id:p.sound.id,title:p.sound.title,url:p.sound.url,owner_avatar:p.sound.owner?.avatar_url||null}:null}));`
);

/* ── P7 : ProfileTab — PhotoViewer doit refetch comme ReelsViewer (cohérence like) ── */
patch(
  "P7 — ProfileTab: PhotoViewer toggleLike/toggleSave rafraîchit myPosts",
  `posts={myPhotoPosts}\r\n    sb={sb}\r\n    startIndex={photoViewerIndex}\r\n    onClose={()=>setPhotoViewerIndex(null)}\r\n    toggleLike={toggleLike}\r\n    toggleSave={toggleSave}`,
  `posts={myPhotoPosts}\r\n    sb={sb}\r\n    startIndex={photoViewerIndex}\r\n    onClose={()=>setPhotoViewerIndex(null)}\r\n    toggleLike={async pid=>{await toggleLike(pid);loadMyPosts();}}\r\n    toggleSave={async pid=>{await toggleSave(pid);loadMyPosts();}}`
);

fs.writeFileSync(filePath, src, "utf8");
console.log(`\n— Terminé : ${applied} appliqué(s), ${skipped} déjà en place, ${warned} à vérifier manuellement —`);
