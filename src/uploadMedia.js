const PRESIGN_URL = "https://ebmijlgkztggcduemeoi.supabase.co/functions/v1/presign-upload";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON;

export async function uploadToR2(file, folder = "media", onProgress = null) {
  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      // 1) Demande une URL signée (aucun transfert de fichier à cette étape — quasi instantané)
      const presignRes = await fetch(PRESIGN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ folder, fileName: file.name, fileSize: file.size }),
      });
      const presignData = await presignRes.json().catch(() => null);
      if (!presignRes.ok || !presignData?.uploadUrl) {
        throw new Error(presignData?.error || "Erreur de préparation de l'upload");
      }

      // 2) Upload direct du fichier vers R2 (un seul saut réseau)
      const publicUrl = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presignData.uploadUrl);
        xhr.timeout = 300000; // 5 minutes max

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            const pct = Math.round((e.loaded / e.total) * 100);
            onProgress(pct);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            onProgress?.(100);
            resolve(presignData.publicUrl);
          } else {
            reject(new Error("Erreur upload (" + xhr.status + ")"));
          }
        };

        xhr.onerror = () => reject(new Error("Erreur réseau"));
        xhr.ontimeout = () => reject(new Error("Timeout upload"));
        xhr.send(file);
      });

      return publicUrl;

    } catch (err) {
      console.warn(`Upload tentative ${attempt}/${MAX_RETRIES} échouée:`, err.message);
      if (attempt >= MAX_RETRIES) throw err;
      // Attendre avant retry (1s, 2s, 3s)
      await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }
}