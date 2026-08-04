// patch_system_and_edit.cjs
// Ajoute : (1) les messages système dans le fil de discussion du groupe
// (création, ajout de membres, exclusion, promotion/rétrogradation, départ,
// changement de nom/photo) et (2) l'édition du nom/de la photo d'un groupe
// existant.
// Ne touche QUE src/Groups.jsx (aucun changement dans App.jsx).
// Usage : node patch_system_and_edit.cjs  (depuis la racine du repo)

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

// 1. Fonction postSystemMessage(), ajoutée juste avant createGroup()
content = applyEdit(
  content,
  "ajout de postSystemMessage() avant createGroup()",
  `export async function createGroup(sb, { name, photoUrl, creatorId, memberIds }) {`,
  `export async function postSystemMessage(sb, groupId, senderId, text) {\n  const { error } = await sb.from("group_messages").insert({ group_id: groupId, sender_id: senderId, type: "system", text });\n  if (error) console.error("Message système non envoyé:", error);\n}\n\nexport async function createGroup(sb, { name, photoUrl, creatorId, memberIds, memberNames }) {`
);

// 2. createGroup() : message système "a créé le groupe" + "a ajouté ..." / addGroupMembers() : signature (memberNames)
content = applyEdit(
  content,
  "createGroup() -> messages système + signature addGroupMembers()",
  `  if (notifErr) console.error("Notif non envoyée:", notifErr);\n}\n\n  return group;\n}\n\nexport async function addGroupMembers(sb, { groupId, groupName, inviterId, memberIds }) {`,
  `  if (notifErr) console.error("Notif non envoyée:", notifErr);\n}\n\n  await postSystemMessage(sb, group.id, creatorId, "a créé le groupe");\n  if (memberNames && memberNames.length) {\n    await postSystemMessage(sb, group.id, creatorId, \`a ajouté \${memberNames.join(", ")}\`);\n  }\n\n  return group;\n}\n\nexport async function addGroupMembers(sb, { groupId, groupName, inviterId, memberIds, memberNames }) {`
);

// 3. addGroupMembers() : message système "a ajouté ..."
content = applyEdit(
  content,
  "addGroupMembers() -> message système",
  `  for (const uid of memberIds) {\n    const { error: notifErr } = await sb.from("notifications").insert({\n      user_id: uid, type: "group_invite", from_id: inviterId,\n      group_id: groupId, text: groupName, read: false\n    });\n    if (notifErr) console.error("Notif non envoyée:", notifErr);\n  }\n}`,
  `  for (const uid of memberIds) {\n    const { error: notifErr } = await sb.from("notifications").insert({\n      user_id: uid, type: "group_invite", from_id: inviterId,\n      group_id: groupId, text: groupName, read: false\n    });\n    if (notifErr) console.error("Notif non envoyée:", notifErr);\n  }\n\n  if (memberNames && memberNames.length) {\n    await postSystemMessage(sb, groupId, inviterId, \`a ajouté \${memberNames.join(", ")}\`);\n  }\n}`
);

// 4. CreateGroupModal.submit() : calcule memberNames et le transmet à createGroup()
content = applyEdit(
  content,
  "CreateGroupModal -> memberNames dans l'appel createGroup()",
  `      const group = await createGroup(sb, { name: name.trim(), photoUrl: finalPhotoUrl, creatorId: session.user.id, memberIds: selected });`,
  `      const memberNames = candidates.filter(m => selected.includes(m.id)).map(m => m.fullName || m.name);\n      const group = await createGroup(sb, { name: name.trim(), photoUrl: finalPhotoUrl, creatorId: session.user.id, memberIds: selected, memberNames });`
);

// 5. AddMembersModal.submit() : calcule memberNames et le transmet à addGroupMembers()
content = applyEdit(
  content,
  "AddMembersModal -> memberNames dans l'appel addGroupMembers()",
  `      await addGroupMembers(sb, { groupId: group.id, groupName: group.name, inviterId: session.user.id, memberIds: selected });`,
  `      const memberNames = candidates.filter(m => selected.includes(m.id)).map(m => m.fullName || m.name);\n      await addGroupMembers(sb, { groupId: group.id, groupName: group.name, inviterId: session.user.id, memberIds: selected, memberNames });`
);

