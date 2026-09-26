/**
 * Transactions.jsx — Céleste
 *
 * Fichier autonome (même pattern que DepositScreen.jsx) : reçoit sb, T, Btn,
 * session, notify en props.
 *
 * Écran plein écran listant les transactions marketplace actives (achats et
 * ventes), avec les actions propres à chaque rôle et chaque statut :
 *  - Acheteur, `pending_delivery`  -> voir le code de remise, confirmer la
 *    réception (si le vendeur ne peut/veut pas saisir le code)
 *  - Acheteur, `reserved`          -> payer le solde restant
 *  - Vendeur,  `pending_delivery`  -> saisir le code pour valider la vente
 *  - Les deux                      -> annuler (le serveur applique les
 *    règles : délai, remboursement, commission retenue ou non)
 *
 * N'appelle que des RPC déjà en place : marketplace_confirm_receipt,
 * marketplace_validate_code, marketplace_pay_balance, marketplace_cancel,
 * get_my_transaction_code.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { X, Package, Clock, CheckCircle2, XCircle, Eye, EyeOff, CalendarClock, Pencil, Trash2 } from "lucide-react";

const COLUMNS = "id,buyer_id,seller_id,post_id,quantity,amount,unit_price,commission_percent,commission_amount,seller_amount,status,tx_kind,deposit_amount,balance_due,scheduled_at,expires_at,settled_at,completed_at,created_at,post:posts(id,text,img_url,media_urls),buyer:profiles!transactions_buyer_id_fkey(id,prenom,nom,avatar_url),seller:profiles!transactions_seller_id_fkey(id,prenom,nom,avatar_url)";

function fmt(n) { return Math.round(n || 0).toLocaleString("fr-FR"); }
function fmtDate(d) { return d ? new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null; }

const STATUS_LABEL = {
  reserved: { label: "Réservé · acompte payé", color: "#f5a623" },
  pending_delivery: { label: "En attente de remise", color: "#f5a623" },
  completed: { label: "Terminé", color: "#4ade80" },
  cancelled: { label: "Annulé", color: "#999" },
};

/* ---------------------------------------------------------------- */
function CodeReveal({ sb, T, tx, notify }) {
  const [code, setCode] = useState(null);
  const [loading, setLoading] = useState(false);

  const reveal = async () => {
    setLoading(true);
    try {
      const { data, error } = await sb.rpc("get_my_transaction_code", { p_tx_id: tx.id });
      if (error) throw error;
      setCode(data);
    } catch (e) {
      notify(e.message || "Code indisponible pour l'instant");
    } finally {
      setLoading(false);
    }
  };

  if (code) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: T.bg3, border: `1px solid ${T.gold}55`, borderRadius: 14, padding: "14px 10px" }}>
        <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: 4, color: T.goldL }}>{code}</span>
        <button onClick={() => setCode(null)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}><EyeOff size={16} /></button>
      </div>
    );
  }

  return (
    <button onClick={reveal} disabled={loading} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.bg3, color: T.text, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
      <Eye size={15} /> {loading ? "…" : "Voir mon code de remise"}
    </button>
  );
}

