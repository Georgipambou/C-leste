const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.jsx');
let code = fs.readFileSync(filePath, 'utf8');
// Normaliser les fins de ligne
code = code.replace(/\r\n/g, '\n');
let count = 0;

// 1. Signature UserView
const uv_sig_old = `function UserView({user,myProfile,session,posts,onBack,onChat,notify,myConnections,myFollowers,onConnectionChange,onImageView,userPostsVersion=0}){`;
const uv_sig_new = `function UserView({user,myProfile,session,posts,onBack,onChat,notify,myConnections,myFollowers,onConnectionChange,onImageView,userPostsVersion=0,toggleLike,toggleSave}){`;
if (code.includes(uv_sig_old)) {
  code = code.replace(uv_sig_old, uv_sig_new);
  count++; console.log('✓ 1/4 Signature UserView mise à jour.');
} else { console.log('✗ 1/4 ÉCHEC'); }

// 2. États reels dans UserView
const uposts_old = `  const [uPosts,setUPosts]=useState((posts||[]).filter(p=>p.by===user.id));`;
const uposts_new = `  const [uPosts,setUPosts]=useState((posts||[]).filter(p=>p.by===user.id));
  const [userReelsIndex,setUserReelsIndex]=useState(null);
  const [userReelsCommentPost,setUserReelsCommentPost]=useState(null);
  const [userReelsCloseCallback,setUserReelsCloseCallback]=useState(null);`;
if (code.includes(uposts_old)) {
  code = code.replace(uposts_old, uposts_new);
  count++; console.log('✓ 2/4 États ReelsViewer ajoutés dans UserView.');
} else { console.log('✗ 2/4 ÉCHEC'); }

// 3. Remplacer bloc PostDetailModal UserView
const modal_old = `      {showReport&&<ReportModal onClose={()=>setShowReport(false)} onSubmit={handleReport}/>}
      {detailPost&&(
        <PostDetailModal post={detailPost} myProfile={myProfile} session={session}
          getM={id=>id===user.id?user:myProfile}
          onClose={()=>setDetailPost(null)}
          onLike={async pid=>{const liked=(detailPost.likes||[]).includes(session?.user?.id);if(liked)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",session?.user?.id);else await sb.from("likes").insert({post_id:pid,user_id:session?.user?.id});const u=await refreshPost(pid);if(u)setDetailPost(u);}}
          onComment={async()=>{const u=await refreshPost(detailPost.id);if(u)setDetailPost(u);}}
          notify={notify}/>
      )}`;
const modal_new = `      {showReport&&<ReportModal onClose={()=>setShowReport(false)} onSubmit={handleReport}/>}
      {userReelsIndex!==null&&toggleLike&&toggleSave&&(
        <ReelsViewer
          posts={uPosts.filter(p=>p.img&&(/\\.(mp4|mov|webm|ogg|avi)(\\?|$)/i.test(p.img)||p.img.includes("video")))}
          startIndex={userReelsIndex}
          onClose={()=>setUserReelsIndex(null)}
          toggleLike={toggleLike}
          toggleSave={toggleSave}
          session={session}
          myProfile={myProfile}
          notify={notify}
          onUser={()=>{}}
          onOpenComments={(p,onReelsCb)=>{setUserReelsCommentPost(p);setUserReelsCloseCallback(()=>onReelsCb);setDetailPost(p);}}
          myConnections={myConnections}
          onConnect={()=>{}}
        />
      )}
      {detailPost&&(
        <PostDetailModal post={detailPost} myProfile={myProfile} session={session}
          getM={id=>id===user.id?user:myProfile}
          zIndex={userReelsCommentPost?1300:800}
          fromReel={!!userReelsCommentPost}
          onClose={()=>{setDetailPost(null);setUserReelsCommentPost(null);if(userReelsCloseCallback){userReelsCloseCallback();setUserReelsCloseCallback(null);}}}
          onLike={async pid=>{const liked=(detailPost.likes||[]).includes(session?.user?.id);if(liked)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",session?.user?.id);else await sb.from("likes").insert({post_id:pid,user_id:session?.user?.id});const u=await refreshPost(pid);if(u)setDetailPost(u);}}
          onComment={async()=>{const u=await refreshPost(detailPost.id);if(u)setDetailPost(u);}}
          notify={notify}/>
      )}`;