// 6. Composant EditGroupModal, ajouté juste après AddMembersModal
content = applyEdit(
  content,
  "ajout du composant EditGroupModal après AddMembersModal",
  `        {candidates.length === 0 && (\n          <p style={{ textAlign: "center", color: T.muted, fontSize: 13, marginTop: 30 }}>Personne à ajouter pour le moment</p>\n        )}\n      </div>\n    </div>\n  );\n}\n/* ============================================================\n   4. ÉCRAN DE CHAT DE GROUPE\n   ============================================================ */`,
  `        {candidates.length === 0 && (\n          <p style={{ textAlign: "center", color: T.muted, fontSize: 13, marginTop: 30 }}>Personne à ajouter pour le moment</p>\n        )}\n      </div>\n    </div>\n  );\n}\n\nexport function EditGroupModal({ sb, T, Av, Btn, group, actorId, onClose, onSaved, notify }) {\n  const [name, setName] = useState(group.name || "");\n  const [photoUrl, setPhotoUrl] = useState(group.photo_url || null);\n  const [photoFile, setPhotoFile] = useState(null);\n  const [saving, setSaving] = useState(false);\n\n  const handlePhoto = (e) => {\n    const file = e.target.files?.[0];\n    if (!file) return;\n    setPhotoFile(file);\n    const reader = new FileReader();\n    reader.onload = () => setPhotoUrl(reader.result);\n    reader.readAsDataURL(file);\n  };\n\n  const submitLock = useRef(false);\n  const submit = async () => {\n    const trimmed = name.trim();\n    if (!trimmed || submitLock.current) return;\n    submitLock.current = true;\n    setSaving(true);\n    try {\n      const updates = {};\n      const patch = {};\n      if (trimmed !== group.name) { updates.name = trimmed; patch.name = trimmed; }\n      if (photoFile) {\n        const newPhotoUrl = await uploadToR2(photoFile, "group_photos");\n        updates.photo_url = newPhotoUrl;\n        patch.photo_url = newPhotoUrl;\n      }\n      if (Object.keys(updates).length > 0) {\n        const { error } = await sb.from("groups").update(updates).eq("id", group.id);\n        if (error) throw error;\n        if (updates.name) await postSystemMessage(sb, group.id, actorId, \`a changé le nom du groupe en "\${updates.name}"\`);\n        if (updates.photo_url) await postSystemMessage(sb, group.id, actorId, "a changé la photo du groupe");\n      }\n      notify?.("Groupe mis à jour ✦");\n      onSaved?.(patch);\n    } catch (e) {\n      console.error("Erreur mise à jour du groupe:", e);\n      notify?.(\`Erreur : \${e?.message || "mise à jour impossible"}\`);\n      submitLock.current = false;\n      setSaving(false);\n    }\n  };\n\n  return (\n    <div style={{ position: "fixed", inset: 0, zIndex: 320, background: "#000", display: "flex", flexDirection: "column" }}>\n      <div style={{\n        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",\n        paddingTop: "calc(10px + env(safe-area-inset-top,0px))",\n        borderBottom: \`1px solid \${T.border}\`, background: "rgba(0,0,0,0.92)"\n      }}>\n        <Btn onClick={onClose} style={{ color: T.muted }}><X size={22} /></Btn>\n        <p style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 700, color: T.text }}>Modifier le groupe</p>\n        <Btn onClick={submit} disabled={!name.trim() || saving}\n          style={{ color: name.trim() ? T.goldL : T.muted, fontWeight: 700, fontSize: 14 }}>\n          {saving ? "…" : "Enregistrer"}\n        </Btn>\n      </div>\n      <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>\n        <label style={{ position: "relative", cursor: "pointer" }}>\n          <div style={{\n            width: 96, height: 96, borderRadius: "50%", background: "rgba(255,255,255,0.06)",\n            border: \`1px solid \${T.border}\`, display: "flex", alignItems: "center", justifyContent: "center",\n            backgroundImage: photoUrl ? \`url(\${photoUrl})\` : undefined, backgroundSize: "cover", backgroundPosition: "center"\n          }}>\n            {!photoUrl && <Camera size={26} color={T.muted} />}\n          </div>\n          <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />\n        </label>\n        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom du groupe" autoFocus\n          style={{\n            width: "100%", maxWidth: 320, background: "rgba(255,255,255,0.05)", border: \`1px solid \${T.border}\`,\n            borderRadius: 14, padding: "12px 16px", color: T.text, fontSize: 15, outline: "none", textAlign: "center"\n          }} />\n      </div>\n    </div>\n  );\n}\n/* ============================================================\n   4. ÉCRAN DE CHAT DE GROUPE\n   ============================================================ */`
);

