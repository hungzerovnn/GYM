import { createCorsResponse, withCorsHeaders } from "../utils/response";

export const handleProxy = async (
  request: Request,
  requestOrigin: string | null,
  allowedOrigins: string[],
  backendUrl: string | undefined,
) => {
  if (!backendUrl) {
    return createCorsResponse(
      {
        ok: false,
        error:
          "BACKEND_API_URL is not set. Set this variable to point to current NestJS API URL.",
      },
      503,
      requestOrigin,
      allowedOrigins,
    );
  }

  const incoming = new URL(request.url);
  const targetBase = backendUrl.replace(/\/$/, "");
  const upstreamUrl = new URL(
    `${incoming.pathname}${incoming.search}`,
    `${targetBase}/`,
  );

  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.delete("host");
  upstreamHeaders.set("x-forwarded-host", incoming.hostname);
  upstreamHeaders.set("x-forwarded-proto", incoming.protocol.replace(":", ""));

  const proxiedResponse = await fetch(upstreamUrl.toString(), {
    method: request.method,
    headers: upstreamHeaders,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });

  return withCorsHeaders(proxiedResponse, requestOrigin, allowedOrigins);
};
