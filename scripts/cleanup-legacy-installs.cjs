#!/usr/bin/env node
const fs = require("fs")
const path = require("path")

function removeIfExists(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return false
  }

  try {
    fs.rmSync(targetPath, { recursive: true, force: true })
    return true
  } catch (error) {
    console.warn(`Unable to remove legacy directory at ${targetPath}:`, error)
    return false
  }
}

function run() {
  const projectRoot = path.resolve(__dirname, "..")
  const nodeModulesPath = path.join(projectRoot, "node_modules")

  if (!fs.existsSync(nodeModulesPath)) {
    return
  }

  const deprecatedFfmpegPackages = [
    path.join(nodeModulesPath, "fluent-ffmpeg"),
    path.join(nodeModulesPath, "@ffmpeg-installer"),
    path.join(nodeModulesPath, "@ffprobe-installer"),
  ]

  const legacyDirectories = [
    path.join(nodeModulesPath, ".pnpm"),
    path.join(nodeModulesPath, "pnpm-global"),
    ...deprecatedFfmpegPackages,
  ]

  const removed = legacyDirectories.filter((dir) => removeIfExists(dir))

  if (removed.length > 0) {
    const relativePaths = removed.map((dir) => path.relative(projectRoot, dir))
    console.log(
      "Removed legacy pnpm install artifacts to ensure a clean npm dependency tree:",
      relativePaths,
    )
    return
  }

  const missingDeprecatedPackages = deprecatedFfmpegPackages
    .filter((dir) => !fs.existsSync(dir))
    .map((dir) => path.relative(projectRoot, dir))

  if (missingDeprecatedPackages.length === deprecatedFfmpegPackages.length) {
    console.log(
      "Verified that deprecated ffmpeg helper packages are not present in node_modules:",
      missingDeprecatedPackages,
    )
  }
}

run()
