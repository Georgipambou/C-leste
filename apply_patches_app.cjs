const fs = require("fs");

const file = process.argv[2];
if (!file) { console.error("Usage: node apply_patches_app.cjs App.jsx"); process.exit(1); }
let src = fs.readFileSync(file, "utf8");

const patches = [
  {
    name: "SavedPostsTab — onOpenSound sur PhotoViewer",
    search: `onUser={()=>{}} onOpenComments={p=>setDetailPost(p)} myConnections={[]} onConnect={()=>{}}/>`,
    replace: `onUser={()=>{}} onOpenComments={p=>setDetailPost(p)} myConnections={[]} onConnect={()=>{}} onOpenSound={setOpenSoundId}/>`,
  },
  {
    name: "UserView — onOpenSound sur PhotoViewer",
    search: `posts={uPosts.filter(p=>!(p.img&&(/\\.(mp4|mov|webm|ogg|avi)(\\?|$)/i.test(p.img)||p.img.includes("video"))))}\r\n          sb={sb}\r\n          startIndex={photoViewerIndex}\r\n          onClose={()=>setPhotoViewerIndex(null)}\r\n          toggleLike={localToggleLike}\r\n          toggleSave={toggleSave}\r\n          session={session}\r\n          myProfile={myProfile}\r\n          notify={notify}\r\n          onUser={()=>{}}\r\n          onOpenComments={(p,onPhotoCb)=>{setPhotoCommentPost(p);setPhotoCloseCallback(()=>onPhotoCb);}}\r\n          myConnections={myConnections}\r\n          onConnect={()=>{}}\r\n        />`,
    replace: `posts={uPosts.filter(p=>!(p.img&&(/\\.(mp4|mov|webm|ogg|avi)(\\?|$)/i.test(p.img)||p.img.includes("video"))))}\r\n          sb={sb}\r\n          startIndex={photoViewerIndex}\r\n          onClose={()=>setPhotoViewerIndex(null)}\r\n          toggleLike={localToggleLike}\r\n          toggleSave={toggleSave}\r\n          session={session}\r\n          myProfile={myProfile}\r\n          notify={notify}\r\n          onUser={()=>{}}\r\n          onOpenComments={(p,onPhotoCb)=>{setPhotoCommentPost(p);setPhotoCloseCallback(()=>onPhotoCb);}}\r\n          myConnections={myConnections}\r\n          onConnect={()=>{}}\r\n          onOpenSound={setOpenSoundId}\r\n        />`,
  },
  {
    name: "OrgView — onOpenSound sur PhotoViewer",
    search: `posts={uPosts.filter(p=>!(p.img&&(/\\.(mp4|mov|webm|ogg|avi)(\\?|$)/i.test(p.img)||p.img.includes("video")))&&(p.img||(p.media_urls&&p.media_urls.length>0)))}\r\n          sb={sb}\r\n          startIndex={photoViewerIndex}\r\n          onClose={()=>setPhotoViewerIndex(null)}\r\n          toggleLike={toggleLike}\r\n          toggleSave={toggleSave}\r\n          session={session}\r\n          myProfile={myProfile}\r\n          notify={notify}\r\n          onUser={()=>{}}\r\n          onOpenComments={(p,onPhotoCb)=>{setPhotoCommentPost(p);setPhotoCloseCallback(()=>onPhotoCb);}}\r\n          myConnections={myConnections}\r\n          onConnect={()=>{}}\r\n        />`,
    replace: `posts={uPosts.filter(p=>!(p.img&&(/\\.(mp4|mov|webm|ogg|avi)(\\?|$)/i.test(p.img)||p.img.includes("video")))&&(p.img||(p.media_urls&&p.media_urls.length>0)))}\r\n          sb={sb}\r\n          startIndex={photoViewerIndex}\r\n          onClose={()=>setPhotoViewerIndex(null)}\r\n          toggleLike={toggleLike}\r\n          toggleSave={toggleSave}\r\n          session={session}\r\n          myProfile={myProfile}\r\n          notify={notify}\r\n          onUser={()=>{}}\r\n          onOpenComments={(p,onPhotoCb)=>{setPhotoCommentPost(p);setPhotoCloseCallback(()=>onPhotoCb);}}\r\n          myConnections={myConnections}\r\n          onConnect={()=>{}}\r\n          onOpenSound={setOpenSoundId}\r\n        />`,
  },
  {
    name: "LikedPostsTab — onOpenSound sur PhotoViewer",
    search: `onUser={()=>{}} onOpenComments={(p,onPhotoCb)=>{setPhotoCommentPost(p);setPhotoCloseCallback(()=>onPhotoCb);}} myConnections={myConnections} onConnect={()=>{}}/>`,
    replace: `onUser={()=>{}} onOpenComments={(p,onPhotoCb)=>{setPhotoCommentPost(p);setPhotoCloseCallback(()=>onPhotoCb);}} myConnections={myConnections} onConnect={()=>{}} onOpenSound={setOpenSoundId}/>`,
  },
  {
    name: "ProfileTab — onOpenSound sur PhotoViewer",
    search: `onUser={()=>{}}\r\n    onOpenComments={(p,onPhotoCb)=>{setPhotoCommentPost(p);setPhotoCloseCallback(()=>onPhotoCb);}}\r\n    myConnections={myConnections}\r\n    onConnect={()=>{}}\r\n  />`,
    replace: `onUser={()=>{}}\r\n    onOpenComments={(p,onPhotoCb)=>{setPhotoCommentPost(p);setPhotoCloseCallback(()=>onPhotoCb);}}\r\n    myConnections={myConnections}\r\n    onConnect={()=>{}}\r\n    onOpenSound={setOpenSoundId}\r\n  />`,
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
