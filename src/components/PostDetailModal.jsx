// PostDetailModal — extrait depuis App.jsx
import React, { useState, useEffect } from "react";
import { X, Heart, Bookmark, Share2, ChevronLeft, ChevronRight } from "lucide-react";
import { sb } from "../lib/supabase";
import { useApp } from "../AppContext";

function PostDetailModal({post,myProfile,session,getM,onClose,onLike,onComment,notify,zIndex=800,fromReel=false}){
const {members}=useApp();
useEffect(()=>{
  if(post?.author?.screenshot_protection)enableScreenProtection();else disableScreenProtection();
  const ch=sb.channel(`privacy_post_${post?.by}-${Math.random()}`)
    .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles",filter:`id=eq.${post?.by}`},payload=>{
      if(payload.new?.screenshot_protection)enableScreenProtection();else disableScreenProtection();
    })
    .subscribe();
  return()=>{sb.removeChannel(ch);disableScreenProtection();};
},[post?.by]);
const [viewImg,setViewImg]=useState(null);
const [openCeleste,setOpenCeleste]=useState(false);
const [celesteMsgs,setCelesteMsgs]=useState([]);
const [cmtCount,setCmtCount]=useState((post.comments||[]).length);
const [views,setViews]=useState(0);
const [slideIdx,setSlideIdx]=useState(0);

useEffect(()=>{
  if(!post?.id||!session?.user?.id)return;
  sb.from("post_views").upsert(
    {post_id:post.id,viewer_id:session.user.id},
    {onConflict:"post_id,viewer_id",ignoreDuplicates:true}
  ).then(()=>{
    sb.from("post_views").select("*",{count:"exact",head:true}).eq("post_id",post.id)
      .then(({count})=>setViews(count||0));
  });
},[post?.id,session?.user?.id]);

  const swipeStartRef=useRef(null);
  const bottomRef=useRef();
  const auth=post.author||getM(post.by);
  const liked=(post.likes||[]).includes(session?.user?.id);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[]);

  return(
    <>
      {viewImg&&<ImageViewer url={viewImg} onClose={()=>setViewImg(null)}/>}
      <div style={{position:"fixed",inset:0,zIndex:zIndex,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
        onClick={e=>e.target===e.currentTarget&&onClose()}>
        <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:640,maxHeight:"92vh",display:"flex",flexDirection:"column",animation:"slideUp .35s cubic-bezier(0.34,1.1,0.64,1)",boxShadow:"0 -20px 60px rgba(0,0,0,0.8)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 16px 12px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <Av u={auth} size={38}/>
              <div>
                <p style={{margin:0,fontSize:14,fontWeight:600,color:T.text}}>{auth?.name}</p>
                <p style={{margin:0,fontSize:11,color:T.muted}}>{ago(post.ts)}</p>
              </div>
            </div>
            <Btn onClick={onClose} style={{color:T.muted,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.04)",borderRadius:"50%",border:`1px solid ${T.border}`}}><X size={16}/></Btn>
          </div>
          <div style={{overflowY:"auto",flex:1,padding:"0 16px 16px"}}>
            {post.type==="event"
              ?<div style={{margin:"12px 0",background:T.goldBg,borderRadius:16,padding:16,border:`1px solid ${T.gold}22`}}>
                <p style={{margin:"0 0 6px",fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:T.text}}>{post.title}</p>
                {post.text&&<p style={{margin:"0 0 8px",fontSize:13,color:T.sub,lineHeight:1.7}}>{post.text}</p>}
                {post.eventDate&&<p style={{margin:"0 0 3px",fontSize:12,color:T.gold}}>🗓 {post.eventDate}</p>}
                {post.eventLoc&&<p style={{margin:0,fontSize:12,color:T.sub}}>📍 {post.eventLoc}</p>}
              </div>
              :<>
              {post.text&&<p style={{margin:"12px 0 8px",fontSize:14,color:T.text,lineHeight:1.8,whiteSpace:"pre-line"}}>{renderTextWithMentions(post.text, username=>{const m=(members||[]).find(u=>u.prenom?.toLowerCase()===username.toLowerCase()||u.name?.toLowerCase().startsWith(username.toLowerCase()));if(m)window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:m.id}}));})}</p>}
  {(()=>{
  const allMedia=post.media_urls?.length>0?post.media_urls:(post.img?[post.img]:[]);
  if(allMedia.length===0)return null;
  return(
    <div style={{position:"relative",borderRadius:16,overflow:"hidden",marginBottom:10}}
      onTouchStart={e=>{swipeStartRef.current=e.touches[0].clientX;}}
onTouchEnd={e=>{
  if(swipeStartRef.current===null)return;
  const diff=swipeStartRef.current-e.changedTouches[0].clientX;
  if(diff>50&&slideIdx<allMedia.length-1)setSlideIdx(i=>i+1);
  if(diff<-50&&slideIdx>0)setSlideIdx(i=>i-1);
  swipeStartRef.current=null;
}}>
      {!fromReel&&<MediaPlayer url={allMedia[slideIdx]} onImageClick={setViewImg}/>}
      {allMedia.length>1&&(
        <>
          <div style={{position:"absolute",bottom:8,left:"50%",transform:"translateX(-50%)",display:"flex",gap:4}}>
            {allMedia.map((_,i)=><div key={i} onClick={()=>setSlideIdx(i)} style={{width:i===slideIdx?16:6,height:6,borderRadius:3,background:i===slideIdx?"#fff":"rgba(255,255,255,0.4)",transition:"width .2s",cursor:"pointer"}}/>)}
          </div>
          <div style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.55)",borderRadius:20,padding:"3px 10px",fontSize:11,color:"#fff",fontWeight:700}}>{slideIdx+1}/{allMedia.length}</div>
        </>
      )}
    </div>
  );
})()}
              </>
            }
            <div style={{display:"flex",alignItems:"center",gap:16,padding:"10px 0",borderTop:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`,margin:"10px 0"}}>
              <Btn onClick={()=>onLike(post.id)} style={{display:"flex",alignItems:"center",gap:6,color:liked?T.gold:T.sub,fontSize:13,fontWeight:600,transition:"all .2s"}}>
  <Heart size={18} fill={liked?"currentColor":"none"} style={{color:liked?T.gold:T.muted,animation:liked?"pulse .3s ease":"none"}}/>
  {(post.likes||[]).length}
</Btn>
<span style={{color:T.sub,fontSize:13}}>💬 {cmtCount}</span>
{(myProfile?.badge==="confirmed"||myProfile?.badge==="friend")&&(
  <span style={{color:T.sub,fontSize:13,display:"flex",alignItems:"center",gap:4}}>
    <Eye size={14}/>{views}
  </span>
)}
            </div>
            <CommentsSection
  postId={post.id}
  sessionUserId={session?.user?.id}
  getM={getM}
  onCountChange={setCmtCount}
  targetCommentId={post._targetCommentId||null}
/>
            <div ref={bottomRef}/>
          </div>
        </div>
      </div>
    </>
  );
}

export default PostDetailModal;
