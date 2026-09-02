import { chatCompletion } from "./llm.js";

// Pure parsing — shared by test-chat (which surfaces real errors to the
// owner) and the graceful path below (which never surfaces raw errors to
// a customer).
export function parseAssistantOutput(raw) {
  try {
    const data = JSON.parse(raw);
    if (typeof data.reply === "string") {
      return { reply: data.reply, needsHuman: Boolean(data.needsHuman) };
    }
  } catch {
    // fall through to the safe default below
  }
  const fallback = raw?.trim();
  return {
    reply: fallback || "I'm having trouble answering right now — let me connect you with someone from the business.",
    needsHuman: !fallback,
  };
}

// Customer-facing variant: NEVER throws. A real webhook (Phase 5) must
// respond to Meta regardless of whether the LLM call succeeded — throwing
// here would risk WhatsApp retrying the whole webhook delivery. On failure,
// this degrades to a human-handoff message instead, which is exactly the
// right behavior anyway: something's wrong, get a person involved.
export async function generateAssistantReply(env, { systemPrompt, messages }) {
  let raw;
  try {
    raw = await chatCompletion(env, { systemPrompt, messages, jsonMode: true });
  } catch (err) {
    console.error(err);
    return {
      reply: "Sorry, I'm having trouble right now — let me connect you with someone from the business.",
      needsHuman: true,
    };
  }
  return parseAssistantOutput(raw);
}
