export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Adjust to your actual frontend origin(s) before going to production.
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      ...extraHeaders,
    },
  });
}

export function errorResponse(message, status = 400) {
  // Never leak internal details (stack traces, secrets, prompts) to the client.
  return json({ error: message }, status);
}

export class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
