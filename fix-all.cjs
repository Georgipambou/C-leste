const fs = require('fs');
const path = 'src/App.jsx';
let c = fs.readFileSync(path, 'utf8');
let count = 0;

// ── 1. STATUS VIDÉO : ajouter state + trim dans StatusCreator ──
// Ajouter statusTrimSrc state après cropResolve state
const old1 = `const [cropResolve,setCropResolve]=useState(null);
const fRef=useRef();`;
const new1 = `const [cropResolve,setCropResolve]=useState(null);
const [statusTrimSrc,setStatusTrimSrc]=useState(null);
const [statusTrimFile,setStatusTrimFile]=useState(null);
const fRef=useRef();`;
if(c.includes(old1)){c=c.replace(old1,new1);count++;console.log('✓ 1/5 state statusTrimSrc ajouté');}
else console.error('✗ 1/5 MISS');

// ── 2. STATUS VIDÉO : brancher VideoTrimModal dans handlePick ──
const old2 = `if(f.type.startsWith("video/")&&f.size>25*1024*1024){alert("Vidéo max 25MB");return;}
    const r=new FileReader();r.onload=ev=>setPreview(ev.target.result);r.readAsDataURL(f);
    setUploading(true);
    try {
  const publicUrl = await uploadToR2(f, "statuses");
  setMediaUrl(publicUrl);
} catch(e) {
  console.error("Erreur upload statut:", e);
}
    setUploading(false);`;
const new2 = `if(f.type.startsWith("video/")){
      if(f.size>25*1024*1024){alert("Vidéo max 25MB");return;}
      const src=await new Promise(res=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(f);});
      setStatusTrimFile(f);
      setStatusTrimSrc(src);
      return;
    }
    const r=new FileReader();r.onload=ev=>setPreview(ev.target.result);r.readAsDataURL(f);
    setUploading(true);
    try {
  const publicUrl = await uploadToR2(f, "statuses");
  setMediaUrl(publicUrl);
} catch(e) {
  console.error("Erreur upload statut:", e);
}
    setUploading(false);`;
if(c.includes(old2)){c=c.replace(old2,new2);count++;console.log('✓ 2/5 trim vidéo branché dans handlePick');}
else console.error('✗ 2/5 MISS');

// ── 3. STATUS VIDÉO : afficher VideoTrimModal dans le return ──
const old3 = `{cropSrc&&(
  <ImageCropModal
    imageSrc={cropSrc}
    onClose={()=>{setCropSrc(null);cropResolve?.fn(null);setCropResolve(null);}}
    onDone={file=>{setCropSrc(null);cropResolve?.fn(file);setCropResolve(null);}}
  />
)}`;
const new3 = `{cropSrc&&(
  <ImageCropModal
    imageSrc={cropSrc}
    onClose={()=>{setCropSrc(null);cropResolve?.fn(null);setCropResolve(null);}}
    onDone={file=>{setCropSrc(null);cropResolve?.fn(file);setCropResolve(null);}}
  />
)}
{statusTrimSrc&&(
  <VideoTrimModal
    videoSrc={statusTrimSrc}
    onClose={()=>{setStatusTrimSrc(null);setStatusTrimFile(null);}}
    onDone={async trimmedFile=>{
      setStatusTrimSrc(null);
      const file=trimmedFile||statusTrimFile;
      setStatusTrimFile(null);
      const r=new FileReader();r.onload=ev=>setPreview(ev.target.result);r.readAsDataURL(file);
      setUploading(true);
      try{const publicUrl=await uploadToR2(file,"statuses");setMediaUrl(publicUrl);}
      catch(e){console.error("Erreur upload statut:",e);}
      setUploading(false);
    }}
  />
)}`;
if(c.includes(old3)){c=c.replace(old3,new3);count++;console.log('✓ 3/5 VideoTrimModal rendu dans StatusCreator');}
else console.error('✗ 3/5 MISS');

// ── 4. REEL BAS : unifier progress bar + description + badge WhatsApp/lien ──
// La barre de progression chevauchait le badge WhatsApp (même bottom:4px)
// On monte la barre à bottom:0 et on met le badge AU-DESSUS du bloc description
const old4 = `{post.is_for_sale&&post.whatsapp_contact&&(<a href={'https://wa.me/'+post.whatsapp_contact.replace(/\\D/g,'')} target='_blank' rel='noreferrer' style={{position:'absolute',left:0,right:0,bottom:'calc(4px + env(safe-area-inset-bottom,0px))',background:'linear-gradient(135deg,#25D366,#128C7E)',padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'center',gap:10,color:'#fff',fontWeight:700,fontSize:14,textDecoration:'none',zIndex:3}}><MessageCircle size={18}/> Contacter sur WhatsApp</a>)}`;
const new4 = `{post.is_for_sale&&(post.whatsapp_contact||post.contact_link)&&(
  <div style={{position:'absolute',left:0,right:0,bottom:'calc(28px + env(safe-area-inset-bottom,0px))',zIndex:4,display:'flex',flexDirection:'column',gap:6,padding:'0 0 6px'}}>
    {post.whatsapp_contact&&(<a href={'https://wa.me/'+post.whatsapp_contact.replace(/\\D/g,'')} target='_blank' rel='noreferrer' style={{margin:'0 12px',background:'linear-gradient(135deg,#25D366,#128C7E)',padding:'10px 20px',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',gap:10,color:'#fff',fontWeight:700,fontSize:13,textDecoration:'none'}}><MessageCircle size={16}/> Contacter sur WhatsApp</a>)}
    {post.contact_link&&(<a href={post.contact_link} target='_blank' rel='noreferrer' style={{margin:'0 12px',background:'rgba(74,144,217,0.85)',padding:'10px 20px',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',gap:10,color:'#fff',fontWeight:700,fontSize:13,textDecoration:'none'}}>🔗 Voir le lien</a>)}
  </div>
)}`;
if(c.includes(old4)){c=c.replace(old4,new4);count++;console.log('✓ 4/5 badge vente/WhatsApp/lien unifié dans Reel');}
else console.error('✗ 4/5 MISS');

// ── 5. PHOTO STATUT : objectFit contain → cover pour les images ──
// Dans StatusViewer, les photos s'affichent trop petites car contain
const old5 = `:<img src={current.mediaUrl} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain",objectPosition:"center"}}/>`;
const new5 = `:<img src={current.mediaUrl} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center"}}/>`;
if(c.includes(old5)){c=c.replace(old5,new5);count++;console.log('✓ 5/5 photo statut objectFit cover');}
else console.error('✗ 5/5 MISS');

fs.writeFileSync(path, c);
console.log(`\n${count}/5 modifications appliquées.`);
