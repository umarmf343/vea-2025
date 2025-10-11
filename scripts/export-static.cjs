#!/usr/bin/env node
const { spawn } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")
const process = require("node:process")

const isWindows = process.platform === "win32"
const projectRoot = process.cwd()
const apiDir = path.join(projectRoot, "app", "api")
const tempDir = path.join(projectRoot, ".next-export-temp")
const backupApiDir = path.join(tempDir, "app-api")

function ensureParentDir(targetPath) {
  const parent = path.dirname(targetPath)
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true })
  }
}

function moveDirectory(source, destination) {
  if (!fs.existsSync(source)) {
    return false
  }

  ensureParentDir(destination)
  fs.renameSync(source, destination)
  return true
}

function restoreDirectory(source, destination) {
  if (!fs.existsSync(source)) {
    return
  }

  ensureParentDir(destination)
  fs.renameSync(source, destination)
}

function removeTempDir() {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
      shell: isWindows,
    })

    child.on("exit", (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command ${command} ${args.join(" ")} exited with code ${code}`))
      }
    })

    child.on("error", (error) => {
      reject(error)
    })
  })
}

async function main() {
  removeTempDir()
  fs.mkdirSync(tempDir, { recursive: true })

  const shouldRestoreApi = moveDirectory(apiDir, backupApiDir)
  const buildEnv = { ...process.env, NEXT_BUILD_TARGET: "export" }

  try {
    await run("next", ["build"], buildEnv)
  } finally {
    if (shouldRestoreApi) {
      restoreDirectory(backupApiDir, apiDir)
    }
    removeTempDir()
  }

  const outDir = path.join(projectRoot, "out")
  if (!fs.existsSync(outDir)) {
    throw new Error("Static export failed: out/ directory was not generated. Please review the build output for details.")
  }

  console.log("Static export complete. Upload the out/ folder to your static hosting environment.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
