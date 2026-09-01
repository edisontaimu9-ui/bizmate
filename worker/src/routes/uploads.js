import { requireAuth } from "../middleware/requireAuth.js";
import { requireBusiness } from "../middleware/requireBusiness.js";
import { createSignedUploadUrl, buildPublicUrl } from "../lib/supabaseStorage.js";
import { json, HttpError } from "../lib/http.js";

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const MAX_NAME_LENGTH = 100;

function safeFileName(name) {
  const trimmed = (name || "file").slice(-MAX_NAME_LENGTH);
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// POST /api/uploads/sign
// { fileName, contentType, purpose: "product" | "knowledge" }
// Returns a signed URL the browser can PUT the file to directly, plus the
// public URL to save on the product/knowledge_item record afterward.
// The path is always <purpose>s/<business_id>/<uuid>-<filename> — the
// client never controls where in the bucket a file lands, only its name
// and bytes.
export async function signUpload(request, env) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);

  const body = await request.json().catch(() => ({}));
  const { fileName, contentType, purpose } = body;

  if (!["product", "knowledge"].includes(purpose)) {
    throw new HttpError("purpose must be 'product' or 'knowledge'", 422);
  }
  if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new HttpError("Unsupported file type. Allowed: JPEG, PNG, WebP, PDF.", 422);
  }

  const path = `${purpose}s/${businessId}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
  const uploadUrl = await createSignedUploadUrl(env, path);

  return json({
    uploadUrl,
    publicUrl: buildPublicUrl(env, path),
    path,
    contentType,
  });
}
