import { requireAuth } from "../middleware/requireAuth.js";
import { requireBusiness } from "../middleware/requireBusiness.js";
import { buildBusinessContext, buildSystemPrompt } from "../lib/assistantContext.js";
import { chatCompletion } from "../lib/llm.js";
import { json, HttpError } from "../lib/http.js";

const MAX_HISTORY_MESSAGES = 12; // keep prompts small and cheap

// POST /api/assistant/test-chat
// { message, history: [{ role: "user"|"assistant", content }, ...] }
// Stateless — the dashboard's test chat keeps history client-side. Real
// customer conversations (Phase 4+) persist to `messages` and will load
// history from there instead of the client.
export async function testChat(request, env) {
  const { uid } = await requireAuth(request, env);
  const businessId = await requireBusiness(env, uid);

  const body = await request.json().catch(() => ({}));
  if (!body.message || !body.message.trim()) {
    throw new HttpError("message is required", 422);
  }

  const context = await buildBusinessContext(env, businessId);
  const systemPrompt = buildSystemPrompt(context);

  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_MESSAGES) : [];
  const messages = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    })),
    { role: "user", content: body.message },
  ];

  let raw;
  try {
    raw = await chatCompletion(env, { systemPrompt, messages, jsonMode: true });
  } catch (err) {
    console.error(err);
    throw new HttpError("The assistant is temporarily unavailable. Please try again.", 502);
  }

  return json(parseAssistantOutput(raw));
}

function parseAssistantOutput(raw) {
  try {
    const data = JSON.parse(raw);
    if (typeof data.reply === "string") {
      return { reply: data.reply, needsHuman: Boolean(data.needsHuman) };
    }
  } catch {
    // fall through to the safe default below
  }
  // Model didn't return valid JSON — fail safe rather than showing broken
  // output to a customer.
  const fallback = raw?.trim();
  return {
    reply: fallback || "I'm having trouble answering right now — let me connect you with someone from the business.",
    needsHuman: !fallback,
  };
}
