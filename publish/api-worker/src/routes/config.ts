import { createCorsResponse } from "../utils/response";

export const handleConfig = (
  requestOrigin: string | null,
  allowedOrigins: string[],
  env: {
    APP_ENV?: string;
    NEON_DATABASE_URL?: string;
    BACKEND_API_URL?: string;
  },
) => {
  return createCorsResponse(
    {
      ok: true,
      appEnv: env.APP_ENV || "development",
      hasNeonUrl: Boolean(env.NEON_DATABASE_URL),
      hasBackendUrl: Boolean(env.BACKEND_API_URL),
      frontendOrigins: allowedOrigins,
      message:
        "This endpoint is for verify deploy config, does not expose secrets.",
    },
    200,
    requestOrigin,
    allowedOrigins,
  );
};
