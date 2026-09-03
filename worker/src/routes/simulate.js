import { requireAuth } from "../middleware/requireAuth.js";
import { requireBusiness } from "../middleware/requireBusiness.js";
import { processInboundMessage } from "../lib/inboundMessage.js";
import { json, HttpError } from "../lib/http.js";

// POST /api/dev/simulate-message
// { whatsappNumber, customerName?, message }
// Owner-only dev tool (requires auth + business ownership — this is NOT
// the public webhook). Runs the exact same pipeline the real WhatsApp
// webhook uses (see lib/inboundMessage.js), just without an actual
// WhatsApp number to send the reply to.
export async function simulateMessage(request, env) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);

  const body = await request.json().catch(() => ({}));
  if (!body.whatsappNumber || !body.whatsappNumber.trim()) {
    throw new HttpError("whatsappNumber is required", 422);
  }
  if (!body.message || !body.message.trim()) {
    throw new HttpError("message is required", 422);
  }

  const result = await processInboundMessage(env, businessId, {
    whatsappNumber: body.whatsappNumber.trim(),
    customerName: body.customerName?.trim() || null,
    text: body.message.trim(),
  });

  return json(result);
}
