import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .reduce((acc, line) => {
      const separatorIndex = line.indexOf("=");
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
};

export const publishWebDir = __dirname;
export const repoRoot = path.resolve(__dirname, "../../");
export const appWebDir = path.resolve(repoRoot, "apps/web");
export const distDir = path.resolve(__dirname, "dist");

export const loadPublishWebEnv = () => {
  const envFile = parseEnvFile(path.resolve(__dirname, ".env"));
  const envLocalFile = parseEnvFile(path.resolve(__dirname, ".env.local"));
  return {
    ...envFile,
    ...envLocalFile,
  };
};

export const createExecEnv = (extra = {}) => ({
  ...process.env,
  ...loadPublishWebEnv(),
  ...extra,
});

export const getRequiredEnv = (env, key) => {
  const value = env[key];
  if (!value || value.includes("<")) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
};
