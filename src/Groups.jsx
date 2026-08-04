// Groups.jsx
// Module autonome pour les groupes de discussion (façon WhatsApp).
// Connecté à App.jsx uniquement par import — aucune dépendance inverse.
// La messagerie du groupe (écran de chat, envoi de messages/médias) sera
// branchée dans une prochaine étape, une fois cette brique validée.

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { X, Search, Check, Camera, Users, Lock, ChevronRight, ChevronLeft, Send, Smile } from "lucide-react";
import { uploadToR2 } from "./uploadMedia";
import StickerPicker from "./components/StickerPicker";
import {
  groupMessagesByDay, DayDivider, QUICK_REACTIONS, ReactionBar, InlineReactionPicker,
  useLongPress, useDoubleTap, HeartBurst, ReplyComposerBar, MessageReplyQuote,
  useTypingIndicator, TypingIndicator, EditedBadge, SwipeToReply
} from "./ChatExtras";
/* ============================================================
   1. RÉGLAGE "QUI PEUT M'AJOUTER À UN GROUPE"
   ============================================================ */

const GROUP_PRIVACY_OPTIONS = [
  { key: "everyone", label: "Tout le monde" },
  { key: "followers", label: "Mes abonnés" },
  { key: "none", label: "Personne" },
];

export async function saveGroupInvitePermission(sb, userId, value) {
  return sb.from("profiles").update({ group_invite_permission: value }).eq("id", userId);
}

export function GroupPrivacySetting({ sb, T, Btn, session, value, onChange, notify }) {
  useEffect(() => {
    (async () => {
      if (!session?.user?.id) return;
      const { data } = await sb.from("profiles").select("group_invite_permission").eq("id", session.user.id).maybeSingle();
      if (data?.group_invite_permission) onChange(data.group_invite_permission);
    })();
  }, [session?.user?.id]);

  const choose = async (key) => {
    onChange(key);
    await saveGroupInvitePermission(sb, session?.user?.id, key);
    notify?.("Préférence enregistrée ✦");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: "0 0 4px", fontSize: 13, color: T.muted }}>Qui peut m'ajouter à un groupe</p>
      {GROUP_PRIVACY_OPTIONS.map(o => (
        <Btn key={o.key} onClick={() => choose(o.key)} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 14px", borderRadius: 12,
          border: `1px solid ${value === o.key ? T.gold : T.border}`,
          background: value === o.key ? "rgba(201,149,42,0.08)" : "transparent",
          color: value === o.key ? T.goldL : T.text, fontSize: 14
        }}>
          {o.label}
          {value === o.key && <Check size={16} />}
        </Btn>
      ))}
      <p style={{ margin: "6px 0 0", fontSize: 11, color: T.muted }}>
        Dans tous les cas, une invitation doit être acceptée avant d'entrer dans un groupe.
      </p>
    </div>
  );
}

/* ============================================================
   2. LISTE DES GROUPES DE L'UTILISATEUR
   ============================================================ */