// 7. GroupMessageBubble : rendu spécial pour les messages système
content = applyEdit(
  content,
  "GroupMessageBubble -> rendu des messages système",
  `function GroupMessageBubble({ m, mine, T, Av, myId, showHeader, onOpenProfile, onReply, onLongPress, onDoubleTap, burstOn }) {\n  return (\n    <SwipeToReply message={m} onReply={onReply} mine={mine}>`,
  `function GroupMessageBubble({ m, mine, T, Av, myId, showHeader, onOpenProfile, onReply, onLongPress, onDoubleTap, burstOn }) {\n  if (m.type === "system") {\n    const senderName = m.sender ? \`\${m.sender.prenom || ""} \${m.sender.nom || ""}\`.replace(/\\s+/g, " ").trim() : "";\n    return (\n      <div style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>\n        <span style={{ fontSize: 12, color: T.muted, background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "5px 12px", textAlign: "center", maxWidth: "80%" }}>\n          {senderName ? \`\${senderName} \` : ""}{m.text}\n        </span>\n      </div>\n    );\n  }\n  return (\n    <SwipeToReply message={m} onReply={onReply} mine={mine}>`
);

// 8. GroupChatScreen : réinitialise le regroupement d'avatar après un message système
content = applyEdit(
  content,
  "displayList -> réinitialisation après un message système",
  `      if (item._divider) { lastSender = null; return item; }\n      const showHeader = lastSender !== item.sender_id;\n      lastSender = item.sender_id;\n      return { ...item, showHeader };\n    });\n  }, [msgs]);`,
  `      if (item._divider) { lastSender = null; return item; }\n      if (item.type === "system") { lastSender = null; return { ...item, showHeader: false }; }\n      const showHeader = lastSender !== item.sender_id;\n      lastSender = item.sender_id;\n      return { ...item, showHeader };\n    });\n  }, [msgs]);`
);

// 9. GroupChatScreen : état local pour refléter les modifications de nom/photo sans recharger
content = applyEdit(
  content,
  "GroupChatScreen -> ajout de l'état groupOverride",
  `  const [showGroupInfo, setShowGroupInfo] = useState(false);\n  const [burstMsgId, setBurstMsgId] = useState(null);`,
  `  const [showGroupInfo, setShowGroupInfo] = useState(false);\n  const [burstMsgId, setBurstMsgId] = useState(null);\n  const [groupOverride, setGroupOverride] = useState(null);\n  const displayGroup = groupOverride ? { ...group, ...groupOverride } : group;`
);

// 10. GroupChatScreen : en-tête utilise displayGroup (nom/photo à jour)
content = applyEdit(
  content,
  "GroupChatScreen -> en-tête avec displayGroup",
  `        <div onClick={() => setShowGroupInfo(true)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>\n          <Av u={{ name: group.name, avatar_url: group.photo_url, initials: (group.name || "?").slice(0, 2).toUpperCase(), color: "#888" }} size={34} />\n          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>{group.name}</p>\n        </div>`,
  `        <div onClick={() => setShowGroupInfo(true)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>\n          <Av u={{ name: displayGroup.name, avatar_url: displayGroup.photo_url, initials: (displayGroup.name || "?").slice(0, 2).toUpperCase(), color: "#888" }} size={34} />\n          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>{displayGroup.name}</p>\n        </div>`
);

