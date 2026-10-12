/**
 * Céleste — Vue unique (réception + panneau plein écran)
 * Fichier : src/ViewOnce.jsx
 *
 * Exporte :
 *   useViewOnce({...})  -> { open, viewing, isOpening, progress, isConsumed, viewer }
 *   ViewOnceBubble      -> bulle (photo / vidéo / vocal / texte) à afficher dans le chat
 *   ViewOnceToggle      -> bouton œil de la barre de saisie
 *
 * Règles :
 *  - le média est téléchargé en entier (blob local) avant l'affichage : plus de coupure
 *    au milieu d'une vidéo, même si l'objet R2 est supprimé côté serveur ;
 *  - tout s'ouvre dans un panneau plein écran (photo, vidéo, vocal, texte) ;
 *  - dès que le panneau est fermé, le contenu est détruit : impossible de le revoir
 *    ou de le réécouter (le serveur l'a déjà marqué consommé) ;
 *  - bouton retour natif : ferme le panneau (via pushNav / popNav) ;
 *  - capture ou enregistrement d'écran pendant l'affichage : fermeture immédiate.
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Eye, EyeOff, X, Play, Pause } from "lucide-react";

const fmt = s => {
  const n = Math.max(0, Math.floor(Number.isFinite(s) ? s : 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
};

const kindOf = t => (t === "image" ? "photo" : t);

const LABELS = {
  photo: { sent: "Photo vue unique envoyée", opened: "Photo vue unique ouverte", done: "Photo vue unique consultée", cta: "Appuyer pour voir · vue unique" },
  video: { sent: "Vidéo vue unique envoyée", opened: "Vidéo vue unique ouverte", done: "Vidéo vue unique consultée", cta: "Appuyer pour voir · vue unique" },
  voice: { sent: "Vocal vue unique envoyé", opened: "Vocal vue unique ouvert", done: "Vocal vue unique consulté", cta: "Appuyer pour écouter · vue unique" },
  text: { sent: "Message vue unique envoyé", opened: "Message vue unique ouvert", done: "Message vue unique consulté", cta: "Appuyer pour lire · vue unique" },
};

// ── Téléchargement complet du média (avec progression) ──
function downloadBlob(url, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.responseType = "blob";
    xhr.timeout = 120000;
    xhr.onprogress = e => {
      if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response) resolve(xhr.response);
      else reject(new Error("HTTP " + xhr.status));
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.send();
  });
}

// ── Appel de l'edge function (lit le vrai message d'erreur renvoyé) ──
async function requestViewOnce(sb, messageId, platform) {
  const { data, error } = await sb.functions.invoke("view-once-media", {
    body: { message_id: messageId },
    headers: { "X-Celeste-Platform": platform },
  });
  if (error) {
    let msg = error.message;
    try {
      const r = error.context;
      const body = r && typeof r.clone === "function" ? await r.clone().json() : null;
      if (body && body.error) msg = body.error;
    } catch (_) {}
    throw new Error(msg);
  }
  if (!data) throw new Error("Contenu indisponible");
  return data;
}

// ───────────────────────── HOOK ─────────────────────────
export function useViewOnce({
  sb, conv, myId, notify, isNative, platform, pushNav, popNav,
  enableScreenProtection, disableScreenProtection, PrivacyScreen,
  keepProtection, onConsumed, T,
}) {
  const [active, setActive] = useState(null); // {id, kind, url?, text?}
  const [opening, setOpening] = useState({}); // {messageId: progress 0..1}
  const [consumed, setConsumed] = useState(() => new Set());

  const activeRef = useRef(null);
  const openingRef = useRef(new Set());
  const consumedRef = useRef(new Set());
  const urlRef = useRef(null);
  const mounted = useRef(true);
  const live = useRef({});
  live.current = { keepProtection, onConsumed, notify, popNav, pushNav, convId: conv && conv.id, myId };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const u = urlRef.current;
      urlRef.current = null;
      if (u && u.startsWith("blob:")) { try { URL.revokeObjectURL(u); } catch (_) {} }
    };
  }, []);

  // Fin de consultation : on détruit tout, le contenu ne peut plus être rouvert.
  const finish = useCallback(() => {
    const a = activeRef.current;
    if (!a) return;
    activeRef.current = null;
    const u = urlRef.current;
    urlRef.current = null;
    setActive(null);
    consumedRef.current.add(a.id);
    setConsumed(new Set(consumedRef.current));
    if (u && u.startsWith("blob:")) setTimeout(() => { try { URL.revokeObjectURL(u); } catch (_) {} }, 400);
    if (live.current.onConsumed) live.current.onConsumed(a.id);
  }, []);

  // Fermeture par l'utilisateur (bouton X) : on dépile aussi l'entrée du bouton retour.
  const closeByUser = useCallback(() => {
    if (!activeRef.current) return;
    if (live.current.popNav) live.current.popNav();
    finish();
  }, [finish]);

  const open = useCallback(async (m) => {
    const L = live.current;
    if (!isNative) { if (L.notify) L.notify("Vue unique disponible uniquement depuis l'app iOS ou Android"); return; }
    if (activeRef.current || openingRef.current.has(m.id) || consumedRef.current.has(m.id) || m.viewed_at) return;

    openingRef.current.add(m.id);
    setOpening(p => ({ ...p, [m.id]: 0 }));
    if (enableScreenProtection) await enableScreenProtection();

    let blobUrl = null;
    try {
      const data = await requestViewOnce(sb, m.id, platform);
      const kind = kindOf(m.type);
      let payload;
      if (kind === "text") {
        if (typeof data.text !== "string") throw new Error("Contenu indisponible");
        payload = { id: m.id, kind, text: data.text };
      } else {
        if (!data.url) throw new Error("Contenu indisponible");
        let src = data.url; // repli : lecture directe de l'URL signée
        for (let i = 0; i < 3; i++) {
          try {
            const blob = await downloadBlob(data.url, p => setOpening(o => ({ ...o, [m.id]: p })));
            blobUrl = URL.createObjectURL(blob);
            src = blobUrl;
            break;
          } catch (_) {
            if (i < 2) await new Promise(r => setTimeout(r, 600));
          }
        }
        payload = { id: m.id, kind, url: src };
      }
      if (!mounted.current) {
        if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch (_) {} }
        return;
      }
      urlRef.current = blobUrl;
      activeRef.current = payload;
      if (live.current.pushNav) live.current.pushNav(() => finish());
      setActive(payload);
    } catch (err) {
      if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch (_) {} }
      if (L.notify) L.notify("Impossible d'ouvrir ce contenu · " + ((err && err.message) || "réessaie"));
      if (!live.current.keepProtection && disableScreenProtection) disableScreenProtection();
    } finally {
      openingRef.current.delete(m.id);
      setOpening(p => { const n = { ...p }; delete n[m.id]; return n; });
    }
  }, [isNative, platform, sb, enableScreenProtection, disableScreenProtection, finish]);

  // Capture / enregistrement d'écran pendant l'affichage : fermeture immédiate + avertissement dans le chat
  useEffect(() => {
    if (!isNative || !PrivacyScreen || !PrivacyScreen.addListener) return;
    let alive = true;
    const handles = [];
    const trip = (txt) => {
      if (!activeRef.current) return;
      if (live.current.popNav) live.current.popNav();
      finish();
      Promise.resolve(
        sb.from("messages").insert({ conv_id: live.current.convId, sender_id: live.current.myId, type: "text", text: txt })
      ).catch(() => {});
    };
    const add = (ev, fn) => {
      Promise.resolve(PrivacyScreen.addListener(ev, fn))
        .then(h => { if (alive) handles.push(h); else if (h && h.remove) h.remove(); })
        .catch(() => {});
    };
    add("screenRecordingStarted", () => trip("⚠️ Enregistrement d'écran détecté pendant l'affichage d'un message à vue unique"));
    add("screenshotTaken", () => trip("⚠️ Capture d'écran détectée pendant l'affichage d'un message à vue unique"));
    return () => {
      alive = false;
      handles.forEach(h => { try { if (h && h.remove) h.remove(); } catch (_) {} });
    };
  }, [isNative, PrivacyScreen, sb, finish]);

  const viewer = active ? <ViewOnceViewerPanel key={active.id} active={active} onClose={closeByUser} T={T} /> : null;

  return {
    open,
    viewing: !!active,
    isOpening: id => opening[id] !== undefined,
    progress: id => opening[id],
    isConsumed: id => consumed.has(id),
    viewer,
  };
}

// ───────────────────── PANNEAU PLEIN ÉCRAN ─────────────────────
function ViewOnceViewerPanel({ active, onClose, T }) {
  const mediaRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [err, setErr] = useState(false);
  const { kind } = active;

  // Nettoyage uniquement au démontage (et non à chaque rendu du parent)
  useEffect(() => () => {
    const el = mediaRef.current;
    if (el) { try { el.pause(); el.removeAttribute("src"); el.load(); } catch (_) {} }
  }, []);

  const toggle = () => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) { const p = el.play(); if (p && p.catch) p.catch(() => {}); }
    else el.pause();
  };
  const seek = v => {
    const el = mediaRef.current;
    if (el) { el.currentTime = v; setCur(v); }
  };

  const mediaProps = {
    ref: mediaRef,
    src: active.url,
    autoPlay: true,
    playsInline: true,
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => setPlaying(false),
    onTimeUpdate: e => setCur(e.currentTarget.currentTime),
    onLoadedMetadata: e => { const d = e.currentTarget.duration; if (Number.isFinite(d)) setDur(d); },
    onDurationChange: e => { const d = e.currentTarget.duration; if (Number.isFinite(d)) setDur(d); },
    onError: () => setErr(true),
  };

  const round = { border: "none", outline: "none", cursor: "pointer", touchAction: "manipulation", WebkitTapHighlightColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", borderRadius: "50%" };
  const hasControls = kind === "video" || kind === "voice";

  return (
    <div
      onContextMenu={e => e.preventDefault()}
      style={{ position: "fixed", inset: 0, zIndex: 3000, background: "#000", display: "flex", flexDirection: "column", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "calc(12px + env(safe-area-inset-top,0px)) 16px 12px", position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "rgba(255,255,255,0.14)", color: "#fff", fontSize: 12, fontWeight: 700 }}>
          <Eye size={14} /> Vue unique
        </div>
        <button type="button" onClick={onClose} style={{ ...round, width: 38, height: 38, background: "rgba(255,255,255,0.15)" }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {err ? (
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, textAlign: "center", padding: 24, margin: 0 }}>
            Lecture impossible. Ce contenu ne peut plus être ouvert.
          </p>
        ) : kind === "photo" ? (
          <img
            src={active.url}
            alt=""
            draggable={false}
            onError={() => setErr(true)}
            style={{ width: "100%", height: "100%", objectFit: "contain", WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
          />
        ) : kind === "video" ? (
          <>
            <video
              {...mediaProps}
              disablePictureInPicture
              controlsList="nodownload noremoteplayback noplaybackrate"
              onClick={toggle}
              style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
            />
            {!playing && (
              <button type="button" onClick={toggle} style={{ ...round, position: "absolute", width: 68, height: 68, background: "rgba(0,0,0,0.5)" }}>
                <Play size={30} />
              </button>
            )}
          </>
        ) : kind === "voice" ? (
          <>
            <audio {...mediaProps} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              <button type="button" onClick={toggle} style={{ ...round, width: 96, height: 96, background: T.goldL, color: "#000" }}>
                {playing ? <Pause size={40} /> : <Play size={40} />}
              </button>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: 600, margin: 0 }}>Message vocal · vue unique</p>
            </div>
          </>
        ) : (
          <div style={{ width: "100%", height: "100%", overflowY: "auto", display: "flex", padding: "8px 20px 24px" }}>
            <p style={{ margin: "auto", maxWidth: 560, color: "#fff", fontSize: 20, fontWeight: 600, lineHeight: 1.5, textAlign: "center", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {active.text}
            </p>
          </div>
        )}
      </div>

      {hasControls && !err && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px calc(16px + env(safe-area-inset-bottom,0px))", position: "relative", zIndex: 2 }}>
          <button type="button" onClick={toggle} style={{ ...round, width: 40, height: 40, background: "rgba(255,255,255,0.15)", flexShrink: 0 }}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <input
            type="range"
            min={0}
            max={dur || 1}
            step={0.1}
            value={Math.min(cur, dur || 1)}
            disabled={!dur}
            onChange={e => seek(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: T.goldL, height: 28 }}
          />
          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 600, minWidth: 74, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            {fmt(cur)}{dur ? " / " + fmt(dur) : ""}
          </span>
        </div>
      )}
    </div>
  );
}

// ───────────────────── BULLE DANS LE CHAT ─────────────────────
export function ViewOnceBubble({ m, mine, vo, T }) {
  const L = LABELS[kindOf(m.type)] || LABELS.photo;
  const row = { display: "flex", alignItems: "center", gap: 8, padding: "8px 4px" };
  const txt = { fontSize: 12, fontWeight: 600 };

  if (mine) {
    return (
      <div style={{ ...row, color: "rgba(0,0,0,0.55)" }}>
        {m.viewed_at ? <Eye size={16} /> : <EyeOff size={16} />}
        <span style={txt}>{m.viewed_at ? L.opened : L.sent}</span>
      </div>
    );
  }
  if (m.viewed_at || vo.isConsumed(m.id)) {
    return (
      <div style={{ ...row, color: T.muted }}>
        <EyeOff size={16} />
        <span style={txt}>{L.done}</span>
      </div>
    );
  }
  const busy = vo.isOpening(m.id);
  const p = vo.progress(m.id);
  const label = busy ? (p > 0 && p < 1 ? `Ouverture… ${Math.round(p * 100)}%` : "Ouverture…") : L.cta;
  return (
    <button
      type="button"
      onClick={() => vo.open(m)}
      disabled={busy}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", background: T.glassMid, borderRadius: 10, color: T.text, border: "none", outline: "none", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1, touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
    >
      <Eye size={18} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

// ───────────────────── BOUTON ŒIL (barre de saisie) ─────────────────────
export function ViewOnceToggle({ active, onToggle, T }) {
  return (
    <button
      type="button"
      aria-pressed={!!active}
      onClick={onToggle}
      style={{ cursor: "pointer", border: "none", outline: "none", touchAction: "manipulation", WebkitTapHighlightColor: "transparent", color: active ? "#000" : T.muted, padding: "6px", display: "flex", alignItems: "center", flexShrink: 0, background: active ? T.goldL : "rgba(255,255,255,0.06)", borderRadius: "50%", width: 36, height: 36, justifyContent: "center" }}
    >
      <Eye size={18} />
    </button>
  );
}