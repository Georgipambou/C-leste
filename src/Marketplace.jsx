/**
 * Marketplace.jsx — Céleste
 *
 * Fichier autonome (même pattern que Duo.jsx / DepositScreen.jsx) : reçoit sb,
 * T, Btn, session, notify, myProfile en props, ne crée aucun client ni thème.
 *
 * Exporte :
 *  - MarketplaceFields   → à insérer dans NewPostModal quand isForSale=true
 *                          (prix, stock, type de vente)
 *  - ForSaleButton       → petit bouton "Acheter" / "Réserver" à afficher sur
 *                          un post marchand dans le feed
 *  - ProductBuyModal     → le panneau complet : photo, stock, calculatrice,
 *                          confirmation, appelle marketplace_buy /
 *                          marketplace_reserve
 *
 * Ne touche à aucune requête de chargement des posts existante — il faut que
 * les colonnes price / stock / deal_type soient ajoutées aux select() des
 * posts pour que ces composants reçoivent des données (patch à part).
 */
import { useState, useMemo } from "react";
import { X, Minus, Plus, ShoppingBag, CalendarClock, ShieldCheck } from "lucide-react";

const DEAL_TYPES = [
  { value: "sale", label: "Vente directe", hint: "Paiement complet, remise contre code" },
  { value: "reservation", label: "Réservation (objet physique)", hint: "Acompte 50%, reste payé sur place" },
  { value: "service", label: "Service à distance", hint: "Acompte 50%, reste payé une fois rendu" },
];

function fmt(n) {
  return Math.round(n || 0).toLocaleString("fr-FR");
}

