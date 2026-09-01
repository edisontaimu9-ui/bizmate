import { requireAuth } from "../middleware/requireAuth.js";
import { requireBusiness } from "../middleware/requireBusiness.js";
import { selectOne, selectMany, insertOne, updateOne } from "../lib/supabase.js";
import { json, HttpError } from "../lib/http.js";

// POST /api/business
// { name, description, location, phone }
// Creates the business, makes the caller its owner, and seeds an empty
// settings row. A user with no business yet is the one case where we don't
// resolve business_id from membership first — this route CREATES that membership.
export async function createBusiness(request, env) {
  const { uid } = await requireAuth(request, env);

  const existing = await selectMany(env, "business_members", { uid });
  if (existing.length > 0) {
    throw new HttpError("This account already has a business", 409);
  }

  const body = await request.json().catch(() => ({}));
  if (!body.name || !body.name.trim()) {
    throw new HttpError("Business name is required", 422);
  }

  const business = await insertOne(env, "businesses", {
    name: body.name.trim(),
    description: body.description || "",
    location: body.location || "",
    phone: body.phone || "",
    owner_uid: uid,
  });

  await insertOne(env, "business_members", {
    business_id: business.id,
    uid,
    role: "owner",
  });

  await insertOne(env, "business_settings", {
    business_id: business.id,
  });

  return json(business, 201);
}

// GET /api/business — the caller's own business + settings
export async function getBusiness(request, env) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);

  const [business, settings] = await Promise.all([
    selectOne(env, "businesses", { id: businessId }),
    selectOne(env, "business_settings", { business_id: businessId }),
  ]);
  return json({ ...business, settings });
}

// PATCH /api/business — update profile fields
export async function updateBusiness(request, env) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);

  const body = await request.json().catch(() => ({}));
  const allowed = ["name", "description", "location", "phone"];
  const updates = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const updated = await updateOne(env, "businesses", { id: businessId }, updates);
  return json(updated);
}

// PATCH /api/business/settings — opening hours, delivery, payment, policies
export async function updateBusinessSettings(request, env) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);

  const body = await request.json().catch(() => ({}));
  const fieldMap = {
    openingHours: "opening_hours",
    delivery: "delivery",
    paymentMethods: "payment_methods",
    policies: "policies",
  };
  const updates = { updated_at: new Date().toISOString() };
  for (const [key, column] of Object.entries(fieldMap)) {
    if (key in body) updates[column] = body[key];
  }

  const updated = await updateOne(env, "business_settings", { business_id: businessId }, updates);
  return json(updated);
}
