/* eslint-disable @typescript-eslint/no-var-requires */
import { join } from "node:path"

type FsModule = typeof import("node:fs")

const AUDIT_DIRECTORY = join(process.cwd(), ".developer-audit")
const AUDIT_FILE = join(AUDIT_DIRECTORY, "paystack-split.log")

let fsModule: FsModule | null = null

const isServerRuntime = typeof window === "undefined"

function getFsModule(): FsModule | null {
  if (!isServerRuntime) {
    return null
  }

  if (fsModule) {
    return fsModule
  }

  try {
    fsModule = require("node:fs") as FsModule
  } catch (error) {
    fsModule = null
    if (process.env.NODE_ENV !== "production") {
      console.warn("Failed to load Node fs module for developer audit", error)
    }
  }

  return fsModule
}

export interface DeveloperSplitLogEntry {
  reference: string
  grossAmountKobo: number
  developerShareKobo: number
  schoolNetAmountKobo: number
  splitCode: string
  subaccountCode: string
  recordedAt: string
}

function ensureAuditDirectory(): void {
  const fs = getFsModule()
  if (!fs) {
    return
  }

  if (!fs.existsSync(AUDIT_DIRECTORY)) {
    fs.mkdirSync(AUDIT_DIRECTORY, { recursive: true })
  }
}

export function recordDeveloperSplit(entry: DeveloperSplitLogEntry): void {
  try {
    ensureAuditDirectory()
    const fs = getFsModule()
    if (!fs) {
      return
    }
    fs.appendFileSync(AUDIT_FILE, `${JSON.stringify(entry)}\n`, { encoding: "utf8" })
  } catch (error) {
    console.error("Failed to persist developer split audit entry", error)
  }
}
