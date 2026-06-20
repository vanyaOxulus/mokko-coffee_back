import fs from "node:fs";
import path from "node:path";

export function getDatabasePath(fileName) {
  const dbDir = process.env.DB_DIR || ".";

  fs.mkdirSync(dbDir, { recursive: true });

  return path.join(dbDir, fileName);
}
