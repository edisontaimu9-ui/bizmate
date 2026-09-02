import { requireAuth } from "../middleware/requireAuth.js";
import { requireBusiness } from "../middleware/requireBusiness.js";
import { buildBusinessContext, buildSystemPrompt } from "../lib/assistantContext.js";
import { chatCompletion } from "../lib/llm.js";
import { parseAssistantOutput } from "../lib/assistantReply.js";
import { json, HttpError } from "../lib/http.js";

const MAX_HISTORY_MESSAGES = 12; // keep prompts small and cheap

// POST /api/assistant/test-chat
// { message, history: [{ role: "user"|"assistant", content }, ...] }
// Stateless — the dashboard's test chat keeps history client-side, unlike
// real conversations (Phase 4+) which persist to `messages`. Unlike the
// simulate/webhook path, this one intentionally surfaces real LLM errors
// (502 + message) rather than degrading gracefully — it's an owner-facing
// debugging tool, not customer-facing.
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
