// patch_add_members.cjs
// Ajoute la fonctionnalité "Ajouter des participants" à un groupe existant.
// Usage : node patch_add_members.cjs
//   (à lancer depuis la racine du repo, où se trouvent src/App.jsx et src/Groups.jsx)

const fs = require("fs");
const path = require("path");

const GROUPS_PATH = path.join(process.cwd(), "src", "Groups.jsx");
const APP_PATH = path.join(process.cwd(), "src", "App.jsx");

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
  if (occurrences === 0) {
    throw new Error(`[ÉCHEC] Ancre introuvable pour : ${label}`);
  }
  if (occurrences > 1) {
    throw new Error(`[ÉCHEC] Ancre trouvée ${occurrences} fois (doit être unique) pour : ${label}`);
  }
  return content.split(oldStr).join(newStr);
}

/* ------------------------------------------------------------------ */
/* 1. Groups.jsx                                                       */
/* ------------------------------------------------------------------ */

{
  const { normalized, hasBOM } = readNormalized(GROUPS_PATH);
  let content = normalized;

  // 1a. Import de l'icône UserPlus
  content = applyEdit(
    content,
    "import lucide-react (ajout UserPlus)",
    `import { X, Search, Check, Camera, Users, Lock, ChevronRight, ChevronLeft, Send, Smile } from "lucide-react";`,
    `import { X, Search, Check, Camera, Users, Lock, ChevronRight, ChevronLeft, Send, Smile, UserPlus } from "lucide-react";`
  );

  // 1b. Fonction addGroupMembers, ajoutée juste après createGroup()
  content = applyEdit(
    content,
    "ajout de addGroupMembers() après createGroup()",
    `  return group;\n}\n\nexport function CreateGroupModal(`,
    `  return group;\n}\n\nexport async function addGroupMembers(sb, { groupId, groupName, inviterId, memberIds }) {\n  const rows = memberIds.map(uid => ({ group_id: groupId, user_id: uid, role: "member", status: "pending", invited_by: inviterId }));\n  const { error } = await sb.from("group_members").insert(rows);\n  if (error) throw error;\n\n  for (const uid of memberIds) {\n    const { error: notifErr } = await sb.from("notifications").insert({\n      user_id: uid, type: "group_invite", from_id: inviterId,\n      group_id: groupId, text: groupName, read: false\n    });\n    if (notifErr) console.error("Notif non envoyée:", notifErr);\n  }\n}\n\nexport function CreateGroupModal(`
  );

  // 1c. Composant AddMembersModal, ajouté juste après CreateGroupModal
  content = applyEdit(
    content,
    "ajout du composant AddMembersModal après CreateGroupModal",
    `        </div>\n      )}\n    </div>\n  );\n}\n/* ============================================================\n   4. ÉCRAN DE CHAT DE GROUPE\n   ============================================================ */`,
    `        </div>\n      )}\n    </div>\n  );\n}\n\nexport function AddMembersModal({ sb, T, Av, Btn, session, members, myConnections, myFollowers, group, existingMemberIds, onClose, onAdded, notify }) {\n  const [query, setQuery] = useState("");\n  const [selected, setSelected] = useState([]);\n  const [saving, setSaving] = useState(false);\n  const excluded = useMemo(() => new Set(existingMemberIds || []), [existingMemberIds]);\n\n  const candidates = useMemo(() => {\n    const known = new Set([...(myConnections || []), ...(myFollowers || [])]);\n    return (members || [])\n      .filter(m => m.id !== session?.user?.id)\n      .filter(m => !excluded.has(m.id))\n      .filter(m => !query.trim() || (m.fullName || m.name || "").toLowerCase().includes(query.trim().toLowerCase()))\n      .map(m => {\n        const perm = m.group_invite_permission || "everyone";\n        const eligible = perm === "everyone" || (perm === "followers" && (myConnections || []).includes(m.id));\n        return { ...m, __eligible: eligible, __known: known.has(m.id) };\n      })\n      .sort((a, b) => (b.__known - a.__known) || (b.__eligible - a.__eligible));\n  }, [members, query, myConnections, myFollowers, session?.user?.id, excluded]);\n\n  const toggle = (uid) => setSelected(s => s.includes(uid) ? s.filter(x => x !== uid) : [...s, uid]);\n\n  const submitLock = useRef(false);\n  const submit = async () => {\n    if (selected.length === 0 || submitLock.current) return;\n    submitLock.current = true;\n    setSaving(true);\n    try {\n      await addGroupMembers(sb, { groupId: group.id, groupName: group.name, inviterId: session.user.id, memberIds: selected });\n      notify?.(selected.length > 1 ? "Invitations envoyées ✦" : "Invitation envoyée ✦");\n      onAdded?.();\n      onClose?.();\n    } catch (e) {\n      console.error("Erreur ajout de membres:", e);\n      notify?.(\`Erreur : \${e?.message || "ajout de membres impossible"}\`);\n      submitLock.current = false;\n      setSaving(false);\n    }\n  };\n\n  return (\n    <div style={{ position: "fixed", inset: 0, zIndex: 310, background: "#000", display: "flex", flexDirection: "column" }}>\n      <div style={{\n        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",\n        paddingTop: "calc(10px + env(safe-area-inset-top,0px))",\n        borderBottom: \`1px solid \${T.border}\`, background: "rgba(0,0,0,0.92)"\n      }}>\n        <Btn onClick={onClose} style={{ color: T.muted }}><X size={22} /></Btn>\n        <p style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 700, color: T.text }}>Ajouter des participants</p>\n        <Btn onClick={submit} disabled={selected.length === 0 || saving}\n          style={{ color: selected.length > 0 ? T.goldL : T.muted, fontWeight: 700, fontSize: 14 }}>\n          {saving ? "…" : \`Inviter (\${selected.length})\`}\n        </Btn>\n      </div>\n\n      <div style={{ padding: "10px 14px" }}>\n        <div style={{ background: "rgba(255,255,255,0.05)", border: \`1px solid \${T.border}\`, borderRadius: 20, padding: "9px 14px", display: "flex", gap: 8, alignItems: "center" }}>\n          <Search size={14} color={T.muted} />\n          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher…"\n            style={{ flex: 1, background: "none", border: "none", color: T.text, fontSize: 13, outline: "none" }} />\n        </div>\n      </div>\n      <div style={{ flex: 1, overflowY: "auto" }}>\n        {candidates.map(m => (\n          <div key={m.id} onClick={() => m.__eligible && toggle(m.id)} style={{\n            display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",\n            opacity: m.__eligible ? 1 : 0.4, cursor: m.__eligible ? "pointer" : "not-allowed"\n          }}>\n            <Av u={m} size={44} />\n            <div style={{ flex: 1, minWidth: 0 }}>\n              <p style={{ margin: 0, fontSize: 14, color: T.text }}>{m.fullName || m.name}</p>\n              {!m.__eligible && <p style={{ margin: 0, fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}><Lock size={10} /> N'accepte pas les invitations de groupe</p>}\n            </div>\n            <div style={{\n              width: 22, height: 22, borderRadius: "50%", border: \`2px solid \${selected.includes(m.id) ? T.gold : T.border}\`,\n              background: selected.includes(m.id) ? T.gold : "transparent",\n              display: "flex", alignItems: "center", justifyContent: "center"\n            }}>\n              {selected.includes(m.id) && <Check size={13} color="#000" />}\n            </div>\n          </div>\n        ))}\n        {candidates.length === 0 && (\n          <p style={{ textAlign: "center", color: T.muted, fontSize: 13, marginTop: 30 }}>Personne à ajouter pour le moment</p>\n        )}\n      </div>\n    </div>\n  );\n}\n/* ============================================================\n   4. ÉCRAN DE CHAT DE GROUPE\n   ============================================================ */`
  );

  // 1d. GroupChatScreen : accepte et transmet members / myConnections / myFollowers
  content = applyEdit(
    content,
    "signature de GroupChatScreen (ajout des props)",
    `export function GroupChatScreen({ sb, T, Av, Btn, group, session, notify, onBack, onOpenProfile }) {`,
    `export function GroupChatScreen({ sb, T, Av, Btn, group, session, notify, onBack, onOpenProfile, members, myConnections, myFollowers }) {`
  );

  content = applyEdit(
    content,
    "GroupChatScreen -> transmission des props à GroupInfoScreen",
    `      {showGroupInfo && (\n        <GroupInfoScreen sb={sb} T={T} Av={Av} Btn={Btn} group={group} session={session} notify={notify}\n          onBack={() => setShowGroupInfo(false)}\n          onLeftGroup={() => { setShowGroupInfo(false); onBack(); }}\n          onDeletedGroup={() => { setShowGroupInfo(false); onBack(); }}\n        />\n      )}`,
    `      {showGroupInfo && (\n        <GroupInfoScreen sb={sb} T={T} Av={Av} Btn={Btn} group={group} session={session} notify={notify}\n          allMembers={members} myConnections={myConnections} myFollowers={myFollowers}\n          onBack={() => setShowGroupInfo(false)}\n          onLeftGroup={() => { setShowGroupInfo(false); onBack(); }}\n          onDeletedGroup={() => { setShowGroupInfo(false); onBack(); }}\n        />\n      )}`
  );

  // 1e. GroupInfoScreen : signature (ajout des props, renommées allMembers pour éviter le conflit avec le state local "members")
  content = applyEdit(
    content,
    "signature de GroupInfoScreen (ajout des props)",
    `export function GroupInfoScreen({ sb, T, Av, Btn, group, session, notify, onBack, onLeftGroup, onDeletedGroup }) {`,
    `export function GroupInfoScreen({ sb, T, Av, Btn, group, session, notify, onBack, onLeftGroup, onDeletedGroup, allMembers, myConnections, myFollowers }) {`
  );

  // 1f. GroupInfoScreen : nouvel état showAddMembers
  content = applyEdit(
    content,
    "GroupInfoScreen -> ajout de l'état showAddMembers",
    `  const [actionMember, setActionMember] = useState(null);\n  const myId = session?.user?.id;`,
    `  const [actionMember, setActionMember] = useState(null);\n  const [showAddMembers, setShowAddMembers] = useState(false);\n  const myId = session?.user?.id;`
  );

  // 1g. GroupInfoScreen : bouton "Ajouter des participants" (visible si admin), juste avant la liste des membres
  content = applyEdit(
    content,
    "GroupInfoScreen -> bouton Ajouter des participants",
    `        <div style={{ borderTop: \`1px solid \${T.border}\`, borderBottom: \`1px solid \${T.border}\` }}>\n          {members.map(m => {`,
    `        {isAdmin && (\n          <div onClick={() => setShowAddMembers(true)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", cursor: "pointer", borderTop: \`1px solid \${T.border}\` }}>\n            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(201,149,42,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>\n              <UserPlus size={18} color={T.goldL} />\n            </div>\n            <p style={{ margin: 0, fontSize: 14, color: T.goldL, fontWeight: 600 }}>Ajouter des participants</p>\n          </div>\n        )}\n        <div style={{ borderTop: \`1px solid \${T.border}\`, borderBottom: \`1px solid \${T.border}\` }}>\n          {members.map(m => {`
  );

  // 1h. GroupInfoScreen : rendu conditionnel de AddMembersModal
  content = applyEdit(
    content,
    "GroupInfoScreen -> rendu de AddMembersModal",
    `      {actionMember && (\n        <MemberActionSheet T={T} member={actionMember} onClose={() => setActionMember(null)}\n          onPromote={() => promote(actionMember.user_id)}\n          onDemote={() => demote(actionMember.user_id)}\n          onKick={() => kick(actionMember.user_id)}\n        />\n      )}\n    </div>\n  );\n}\n/* ============================================================\n   6. INVITATIONS DE GROUPE EN ATTENTE`,
    `      {actionMember && (\n        <MemberActionSheet T={T} member={actionMember} onClose={() => setActionMember(null)}\n          onPromote={() => promote(actionMember.user_id)}\n          onDemote={() => demote(actionMember.user_id)}\n          onKick={() => kick(actionMember.user_id)}\n        />\n      )}\n      {showAddMembers && (\n        <AddMembersModal sb={sb} T={T} Av={Av} Btn={Btn} session={session} group={group}\n          members={allMembers} myConnections={myConnections} myFollowers={myFollowers}\n          existingMemberIds={members.map(m => m.user_id)}\n          onClose={() => setShowAddMembers(false)}\n          onAdded={loadMembers}\n          notify={notify}\n        />\n      )}\n    </div>\n  );\n}\n/* ============================================================\n   6. INVITATIONS DE GROUPE EN ATTENTE`
  );

  writeNormalized(GROUPS_PATH, content, hasBOM);
  console.log("[OK] src/Groups.jsx patché (8 modifications).");
}

