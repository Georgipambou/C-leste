// patch_announce_only.cjs
// Ajoute le mode "annonce" : quand il est activé, seuls les admins peuvent
// écrire dans le groupe. Touche src/Groups.jsx uniquement.
// Prérequis SQL (à coller dans Supabase avant d'utiliser la fonctionnalité) :
//
//   alter table public.groups
//     add column if not exists announce_only boolean not null default false;
//
// Usage : node patch_announce_only.cjs  (depuis la racine du repo)

const fs = require("fs");
const path = require("path");

const GROUPS_PATH = path.join(process.cwd(), "src", "Groups.jsx");

function readNormalized(filePath) {
  let raw = fs.readFileSync(filePath, "utf8");
  const hasBOM = raw.charCodeAt(0) === 0xFEFF;
  if (hasBOM) raw = raw.slice(1);
  const normalized = raw.replace(/\r\n/g, "\n");
  return { normalized, hasBOM };
}

function writeNormalized(filePath, normalized, hasBOM) {
  const withCRLF = normalized.replace(/\n/g, "\r\n");
  fs.writeFileSync(filePath, (hasBOM ? "\uFEFF" : "") + withCRLF, "utf8");
}

function applyEdit(content, label, oldStr, newStr) {
  const occurrences = content.split(oldStr).length - 1;
  if (occurrences === 0) throw new Error(`[ÉCHEC] Ancre introuvable pour : ${label}`);
  if (occurrences > 1) throw new Error(`[ÉCHEC] Ancre trouvée ${occurrences} fois (doit être unique) pour : ${label}`);
  return content.split(oldStr).join(newStr);
}

const { normalized, hasBOM } = readNormalized(GROUPS_PATH);
let content = normalized;

// 1. EditGroupModal : état local announceOnly
content = applyEdit(
  content,
  "EditGroupModal -> état announceOnly",
  `export function EditGroupModal({ sb, T, Av, Btn, group, actorId, onClose, onSaved, notify }) {\n  const [name, setName] = useState(group.name || "");\n  const [photoUrl, setPhotoUrl] = useState(group.photo_url || null);\n  const [photoFile, setPhotoFile] = useState(null);\n  const [saving, setSaving] = useState(false);`,
  `export function EditGroupModal({ sb, T, Av, Btn, group, actorId, onClose, onSaved, notify }) {\n  const [name, setName] = useState(group.name || "");\n  const [photoUrl, setPhotoUrl] = useState(group.photo_url || null);\n  const [photoFile, setPhotoFile] = useState(null);\n  const [announceOnly, setAnnounceOnly] = useState(!!group.announce_only);\n  const [saving, setSaving] = useState(false);`
);

// 2. EditGroupModal : détection du changement + message système
content = applyEdit(
  content,
  "EditGroupModal -> détection du changement de announce_only",
  `      if (photoFile) {\n        const newPhotoUrl = await uploadToR2(photoFile, "group_photos");\n        updates.photo_url = newPhotoUrl;\n        patch.photo_url = newPhotoUrl;\n      }\n      if (Object.keys(updates).length > 0) {\n        const { error } = await sb.from("groups").update(updates).eq("id", group.id);\n        if (error) throw error;\n        if (updates.name) await postSystemMessage(sb, group.id, actorId, \`a changé le nom du groupe en "\${updates.name}"\`);\n        if (updates.photo_url) await postSystemMessage(sb, group.id, actorId, "a changé la photo du groupe");\n      }`,
  `      if (photoFile) {\n        const newPhotoUrl = await uploadToR2(photoFile, "group_photos");\n        updates.photo_url = newPhotoUrl;\n        patch.photo_url = newPhotoUrl;\n      }\n      if (announceOnly !== !!group.announce_only) { updates.announce_only = announceOnly; patch.announce_only = announceOnly; }\n      if (Object.keys(updates).length > 0) {\n        const { error } = await sb.from("groups").update(updates).eq("id", group.id);\n        if (error) throw error;\n        if (updates.name) await postSystemMessage(sb, group.id, actorId, \`a changé le nom du groupe en "\${updates.name}"\`);\n        if (updates.photo_url) await postSystemMessage(sb, group.id, actorId, "a changé la photo du groupe");\n        if (updates.announce_only !== undefined) await postSystemMessage(sb, group.id, actorId, updates.announce_only ? "a activé le mode annonce" : "a désactivé le mode annonce");\n      }`
);

