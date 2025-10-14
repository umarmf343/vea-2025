import type { PoolOptions } from "mysql2/promise"

type MysqlSslOption = PoolOptions["ssl"]

const TRUTHY_SSL_VALUES = new Set(["1", "true", "yes", "require", "enabled"])
const FALSY_SSL_VALUES = new Set(["0", "false", "no", "disabled", "disable"])
const REQUIRED_SSL_MODES = new Set(["require", "verify_ca", "verify_full"])

function normaliseValue(value: string): string {
  return value.trim().toLowerCase()
}

function parseBooleanFlag(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined
  }

  const normalised = normaliseValue(value)

  if (TRUTHY_SSL_VALUES.has(normalised)) {
    return true
  }

  if (FALSY_SSL_VALUES.has(normalised)) {
    return false
  }

  return undefined
}

function parseUrlPreference(databaseUrl: string): boolean | undefined {
  try {
    const url = new URL(databaseUrl)
    const ssl = url.searchParams.get("ssl")
    const sslMode = url.searchParams.get("sslmode")

    const sslFlag = parseBooleanFlag(ssl ?? undefined)
    if (sslFlag !== undefined) {
      return sslFlag
    }

    if (sslMode) {
      return REQUIRED_SSL_MODES.has(normaliseValue(sslMode))
    }
  } catch {
    // If the URL cannot be parsed we silently ignore it and fall back to defaults.
  }

  return undefined
}

export function resolveDatabaseSslOption(databaseUrl: string): MysqlSslOption | undefined {
  const envOverride =
    parseBooleanFlag(process.env.DATABASE_USE_SSL) ?? parseBooleanFlag(process.env.DATABASE_SSL)

  const shouldUseSsl = envOverride ?? parseUrlPreference(databaseUrl) ?? false

  if (!shouldUseSsl) {
    return undefined
  }

  return { rejectUnauthorized: false }
}

