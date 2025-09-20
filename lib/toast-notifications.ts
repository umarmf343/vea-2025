interface ToastOptions {
  type: "success" | "error" | "warning" | "info"
  duration?: number
}

class ToastManager {
  private toasts: Array<{ id: string; message: string; type: string; timestamp: number }> = []
  private listeners: Array<(toasts: any[]) => void> = []

  show(message: string, options: ToastOptions = { type: "info", duration: 5000 }) {
    const toast = {
      id: Math.random().toString(36).substr(2, 9),
      message,
      type: options.type,
      timestamp: Date.now(),
    }

    this.toasts.push(toast)
    this.notifyListeners()

    // Auto remove after duration
    setTimeout(() => {
      this.remove(toast.id)
    }, options.duration)
  }

  remove(id: string) {
    this.toasts = this.toasts.filter((toast) => toast.id !== id)
    this.notifyListeners()
  }

  subscribe(listener: (toasts: any[]) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener([...this.toasts]))
  }

  // Convenience methods to replace alert() calls
  success(message: string) {
    this.show(message, { type: "success" })
  }

  error(message: string) {
    this.show(message, { type: "error" })
  }

  warning(message: string) {
    this.show(message, { type: "warning" })
  }

  info(message: string) {
    this.show(message, { type: "info" })
  }
}

export const toast = new ToastManager()

// Helper functions to replace alert() calls throughout the codebase
export const showSuccess = (message: string) => toast.success(message)
export const showError = (message: string) => toast.error(message)
export const showWarning = (message: string) => toast.warning(message)
export const showInfo = (message: string) => toast.info(message)
