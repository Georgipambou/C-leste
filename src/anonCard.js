import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";

const W = 1080, H = 1920;
const FONT = "-apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width <= maxW) { line = test; continue; }
      if (line) out.push(line);
      if (ctx.measureText(word).width > maxW) {
        let chunk = "";
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width > maxW) { out.push(chunk); chunk = ch; } else chunk += ch;
        }
        line = chunk;
      } else line = word;
    }
    out.push(line);
  }
  return out;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function makeAnonCardImage({ text, link }) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1b1035"); bg.addColorStop(0.5, "#0b0b1a"); bg.addColorStop(1, "#000000");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 700, 50, W / 2, 700, 800);
  glow.addColorStop(0, "rgba(212,175,55,0.28)"); glow.addColorStop(1, "rgba(212,175,55,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#F5D76E"; ctx.font = "700 56px " + FONT;
  ctx.fillText("🎭 Message anonyme", W / 2, 260);
  ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.font = "400 36px " + FONT;
  ctx.fillText("Quelqu'un m'a écrit…", W / 2, 322);

  const msg = String(text).trim();
  const size = msg.length < 60 ? 76 : msg.length < 140 ? 62 : msg.length < 260 ? 50 : 42;
  const cardX = 70, cardW = W - 140, padX = 80;
  ctx.font = "700 " + size + "px " + FONT;
  let lines = wrapLines(ctx, msg, cardW - padX * 2);
  const maxLines = 14;
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] += "…"; }
  const lh = Math.round(size * 1.3);
  const cardH = lines.length * lh + 300;
  const cardY = Math.max(380, Math.round((H - cardH) / 2) - 40);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 60; ctx.shadowOffsetY = 20;
  rr(ctx, cardX, cardY, cardW, cardH, 56);
  ctx.fillStyle = "#ffffff"; ctx.fill();
  ctx.restore();

  ctx.save();
  rr(ctx, cardX, cardY, cardW, cardH, 56); ctx.clip();
  const bar = ctx.createLinearGradient(cardX, 0, cardX + cardW, 0);
  bar.addColorStop(0, "#D4AF37"); bar.addColorStop(1, "#F5D76E");
  ctx.fillStyle = bar; ctx.fillRect(cardX, cardY, cardW, 30);
  ctx.restore();

  ctx.textAlign = "left"; ctx.fillStyle = "#D4AF37"; ctx.font = "700 170px Georgia, serif";
  ctx.fillText("“", cardX + 50, cardY + 190);

  ctx.textAlign = "center"; ctx.fillStyle = "#111111"; ctx.font = "700 " + size + "px " + FONT;
  const y0 = cardY + 170 + size;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * lh));

  const yAfter = cardY + cardH;
  ctx.fillStyle = "#F5D76E"; ctx.font = "600 46px " + FONT;
  ctx.fillText("Envoie-moi le tien 👇", W / 2, yAfter + 130);

  if (link) {
    const label = link.replace(/^https?:\/\//, "");
    ctx.font = "700 42px " + FONT;
    const tw = ctx.measureText(label).width + 90;
    const px = (W - tw) / 2, py = yAfter + 170;
    const pill = ctx.createLinearGradient(px, 0, px + tw, 0);
    pill.addColorStop(0, "#D4AF37"); pill.addColorStop(1, "#F5D76E");
    rr(ctx, px, py, tw, 100, 50); ctx.fillStyle = pill; ctx.fill();
    ctx.fillStyle = "#000000"; ctx.fillText(label, W / 2, py + 66);
  }

  ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = "700 44px " + FONT;
  ctx.fillText("✦ Céleste", W / 2, H - 130);

  return await new Promise(res => c.toBlob(res, "image/png"));
}

export async function shareAnonCard({ text, link }) {
  const blob = await makeAnonCardImage({ text, link });
  const caption = "Envoie-moi un message anonyme 🤫" + (link ? " " + link : "");

  if (Capacitor.isNativePlatform()) {
    const base64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1]);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
    const f = await Filesystem.writeFile({ path: "anon_" + Date.now() + ".png", data: base64, directory: Directory.Cache });
    try {
      await Share.share({ title: "Message anonyme", text: caption, files: [f.uri], dialogTitle: "Partager en statut" });
    } catch (e) {
      if (!/cancel/i.test(String(e && e.message || e))) throw e;
    }
    return;
  }

  const file = new File([blob], "message-anonyme.png", { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text: caption }); }
    catch (e) { if (!e || e.name !== "AbortError") throw e; }
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "message-anonyme.png"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}