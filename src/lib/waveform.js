// Calcule 40 barres (0-100) + durée à partir du blob audio local, à l'envoi.
export async function computeWaveform(blob, bars = 40) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    const buf = await blob.arrayBuffer();
    const ctx = new AudioCtx();
    const decoded = await ctx.decodeAudioData(buf);
    try { ctx.close(); } catch {}
    const raw = decoded.getChannelData(0);
    const step = Math.max(1, Math.floor(raw.length / bars));
    const levels = [];
    for (let i = 0; i < bars; i++) {
      let sum = 0, n = 0;
      for (let j = i * step; j < Math.min((i + 1) * step, raw.length); j += 4) { sum += raw[j] * raw[j]; n++; }
      levels.push(Math.sqrt(sum / (n || 1)));
    }
    const max = Math.max(...levels, 0.001);
    return {
      p: levels.map(v => Math.max(8, Math.round(Math.pow(v / max, 0.7) * 100))),
      d: Math.round(decoded.duration * 10) / 10,
    };
  } catch { return null; }
}

// Pour les anciens vocaux (sans waveform) : barres stables, sans aucun décodage.
export function fallbackBars(seedStr, n = 40) {
  const seed = [...String(seedStr)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
  return Array.from({ length: n }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(seed + i * 1.7)));
}