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

  const legacyDirectories = [
    path.join(nodeModulesPath, ".pnpm"),
    path.join(nodeModulesPath, "pnpm-global"),
  ]

  const removed = legacyDirectories.filter((dir) => removeIfExists(dir))

  if (removed.length > 0) {
    console.log(
      "Removed legacy pnpm install artifacts to ensure a clean npm dependency tree:",
      removed.map((dir) => path.relative(projectRoot, dir)),
    )
  }
}

run()
