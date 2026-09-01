import { requireAuth } from "../middleware/requireAuth.js";
import { requireBusiness } from "../middleware/requireBusiness.js";
import { selectMany, selectOne, insertOne, updateOne, deleteOne } from "../lib/supabase.js";
import { json, HttpError } from "../lib/http.js";

const WRITABLE_FIELDS = [
  "type", "name", "description", "price", "currency",
  "category", "availability", "enabled", "image_url",
];

// GET /api/products
export async function listProducts(request, env) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);
  const products = await selectMany(env, "products", { business_id: businessId }, { order: "created_at.desc" });
  return json(products);
}

// POST /api/products
export async function createProduct(request, env) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);

  const body = await request.json().catch(() => ({}));
  if (!body.name || !body.name.trim()) throw new HttpError("Product name is required", 422);

  const data = { business_id: businessId, name: body.name.trim() };
  for (const key of WRITABLE_FIELDS) {
    if (key !== "name" && key in body) data[key] = body[key];
  }

  const product = await insertOne(env, "products", data);
  return json(product, 201);
}

// PATCH /api/products/:id
export async function updateProduct(request, env, params) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);

  // Confirm the product belongs to this business before allowing the edit —
  // never trust the :id alone.
  const existing = await selectOne(env, "products", { id: params.id, business_id: businessId });
  if (!existing) throw new HttpError("Product not found", 404);

  const body = await request.json().catch(() => ({}));
  const updates = { updated_at: new Date().toISOString() };
  for (const key of WRITABLE_FIELDS) {
    if (key in body) updates[key] = body[key];
  }

  const updated = await updateOne(env, "products", { id: params.id }, updates);
  return json(updated);
}

// DELETE /api/products/:id
export async function deleteProduct(request, env, params) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);

  const existing = await selectOne(env, "products", { id: params.id, business_id: businessId });
  if (!existing) throw new HttpError("Product not found", 404);

  await deleteOne(env, "products", { id: params.id });
  return json({ deleted: true });
}
