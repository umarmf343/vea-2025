import { appendFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"

const AUDIT_DIRECTORY = join(process.cwd(), ".developer-audit")
const AUDIT_FILE = join(AUDIT_DIRECTORY, "paystack-split.log")

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
  if (!existsSync(AUDIT_DIRECTORY)) {
    mkdirSync(AUDIT_DIRECTORY, { recursive: true })
  }
}

export function recordDeveloperSplit(entry: DeveloperSplitLogEntry): void {
  try {
    ensureAuditDirectory()
    appendFileSync(AUDIT_FILE, `${JSON.stringify(entry)}\n`, { encoding: "utf8" })
  } catch (error) {
    console.error("Failed to persist developer split audit entry", error)
  }
}
