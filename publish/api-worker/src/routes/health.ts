import { createCorsResponse } from "../utils/response";

export const handleHealth = (requestOrigin: string | null, allowedOrigins: string[]) => {
  return createCorsResponse(
    {
      ok: true,
      status: "ok",
      service: "fitflow-api-worker",
      timestamp: new Date().toISOString(),
    },
    200,
    requestOrigin,
    allowedOrigins,
  );
};
