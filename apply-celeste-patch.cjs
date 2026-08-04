#!/usr/bin/env node
// apply-celeste-patch.js
// Applique 3 correctifs :
//  1) App.jsx  : supprime le bloc "const label" dupliqué qui cassait le JSX de l'écran Messages
//  2) App.jsx  : affiche enfin les invitations de groupe en attente (PendingGroupInviteCard)
//  3) Groups.jsx : corrige PendingGroupInviteCard qui utilisait invite.__myId (toujours undefined)
//
// Usage :
//   node apply-celeste-patch.js
// (à lancer depuis la racine du projet C-leste, ou avec --dir "chemin/vers/src")

const fs = require("fs");
const path = require("path");

const dir = (() => {
  const i = process.argv.indexOf("--dir");
  return i !== -1 ? process.argv[i + 1] : "src";
})();

const APP_PATH = path.join(dir, "App.jsx");
const GROUPS_PATH = path.join(dir, "Groups.jsx");

function readNormalized(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const usesCRLF = raw.includes("\r\n");
  return { content: raw.replace(/\r\n/g, "\n"), usesCRLF };
}

function writeBack(filePath, content, usesCRLF) {
  fs.writeFileSync(filePath, usesCRLF ? content.replace(/\n/g, "\r\n") : content, "utf8");
}

function applyReplace(content, oldStr, newStr, label, stats) {
  const count = content.split(oldStr).length - 1;
  if (count === 0) {
    console.warn(`  [SKIP] ${label} — motif introuvable (déjà appliqué ?)`);
    return content;
  }
  if (count > 1) {
    console.warn(`  [WARN] ${label} — motif trouvé ${count} fois (attendu 1), seul le premier est remplacé`);
  }
  stats.applied++;
  return content.replace(oldStr, newStr);
}

/* ---------------------------------------------------------- */
/* 1) App.jsx — bloc "const label" dupliqué dans le JSX        */
/* ---------------------------------------------------------- */

function patchAppDuplicateLabel(content, stats) {
  const oldStr = `        const label=n=>({
    like:"a aimé ta publication",
    comment:"a commenté ta publication",
    reply:"a répondu à ton commentaire",
    comment_like:"a aimé ton commentaire",
    follow:"a commencé à te suivre",
    mention:"t'a mentionné",
    new_post_favorite:"a publié du nouveau contenu",
    status_like:"a aimé ton statut",
    status_view:"a vu ton statut",
    post_deleted:n.text||"Une de tes publications a été supprimée",
    warning:n.text||"Avertissement de l'équipe Céleste",
    approved:"Ton compte a été validé ✦",
    earning:n.text||"Nouveau gain",
    poll_ended:n.text||"Ton sondage est terminé",
    group_invite:\`t'a invité à rejoindre "\${n.text||"un groupe"}"\`,
  }[n.type]||n.text||n.type);`;

  const newStr = `        {filter==="groupes"&&(
          <>
            {groups.length===0&&(`;

  return applyReplace(content, oldStr, newStr, "bloc const label dupliqué (écran Messages)", stats);
}

/* ---------------------------------------------------------- */
/* 2) App.jsx — brancher l'affichage des invitations en attente*/
/* ---------------------------------------------------------- */

function patchAppShowInvites(content, stats) {
  const oldStr = `  const {invites}=usePendingGroupInvites(sb,session?.user?.id);`;
  const newStr = `  const {invites,reloadInvites}=usePendingGroupInvites(sb,session?.user?.id);`;
  content = applyReplace(content, oldStr, newStr, "capture de reloadInvites", stats);

  const oldHeader = `      </div>

      {/* Liste conversations */}`;
  const newHeader = `      </div>

      {invites&&invites.length>0&&(
        <div style={{maxWidth:640,margin:"0 auto",padding:"4px 0"}}>
          {invites.map(inv=>(
            <PendingGroupInviteCard key={inv.group_id} sb={sb} T={T} Av={Av} Btn={Btn}
              invite={inv} userId={session?.user?.id}
              notify={notify}
            />
          ))}
        </div>
      )}

      {/* Liste conversations */}`;

  content = applyReplace(content, oldHeader, newHeader, "affichage des invitations en attente (PendingGroupInviteCard)", stats);
  return content;
}

/* ---------------------------------------------------------- */
/* 3) Groups.jsx — invite.__myId n'existe pas                  */
/* ---------------------------------------------------------- */

function patchGroupsInviteCard(content, stats) {
  const oldStr = `export function PendingGroupInviteCard({ sb, T, Av, Btn, invite, notify }) {
  const g = invite.groups;
  const respond = async (accept) => {
    if (accept) {
      await sb.from("group_members").update({ status: "accepted" }).eq("group_id", invite.group_id).eq("user_id", invite.__myId);
      notify?.(\`Tu as rejoint "\${g.name}" ✦\`);
    } else {
      await sb.from("group_members").delete().eq("group_id", invite.group_id).eq("user_id", invite.__myId);
      notify?.("Invitation refusée");
    }
  };`;

  const newStr = `export function PendingGroupInviteCard({ sb, T, Av, Btn, invite, userId, notify }) {
  const g = invite.groups;
  const respond = async (accept) => {
    if (accept) {
      await sb.from("group_members").update({ status: "accepted" }).eq("group_id", invite.group_id).eq("user_id", userId);
      notify?.(\`Tu as rejoint "\${g.name}" ✦\`);
    } else {
      await sb.from("group_members").delete().eq("group_id", invite.group_id).eq("user_id", userId);
      notify?.("Invitation refusée");
    }
  };`;

  return applyReplace(content, oldStr, newStr, "invite.__myId → userId (PendingGroupInviteCard)", stats);
}

/* ---------------------------------------------------------- */
/* 4) Groups.jsx — sb.rpc(...).catch is not a function          */
/* ---------------------------------------------------------- */

function patchGroupsRpcCatch(content, stats) {
  const oldStr = `    sb.rpc("mark_group_read", { p_group_id: group.id }).catch(() => {});`;
  const newStr = `    Promise.resolve(sb.rpc("mark_group_read", { p_group_id: group.id })).catch(() => {});`;
  return applyReplace(content, oldStr, newStr, "sb.rpc(...).catch n'est pas une fonction (mark_group_read)", stats);
}

/* ---------------------------------------------------------- */

function patchFile(filePath, patchers) {
  const relPath = path.relative(process.cwd(), filePath) || filePath;
  if (!fs.existsSync(filePath)) {
    console.error(`[ERREUR] ${relPath} introuvable — vérifie --dir`);
    process.exitCode = 1;
    return;
  }
  const backupPath = filePath + ".bak";
  if (!fs.existsSync(backupPath)) fs.copyFileSync(filePath, backupPath);

  const { content, usesCRLF } = readNormalized(filePath);
  const stats = { applied: 0 };
  const patched = patchers.reduce((c, fn) => fn(c, stats), content);

  if (stats.applied > 0) writeBack(filePath, patched, usesCRLF);
  console.log(`[OK] ${relPath} patché (${stats.applied} modification${stats.applied !== 1 ? "s" : ""}).`);
}

patchFile(APP_PATH, [patchAppDuplicateLabel, patchAppShowInvites]);
patchFile(GROUPS_PATH, [patchGroupsInviteCard, patchGroupsRpcCatch]);

console.log("Terminé. Pense à relancer le build/dev server.");
