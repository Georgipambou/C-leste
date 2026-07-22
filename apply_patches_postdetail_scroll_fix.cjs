const fs = require("fs");

const file = process.argv[2];
if (!file) { console.error("Usage: node apply_patches_postdetail_scroll_fix.cjs src\\App.jsx"); process.exit(1); }
let src = fs.readFileSync(file, "utf8");

const patches = [
  {
    "name": "Signature CommentsSection — prop standalone",
    "search": "function CommentsSection({postId,sessionUserId,getM,onCountChange,targetCommentId}){\r\n",
    "replace": "function CommentsSection({postId,sessionUserId,getM,onCountChange,targetCommentId,standalone=false}){\r\n"
  },
  {
    "name": "CommentsSection — retour conditionnel (standalone vs intégré)",
    "search": "   return(\r\n    <div style={{display:\"flex\",flexDirection:\"column\",flex:1,minHeight:0}}>\r\n    <div style={{flex:1,minHeight:0,overflowY:\"auto\",display:\"flex\",flexDirection:\"column\",gap:14,padding:\"4px 0\"}}>\r\n      {loadingCmts&&<div style={{display:\"flex\",justifyContent:\"center\",padding:\"16px 0\"}}><div style={{width:20,height:20,border:`2px solid ${T.border}`,borderTopColor:T.gold,borderRadius:\"50%\",animation:\"spin .7s linear infinite\"}}/></div>}\r\n    <div style={{display:\"flex\",flexDirection:\"column\",gap:12}}>\r\n        {comments.map(c=>(\r\n  <div key={c.id} ref={targetCommentId===c.id?targetRef:null}\r\n    style={{borderRadius:12,transition:\"background .5s\",\r\n      background:targetCommentId===c.id?\"rgba(201,149,42,0.12)\":\"transparent\"}}>\r\n    <CommentItem comment={c} sessionUserId={sessionUserId} getM={getM} onChange={load} members={members}/>\r\n  </div>\r\n))}\r\n    \r\n      </div>\r\n     {mediaPreview&&(\r\n        <div style={{position:\"relative\",marginBottom:6}}>\r\n          <img src={mediaPreview} alt=\"\" style={{width:\"100%\",maxHeight:160,objectFit:\"cover\",borderRadius:14}}/>\r\n          <Btn onClick={()=>{setMediaPreview(null);setMediaFile(null);}} style={{position:\"absolute\",top:6,right:6,background:\"rgba(0,0,0,0.7)\",borderRadius:\"50%\",width:26,height:26,color:\"#fff\",display:\"flex\",alignItems:\"center\",justifyContent:\"center\"}}><X size={12}/></Btn>\r\n        </div>\r\n      )}\r\n      {hasMoreCmts&&<Btn onClick={()=>{const next=cmtPage+1;setCmtPage(next);load(next);}} style={{width:\"100%\",padding:\"10px 0\",color:T.muted,fontSize:12,textAlign:\"center\",display:\"flex\",alignItems:\"center\",justifyContent:\"center\",gap:6}}>\r\n  <div style={{width:16,height:1,background:T.border,borderRadius:1}}/>\r\n  Voir plus de commentaires\r\n  <div style={{width:16,height:1,background:T.border,borderRadius:1}}/>\r\n</Btn>}\r\n    </div>\r\n\r\n      <div style={{display:\"flex\",alignItems:\"flex-end\",gap:8,padding:\"8px 12px\",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:24,backdropFilter:\"blur(20px)\",WebkitBackdropFilter:\"blur(20px)\",boxShadow:\"0 -4px 20px rgba(0,0,0,0.25)\",flexShrink:0,marginTop:8}}>\r\n        <input ref={imgRef} type=\"file\" accept=\"image/*\" style={{display:\"none\"}} onChange={async e=>{\r\n          const f=e.target.files[0];if(!f)return;\r\n          const compressed=await compressImage(f);\r\n          const r=new FileReader();r.onload=ev=>setMediaPreview(ev.target.result);r.readAsDataURL(compressed);\r\n          setMediaFile(compressed);\r\n          e.target.value=\"\";\r\n        }}/>\r\n        <Btn onClick={()=>imgRef.current.click()} style={{color:mediaFile?T.goldL:T.muted,padding:\"4px\",display:\"flex\",alignItems:\"center\",flexShrink:0,transition:\"color .2s\"}}>\r\n          <Camera size={18}/>\r\n        </Btn>\r\n        <MentionInput\r\n          value={text}\r\n          onChange={(val,mentionedId)=>{setText(val);if(mentionedId&&!mentionedIdsRef.current.includes(mentionedId))mentionedIdsRef.current=[...mentionedIdsRef.current,mentionedId];}}\r\n          placeholder=\"Ajouter un commentaire...\"\r\n          members={members||[]}\r\n          onFocus={()=>setHideNav(true)}\r\n          onBlur={()=>setTimeout(()=>setHideNav(false),150)}\r\n        />\r\n        <Btn onClick={submit} disabled={posting||(!text.trim()&&!mediaFile)} style={{background:(text.trim()||mediaFile)?T.gradGold:\"rgba(255,255,255,0.05)\",borderRadius:\"50%\",width:34,height:34,color:(text.trim()||mediaFile)?\"#000\":T.muted,display:\"flex\",alignItems:\"center\",justifyContent:\"center\",transition:\"all 0.25s cubic-bezier(0.4,0,0.2,1)\",flexShrink:0,marginBottom:2}}>\r\n          <Send size={13} style={{transform:\"translateX(0.5px)\"}}/>\r\n        </Btn>\r\n      </div>\r\n    </div>\r\n  );\r\n}\r\n",
    "replace": "  return(\r\n    <>\r\n    {(()=>{\r\n    const listContent=(\r\n      <>\r\n      {loadingCmts&&<div style={{display:\"flex\",justifyContent:\"center\",padding:\"16px 0\"}}><div style={{width:20,height:20,border:`2px solid ${T.border}`,borderTopColor:T.gold,borderRadius:\"50%\",animation:\"spin .7s linear infinite\"}}/></div>}\r\n    <div style={{display:\"flex\",flexDirection:\"column\",gap:12}}>\r\n        {comments.map(c=>(\r\n  <div key={c.id} ref={targetCommentId===c.id?targetRef:null}\r\n    style={{borderRadius:12,transition:\"background .5s\",\r\n      background:targetCommentId===c.id?\"rgba(201,149,42,0.12)\":\"transparent\"}}>\r\n    <CommentItem comment={c} sessionUserId={sessionUserId} getM={getM} onChange={load} members={members}/>\r\n  </div>\r\n))}\r\n    \r\n      </div>\r\n     {mediaPreview&&(\r\n        <div style={{position:\"relative\",marginBottom:6}}>\r\n          <img src={mediaPreview} alt=\"\" style={{width:\"100%\",maxHeight:160,objectFit:\"cover\",borderRadius:14}}/>\r\n          <Btn onClick={()=>{setMediaPreview(null);setMediaFile(null);}} style={{position:\"absolute\",top:6,right:6,background:\"rgba(0,0,0,0.7)\",borderRadius:\"50%\",width:26,height:26,color:\"#fff\",display:\"flex\",alignItems:\"center\",justifyContent:\"center\"}}><X size={12}/></Btn>\r\n        </div>\r\n      )}\r\n      {hasMoreCmts&&<Btn onClick={()=>{const next=cmtPage+1;setCmtPage(next);load(next);}} style={{width:\"100%\",padding:\"10px 0\",color:T.muted,fontSize:12,textAlign:\"center\",display:\"flex\",alignItems:\"center\",justifyContent:\"center\",gap:6}}>\r\n  <div style={{width:16,height:1,background:T.border,borderRadius:1}}/>\r\n  Voir plus de commentaires\r\n  <div style={{width:16,height:1,background:T.border,borderRadius:1}}/>\r\n</Btn>}\r\n      </>\r\n    );\r\n\r\n    const composerBar=(active)=>(\r\n      <div style={{display:\"flex\",alignItems:\"flex-end\",gap:8,padding:\"8px 12px\",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:24,backdropFilter:\"blur(20px)\",WebkitBackdropFilter:\"blur(20px)\",boxShadow:active===\"sticky\"?\"0 4px 20px rgba(0,0,0,0.2)\":\"0 -4px 20px rgba(0,0,0,0.25)\",position:active===\"sticky\"?\"sticky\":\"relative\",bottom:active===\"sticky\"?0:\"auto\",zIndex:active===\"sticky\"?10:\"auto\",flexShrink:0,marginTop:active===\"sticky\"?0:8}}>\r\n        <input ref={imgRef} type=\"file\" accept=\"image/*\" style={{display:\"none\"}} onChange={async e=>{\r\n          const f=e.target.files[0];if(!f)return;\r\n          const compressed=await compressImage(f);\r\n          const r=new FileReader();r.onload=ev=>setMediaPreview(ev.target.result);r.readAsDataURL(compressed);\r\n          setMediaFile(compressed);\r\n          e.target.value=\"\";\r\n        }}/>\r\n        <Btn onClick={()=>imgRef.current.click()} style={{color:mediaFile?T.goldL:T.muted,padding:\"4px\",display:\"flex\",alignItems:\"center\",flexShrink:0,transition:\"color .2s\"}}>\r\n          <Camera size={18}/>\r\n        </Btn>\r\n        <MentionInput\r\n          value={text}\r\n          onChange={(val,mentionedId)=>{setText(val);if(mentionedId&&!mentionedIdsRef.current.includes(mentionedId))mentionedIdsRef.current=[...mentionedIdsRef.current,mentionedId];}}\r\n          placeholder=\"Ajouter un commentaire...\"\r\n          members={members||[]}\r\n          onFocus={()=>setHideNav(true)}\r\n          onBlur={()=>setTimeout(()=>setHideNav(false),150)}\r\n        />\r\n        <Btn onClick={submit} disabled={posting||(!text.trim()&&!mediaFile)} style={{background:(text.trim()||mediaFile)?T.gradGold:\"rgba(255,255,255,0.05)\",borderRadius:\"50%\",width:34,height:34,color:(text.trim()||mediaFile)?\"#000\":T.muted,display:\"flex\",alignItems:\"center\",justifyContent:\"center\",transition:\"all 0.25s cubic-bezier(0.4,0,0.2,1)\",flexShrink:0,marginBottom:2}}>\r\n          <Send size={13} style={{transform:\"translateX(0.5px)\"}}/>\r\n        </Btn>\r\n      </div>\r\n    );\r\n\r\n    if(standalone){\r\n      return(\r\n        <div style={{display:\"flex\",flexDirection:\"column\",flex:1,minHeight:0}}>\r\n          <div style={{flex:1,minHeight:0,overflowY:\"auto\",display:\"flex\",flexDirection:\"column\",gap:14,padding:\"4px 0\"}}>\r\n            {listContent}\r\n          </div>\r\n          {composerBar(\"fixed\")}\r\n        </div>\r\n      );\r\n    }\r\n    return(\r\n      <div style={{display:\"flex\",flexDirection:\"column\",gap:14,padding:\"4px 0\"}}>\r\n        {listContent}\r\n        {composerBar(\"sticky\")}\r\n      </div>\r\n    );\r\n    })()}\r\n    </>\r\n  );\r\n}\r\n"
  },
  {
    "name": "CommentsOnlyModal — active le mode standalone",
    "search": "<CommentsSection postId={post.id} sessionUserId={session?.user?.id} getM={getM} onCountChange={setCmtCount} targetCommentId={null}/>",
    "replace": "<CommentsSection postId={post.id} sessionUserId={session?.user?.id} getM={getM} onCountChange={setCmtCount} targetCommentId={null} standalone/>"
  },
  {
    "name": "PostDetailModal — restaure le scroll global (overflowY:auto)",
    "search": "\r\n          <div style={{flex:1,minHeight:0,overflow:\"hidden\",display:\"flex\",flexDirection:\"column\",padding:\"0 16px 16px\"}}>\r\n",
    "replace": "\r\n          <div style={{overflowY:\"auto\",flex:1,padding:\"0 16px 16px\"}}>\r\n"
  }
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
