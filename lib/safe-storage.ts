interface SafeStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

type StorageKind = "localStorage" | "sessionStorage"

function resolveStorage(kind: StorageKind): Storage | null {
  if (typeof globalThis === "undefined") {
    return null
  }

  const candidate = (globalThis as Record<string, unknown>)[kind]
  if (!candidate) {
    return null
  }

  try {
    const storage = candidate as Storage
    const testKey = "__vea_storage_test__"
    storage.getItem(testKey)
    return storage
  } catch (error) {
    return null
  }
}

function createSafeStorage(kind: StorageKind): SafeStorage {
  return {
    getItem: (key: string) => {
      const storage = resolveStorage(kind)
      if (!storage) {
        return null
      }

      try {
        return storage.getItem(key)
      } catch (error) {
        return null
      }
    },
    setItem: (key: string, value: string) => {
      const storage = resolveStorage(kind)
      if (!storage) {
        return
      }

      try {
        storage.setItem(key, value)
      } catch (error) {
        // Ignore storage quota errors
      }
    },
    removeItem: (key: string) => {
      const storage = resolveStorage(kind)
      if (!storage) {
        return
      }

      try {
        storage.removeItem(key)
      } catch (error) {
        // Ignore removal issues
      }
    },
  }
}

export const safeStorage = createSafeStorage("localStorage")
export const safeSessionStorage = createSafeStorage("sessionStorage")
