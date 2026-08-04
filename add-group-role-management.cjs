// add-group-role-management.cjs
// Ajoute dans Groups.jsx (GroupInfoScreen) :
//  - un admin peut promouvoir/rétrograder un membre, ou l'exclure du groupe
//  - le badge "Admin" reflète désormais le vrai rôle (role === "admin"), plus seulement le créateur
//  - une feuille d'action (MemberActionSheet) s'ouvre au clic sur un membre, si on est admin
//
// Prérequis : la migration SQL (fonction is_group_admin + policies RLS "Un admin peut gérer
// les membres" / "Un admin peut exclure un membre") doit déjà être appliquée côté Supabase.
//
// Usage : place ce fichier à la racine du projet (à côté du dossier src/), puis :
//   node add-group-role-management.cjs

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "src", "Groups.jsx");
const raw = fs.readFileSync(FILE, "utf8");
const hadCRLF = raw.includes("\r\n");
let src = raw.replace(/\r\n/g, "\n");
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

// 1. Ajoute le composant MemberActionSheet juste avant GroupInfoScreen
apply(
  "ajout du composant MemberActionSheet",
  `export function GroupInfoScreen({ sb, T, Av, Btn, group, session, notify, onBack, onLeftGroup, onDeletedGroup }) {`,
  `function MemberActionSheet({ T, member, onPromote, onDemote, onKick, onClose }) {
  const memberIsAdmin = member.role === "admin";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 290, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ width: "100%", background: "#111", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "20px 0 30px" }} onClick={e => e.stopPropagation()}>
        <p style={{ margin: "0 20px 14px", fontSize: 16, fontWeight: 700, color: T.text }}>{member.profiles?.prenom} {member.profiles?.nom}</p>
        <div onClick={memberIsAdmin ? onDemote : onPromote} style={{ padding: "14px 20px", fontSize: 15, color: T.text, cursor: "pointer" }}>
          {memberIsAdmin ? "Retirer le rôle admin" : "Promouvoir admin"}
        </div>
        <div onClick={onKick} style={{ padding: "14px 20px", fontSize: 15, color: T.err || "#c84040", cursor: "pointer" }}>
          Exclure du groupe
        </div>
      </div>
    </div>
  );
}

export function GroupInfoScreen({ sb, T, Av, Btn, group, session, notify, onBack, onLeftGroup, onDeletedGroup }) {`
);

// 2. state + isAdmin + chargement des membres réutilisable + actions promote/demote/kick
apply(
  "ajout de l'état et des actions admin",
  `  const [members, setMembers] = useState([]);
  const [showReport, setShowReport] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const myId = session?.user?.id;
  const isCreator = group.created_by === myId;

  useEffect(() => {
    sb.from("group_members").select("user_id,role,profiles:user_id(id,prenom,nom,avatar_url)").eq("group_id", group.id).eq("status", "accepted")
      .then(({ data }) => setMembers(data || []));
  }, [sb, group.id]);`,
  `  const [members, setMembers] = useState([]);
  const [showReport, setShowReport] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionMember, setActionMember] = useState(null);
  const myId = session?.user?.id;
  const isCreator = group.created_by === myId;
  const myMembership = members.find(m => m.user_id === myId);
  const isAdmin = isCreator || myMembership?.role === "admin";

  const loadMembers = useCallback(() => {
    sb.from("group_members").select("user_id,role,profiles:user_id(id,prenom,nom,avatar_url)").eq("group_id", group.id).eq("status", "accepted")
      .then(({ data }) => setMembers(data || []));
  }, [sb, group.id]);
  useEffect(() => { loadMembers(); }, [loadMembers]);

  const promote = async (uid) => {
    await sb.from("group_members").update({ role: "admin" }).eq("group_id", group.id).eq("user_id", uid);
    setActionMember(null);
    notify?.("Membre promu admin ✦");
    loadMembers();
  };
  const demote = async (uid) => {
    await sb.from("group_members").update({ role: "member" }).eq("group_id", group.id).eq("user_id", uid);
    setActionMember(null);
    notify?.("Rôle admin retiré");
    loadMembers();
  };
  const kick = async (uid) => {
    await sb.from("group_members").delete().eq("group_id", group.id).eq("user_id", uid);
    setActionMember(null);
    notify?.("Membre exclu du groupe");
    loadMembers();
  };`
);

// 3. Ligne de membre cliquable pour les admins, badge Admin basé sur le vrai rôle
apply(
  "membre cliquable + badge Admin basé sur role",
  `          {members.map(m => (
            <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px" }}>
              <Av u={m.profiles} size={40} />
              <p style={{ margin: 0, fontSize: 14, color: T.text, flex: 1 }}>{m.profiles?.prenom} {m.profiles?.nom}</p>
              {m.user_id === group.created_by && <span style={{ fontSize: 11, color: T.goldL }}>Admin</span>}
            </div>
          ))}`,
  `          {members.map(m => {
            const canManage = isAdmin && m.user_id !== myId;
            return (
              <div key={m.user_id} onClick={() => canManage && setActionMember(m)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", cursor: canManage ? "pointer" : "default" }}>
                <Av u={m.profiles} size={40} />
                <p style={{ margin: 0, fontSize: 14, color: T.text, flex: 1 }}>{m.profiles?.prenom} {m.profiles?.nom}</p>
                {m.role === "admin" && <span style={{ fontSize: 11, color: T.goldL, marginRight: canManage ? 4 : 0 }}>Admin</span>}
                {canManage && <ChevronRight size={14} color={T.muted} />}
              </div>
            );
          })}`
);

// 4. Rendu de la feuille d'action en bas de GroupInfoScreen
apply(
  "rendu de MemberActionSheet",
  `      {showReport && <ReportSheet T={T} reasons={GROUP_REPORT_REASONS} onClose={() => setShowReport(false)} onSubmit={submitReport} />}
    </div>
  );
}`,
  `      {showReport && <ReportSheet T={T} reasons={GROUP_REPORT_REASONS} onClose={() => setShowReport(false)} onSubmit={submitReport} />}
      {actionMember && (
        <MemberActionSheet T={T} member={actionMember} onClose={() => setActionMember(null)}
          onPromote={() => promote(actionMember.user_id)}
          onDemote={() => demote(actionMember.user_id)}
          onKick={() => kick(actionMember.user_id)}
        />
      )}
    </div>
  );
}`
);

if (hadCRLF) src = src.replace(/\n/g, "\r\n");
fs.writeFileSync(FILE, src, "utf8");
console.log(`\n${changes} modification(s) appliquée(s) avec succès dans src/Groups.jsx.`);
