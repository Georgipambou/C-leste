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
import { useState, useMemo, useEffect } from "react";
import { X, Minus, Plus, ShoppingBag, CalendarClock, ShieldCheck, Star } from "lucide-react";

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
export function MarketplaceFields({ T, myProfile, price, setPrice, stock, setStock, stockUnlimited, setStockUnlimited, dealType, setDealType }) {
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
        {!stockUnlimited && (
          <input
            type="number" min="1" placeholder={dealType === "sale" ? "Stock" : "Places dispo."} value={stock}
            onChange={e => setStock(e.target.value)}
            style={{ width: 130, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", color: T.text, fontSize: 14, outline: "none" }}
          />
        )}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.sub, cursor: "pointer" }}>
        <input type="checkbox" checked={stockUnlimited} onChange={e => setStockUnlimited(e.target.checked)} />
        Stock illimité {dealType !== "sale" ? "(pas de limite de créneaux)" : "(pas de limite de quantité)"}
      </label>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Bouton à afficher sur un post marchand dans le feed               */
/* ---------------------------------------------------------------- */
export function ForSaleButton({ T, post }) {
  if (!post?.is_for_sale || !post?.price) return null;
  const soldOut = post.stock !== null && post.stock !== undefined && post.stock <= 0;
  const label = soldOut ? "Épuisé" : post.deal_type === "sale" ? "Acheter" : "Réserver";

  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (!soldOut) window.dispatchEvent(new CustomEvent("celeste_open_product", { detail: post })); }}
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
  const isUnlimited = post.stock === null || post.stock === undefined;
  const stock = isUnlimited ? 100 : post.stock;
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
        <p style={{ margin: "0 0 16px", fontSize: 13, color: T.muted }}>{fmt(post.price)} F CFA / unité · {isUnlimited ? "stock illimité" : `${stock} disponible${stock > 1 ? "s" : ""}`}</p>

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
            <button
              onClick={() => { window.dispatchEvent(new CustomEvent("celeste_open_chat_with", { detail: post.by || post.author?.id })); onClose(); }}
              style={{ width: "100%", marginTop: 10, height: 44, borderRadius: 14, background: "none", border: `1px solid ${T.border}`, color: T.sub, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Discuter d'abord avec le vendeur
            </button>
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
/* ---------------------------------------------------------------- */
/* Étoiles de réputation + panneau des avis                          */
/* ---------------------------------------------------------------- */
export function SellerRatingStars({ T, sb, sellerId, pushNav, popNav, size = 12 }) {
  const [open, setOpen] = useState(false);
  const [seller, setSeller] = useState(null);

  useEffect(() => {
    sb.from("profiles").select("id,prenom,nom,avatar_url,seller_rating_avg,seller_rating_count").eq("id", sellerId).maybeSingle().then(({ data }) => setSeller(data));
  }, [sb, sellerId]);

  if (!seller || !seller.seller_rating_count) return null;
  const avg = seller.seller_rating_avg || 0;

  const openPanel = (e) => { e.stopPropagation(); pushNav(() => setOpen(false)); setOpen(true); };
  const closePanel = () => { popNav(); setOpen(false); };

  return (
    <>
      <button onClick={openPanel} style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 4 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <Star key={n} size={size} fill={n <= Math.round(avg) ? "#e0b84a" : "none"} color="#e0b84a" />
        ))}
        <span style={{ fontSize: size, color: T.muted, marginLeft: 2 }}>({seller.seller_rating_count})</span>
      </button>
      {open && <SellerReviewsPanel sb={sb} T={T} sellerId={sellerId} seller={seller} onClose={closePanel} />}
    </>
  );
}

function SellerReviewsPanel({ sb, T, sellerId, seller, onClose }) {
  const [reviews, setReviews] = useState(null);

  useEffect(() => {
    sb.from("seller_ratings")
      .select("id,rating,comment,created_at,buyer:profiles!seller_ratings_buyer_id_fkey(id,prenom,nom,avatar_url)")
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setReviews(data || []));
  }, [sb, sellerId]);

  const openBuyer = (uid) => {
    if (!uid) return;
    onClose();
    window.dispatchEvent(new CustomEvent("celeste_open_user", { detail: { uid } }));
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", zIndex: 10120, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto", background: T.bg2, borderRadius: "28px 28px 0 0", padding: "20px 18px 30px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 19, color: T.text }}>
            Avis · {(seller?.seller_rating_avg || 0).toFixed(1)} ★ ({seller?.seller_rating_count || 0})
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}><X size={22} /></button>
        </div>

        {reviews === null ? (
          <p style={{ textAlign: "center", color: T.muted, fontSize: 13, marginTop: 30 }}>Chargement…</p>
        ) : reviews.length === 0 ? (
          <p style={{ textAlign: "center", color: T.muted, fontSize: 13, marginTop: 30 }}>Aucun avis pour l'instant.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {reviews.map(r => (
              <div key={r.id} style={{ display: "flex", gap: 10, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
                {r.buyer?.avatar_url ? (
                  <img src={r.buyer.avatar_url} onClick={() => openBuyer(r.buyer?.id)} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", cursor: "pointer", flexShrink: 0 }} alt="" />
                ) : (
                  <div onClick={() => openBuyer(r.buyer?.id)} style={{ width: 38, height: 38, borderRadius: "50%", background: T.bg3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: T.muted, cursor: "pointer", flexShrink: 0 }}>
                    {(r.buyer?.prenom || "?")[0]}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span onClick={() => openBuyer(r.buyer?.id)} style={{ fontSize: 13, fontWeight: 700, color: T.text, cursor: "pointer" }}>
                      {r.buyer?.prenom} {r.buyer?.nom}
                    </span>
                    <span style={{ fontSize: 11, color: T.muted }}>{new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                  <div style={{ display: "flex", gap: 1, margin: "3px 0" }}>
                    {[1, 2, 3, 4, 5].map(n => (<Star key={n} size={12} fill={n <= r.rating ? "#e0b84a" : "none"} color="#e0b84a" />))}
                  </div>
                  {r.comment && <p style={{ margin: 0, fontSize: 13, color: T.sub, lineHeight: 1.5 }}>{r.comment}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}