/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
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

const isServerRuntime = typeof window === "undefined"

type WriteStream = {
  write: (chunk: string) => void
  on: (event: "error", listener: (error: unknown) => void) => void
}

type NodeRequireFunction = (specifier: string) => unknown

let nodeRequireFn: NodeRequireFunction | undefined
let fsModule: typeof import("node:fs") | undefined
let pathModule: typeof import("node:path") | undefined
let logStream: WriteStream | undefined
let streamInitializationFailed = false

function loadNodeModule<T>(specifier: string): T | undefined {
  if (!isServerRuntime) {
    return undefined
  }

  try {
    nodeRequireFn = nodeRequireFn ?? (eval("require") as NodeRequireFunction)
    return nodeRequireFn(specifier) as T
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Logger failed to load module: ${specifier}`, { error })
    }
    return undefined
  }
}

function ensureLogStream(): WriteStream | undefined {
  if (!isServerRuntime) {
    return undefined
  }

  if (logStream || streamInitializationFailed) {
    return logStream
  }

  try {
    fsModule = fsModule ?? loadNodeModule<typeof import("node:fs")>("node:fs")
    pathModule = pathModule ?? loadNodeModule<typeof import("node:path")>("node:path")

    const fs = fsModule
    const path = pathModule

    if (!fs || !path) {
      streamInitializationFailed = true
      return undefined
    }

    const logDirectory = process.env.LOG_DIRECTORY
      ? path.resolve(process.env.LOG_DIRECTORY)
      : path.join(process.cwd(), "logs")
    const logFileName = process.env.LOG_FILE_NAME || "application.log"
    const logFilePath = path.join(logDirectory, logFileName)

    fs.mkdirSync(logDirectory, { recursive: true })

    logStream = fs.createWriteStream(logFilePath, { flags: "a" })
    logStream.on("error", (error) => {
      streamInitializationFailed = true
      console.error("Logger failed to write to log file", { error })
    })

    return logStream
  } catch (error) {
    streamInitializationFailed = true
    console.error("Logger failed to initialize file stream", { error })
    return undefined
  }
}

function appendToLogFile(level: LogLevel, message: string, serializedContext: unknown[]): void {
  const stream = ensureLogStream()
  if (!stream) {
    return
  }

  const timestamp = new Date().toISOString()
  let contextString = ""

  if (serializedContext.length > 0) {
    try {
      contextString = ` ${JSON.stringify(serializedContext[0])}`
    } catch (error) {
      contextString = ""
      console.warn("Logger failed to serialize context for file output", { error })
    }
  }

  stream.write(`${timestamp} [${level.toUpperCase()}] ${message}${contextString}\n`)
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

  appendToLogFile(level, message, serializedContext)
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
