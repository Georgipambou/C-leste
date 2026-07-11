// fix-navstack.cjs
// Corrige le bug "ça se ferme puis rouvre l'ancien écran" :
// pushNav() empile une fonction de fermeture à l'ouverture, mais rien ne la
// retirait à la fermeture manuelle (bouton "X"/backdrop) — seul le bouton
// retour physique dépilait. Ce script ajoute popNav() et synchronise
// toutes les fermetures manuelles concernées avec la pile.
//
// Usage : node fix-navstack.cjs
// (lance ce script depuis le dossier qui contient src/App.jsx,
//  ou ajuste APP_PATH ci-dessous)

const fs = require("fs");
const path = require("path");

const APP_PATH = path.join(__dirname, "src", "App.jsx");

let content = fs.readFileSync(APP_PATH, "utf8");
let appliedCount = 0;
let missedCount = 0;

function replaceOnce(label, oldStr, newStr) {
  if (!content.includes(oldStr)) {
    console.log(`❌ NON TROUVÉ — ${label}`);
    missedCount++;
    return;
  }
  const count = content.split(oldStr).length - 1;
  if (count > 1) {
    console.log(`⚠️  ${label} — trouvé ${count} fois (attendu 1), remplacement de la 1ère occurrence seulement. Vérifie les autres à la main.`);
  }
  content = content.replace(oldStr, newStr);
  console.log(`✅ ${label}`);
  appliedCount++;
}

// 1. Ajout de popNav() juste après pushNav()
replaceOnce(
  "1. Définition de popNav()",
  `const pushNav = useCallback((closeFn) => { navStack.current.push(closeFn); }, []);`,
  "const pushNav = useCallback((closeFn) => { navStack.current.push(closeFn); }, []);\r\nconst popNav = useCallback(() => { navStack.current.pop(); }, []);"
);

// 2. Fermeture du visualiseur de statuts (StatusesTab)
replaceOnce(
  "2. Fermeture visualiseur de statuts",
  `onClose={()=>{setViewing(null);load();setHideNav(false);}}`,
  `onClose={()=>{popNav();setViewing(null);load();setHideNav(false);}}`
);

// 3. Fermeture création de statut
replaceOnce(
  "3. Fermeture création de statut",
  `onClose={()=>{setCreating(false);setHideNav(false);}} onDone={()=>{setCreating(false);load();notify("Statut publié ✦");setHideNav(false);}}/>`,
  `onClose={()=>{popNav();setCreating(false);setHideNav(false);}} onDone={()=>{popNav();setCreating(false);load();notify("Statut publié ✦");setHideNav(false);}}/>`
);

// 4. Fermeture ReelsViewer (HomeTab)
replaceOnce(
  "4. Fermeture ReelsViewer (HomeTab)",
  `onClose={()=>setReelsIndex(null)}`,
  `onClose={()=>{popNav();setReelsIndex(null);}}`
);

// 5. Fermeture PhotoViewer (HomeTab)
replaceOnce(
  "5. Fermeture PhotoViewer (HomeTab)",
  `onClose={()=>setPhotoIndex(null)}`,
  `onClose={()=>{popNav();setPhotoIndex(null);}}`
);

// 6. Fermeture PostDetailModal (HomeTab) — le gros handler avec savedScroll
replaceOnce(
  "6. Fermeture PostDetailModal (HomeTab)",
  "          onClose={()=>{\r\n            const pos=savedScroll.current;\r\n            setDetailPost(null);",
  "          onClose={()=>{\r\n            popNav();\r\n            const pos=savedScroll.current;\r\n            setDetailPost(null);"
);

// 7. Fermeture PostDetailModal (UserView)
replaceOnce(
  "7. Fermeture PostDetailModal (UserView)",
  `onClose={()=>{setDetailPost(null);setUserReelsCommentPost(null);if(userReelsCloseCallback){userReelsCloseCallback();setUserReelsCloseCallback(null);}}}`,
  `onClose={()=>{popNav();setDetailPost(null);setUserReelsCommentPost(null);if(userReelsCloseCallback){userReelsCloseCallback();setUserReelsCloseCallback(null);}}}`
);

// 8. Fermeture NewPostModal
replaceOnce(
  "8. Fermeture NewPostModal",
  `onClose={()=>setShowNewPost(false)}`,
  `onClose={()=>{popNav();setShowNewPost(false);}}`
);

