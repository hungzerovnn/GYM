import { getAllowedOrigins, createOptionsResponse } from "./utils/response";
import { handleConfig } from "./routes/config";
import { handleDbCheck } from "./routes/db-check";
import { handleHealth } from "./routes/health";
import { handleProxy } from "./routes/proxy";

export interface Env {
  NEON_DATABASE_URL?: string;
  APP_ENV?: string;
  BACKEND_API_URL?: string;
  FRONTEND_ORIGINS?: string;
  CORS_ALLOWED_ORIGINS?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const requestOrigin = request.headers.get("origin");
    const allowedOrigins = getAllowedOrigins({
      FRONTEND_ORIGINS: env.FRONTEND_ORIGINS,
      CORS_ALLOWED_ORIGINS: env.CORS_ALLOWED_ORIGINS,
    });

    if (request.method === "OPTIONS") {
      return createOptionsResponse(requestOrigin, allowedOrigins);
    }

    if (url.pathname.startsWith("/api/health")) {
      return handleHealth(requestOrigin, allowedOrigins);
    }

    if (url.pathname.startsWith("/api/db-check")) {
      return handleDbCheck(requestOrigin, allowedOrigins, env.NEON_DATABASE_URL);
    }

    if (url.pathname.startsWith("/api/config")) {
      return handleConfig(requestOrigin, allowedOrigins, {
        APP_ENV: env.APP_ENV,
        NEON_DATABASE_URL: env.NEON_DATABASE_URL,
        BACKEND_API_URL: env.BACKEND_API_URL,
      });
    }

    if (url.pathname.startsWith("/api")) {
      return handleProxy(request, requestOrigin, allowedOrigins, env.BACKEND_API_URL);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message:
          "FitFlow API Worker is running. Available routes: /api/health, /api/db-check, /api/config.",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": requestOrigin || "*",
        },
      },
    );
  },
};
