export type AllowedOriginEnv = string | undefined;

export type CfEnv = {
  CORS_ALLOWED_ORIGINS?: string;
  FRONTEND_ORIGINS?: string;
};

export const parseOriginList = (value: AllowedOriginEnv) =>
  (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const getAllowedOrigins = (env: CfEnv) => {
  return Array.from(
    new Set([
      ...parseOriginList(env.CORS_ALLOWED_ORIGINS),
      ...parseOriginList(env.FRONTEND_ORIGINS),
      "http://localhost:6173",
      "http://localhost:3000",
    ]),
  );
};

export const chooseOrigin = (
  requestOrigin: string | null,
  allowedOrigins: string[],
) => {
  if (!requestOrigin) {
    return "*";
  }

  if (allowedOrigins.includes("*")) {
    return "*";
  }

  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return allowedOrigins.includes("null") ? "*" : "null";
};

export const createCorsResponse = (
  body: unknown,
  status: number,
  requestOrigin: string | null,
  allowedOrigins: string[],
) => {
  const origin = chooseOrigin(requestOrigin, allowedOrigins);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods":
        "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, x-tenant-key",
      "Access-Control-Allow-Credentials": "true",
    },
  });
};

export const createOptionsResponse = (
  requestOrigin: string | null,
  allowedOrigins: string[],
) => {
  const origin = chooseOrigin(requestOrigin, allowedOrigins);
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, x-tenant-key",
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
    },
  });
};

export const withCorsHeaders = async (
  response: Response,
  requestOrigin: string | null,
  allowedOrigins: string[],
) => {
  const origin = chooseOrigin(requestOrigin, allowedOrigins);
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