export function useMyGroups(sb, userId) {
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
    const ch = sb.channel(`my_groups_${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, userId, load]);
  return { groups, reloadGroups: load };
}

export function GroupRow({ g, T, Av, onOpen }) {
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
}

/* ============================================================
   3. CRÉATION D'UN GROUPE (modale plein écran, façon WhatsApp)
   ============================================================ */

export async function createGroup(sb, { name, photoUrl, creatorId, memberIds }) {
  const { data: group, error } = await sb.from("groups").insert({ name, photo_url: photoUrl || null, created_by: creatorId }).select().single();
  if (error) throw error;

  const rows = [
    { group_id: group.id, user_id: creatorId, role: "admin", status: "accepted", invited_by: creatorId },
    ...memberIds.map(uid => ({ group_id: group.id, user_id: uid, role: "member", status: "pending", invited_by: creatorId })),
  ];
  await sb.from("group_members").insert(rows);

  // Notifie chaque invité — adapte les noms de colonnes à ta table `notifications` existante
 for (const uid of memberIds) {
  const { error: notifErr } = await sb.from("notifications").insert({
    user_id: uid, type: "group_invite", from_id: creatorId,
    post_id: group.id, text: name, read: false
  });
  if (notifErr) console.error("Notif non envoyée:", notifErr);
}

  return group;
}

export function CreateGroupModal({ sb, T, Av, Btn, session, members, myConnections, myFollowers, onClose, onCreated, notify }) {
  const [step, setStep] = useState(1); // 1 = choix des membres, 2 = nom + photo
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState(null);
  const [saving, setSaving] = useState(false);

  const candidates = useMemo(() => {
    const known = new Set([...(myConnections || []), ...(myFollowers || [])]);
    return (members || [])
      .filter(m => m.id !== session?.user?.id)
      .filter(m => !query.trim() || (m.fullName || m.name || "").toLowerCase().includes(query.trim().toLowerCase()))
      .map(m => {
        const perm = m.group_invite_permission || "everyone";
        const eligible = perm === "everyone" || (perm === "followers" && (myConnections || []).includes(m.id));
        return { ...m, __eligible: eligible, __known: known.has(m.id) };
      })
      .sort((a, b) => (b.__known - a.__known) || (b.__eligible - a.__eligible));
  }, [members, query, myConnections, myFollowers, session?.user?.id]);

  const toggle = (uid) => setSelected(s => s.includes(uid) ? s.filter(x => x !== uid) : [...s, uid]);

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(reader.result); // aperçu local ; upload réel vers R2 à brancher au moment de la création
    reader.readAsDataURL(file);
  };

  const submitLock = useRef(false);
  const submit = async () => {
    if (!name.trim() || selected.length === 0 || submitLock.current) return;
    submitLock.current = true;
    setSaving(true);
    try {
      const group = await createGroup(sb, { name: name.trim(), photoUrl, creatorId: session.user.id, memberIds: selected });
      notify?.("Groupe créé ✦");
      onCreated?.(group);
      onClose?.();
    } catch (e) {
      console.error("Erreur création groupe:", e);
      notify?.(`Erreur : ${e?.message || "création du groupe impossible"}`);
      submitLock.current = false;
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
        paddingTop: "calc(10px + env(safe-area-inset-top,0px))",
        borderBottom: `1px solid ${T.border}`, background: "rgba(0,0,0,0.92)"
      }}>
        <Btn onClick={onClose} style={{ color: T.muted }}><X size={22} /></Btn>
        <p style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 700, color: T.text }}>
          {step === 1 ? "Nouveau groupe" : "Détails du groupe"}
        </p>
        {step === 1 && (
          <Btn onClick={() => selected.length > 0 && setStep(2)} disabled={selected.length === 0}
            style={{ color: selected.length > 0 ? T.goldL : T.muted, fontWeight: 700, fontSize: 14 }}>
            Suivant ({selected.length})
          </Btn>
        )}
      </div>

      {step === 1 && (
        <>
          <div style={{ padding: "10px 14px" }}>
            <div style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, borderRadius: 20, padding: "9px 14px", display: "flex", gap: 8, alignItems: "center" }}>
              <Search size={14} color={T.muted} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher…"
                style={{ flex: 1, background: "none", border: "none", color: T.text, fontSize: 13, outline: "none" }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {candidates.map(m => (
              <div key={m.id} onClick={() => m.__eligible && toggle(m.id)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                opacity: m.__eligible ? 1 : 0.4, cursor: m.__eligible ? "pointer" : "not-allowed"
              }}>
                <Av u={m} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, color: T.text }}>{m.fullName || m.name}</p>
                  {!m.__eligible && <p style={{ margin: 0, fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}><Lock size={10} /> N'accepte pas les invitations de groupe</p>}
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", border: `2px solid ${selected.includes(m.id) ? T.gold : T.border}`,
                  background: selected.includes(m.id) ? T.gold : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {selected.includes(m.id) && <Check size={13} color="#000" />}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <label style={{ position: "relative", cursor: "pointer" }}>
            <div style={{
              width: 96, height: 96, borderRadius: "50%", background: "rgba(255,255,255,0.06)",
              border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center",
              backgroundImage: photoUrl ? `url(${photoUrl})` : undefined, backgroundSize: "cover", backgroundPosition: "center"
            }}>
              {!photoUrl && <Camera size={26} color={T.muted} />}
            </div>
            <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
          </label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom du groupe" autoFocus
            style={{
              width: "100%", maxWidth: 320, background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`,
              borderRadius: 14, padding: "12px 16px", color: T.text, fontSize: 15, outline: "none", textAlign: "center"
            }} />
          <p style={{ fontSize: 12, color: T.muted, textAlign: "center" }}>
            {selected.length} membre{selected.length !== 1 ? "s" : ""} invité{selected.length !== 1 ? "s" : ""} — chacun devra accepter pour rejoindre le groupe
          </p>
          <Btn onClick={submit} disabled={!name.trim() || saving} style={{
            width: "100%", maxWidth: 320, padding: "13px", borderRadius: 14,
            background: name.trim() ? T.gradGold : "rgba(255,255,255,0.08)",
            color: name.trim() ? "#000" : T.muted, fontWeight: 700, fontSize: 15
          }}>
            {saving ? "Création…" : "Créer le groupe"}
          </Btn>
        </div>
      )}
    </div>
  );
}
/* ============================================================
   4. ÉCRAN DE CHAT DE GROUPE
   ============================================================ */

