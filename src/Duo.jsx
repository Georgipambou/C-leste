import { useState, useEffect } from "react";
import { Users, X, Search, Check } from "lucide-react";

// ============================================================
// DUO — collaboration entre posts (étape 1 : social uniquement,
// pas de portefeuille branché ici)
// ============================================================

// ---------- Bouton "Ajouter en duo" dans NewPostModal ----------
export function DuoButton({ sb, T, Av, Btn, Badge, session, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = value || [];

  return (
    <>
      <div onClick={() => setOpen(true)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <Users size={14} color={selected.length ? T.goldL : T.muted} />
        <span style={{ fontSize: 12, color: selected.length ? T.goldL : T.muted, flex: 1 }}>
          {selected.length ? `Duo · ${selected.length} personne${selected.length > 1 ? "s" : ""}` : "Ajouter en duo"}
        </span>
      </div>
      {open && (
        <DuoPickerModal
          sb={sb} T={T} Av={Av} Btn={Btn} Badge={Badge} session={session}
          initialSelected={selected}
          onClose={() => setOpen(false)}
          onConfirm={(list) => { onChange(list); setOpen(false); }}
        />
      )}
    </>
  );
}

function DuoPickerModal({ sb, T, Av, Btn, Badge, session, initialSelected, onClose, onConfirm }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(initialSelected || []);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(new Set());

  useEffect(() => {
    sb.from("connections").select("to_id").eq("from_id", session.user.id).then(({ data }) => {
      setFollowing(new Set((data || []).map(r => r.to_id)));
    });
  }, [sb, session.user.id]);

  const follow = async (id) => {
    setFollowing(prev => new Set(prev).add(id));
    await sb.from("connections").insert({ from_id: session.user.id, to_id: id });
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    sb.rpc("search_duo_candidates", { p_search: search.trim() }).then(({ data }) => {
      if (active) { setResults(data || []); setLoading(false); }
    });
    return () => { active = false; };
  }, [search, sb]);

  const toggle = (p) => {
    setSelected(prev => prev.some(u => u.id === p.id) ? prev.filter(u => u.id !== p.id) : [...prev, p]);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxHeight: "75vh", background: T.card, borderRadius: "20px 20px 0 0", padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>Ajouter en duo</p>
          <Btn onClick={onClose}><X size={18} color={T.muted} /></Btn>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "8px 12px" }}>
          <Search size={14} color={T.muted} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: T.text, fontSize: 13 }} />
        </div>

        {selected.length > 0 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {selected.map(u => (
              <div key={u.id} onClick={() => toggle(u)} style={{ position: "relative", flexShrink: 0, cursor: "pointer" }}>
                <Av u={{ ...u, fullName: `${u.prenom || ""} ${u.nom || ""}`.trim() }} size={44} ring />
                <div style={{ position: "absolute", top: -2, right: -2, width: 16, height: 16, borderRadius: "50%", background: "#B71C1C", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={10} color="#fff" />
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, minHeight: 120 }}>
          {loading ? <p style={{ color: T.muted, fontSize: 12 }}>Recherche…</p>
            : results.length === 0 ? <p style={{ color: T.muted, fontSize: 12, lineHeight: 1.6 }}>Aucun résultat — chacun choisit qui peut l'ajouter en duo dans ses réglages de confidentialité.</p>
            : results.map(p => {
              const isSel = selected.some(u => u.id === p.id);
              const isFollowed = following.has(p.id);
              return (
                <div key={p.id} onClick={() => toggle(p)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", cursor: "pointer" }}>
                  <Av u={{ ...p, fullName: `${p.prenom || ""} ${p.nom || ""}`.trim() }} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 13, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.prenom} {p.nom}</span>
                      {p.badge && Badge && <Badge type={p.badge} />}
                    </div>
                    {p.paroisse && <p style={{ margin: "1px 0 0", fontSize: 10, color: T.muted }}>{p.paroisse}</p>}
                  </div>
                  {!isFollowed && (
                    <Btn onClick={e => { e.stopPropagation(); follow(p.id); }} style={{ fontSize: 10, fontWeight: 700, color: T.goldL, padding: "4px 10px", border: `1px solid ${T.gold}55`, borderRadius: 10 }}>Suivre</Btn>
                  )}
                  {isSel && <Check size={16} color={T.goldL} />}
                </div>
              );
            })
          }
        </div>

        <Btn onClick={() => onConfirm(selected)} style={{ background: T.gradGold, color: "#000", fontWeight: 700, borderRadius: 14, padding: "12px 0", textAlign: "center" }}>
          Valider ({selected.length})
        </Btn>
      </div>
    </div>
  );
}

// ---------- Enregistrement en DB après création du post ----------
export async function saveDuoCollaborators(sb, postId, addedBy, collaborators) {
  if (!collaborators || collaborators.length === 0) return;
  const rows = collaborators.map(u => ({ post_id: postId, collaborator_id: u.id, added_by: addedBy }));
  await sb.from("post_collaborators").insert(rows);
}

// ---------- Badge "Duo · N" affiché sur PostCard / Reels ----------
export function DuoBadge({ sb, T, Av, postId, collaborators: collaboratorsProp }) {
  const [collaborators, setCollaborators] = useState(collaboratorsProp || null);
  const [open, setOpen] = useState(false);

  // Filet de sécurité : si jamais un appelant ne passe pas encore la prop
  // (ex. ancien écran pas encore migré), on retombe sur le fetch individuel —
  // mais plus jamais pour le feed principal, qui fournit déjà la donnée.
  useEffect(() => {
    if (collaboratorsProp !== undefined) { setCollaborators(collaboratorsProp || []); return; }
    let active = true;
    sb.from("post_collaborators")
      .select("collaborator_id, profiles:collaborator_id(id,prenom,nom,avatar_url,badge)")
      .eq("post_id", postId)
      .then(({ data }) => { if (active) setCollaborators((data || []).map(r => r.profiles).filter(Boolean)); });
    return () => { active = false; };
  }, [sb, postId, collaboratorsProp]);

  if (!collaborators || collaborators.length === 0) return null;

  return (
    <>
      <div onClick={e => { e.stopPropagation(); setOpen(true); }}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(201,149,42,0.15)", border: `1px solid ${T.gold}55`, borderRadius: 12, padding: "3px 8px", cursor: "pointer" }}>
        <Users size={11} color={T.goldL} />
        <span style={{ fontSize: 10, fontWeight: 700, color: T.goldL }}>Duo · {collaborators.length + 1}</span>
      </div>
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={e => { e.stopPropagation(); setOpen(false); }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "85%", maxWidth: 320, background: T.card, borderRadius: 18, padding: 18 }}>
            <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: T.text }}>Collaboration</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {collaborators.map(u => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Av u={{ ...u, fullName: `${u.prenom || ""} ${u.nom || ""}`.trim() }} size={34} />
                  <span style={{ fontSize: 13, color: T.text }}>{u.prenom} {u.nom}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Réglage confidentialité "qui peut m'ajouter en duo" ----------
export function DuoPrivacySetting({ sb, T, Btn, Av, session, value, onChange, notify }) {
  const [showList, setShowList] = useState(false);

  const setPermission = async (perm) => {
    onChange(perm);
    await sb.from("profiles").update({ duo_permission: perm }).eq("id", session.user.id);
    notify?.(perm === "everyone" ? "Duo ouvert à tout le monde" : perm === "followers" ? "Duo réservé à tes abonnés" : "Duo réservé à ta liste");
  };

  const options = [
    { key: "everyone", label: "Tout le monde" },
    { key: "followers", label: "Mes abonnés uniquement" },
    { key: "specific", label: "Liste spécifique" }
  ];

  return (
    <div style={{ marginBottom: 8 }}>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: T.muted }}>Qui peut m'ajouter en duo</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {options.map(o => (
          <div key={o.key} onClick={() => setPermission(o.key)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${value === o.key ? T.goldL : T.muted}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {value === o.key && <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.goldL }} />}
            </div>
            <span style={{ fontSize: 13, color: T.text }}>{o.label}</span>
          </div>
        ))}
      </div>
      {value === "specific" && (
        <Btn onClick={() => setShowList(true)} style={{ marginTop: 8, fontSize: 12, color: T.goldL, padding: 0 }}>Gérer la liste →</Btn>
      )}
      {showList && (
        <DuoAllowListModal sb={sb} T={T} Av={Av} Btn={Btn} session={session} onClose={() => setShowList(false)} />
      )}
    </div>
  );
}

