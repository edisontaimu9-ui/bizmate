import { requireAuth } from "../middleware/requireAuth.js";
import { requireBusiness } from "../middleware/requireBusiness.js";
import { selectOne, insertOne, updateOne } from "../lib/supabase.js";
import { json, HttpError } from "../lib/http.js";

// GET /api/whatsapp
export async function getWhatsAppAccount(request, env) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);
  const account = await selectOne(env, "whatsapp_accounts", { business_id: businessId });
  return json(account || { business_id: businessId, status: "disconnected" });
}

// PATCH /api/whatsapp   { phoneNumberId, wabaId? }
// Records which Meta phone number belongs to this business, so the webhook
// can route inbound messages to the right business. This does NOT perform
// the actual registration with Meta — that still happens in Meta's own
// dashboard/API. This is just BizMate's own record of the connection.
export async function updateWhatsAppAccount(request, env) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);

  const body = await request.json().catch(() => ({}));
  if (!body.phoneNumberId || !body.phoneNumberId.trim()) {
    throw new HttpError("phoneNumberId is required", 422);
  }

  const existing = await selectOne(env, "whatsapp_accounts", { business_id: businessId });
  const data = {
    phone_number_id: body.phoneNumberId.trim(),
    waba_id: body.wabaId?.trim() || null,
    status: "connected",
    connected_at: new Date().toISOString(),
  };

  const account = existing
    ? await updateOne(env, "whatsapp_accounts", { business_id: businessId }, data)
    : await insertOne(env, "whatsapp_accounts", { business_id: businessId, ...data });

  return json(account);
}