export async function toggleGroupReaction(sb, msgId, userId, emoji, currentReactions) {
  const { data: fresh } = await sb.from("group_messages").select("reactions").eq("id", msgId).single();
  const reactions = { ...(fresh?.reactions || currentReactions || {}) };
  if (reactions[userId] === emoji) delete reactions[userId];
  else reactions[userId] = emoji;
  await sb.from("group_messages").update({ reactions }).eq("id", msgId);
  return reactions;
}

export async function editGroupMessage(sb, msgId, newText) {
  return sb.from("group_messages").update({ text: newText, edited_at: new Date().toISOString() }).eq("id", msgId);
}

function GroupMessageBubble({ m, mine, T, Av, myId, showHeader, onOpenProfile, onReply, onLongPress, onDoubleTap, burstOn }) {
  return (
    <SwipeToReply message={m} onReply={onReply} mine={mine}>
      <div style={{ display: "flex", gap: 8, marginTop: showHeader ? 10 : 1, flexDirection: mine ? "row-reverse" : "row" }}>
        {!mine && (
          <div style={{ width: 28, flexShrink: 0 }}>
            {showHeader && <Av u={m.sender} size={28} onClick={() => onOpenProfile?.(m.sender_id)} />}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", maxWidth: "75%", position: "relative" }}>
          {!mine && showHeader && (
            <span onClick={() => onOpenProfile?.(m.sender_id)} style={{ fontSize: 11, fontWeight: 600, color: T.goldL, marginBottom: 2, cursor: "pointer" }}>
              {m.sender?.prenom} {m.sender?.nom}
            </span>
          )}
          <div
            {...useLongPress(() => onLongPress(m))}
            onClick={onDoubleTap}
            style={{
              padding: m.type === "photo" || m.type === "sticker" ? 3 : "9px 13px", borderRadius: 16,
              background: m.type === "sticker" ? "transparent" : (mine ? T.gradGold : "rgba(255,255,255,0.07)"),
              color: mine ? "#000" : T.text, fontSize: 14, wordBreak: "break-word", cursor: "pointer", position: "relative"
            }}
          >
            <HeartBurst show={burstOn} />
            <MessageReplyQuote message={m} mine={mine} T={T} />
            {m.type === "photo" && (
              <img src={m.file_url} style={{ maxWidth: 220, borderRadius: 14, display: "block" }}
                onClick={e => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("celeste_view_img", { detail: { url: m.file_url } })); }} />
            )}
            {m.type === "sticker" && <img src={m.file_url} style={{ width: 100, height: 100, objectFit: "contain", display: "block" }} />}
            {m.type === "text" && m.text}
            {m.type === "text" && <EditedBadge message={m} T={T} />}
          </div>
          <ReactionBar reactions={m.reactions} T={T} myId={myId} mine={mine} onPress={() => onLongPress(m)} />
        </div>
      </div>
    </SwipeToReply>
  );
}