/* ---------------------------------------------------------------- */
/* Champs à insérer dans le formulaire de post (NewPostModal)        */
/* ---------------------------------------------------------------- */
export function MarketplaceFields({ T, myProfile, price, setPrice, stock, setStock, dealType, setDealType }) {
  const hasBadge = myProfile?.badge === "confirmed" || myProfile?.badge === "friend";

  if (!hasBadge) {
    return (
      <div style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginTop: 10 }}>
        <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
          <ShieldCheck size={14} style={{ verticalAlign: -2, marginRight: 6 }} color={T.gold} />
          Un badge certifié actif est nécessaire pour vendre sur Céleste.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {DEAL_TYPES.map(d => (
          <button
            key={d.value}
            type="button"
            onClick={() => setDealType(d.value)}
            style={{
              flex: 1, padding: "10px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: "pointer",
              border: `1px solid ${dealType === d.value ? T.gold : T.border}`,
              background: dealType === d.value ? T.goldBg : "transparent",
              color: dealType === d.value ? T.goldL : T.sub,
            }}
          >
            {d.label}
          </button>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: T.muted }}>
        {DEAL_TYPES.find(d => d.value === dealType)?.hint}
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="number" min="1" placeholder="Prix unitaire (F CFA)" value={price}
          onChange={e => setPrice(e.target.value)}
          style={{ flex: 1, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", color: T.text, fontSize: 14, outline: "none" }}
        />
        <input
          type="number" min="1" placeholder={dealType === "sale" ? "Stock" : "Places dispo."} value={stock}
          onChange={e => setStock(e.target.value)}
          style={{ width: 130, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", color: T.text, fontSize: 14, outline: "none" }}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Bouton à afficher sur un post marchand dans le feed               */
/* ---------------------------------------------------------------- */
export function ForSaleButton({ T, post, onOpen }) {
  if (!post?.is_for_sale || !post?.price) return null;
  const soldOut = (post.stock ?? 0) <= 0;
  const label = soldOut ? "Épuisé" : post.deal_type === "sale" ? "Acheter" : "Réserver";

  return (
    <button
      onClick={() => !soldOut && onOpen(post)}
      disabled={soldOut}
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 20,
        border: `1px solid ${T.gold}55`, background: soldOut ? T.bg3 : T.goldBg,
        color: soldOut ? T.muted : T.goldL, fontSize: 13, fontWeight: 700,
        cursor: soldOut ? "default" : "pointer", opacity: soldOut ? 0.6 : 1,
      }}
    >
      <ShoppingBag size={14} />
      {label} · {fmt(post.price)} F
    </button>
  );
}

/* ---------------------------------------------------------------- */
/* Panneau complet d'achat / réservation                             */
/* ---------------------------------------------------------------- */
export function ProductBuyModal({ sb, T, Btn, post, onClose, notify, onDone }) {
  const [qty, setQty] = useState(1);
  const [scheduledAt, setScheduledAt] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const isReservation = post.deal_type === "reservation" || post.deal_type === "service";
  const stock = post.stock ?? 0;
  const total = useMemo(() => Math.round((post.price || 0) * qty), [post.price, qty]);
  const deposit = useMemo(() => Math.round(total * 0.5), [total]);

  const changeQty = (delta) => setQty(q => Math.min(stock, Math.max(1, q + delta)));

  const confirm = async () => {
    setLoading(true);
    try {
      if (isReservation) {
        const iso = scheduledAt ? new Date(scheduledAt).toISOString() : null;
        const { error } = await sb.rpc("marketplace_reserve", {
          p_post_id: post.id, p_quantity: qty, p_scheduled_at: iso,
        });
        if (error) throw error;
        notify("Réservation confirmée ✦ Acompte débité");
      } else {
        const { error } = await sb.rpc("marketplace_buy", {
          p_post_id: post.id, p_quantity: qty,
        });
        if (error) throw error;
        notify("Achat confirmé ✦ En attente de livraison");
      }
      onDone?.();
      onClose();
    } catch (e) {
      notify(e.message || "Impossible de finaliser");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", zIndex: 10100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", background: T.bg2, borderRadius: "28px 28px 0 0", padding: "24px 20px 40px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: T.text }}>
            {isReservation ? "Réserver" : "Acheter"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}><X size={22} /></button>
        </div>

        {(post.img_url || post.media_urls?.[0]) && (
          <img src={post.img_url || post.media_urls[0]} alt="" style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 16, marginBottom: 14 }} />
        )}

        <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: T.text }}>{post.text || "Article"}</p>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: T.muted }}>{fmt(post.price)} F CFA / unité · {stock} disponible{stock > 1 ? "s" : ""}</p>

        {!confirming ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 18 }}>
              <button onClick={() => changeQty(-1)} disabled={qty <= 1} style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.border}`, background: T.bg3, color: T.text, cursor: "pointer", opacity: qty <= 1 ? 0.4 : 1 }}>
                <Minus size={16} style={{ margin: "auto" }} />
              </button>
              <span style={{ fontSize: 26, fontWeight: 800, color: T.goldL, minWidth: 40, textAlign: "center" }}>{qty}</span>
              <button onClick={() => changeQty(1)} disabled={qty >= stock} style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.border}`, background: T.bg3, color: T.text, cursor: "pointer", opacity: qty >= stock ? 0.4 : 1 }}>
                <Plus size={16} style={{ margin: "auto" }} />
              </button>
            </div>

            {isReservation && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.muted, marginBottom: 6 }}>
                  <CalendarClock size={13} /> Date prévue (optionnel)
                </label>
                <input
                  type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                  style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 12, padding: "11px 14px", color: T.text, fontSize: 13, outline: "none" }}
                />
              </div>
            )}

            <div style={{ background: T.bg3, borderRadius: 14, padding: 14, marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.sub, marginBottom: isReservation ? 6 : 0 }}>
                <span>Total</span><span style={{ fontWeight: 700, color: T.text }}>{fmt(total)} F</span>
              </div>
              {isReservation && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.sub, marginBottom: 6 }}>
                    <span>Acompte à payer maintenant</span><span style={{ fontWeight: 700, color: T.goldL }}>{fmt(deposit)} F</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted }}>
                    <span>Solde bloqué (payé sur place)</span><span>{fmt(total - deposit)} F</span>
                  </div>
                </>
              )}
            </div>

            <Btn onClick={() => setConfirming(true)} style={{ width: "100%", height: 50, borderRadius: 14, background: T.gradGold, color: "#000", fontWeight: 800, fontSize: 14 }}>
              Continuer
            </Btn>
          </>
        ) : (
          <>
            <div style={{ background: T.bg3, border: `1px solid ${T.gold}44`, borderRadius: 14, padding: 16, marginBottom: 18, textAlign: "center" }}>
              <p style={{ margin: "0 0 6px", fontSize: 13, color: T.muted }}>
                {isReservation ? "Tu confirmes le paiement de l'acompte" : "Tu confirmes l'achat"}
              </p>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: T.goldL }}>
                {fmt(isReservation ? deposit : total)} F
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={() => setConfirming(false)} disabled={loading} style={{ flex: 1, height: 50, borderRadius: 14, background: T.bg3, border: `1px solid ${T.border}`, color: T.text, fontWeight: 700 }}>
                Retour
              </Btn>
              <Btn onClick={confirm} disabled={loading} style={{ flex: 1, height: 50, borderRadius: 14, background: T.gradGold, color: "#000", fontWeight: 800 }}>
                {loading ? "..." : "Confirmer"}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}