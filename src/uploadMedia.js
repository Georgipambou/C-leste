// App.jsx fournit la fonction qui lit le jeton de session (évite un 2e client Supabase)
let getToken = async () => null;
export function setUploadTokenGetter(fn) { getToken = fn; }

const UPLOAD_URL = "https://upload.celesteapp.social/upload";

export async function uploadToR2(file, folder = "media", onProgress = null) {
  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      // 1) Jeton de session (le Worker vérifie l'utilisateur)
      const accessToken = await getToken();
      if (!accessToken) throw new Error("Session expirée, reconnecte-toi");
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const target = `${UPLOAD_URL}?folder=${encodeURIComponent(folder)}&ext=${ext}`;

      // 2) Upload direct du fichier vers R2 (un seul saut réseau)
      const publicUrl = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", target);
        xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
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
            try { resolve(JSON.parse(xhr.responseText).publicUrl); }
            catch { reject(new Error("Réponse upload invalide")); }
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