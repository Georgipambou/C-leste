// CommentsSection — extrait depuis App.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Heart, Trash2, Reply, Image, X } from "lucide-react";
import { sb } from "../lib/supabase";
import { useApp } from "../AppContext";
import { uploadToR2 } from "../uploadMedia";

function CommentsSection({postId,sessionUserId,getM,onCountChange,targetCommentId}){
 const {setHideNav,members}=useApp();
 const [comments,setComments]=useState([]);
  const [loadingCmts,setLoadingCmts]=useState(true);
  const [hasMoreCmts,setHasMoreCmts]=useState(false);
  const [cmtPage,setCmtPage]=useState(1);
  const [text,setText]=useState("");
  const [posting,setPosting]=useState(false);
  const [mediaFile,setMediaFile]=useState(null);
  const [mediaPreview,setMediaPreview]=useState(null);
const mentionedIdsRef=useRef([]);
  const textareaRef=useRef(null);
  const imgRef=useRef(null);

  useEffect(()=>{
    const ta=textareaRef.current;
    if(ta){ta.style.height="auto";ta.style.height=Math.min(ta.scrollHeight,140)+"px";}
  },[text]);

 const load=useCallback(async(page=1)=>{
    setLoadingCmts(true);
   const from=(page-1)*30,to=from+29;
    const{data}=await sb.from("comments")
      .select("id,post_id,author_id,text,media_url,created_at,author:profiles!comments_author_id_fkey(id,prenom,nom,avatar_url,badge)")
      .eq("post_id",postId)
      .order("created_at",{ascending:true})
      .range(from,to);
    if(page===1)setComments(data||[]);
    else setComments(prev=>[...prev,...(data||[])]);
    onCountChange?.((data||[]).length);
    setLoadingCmts(false);
    setHasMoreCmts((data||[]).length===30);
  },[postId,onCountChange]);

  useEffect(()=>{load(1);setCmtPage(1);},[load]);
  const targetRef=useRef(null);
useEffect(()=>{
  if(targetRef.current){
    setTimeout(()=>{
      targetRef.current?.scrollIntoView({behavior:"smooth",block:"center"});
    },400);
  }
},[comments]);

  useEffect(()=>{
    const ch=sb.channel(`comments-${postId}-${Math.random()}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"comments",filter:`post_id=eq.${postId}`},load)
      .subscribe();
    return()=>sb.removeChannel(ch);
  },[postId,load]);

  const submit=async()=>{
    if((!text.trim()&&!mediaFile)||posting)return;
    setPosting(true);
    const trimmed=text.trim();
    let mediaUrl=null;
    if(mediaFile){
     try {
  mediaUrl = await uploadToR2(mediaFile, "comments");
} catch(e) {
  console.error("Erreur upload commentaire:", e);
}
    }
   const uid=(await sb.auth.getUser())?.data?.user?.id;
const{error}=await sb.from("comments").insert({post_id:postId,author_id:uid,text:trimmed,media_url:mediaUrl});
    if(!error){
      await sb.rpc("increment_phase_interactions",{post_id:postId});
      setText("");
      setMediaFile(null);
      setMediaPreview(null);
      load();
      // Notifier l'auteur du post
const{data:postData}=await sb.from("posts").select("author_id").eq("id",postId).single();
if(postData?.author_id&&postData.author_id!==uid){
  await sb.from("notifications").insert({
    user_id:postData.author_id,
    from_id:uid,
    type:"comment",
    post_id:postId,
    read:false
  });
}
      
      const uniqueIds=[...new Set(mentionedIdsRef.current)].filter(id=>id!==uid);
const myPrenom=getM?.(uid)?.prenom||"Quelqu'un";
for(const mentionedId of uniqueIds){
  try{
    await sb.from("notifications").insert({user_id:mentionedId,from_id:uid,type:"mention",post_id:postId,read:false});
    sb.functions.invoke('send-push',{body:{targetUserId:mentionedId,title:"✦ Mention",body:`${myPrenom} t'a mentionné dans un commentaire`}});
  }catch(e){
    console.error("Erreur notification mention:",e);
  }
}
mentionedIdsRef.current=[];
    }
    setPosting(false);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14,padding:"4px 0"}}>
      {loadingCmts&&<div style={{display:"flex",justifyContent:"center",padding:"16px 0"}}><div style={{width:20,height:20,border:`2px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin .7s linear infinite"}}/></div>}
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {comments.map(c=>(
  <div key={c.id} ref={targetCommentId===c.id?targetRef:null}
    style={{borderRadius:12,transition:"background .5s",
      background:targetCommentId===c.id?"rgba(201,149,42,0.12)":"transparent"}}>
    <CommentItem comment={c} sessionUserId={sessionUserId} getM={getM} onChange={load} members={members}/>
  </div>
))}
    
      </div>
     {mediaPreview&&(
        <div style={{position:"relative",marginBottom:6}}>
          <img src={mediaPreview} alt="" style={{width:"100%",maxHeight:160,objectFit:"cover",borderRadius:14}}/>
          <Btn onClick={()=>{setMediaPreview(null);setMediaFile(null);}} style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.7)",borderRadius:"50%",width:26,height:26,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={12}/></Btn>
        </div>
      )}
      {hasMoreCmts&&<Btn onClick={()=>{const next=cmtPage+1;setCmtPage(next);load(next);}} style={{width:"100%",padding:"10px 0",color:T.muted,fontSize:12,textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
  <div style={{width:16,height:1,background:T.border,borderRadius:1}}/>
  Voir plus de commentaires
  <div style={{width:16,height:1,background:T.border,borderRadius:1}}/>
</Btn>}

      <div style={{display:"flex",alignItems:"flex-end",gap:8,padding:"8px 12px",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:24,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",boxShadow:"0 4px 20px rgba(0,0,0,0.2)",position:"sticky",bottom:0,zIndex:10}}>
        <input ref={imgRef} type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
          const f=e.target.files[0];if(!f)return;
          const compressed=await compressImage(f);
          const r=new FileReader();r.onload=ev=>setMediaPreview(ev.target.result);r.readAsDataURL(compressed);
          setMediaFile(compressed);
          e.target.value="";
        }}/>
        <Btn onClick={()=>imgRef.current.click()} style={{color:mediaFile?T.goldL:T.muted,padding:"4px",display:"flex",alignItems:"center",flexShrink:0,transition:"color .2s"}}>
          <Camera size={18}/>
        </Btn>
        <MentionInput
          value={text}
          onChange={(val,mentionedId)=>{setText(val);if(mentionedId&&!mentionedIdsRef.current.includes(mentionedId))mentionedIdsRef.current=[...mentionedIdsRef.current,mentionedId];}}
          placeholder="Ajouter un commentaire..."
          members={members||[]}
          onFocus={()=>setHideNav(true)}
          onBlur={()=>setHideNav(false)}
        />
        <Btn onClick={submit} disabled={posting||(!text.trim()&&!mediaFile)} style={{background:(text.trim()||mediaFile)?T.gradGold:"rgba(255,255,255,0.05)",borderRadius:"50%",width:34,height:34,color:(text.trim()||mediaFile)?"#000":T.muted,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.25s cubic-bezier(0.4,0,0.2,1)",flexShrink:0,marginBottom:2}}>
          <Send size={13} style={{transform:"translateX(0.5px)"}}/>
        </Btn>
      </div>
    </div>
  );
}

function CommentItem({comment,sessionUserId,getM,onChange,members}){
  const [likes,setLikes]=useState(0);
  const [liked,setLiked]=useState(false);
  const [replies,setReplies]=useState([]);
  const [showReplies,setShowReplies]=useState(false);
  const [replyText,setReplyText]=useState("");
  const [replying,setReplying]=useState(false);
  const isMine=comment.author_id===sessionUserId;
  const author=comment.author?normProfile(comment.author):getM(comment.author_id);

  const loadMeta=useCallback(async()=>{
    const[{count:lc},{data:ml},{data:rep}]=await Promise.all([
      sb.from("comment_likes").select("*",{count:"exact",head:true}).eq("comment_id",comment.id),
      sb.from("comment_likes").select("id").eq("comment_id",comment.id).eq("user_id",sessionUserId).maybeSingle(),
      sb.from("comment_replies").select("*, author:profiles(*)").eq("parent_comment_id",comment.id).order("created_at"),
    ]);
    setLikes(lc||0);setLiked(!!ml);setReplies(rep||[]);
  },[comment.id,sessionUserId]);

  useEffect(()=>{loadMeta();},[loadMeta]);

  const toggleLike=async()=>{
    if(liked){
      await sb.from("comment_likes").delete().eq("comment_id",comment.id).eq("user_id",sessionUserId);
      setLiked(false);setLikes(l=>l-1);
    } else {
      await sb.from("comment_likes").insert({comment_id:comment.id,user_id:sessionUserId});
      setLiked(true);setLikes(l=>l+1);
      // Notifier l'auteur du commentaire
      if(comment.author_id&&comment.author_id!==sessionUserId){
        await sb.from("notifications").insert({
          user_id:comment.author_id,
          from_id:sessionUserId,
          type:"comment_like",
          post_id:comment.post_id||null,
          comment_id:comment.id,
          read:false
        });
      }
    }
  };

  const submitReply=async()=>{
    if(!replyText.trim())return;
    const text=replyText.trim();
    setReplyText("");setReplying(false);
    await sb.from("comment_replies").insert({parent_comment_id:comment.id,author_id:sessionUserId,text});
    // Notifier l'auteur du commentaire
    if(comment.author_id&&comment.author_id!==sessionUserId){
      await sb.from("notifications").insert({
        user_id:comment.author_id,
        from_id:sessionUserId,
        type:"reply",
        post_id:comment.post_id||null,
        comment_id:comment.id,
        read:false
      });
    }
    loadMeta();setShowReplies(true);
  };

  const [showCmtMenu,setShowCmtMenu]=useState(false);
  const del=async()=>{
    setShowCmtMenu(false);
    if(!window.confirm("Supprimer ?"))return;
    await sb.from("comments").delete().eq("id",comment.id);
    onChange?.();
  };
  const copy=()=>{
    navigator.clipboard?.writeText(comment.text||"");
    setShowCmtMenu(false);
  };

  return(
    <div style={{display:"flex",gap:10,paddingBottom:4}}>
      {/* Colonne gauche : avatar + ligne verticale */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
        <Av u={author} size={36} onClick={()=>window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:author?.id}}))}/>
        {(replies.length>0||replying)&&(
          <div style={{width:2,flex:1,minHeight:16,background:"rgba(255,255,255,0.1)",borderRadius:2,marginTop:4}}/>
        )}
      </div>

      {/* Colonne droite : contenu */}
      <div style={{flex:1,minWidth:0,overflow:"hidden"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:13,fontWeight:700,color:T.text}}>{author?.name||"?"}</span>
            <span style={{fontSize:11,color:T.muted}}>{ago(comment.created_at)}</span>
          </div>
          {(isMine||comment.text)&&(
            <div style={{position:"relative"}}>
              <Btn onClick={()=>setShowCmtMenu(m=>!m)} style={{color:T.muted,padding:4,display:"flex",alignItems:"center"}}><MoreHorizontal size={16}/></Btn>
              {showCmtMenu&&(
                <div style={{position:"absolute",right:0,top:24,background:T.bg3,border:`1px solid ${T.border}`,borderRadius:14,padding:6,zIndex:50,minWidth:140,boxShadow:"0 8px 30px rgba(0,0,0,0.4)"}}>
                  {comment.text&&<Btn onClick={copy} style={{width:"100%",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,color:T.text,fontSize:13,textAlign:"left"}}>📋 Copier</Btn>}
                  {isMine&&<Btn onClick={del} style={{width:"100%",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,color:T.err,fontSize:13,textAlign:"left"}}>🗑 Supprimer</Btn>}
                </div>
              )}
            </div>
          )}
        </div>

       {/* Texte */}
        {comment.text&&<><p style={{margin:"0 0 4px",fontSize:14,color:T.text,lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word",overflowWrap:"break-word"}}>{renderTextWithMentions(comment.text,username=>{const m=(members||[]).find(u=>u.name?.toLowerCase().startsWith(username.toLowerCase())||u.fullName?.toLowerCase().includes(username.toLowerCase()));if(m)window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:m.id}}));})}</p><TranslateBtn text={comment.text}/></>}
{comment.media_url&&(
  <div style={{marginBottom:8,borderRadius:10,overflow:"hidden",maxWidth:200}}>
    <MediaPlayer url={comment.media_url} style={{borderRadius:10,maxHeight:160}} onImageClick={url=>window.dispatchEvent(new CustomEvent("celeste_view_img",{detail:{url}}))}/>
  </div>
)}

        {/* Actions style Threads */}
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:8}}>
          <Btn onClick={toggleLike} style={{display:"flex",alignItems:"center",gap:5,color:liked?T.err:T.muted,fontSize:12}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={liked?"currentColor":"none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            {likes>0&&<span>{likes}</span>}
          </Btn>
          <Btn onClick={()=>setReplying(r=>!r)} style={{display:"flex",alignItems:"center",gap:5,color:T.muted,fontSize:12}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {replies.length>0&&<span>{replies.length}</span>}
          </Btn>
        </div>

        {/* Champ réponse */}
        {replying&&(
          <div style={{display:"flex",gap:8,alignItems:"flex-end",marginBottom:10}}>
            <textarea autoFocus rows={1} value={replyText}
              onChange={e=>{setReplyText(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,100)+"px";}}
              placeholder={`Répondre à ${author?.name||""}…`}
              style={{flex:1,background:"rgba(255,255,255,0.05)",border:`1px solid ${T.border}`,borderRadius:16,padding:"8px 14px",color:T.text,fontSize:13,outline:"none",resize:"none",lineHeight:1.4,maxHeight:100,fontFamily:"inherit"}}/>
            <Btn onClick={submitReply} disabled={!replyText.trim()} style={{background:replyText.trim()?T.gradGold:"rgba(255,255,255,0.05)",borderRadius:"50%",width:32,height:32,color:replyText.trim()?"#000":T.muted,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Send size={13}/>
            </Btn>
          </div>
        )}

        {/* Réponses */}
        {replies.length>0&&(
          <Btn onClick={()=>setShowReplies(s=>!s)} style={{fontSize:12,color:T.muted,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:16,height:1,background:T.muted,borderRadius:1}}/>
            {showReplies?`Masquer les réponses`:`Voir ${replies.length} réponse${replies.length>1?"s":""}`}
          </Btn>
        )}

        {showReplies&&(
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:8}}>
            {replies.map(r=>{
              const ra=r.author?normProfile(r.author):{initials:"?",color:"#888",name:"?"};
              const isMyReply=r.author_id===sessionUserId;
              return(
                <div key={r.id} style={{display:"flex",gap:10}}>
                  <Av u={ra} size={28}/>
                  <div style={{flex:1,minWidth:0,overflow:"hidden"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                      <span style={{fontSize:12,fontWeight:700,color:T.text}}>{ra.name}</span>
                      <span style={{fontSize:11,color:T.muted}}>{ago(r.created_at)}</span>
                      {isMyReply&&<Btn onClick={async()=>{if(!window.confirm("Supprimer ?"))return;await sb.from("comment_replies").delete().eq("id",r.id);loadMeta();}} style={{color:T.muted,padding:2,marginLeft:"auto",display:"flex"}}><MoreHorizontal size={14}/></Btn>}
                    </div>
                    <p style={{margin:0,fontSize:13,color:T.text,lineHeight:1.6,wordBreak:"break-word",overflowWrap:"break-word"}}>{r.text}</p>
                    <TranslateBtn text={r.text}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default CommentsSection;
