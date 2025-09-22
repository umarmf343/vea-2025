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
  const memoryStore = new Map<string, string>()

  return {
    getItem: (key: string) => {
      const storage = resolveStorage(kind)
      if (!storage) {
        return memoryStore.get(key) ?? null
      }

      try {
        const value = storage.getItem(key)
        return value ?? memoryStore.get(key) ?? null
      } catch (error) {
        return memoryStore.get(key) ?? null
      }
    },
    setItem: (key: string, value: string) => {
      const storage = resolveStorage(kind)
      if (!storage) {
        memoryStore.set(key, value)
        return
      }

      try {
        storage.setItem(key, value)
      } catch (error) {
        memoryStore.set(key, value)
      }
    },
    removeItem: (key: string) => {
      const storage = resolveStorage(kind)
      if (!storage) {
        memoryStore.delete(key)
        return
      }

      try {
        storage.removeItem(key)
      } catch (error) {
        memoryStore.delete(key)
      }
    },
  }
}

export const safeStorage = createSafeStorage("localStorage")
export const safeSessionStorage = createSafeStorage("sessionStorage")
