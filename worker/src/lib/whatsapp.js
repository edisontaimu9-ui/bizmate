// WhatsApp Cloud API send wrapper. Uses a single Worker-wide access token +
// phone_number_id (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID secrets)
// — fine for one connected business/test number. A genuinely multi-tenant
// version (multiple businesses, each with their own WABA) would look up a
// per-business token instead of this global secret; whatsapp_accounts
// already has a comment noting that future step.
export async function sendWhatsAppMessage(env, { to, text }) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`WhatsApp send failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