// 3. EditGroupModal : toggle visuel dans le formulaire
content = applyEdit(
  content,
  "EditGroupModal -> toggle mode annonce dans le formulaire",
  `        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom du groupe" autoFocus\n          style={{\n            width: "100%", maxWidth: 320, background: "rgba(255,255,255,0.05)", border: \`1px solid \${T.border}\`,\n            borderRadius: 14, padding: "12px 16px", color: T.text, fontSize: 15, outline: "none", textAlign: "center"\n          }} />\n      </div>\n    </div>\n  );\n}\n/* ============================================================\n   4. ÉCRAN DE CHAT DE GROUPE\n   ============================================================ */`,
  `        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom du groupe" autoFocus\n          style={{\n            width: "100%", maxWidth: 320, background: "rgba(255,255,255,0.05)", border: \`1px solid \${T.border}\`,\n            borderRadius: 14, padding: "12px 16px", color: T.text, fontSize: 15, outline: "none", textAlign: "center"\n          }} />\n        <div onClick={() => setAnnounceOnly(v => !v)} style={{\n          width: "100%", maxWidth: 320, display: "flex", alignItems: "center", justifyContent: "space-between",\n          padding: "12px 16px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: \`1px solid \${T.border}\`, cursor: "pointer"\n        }}>\n          <div>\n            <p style={{ margin: 0, fontSize: 14, color: T.text }}>Mode annonce</p>\n            <p style={{ margin: "2px 0 0", fontSize: 11, color: T.muted }}>Seuls les admins peuvent écrire</p>\n          </div>\n          <div style={{\n            width: 22, height: 22, borderRadius: 6, border: \`2px solid \${announceOnly ? T.gold : T.border}\`,\n            background: announceOnly ? T.gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center"\n          }}>\n            {announceOnly && <Check size={13} color="#000" />}\n          </div>\n        </div>\n      </div>\n    </div>\n  );\n}\n/* ============================================================\n   4. ÉCRAN DE CHAT DE GROUPE\n   ============================================================ */`
);

// 4. GroupChatScreen : états isGroupAdmin, chargement du rôle + de announce_only
content = applyEdit(
  content,
  "GroupChatScreen -> états isGroupAdmin + chargement",
  `  const [groupOverride, setGroupOverride] = useState(null);\n  const displayGroup = groupOverride ? { ...group, ...groupOverride } : group;\n  const bottomRef = useRef(null);\n  const fileRef = useRef(null);\n  const myId = session?.user?.id;\n  const { peerTyping, notifyTyping } = useTypingIndicator(sb, \`group_\${group.id}\`, session);`,
  `  const [groupOverride, setGroupOverride] = useState(null);\n  const [isGroupAdmin, setIsGroupAdmin] = useState(false);\n  const displayGroup = groupOverride ? { ...group, ...groupOverride } : group;\n  const canWrite = !displayGroup.announce_only || isGroupAdmin;\n  const bottomRef = useRef(null);\n  const fileRef = useRef(null);\n  const myId = session?.user?.id;\n  const { peerTyping, notifyTyping } = useTypingIndicator(sb, \`group_\${group.id}\`, session);\n\n  useEffect(() => {\n    if (!group?.id || !myId) return;\n    sb.from("groups").select("announce_only").eq("id", group.id).maybeSingle()\n      .then(({ data }) => { if (data) setGroupOverride(prev => ({ ...(prev || {}), announce_only: !!data.announce_only })); });\n    sb.from("group_members").select("role").eq("group_id", group.id).eq("user_id", myId).eq("status", "accepted").maybeSingle()\n      .then(({ data }) => setIsGroupAdmin(data?.role === "admin" || group.created_by === myId));\n  }, [sb, group?.id, myId]);`
);

