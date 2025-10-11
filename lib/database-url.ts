const PROTOCOL_SEPARATOR = "://"

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function normalizeDatabaseUrl(databaseUrl: string): string {
  if (!databaseUrl) {
    return databaseUrl
  }

  try {
    // If the URL is already valid, we can use it as-is.
    new URL(databaseUrl)
    return databaseUrl
  } catch (error) {
    const protocolIndex = databaseUrl.indexOf(PROTOCOL_SEPARATOR)
    if (protocolIndex === -1) {
      throw error
    }

    const protocol = databaseUrl.slice(0, protocolIndex + PROTOCOL_SEPARATOR.length)
    const remainder = databaseUrl.slice(protocolIndex + PROTOCOL_SEPARATOR.length)
    const atIndex = remainder.indexOf("@")

    if (atIndex === -1) {
      throw error
    }

    const credentials = remainder.slice(0, atIndex)
    const hostAndPath = remainder.slice(atIndex + 1)

    if (!credentials) {
      throw error
    }

    const colonIndex = credentials.indexOf(":")
    const rawUsername = colonIndex === -1 ? credentials : credentials.slice(0, colonIndex)
    const rawPassword = colonIndex === -1 ? undefined : credentials.slice(colonIndex + 1)

    const encodedUsername = encodeURIComponent(safeDecodeURIComponent(rawUsername))
    const encodedPassword =
      rawPassword !== undefined ? encodeURIComponent(safeDecodeURIComponent(rawPassword)) : undefined

    const normalizedUrl = `${protocol}${encodedUsername}${
      encodedPassword !== undefined ? `:${encodedPassword}` : ""
    }@${hostAndPath}`

    // Ensure the sanitized URL is now valid before returning it.
    new URL(normalizedUrl)

    return normalizedUrl
  }
}

