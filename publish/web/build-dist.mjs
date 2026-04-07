import fs from "node:fs";
import path from "node:path";
import { distDir, getRequiredEnv, loadPublishWebEnv } from "./env.mjs";

const env = loadPublishWebEnv();
const upstreamUrl = getRequiredEnv(env, "FRONTEND_UPSTREAM_URL").replace(/\/$/, "");

const workerSource = `export default {
  async fetch(request) {
    const incomingUrl = new URL(request.url);
    const upstreamBase = "${upstreamUrl}";
    const targetUrl = new URL(\`\${incomingUrl.pathname}\${incomingUrl.search}\`, \`\${upstreamBase}/\`);
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.set("x-forwarded-host", incomingUrl.host);
    headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));

    return fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });
  },
};
`;

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, "_worker.js"), workerSource, "utf8");
fs.writeFileSync(
  path.join(distDir, "index.html"),
  `<!doctype html><html><head><meta charset="utf-8"><title>gymvnchoice proxy</title></head><body>Proxying to ${upstreamUrl}</body></html>`,
  "utf8",
);

console.log("[1/1] Da tao Pages proxy dist tai:", distDir);
