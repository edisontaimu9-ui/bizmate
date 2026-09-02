import { requireAuth } from "../middleware/requireAuth.js";
import { requireBusiness } from "../middleware/requireBusiness.js";
import { selectMany, insertOne, updateOne } from "../lib/supabase.js";
import { findOrCreateCustomer, findOrCreateActiveConversation } from "../lib/conversationHelpers.js";
import { buildBusinessContext, buildSystemPrompt } from "../lib/assistantContext.js";
import { generateAssistantReply } from "../lib/assistantReply.js";
import { json, HttpError } from "../lib/http.js";

const MAX_HISTORY_MESSAGES = 12;

// POST /api/dev/simulate-message
// { whatsappNumber, customerName?, message }
// Owner-only dev tool (requires auth + business ownership, same as every
// other route here — this is NOT the public webhook). Walks the exact same
// customer -> conversation -> assistant path Phase 5's real WhatsApp
// webhook will use, so conversations/messages/handoff can be fully tested
// before any Meta credentials exist.
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

  const customer = await findOrCreateCustomer(
    env,
    businessId,
    body.whatsappNumber.trim(),
    body.customerName?.trim() || null
  );
  const conversation = await findOrCreateActiveConversation(env, businessId, customer.id);

  const messageText = body.message.trim();
  const customerMessage = await insertOne(env, "messages", {
    business_id: businessId,
    conversation_id: conversation.id,
    sender: "customer",
    text: messageText,
  });

  await updateOne(env, "customers", { id: customer.id }, {
    last_message_at: new Date().toISOString(),
  });
  await updateOne(env, "conversations", { id: conversation.id }, {
    last_message_preview: messageText.slice(0, 200),
    last_message_at: new Date().toISOString(),
  });

  // Handoff contract: once a human has taken over, the assistant stays
  // silent — it does not auto-reply again until the owner returns the
  // conversation to "assistant" status.
  if (conversation.status === "human") {
    return json({ conversation, customerMessage, assistantMessage: null });
  }

  const context = await buildBusinessContext(env, businessId);
  const systemPrompt = buildSystemPrompt(context);

  const history = await selectMany(
    env,
    "messages",
    { conversation_id: conversation.id },
    { order: "created_at.asc" }
  );
  const messages = history.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
    role: m.sender === "customer" ? "user" : "assistant",
    content: m.text,
  }));

  const result = await generateAssistantReply(env, { systemPrompt, messages });

  const assistantMessage = await insertOne(env, "messages", {
    business_id: businessId,
    conversation_id: conversation.id,
    sender: "assistant",
    text: result.reply,
  });

  const conversationUpdates = {
    last_message_preview: result.reply.slice(0, 200),
    last_message_at: new Date().toISOString(),
  };
  // Auto-handoff: if the assistant couldn't answer confidently, switch the
  // conversation to "human" so it stops auto-replying on the customer's
  // next message and shows up flagged for the owner.
  if (result.needsHuman) conversationUpdates.status = "human";

  await updateOne(env, "conversations", { id: conversation.id }, conversationUpdates);

  return json({
    conversation: { ...conversation, ...conversationUpdates },
    customerMessage,
    assistantMessage,
  });
}
