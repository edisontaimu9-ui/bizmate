// Verifies Meta's X-Hub-Signature-256 header on incoming webhook payloads —
// this is what stops random internet traffic from POSTing fake "customer
// messages" to the webhook, since Meta doesn't send a bearer token the way
// the rest of this API expects. Uses WebCrypto (available in Workers), no
// npm dependency needed.
async function hmacSha256Hex(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

// rawBody must be the exact, unparsed request body text — signatures are
// computed over the raw bytes, not the re-serialized JSON.
export async function verifyWhatsAppSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret) {
    // Not configured yet — allow through so the webhook still works during
    // initial setup, but this should be treated as a setup TODO, not a
    // permanent state. See agent.md / README for the WHATSAPP_APP_SECRET
    // setup step.
    console.error("WhatsApp webhook: WHATSAPP_APP_SECRET not set — signature verification skipped");
    return true;
  }
  if (!signatureHeader) return false;

  const expected = "sha256=" + (await hmacSha256Hex(appSecret, rawBody));
  return timingSafeEqual(expected, signatureHeader);
}
