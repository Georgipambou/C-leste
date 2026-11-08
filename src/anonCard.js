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

const ICON_HAT = {
  paths: ["M14 18a2 2 0 0 0-4 0", "m19 11-2.11-6.657a2 2 0 0 0-2.752-1.148l-1.276.61A2 2 0 0 1 12 4H8.5a2 2 0 0 0-1.925 1.456L5 11", "M2 11h20"],
  circles: [[17, 18, 3], [7, 18, 3]],
};
const ICON_ARROW = { paths: ["M12 5v14", "m19 12-7 7-7-7"], circles: [] };
const ICON_SPARKLES = {
  paths: [
    "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",
    "M20 2v4",
    "M22 4h-4",
  ],
  circles: [[4, 20, 2]],
};

function drawIcon(ctx, icon, x, y, size, color) {
  const s = size / 24;
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
  icon.paths.forEach(d => ctx.stroke(new Path2D(d)));
  icon.circles.forEach(([cx, cy, r]) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); });
  ctx.restore();
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
  const title = "Message anonyme";
  const iconSize = 64, iconGap = 18;
  const titleW = ctx.measureText(title).width;
  const startX = (W - (iconSize + iconGap + titleW)) / 2;
  ctx.textAlign = "left";
  ctx.fillText(title, startX + iconSize + iconGap, 260);
  drawIcon(ctx, ICON_HAT, startX, 206, iconSize, "#F5D76E");
  ctx.textAlign = "center";
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
  const ctaText = "Envoie-moi le tien";
  const ctaW = ctx.measureText(ctaText).width;
  const ctaStart = (W - (ctaW + 16 + 48)) / 2;
  ctx.textAlign = "left";
  ctx.fillText(ctaText, ctaStart, yAfter + 130);
  drawIcon(ctx, ICON_ARROW, ctaStart + ctaW + 16, yAfter + 130 - 38, 48, "#F5D76E");
  ctx.textAlign = "center";

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
  const brand = "Céleste";
  const brandW = ctx.measureText(brand).width;
  const brandStart = (W - (44 + 14 + brandW)) / 2;
  ctx.textAlign = "left";
  ctx.fillText(brand, brandStart + 44 + 14, H - 130);
  drawIcon(ctx, ICON_SPARKLES, brandStart, H - 130 - 36, 44, "rgba(255,255,255,0.45)");
  ctx.textAlign = "center";

  return await new Promise(res => c.toBlob(res, "image/png"));
}

export async function shareAnonCard({ text, link, onCopied }) {
  const caption0 = "Envoie-moi un message anonyme" + (link ? " " + link : "");
  try {
    await navigator.clipboard.writeText(caption0);
    if (onCopied) onCopied();
  } catch (e) {}
  await shareAnonCardInner({ text, link });
}

async function shareAnonCardInner({ text, link }) {
  const blob = await makeAnonCardImage({ text, link });
  const caption = "Envoie-moi un message anonyme" + (link ? " " + link : "");

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