/* ------------------------------------------------------------------ */
/* 2. App.jsx                                                          */
/* ------------------------------------------------------------------ */

{
  const { normalized, hasBOM } = readNormalized(APP_PATH);
  let content = normalized;

  content = applyEdit(
    content,
    "App.jsx -> transmission de members/myConnections/myFollowers à GroupChatScreen",
    `{openGroup&&(\n  <GroupChatScreen sb={sb} T={T} Av={Av} Btn={Btn} group={openGroup} session={session}\n    notify={notify} onBack={()=>{popNav();setOpenGroup(null);}}\n    onOpenProfile={uid=>{setOpenGroup(null);pushNav(()=>setOpenUserId(null));setOpenUserId(uid);}}/>\n)}`,
    `{openGroup&&(\n  <GroupChatScreen sb={sb} T={T} Av={Av} Btn={Btn} group={openGroup} session={session}\n    members={members} myConnections={myConnections} myFollowers={myFollowers}\n    notify={notify} onBack={()=>{popNav();setOpenGroup(null);}}\n    onOpenProfile={uid=>{setOpenGroup(null);pushNav(()=>setOpenUserId(null));setOpenUserId(uid);}}/>\n)}`
  );

  writeNormalized(APP_PATH, content, hasBOM);
  console.log("[OK] src/App.jsx patché (1 modification).");
}

console.log("\nTerminé. Pense à relancer le build/dev server.");
