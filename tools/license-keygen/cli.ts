import { mkdir, writeFile } from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
import path from "node:path";
import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import {
  buildUnlockPayloadFromRequest,
  createUnlockCode,
  getLicensePlanLabel,
  listLicensePlans,
  parseLicenseRequestCode,
  type LicensePlanCode,
} from "../../apps/api/src/modules/license/license.shared";
import { LICENSE_PRIVATE_KEY, LICENSE_TOOL_PASSWORD } from "./private-key";

function resolveProjectRoot() {
  const cwd = process.cwd();
  const parent = path.basename(path.dirname(cwd)).toLowerCase();
  const current = path.basename(cwd).toLowerCase();

  if (parent === "apps" && current === "api") {
    return path.resolve(cwd, "..", "..");
  }

  return cwd;
}

const KEYGEN_OUTPUT_DIR = path.resolve(resolveProjectRoot(), "data", "license");
const KEYGEN_OUTPUT_FILE = path.join(KEYGEN_OUTPUT_DIR, "keygen-last-result.txt");

function readArg(flag: string) {
  const index = process.argv.findIndex((item) => item === flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizePlanCode(value?: string): LicensePlanCode | null {
  if (!value) {
    return null;
  }

  const matched = listLicensePlans().find((item) => item.code === value.toUpperCase());
  return matched?.code ?? null;
}

async function writeKeygenOutputFile(lines: string[]) {
  await mkdir(KEYGEN_OUTPUT_DIR, { recursive: true });
  await writeFile(KEYGEN_OUTPUT_FILE, `${lines.join("\n")}\n`, "utf8");
  return KEYGEN_OUTPUT_FILE;
}

async function promptSecret(question: string) {
  if (!input.isTTY || !output.isTTY) {
    const rl = createInterface({ input, output });

    try {
      return await rl.question(question);
    } finally {
      rl.close();
    }
  }

  return await new Promise<string>((resolve) => {
    let value = "";
    const wasRawMode = input.isRaw ?? false;

    const cleanup = () => {
      input.off("keypress", handleKeypress);
      input.setRawMode?.(wasRawMode);
    };

    const handleKeypress = (character: string, key: { ctrl?: boolean; meta?: boolean; name?: string }) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        output.write("^C\n");
        process.exit(130);
      }

      if (key.name === "return" || key.name === "enter") {
        cleanup();
        output.write("\n");
        resolve(value);
        return;
      }

      if (key.name === "backspace") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          output.write("\b \b");
        }
        return;
      }

      if (!character || key.ctrl || key.meta) {
        return;
      }

      value += character;
      output.write("*");
    };

    emitKeypressEvents(input);
    output.write(question);
    input.setRawMode?.(true);
    input.resume();
    input.on("keypress", handleKeypress);
  });
}

async function main() {
  const password = readArg("--password") ?? (await promptSecret("Nhap mat khau key generator: "));
  const rl = createInterface({ input, output });

  try {
    if (password !== LICENSE_TOOL_PASSWORD) {
      throw new Error("Sai mat khau key generator.");
    }

    const requestCode = readArg("--request") ?? (await rl.question("Dan request code tu GYM: "));
    const parsedRequest = parseLicenseRequestCode(requestCode);
    const defaultRequestedPlan = parsedRequest.requestedPlanCode ?? null;
    const requestedPlan =
      normalizePlanCode(readArg("--plan")) ??
      defaultRequestedPlan ??
      normalizePlanCode(
        await rl.question(
          `Chon goi (${listLicensePlans()
            .map((item) => item.code)
            .join(", ")}): `,
        ),
      );

    if (!requestedPlan) {
      throw new Error("Plan khong hop le.");
    }

    const payload = buildUnlockPayloadFromRequest(parsedRequest, requestedPlan);
    const unlockCode = createUnlockCode(payload, LICENSE_PRIVATE_KEY);
    const outputLines = [
      "",
      "Thong tin key moi",
      `License ID : ${payload.licenseId}`,
      `Plan       : ${requestedPlan} - ${getLicensePlanLabel(requestedPlan)}`,
      `Requested  : ${parsedRequest.requestedPlanCode ?? "Khong truyen tu GYM"}`,
      `Hostname   : ${payload.hostname}`,
      `MAC        : ${payload.primaryMac ?? "Khong doc duoc"}`,
      `Issued at  : ${payload.issuedAt}`,
      `Expires at : ${payload.expiresAt ?? "Vinh vien"}`,
      "",
      "Unlock code",
      unlockCode,
    ];

    console.log(outputLines.join("\n"));

    const outputFile = await writeKeygenOutputFile(outputLines);
    console.log("");
    console.log(`Da luu ket qua vao: ${outputFile}`);
    console.log("Neu can, mo file nay de copy lai unlock code.");
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