// 9. Fermeture AdminPanel
replaceOnce(
  "9. Fermeture AdminPanel",
  `onClose={()=>setShowAdmin(false)}`,
  `onClose={()=>{popNav();setShowAdmin(false);}}`
);

// 10. Fermeture CelesteChatScreen
replaceOnce(
  "10. Fermeture CelesteChatScreen",
  `onClose={()=>setOpenCeleste(false)}`,
  `onClose={()=>{popNav();setOpenCeleste(false);}}`
);

// 11. Fermeture notifications — backdrop
replaceOnce(
  "11. Fermeture notifications (backdrop)",
  `background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}} onClick={()=>setShowNotifs(false)}>`,
  `background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}} onClick={()=>{popNav();setShowNotifs(false);}}>`
);

// 12. Toggle notifications (bouton cloche) — pop quand on referme via le même bouton
replaceOnce(
  "12. Toggle notifications (bouton cloche)",
  `onClick={()=>{if(!showNotifs)pushNav(()=>setShowNotifs(false));setShowNotifs(s=>!s);}}`,
  `onClick={()=>{if(!showNotifs){pushNav(()=>setShowNotifs(false));}else{popNav();}setShowNotifs(s=>!s);}}`
);

// 13. Fermeture profil consulté — OrgView
replaceOnce(
  "13. Fermeture profil (OrgView)",
  `<OrgView user={openUser} myProfile={myProfile} session={session} posts={posts} onBack={()=>setOpenUserId(null)}`,
  `<OrgView user={openUser} myProfile={myProfile} session={session} posts={posts} onBack={()=>{popNav();setOpenUserId(null);}}`
);

// 14. Fermeture profil consulté — UserView
replaceOnce(
  "14. Fermeture profil (UserView)",
  `<UserView user={openUser} myProfile={myProfile} session={session} posts={posts} onBack={()=>setOpenUserId(null)}`,
  `<UserView user={openUser} myProfile={myProfile} session={session} posts={posts} onBack={()=>{popNav();setOpenUserId(null);}}`
);

// 15. Fermeture conversation (ChatScreen)
replaceOnce(
  "15. Fermeture conversation (ChatScreen)",
  `onBack={()=>setOpenConvId(null)}`,
  `onBack={()=>{popNav();setOpenConvId(null);}}`
);

// 16. Fermeture PostDetailModal (racine — liens profonds notifications)
replaceOnce(
  "16. Fermeture PostDetailModal (racine CelesteApp)",
  `{detailPost&&<PostDetailModal post={detailPost} myProfile={myProfile} session={session} getM={getM} onClose={()=>setDetailPost(null)} onLike={async pid=>{await sb.from("likes").upsert({post_id:pid,user_id:session?.user?.id},{onConflict:"post_id,user_id",ignoreDuplicates:true});const u=await refreshPost(pid);if(u)setDetailPost(u);}} onComment={async()=>{const u=await refreshPost(detailPost.id);if(u)setDetailPost(u);}} notify={notify}/>}`,
  `{detailPost&&<PostDetailModal post={detailPost} myProfile={myProfile} session={session} getM={getM} onClose={()=>{popNav();setDetailPost(null);}} onLike={async pid=>{await sb.from("likes").upsert({post_id:pid,user_id:session?.user?.id},{onConflict:"post_id,user_id",ignoreDuplicates:true});const u=await refreshPost(pid);if(u)setDetailPost(u);}} onComment={async()=>{const u=await refreshPost(detailPost.id);if(u)setDetailPost(u);}} notify={notify}/>}`
);

fs.writeFileSync(APP_PATH, content, "utf8");

console.log("\n──────────────────────────────");
console.log(`${appliedCount} remplacement(s) appliqué(s), ${missedCount} non trouvé(s).`);
if (missedCount > 0) {
  console.log("Les non-trouvés n'ont probablement pas bougé depuis mon audit — copie-colle-moi les lignes concernées si besoin, ou vérifie que ton fichier est bien à jour.");
}
console.log("N'oublie pas : relance `npm run dev` et teste (ouvrir/fermer une photo, un reel, un profil, puis appuyer sur le bouton retour physique) avant de commit.");