// 11. GroupChatScreen -> GroupInfoScreen : transmet displayGroup + onGroupUpdated
content = applyEdit(
  content,
  "GroupChatScreen -> transmission de displayGroup/onGroupUpdated à GroupInfoScreen",
  `        <GroupInfoScreen sb={sb} T={T} Av={Av} Btn={Btn} group={group} session={session} notify={notify}\n          allMembers={members} myConnections={myConnections} myFollowers={myFollowers}\n          onBack={() => setShowGroupInfo(false)}\n          onLeftGroup={() => { setShowGroupInfo(false); onBack(); }}\n          onDeletedGroup={() => { setShowGroupInfo(false); onBack(); }}\n        />`,
  `        <GroupInfoScreen sb={sb} T={T} Av={Av} Btn={Btn} group={displayGroup} session={session} notify={notify}\n          allMembers={members} myConnections={myConnections} myFollowers={myFollowers}\n          onGroupUpdated={patch => setGroupOverride(prev => ({ ...(prev || {}), ...patch }))}\n          onBack={() => setShowGroupInfo(false)}\n          onLeftGroup={() => { setShowGroupInfo(false); onBack(); }}\n          onDeletedGroup={() => { setShowGroupInfo(false); onBack(); }}\n        />`
);

// 12. GroupInfoScreen : signature (ajout de onGroupUpdated)
content = applyEdit(
  content,
  "signature de GroupInfoScreen (ajout de onGroupUpdated)",
  `export function GroupInfoScreen({ sb, T, Av, Btn, group, session, notify, onBack, onLeftGroup, onDeletedGroup, allMembers, myConnections, myFollowers }) {`,
  `export function GroupInfoScreen({ sb, T, Av, Btn, group, session, notify, onBack, onLeftGroup, onDeletedGroup, allMembers, myConnections, myFollowers, onGroupUpdated }) {`
);

// 13. GroupInfoScreen : nouvel état showEditGroup
content = applyEdit(
  content,
  "GroupInfoScreen -> ajout de l'état showEditGroup",
  `  const [showAddMembers, setShowAddMembers] = useState(false);\n  const myId = session?.user?.id;`,
  `  const [showAddMembers, setShowAddMembers] = useState(false);\n  const [showEditGroup, setShowEditGroup] = useState(false);\n  const myId = session?.user?.id;`
);

// 14. GroupInfoScreen : promote/demote/kick/leave -> messages système
content = applyEdit(
  content,
  "GroupInfoScreen -> messages système pour promote/demote/kick/leave",
  `  const promote = async (uid) => {\n    await sb.from("group_members").update({ role: "admin" }).eq("group_id", group.id).eq("user_id", uid);\n    setActionMember(null);\n    notify?.("Membre promu admin ✦");\n    loadMembers();\n  };\n  const demote = async (uid) => {\n    await sb.from("group_members").update({ role: "member" }).eq("group_id", group.id).eq("user_id", uid);\n    setActionMember(null);\n    notify?.("Rôle admin retiré");\n    loadMembers();\n  };\n  const kick = async (uid) => {\n    await sb.from("group_members").delete().eq("group_id", group.id).eq("user_id", uid);\n    setActionMember(null);\n    notify?.("Membre exclu du groupe");\n    loadMembers();\n  };\n\n  const leave = async () => {\n    await sb.from("group_members").delete().eq("group_id", group.id).eq("user_id", myId);\n    notify?.("Tu as quitté le groupe");\n    onLeftGroup?.();\n  };`,
  `  const promote = async (uid) => {\n    const tp = members.find(m => m.user_id === uid)?.profiles;\n    const targetName = tp ? \`\${tp.prenom || ""} \${tp.nom || ""}\`.trim() : "";\n    await sb.from("group_members").update({ role: "admin" }).eq("group_id", group.id).eq("user_id", uid);\n    setActionMember(null);\n    notify?.("Membre promu admin ✦");\n    if (targetName) postSystemMessage(sb, group.id, myId, \`a promu \${targetName} admin\`);\n    loadMembers();\n  };\n  const demote = async (uid) => {\n    const tp = members.find(m => m.user_id === uid)?.profiles;\n    const targetName = tp ? \`\${tp.prenom || ""} \${tp.nom || ""}\`.trim() : "";\n    await sb.from("group_members").update({ role: "member" }).eq("group_id", group.id).eq("user_id", uid);\n    setActionMember(null);\n    notify?.("Rôle admin retiré");\n    if (targetName) postSystemMessage(sb, group.id, myId, \`a retiré le rôle admin à \${targetName}\`);\n    loadMembers();\n  };\n  const kick = async (uid) => {\n    const tp = members.find(m => m.user_id === uid)?.profiles;\n    const targetName = tp ? \`\${tp.prenom || ""} \${tp.nom || ""}\`.trim() : "";\n    await sb.from("group_members").delete().eq("group_id", group.id).eq("user_id", uid);\n    setActionMember(null);\n    notify?.("Membre exclu du groupe");\n    if (targetName) postSystemMessage(sb, group.id, myId, \`a exclu \${targetName} du groupe\`);\n    loadMembers();\n  };\n\n  const leave = async () => {\n    await sb.from("group_members").delete().eq("group_id", group.id).eq("user_id", myId);\n    notify?.("Tu as quitté le groupe");\n    postSystemMessage(sb, group.id, myId, "a quitté le groupe");\n    onLeftGroup?.();\n  };`
);