/* ---------------------------------------------------------------- */
function ValidateCodeRow({ sb, T, Btn, tx, notify, onChanged }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (code.trim().length < 4) return;
    setLoading(true);
    try {
      const { data, error } = await sb.rpc("marketplace_validate_code", { p_tx_id: tx.id, p_code: code.trim() });
      if (error) throw error;
      if (!data?.success) { notify(data?.error || "Code incorrect"); setCode(""); return; }
      notify("Vente validée ✦ Fonds crédités");
      onChanged();
    } catch (e) {
      notify(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="Code à 6 chiffres" inputMode="numeric"
        style={{ flex: 1, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 12, padding: "11px 14px", color: T.text, fontSize: 15, letterSpacing: 3, textAlign: "center", outline: "none" }}
      />
      <Btn onClick={submit} disabled={loading || code.length < 4} style={{ padding: "0 20px", borderRadius: 12, background: T.gradGold, color: "#000", fontWeight: 800, fontSize: 13, opacity: loading || code.length < 4 ? 0.5 : 1 }}>
        {loading ? "…" : "Valider"}
      </Btn>
    </div>
  );
}

/* ---------------------------------------------------------------- */
function TransactionCard({ sb, T, Btn, tx, myId, notify, onChanged }) {
  const isSeller = tx.seller_id === myId;
  const other = isSeller ? tx.buyer : tx.seller;
  const st = STATUS_LABEL[tx.status] || { label: tx.status, color: T.muted };
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    setBusy(true);
    try {
      const { data, error } = await sb.rpc("marketplace_cancel", { p_tx_id: tx.id });
      if (error) throw error;
      if (!data?.success) { notify(data?.error || "Annulation impossible"); return; }
      notify("Transaction annulée");
      onChanged();
    } catch (e) {
      notify(e.message || "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const confirmReceipt = async () => {
    setBusy(true);
    try {
      const { data, error } = await sb.rpc("marketplace_confirm_receipt", { p_tx_id: tx.id });
      if (error) throw error;
      if (!data?.success) { notify(data?.error || "Impossible de confirmer"); return; }
      notify("Réception confirmée ✦ Vendeur crédité");
      onChanged();
    } catch (e) {
      notify(e.message || "Erreur");
    } finally {
      setBusy(false);
    }
  };

    const report = async () => {
    const reason = window.prompt("Explique ce qui s'est passé (visible par les admins) :");
    if (!reason || reason.trim().length < 5) return;
    setBusy(true);
    try {
      const { error } = await sb.rpc("report_transaction", { p_tx_id: tx.id, p_reason: reason.trim() });
      if (error) throw error;
      notify("Signalement envoyé ✦ Un admin va l'examiner");
    } catch (e) {
      notify(e.message || "Erreur");
    } finally {
      setBusy(false);
    }
  };
  const payBalance = async () => {
    setBusy(true);
    try {
      const { error } = await sb.rpc("marketplace_pay_balance", { p_tx_id: tx.id });
      if (error) throw error;
      notify("Solde payé ✦ En attente de remise");
      onChanged();
    } catch (e) {
      notify(e.message || "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const img = tx.post?.img_url || tx.post?.media_urls?.[0];

  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        {img ? (
          <img src={img} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: 12, background: T.bg3, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Package size={22} color={T.muted} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: isSeller ? T.goldL : T.sub, background: isSeller ? T.goldBg : T.bg3, padding: "2px 8px", borderRadius: 8 }}>
              {isSeller ? "Vente" : "Achat"}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</span>
          </div>
          <p style={{ margin: "2px 0", fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {tx.post ? (tx.post.text || "Article (sans description)") : "Article supprimé"}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: T.muted }}>
            {other ? `${other.prenom || ""} ${other.nom || ""}`.trim() : "—"} · {fmt(tx.amount)} F · x{tx.quantity}
          </p>
        </div>
      </div>

      {tx.scheduled_at && (
        <p style={{ margin: "0 0 8px", fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 5 }}>
          <CalendarClock size={12} /> Prévu le {fmtDate(tx.scheduled_at)}
        </p>
      )}
      {tx.expires_at && (tx.status === "reserved" || tx.status === "pending_delivery") && (
        <p style={{ margin: "0 0 10px", fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 5 }}>
          <Clock size={12} /> Expire le {fmtDate(tx.expires_at)}
        </p>
      )}

      {tx.status === "reserved" && !isSeller && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted, marginBottom: 8 }}>
            <span>Solde restant à payer</span><span style={{ fontWeight: 700, color: T.goldL }}>{fmt(tx.balance_due)} F</span>
          </div>
          <Btn onClick={payBalance} disabled={busy} style={{ width: "100%", height: 44, borderRadius: 12, background: T.gradGold, color: "#000", fontWeight: 800, fontSize: 13 }}>
            {busy ? "…" : "Payer le solde"}
          </Btn>
        </div>
      )}

      {tx.status === "pending_delivery" && !isSeller && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          <CodeReveal sb={sb} T={T} tx={tx} notify={notify} />
          <Btn onClick={confirmReceipt} disabled={busy} style={{ width: "100%", height: 40, borderRadius: 12, background: "none", border: `1px solid ${T.border}`, color: T.sub, fontSize: 12, fontWeight: 600 }}>
            {busy ? "…" : "J'ai reçu mon article / service"}
          </Btn>
        </div>
      )}

      {tx.status === "pending_delivery" && isSeller && (
        <div style={{ marginBottom: 10 }}>
          <ValidateCodeRow sb={sb} T={T} Btn={Btn} tx={tx} notify={notify} onChanged={onChanged} />
        </div>
      )}

      {tx.status === "reserved" && isSeller && (
        <p style={{ margin: "0 0 10px", fontSize: 12, color: T.muted }}>En attente que le client paie le solde.</p>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {(tx.status === "reserved" || tx.status === "pending_delivery") ? (
          <button onClick={cancel} disabled={busy} style={{ background: "none", border: "none", color: T.err || "#e5484d", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "4px 0" }}>
            Annuler la transaction
          </button>
        ) : <span />}
        <button onClick={report} disabled={busy} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "4px 0" }}>
          🚩 Signaler
        </button>
      </div>
    </div>
  );
}
function EditListingModal({ sb, T, Btn, post, onClose, notify, onSaved }) {
  const [price, setPrice] = useState(String(post.price || ""));
  const [unlimited, setUnlimited] = useState(!!post.stock_unlimited);
  const [stock, setStock] = useState(String(post.stock ?? ""));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const p = parseInt(price, 10);
    if (!p || p < 1) return notify("Entre un prix valide");
    if (!unlimited && (isNaN(parseInt(stock, 10)) || parseInt(stock, 10) < 0)) return notify("Entre un stock valide");
    setSaving(true);
    try {
      const { error } = await sb.from("posts").update({
        price: p,
        stock_unlimited: unlimited,
        stock: unlimited ? null : parseInt(stock, 10),
      }).eq("id", post.id);
      if (error) throw error;
      notify("Annonce mise à jour ✦");
      onSaved();
      onClose();
    } catch (e) {
      notify(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", zIndex: 10150, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 480, background: T.bg2, borderRadius: "28px 28px 0 0", padding: "24px 20px 40px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: T.text }}>Modifier l'annonce</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}><X size={22} /></button>
        </div>

        <label style={{ fontSize: 12, color: T.muted, marginBottom: 6, display: "block" }}>Prix unitaire (F CFA)</label>
        <input
          type="number" min="1" value={price} onChange={e => setPrice(e.target.value)}
          style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", color: T.text, fontSize: 15, outline: "none", marginBottom: 16, boxSizing: "border-box" }}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.text, marginBottom: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={unlimited} onChange={e => setUnlimited(e.target.checked)} />
          Stock illimité
        </label>

        {!unlimited && (
          <>
            <label style={{ fontSize: 12, color: T.muted, marginBottom: 6, display: "block" }}>Stock disponible</label>
            <input
              type="number" min="0" value={stock} onChange={e => setStock(e.target.value)}
              style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", color: T.text, fontSize: 15, outline: "none", marginBottom: 20, boxSizing: "border-box" }}
            />
          </>
        )}

        <Btn onClick={save} disabled={saving} style={{ width: "100%", height: 50, borderRadius: 14, background: T.gradGold, color: "#000", fontWeight: 800, fontSize: 14 }}>
          {saving ? "…" : "Enregistrer"}
        </Btn>
      </div>
    </div>
  );
}

