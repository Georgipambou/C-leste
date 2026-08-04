// add-group-last-message-unread.cjs
// Ajoute dans Groups.jsx :
//  1. useMyGroups() utilise désormais get_my_groups_summary() (RPC créée côté Supabase)
//     pour récupérer en un seul appel le dernier message + le compteur de non-lus par groupe.
//  2. GroupRow affiche ce dernier message, l'heure, et un badge de non-lus (façon WhatsApp).
//  3. GroupChatScreen appelle mark_group_read() à l'ouverture pour remettre le compteur à zéro.
//
// Prérequis : la migration SQL (colonne group_members.last_read_at + fonctions
// get_my_groups_summary / mark_group_read) doit déjà être appliquée côté Supabase.
//
// Usage : place ce fichier à la racine du projet (à côté du dossier src/), puis :
//   node add-group-last-message-unread.cjs

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

// 1. useMyGroups : passe par la RPC get_my_groups_summary (dernier message + non-lus inclus)
apply(
  "useMyGroups → get_my_groups_summary",
  `export function useMyGroups(sb, userId) {
  const [groups, setGroups] = useState([]);
  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await sb
      .from("group_members")
      .select("status, role, groups(id,name,photo_url,created_at)")
      .eq("user_id", userId)
      .eq("status", "accepted");
    setGroups((data || []).map(r => ({ ...r.groups, myRole: r.role })));
  }, [sb, userId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!userId) return;
    const ch = sb.channel(\`my_groups_\${userId}\`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: \`user_id=eq.\${userId}\` }, () => load())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, userId, load]);
  return { groups, reloadGroups: load };
}`,
  `function formatGroupTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export function useMyGroups(sb, userId) {
  const [groups, setGroups] = useState([]);
  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await sb.rpc("get_my_groups_summary");
    if (error) { console.error("Erreur chargement des groupes:", error); return; }
    setGroups((data || []).map(g => ({
      id: g.id,
      name: g.name,
      photo_url: g.photo_url,
      myRole: g.role,
      lastMessageText: g.last_message_text,
      lastMessageType: g.last_message_type,
      lastMessageAt: g.last_message_at,
      lastSenderId: g.last_sender_id,
      lastSenderName: g.last_sender_name,
      unreadCount: Number(g.unread_count) || 0,
    })));
  }, [sb, userId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!userId) return;
    const ch = sb.channel(\`my_groups_\${userId}\`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: \`user_id=eq.\${userId}\` }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages" }, () => load())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, userId, load]);
  return { groups, reloadGroups: load };
}`
);

// 2. GroupRow : dernier message + heure + badge de non-lus
apply(
  "GroupRow → dernier message + badge non-lus",
  `export function GroupRow({ g, T, Av, onOpen }) {
  return (
    <div onClick={() => onOpen(g)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", cursor: "pointer" }}>
      <Av u={{ name: g.name, avatar_url: g.photo_url, initials: (g.name || "?").slice(0, 2).toUpperCase(), color: "#888" }} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</p>
        <p style={{ margin: 0, fontSize: 12, color: T.muted }}>Groupe</p>
      </div>
      <ChevronRight size={16} color={T.muted} />
    </div>
  );
}`,
  `export function GroupRow({ g, T, Av, onOpen }) {
  const hasLast = !!g.lastMessageAt;
  const previewBody = g.lastMessageType === "photo" ? "📷 Photo"
    : g.lastMessageType === "sticker" ? "Sticker"
    : (g.lastMessageText || "");
  const preview = hasLast
    ? (g.lastSenderName ? \`\${g.lastSenderName} : \${previewBody}\` : previewBody)
    : "Groupe";
  const unread = g.unreadCount > 0;
  return (
    <div onClick={() => onOpen(g)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", cursor: "pointer" }}>
      <Av u={{ name: g.name, avatar_url: g.photo_url, initials: (g.name || "?").slice(0, 2).toUpperCase(), color: "#888" }} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</p>
        <p style={{ margin: 0, fontSize: 12, color: unread ? T.text : T.muted, fontWeight: unread ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        {hasLast && <span style={{ fontSize: 11, color: unread ? T.goldL : T.muted, fontWeight: unread ? 700 : 400 }}>{formatGroupTime(g.lastMessageAt)}</span>}
        {unread && (
          <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: T.gradGold, color: "#000", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {g.unreadCount > 99 ? "99+" : g.unreadCount}
          </span>
        )}
      </div>
    </div>
  );
}`
);

// 3. GroupChatScreen : marque le groupe comme lu à l'ouverture
apply(
  "GroupChatScreen → mark_group_read à l'ouverture",
  `  useEffect(() => {
    const ch = sb.channel(\`group_messages:\${group.id}\`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_messages", filter: \`group_id=eq.\${group.id}\` }, () => load())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, group.id, load]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);`,
  `  useEffect(() => {
    const ch = sb.channel(\`group_messages:\${group.id}\`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_messages", filter: \`group_id=eq.\${group.id}\` }, () => load())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, group.id, load]);

  useEffect(() => {
    if (!group?.id || !myId) return;
    sb.rpc("mark_group_read", { p_group_id: group.id }).catch(() => {});
  }, [sb, group?.id, myId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);`
);

if (hadCRLF) src = src.replace(/\n/g, "\r\n");
fs.writeFileSync(FILE, src, "utf8");
console.log(`\n${changes} modification(s) appliquée(s) avec succès dans src/Groups.jsx.`);
