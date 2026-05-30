const UPLOAD_URL = "https://ebmijlgkztggcduemeoi.supabase.co/functions/v1/upload-media";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON;

export async function uploadToR2(file, folder = "media") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const response = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Erreur upload");
  }

  return data.url;
}