function ListingCard({ sb, T, post, notify, onEdit, onChanged }) {
  const img = post.img_url || post.media_urls?.[0];
  const soldOut = !post.stock_unlimited && (post.stock ?? 0) <= 0;

  const remove = async () => {
    if (!window.confirm("Supprimer cette annonce ?")) return;
    const { error } = await sb.from("posts").delete().eq("id", post.id);
    if (error) { notify(error.message || "Suppression impossible"); return; }
    notify("Annonce supprimée");
    onChanged();
  };

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 18, padding: 14, marginBottom: 12 }}>
      {img ? (
        <img src={img} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
      ) : (
        <div style={{ width: 56, height: 56, borderRadius: 12, background: T.bg3, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Package size={22} color={T.muted} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {post.text || "Article"}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: soldOut ? (T.err || "#e5484d") : T.muted }}>
          {fmt(post.price)} F · {post.stock_unlimited ? "Illimité" : soldOut ? "Épuisé" : `${post.stock} dispo.`}
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={() => onEdit(post)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: T.goldL, background: T.goldBg, border: `1px solid ${T.gold}44`, borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}>
          <Pencil size={12} /> Modifier
        </button>
        <button onClick={remove} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: T.err || "#e5484d", background: "none", border: `1px solid ${T.border}`, borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}>
          <Trash2 size={12} /> Supprimer
        </button>
      </div>
    </div>
  );
}
/* ---------------------------------------------------------------- */
export default function TransactionsScreen({ sb, T, Btn, session, notify, onClose, pushNav, popNav }) {
  const [tab, setTab] = useState("active");
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback(async () => {
    if (tab === "listings") {
      const { data, error } = await sb
        .from("posts")
        .select("id,text,img_url,media_urls,price,stock,stock_unlimited,deal_type,created_at")
        .eq("author_id", session.user.id)
        .eq("is_for_sale", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!error && mounted.current) setRows(data || []);
      return;
    }
    const statuses = tab === "active" ? ["reserved", "pending_delivery"] : ["completed", "cancelled"];
    const { data, error } = await sb
      .from("transactions")
      .select(COLUMNS)
      .or(`buyer_id.eq.${session.user.id},seller_id.eq.${session.user.id}`)
      .in("status", statuses)
      .order("created_at", { ascending: false })
      .limit(50);
    if (mounted.current) {
      if (error) { notify(error.message || "Impossible de charger"); setRows([]); }
      else setRows(data || []);
    }
  }, [sb, session.user.id, tab, notify]);

  useEffect(() => { setRows(null); load(); }, [load]);

  useEffect(() => {
    const ch = sb.channel(`tx_live_${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `buyer_id=eq.${session.user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `seller_id=eq.${session.user.id}` }, () => load())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, session.user.id, load]);

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg || "#0a0a0a", zIndex: 10050, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 18px 12px", borderBottom: `1px solid ${T.border}` }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>Mes transactions</h2>
        <button onClick={() => { popNav?.(); onClose(); }} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}><X size={22} /></button>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "14px 18px 0" }}>
        {[{ v: "active", l: "En cours" }, { v: "history", l: "Historique" }, { v: "listings", l: "Mes annonces" }].map(t => (
          <button key={t.v} onClick={() => setTab(t.v)} style={{
            flex: 1, padding: "10px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer",
            border: `1px solid ${tab === t.v ? T.gold : T.border}`,
            background: tab === t.v ? T.goldBg : "transparent",
            color: tab === t.v ? T.goldL : T.muted,
          }}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        {rows === null ? (
          <p style={{ color: T.muted, fontSize: 13, textAlign: "center", marginTop: 40 }}>Chargement…</p>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: 60 }}>
            {tab === "active" ? <Clock size={32} color={T.muted} /> : tab === "listings" ? <Package size={32} color={T.muted} /> : <CheckCircle2 size={32} color={T.muted} />}
            <p style={{ color: T.muted, fontSize: 13, marginTop: 10 }}>
              {tab === "active" ? "Aucune transaction en cours" : tab === "listings" ? "Aucune annonce en vente" : "Aucun historique pour l'instant"}
            </p>
          </div>
        ) : tab === "listings" ? (
          rows.map(post => (
            <ListingCard key={post.id} sb={sb} T={T} post={post} notify={notify} onEdit={setEditing} onChanged={load} />
          ))
        ) : (
          rows.map(tx => (
            <TransactionCard key={tx.id} sb={sb} T={T} Btn={Btn} tx={tx} myId={session.user.id} notify={notify} onChanged={load} />
          ))
        )}
      </div>

      {editing && (
        <EditListingModal sb={sb} T={T} Btn={Btn} post={editing} notify={notify} onClose={() => setEditing(null)} onSaved={load} />
      )}
    </div>
  );
}