function DuoAllowListModal({ sb, T, Av, Btn, session, onClose }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [allowed, setAllowed] = useState([]);

  useEffect(() => {
    sb.from("duo_allowed_users").select("allowed_id, profiles:allowed_id(id,prenom,nom,avatar_url)").eq("owner_id", session.user.id).then(({ data }) => {
      setAllowed((data || []).map(r => r.profiles).filter(Boolean));
    });
  }, [sb, session.user.id]);

  useEffect(() => {
    let active = true;
    sb.from("profiles").select("id,prenom,nom,avatar_url").neq("id", session.user.id).ilike("prenom", `%${search}%`).limit(15).then(({ data }) => {
      if (active) setResults(data || []);
    });
    return () => { active = false; };
  }, [search, sb, session.user.id]);

  const isAllowed = id => allowed.some(u => u.id === id);

  const toggle = async (p) => {
    if (isAllowed(p.id)) {
      await sb.from("duo_allowed_users").delete().eq("owner_id", session.user.id).eq("allowed_id", p.id);
      setAllowed(prev => prev.filter(u => u.id !== p.id));
    } else {
      await sb.from("duo_allowed_users").insert({ owner_id: session.user.id, allowed_id: p.id });
      setAllowed(prev => [...prev, p]);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 210, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxHeight: "75vh", background: T.card, borderRadius: "20px 20px 0 0", padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>Ma liste duo ({allowed.length})</p>
          <Btn onClick={onClose}><X size={18} color={T.muted} /></Btn>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
          style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 12, padding: "8px 12px", color: T.text, fontSize: 13, outline: "none" }} />
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {results.map(p => (
            <div key={p.id} onClick={() => toggle(p)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", cursor: "pointer" }}>
              <Av u={{ ...p, fullName: `${p.prenom || ""} ${p.nom || ""}`.trim() }} size={36} />
              <span style={{ flex: 1, fontSize: 13, color: T.text }}>{p.prenom} {p.nom}</span>
              {isAllowed(p.id) && <Check size={16} color={T.goldL} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}