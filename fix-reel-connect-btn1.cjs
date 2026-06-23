const fs = require("fs");
const path = "src/App.jsx";
let c = fs.readFileSync(path, "utf8");

const old = `                  <Av u={post.author} size={46} onClick={()=>onUser?.(post.by)}/>
                  {!isMe&&!isConnected&&(<button onClick={()=>onConnect?.(post.by)} style={{position:"absolute",bottom:-8,left:"50%",transform:"translateX(-50%)",background:"#ff2d55",border:"2px solid #fff",borderRadius:"50%",width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:0,color:"#fff",fontSize:14,fontWeight:900,lineHeight:1}}>+</button>)}`;

const replacement = `                  <div style={{position:"relative",display:"inline-block"}}>
                  <Av u={post.author} size={46} onClick={()=>onUser?.(post.by)}/>
                  {!isMe&&!isConnected&&(<button onClick={()=>onConnect?.(post.by)} style={{position:"absolute",bottom:-2,right:-2,background:T.gradGold,border:"none",borderRadius:"50%",width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:0,color:"#000",fontSize:11,fontWeight:900,lineHeight:1,boxShadow:"0 2px 8px rgba(201,149,42,0.5)"}}>+</button>)}
                  </div>`;

if (c.includes(old)) {
  c = c.replace(old, replacement);
  fs.writeFileSync(path, c, "utf8");
  console.log("✓ 1/1 Bouton + du Reel repositionné (style badge, coin bas-droit de l'avatar).");
} else {
  console.log("✗ introuvable — déjà appliqué ou fichier différent.");
}
