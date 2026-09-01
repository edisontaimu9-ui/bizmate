// Verifies a Firebase Auth ID token using Google's public JWKs.
// This is what stands between "anyone can claim to be any user" and real
// authentication — every protected route must call this before trusting
// a uid.
import { jwtVerify, createRemoteJWKSet } from "jose";

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let jwks = null;

export async function verifyIdToken(env, idToken) {
  if (!idToken) throw new AuthError("Missing token");

  if (!jwks) jwks = createRemoteJWKSet(new URL(JWKS_URL));

  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, jwks, {
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
      audience: env.FIREBASE_PROJECT_ID,
    }));
  } catch (err) {
    throw new AuthError(`Invalid token: ${err.message}`);
  }

  if (!payload.sub) throw new AuthError("Token missing subject");
  return { uid: payload.sub, email: payload.email };
}

export class AuthError extends Error {}