export function GroupChatScreen({ sb, T, Av, Btn, group, session, notify, onBack, onOpenProfile }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [burstMsgId, setBurstMsgId] = useState(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const myId = session?.user?.id;
  const { peerTyping, notifyTyping } = useTypingIndicator(sb, `group_${group.id}`, session);

  const load = useCallback(async () => {
    const { data } = await sb
      .from("group_messages")
      .select("id,sender_id,text,type,file_url,file_name,sticker_id,reply_to_id,reply_to_text,reply_to_author,reactions,edited_at,created_at,sender:profiles!group_messages_sender_id_fkey(id,prenom,nom,avatar_url)")
      .eq("group_id", group.id)
      .order("created_at", { ascending: true })
      .limit(300);
    setMsgs((data || []).map(m => ({ ...m, ts: m.created_at, authorName: m.sender ? `${m.sender.prenom || ""} ${m.sender.nom || ""}`.trim() : "" })));
  }, [sb, group.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = sb.channel(`group_messages:${group.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` }, () => load())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, group.id, load]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText("");
    if (editingMsg) {
      await editGroupMessage(sb, editingMsg.id, t);
      setEditingMsg(null); setSending(false); return;
    }
    const replyPayload = replyTo ? { reply_to_id: replyTo.id, reply_to_text: replyTo.text || "", reply_to_author: replyTo.authorName || "" } : {};
    const { error } = await sb.from("group_messages").insert({ group_id: group.id, sender_id: myId, text: t, type: "text", ...replyPayload });
    if (error) { notify?.("Message non envoyé"); setText(t); }
    setReplyTo(null);
    setSending(false);
  };

  const sendImage = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    try {
      const url = await uploadToR2(f, "group_messages");
      await sb.from("group_messages").insert({ group_id: group.id, sender_id: myId, type: "photo", file_url: url, text: "" });
    } catch (err) {
      notify?.("Erreur d'envoi de l'image");
    }
  };

  const sendSticker = async (sticker) => {
    setShowStickerPicker(false);
    await sb.from("group_messages").insert({ group_id: group.id, sender_id: myId, type: "sticker", file_url: sticker.url, sticker_id: sticker.id, text: "" });
    Promise.resolve(sb.rpc("increment_sticker_usage", { sticker_id: sticker.id })).catch(() => {});
  };

  const doubleTap = useDoubleTap(m => {
    toggleGroupReaction(sb, m.id, myId, "❤️", m.reactions).then(load);
    setBurstMsgId(m.id); setTimeout(() => setBurstMsgId(null), 600);
  });

  const displayList = useMemo(() => {
    const withDividers = groupMessagesByDay(msgs);
    let lastSender = null;
    return withDividers.map(item => {
      if (item._divider) { lastSender = null; return item; }
      const showHeader = lastSender !== item.sender_id;
      lastSender = item.sender_id;
      return { ...item, showHeader };
    });
  }, [msgs]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 250, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
        paddingTop: "calc(10px + env(safe-area-inset-top,0px))",
        borderBottom: `1px solid ${T.border}`, background: "rgba(0,0,0,0.92)"
      }}>
        <Btn onClick={onBack} style={{ color: T.gold }}><ChevronLeft size={22} /></Btn>
        <Av u={{ name: group.name, avatar_url: group.photo_url, initials: (group.name || "?").slice(0, 2).toUpperCase(), color: "#888" }} size={34} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>{group.name}</p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px" }}>
        {displayList.map(item =>
          item._divider
            ? <DayDivider key={item.key} label={item.label} T={T} />
            : (
              <GroupMessageBubble
                key={item.id} m={item} mine={item.sender_id === myId} T={T} Av={Av} myId={myId}
                showHeader={item.showHeader} onOpenProfile={onOpenProfile}
                onReply={m => setReplyTo(m)}
                onLongPress={m => setActionMsg(m)}
                onDoubleTap={() => doubleTap(item)}
                burstOn={burstMsgId === item.id}
              />
            )
        )}
        <div ref={bottomRef} />
      </div>

      {peerTyping && <TypingIndicator T={T} userName="Quelqu'un" />}
      <ReplyComposerBar replyTo={replyTo} T={T} onCancel={() => setReplyTo(null)} />

      <div style={{ display: "flex", gap: 8, padding: "10px 12px", paddingBottom: "calc(10px + env(safe-area-inset-bottom,0px))", borderTop: `1px solid ${T.border}`, position: "relative" }}>
        <input type="file" accept="image/*" ref={fileRef} style={{ display: "none" }} onChange={sendImage} />
        <Btn onClick={() => fileRef.current?.click()} style={{ width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted }}>
          <Camera size={20} />
        </Btn>
        <Btn onClick={() => setShowStickerPicker(v => !v)} style={{ width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: showStickerPicker ? T.goldL : T.muted }}>
          <Smile size={20} />
        </Btn>
        {showStickerPicker && (
          <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, zIndex: 40 }}>
            <StickerPicker sb={sb} userId={myId} T={T} onClose={() => setShowStickerPicker(false)} onSelect={sendSticker} />
          </div>
        )}
        <input
          value={text}
          onChange={e => { setText(e.target.value); notifyTyping(); }}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder={editingMsg ? "Modifier le message…" : "Message…"}
          style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, borderRadius: 20, padding: "10px 16px", color: T.text, fontSize: 14, outline: "none" }}
        />
        <Btn onClick={send} disabled={!text.trim()} style={{
          width: 40, height: 40, borderRadius: "50%",
          background: text.trim() ? T.gradGold : "rgba(255,255,255,0.08)",
          color: text.trim() ? "#000" : T.muted, display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <Send size={17} />
        </Btn>
      </div>

      {actionMsg && (
        <div style={{ position: "fixed", inset: 0, zIndex: 260, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }} onClick={() => setActionMsg(null)}>
          <div style={{ width: "100%", background: "#111", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "16px 0 24px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "center", gap: 14, padding: "0 16px 14px", borderBottom: `1px solid ${T.border}` }}>
              {QUICK_REACTIONS.map(em => (
                <span key={em} onClick={() => { toggleGroupReaction(sb, actionMsg.id, myId, em, actionMsg.reactions).then(load); setActionMsg(null); }} style={{ fontSize: 24, cursor: "pointer" }}>{em}</span>
              ))}
            </div>
            <div onClick={() => { setReplyTo(actionMsg); setActionMsg(null); }} style={{ padding: "14px 20px", fontSize: 15, color: T.text, cursor: "pointer" }}>Répondre</div>
            {actionMsg.sender_id === myId && actionMsg.type === "text" && (
              <div onClick={() => { setEditingMsg(actionMsg); setText(actionMsg.text); setActionMsg(null); }} style={{ padding: "14px 20px", fontSize: 15, color: T.text, cursor: "pointer" }}>Modifier</div>
            )}
            {actionMsg.sender_id === myId && (
              <div onClick={async () => { await sb.from("group_messages").delete().eq("id", actionMsg.id); setActionMsg(null); load(); }} style={{ padding: "14px 20px", fontSize: 15, color: T.err || "#c84040", cursor: "pointer" }}>Supprimer</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}