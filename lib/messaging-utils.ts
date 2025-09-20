import { safeStorage } from "@/lib/safe-storage"

export interface MessageNotification {
  id: string
  title: string
  body: string
  timestamp: Date
  read: boolean
  actionUrl?: string
}

export class MessagingService {
  private static instance: MessagingService
  private listeners: Map<string, Function[]> = new Map()
  private connectionStatus: "connected" | "connecting" | "disconnected" = "connected"

  static getInstance(): MessagingService {
    if (!MessagingService.instance) {
      MessagingService.instance = new MessagingService()
    }
    return MessagingService.instance
  }

  // Simulate real-time connection
  connect(userId: string) {
    this.connectionStatus = "connecting"

    // Simulate connection delay
    setTimeout(() => {
      this.connectionStatus = "connected"
      this.emit("connection", { status: "connected", userId })
    }, 1000)

    // Simulate periodic connection checks
    setInterval(() => {
      if (Math.random() > 0.95) {
        // 5% chance of temporary disconnection
        this.connectionStatus = "disconnected"
        this.emit("connection", { status: "disconnected", userId })

        // Reconnect after 2-5 seconds
        setTimeout(
          () => {
            this.connectionStatus = "connected"
            this.emit("connection", { status: "connected", userId })
          },
          2000 + Math.random() * 3000,
        )
      }
    }, 10000)
  }

  // Event listener system
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  emit(event: string, data: any) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach((callback) => callback(data))
    }
  }

  // Message delivery simulation
  sendMessage(message: any): Promise<{ delivered: boolean; timestamp: Date }> {
    return new Promise((resolve) => {
      // Simulate network delay
      setTimeout(
        () => {
          const delivered = Math.random() > 0.05 // 95% delivery success rate
          resolve({
            delivered,
            timestamp: new Date(),
          })

          if (delivered) {
            this.emit("messageDelivered", { messageId: message.id })
          } else {
            this.emit("messageFailed", { messageId: message.id })
          }
        },
        500 + Math.random() * 1500,
      )
    })
  }

  // File upload simulation
  uploadFile(file: File): Promise<{ url: string; thumbnail?: string }> {
    return new Promise((resolve, reject) => {
      if (file.size > 10 * 1024 * 1024) {
        // 10MB limit
        reject(new Error("File too large"))
        return
      }

      // Simulate upload progress
      let progress = 0
      const interval = setInterval(() => {
        progress += Math.random() * 20
        this.emit("uploadProgress", { progress: Math.min(progress, 100) })

        if (progress >= 100) {
          clearInterval(interval)
          resolve({
            url: URL.createObjectURL(file),
            thumbnail: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
          })
        }
      }, 200)
    })
  }

  // Push notification simulation
  showNotification(notification: MessageNotification) {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(notification.title, {
        body: notification.body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        timestamp: notification.timestamp.getTime(),
      })
    }

    // Store notification for in-app display
    const notifications = JSON.parse(safeStorage.getItem("vea_notifications") || "[]")
    notifications.unshift(notification)
    safeStorage.setItem("vea_notifications", JSON.stringify(notifications.slice(0, 50))) // Keep last 50

    this.emit("notification", notification)
  }

  // Request notification permission
  async requestNotificationPermission(): Promise<boolean> {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission()
      return permission === "granted"
    }
    return false
  }

  getConnectionStatus() {
    return this.connectionStatus
  }
}

// Utility functions
export const formatMessageTime = (timestamp: Date): string => {
  const now = new Date()
  const diff = now.getTime() - timestamp.getTime()

  if (diff < 60000) {
    // Less than 1 minute
    return "Just now"
  } else if (diff < 3600000) {
    // Less than 1 hour
    return `${Math.floor(diff / 60000)}m ago`
  } else if (diff < 86400000) {
    // Less than 1 day
    return `${Math.floor(diff / 3600000)}h ago`
  } else if (diff < 604800000) {
    // Less than 1 week
    return `${Math.floor(diff / 86400000)}d ago`
  } else {
    return timestamp.toLocaleDateString()
  }
}

export const extractMentions = (text: string): string[] => {
  const mentions = text.match(/@(\w+)/g) || []
  return mentions.map((m) => m.substring(1))
}

export const extractHashtags = (text: string): string[] => {
  const hashtags = text.match(/#(\w+)/g) || []
  return hashtags.map((h) => h.substring(1))
}

export const generateMessageId = (): string => {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export const compressImage = (file: File, maxWidth = 800, quality = 0.8): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")!
    const img = new Image()

    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height)
      canvas.width = img.width * ratio
      canvas.height = img.height * ratio

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          } else {
            resolve(file)
          }
        },
        file.type,
        quality,
      )
    }

    img.src = URL.createObjectURL(file)
  })
}
