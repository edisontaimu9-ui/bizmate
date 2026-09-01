// Provider-agnostic chat completion client. Defaults to Groq's OpenAI-
// compatible endpoint (matches the LLM already used across this developer's
// other projects — Oasis CNST uses Groq LLaMA 3.3 70B) but works with
// anything speaking the same wire format (OpenAI, Together, Fireworks,
// etc.) by changing LLM_BASE_URL / LLM_MODEL. Never expose LLM_API_KEY to
// the frontend — this file only ever runs in the Worker.

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export async function chatCompletion(env, { systemPrompt, messages, jsonMode = false }) {
  const baseUrl = env.LLM_BASE_URL || DEFAULT_BASE_URL;
  const model = env.LLM_MODEL || DEFAULT_MODEL;

  const body = {
    model,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    temperature: 0.3,
    max_tokens: 600,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`LLM request failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}
