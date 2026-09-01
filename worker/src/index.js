import { json, errorResponse, HttpError } from "./lib/http.js";
import { createProfile, getProfile } from "./routes/auth.js";
import { createBusiness, getBusiness, updateBusiness, updateBusinessSettings } from "./routes/business.js";
import { listProducts, createProduct, updateProduct, deleteProduct } from "./routes/products.js";
import { listKnowledge, createKnowledge, updateKnowledge, deleteKnowledge } from "./routes/knowledge.js";
import { signUpload } from "./routes/uploads.js";
import { testChat } from "./routes/assistant.js";

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
      return json({}, 204);
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
