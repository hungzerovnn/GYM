import { execSync } from "node:child_process";
import fs from "node:fs";
import { createExecEnv, distDir, loadPublishWebEnv } from "./env.mjs";

const env = loadPublishWebEnv();
const projectName = env.CLOUDFLARE_PAGES_PROJECT_NAME || "gymvnchoice";

if (!fs.existsSync(distDir)) {
  console.error("[LOI] Khong tim thay publish/web/dist. Hay chay npm run build truoc.");
  process.exit(1);
}

console.log("[1/1] Deploy Pages proxy tu publish/web/dist");
const deployCommand = `npx -y wrangler@latest pages deploy "${distDir}" --project-name ${projectName}`;

execSync(deployCommand, {
  stdio: "inherit",
  env: createExecEnv(),
});
