import { checkNeonConnection } from "../db";
import { createCorsResponse } from "../utils/response";

export const handleDbCheck = async (
  requestOrigin: string | null,
  allowedOrigins: string[],
  neonUrl: string | undefined,
) => {
  if (!neonUrl) {
    return createCorsResponse(
      {
        ok: false,
        connected: false,
        error:
          "NEON_DATABASE_URL is missing. Add NEON_DATABASE_URL into publish/api-worker/.dev.vars (local) or worker secret (production).",
      },
      500,
      requestOrigin,
      allowedOrigins,
    );
  }

  try {
    const result = await checkNeonConnection(neonUrl);
    return createCorsResponse(
      {
        ok: true,
        route: "/api/db-check",
        database: result.database,
        user: result.user,
        now: result.now,
        connected: true,
      },
      200,
      requestOrigin,
      allowedOrigins,
    );
  } catch (error) {
    return createCorsResponse(
      {
        ok: false,
        route: "/api/db-check",
        connected: false,
        error:
          error instanceof Error
            ? error.message
            : "Cannot connect to Neon database.",
      },
      500,
      requestOrigin,
      allowedOrigins,
    );
  }
};
