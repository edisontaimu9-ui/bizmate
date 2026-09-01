import { verifyIdToken, AuthError } from "../lib/verifyIdToken.js";
import { HttpError } from "../lib/http.js";

// Returns { uid, email } or throws HttpError(401). Call at the top of every
// protected route handler:
//   const { uid } = await requireAuth(request, env);
export async function requireAuth(request, env) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) throw new HttpError("Missing or malformed Authorization header", 401);

  try {
    return await verifyIdToken(env, match[1]);
  } catch (err) {
    if (err instanceof AuthError) throw new HttpError(err.message, 401);
    throw err;
  }
}
