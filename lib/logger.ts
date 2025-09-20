/* eslint-disable no-console */
export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogContext {
  [key: string]: unknown
}

function serializeContext(context?: LogContext): unknown[] {
  if (!context || Object.keys(context).length === 0) {
    return []
  }

  try {
    return [JSON.parse(JSON.stringify(context))]
  } catch (error) {
    return [context]
  }
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  const serializedContext = serializeContext(context)

  switch (level) {
    case "debug":
      console.debug(message, ...serializedContext)
      break
    case "info":
      console.info(message, ...serializedContext)
      break
    case "warn":
      console.warn(message, ...serializedContext)
      break
    case "error":
    default:
      console.error(message, ...serializedContext)
      break
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
}

export function withContext(base: LogContext, additional?: LogContext): LogContext {
  if (!additional) {
    return base
  }
  return { ...base, ...additional }
}