if (code.includes(modal_old)) {
  code = code.replace(modal_old, modal_new);
  count++; console.log('✓ 3/4 ReelsViewer ajouté dans UserView.');
} else { console.log('✗ 3/4 ÉCHEC — ancre PostDetailModal non trouvée.'); }

// 4. Clic grille → ReelsViewer si vidéo
const grid_old = `              <div key={p.id} style={{aspectRatio:"1/1",overflow:"hidden",background:T.card,position:"relative",cursor:"pointer"}} onClick={()=>setDetailPost(p)}>`;
const grid_new = `              <div key={p.id} style={{aspectRatio:"1/1",overflow:"hidden",background:T.card,position:"relative",cursor:"pointer"}} onClick={()=>{
                const isVid=p.img&&(/\\.(mp4|mov|webm|ogg|avi)(\\?|$)/i.test(p.img)||p.img.includes("video"));
                if(isVid&&toggleLike&&toggleSave){
                  const vidPosts=uPosts.filter(q=>q.img&&(/\\.(mp4|mov|webm|ogg|avi)(\\?|$)/i.test(q.img)||q.img.includes("video")));
                  const idx=vidPosts.findIndex(q=>q.id===p.id);
                  setUserReelsIndex(idx>=0?idx:0);
                }else{setDetailPost(p);}
              }}>`;
if (code.includes(grid_old)) {
  code = code.replace(grid_old, grid_new);
  count++; console.log('✓ 4/4 Clic grille → ReelsViewer si vidéo.');
} else { console.log('✗ 4/4 ÉCHEC — ancre grille non trouvée.'); }

// bonus : passer toggleLike/toggleSave à UserView depuis App
const uv_call_old = `:<UserView user={openUser} myProfile={myProfile} session={session} posts={posts} onBack={()=>setOpenUserId(null)} onChat={openChat} notify={notify} myConnections={myConnections} myFollowers={myFollowers} onConnectionChange={()=>{loadConnections(session?.user?.id);loadBlockedUsers();}} onImageView={setViewImg} userPostsVersion={userPostsVersion}/>`;
const uv_call_new = `:<UserView user={openUser} myProfile={myProfile} session={session} posts={posts} onBack={()=>setOpenUserId(null)} onChat={openChat} notify={notify} myConnections={myConnections} myFollowers={myFollowers} onConnectionChange={()=>{loadConnections(session?.user?.id);loadBlockedUsers();}} onImageView={setViewImg} userPostsVersion={userPostsVersion} toggleLike={async pid=>{const post=(posts||[]).find(p=>p.id===pid);if(!post)return;const uid=session?.user?.id;const liked=(post.likes||[]).some(l=>(l.user_id||l)===uid);if(liked)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",uid);else await sb.from("likes").insert({post_id:pid,user_id:uid});}} toggleSave={async pid=>{const{data:ex}=await sb.from("saved_posts").select("id").eq("post_id",pid).eq("user_id",session?.user?.id).maybeSingle();if(ex)await sb.from("saved_posts").delete().eq("post_id",pid).eq("user_id",session?.user?.id);else await sb.from("saved_posts").insert({post_id:pid,user_id:session?.user?.id});}}/>`;
if (code.includes(uv_call_old)) {
  code = code.replace(uv_call_old, uv_call_new);
  console.log('✓ bonus : toggleLike/toggleSave passés à UserView.');
} else { console.log('✗ bonus : ancre appel UserView non trouvée.'); }

fs.writeFileSync(filePath, code, 'utf8');
console.log(`\n${count}/4 modifications appliquées. Fichier sauvegardé.`);
