import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { RefreshCw } from "lucide-react";

const CURRENT = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "";
const CHECK_EVERY = 5 * 60 * 1000;

export default function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Un morceau de l'app n'existe plus (nouvelle version déployée) : on recharge une fois
    const onPreloadError = (e) => {
      e.preventDefault();
      try {
        const last = Number(sessionStorage.getItem("celeste_preload_reload") || 0);
        if (Date.now() - last > 30000) {
          sessionStorage.setItem("celeste_preload_reload", String(Date.now()));
          window.location.reload();
        }
      } catch (err) {}
    };
    window.addEventListener("vite:preloadError", onPreloadError);

    let stopped = false;
    const check = async () => {
      if (Capacitor.isNativePlatform() || !CURRENT) return;
      try {
        const r = await fetch("/version.json?t=" + Date.now(), { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (!stopped && d && d.id && d.id !== CURRENT) setShow(true);
      } catch (err) {}
    };
    const onVis = () => { if (document.visibilityState === "visible") check(); };

    check();
    const timer = setInterval(check, CHECK_EVERY);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("vite:preloadError", onPreloadError);
    };
  }, []);

  if (!show) return null;
  return (
    <div style={{ position: "fixed", left: 0, right: 0, top: "calc(env(safe-area-inset-top, 0px) + 10px)", zIndex: 99999, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <button
        onClick={() => window.location.reload()}
        style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 24, border: "none", background: "linear-gradient(135deg,#D4AF37,#F5D76E)", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 24px rgba(0,0,0,0.5)" }}
      >
        <RefreshCw size={15} />Nouvelle version disponible · Actualiser
      </button>
    </div>
  );
}