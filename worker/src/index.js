import { json, errorResponse, HttpError } from "./lib/http.js";
import { createProfile, getProfile } from "./routes/auth.js";
import { createBusiness, getBusiness, updateBusiness, updateBusinessSettings } from "./routes/business.js";
import { listProducts, createProduct, updateProduct, deleteProduct } from "./routes/products.js";
import { listKnowledge, createKnowledge, updateKnowledge, deleteKnowledge } from "./routes/knowledge.js";
import { signUpload } from "./routes/uploads.js";
import { testChat } from "./routes/assistant.js";
import {
  listConversations,
  getConversation,
  updateConversationStatus,
  sendOwnerMessage,
} from "./routes/conversations.js";
import { simulateMessage } from "./routes/simulate.js";
import { getWhatsAppAccount, updateWhatsAppAccount } from "./routes/whatsappAccount.js";
import { verifyWebhook, receiveWebhook } from "./routes/whatsappWebhook.js";

// path patterns support a single ":id" segment — enough for this API's shape.
const routes = [
  ["POST", "/api/auth/profile", createProfile],
  ["GET", "/api/auth/profile", getProfile],

  ["POST", "/api/business", createBusiness],
  ["GET", "/api/business", getBusiness],
  ["PATCH", "/api/business", updateBusiness],
  ["PATCH", "/api/business/settings", updateBusinessSettings],

  ["GET", "/api/products", listProducts],
  ["POST", "/api/products", createProduct],
  ["PATCH", "/api/products/:id", updateProduct],
  ["DELETE", "/api/products/:id", deleteProduct],

  ["GET", "/api/knowledge", listKnowledge],
  ["POST", "/api/knowledge", createKnowledge],
  ["PATCH", "/api/knowledge/:id", updateKnowledge],
  ["DELETE", "/api/knowledge/:id", deleteKnowledge],

  ["POST", "/api/uploads/sign", signUpload],

  ["POST", "/api/assistant/test-chat", testChat],

  ["GET", "/api/conversations", listConversations],
  ["GET", "/api/conversations/:id", getConversation],
  ["PATCH", "/api/conversations/:id", updateConversationStatus],
  ["POST", "/api/conversations/:id/messages", sendOwnerMessage],

  ["POST", "/api/dev/simulate-message", simulateMessage],

  ["GET", "/api/whatsapp", getWhatsAppAccount],
  ["PATCH", "/api/whatsapp", updateWhatsAppAccount],

  // Public — no bearer token. Meta calls these directly; auth is via the
  // verify token (GET) and X-Hub-Signature-256 (POST) instead.
  ["GET", "/webhooks/whatsapp", verifyWebhook],
  ["POST", "/webhooks/whatsapp", receiveWebhook],
];

function matchRoute(method, pathname) {
  for (const [routeMethod, pattern, handler] of routes) {
    if (routeMethod !== method) continue;
    const patternParts = pattern.split("/").filter(Boolean);
    const pathParts = pathname.split("/").filter(Boolean);
    if (patternParts.length !== pathParts.length) continue;

    const params = {};
    let matched = true;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(":")) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return { handler, params };
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      // A 204 response must not have a body — the Workers runtime throws if
      // constructed with one (json() always sends a body). This was
      // crashing every CORS preflight request, which broke every write
      // endpoint (anything sending Authorization + Content-Type headers).
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        },
      });
    }

    const url = new URL(request.url);
    const match = matchRoute(request.method, url.pathname);

    if (!match) {
      return errorResponse("Not found", 404);
    }

    try {
      return await match.handler(request, env, match.params);
    } catch (err) {
      if (err instanceof HttpError) {
        return errorResponse(err.message, err.status);
      }
      // Log full detail server-side only — never return internals to the client.
      console.error(err);
      return errorResponse("Internal server error", 500);
    }
  },
};
