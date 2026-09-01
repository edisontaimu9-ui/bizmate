// Firebase Auth handles signup/login on the FRONTEND (via the Firebase Auth
// JS SDK) — the Worker never sees passwords. These routes handle what
// happens on OUR side once the frontend has a verified user: creating/
// reading the `users` row in Postgres.
import { requireAuth } from "../middleware/requireAuth.js";
import { selectOne, insertOne } from "../lib/supabase.js";
import { json, HttpError } from "../lib/http.js";

// POST /api/auth/profile  { displayName }
// Called once right after the frontend completes Firebase signup. Idempotent.
export async function createProfile(request, env) {
  const { uid, email } = await requireAuth(request, env);
  const body = await request.json().catch(() => ({}));

  const existing = await selectOne(env, "users", { id: uid });
  if (existing) return json(existing);

  const profile = await insertOne(env, "users", {
    id: uid,
    email,
    display_name: (body.displayName || "").trim() || email,
  });
  return json(profile, 201);
}

// GET /api/auth/profile
export async function getProfile(request, env) {
  const { uid } = await requireAuth(request, env);
  const profile = await selectOne(env, "users", { id: uid });
  if (!profile) throw new HttpError("Profile not found — call POST /api/auth/profile first", 404);
  return json(profile);
}
