/**
 * soundExtraction.js — Céleste
 * Extrait la piste audio d'une vidéo (déjà en mémoire, format File/Blob local)
 * pour la transformer en "son" réutilisable, sans import manuel.
 *
 * Tout est protégé par try/catch : en cas d'échec (support navigateur,
 * vidéo muette, etc.) on ne fait jamais planter la publication du post.
 * Support captureStream() incertain sur Safari/WKWebView (iOS) — à tester.
 */

function extractAudioBlobFromFile(file, { maxDurationMs = 65000 } = {}) {
  return new Promise((resolve) => {
    try {
      const video = document.createElement("video");
      video.muted = false;
      video.playsInline = true;
      video.style.position = "fixed";
      video.style.left = "-9999px";
      video.style.width = "1px";
      video.style.height = "1px";
      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
      document.body.appendChild(video);

      let settled = false;
      let recorder = null;
      let safetyTimer = null;

      const cleanup = () => {
        clearTimeout(safetyTimer);
        try { video.pause(); } catch (_e) {}
        try { video.remove(); } catch (_e) {}
        try { URL.revokeObjectURL(objectUrl); } catch (_e) {}
      };

      const finish = (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      video.onerror = () => finish(null);

      video.onloadedmetadata = () => {
        try {
          const captureFn = video.captureStream || video.mozCaptureStream;
          if (!captureFn) { finish(null); return; }
          const stream = captureFn.call(video);
          const audioTracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
          if (!audioTracks.length) { finish(null); return; } // vidéo sans son

          const audioStream = new MediaStream(audioTracks);
          const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
          const mimeType = mimeCandidates.find(m => window.MediaRecorder?.isTypeSupported?.(m)) || "";

          recorder = mimeType
            ? new MediaRecorder(audioStream, { mimeType })
            : new MediaRecorder(audioStream);

          const chunks = [];
          recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
          recorder.onerror = () => finish(null);
          recorder.onstop = () => {
            if (!chunks.length) { finish(null); return; }
            finish(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
          };

          video.onended = () => { try { recorder.stop(); } catch (_e) { finish(null); } };

          safetyTimer = setTimeout(() => {
            try { recorder.stop(); } catch (_e) { finish(null); }
          }, maxDurationMs);

          recorder.start();
          video.play().catch(() => finish(null));
        } catch (_e) {
          finish(null);
        }
      };
    } catch (_e) {
      resolve(null);
    }
  });
}

/**
 * Lance l'extraction en arrière-plan et rattache le son au post une fois prêt.
 * Ne bloque jamais la publication : à appeler sans "await" depuis App.jsx.
 */
export async function autoExtractAndAttachSound({ sb, uploadToR2, videoFile, postId, uid, authorName }) {
  if (!videoFile || !postId) return;
  try {
    const blob = await extractAudioBlobFromFile(videoFile);
    if (!blob || blob.size < 2000) return; // rien d'exploitable (muet, ou échec silencieux)

    const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    const soundFile = new File([blob], `son-auto-${postId}.${ext}`, { type: blob.type || "audio/webm" });
    const url = await uploadToR2(soundFile, `sounds/${postId}.${ext}`);

    const { data: newSound } = await sb.from("sounds").insert({
      title: `Son de ${authorName || "…"}`,
      url,
      source_post_id: postId,
      usage_count: 1,
      created_by: uid,
    }).select("id").single();

    if (newSound?.id) {
      await sb.from("posts").update({ sound_id: newSound.id }).eq("id", postId);
    }
  } catch (e) {
    console.warn("Extraction son auto échouée (non bloquant) :", e);
  }
}