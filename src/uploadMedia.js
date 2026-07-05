const UPLOAD_URL = "https://ebmijlgkztggcduemeoi.supabase.co/functions/v1/upload-media";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON;

export async function uploadToR2(file, folder = "media", onProgress = null) {
  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      const url = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);

        xhr.open("POST", UPLOAD_URL);
        xhr.setRequestHeader("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
        xhr.timeout = 300000; // 5 minutes max

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            const pct = Math.round((e.loaded / e.total) * 100);
            onProgress(pct);
          }
        };

        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              onProgress?.(100);
              resolve(data.url);
            } else {
              reject(new Error(data.error || "Erreur upload"));
            }
          } catch {
            reject(new Error("Réponse invalide du serveur"));
          }
        };

        xhr.onerror = () => reject(new Error("Erreur réseau"));
        xhr.ontimeout = () => reject(new Error("Timeout upload"));
        xhr.send(formData);
      });

      return url;

    } catch (err) {
      console.warn(`Upload tentative ${attempt}/${MAX_RETRIES} échouée:`, err.message);
      if (attempt >= MAX_RETRIES) throw err;
      // Attendre avant retry (1s, 2s, 3s)
      await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }
}