// 15. GroupInfoScreen : photo/nom cliquables pour l'admin (ouvre EditGroupModal)
content = applyEdit(
  content,
  "GroupInfoScreen -> en-tête cliquable (édition)",
  `        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 20px 20px" }}>\n          <Av u={{ name: group.name, avatar_url: group.photo_url, initials: (group.name || "?").slice(0, 2).toUpperCase(), color: "#888" }} size={92} />\n          <p style={{ margin: "14px 0 2px", fontSize: 19, fontWeight: 700, color: T.text, textAlign: "center" }}>{group.name}</p>\n          <p style={{ margin: 0, fontSize: 13, color: T.muted }}>Groupe · {members.length} membre{members.length !== 1 ? "s" : ""}</p>\n        </div>`,
  `        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 20px 20px" }}>\n          <div onClick={() => isAdmin && setShowEditGroup(true)} style={{ cursor: isAdmin ? "pointer" : "default", position: "relative" }}>\n            <Av u={{ name: group.name, avatar_url: group.photo_url, initials: (group.name || "?").slice(0, 2).toUpperCase(), color: "#888" }} size={92} />\n            {isAdmin && (\n              <div style={{ position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: "50%", background: T.gradGold, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #000" }}>\n                <Camera size={13} color="#000" />\n              </div>\n            )}\n          </div>\n          <p style={{ margin: "14px 0 2px", fontSize: 19, fontWeight: 700, color: T.text, textAlign: "center" }}>{group.name}</p>\n          {isAdmin && (\n            <p onClick={() => setShowEditGroup(true)} style={{ margin: "0 0 4px", fontSize: 12, color: T.goldL, cursor: "pointer" }}>Modifier le groupe</p>\n          )}\n          <p style={{ margin: 0, fontSize: 13, color: T.muted }}>Groupe · {members.length} membre{members.length !== 1 ? "s" : ""}</p>\n        </div>`
);

// 16. GroupInfoScreen : rendu de EditGroupModal
content = applyEdit(
  content,
  "GroupInfoScreen -> rendu de EditGroupModal",
  `      {showAddMembers && (\n        <AddMembersModal sb={sb} T={T} Av={Av} Btn={Btn} session={session} group={group}\n          members={allMembers} myConnections={myConnections} myFollowers={myFollowers}\n          existingMemberIds={members.map(m => m.user_id)}\n          onClose={() => setShowAddMembers(false)}\n          onAdded={loadMembers}\n          notify={notify}\n        />\n      )}\n    </div>\n  );\n}\n/* ============================================================\n   6. INVITATIONS DE GROUPE EN ATTENTE`,
  `      {showAddMembers && (\n        <AddMembersModal sb={sb} T={T} Av={Av} Btn={Btn} session={session} group={group}\n          members={allMembers} myConnections={myConnections} myFollowers={myFollowers}\n          existingMemberIds={members.map(m => m.user_id)}\n          onClose={() => setShowAddMembers(false)}\n          onAdded={loadMembers}\n          notify={notify}\n        />\n      )}\n      {showEditGroup && (\n        <EditGroupModal sb={sb} T={T} Av={Av} Btn={Btn} group={group} actorId={myId}\n          onClose={() => setShowEditGroup(false)}\n          onSaved={patch => { setShowEditGroup(false); onGroupUpdated?.(patch); }}\n          notify={notify}\n        />\n      )}\n    </div>\n  );\n}\n/* ============================================================\n   6. INVITATIONS DE GROUPE EN ATTENTE`
);

writeNormalized(GROUPS_PATH, content, hasBOM);
console.log("[OK] src/Groups.jsx patché (16 modifications).");
console.log("\nTerminé. Pense à relancer le build/dev server.");
