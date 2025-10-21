#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const packageLockPath = path.join(projectRoot, "package-lock.json");

const bannedPackages = [
  {
    name: "fluent-ffmpeg",
    reason:
      "fluent-ffmpeg is deprecated upstream and no longer receives security updates.",
    recommendation:
      "Replace usage with maintained alternatives such as @ffmpeg-installer/ffmpeg, @ffmpeg.wasm/main, or direct ffmpeg CLI integrations.",
  },
];

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Unable to read ${filePath}:`, error);
    return null;
  }
}

function findInPackageJson(pkgJson, packageName) {
  if (!pkgJson) {
    return [];
  }

  const sections = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ];

  return sections
    .filter((section) => pkgJson[section]?.[packageName])
    .map((section) => `package.json -> ${section}`);
}

function findInPackageLock(lockJson, packageName) {
  if (!lockJson) {
    return [];
  }

  const locations = [];

  if (lockJson.dependencies?.[packageName]) {
    locations.push("package-lock.json -> dependencies");
  }

  const packages = lockJson.packages || {};
  for (const key of Object.keys(packages)) {
    if (key === "") {
      continue;
    }

    if (key === `node_modules/${packageName}` || key.endsWith(`/node_modules/${packageName}`)) {
      locations.push(`package-lock.json -> packages[${key}]`);
    }
  }

  return locations;
}

function run() {
  const packageJson = readJson(packageJsonPath);
  const packageLock = readJson(packageLockPath);

  const violations = [];

  for (const banned of bannedPackages) {
    const locations = [
      ...findInPackageJson(packageJson, banned.name),
      ...findInPackageLock(packageLock, banned.name),
    ];

    if (locations.length > 0) {
      violations.push({
        name: banned.name,
        reason: banned.reason,
        recommendation: banned.recommendation,
        locations,
      });
    }
  }

  if (violations.length === 0) {
    return;
  }

  console.error("\nDeprecated dependencies detected during installation:");
  for (const violation of violations) {
    console.error(` - ${violation.name}`);
    console.error(`   Reason: ${violation.reason}`);
    console.error(`   Locations: ${violation.locations.join(", ")}`);
    if (violation.recommendation) {
      console.error(`   Recommendation: ${violation.recommendation}`);
    }
  }

  console.error(
    "\nInstallation has been aborted. Please remove the deprecated packages before continuing.",
  );
  process.exit(1);
}

run();
