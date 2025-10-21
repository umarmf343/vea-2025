#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

function resolveProjectRoot() {
  const initCwd = process.env.INIT_CWD;
  if (initCwd && fs.existsSync(initCwd)) {
    return initCwd;
  }

  const packageJsonEnv = process.env.npm_package_json;
  if (packageJsonEnv) {
    return path.dirname(packageJsonEnv);
  }

  return process.cwd();
}

function requireIfAvailable(scriptPath, description) {
  if (fs.existsSync(scriptPath)) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    require(scriptPath);
    return;
  }

  if (description) {
    console.warn(`Skipping ${description}: script not found at ${scriptPath}`);
  }
}

function run() {
  const projectRoot = resolveProjectRoot();
  const scriptsDir = path.resolve(projectRoot, "scripts");

  requireIfAvailable(
    path.join(scriptsDir, "cleanup-legacy-installs.cjs"),
    "legacy install cleanup",
  );

  requireIfAvailable(
    path.join(scriptsDir, "check-banned-dependencies.cjs"),
    "deprecated dependency check",
  );
}

run();
