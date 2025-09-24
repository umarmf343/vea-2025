import { EventEmitter } from "events"

export type MessagePriority = "low" | "normal" | "high" | "urgent"
export type MessageKind = "text" | "media"

export interface ChatAttachment {
  id: string
  name: string
  type: string
  size: number
  dataUrl?: string
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  senderRole: string
  recipientIds: string[]
  recipientNames: string[]
  recipientRoles: string[]
  content: string
  createdAt: string
  messageType: MessageKind
  attachments: ChatAttachment[]
  priority: MessagePriority
  subject?: string
  readBy: string[]
  isDeleted?: boolean
  deletedAt?: string | null
}

export interface TypingPayload {
  conversationId: string
  senderId: string
  senderName: string
  recipients: string[]
  timestamp: string
}

export interface RealtimeNotification {
  id: string
  title: string
  body: string
  category: string
  createdAt: string
  targetUserIds: string[]
  targetRoles: string[]
  actionUrl?: string
  meta?: Record<string, unknown>
}

interface HubState {
  emitter: EventEmitter
  messages: ChatMessage[]
  notifications: RealtimeNotification[]
}

type HubEvent = "message" | "notification" | "typing" | "read"

declare global {
  // eslint-disable-next-line no-var
  var __veaRealtimeHubState: HubState | undefined
}

function initialiseState(): HubState {
  if (!globalThis.__veaRealtimeHubState) {
    const emitter = new EventEmitter()
    emitter.setMaxListeners(100)

    globalThis.__veaRealtimeHubState = {
      emitter,
      messages: [],
      notifications: [],
    }
  }

  return globalThis.__veaRealtimeHubState!
}

const hubState = initialiseState()

export function addMessage(message: ChatMessage) {
  hubState.messages = [...hubState.messages, message].slice(-5000)
  hubState.emitter.emit("message", message)
}

export function deleteMessage(messageId: string, requesterId: string) {
  const index = hubState.messages.findIndex((message) => message.id === messageId)
  if (index === -1) {
    return null
  }

  const existing = hubState.messages[index]
  if (existing.senderId !== requesterId) {
    throw new Error("Not authorized to delete this message")
  }

  if (existing.isDeleted) {
    return existing
  }

  const deletedAt = new Date().toISOString()
  const updated: ChatMessage = {
    ...existing,
    content: "Message deleted",
    attachments: [],
    messageType: "text",
    isDeleted: true,
    deletedAt,
  }

  hubState.messages = [
    ...hubState.messages.slice(0, index),
    updated,
    ...hubState.messages.slice(index + 1),
  ]

  hubState.emitter.emit("message", updated)
  return updated
}

export function getMessagesForUser(userId: string, conversationId?: string) {
  return hubState.messages.filter((message) => {
    if (conversationId && message.conversationId !== conversationId) {
      return false
    }

    return message.senderId === userId || message.recipientIds.includes(userId)
  })
}

export function markConversationRead(conversationId: string, userId: string) {
  let updated = false

  hubState.messages = hubState.messages.map((message) => {
    if (message.conversationId !== conversationId) {
      return message
    }

    if (message.readBy.includes(userId)) {
      return message
    }

    if (message.senderId !== userId && !message.recipientIds.includes(userId)) {
      return message
    }

    updated = true
    return { ...message, readBy: [...message.readBy, userId] }
  })

  if (updated) {
    hubState.emitter.emit("read", { conversationId, userId })
  }
}

export function publishNotification(notification: RealtimeNotification) {
  hubState.notifications = [notification, ...hubState.notifications].slice(0, 200)
  hubState.emitter.emit("notification", notification)
}

export function getNotificationsForUser(userId: string, role?: string | null) {
  return hubState.notifications.filter((notification) => {
    if (notification.targetUserIds.includes(userId)) {
      return true
    }

    if (role && notification.targetRoles.includes(role)) {
      return true
    }

    return notification.targetRoles.includes("all")
  })
}

export function emitTyping(payload: TypingPayload) {
  hubState.emitter.emit("typing", payload)
}

export function subscribe<T>(event: HubEvent, callback: (payload: T) => void) {
  hubState.emitter.on(event, callback as (...args: unknown[]) => void)

  return () => {
    hubState.emitter.off(event, callback as (...args: unknown[]) => void)
  }
}

export function getHubStateForDebug() {
  return hubState
}
