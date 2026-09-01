import { selectMany } from "../lib/supabase.js";
import { HttpError } from "../lib/http.js";

// Core of BizMate's tenant isolation: business_id is NEVER taken from the
// client. It's always derived from the caller's membership row in Postgres.
export async function requireBusiness(env, uid, { requireOne = true } = {}) {
  const memberships = await selectMany(env, "business_members", { uid });
  if (memberships.length === 0) {
    throw new HttpError("No business found for this account", 404);
  }
  if (requireOne) {
    return memberships[0].business_id;
  }
  return memberships.map((m) => m.business_id);
}
