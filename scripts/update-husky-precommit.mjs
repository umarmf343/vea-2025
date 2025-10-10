import { chmodSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

const huskyDir = resolve(process.cwd(), ".husky");
const hookPath = resolve(huskyDir, "pre-commit");
const huskyShDir = resolve(huskyDir, "_");

if (!existsSync(huskyDir)) {
  mkdirSync(huskyDir, { recursive: true });
}

if (!existsSync(huskyShDir)) {
  mkdirSync(huskyShDir, { recursive: true });
}

const script = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm run pre-commit
`;

writeFileSync(hookPath, script, { encoding: "utf8" });
chmodSync(hookPath, 0o755);
