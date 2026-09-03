import { selectOne } from "../lib/supabase.js";
import { processInboundMessage } from "../lib/inboundMessage.js";
import { sendWhatsAppMessage } from "../lib/whatsapp.js";
import { verifyWhatsAppSignature } from "../lib/whatsappSignature.js";

// GET /webhooks/whatsapp — Meta's verification handshake, called once when
// you configure the webhook in Meta's dashboard. Public endpoint, no bearer
// token: Meta calls this directly and expects the raw challenge string
// echoed back as plain text.
export async function verifyWebhook(request, env) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// POST /webhooks/whatsapp — inbound message delivery. Public — authenticated
// via the X-Hub-Signature-256 HMAC instead of a bearer token, since Meta
// doesn't send one. ALWAYS returns 200 once the signature checks out, even
// if internal processing fails: Meta retries aggressively (and can
// eventually disable a webhook) on non-200 responses, so processing errors
// are logged and swallowed here rather than surfaced as a failed response.
export async function receiveWebhook(request, env) {
  const rawBody = await request.text();

  const signatureOk = await verifyWhatsAppSignature(
    rawBody,
    request.headers.get("x-hub-signature-256"),
    env.WHATSAPP_APP_SECRET
  );
  if (!signatureOk) {
    console.error("WhatsApp webhook: signature verification failed");
    return new Response("Forbidden", { status: 403 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  try {
    await processPayload(env, payload);
  } catch (err) {
    console.error("WhatsApp webhook processing error:", err);
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}

async function processPayload(env, payload) {
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const phoneNumberId = value.metadata?.phone_number_id;
      const messages = value.messages || [];
      // No messages here usually means a status update (sent/delivered/
      // read receipt) rather than an inbound message — nothing to do.
      if (!phoneNumberId || messages.length === 0) continue;

      const account = await selectOne(env, "whatsapp_accounts", { phone_number_id: phoneNumberId });
      if (!account) {
        console.error(`WhatsApp webhook: no business connected for phone_number_id ${phoneNumberId}`);
        continue;
      }

      for (const message of messages) {
        await handleInboundMessage(env, account.business_id, message, value.contacts);
      }
    }
  }
}

async function handleInboundMessage(env, businessId, message, contacts) {
  // MVP limitation: only text messages are understood for now. Images,
  // voice notes, etc. are silently ignored rather than breaking the
  // pipeline — a future phase could handle these explicitly.
  if (message.type !== "text") return;

  const text = message.text?.body?.trim();
  if (!text) return;

  const whatsappNumber = message.from;
  const contactName = contacts?.find((c) => c.wa_id === whatsappNumber)?.profile?.name || null;

  const result = await processInboundMessage(env, businessId, {
    whatsappNumber,
    customerName: contactName,
    text,
    whatsappMessageId: message.id,
  });

  if (result.assistantMessage) {
    try {
      await sendWhatsAppMessage(env, { to: whatsappNumber, text: result.assistantMessage.text });
    } catch (err) {
      console.error("Failed to send WhatsApp reply:", err);
    }
  }
}
