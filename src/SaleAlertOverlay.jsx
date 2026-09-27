import { useState, useEffect, useRef } from "react";

export default function SaleAlertOverlay({ sb, T, Btn, session }) {
  const [alert, setAlert] = useState(null);
  const audioRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const ch = sb.channel(`sale_alert_${session.user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions", filter: `seller_id=eq.${session.user.id}` }, (payload) => {
        setAlert(payload.new);
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, session.user.id]);

  useEffect(() => {
    if (!alert) return;
    audioRef.current = new Audio("/sounds/new-sale-ring.mp3");
    audioRef.current.loop = true;
    audioRef.current.play().catch(() => {});
    timeoutRef.current = setTimeout(() => dismiss(), 45000);
    return () => {
      audioRef.current?.pause();
      clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert]);

  const dismiss = () => {
    audioRef.current?.pause();
    clearTimeout(timeoutRef.current);
    setAlert(null);
  };

  if (!alert) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 99999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>💰</div>
      <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800, color: "#fff", textAlign: "center" }}>
        {alert.tx_kind === "reservation" ? "Nouvelle réservation !" : "Nouvelle vente !"}
      </h2>
      <p style={{ margin: "0 0 32px", fontSize: 15, color: "rgba(255,255,255,0.7)", textAlign: "center" }}>
        {Math.round(alert.amount).toLocaleString("fr-FR")} F CFA — livre vite avant expiration
      </p>
      <Btn onClick={dismiss} style={{ padding: "16px 40px", borderRadius: 30, background: T.gradGold, color: "#000", fontWeight: 800, fontSize: 16 }}>
        J'ai compris
      </Btn>
    </div>
  );
}