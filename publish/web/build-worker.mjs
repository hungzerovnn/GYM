import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../");

const run = (command) => {
  execSync(command, {
    stdio: "inherit",
    cwd: rootDir,
    shell: true,
  });
};

run("npm --prefix apps/web exec opennextjs-cloudflare -- build");