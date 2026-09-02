import { selectOne, selectMany, insertOne } from "./supabase.js";

export async function findOrCreateCustomer(env, businessId, whatsappNumber, name) {
  const existing = await selectOne(env, "customers", {
    business_id: businessId,
    whatsapp_number: whatsappNumber,
  });
  if (existing) return existing;

  return insertOne(env, "customers", {
    business_id: businessId,
    whatsapp_number: whatsappNumber,
    name: name || null,
  });
}

// Reuses the customer's most recent conversation unless it's closed, in
// which case a fresh one starts. Keeps a customer from accumulating a new
// conversation row per message while still letting "closed" mean closed.
export async function findOrCreateActiveConversation(env, businessId, customerId) {
  const recent = await selectMany(
    env,
    "conversations",
    { business_id: businessId, customer_id: customerId },
    { order: "created_at.desc", limit: 1 }
  );
  const latest = recent[0];
  if (latest && latest.status !== "closed") return latest;

  return insertOne(env, "conversations", {
    business_id: businessId,
    customer_id: customerId,
    status: "assistant",
  });
}