// 5. GroupChatScreen : composer conditionné à canWrite (sinon bandeau lecture seule)
content = applyEdit(
  content,
  "GroupChatScreen -> composer conditionné à canWrite",
  `      <div style={{ display: "flex", gap: 8, padding: "10px 12px", paddingBottom: "calc(10px + env(safe-area-inset-bottom,0px))", borderTop: \`1px solid \${T.border}\`, position: "relative" }}>\n        <input type="file" accept="image/*" ref={fileRef} style={{ display: "none" }} onChange={sendImage} />\n        <Btn onClick={() => fileRef.current?.click()} style={{ width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted }}>\n          <Camera size={20} />\n        </Btn>\n        <Btn onClick={() => setShowStickerPicker(v => !v)} style={{ width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: showStickerPicker ? T.goldL : T.muted }}>\n          <Smile size={20} />\n        </Btn>\n        {showStickerPicker && (\n          <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, zIndex: 40 }}>\n            <StickerPicker sb={sb} userId={myId} T={T} onClose={() => setShowStickerPicker(false)} onSelect={sendSticker} />\n          </div>\n        )}\n        <input\n          value={text}\n          onChange={e => { setText(e.target.value); notifyTyping(); }}\n          onKeyDown={e => e.key === "Enter" && send()}\n          placeholder={editingMsg ? "Modifier le message…" : "Message…"}\n          style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: \`1px solid \${T.border}\`, borderRadius: 20, padding: "10px 16px", color: T.text, fontSize: 14, outline: "none" }}\n        />\n        <Btn onClick={send} disabled={!text.trim()} style={{\n          width: 40, height: 40, borderRadius: "50%",\n          background: text.trim() ? T.gradGold : "rgba(255,255,255,0.08)",\n          color: text.trim() ? "#000" : T.muted, display: "flex", alignItems: "center", justifyContent: "center"\n        }}>\n          <Send size={17} />\n        </Btn>\n      </div>`,
  `      {canWrite ? (\n      <div style={{ display: "flex", gap: 8, padding: "10px 12px", paddingBottom: "calc(10px + env(safe-area-inset-bottom,0px))", borderTop: \`1px solid \${T.border}\`, position: "relative" }}>\n        <input type="file" accept="image/*" ref={fileRef} style={{ display: "none" }} onChange={sendImage} />\n        <Btn onClick={() => fileRef.current?.click()} style={{ width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted }}>\n          <Camera size={20} />\n        </Btn>\n        <Btn onClick={() => setShowStickerPicker(v => !v)} style={{ width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: showStickerPicker ? T.goldL : T.muted }}>\n          <Smile size={20} />\n        </Btn>\n        {showStickerPicker && (\n          <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, zIndex: 40 }}>\n            <StickerPicker sb={sb} userId={myId} T={T} onClose={() => setShowStickerPicker(false)} onSelect={sendSticker} />\n          </div>\n        )}\n        <input\n          value={text}\n          onChange={e => { setText(e.target.value); notifyTyping(); }}\n          onKeyDown={e => e.key === "Enter" && send()}\n          placeholder={editingMsg ? "Modifier le message…" : "Message…"}\n          style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: \`1px solid \${T.border}\`, borderRadius: 20, padding: "10px 16px", color: T.text, fontSize: 14, outline: "none" }}\n        />\n        <Btn onClick={send} disabled={!text.trim()} style={{\n          width: 40, height: 40, borderRadius: "50%",\n          background: text.trim() ? T.gradGold : "rgba(255,255,255,0.08)",\n          color: text.trim() ? "#000" : T.muted, display: "flex", alignItems: "center", justifyContent: "center"\n        }}>\n          <Send size={17} />\n        </Btn>\n      </div>\n      ) : (\n      <div style={{ padding: "12px 16px", paddingBottom: "calc(12px + env(safe-area-inset-bottom,0px))", borderTop: \`1px solid \${T.border}\`, textAlign: "center" }}>\n        <p style={{ margin: 0, fontSize: 12, color: T.muted }}>Seuls les admins peuvent envoyer des messages dans ce groupe</p>\n      </div>\n      )}`
);

writeNormalized(GROUPS_PATH, content, hasBOM);
console.log("[OK] src/Groups.jsx patché (5 modifications).");
console.log("\nN'OUBLIE PAS la colonne SQL (Supabase) :");
console.log(`  alter table public.groups add column if not exists announce_only boolean not null default false;`);
console.log("\nTerminé. Pense à relancer le build/dev server.");
