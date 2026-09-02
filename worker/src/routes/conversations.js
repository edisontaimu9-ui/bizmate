import { requireAuth } from "../middleware/requireAuth.js";
import { requireBusiness } from "../middleware/requireBusiness.js";
import { selectOne, selectMany, insertOne, updateOne } from "../lib/supabase.js";
import { json, HttpError } from "../lib/http.js";

// GET /api/conversations
export async function listConversations(request, env) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);

  const conversations = await selectMany(
    env,
    "conversations",
    { business_id: businessId },
    { order: "last_message_at.desc" }
  );

  // Small dataset at MVP scale — fetch each customer individually rather
  // than adding join support to the Supabase REST wrapper.
  const withCustomers = await Promise.all(
    conversations.map(async (c) => ({
      ...c,
      customer: await selectOne(env, "customers", { id: c.customer_id }),
    }))
  );
  return json(withCustomers);
}

// GET /api/conversations/:id
export async function getConversation(request, env, params) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);

  const conversation = await selectOne(env, "conversations", { id: params.id, business_id: businessId });
  if (!conversation) throw new HttpError("Conversation not found", 404);

  const [customer, messages] = await Promise.all([
    selectOne(env, "customers", { id: conversation.customer_id }),
    selectMany(env, "messages", { conversation_id: params.id }, { order: "created_at.asc" }),
  ]);

  return json({ ...conversation, customer, messages });
}

// PATCH /api/conversations/:id   { status: "assistant" | "human" | "closed" }
// This IS the human handoff mechanism — "human" means the owner has taken
// over and the assistant must stay silent (enforced in simulate.js /
// the Phase 5 webhook) until this is set back to "assistant".
export async function updateConversationStatus(request, env, params) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);

  const existing = await selectOne(env, "conversations", { id: params.id, business_id: businessId });
  if (!existing) throw new HttpError("Conversation not found", 404);

  const body = await request.json().catch(() => ({}));
  if (!["assistant", "human", "closed"].includes(body.status)) {
    throw new HttpError("status must be 'assistant', 'human', or 'closed'", 422);
  }

  const updated = await updateOne(env, "conversations", { id: params.id }, { status: body.status });
  return json(updated);
}

// POST /api/conversations/:id/messages   { text }
// The owner replying directly while they've taken a conversation over.
export async function sendOwnerMessage(request, env, params) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);

  const conversation = await selectOne(env, "conversations", { id: params.id, business_id: businessId });
  if (!conversation) throw new HttpError("Conversation not found", 404);

  const body = await request.json().catch(() => ({}));
  if (!body.text || !body.text.trim()) throw new HttpError("text is required", 422);

  const text = body.text.trim();
  const message = await insertOne(env, "messages", {
    business_id: businessId,
    conversation_id: params.id,
    sender: "owner",
    text,
  });

  await updateOne(env, "conversations", { id: params.id }, {
    last_message_preview: text.slice(0, 200),
    last_message_at: new Date().toISOString(),
  });

  // Phase 5 TODO: actually send this out over the WhatsApp Cloud API.
  return json(message, 201);
}
