// fix-group-photo-upload.cjs
// Corrige Groups.jsx : la photo de groupe choisie à l'étape 2 de CreateGroupModal
// n'était jamais envoyée sur R2 (uploadToR2 était importé mais jamais appelé) —
// c'est l'aperçu base64 local qui était écrit directement dans groups.photo_url.
// Ce patch : garde l'aperçu instantané, mais upload le fichier réel vers R2
// juste avant la création du groupe, et c'est cette URL R2 qui est sauvegardée.
//
// Usage : place ce fichier à la racine du projet (à côté de Groups.jsx), puis :
//   node fix-group-photo-upload.cjs

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "src", "Groups.jsx");
const raw = fs.readFileSync(FILE, "utf8");
const hadCRLF = raw.includes("\r\n");
let src = raw.replace(/\r\n/g, "\n"); // normalise en LF pour matcher les ancres, on remet le CRLF à l'écriture si besoin
let changes = 0;

function apply(label, oldStr, newStr) {
  if (!src.includes(oldStr)) {
    throw new Error(`Ancre introuvable pour "${label}" — le fichier a peut-être déjà changé. Aucune modification appliquée.`);
  }
  const count = src.split(oldStr).length - 1;
  if (count > 1) {
    throw new Error(`Ancre "${label}" trouvée ${count} fois (doit être unique) — patch annulé par sécurité.`);
  }
  src = src.replace(oldStr, newStr);
  changes++;
  console.log(`✔ ${label}`);
}

// 1. Ajoute un state pour garder le fichier brut (en plus de l'aperçu base64)
apply(
  "ajout du state photoFile",
  `  const [photoUrl, setPhotoUrl] = useState(null);\n  const [saving, setSaving] = useState(false);`,
  `  const [photoUrl, setPhotoUrl] = useState(null);\n  const [photoFile, setPhotoFile] = useState(null);\n  const [saving, setSaving] = useState(false);`
);

// 2. handlePhoto garde l'aperçu local ET mémorise le fichier brut pour l'upload réel
apply(
  "mémoriser le fichier brut dans handlePhoto",
  `  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(reader.result); // aperçu local ; upload réel vers R2 à brancher au moment de la création
    reader.readAsDataURL(file);
  };`,
  `  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(reader.result); // aperçu local uniquement ; l'upload réel vers R2 se fait dans submit()
    reader.readAsDataURL(file);
  };`
);

// 3. submit() : upload réel vers R2 avant createGroup si une photo a été choisie
apply(
  "upload réel vers R2 dans submit()",
  `    submitLock.current = true;
    setSaving(true);
    try {
      const group = await createGroup(sb, { name: name.trim(), photoUrl, creatorId: session.user.id, memberIds: selected });`,
  `    submitLock.current = true;
    setSaving(true);
    try {
      let finalPhotoUrl = null;
      if (photoFile) {
        finalPhotoUrl = await uploadToR2(photoFile, "group_photos");
      }
      const group = await createGroup(sb, { name: name.trim(), photoUrl: finalPhotoUrl, creatorId: session.user.id, memberIds: selected });`
);

if (hadCRLF) src = src.replace(/\n/g, "\r\n");
fs.writeFileSync(FILE, src, "utf8");
console.log(`\n${changes} modification(s) appliquée(s) avec succès dans Groups.jsx.`);
