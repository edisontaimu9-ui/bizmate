import { selectMany, insertOne, updateOne } from "./supabase.js";
import { findOrCreateCustomer, findOrCreateActiveConversation } from "./conversationHelpers.js";
import { buildBusinessContext, buildSystemPrompt } from "./assistantContext.js";
import { generateAssistantReply } from "./assistantReply.js";

const MAX_HISTORY_MESSAGES = 12;

// Core inbound-message pipeline, shared by the real WhatsApp webhook
// (Phase 5) and the owner-facing "simulate incoming message" dev tool
// (Phase 4) — both call this so there's exactly one place that decides how
// a customer message gets persisted, when the assistant replies, and when
// handoff kicks in. Persists the customer message, respects human handoff
// (stays silent if the conversation is already in "human" status), and
// otherwise generates + persists an assistant reply, auto-switching to
// "human" if the assistant couldn't answer confidently.
//
// Does NOT send anything over WhatsApp — callers decide what to do with
// the resulting assistantMessage (the webhook sends it; simulate doesn't,
// since there's no real WhatsApp number on the other end during testing).
export async function processInboundMessage(env, businessId, { whatsappNumber, customerName, text, whatsappMessageId }) {
  const customer = await findOrCreateCustomer(env, businessId, whatsappNumber, customerName || null);
  const conversation = await findOrCreateActiveConversation(env, businessId, customer.id);

  const customerMessage = await insertOne(env, "messages", {
    business_id: businessId,
    conversation_id: conversation.id,
    sender: "customer",
    text,
    whatsapp_message_id: whatsappMessageId || null,
  });

  await updateOne(env, "customers", { id: customer.id }, {
    last_message_at: new Date().toISOString(),
  });
  await updateOne(env, "conversations", { id: conversation.id }, {
    last_message_preview: text.slice(0, 200),
    last_message_at: new Date().toISOString(),
  });

  if (conversation.status === "human") {
    return { conversation, customerMessage, assistantMessage: null };
  }

  const context = await buildBusinessContext(env, businessId);
  const systemPrompt = buildSystemPrompt(context);

  const history = await selectMany(
    env,
    "messages",
    { conversation_id: conversation.id },
    { order: "created_at.asc" }
  );
  const chatMessages = history.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
    role: m.sender === "customer" ? "user" : "assistant",
    content: m.text,
  }));

  const result = await generateAssistantReply(env, { systemPrompt, messages: chatMessages });

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
  if (result.needsHuman) conversationUpdates.status = "human";
  await updateOne(env, "conversations", { id: conversation.id }, conversationUpdates);

  return {
    conversation: { ...conversation, ...conversationUpdates },
    customerMessage,
    assistantMessage,
  };
}
