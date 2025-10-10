#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

const knownNodeEnvs = new Set(["development", "production", "test"]);
const currentNodeEnv = process.env.NODE_ENV;
if (currentNodeEnv && !knownNodeEnvs.has(currentNodeEnv)) {
  console.warn(
    `[predev] Warning: non-standard NODE_ENV value "${currentNodeEnv}" detected. ` +
      "Use development, production, or test to avoid inconsistent installs."
  );
}

const requiredPackages = [
  { name: "typescript", resolveId: "typescript/package.json" },
  { name: "@types/node", resolveId: "@types/node/package.json" },
  { name: "@types/react", resolveId: "@types/react/package.json" },
  { name: "@types/react-dom", resolveId: "@types/react-dom/package.json" }
];

const versions = {
  ...(packageJson.dependencies || {}),
  ...(packageJson.devDependencies || {})
};

const missing = requiredPackages.filter((pkg) => {
  try {
    require.resolve(pkg.resolveId, { paths: [projectRoot] });
    return false;
  } catch (error) {
    return true;
  }
});

if (missing.length === 0) {
  process.exit(0);
}

const installTargets = missing.map((pkg) => {
  const version = versions[pkg.name];
  return version ? `${pkg.name}@${version}` : pkg.name;
});

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

try {
  console.log(`[predev] Installing missing TypeScript tooling with ${npmCommand}: ${installTargets.join(", ")}`);
  execSync(`${npmCommand} install --no-save ${installTargets.join(" ")}`, {
    stdio: "inherit",
    env: { ...process.env, npm_config_production: "false", NODE_ENV: "development" }
  });
  console.log("[predev] TypeScript tooling installation complete.\n");
} catch (error) {
  console.error("[predev] Failed to automatically install TypeScript tooling.");
  console.error("[predev] Please run 'npm install --include=dev' and try again.");
  process.exitCode = 1;
}
