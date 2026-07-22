// src/components/SoundPreviewButton.jsx
// Bouton play/pause pour écouter un extrait d'un son AVANT de le choisir.
// Un seul son joue à la fois, peu importe où ce bouton est utilisé dans l'app
// (picker de post, caméra, admin…) grâce au singleton `currentlyPlaying`.
import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";

let currentlyPlaying = null;

export default function SoundPreviewButton({ url, size = 13, color = "#e0b84a" }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const toggle = (e) => {
    e.stopPropagation();
    if (!url) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    if (currentlyPlaying && currentlyPlaying !== audioRef.current) {
      currentlyPlaying.pause();
    }
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.addEventListener("ended", () => setPlaying(false));
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
    currentlyPlaying = audioRef.current;
    setPlaying(true);
  };

  return (
    <button type="button" onClick={toggle} style={{ background: "none", border: "none", padding: 4, display: "flex", alignItems: "center", cursor: "pointer", flexShrink: 0 }}>
      {playing ? <Pause size={size} color={color} /> : <Play size={size} color={color} />}
    </button>
  );
}