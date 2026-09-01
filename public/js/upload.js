import { apiFetch } from "./api.js";

// Uploads a File: 1) ask the Worker to sign a business-scoped path,
// 2) PUT the bytes straight to Supabase Storage (Worker never sees them),
// 3) return the public URL to save on the product/knowledge record.
export async function uploadFile(file, purpose) {
  const { uploadUrl, publicUrl, contentType } = await apiFetch("/api/uploads/sign", {
    method: "POST",
    body: { fileName: file.name, contentType: file.type, purpose },
  });

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

  return publicUrl;
}
