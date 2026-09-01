import { json, errorResponse, HttpError } from "./lib/http.js";
import { createProfile, getProfile } from "./routes/auth.js";
import { createBusiness, getBusiness, updateBusiness, updateBusinessSettings } from "./routes/business.js";

const routes = [
  ["POST", "/api/auth/profile", createProfile],
  ["GET", "/api/auth/profile", getProfile],
  ["POST", "/api/business", createBusiness],
  ["GET", "/api/business", getBusiness],
  ["PATCH", "/api/business", updateBusiness],
  ["PATCH", "/api/business/settings", updateBusinessSettings],
];

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return json({}, 204);
    }

    const url = new URL(request.url);
    const match = routes.find(([method, path]) => method === request.method && path === url.pathname);

    if (!match) {
      return errorResponse("Not found", 404);
    }

    try {
      return await match[2](request, env, ctx);
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
