"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Loader2, Mic, Paperclip, Send, UserCircle, Wifi, WifiOff } from "lucide-react"

interface Participant {
  id: string
  name: string
  role: string
  email?: string
  avatar?: string
}

interface AttachmentPreview {
  id: string
  name: string
  type: string
  size: number
  dataUrl: string
  file: File
}

interface InternalMessagingProps {
  currentUser: {
    id: string
    name: string
    role: string
    avatar?: string
  }
}

type ServerMessage = import("@/lib/realtime-hub").ChatMessage

type ClientMessage = Omit<ServerMessage, "createdAt"> & { createdAt: Date }

type Conversation = {
  id: string
  participants: Participant[]
  lastMessage: ClientMessage | null
  unreadCount: number
}

type TypingIndicator = {
  conversationId: string
  senderId: string
  senderName: string
  expiresAt: number
}

const DIRECTORY: Participant[] = [
  { id: "1", name: "John Smith", role: "teacher", email: "john.smith@vea.edu.ng" },
  { id: "2", name: "Sarah Johnson", role: "admin", email: "sarah.johnson@vea.edu.ng" },
  { id: "3", name: "Mike Brown", role: "parent", email: "mike.brown@parent.vea.edu.ng" },
  { id: "4", name: "Emily Davis", role: "teacher", email: "emily.davis@vea.edu.ng" },
  { id: "5", name: "David Wilson", role: "super_admin", email: "david.wilson@vea.edu.ng" },
  { id: "6", name: "Lisa Anderson", role: "parent", email: "lisa.anderson@parent.vea.edu.ng" },
  { id: "7", name: "Robert Taylor", role: "teacher", email: "robert.taylor@vea.edu.ng" },
  { id: "accountant", name: "Bola Hassan", role: "accountant" },
  { id: "librarian", name: "Kunle Ojo", role: "librarian" },
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function toClientMessage(message: ServerMessage): ClientMessage {
  return {
    ...message,
    createdAt: new Date(message.createdAt),
  }
}

function upsertMessage(messages: ClientMessage[], incoming: ClientMessage) {
  const next = [...messages]
  const index = next.findIndex((message) => message.id === incoming.id)
  if (index >= 0) {
    next[index] = incoming
  } else {
    next.push(incoming)
  }

  return next.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

function buildConversationId(participantIds: string[]) {
  return [...participantIds].sort((a, b) => a.localeCompare(b)).join("::")
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function roleBadgeClass(role: string) {
  switch (role) {
    case "super_admin":
      return "bg-purple-100 text-purple-800"
    case "admin":
      return "bg-blue-100 text-blue-800"
    case "teacher":
      return "bg-green-100 text-green-800"
    case "parent":
      return "bg-orange-100 text-orange-800"
    case "student":
      return "bg-gray-200 text-gray-800"
    case "accountant":
      return "bg-teal-100 text-teal-800"
    case "librarian":
      return "bg-amber-100 text-amber-800"
    default:
      return "bg-slate-200 text-slate-800"
  }
}

export function InternalMessaging({ currentUser }: InternalMessagingProps) {
  const [messages, setMessages] = useState<ClientMessage[]>([])
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [recipientId, setRecipientId] = useState<string>("")
  const [messageText, setMessageText] = useState("")
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [typingIndicators, setTypingIndicators] = useState<TypingIndicator[]>([])

  const eventSourceRef = useRef<EventSource | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const typingRef = useRef<NodeJS.Timeout | null>(null)
  const lastTypingAtRef = useRef<number>(0)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null)

  const directory = useMemo(
    () => DIRECTORY.filter((participant) => participant.id !== currentUser.id),
    [currentUser.id],
  )

  const conversations = useMemo<Conversation[]>(() => {
    const grouped = new Map<string, ClientMessage[]>()

    messages.forEach((message) => {
      if (!grouped.has(message.conversationId)) {
        grouped.set(message.conversationId, [])
      }
      grouped.get(message.conversationId)!.push(message)
    })

    return Array.from(grouped.entries()).map(([conversationId, conversationMessages]) => {
      const sorted = [...conversationMessages].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      )

      const participantMap = new Map<string, Participant>()
      sorted.forEach((message) => {
        participantMap.set(message.senderId, {
          id: message.senderId,
          name: message.senderName,
          role: message.senderRole,
        })
        message.recipientIds.forEach((id, index) => {
          participantMap.set(id, {
            id,
            name: message.recipientNames[index] ?? id,
            role: message.recipientRoles[index] ?? "member",
          })
        })
      })

      const unreadCount = sorted.filter(
        (message) => message.senderId !== currentUser.id && !message.readBy.includes(currentUser.id),
      ).length

      return {
        id: conversationId,
        participants: Array.from(participantMap.values()),
        lastMessage: sorted[sorted.length - 1] ?? null,
        unreadCount,
      }
    })
  }, [messages, currentUser.id])

  const orderedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const aTime = a.lastMessage?.createdAt.getTime() ?? 0
      const bTime = b.lastMessage?.createdAt.getTime() ?? 0
      return bTime - aTime
    })
  }, [conversations])

  const filteredConversations = useMemo(() => {
    if (!searchTerm) {
      return orderedConversations
    }

    return orderedConversations.filter((conversation) =>
      conversation.participants
        .filter((participant) => participant.id !== currentUser.id)
        .some((participant) =>
          participant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          participant.role.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
    )
  }, [orderedConversations, currentUser.id, searchTerm])

  const activeConversationParticipants = useMemo(() => {
    const conversation = conversations.find((item) => item.id === activeConversation)
    if (!conversation) {
      return []
    }
    return conversation.participants.filter((participant) => participant.id !== currentUser.id)
  }, [activeConversation, conversations, currentUser.id])

  const composerParticipants = useMemo(() => {
    if (activeConversationParticipants.length > 0) {
      return activeConversationParticipants
    }

    if (recipientId) {
      const participant = directory.find((item) => item.id === recipientId)
      if (participant) {
        return [participant]
      }
    }

    return [] as Participant[]
  }, [activeConversationParticipants, directory, recipientId])

  const activeConversationMessages = useMemo(() => {
    if (!activeConversation) {
      return []
    }

    return messages
      .filter((message) => message.conversationId === activeConversation)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }, [messages, activeConversation])

  const activeTypingIndicators = useMemo(() => {
    if (!activeConversation) {
      return [] as TypingIndicator[]
    }

    const now = Date.now()
    return typingIndicators.filter(
      (indicator) => indicator.conversationId === activeConversation && indicator.expiresAt > now,
    )
  }, [typingIndicators, activeConversation])

  const markConversationAsRead = useCallback(
    async (conversationId: string) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.conversationId === conversationId && !message.readBy.includes(currentUser.id)
            ? { ...message, readBy: [...message.readBy, currentUser.id] }
            : message,
        ),
      )

      try {
        await fetch("/api/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, userId: currentUser.id }),
        })
      } catch (error) {
        console.error("Failed to mark conversation as read", error)
      }
    },
    [currentUser.id],
  )

  const initialiseRealtime = useCallback(() => {
    eventSourceRef.current?.close()

    const url = new URL("/api/realtime/stream", window.location.origin)
    url.searchParams.set("userId", currentUser.id)
    url.searchParams.set("role", currentUser.role)

    const eventSource = new EventSource(url.toString())
    eventSourceRef.current = eventSource

    const queueReconnect = () => {
      if (reconnectTimerRef.current) {
        return
      }

      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null
        initialiseRealtime()
      }, 2000)
    }

    eventSource.onopen = () => {
      setIsConnected(true)
    }

    eventSource.onerror = () => {
      setIsConnected(false)
      eventSource.close()
      queueReconnect()
    }

    eventSource.addEventListener("init", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as {
        messages: ServerMessage[]
        notifications: unknown[]
      }

      setMessages(data.messages.map(toClientMessage))
    })

    eventSource.addEventListener("message", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as ServerMessage
      const clientMessage = toClientMessage(data)

      setMessages((prev) => upsertMessage(prev, clientMessage))

      if (clientMessage.senderId !== currentUser.id) {
        if (notificationAudioRef.current) {
          void notificationAudioRef.current.play().catch(() => undefined)
        }
        toast.success(`New message from ${clientMessage.senderName}`, {
          description: clientMessage.content.substring(0, 120),
          action: {
            label: "Open",
            onClick: () => {
              setActiveConversation(clientMessage.conversationId)
              markConversationAsRead(clientMessage.conversationId)
            },
          },
        })
      }

      if (activeConversation === clientMessage.conversationId) {
        void markConversationAsRead(clientMessage.conversationId)
      }
    })

    eventSource.addEventListener("notification", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as {
        title: string
        body: string
        actionUrl?: string
        category?: string
      }

      if (notificationAudioRef.current) {
        void notificationAudioRef.current.play().catch(() => undefined)
      }

      toast.info(data.title, {
        description: data.body,
        action: data.actionUrl
          ? {
              label: "View",
              onClick: () => {
                if (data.actionUrl) {
                  window.location.href = data.actionUrl
                }
              },
            }
          : undefined,
      })
    })

    eventSource.addEventListener("typing", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as {
        conversationId: string
        senderId: string
        senderName: string
        timestamp: string
      }

      setTypingIndicators((prev) => {
        const expiry = Date.now() + 3000
        const filtered = prev.filter(
          (indicator) => indicator.senderId !== data.senderId || indicator.conversationId !== data.conversationId,
        )
        return [...filtered, { ...data, expiresAt: expiry }]
      })
    })
  }, [activeConversation, currentUser.id, currentUser.role, markConversationAsRead])

  const loadInitialMessages = useCallback(async () => {
    try {
      const params = new URLSearchParams({ userId: currentUser.id })
      const response = await fetch(`/api/messages?${params.toString()}`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Unable to load messages")
      }
      const payload = (await response.json()) as { messages: ServerMessage[] }
      setMessages(payload.messages.map(toClientMessage))
    } catch (error) {
      console.error(error)
      toast.error("Unable to load messages", { description: "Please try again in a moment." })
    }
  }, [currentUser.id])

  useEffect(() => {
    void loadInitialMessages()
    initialiseRealtime()

    return () => {
      eventSourceRef.current?.close()
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      if (typingRef.current) {
        clearTimeout(typingRef.current)
      }
      mediaRecorderRef.current?.stop()
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [initialiseRealtime, loadInitialMessages])

  useEffect(() => {
    if (!activeConversation && orderedConversations.length > 0) {
      setActiveConversation(orderedConversations[0].id)
    }
  }, [orderedConversations, activeConversation])

  const broadcastTyping = useCallback(
    (conversationId: string, recipients: string[]) => {
      const now = Date.now()
      if (now - lastTypingAtRef.current < 1500) {
        return
      }

      lastTypingAtRef.current = now

      fetch("/api/messages/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          senderId: currentUser.id,
          senderName: currentUser.name,
          recipients,
        }),
      }).catch((error) => {
        console.error("Failed to broadcast typing event", error)
      })
    },
    [currentUser.id, currentUser.name],
  )

  const handleMessageChange = (value: string) => {
    setMessageText(value)

    const participantIds = composerParticipants.map((participant) => participant.id)
    const conversationId =
      activeConversation ??
      (participantIds.length > 0 ? buildConversationId([currentUser.id, ...participantIds]) : "")

    const recipients = participantIds

    if (!conversationId || recipients.length === 0) {
      return
    }

    if (typingRef.current) {
      clearTimeout(typingRef.current)
    }

    broadcastTyping(conversationId, recipients)
    typingRef.current = setTimeout(() => {
      lastTypingAtRef.current = 0
    }, 1500)
  }

  const resetComposer = () => {
    setMessageText("")
    setAttachments([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const createAttachmentPreview = async (file: File): Promise<AttachmentPreview> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

    return {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl,
      file,
    }
  }

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files?.length) {
      return
    }

    const validFiles: File[] = []
    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is larger than 10MB and was skipped.`)
      } else {
        validFiles.push(file)
      }
    })

    const previews = await Promise.all(validFiles.map((file) => createAttachmentPreview(file)))
    setAttachments((prev) => [...prev, ...previews])
  }

  const handleStartRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice recording is not supported in this browser")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" })
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: "audio/webm" })
        const preview = await createAttachmentPreview(file)
        setAttachments((prev) => [...prev, preview])
        setIsRecording(false)
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch (error) {
      console.error(error)
      toast.error("Unable to access microphone")
    }
  }

  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
  }

  const handleSendMessage = async () => {
    const trimmed = messageText.trim()
    const conversationRecipients = composerParticipants

    if (conversationRecipients.length === 0) {
      toast.error("Select a recipient before sending a message")
      return
    }

    if (!trimmed && attachments.length === 0) {
      toast.error("Write a message or attach a file")
      return
    }

    const conversationId =
      activeConversation ?? buildConversationId([currentUser.id, ...conversationRecipients.map((item) => item.id)])

    setIsSending(true)
    try {
      const payload = {
        conversationId,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        recipientIds: conversationRecipients.map((item) => item.id),
        recipientNames: conversationRecipients.map((item) => item.name),
        recipientRoles: conversationRecipients.map((item) => item.role),
        content: trimmed || (attachments[0]?.name ?? "Attachment"),
        messageType: attachments.length > 0 ? "media" : "text",
        attachments: attachments.map((attachment) => ({
          id: attachment.id,
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          dataUrl: attachment.dataUrl,
        })),
        priority: "normal" as const,
      }

      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error("Failed to send message")
      }

      const saved = (await response.json()) as { message: ServerMessage }
      const clientMessage = toClientMessage(saved.message)

      setMessages((prev) => upsertMessage(prev, clientMessage))
      setActiveConversation(clientMessage.conversationId)
      resetComposer()
      void markConversationAsRead(clientMessage.conversationId)
    } catch (error) {
      console.error(error)
      toast.error("Unable to send message", { description: "Please try again." })
    } finally {
      setIsSending(false)
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== id))
  }

  const renderMessageBubble = (message: ClientMessage) => {
    const isOwnMessage = message.senderId === currentUser.id
    const alignment = isOwnMessage ? "items-end" : "items-start"
    const bubbleColor = isOwnMessage
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-muted-foreground"

    return (
      <div key={message.id} className={cn("flex flex-col gap-1", alignment)}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{message.senderName}</span>
          <Badge variant="secondary" className={roleBadgeClass(message.senderRole)}>
            {message.senderRole.replace("_", " ")}
          </Badge>
          <span>{formatTime(message.createdAt)}</span>
        </div>
        <div
          className={cn(
            "max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm",
            bubbleColor,
            isOwnMessage ? "rounded-br-sm" : "rounded-bl-sm",
          )}
        >
          <p className="whitespace-pre-line break-words">{message.content}</p>

          {message.attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.dataUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border border-white/20 bg-black/10 px-3 py-2 text-xs backdrop-blur"
                >
                  <span className="truncate font-medium">{attachment.name}</span>
                  <span>{(attachment.size / 1024 / 1024).toFixed(1)} MB</span>
                </a>
              ))}
            </div>
          )}

          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-80">
            {message.readBy.includes(currentUser.id) && <span>Seen</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className="mx-auto w-full max-w-5xl rounded-[24px] border border-slate-200/70 bg-white/95 shadow-xl">
      <CardHeader className="flex flex-col gap-2 border-b border-slate-200/60 bg-white/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <UserCircle className="h-5 w-5" /> Internal Messaging
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Secure, real-time communication across administrators, teachers, parents and students.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {isConnected ? (
            <span className="flex items-center gap-1 text-emerald-600">
              <Wifi className="h-4 w-4" /> Live
            </span>
          ) : (
            <span className="flex items-center gap-1 text-destructive">
              <WifiOff className="h-4 w-4" /> Reconnecting…
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-6 pb-6 pt-4">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,240px)_1fr]">
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Conversations</Label>
              <Input
                id="search"
                placeholder="Search people or roles"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
              <ScrollArea className="h-[360px] pr-1">
                <div className="flex flex-col divide-y">
                  {filteredConversations.length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      No conversations yet. Start a chat below.
                    </div>
                  )}
                  {filteredConversations.map((conversation) => {
                    const others = conversation.participants.filter((participant) => participant.id !== currentUser.id)
                    const title =
                      others.length > 0 ? others.map((participant) => participant.name).join(", ") : "Private notes"
                    const subtitle = others.length > 0 ? others.map((participant) => participant.role).join(", ") : "Only you"
                    return (
                      <button
                        key={conversation.id}
                        onClick={() => {
                          setActiveConversation(conversation.id)
                          void markConversationAsRead(conversation.id)
                        }}
                        className={cn(
                          "flex w-full flex-col gap-1 rounded-2xl border border-transparent bg-white px-4 py-3 text-left transition hover:border-[#2d682d]/20 hover:bg-[#2d682d]/5",
                          activeConversation === conversation.id &&
                            "border-[#2d682d]/30 bg-[#2d682d]/10 shadow-sm",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                            <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">{subtitle}</p>
                          </div>
                          {conversation.unreadCount > 0 && (
                            <Badge variant="secondary" className="rounded-full px-2 py-0 text-xs font-medium">
                              {conversation.unreadCount}
                            </Badge>
                          )}
                        </div>
                        {conversation.lastMessage && (
                          <p className="truncate text-xs text-muted-foreground">
                            {conversation.lastMessage.senderId === currentUser.id ? "You: " : ""}
                            {conversation.lastMessage.content}
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="flex min-h-[360px] flex-col gap-4">
            <div className="rounded-3xl border border-slate-200/70 bg-white/80 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200/60 px-6 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {composerParticipants.length > 0
                      ? composerParticipants.map((participant) => participant.name).join(", ")
                      : "Select a recipient"}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {composerParticipants.length > 0
                      ? composerParticipants.map((participant) => participant.role).join(", ")
                      : "Start a new conversation"}
                  </p>
                </div>
                {activeTypingIndicators.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {activeTypingIndicators[0].senderName} is typing…
                  </div>
                )}
              </div>
              <ScrollArea className="h-[280px] px-6 py-4">
                <div className="flex flex-col gap-4">
                  {activeConversationMessages.length === 0 && (
                    <div className="rounded-lg bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                      <p className="font-medium">No messages yet</p>
                      <p>Use the composer below to start chatting.</p>
                    </div>
                  )}
                  {activeConversationMessages.map((message) => renderMessageBubble(message))}
                </div>
              </ScrollArea>
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[minmax(0,220px)_1fr] md:items-start">
                <div className="space-y-2">
                  <Label>Send to</Label>
                  <Select
                    value={recipientId || composerParticipants[0]?.id || ""}
                    onValueChange={(value) => {
                      setRecipientId(value)
                      setActiveConversation(null)
                    }}
                  >
                    <SelectTrigger className="rounded-2xl border-slate-200/70 bg-white">
                      <SelectValue placeholder="Choose recipient" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {directory.map((participant) => (
                        <SelectItem key={participant.id} value={participant.id}>
                          <div className="flex items-center justify-between gap-3">
                            <span>{participant.name}</span>
                            <Badge variant="secondary" className={roleBadgeClass(participant.role)}>
                              {participant.role.replace("_", " ")}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <div className="relative rounded-2xl border border-slate-200/70 bg-white px-4 pb-12 pt-3 shadow-inner focus-within:border-[#2d682d]/60 focus-within:ring-1 focus-within:ring-[#2d682d]/20">
                    <Textarea
                      id="message"
                      rows={3}
                      value={messageText}
                      onChange={(event) => handleMessageChange(event.target.value)}
                      placeholder="Type your message…"
                      className="min-h-[96px] w-full resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 pr-28"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={(event) => void handleFilesSelected(event.target.files)}
                      className="hidden"
                    />
                    <div className="pointer-events-none absolute bottom-3 left-4 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {isRecording ? "Recording voice note…" : "Secure message"}
                    </div>
                    <div className="pointer-events-auto absolute bottom-2 right-3 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-9 w-9 rounded-full bg-slate-100 text-slate-500 shadow-sm transition hover:bg-[#2d682d]/10 hover:text-[#2d682d]"
                        aria-label="Attach files"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant={isRecording ? "destructive" : "ghost"}
                        size="icon"
                        onClick={() => {
                          if (isRecording) {
                            handleStopRecording()
                          } else {
                            void handleStartRecording()
                          }
                        }}
                        className={cn(
                          "h-9 w-9 rounded-full shadow-sm transition",
                          isRecording
                            ? "bg-[#d62d20] text-white hover:bg-[#b0231a]"
                            : "bg-slate-100 text-slate-500 hover:bg-[#2d682d]/10 hover:text-[#2d682d]",
                        )}
                        aria-label={isRecording ? "Stop recording" : "Record voice note"}
                      >
                        <Mic className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {isRecording && (
                    <p className="text-xs font-medium text-[#d62d20]">Recording voice note… tap the mic to stop.</p>
                  )}
                </div>
              </div>

              {attachments.length > 0 && (
                <div className="mt-4 space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Attachments</Label>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs shadow-sm"
                      >
                        <span className="font-medium text-slate-600">{attachment.name}</span>
                        <span className="text-muted-foreground">
                          {(attachment.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAttachment(attachment.id)}
                          className="h-6 w-6 rounded-full bg-slate-100 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                          aria-label="Remove attachment"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Press enter for a new line. Use the icons above to share files or voice notes instantly.
                </p>
                <Button
                  onClick={() => void handleSendMessage()}
                  disabled={isSending}
                  className="flex items-center gap-2 rounded-full bg-[#2d682d] px-6 py-2 text-sm font-medium text-white transition hover:bg-[#225122]"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send message
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <audio ref={notificationAudioRef} className="hidden">
        <source src="/sounds/notification.mp3" type="audio/mpeg" />
      </audio>
    </Card>
  )
}
