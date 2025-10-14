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
import {
  Loader2,
  Mic,
  Paperclip,
  Pause,
  PencilLine,
  Play,
  Send,
  Trash2,
  UserCircle,
  Wifi,
  WifiOff,
} from "lucide-react"

export interface MessagingParticipant {
  id: string
  name: string
  role: string
  email?: string
  avatar?: string
}

type Participant = MessagingParticipant

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
  participants?: MessagingParticipant[]
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

function VoiceNotePlayer({ src, className }: { src: string; className?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("ended", handlePause)

    return () => {
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("ended", handlePause)
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setIsPlaying(false)
  }, [src])

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (isPlaying) {
      audio.pause()
      return
    }

    void audio.play().catch(() => {
      setIsPlaying(false)
    })
  }, [isPlaying])

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="rounded-full"
        onClick={togglePlayback}
        aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <audio ref={audioRef} src={src} preload="metadata" controls className="sr-only" />
      <span className="text-xs text-muted-foreground">
        {isPlaying ? "Playing voice note…" : "Tap play to listen"}
      </span>
    </div>
  )
}

export function InternalMessaging({ currentUser, participants }: InternalMessagingProps) {
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
  const [deletingMessages, setDeletingMessages] = useState<Record<string, boolean>>({})
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const typingRef = useRef<NodeJS.Timeout | null>(null)
  const lastTypingAtRef = useRef<number>(0)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    function attemptUnlock() {
      const audio = notificationAudioRef.current
      if (!audio) {
        return
      }

      audio.muted = true
      const playPromise = audio.play()

      if (!playPromise) {
        audio.muted = false
        return
      }

      void playPromise
        .then(() => {
          audio.pause()
          audio.currentTime = 0
          audio.muted = false
          window.removeEventListener("pointerdown", attemptUnlock)
          window.removeEventListener("keydown", attemptUnlock)
        })
        .catch(() => {
          audio.muted = false
        })
    }

    window.addEventListener("pointerdown", attemptUnlock)
    window.addEventListener("keydown", attemptUnlock)

    return () => {
      window.removeEventListener("pointerdown", attemptUnlock)
      window.removeEventListener("keydown", attemptUnlock)
    }
  }, [])

  const directory = useMemo(() => {
    const source = Array.isArray(participants) && participants.length > 0 ? participants : DIRECTORY
    const seen = new Set<string>()
    return source.filter((participant) => {
      if (!participant.id || participant.id === currentUser.id) {
        return false
      }
      if (seen.has(participant.id)) {
        return false
      }
      seen.add(participant.id)
      return true
    })
  }, [currentUser.id, participants])

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

  const hasComposerParticipants = composerParticipants.length > 0

  const editingMessage = useMemo(() => {
    if (!editingMessageId) {
      return null
    }

    return messages.find((message) => message.id === editingMessageId) ?? null
  }, [editingMessageId, messages])

  const isEditing = Boolean(editingMessageId)

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

  useEffect(() => {
    if (editingMessageId && !editingMessage) {
      setEditingMessageId(null)
    }
  }, [editingMessageId, editingMessage])

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
    setEditingMessageId(null)
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
    if (editingMessageId) {
      toast.error("Finish editing your message before adding attachments.")
      return
    }

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
    if (editingMessageId) {
      toast.error("Finish editing your message before recording a voice note.")
      return
    }

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

    if (editingMessageId) {
      if (!trimmed) {
        toast.error("Enter a message before saving your changes")
        return
      }

      setIsSending(true)
      try {
        const response = await fetch("/api/messages", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: editingMessageId,
            userId: currentUser.id,
            content: trimmed,
          }),
        })

        const payload = (await response.json().catch(() => ({}))) as {
          message?: ServerMessage
          error?: string
        }

        if (!response.ok || !payload.message) {
          throw new Error(payload.error ?? "Failed to update message")
        }

        const clientMessage = toClientMessage(payload.message)
        setMessages((prev) => upsertMessage(prev, clientMessage))
        resetComposer()
      } catch (error) {
        console.error(error)
        const description = error instanceof Error ? error.message : "Please try again."
        toast.error("Unable to update message", { description })
      } finally {
        setIsSending(false)
      }

      return
    }

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
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        message?: ServerMessage
        error?: string
      }

      if (!response.ok || !payload.message) {
        throw new Error(payload.error ?? "Failed to send message")
      }

      const clientMessage = toClientMessage(payload.message)
      setMessages((prev) => upsertMessage(prev, clientMessage))
      setActiveConversation(clientMessage.conversationId)
      resetComposer()
      void markConversationAsRead(clientMessage.conversationId)
    } catch (error) {
      console.error(error)
      const description = error instanceof Error ? error.message : "Please try again."
      toast.error("Unable to send message", { description })
    } finally {
      setIsSending(false)
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== id))
  }

  const handleStartEditingMessage = (message: ClientMessage) => {
    if (message.messageType !== "text" || message.isDeleted) {
      return
    }

    setEditingMessageId(message.id)
    setMessageText(message.content)
    setAttachments([])
    setActiveConversation(message.conversationId)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    if (isRecording) {
      handleStopRecording()
    }
  }

  const handleCancelEdit = () => {
    resetComposer()
  }

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      const confirmed = window.confirm("Delete this message for everyone?")
      if (!confirmed) {
        return
      }

      setDeletingMessages((prev) => ({ ...prev, [messageId]: true }))

      try {
        const response = await fetch("/api/messages", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId, userId: currentUser.id }),
        })

        if (!response.ok) {
          throw new Error("Failed to delete message")
        }

        const payload = (await response.json()) as { message: ServerMessage }
        const clientMessage = toClientMessage(payload.message)
        setMessages((prev) => upsertMessage(prev, clientMessage))
        if (editingMessageId === messageId) {
          resetComposer()
        }
      } catch (error) {
        console.error(error)
        toast.error("Unable to delete message", { description: "Please try again." })
      } finally {
        setDeletingMessages((prev) => {
          const next = { ...prev }
          delete next[messageId]
          return next
        })
      }
    },
    [currentUser.id, editingMessageId],
  )

  const renderMessageBubble = (message: ClientMessage) => {
    const isOwnMessage = message.senderId === currentUser.id
    const alignment = isOwnMessage ? "items-end" : "items-start"
    const bubbleColor = isOwnMessage
      ? "bg-gradient-to-l from-sky-500 via-indigo-500 to-violet-600 text-white"
      : "bg-white/90 text-slate-700 ring-1 ring-indigo-100/80 backdrop-blur"
    const isDeleting = deletingMessages[message.id]
    const isCurrentlyEditing = editingMessageId === message.id
    const canEdit = isOwnMessage && !message.isDeleted && message.messageType === "text"

    return (
      <div key={message.id} className={cn("flex flex-col gap-1", alignment)}>
        <div
          className={cn(
            "flex items-center gap-2 text-[11px] font-medium text-indigo-950/70",
            isOwnMessage ? "justify-end" : "",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-foreground">{message.senderName}</span>
            <Badge
              variant="secondary"
              className={cn(
                "rounded-full border border-white/60 bg-white/70 text-[10px] font-semibold uppercase tracking-wide shadow-sm",
                roleBadgeClass(message.senderRole),
              )}
            >
              {message.senderRole.replace("_", " ")}
            </Badge>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {formatTime(message.createdAt)}
            </span>
            {message.isEdited && !message.isDeleted ? (
              <span className="italic text-[10px] text-indigo-900/70">Edited</span>
            ) : null}
          </div>
          {isOwnMessage && !message.isDeleted && (
            <div className="flex items-center gap-1">
              {canEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-7 w-7 rounded-full text-muted-foreground transition hover:bg-indigo-50 hover:text-indigo-700",
                    isCurrentlyEditing ? "bg-indigo-100 text-indigo-700" : "",
                  )}
                  onClick={() => handleStartEditingMessage(message)}
                  aria-label={isCurrentlyEditing ? "Editing this message" : "Edit message"}
                  disabled={isDeleting}
                >
                  <PencilLine className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                disabled={isDeleting}
                className="h-7 w-7 rounded-full text-muted-foreground transition hover:bg-rose-50 hover:text-destructive"
                onClick={() => void handleDeleteMessage(message.id)}
                aria-label="Delete message"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
        <div
          className={cn(
            "group flex w-full max-w-[85%] flex-col gap-3 rounded-3xl px-5 py-4 text-sm shadow-[0_18px_40px_-32px_rgba(59,130,246,0.55)] transition",
            bubbleColor,
            isOwnMessage ? "rounded-br-md" : "rounded-bl-md",
            message.isDeleted ? "opacity-70" : "",
          )}
        >
          {message.isDeleted ? (
            <p className="text-xs italic text-indigo-950/60">This message was deleted</p>
          ) : (
            <div className="space-y-3">
              {message.messageType === "media" && message.attachments.length > 0 ? (
                <div className="space-y-3">
                  {message.attachments.map((attachment) => {
                    const isAudio = attachment.type.startsWith("audio/")
                    const isOwnAudio = isOwnMessage && isAudio
                    return (
                      <div
                        key={attachment.id}
                        className={cn(
                          "flex flex-col gap-2 rounded-2xl border border-white/40 bg-white/15 p-3 text-xs backdrop-blur",
                          isOwnMessage ? "text-indigo-50" : "text-slate-600",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold">
                            {attachment.name}
                          </span>
                          <span className="shrink-0 text-[10px] uppercase tracking-[0.18em]">
                            {(attachment.size / 1024 / 1024).toFixed(1)} MB
                          </span>
                        </div>
                        {isAudio && attachment.dataUrl ? (
                          <div className="space-y-2">
                            <VoiceNotePlayer src={attachment.dataUrl} />
                            {isOwnAudio && (
                              <div className="flex justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 rounded-full px-3 text-[11px] text-rose-100 transition hover:bg-rose-50/20 hover:text-white"
                                  onClick={() => void handleDeleteMessage(message.id)}
                                  disabled={isDeleting}
                                >
                                  Delete audio
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <a
                            href={attachment.dataUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-xs font-semibold text-current underline"
                          >
                            View attachment
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="leading-relaxed text-current">{message.content}</p>
              )}
            </div>
          )}

          {!message.isDeleted && message.readBy.length > 0 && (
            <div
              className={cn(
                "flex items-center gap-2 text-[10px] uppercase tracking-wide",
                isOwnMessage ? "text-indigo-50/80" : "text-muted-foreground",
              )}
            >
              {isOwnMessage && <span>Delivered</span>}
              <span>
                {message.readBy.length} recipient{message.readBy.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>

        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] uppercase tracking-wide text-indigo-900/50">
          {message.readBy.includes(currentUser.id) && <span>Seen</span>}
        </div>
      </div>
    )
  }

  return (
    <Card className="relative mr-auto w-full max-w-5xl overflow-hidden rounded-[28px] border-none bg-gradient-to-br from-sky-50 via-white to-indigo-50 shadow-[0_35px_120px_-45px_rgba(59,130,246,0.75)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.2),transparent_58%)]" />
      <CardHeader className="relative z-10 flex flex-col gap-2 border-b border-white/60 bg-white/70 px-8 py-6 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl font-semibold text-indigo-950">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600">
              <UserCircle className="h-5 w-5" />
            </span>
            <span className="leading-tight">Internal Messaging</span>
          </CardTitle>
          <p className="text-sm text-indigo-950/70">
            Secure, real-time communication across administrators, teachers, parents and students.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground shadow-inner">
          {isConnected ? (
            <span className="flex items-center gap-2 text-indigo-600">
              <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-400 shadow-[0_0_0_3px_rgba(59,130,246,0.25)]" />
              <Wifi className="h-4 w-4" /> Live
            </span>
          ) : (
            <span className="flex items-center gap-2 text-destructive">
              <span className="flex h-2.5 w-2.5 rounded-full bg-destructive/70 shadow-[0_0_0_3px_rgba(239,68,68,0.15)]" />
              <WifiOff className="h-4 w-4" /> Reconnecting…
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="relative z-10 space-y-8 px-8 pb-8 pt-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,260px)_1fr]">
          <div className="flex flex-col gap-5">
            <div className="space-y-2">
              <Label
                htmlFor="search"
                className="text-[11px] font-semibold uppercase tracking-[0.28em] text-indigo-900/70"
              >
                Conversations
              </Label>
              <Input
                id="search"
                placeholder="Search people or roles"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-11 rounded-2xl border border-white/70 bg-white/80 px-4 text-sm text-indigo-950 shadow-inner transition focus:border-indigo-400/60 focus-visible:ring-indigo-500/30"
              />
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_28px_80px_-48px_rgba(59,130,246,0.55)] backdrop-blur-sm">
              <ScrollArea className="h-[360px] pr-2">
                <div className="flex flex-col divide-y divide-indigo-100/70">
                  {filteredConversations.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground">
                      No conversations yet. Start a chat below.
                    </p>
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
                          "flex w-full flex-col gap-2 rounded-2xl border border-transparent bg-white/50 px-4 py-3 text-left transition-all duration-200 hover:-translate-y-[1px] hover:border-indigo-200 hover:bg-indigo-50/80 hover:shadow-sm",
                          activeConversation === conversation.id &&
                            "border-indigo-300/70 bg-indigo-50 shadow-[0_16px_50px_-35px_rgba(79,70,229,0.85)]",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <p className="truncate text-sm font-semibold text-indigo-950">{title}</p>
                            <p className="truncate text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{subtitle}</p>
                          </div>
                          {conversation.unreadCount > 0 && (
                            <Badge
                              variant="secondary"
                              className="rounded-full border border-indigo-100 bg-indigo-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-700"
                            >
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

          <div className="flex min-h-[360px] flex-col gap-5">
            <div className="rounded-3xl border border-white/70 bg-white/70 shadow-[0_28px_80px_-48px_rgba(59,130,246,0.55)] backdrop-blur-sm">
              {hasComposerParticipants ? (
                <>
                  <div className="flex items-center justify-between border-b border-white/60 px-6 py-4">
                    <div>
                      <p className="text-base font-semibold text-indigo-950">
                        {composerParticipants.map((participant) => participant.name).join(", ")}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                        {composerParticipants.map((participant) => participant.role).join(", ")}
                      </p>
                    </div>
                    {activeTypingIndicators.length > 0 && (
                      <div className="flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/70 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-indigo-700">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {activeTypingIndicators[0].senderName} is typing…
                      </div>
                    )}
                  </div>
                  <ScrollArea className="h-[280px] px-6 py-4">
                    <div className="flex flex-col gap-4">
                      {activeConversationMessages.length === 0 && (
                        <div className="space-y-1 text-center text-sm text-indigo-900/70">
                          <p className="text-base font-semibold">No messages yet</p>
                          <p className="text-sm">Use the composer below to start chatting.</p>
                        </div>
                      )}
                      {activeConversationMessages.map((message) => renderMessageBubble(message))}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="px-6 py-12 text-center text-indigo-900/70">
                  <p className="text-base font-semibold">Select a recipient</p>
                  <p className="text-sm">Start a new conversation</p>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[0_28px_80px_-48px_rgba(59,130,246,0.55)] backdrop-blur-sm">
              <div className="grid gap-5 md:grid-cols-[minmax(0,240px)_1fr] md:items-start">
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-indigo-900/70">Send to</Label>
                  <Select
                    value={recipientId || composerParticipants[0]?.id || ""}
                    onValueChange={(value) => {
                      setRecipientId(value)
                      setActiveConversation(null)
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-2xl border border-white/70 bg-white/80 text-sm text-indigo-950 shadow-inner transition focus:ring-indigo-500/20">
                      <SelectValue placeholder="Choose recipient" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border border-white/70 bg-white/80 shadow-xl">
                      {directory.map((participant) => (
                        <SelectItem key={participant.id} value={participant.id}>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-indigo-950">{participant.name}</span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "rounded-full border border-white/60 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-indigo-700",
                                roleBadgeClass(participant.role),
                              )}
                            >
                              {participant.role.replace("_", " ")}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="message"
                    className="text-[11px] font-semibold uppercase tracking-[0.28em] text-indigo-900/70"
                  >
                    Message
                  </Label>
                  <div className="relative rounded-3xl border border-white/70 bg-white/80 px-5 pb-14 pt-4 shadow-inner transition focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500/20">
                    {isEditing && editingMessage && (
                      <div className="mb-3 flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-700">
                        <span>
                          Editing message sent at {formatTime(editingMessage.createdAt)}.
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 rounded-full px-3 text-amber-700 hover:bg-amber-100"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                    <Textarea
                      id="message"
                      rows={3}
                      value={messageText}
                      onChange={(event) => handleMessageChange(event.target.value)}
                      placeholder={isEditing ? "Update your message…" : "Type your message…"}
                      className="min-h-[96px] w-full resize-none border-0 bg-transparent p-0 pr-32 text-sm text-indigo-950 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={(event) => void handleFilesSelected(event.target.files)}
                      className="hidden"
                    />
                    <div className="pointer-events-none absolute bottom-4 left-5 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                      {isEditing
                        ? "Editing message"
                        : isRecording
                          ? "Recording voice note…"
                          : "Secure message"}
                    </div>
                    <div className="pointer-events-auto absolute bottom-3 right-4 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isEditing || isSending}
                        onClick={() => fileInputRef.current?.click()}
                        className="h-10 w-10 rounded-full bg-indigo-50 text-indigo-500 shadow-sm transition hover:bg-indigo-100 hover:text-indigo-700"
                        aria-label="Attach files"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant={isRecording ? "destructive" : "ghost"}
                        size="icon"
                        disabled={isEditing}
                        onClick={() => {
                          if (isRecording) {
                            handleStopRecording()
                          } else {
                            void handleStartRecording()
                          }
                        }}
                        className={cn(
                          "h-10 w-10 rounded-full shadow-sm transition",
                          isRecording
                            ? "bg-rose-500 text-white hover:bg-rose-600"
                            : "bg-indigo-50 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700",
                        )}
                        aria-label={isRecording ? "Stop recording" : "Record voice note"}
                      >
                        <Mic className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {isRecording && (
                    <p className="text-xs font-medium text-rose-500">Recording voice note… tap the mic to stop.</p>
                  )}
                </div>
              </div>

                {attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-indigo-900/70">
                      Attachments
                    </Label>
                    <div className="flex flex-wrap gap-3">
                      {attachments.map((attachment) => {
                        const isAudio = attachment.type.startsWith("audio/")
                        return (
                          <div
                            key={attachment.id}
                            className="group flex w-full max-w-xs flex-col gap-2 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-xs text-indigo-950 shadow-sm backdrop-blur-sm"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-medium">{attachment.name}</span>
                              <span className="text-muted-foreground">
                                {(attachment.size / 1024 / 1024).toFixed(1)} MB
                              </span>
                            </div>
                            {isAudio && attachment.dataUrl ? (
                              <VoiceNotePlayer src={attachment.dataUrl} />
                            ) : attachment.dataUrl ? (
                              <a
                                href={attachment.dataUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center text-xs font-semibold text-indigo-600 underline"
                              >
                                Preview attachment
                              </a>
                            ) : null}
                            <div className="flex justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeAttachment(attachment.id)}
                                className="h-7 w-7 rounded-full bg-indigo-50 text-indigo-500 opacity-0 transition group-hover:opacity-100 hover:bg-rose-100 hover:text-rose-600"
                                aria-label="Remove attachment"
                              >
                                ×
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Press enter for a new line. Use the icons above to share files or voice notes instantly.
                </p>
                <Button
                  onClick={() => void handleSendMessage()}
                  disabled={
                    isSending || (isEditing && messageText.trim().length === 0)
                  }
                  className="flex items-center gap-2 rounded-full bg-indigo-500 px-6 py-2 text-sm font-semibold text-white shadow-[0_20px_40px_-24px_rgba(59,130,246,0.7)] transition hover:bg-indigo-600"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isEditing ? "Saving…" : "Sending…"}
                    </>
                  ) : (
                    <>
                      {isEditing ? <PencilLine className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                      {isEditing ? "Save changes" : "Send message"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <audio ref={notificationAudioRef} className="hidden" preload="auto">
        <source src="/sounds/notification.mp3" type="audio/mpeg" />
      </audio>
    </Card>
  )
}
