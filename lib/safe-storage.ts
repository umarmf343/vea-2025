interface SafeStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

const createSafeStorage = (): SafeStorage => {
  if (typeof window === "undefined") {
    // Server-side: return no-op functions
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    }
  }

  // Client-side: return actual localStorage
  return {
    getItem: (key: string) => localStorage.getItem(key),
    setItem: (key: string, value: string) => localStorage.setItem(key, value),
    removeItem: (key: string) => localStorage.removeItem(key),
  }
}

export const safeStorage = createSafeStorage()

// Helper for session storage
const createSafeSessionStorage = (): SafeStorage => {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    }
  }

  return {
    getItem: (key: string) => sessionStorage.getItem(key),
    setItem: (key: string, value: string) => sessionStorage.setItem(key, value),
    removeItem: (key: string) => sessionStorage.removeItem(key),
  }
}

export const safeSessionStorage = createSafeSessionStorage()
