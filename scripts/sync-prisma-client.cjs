const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const copies = [
  {
    source: path.join(rootDir, "node_modules", "@prisma", "client"),
    target: path.join(rootDir, "apps", "api", "node_modules", "@prisma", "client"),
  },
  {
    source: path.join(rootDir, "node_modules", ".prisma", "client"),
    target: path.join(rootDir, "apps", "api", "node_modules", ".prisma", "client"),
  },
];

const isIgnorableLock = (error, filePath) =>
  error &&
  ["EPERM", "EBUSY"].includes(error.code) &&
  /query_engine|schema-engine|libquery_engine/i.test(filePath);

const copyRecursive = (source, target) => {
  const stats = fs.statSync(source);

  if (stats.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(target, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });

  try {
    fs.copyFileSync(source, target);
  } catch (error) {
    if (isIgnorableLock(error, target)) {
      console.warn(`Skipped locked Prisma engine file: ${target}`);
      return;
    }
    throw error;
  }
};

for (const copy of copies) {
  if (!fs.existsSync(copy.source)) {
    throw new Error(`Prisma source not found: ${copy.source}`);
  }

  copyRecursive(copy.source, copy.target);
}

console.log("Synced Prisma Client into apps/api/node_modules");
