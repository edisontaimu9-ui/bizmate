import { requireAuth } from "../middleware/requireAuth.js";
import { requireBusiness } from "../middleware/requireBusiness.js";
import { selectMany, selectOne, insertOne, updateOne, deleteOne } from "../lib/supabase.js";
import { json, HttpError } from "../lib/http.js";

const WRITABLE_FIELDS = ["type", "question", "answer", "content", "enabled", "file_url"];

// GET /api/knowledge
export async function listKnowledge(request, env) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);
  const items = await selectMany(env, "knowledge_items", { business_id: businessId }, { order: "created_at.desc" });
  return json(items);
}

// POST /api/knowledge
// { type: "faq", question, answer } or { type: "instruction", content }
export async function createKnowledge(request, env) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);

  const body = await request.json().catch(() => ({}));
  if (!["faq", "instruction"].includes(body.type)) {
    throw new HttpError("type must be 'faq' or 'instruction'", 422);
  }
  if (body.type === "faq" && (!body.question?.trim() || !body.answer?.trim())) {
    throw new HttpError("FAQ items need both a question and an answer", 422);
  }
  if (body.type === "instruction" && !body.content?.trim()) {
    throw new HttpError("Instruction items need content", 422);
  }

  const data = { business_id: businessId, type: body.type };
  for (const key of WRITABLE_FIELDS) {
    if (key !== "type" && key in body) data[key] = body[key];
  }

  const item = await insertOne(env, "knowledge_items", data);
  return json(item, 201);
}

// PATCH /api/knowledge/:id
export async function updateKnowledge(request, env, params) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);

  const existing = await selectOne(env, "knowledge_items", { id: params.id, business_id: businessId });
  if (!existing) throw new HttpError("Knowledge item not found", 404);

  const body = await request.json().catch(() => ({}));
  const updates = { updated_at: new Date().toISOString() };
  for (const key of WRITABLE_FIELDS) {
    if (key in body) updates[key] = body[key];
  }

  const updated = await updateOne(env, "knowledge_items", { id: params.id }, updates);
  return json(updated);
}

// DELETE /api/knowledge/:id
export async function deleteKnowledge(request, env, params) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);

  const existing = await selectOne(env, "knowledge_items", { id: params.id, business_id: businessId });
  if (!existing) throw new HttpError("Knowledge item not found", 404);

  await deleteOne(env, "knowledge_items", { id: params.id });
  return json({ deleted: true });
}
