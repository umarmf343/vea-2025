"use client"

import type React from "react"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  MessageCircle,
  Send,
  Paperclip,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  File,
  ImageIcon,
  Download,
  Users,
  Video,
  Archive,
  Star,
  Trash2,
  Forward,
  Reply,
  Eye,
  Mic,
  Smile,
  Bell,
  BellOff,
  Hash,
  AtSign,
  Filter,
  SortAsc,
  RefreshCw,
  Wifi,
  WifiOff,
  Circle,
  CheckCheck,
  Volume2,
  VolumeX,
} from "lucide-react"
import { toast } from "sonner"
import { safeStorage } from "@/lib/safe-storage"

interface Message {
  id: string
  senderId: string
  senderName: string
  senderRole: string
  recipientId: string
  recipientName: string
  recipientRole: string
  subject: string
  content: string
  timestamp: Date
  read: boolean
  delivered: boolean
  starred: boolean
  archived: boolean
  priority: "low" | "normal" | "high" | "urgent"
  messageType: "text" | "file" | "image" | "voice" | "video"
  conversationId: string
  status: "sent" | "scheduled" | "failed"
  scheduledFor?: Date | null
  replyTo?: string
  edited: boolean
  editedAt?: Date
  reactions: Array<{
    userId: string
    emoji: string
    timestamp: Date
  }>
  attachments?: Array<{
    id: string
    name: string
    type: string
    size: string
    url: string
    thumbnail?: string
  }>
  mentions: string[]
  tags: string[]
}

interface Conversation {
  id: string
  participants: string[]
  lastMessage: Message
  unreadCount: number
  muted: boolean
  pinned: boolean
  archived: boolean
  type: "direct" | "group"
  groupName?: string
  groupAvatar?: string
}

interface TypingIndicator {
  userId: string
  userName: string
  timestamp: Date
}

interface OnlineStatus {
  userId: string
  status: "online" | "away" | "busy" | "offline"
  lastSeen: Date
}

interface InternalMessagingProps {
  currentUser: {
    id: string
    name: string
    role: string
    avatar?: string
  }
}

const generateConversationId = (userA: string, userB: string) =>
  [userA, userB].sort((a, b) => a.localeCompare(b)).join("::")

const PRIORITY_ORDER: Record<Message["priority"], number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
}

export function InternalMessaging({ currentUser }: InternalMessagingProps) {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [showNewMessageDialog, setShowNewMessageDialog] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [typingIndicators, setTypingIndicators] = useState<TypingIndicator[]>([])
  const [onlineUsers, setOnlineUsers] = useState<OnlineStatus[]>([])
  const [isConnected, setIsConnected] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [notifications, setNotifications] = useState(true)
  const [filter, setFilter] = useState<"all" | "unread" | "starred" | "archived">("all")
  const [sortBy, setSortBy] = useState<"time" | "priority" | "sender">("time")
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [editingMessage, setEditingMessage] = useState<string | null>(null)
  const [showGroupDialog, setShowGroupDialog] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()
  const audioRef = useRef<HTMLAudioElement>()
  const scheduledMessageTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const [newMessageForm, setNewMessageForm] = useState({
    recipient: "",
    subject: "",
    content: "",
    priority: "normal" as const,
    attachments: [] as File[],
    mentions: [] as string[],
    tags: [] as string[],
    scheduledFor: null as Date | null,
  })

  // Enhanced users data with online status
  const users = [
    { id: "1", name: "John Smith", role: "teacher", email: "john.smith@vea.edu.ng", avatar: "/avatars/john.jpg" },
    { id: "2", name: "Sarah Johnson", role: "admin", email: "sarah.johnson@vea.edu.ng", avatar: "/avatars/sarah.jpg" },
    { id: "3", name: "Mike Brown", role: "parent", email: "mike.brown@parent.vea.edu.ng", avatar: "/avatars/mike.jpg" },
    { id: "4", name: "Emily Davis", role: "teacher", email: "emily.davis@vea.edu.ng", avatar: "/avatars/emily.jpg" },
    {
      id: "5",
      name: "David Wilson",
      role: "super_admin",
      email: "david.wilson@vea.edu.ng",
      avatar: "/avatars/david.jpg",
    },
    {
      id: "6",
      name: "Lisa Anderson",
      role: "parent",
      email: "lisa.anderson@parent.vea.edu.ng",
      avatar: "/avatars/lisa.jpg",
    },
    {
      id: "7",
      name: "Robert Taylor",
      role: "teacher",
      email: "robert.taylor@vea.edu.ng",
      avatar: "/avatars/robert.jpg",
    },
  ]

  // Enhanced messages with real-time features
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      senderId: "1",
      senderName: "John Smith",
      senderRole: "teacher",
      recipientId: currentUser.id,
      recipientName: currentUser.name,
      recipientRole: currentUser.role,
      subject: "Student Performance Update",
      content:
        "I wanted to discuss the recent performance of students in Mathematics. There are some concerns I'd like to address regarding @Emily Davis's class.",
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      read: false,
      delivered: true,
      starred: false,
      archived: false,
      priority: "high",
      messageType: "text",
      conversationId: generateConversationId("1", currentUser.id),
      status: "sent",
      scheduledFor: null,
      edited: false,
      reactions: [{ userId: "2", emoji: "👍", timestamp: new Date(Date.now() - 1000 * 60 * 25) }],
      mentions: ["4"],
      tags: ["performance", "mathematics"],
      attachments: [
        {
          id: "att1",
          name: "performance_report.pdf",
          type: "application/pdf",
          size: "2.3 MB",
          url: "#",
          thumbnail: "/thumbnails/pdf.png",
        },
      ],
    },
    {
      id: "2",
      senderId: "2",
      senderName: "Sarah Johnson",
      senderRole: "admin",
      recipientId: currentUser.id,
      recipientName: currentUser.name,
      recipientRole: currentUser.role,
      subject: "Meeting Reminder",
      content: "Don't forget about the staff meeting tomorrow at 10 AM in the conference room. #meeting #important",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      read: true,
      delivered: true,
      starred: true,
      archived: false,
      priority: "urgent",
      messageType: "text",
      conversationId: generateConversationId("2", currentUser.id),
      status: "sent",
      scheduledFor: null,
      edited: false,
      reactions: [],
      mentions: [],
      tags: ["meeting", "important"],
    },
    {
      id: "3",
      senderId: "3",
      senderName: "Mike Brown",
      senderRole: "parent",
      recipientId: currentUser.id,
      recipientName: currentUser.name,
      recipientRole: currentUser.role,
      subject: "Question about Assignment",
      content: "Hello, I have a question about my child's recent assignment. Could we schedule a brief discussion?",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
      read: true,
      delivered: true,
      starred: false,
      archived: false,
      priority: "normal",
      messageType: "text",
      conversationId: generateConversationId("3", currentUser.id),
      status: "sent",
      scheduledFor: null,
      edited: false,
      reactions: [{ userId: currentUser.id, emoji: "❤️", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3) }],
      mentions: [],
      tags: ["assignment"],
      attachments: [
        {
          id: "att2",
          name: "assignment_question.jpg",
          type: "image/jpeg",
          size: "1.1 MB",
          url: "#",
          thumbnail: "/thumbnails/image.jpg",
        },
      ],
    },
  ])

  // Real-time simulation effects
  useEffect(() => {
    // Simulate real-time message updates
    const messageInterval = setInterval(() => {
      if (Math.random() > 0.95) {
        // 5% chance every second
        simulateIncomingMessage()
      }
    }, 1000)

    // Simulate online status updates
    const statusInterval = setInterval(() => {
      updateOnlineStatuses()
    }, 30000) // Update every 30 seconds

    // Simulate typing indicators
    const typingInterval = setInterval(() => {
      if (Math.random() > 0.98) {
        // 2% chance
        simulateTyping()
      }
    }, 1000)

    return () => {
      clearInterval(messageInterval)
      clearInterval(statusInterval)
      clearInterval(typingInterval)
    }
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load messages from localStorage on mount
  useEffect(() => {
    const savedMessages = safeStorage.getItem("vea_messages")
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages)
        setMessages(
          parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
            scheduledFor: m.scheduledFor ? new Date(m.scheduledFor) : null,
            status: m.status ?? "sent",
            conversationId: m.conversationId ?? generateConversationId(m.senderId, m.recipientId),
            reactions:
              m.reactions?.map((r: any) => ({
                ...r,
                timestamp: new Date(r.timestamp),
              })) || [],
            editedAt: m.editedAt ? new Date(m.editedAt) : undefined,
          })),
        )
      } catch (error) {
        console.error("Error loading messages:", error)
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      scheduledMessageTimeouts.current.forEach((timeout) => clearTimeout(timeout))
      scheduledMessageTimeouts.current.clear()
    }
  }, [])

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    safeStorage.setItem("vea_messages", JSON.stringify(messages))
  }, [messages])

  const scheduleMessageDelivery = useCallback(
    (message: Message) => {
      if (message.status !== "scheduled" || !message.scheduledFor) {
        return
      }

      if (scheduledMessageTimeouts.current.has(message.id)) {
        return
      }

      const deliver = () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.id
              ? {
                  ...m,
                  status: "sent",
                  delivered: true,
                  timestamp: message.scheduledFor ?? new Date(),
                }
              : m,
          ),
        )
        toast.success(`Scheduled message delivered to ${message.recipientName}`)
      }

      const delay = message.scheduledFor.getTime() - Date.now()

      if (delay <= 0) {
        deliver()
        return
      }

      const timeout = setTimeout(() => {
        scheduledMessageTimeouts.current.delete(message.id)
        deliver()
      }, delay)

      scheduledMessageTimeouts.current.set(message.id, timeout)
    },
    [setMessages],
  )

  useEffect(() => {
    messages.forEach((message) => {
      if (message.status === "scheduled" && message.scheduledFor) {
        scheduleMessageDelivery(message)
      }
    })
  }, [messages, scheduleMessageDelivery])

  useEffect(() => {
    setReplyingTo(null)
    setNewMessage("")
  }, [selectedConversation])

  // Initialize online statuses
  useEffect(() => {
    setOnlineUsers(
      users.map((user) => ({
        userId: user.id,
        status: Math.random() > 0.3 ? "online" : "offline",
        lastSeen: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24),
      })),
    )
  }, [])

  const simulateIncomingMessage = () => {
    const randomUser = users[Math.floor(Math.random() * users.length)]
    if (randomUser.id === currentUser.id) return

    const newMsg: Message = {
      id: Date.now().toString(),
      senderId: randomUser.id,
      senderName: randomUser.name,
      senderRole: randomUser.role,
      recipientId: currentUser.id,
      recipientName: currentUser.name,
      recipientRole: currentUser.role,
      subject: "New Message",
      content: `Hello! This is a real-time message from ${randomUser.name}.`,
      timestamp: new Date(),
      read: false,
      delivered: true,
      starred: false,
      archived: false,
      priority: "normal",
      messageType: "text",
      conversationId: generateConversationId(randomUser.id, currentUser.id),
      status: "sent",
      scheduledFor: null,
      edited: false,
      reactions: [],
      mentions: [],
      tags: [],
    }

    setMessages((prev) => [...prev, newMsg])

    if (soundEnabled) {
      playNotificationSound()
    }

    if (notifications) {
      toast.success(`New message from ${randomUser.name}`, {
        description: newMsg.content.substring(0, 50) + "...",
        action: {
          label: "View",
          onClick: () => {
            setSelectedConversation(newMsg.conversationId)
            markConversationAsRead(newMsg.conversationId)
          },
        },
      })
    }
  }

  const simulateTyping = () => {
    const randomUser = users[Math.floor(Math.random() * users.length)]
    if (randomUser.id === currentUser.id) return

    const typingIndicator: TypingIndicator = {
      userId: randomUser.id,
      userName: randomUser.name,
      timestamp: new Date(),
    }

    setTypingIndicators((prev) => [...prev.filter((t) => t.userId !== randomUser.id), typingIndicator])

    // Remove typing indicator after 3 seconds
    setTimeout(() => {
      setTypingIndicators((prev) => prev.filter((t) => t.userId !== randomUser.id))
    }, 3000)
  }

  const updateOnlineStatuses = () => {
    setOnlineUsers((prev) =>
      prev.map((user) => ({
        ...user,
        status:
          Math.random() > 0.2
            ? user.status
            : (["online", "away", "busy", "offline"] as const)[Math.floor(Math.random() * 4)],
        lastSeen: user.status === "offline" ? new Date() : user.lastSeen,
      })),
    )
  }

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {
        // Ignore autoplay restrictions
      })
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return

    const conversationMessages = messages
      .filter((m) => m.conversationId === selectedConversation)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    if (conversationMessages.length === 0) return

    const referenceMessage = replyingTo || conversationMessages[conversationMessages.length - 1]
    const targetUser =
      referenceMessage.senderId === currentUser.id
        ? {
            id: referenceMessage.recipientId,
            name: referenceMessage.recipientName,
            role: referenceMessage.recipientRole,
          }
        : {
            id: referenceMessage.senderId,
            name: referenceMessage.senderName,
            role: referenceMessage.senderRole,
          }

    const message: Message = {
      id: Date.now().toString(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      recipientId: targetUser.id,
      recipientName: targetUser.name,
      recipientRole: targetUser.role,
      subject: replyingTo ? `Re: ${replyingTo.subject}` : referenceMessage.subject,
      content: newMessage,
      timestamp: new Date(),
      read: false,
      delivered: false,
      starred: false,
      archived: false,
      priority: referenceMessage.priority,
      messageType: "text",
      conversationId: selectedConversation,
      status: "sent",
      scheduledFor: null,
      edited: false,
      reactions: [],
      mentions: extractMentions(newMessage),
      tags: extractTags(newMessage),
      replyTo: replyingTo?.id,
    }

    setMessages((prev) => [...prev, message])
    setNewMessage("")
    setReplyingTo(null)

    // Simulate delivery confirmation
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, delivered: true } : m)))
    }, 1000)

    toast.success("Message sent successfully!")
  }

  const handleNewMessage = () => {
    if (!newMessageForm.recipient || !newMessageForm.subject || !newMessageForm.content) {
      toast.error("Please fill in all required fields")
      return
    }

    const recipient = users.find((u) => u.id === newMessageForm.recipient)
    if (!recipient) return

    const conversationId = generateConversationId(currentUser.id, recipient.id)
    const scheduledFor = newMessageForm.scheduledFor
    const isScheduled = !!scheduledFor && scheduledFor.getTime() > Date.now()

    const message: Message = {
      id: Date.now().toString(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      recipientId: recipient.id,
      recipientName: recipient.name,
      recipientRole: recipient.role,
      subject: newMessageForm.subject,
      content: newMessageForm.content,
      timestamp: scheduledFor || new Date(),
      read: false,
      delivered: !isScheduled,
      starred: false,
      archived: false,
      priority: newMessageForm.priority,
      messageType: newMessageForm.attachments.length > 0 ? "file" : "text",
      conversationId,
      status: isScheduled ? "scheduled" : "sent",
      scheduledFor: scheduledFor || null,
      edited: false,
      reactions: [],
      mentions: newMessageForm.mentions,
      tags: newMessageForm.tags,
      attachments: newMessageForm.attachments.map((file, index) => ({
        id: `att_${Date.now()}_${index}`,
        name: file.name,
        type: file.type,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        url: URL.createObjectURL(file),
        thumbnail: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      })),
    }

    setMessages((prev) => [...prev, message])
    setSelectedConversation(conversationId)
    setNewMessageForm({
      recipient: "",
      subject: "",
      content: "",
      priority: "normal",
      attachments: [],
      mentions: [],
      tags: [],
      scheduledFor: null,
    })
    setShowNewMessageDialog(false)

    if (isScheduled) {
      scheduleMessageDelivery(message)
    } else {
      setTimeout(() => {
        setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, delivered: true } : m)))
      }, 1000)
    }

    toast.success(`Message ${isScheduled ? "scheduled" : "sent"} successfully!`)
  }

  const handleTyping = () => {
    setIsTyping(true)

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
    }, 2000)
  }

  const extractMentions = (text: string): string[] => {
    const mentions = text.match(/@(\w+)/g) || []
    return mentions.map((m) => m.substring(1))
  }

  const extractTags = (text: string): string[] => {
    const tags = text.match(/#(\w+)/g) || []
    return tags.map((t) => t.substring(1))
  }

  const markConversationAsRead = (conversationId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.conversationId === conversationId && m.recipientId === currentUser.id ? { ...m, read: true } : m,
      ),
    )
  }

  const markAsRead = (messageId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, read: true } : m)))
  }

  const toggleStar = (messageId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, starred: !m.starred } : m)))
  }

  const toggleArchive = (messageId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, archived: !m.archived } : m)))
  }

  const toggleConversationStar = (conversationId: string) => {
    setMessages((prev) => {
      const conversationMessages = prev.filter((m) => m.conversationId === conversationId)
      const shouldStar = !conversationMessages.some((m) => m.starred)
      return prev.map((m) =>
        m.conversationId === conversationId ? { ...m, starred: shouldStar } : m,
      )
    })
  }

  const toggleConversationArchive = (conversationId: string) => {
    setMessages((prev) => {
      const conversationMessages = prev.filter((m) => m.conversationId === conversationId)
      const shouldArchive = !conversationMessages.every((m) => m.archived)
      toast.success(shouldArchive ? "Conversation archived" : "Conversation restored")
      return prev.map((m) =>
        m.conversationId === conversationId ? { ...m, archived: shouldArchive } : m,
      )
    })
  }

  const deleteMessage = (messageId: string) => {
    const scheduledTimeout = scheduledMessageTimeouts.current.get(messageId)
    if (scheduledTimeout) {
      clearTimeout(scheduledTimeout)
      scheduledMessageTimeouts.current.delete(messageId)
    }
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    toast.success("Message deleted")
  }

  const addReaction = (messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === messageId) {
          const existingReaction = m.reactions.find((r) => r.userId === currentUser.id)
          if (existingReaction) {
            return {
              ...m,
              reactions: m.reactions.map((r) => (r.userId === currentUser.id ? { ...r, emoji } : r)),
            }
          } else {
            return {
              ...m,
              reactions: [
                ...m.reactions,
                {
                  userId: currentUser.id,
                  emoji,
                  timestamp: new Date(),
                },
              ],
            }
          }
        }
        return m
      }),
    )
  }

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return

    const fileArray = Array.from(files)
    const maxSize = 10 * 1024 * 1024 // 10MB
    const validFiles = fileArray.filter((file) => file.size <= maxSize)

    if (validFiles.length !== fileArray.length) {
      toast.error("Some files were too large (max 10MB)")
    }

    setNewMessageForm((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...validFiles],
    }))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFileUpload(e.dataTransfer.files)
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      case "admin":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "teacher":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "parent":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      case "student":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "text-red-600 bg-red-50 border-red-200"
      case "high":
        return "text-orange-600 bg-orange-50 border-orange-200"
      case "normal":
        return "text-blue-600 bg-blue-50 border-blue-200"
      case "low":
        return "text-gray-600 bg-gray-50 border-gray-200"
      default:
        return "text-blue-600 bg-blue-50 border-blue-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return <Circle className="h-3 w-3 fill-green-500 text-green-500" />
      case "away":
        return <Circle className="h-3 w-3 fill-yellow-500 text-yellow-500" />
      case "busy":
        return <Circle className="h-3 w-3 fill-red-500 text-red-500" />
      default:
        return <Circle className="h-3 w-3 fill-gray-400 text-gray-400" />
    }
  }

  const getFileIcon = (type: string) => {
    if (type.includes("image")) return <ImageIcon className="h-4 w-4" />
    if (type.includes("video")) return <Video className="h-4 w-4" />
    if (type.includes("audio")) return <Volume2 className="h-4 w-4" />
    return <File className="h-4 w-4" />
  }

  const conversations = useMemo(() => {
    const conversationMap = new Map<
      string,
      {
        id: string
        messages: Message[]
      }
    >()

    messages.forEach((message) => {
      const conversationId = message.conversationId || generateConversationId(message.senderId, message.recipientId)
      if (!conversationMap.has(conversationId)) {
        conversationMap.set(conversationId, { id: conversationId, messages: [] })
      }

      conversationMap.get(conversationId)!.messages.push(message)
    })

    return Array.from(conversationMap.values()).map(({ id, messages: conversationMessages }) => {
      const sortedMessages = [...conversationMessages].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      )
      const lastMessage = sortedMessages[sortedMessages.length - 1]

      const participantMap = new Map<
        string,
        {
          id: string
          name: string
          role: string
        }
      >()

      sortedMessages.forEach((message) => {
        participantMap.set(message.senderId, {
          id: message.senderId,
          name: message.senderName,
          role: message.senderRole,
        })
        participantMap.set(message.recipientId, {
          id: message.recipientId,
          name: message.recipientName,
          role: message.recipientRole,
        })
      })

      const participants = Array.from(participantMap.values())
      const otherParticipants = participants.filter((participant) => participant.id !== currentUser.id)
      const displayName =
        otherParticipants.length > 0
          ? otherParticipants.map((participant) => participant.name).join(", ")
          : currentUser.name
      const displayRole =
        otherParticipants.length === 1
          ? otherParticipants[0].role
          : otherParticipants.length > 1
            ? "group"
            : currentUser.role
      const unreadCount = sortedMessages.filter(
        (message) => !message.read && message.recipientId === currentUser.id,
      ).length
      const archived = sortedMessages.every((message) => message.archived)
      const starred = sortedMessages.some((message) => message.starred)
      const highestPriority = sortedMessages.reduce<Message["priority"]>(
        (highest, message) =>
          PRIORITY_ORDER[message.priority] > PRIORITY_ORDER[highest] ? message.priority : highest,
        sortedMessages[0]?.priority ?? "normal",
      )
      const primaryParticipant =
        otherParticipants[0] ||
        participants[0] || {
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
        }

      return {
        id,
        messages: sortedMessages,
        lastMessage,
        participants,
        otherParticipants,
        displayName,
        displayRole,
        unreadCount,
        archived,
        starred,
        highestPriority,
        primaryParticipant,
      }
    })
  }, [messages, currentUser.id, currentUser.name, currentUser.role])

  const filteredConversations = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase().trim()
    return conversations
      .filter((conversation) => {
        const matchesSearch =
          lowerSearch.length === 0 ||
          conversation.displayName.toLowerCase().includes(lowerSearch) ||
          conversation.participants.some(
            (participant) =>
              participant.name.toLowerCase().includes(lowerSearch) ||
              participant.role.toLowerCase().includes(lowerSearch),
          ) ||
          conversation.messages.some(
            (message) =>
              message.subject.toLowerCase().includes(lowerSearch) ||
              message.content.toLowerCase().includes(lowerSearch) ||
              message.tags.some((tag) => tag.toLowerCase().includes(lowerSearch)),
          )

        const matchesFilter = (() => {
          switch (filter) {
            case "unread":
              return conversation.unreadCount > 0
            case "starred":
              return conversation.starred
            case "archived":
              return conversation.archived
            default:
              return !conversation.archived
          }
        })()

        return matchesSearch && matchesFilter
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "priority":
            return PRIORITY_ORDER[b.highestPriority] - PRIORITY_ORDER[a.highestPriority]
          case "sender":
            return a.displayName.localeCompare(b.displayName)
          default:
            return b.lastMessage.timestamp.getTime() - a.lastMessage.timestamp.getTime()
        }
      })
  }, [conversations, searchTerm, filter, sortBy])

  const unreadCount = conversations.reduce((count, conversation) => count + conversation.unreadCount, 0)
  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversation) || null,
    [conversations, selectedConversation],
  )
  const getUserOnlineStatus = (userId: string) => {
    return onlineUsers.find((u) => u.userId === userId)?.status || "offline"
  }

  const emojis = ["👍", "❤️", "😊", "😂", "😮", "😢", "😡", "🎉", "🔥", "💯"]

  return (
    <div className="space-y-6">
      {/* Hidden audio element for notifications */}
      <audio ref={audioRef} preload="auto">
        <source src="/sounds/notification.mp3" type="audio/mpeg" />
      </audio>

      {/* Enhanced Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#2d682d] flex items-center gap-2">
              <MessageCircle className="h-6 w-6" />
              Internal Messaging
              {unreadCount > 0 && <Badge className="bg-red-500 text-white animate-pulse">{unreadCount} unread</Badge>}
              {!isConnected && (
                <Badge variant="destructive" className="animate-pulse">
                  Offline
                </Badge>
              )}
            </h2>
            <p className="text-gray-600">Real-time messaging with advanced features</p>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-2">
            {isConnected ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
            <span className="text-sm text-gray-500">{isConnected ? "Connected" : "Reconnecting..."}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSoundEnabled(!soundEnabled)}>
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>

          <Button variant="outline" size="sm" onClick={() => setNotifications(!notifications)}>
            {notifications ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </Button>

          <Dialog open={showNewMessageDialog} onOpenChange={setShowNewMessageDialog}>
            <DialogTrigger asChild>
              <Button className="bg-[#2d682d] hover:bg-[#2d682d]/90">
                <Plus className="h-4 w-4 mr-2" />
                New Message
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Compose New Message</DialogTitle>
                <DialogDescription>Send a message with advanced features</DialogDescription>
              </DialogHeader>
              <div
                className={`space-y-4 ${dragOver ? "bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg p-4" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="recipient">Recipient *</Label>
                    <Select
                      value={newMessageForm.recipient}
                      onValueChange={(value) => setNewMessageForm((prev) => ({ ...prev, recipient: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select recipient" />
                      </SelectTrigger>
                      <SelectContent>
                        {users
                          .filter((u) => u.id !== currentUser.id)
                          .map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(getUserOnlineStatus(user.id))}
                                <Badge className={getRoleColor(user.role)} variant="secondary">
                                  {user.role}
                                </Badge>
                                {user.name}
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={newMessageForm.priority}
                      onValueChange={(value: any) => setNewMessageForm((prev) => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">🟢 Low</SelectItem>
                        <SelectItem value="normal">🔵 Normal</SelectItem>
                        <SelectItem value="high">🟠 High</SelectItem>
                        <SelectItem value="urgent">🔴 Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    value={newMessageForm.subject}
                    onChange={(e) => setNewMessageForm((prev) => ({ ...prev, subject: e.target.value }))}
                    placeholder="Enter message subject"
                  />
                </div>

                <div>
                  <Label htmlFor="content">Message *</Label>
                  <Textarea
                    id="content"
                    value={newMessageForm.content}
                    onChange={(e) => setNewMessageForm((prev) => ({ ...prev, content: e.target.value }))}
                    placeholder="Type your message here... Use @username to mention someone or #tag for tags"
                    rows={8}
                    className="resize-none"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Supports @mentions and #hashtags • {newMessageForm.content.length}/5000 characters
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="attachments">Attachments</Label>
                    <Input
                      id="attachments"
                      type="file"
                      multiple
                      ref={fileInputRef}
                      onChange={(e) => handleFileUpload(e.target.files)}
                      className="cursor-pointer"
                    />
                    <div className="text-xs text-gray-500 mt-1">Max 10MB per file • Drag & drop supported</div>
                  </div>

                  <div>
                    <Label htmlFor="scheduledFor">Schedule for later (Optional)</Label>
                    <Input
                      id="scheduledFor"
                      type="datetime-local"
                      onChange={(e) =>
                        setNewMessageForm((prev) => ({
                          ...prev,
                          scheduledFor: e.target.value ? new Date(e.target.value) : null,
                        }))
                      }
                    />
                  </div>
                </div>

                {newMessageForm.attachments.length > 0 && (
                  <div>
                    <Label>Attached Files ({newMessageForm.attachments.length})</Label>
                    <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                      {newMessageForm.attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            {getFileIcon(file.type)}
                            <div>
                              <p className="text-sm font-medium truncate max-w-48">{file.name}</p>
                              <p className="text-xs text-gray-500">
                                {(file.size / 1024 / 1024).toFixed(1)} MB • {file.type}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setNewMessageForm((prev) => ({
                                ...prev,
                                attachments: prev.attachments.filter((_, i) => i !== index),
                              }))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mentions and Tags Preview */}
                {(extractMentions(newMessageForm.content).length > 0 ||
                  extractTags(newMessageForm.content).length > 0) && (
                  <div className="flex flex-wrap gap-2">
                    {extractMentions(newMessageForm.content).map((mention, index) => (
                      <Badge key={`mention-${index}`} variant="secondary" className="text-blue-600">
                        <AtSign className="h-3 w-3 mr-1" />
                        {mention}
                      </Badge>
                    ))}
                    {extractTags(newMessageForm.content).map((tag, index) => (
                      <Badge key={`tag-${index}`} variant="outline" className="text-green-600">
                        <Hash className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewMessageDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleNewMessage} className="bg-[#2d682d] hover:bg-[#2d682d]/90">
                  <Send className="h-4 w-4 mr-2" />
                  {newMessageForm.scheduledFor ? "Schedule" : "Send"} Message
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Enhanced Filters and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
            <SelectTrigger className="w-32">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="starred">Starred</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-32">
              <SortAsc className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="time">Time</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="sender">Sender</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              updateOnlineStatuses()
              toast.success("Messages refreshed")
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Online Users Count */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="h-4 w-4" />
          <span>{onlineUsers.filter((u) => u.status === "online").length} online</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enhanced Messages List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-[#2d682d] flex items-center gap-2">
                  Messages
                  <Badge variant="outline">{filteredConversations.length}</Badge>
                </CardTitle>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search messages, tags, mentions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-96">
                <div className="space-y-2 p-4">
                  {/* Typing Indicators */}
                  {typingIndicators.map((indicator) => (
                    <div key={indicator.userId} className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="flex items-center gap-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                        </div>
                        <span className="text-sm text-blue-600">{indicator.userName} is typing...</span>
                      </div>
                    </div>
                  ))}

                  {filteredConversations.map((conversation) => {
                    const lastMessage = conversation.lastMessage
                    const isSelected = selectedConversation === conversation.id
                    const hasUnread = conversation.unreadCount > 0
                    const hasAttachments = conversation.messages.some(
                      (msg) => msg.attachments && msg.attachments.length > 0,
                    )
                    const statusLabel =
                      lastMessage.status === "scheduled"
                        ? `Scheduled for ${(lastMessage.scheduledFor ?? lastMessage.timestamp).toLocaleString()}`
                        : lastMessage.timestamp.toLocaleString()

                    return (
                      <div
                        key={conversation.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? "bg-[#2d682d]/10 border-[#2d682d] shadow-md"
                            : "hover:bg-gray-50 hover:shadow-sm"
                        } ${hasUnread ? "bg-blue-50 border-blue-200 shadow-sm" : ""} ${
                          lastMessage.priority === "urgent"
                            ? "border-l-4 border-l-red-500"
                            : lastMessage.priority === "high"
                              ? "border-l-4 border-l-orange-500"
                              : ""
                        }`}
                        onClick={() => {
                          setSelectedConversation(conversation.id)
                          if (conversation.unreadCount > 0) {
                            markConversationAsRead(conversation.id)
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-[#2d682d] text-white text-xs">
                                {conversation.displayName
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            {getStatusIcon(getUserOnlineStatus(conversation.primaryParticipant.id))}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-medium truncate">{conversation.displayName}</p>
                              <div className="flex items-center gap-1">
                                {conversation.starred && <Star className="h-3 w-3 text-yellow-500 fill-current" />}
                                {conversation.highestPriority !== "normal" && (
                                  <Badge size="sm" className={getPriorityColor(conversation.highestPriority)}>
                                    {conversation.highestPriority}
                                  </Badge>
                                )}
                                {hasUnread && (
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                    {conversation.unreadCount}
                                  </Badge>
                                )}
                                <Clock className="h-3 w-3 text-gray-400" />
                              </div>
                            </div>

                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={getRoleColor(conversation.displayRole)} variant="secondary">
                                {conversation.displayRole === "group" ? "Group" : conversation.displayRole}
                              </Badge>
                              {hasAttachments && <Paperclip className="h-3 w-3 text-gray-400" />}
                              {lastMessage.reactions.length > 0 && (
                                <div className="flex -space-x-1">
                                  {lastMessage.reactions.slice(0, 3).map((reaction, index) => (
                                    <span key={index} className="text-xs bg-white rounded-full px-1 border">
                                      {reaction.emoji}
                                    </span>
                                  ))}
                                  {lastMessage.reactions.length > 3 && (
                                    <span className="text-xs text-gray-500">
                                      +{lastMessage.reactions.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <p className="text-sm font-medium text-gray-900 truncate">{lastMessage.subject}</p>
                            <p className="text-xs text-gray-500 truncate">{lastMessage.content}</p>

                            {(lastMessage.tags.length > 0 || lastMessage.mentions.length > 0) && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {lastMessage.tags.slice(0, 2).map((tag, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    #{tag}
                                  </Badge>
                                ))}
                                {lastMessage.mentions.slice(0, 1).map((mention, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    @{mention}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center justify-between mt-1">
                              <p className="text-xs text-gray-400">{statusLabel}</p>
                              <div className="flex items-center gap-1">
                                {lastMessage.delivered &&
                                  lastMessage.senderId === currentUser.id &&
                                  (lastMessage.read ? (
                                    <CheckCheck className="h-3 w-3 text-blue-500" />
                                  ) : (
                                    <CheckCircle2 className="h-3 w-3 text-gray-400" />
                                  ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {filteredConversations.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      <p>No messages found</p>
                      <p className="text-xs">Try adjusting your filters</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Message Detail */}
        <div className="lg:col-span-2">
          {activeConversation ? (
            <Card className="h-full flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-[#2d682d] text-white">
                          {activeConversation.displayName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      {getStatusIcon(getUserOnlineStatus(activeConversation.primaryParticipant.id))}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{activeConversation.displayName}</h3>
                        <Badge className={getRoleColor(activeConversation.displayRole)} variant="secondary">
                          {activeConversation.displayRole === "group"
                            ? "Group"
                            : activeConversation.displayRole}
                        </Badge>
                        {activeConversation.highestPriority !== "normal" && (
                          <Badge className={getPriorityColor(activeConversation.highestPriority)}>
                            {activeConversation.highestPriority}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Last message {activeConversation.lastMessage.timestamp.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => toggleConversationStar(activeConversation.id)}>
                      <Star
                        className={`h-4 w-4 ${activeConversation.starred ? "text-yellow-500 fill-current" : ""}`}
                      />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setReplyingTo(activeConversation.lastMessage)}
                    >
                      <Reply className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Forward className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleConversationArchive(activeConversation.id)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto pr-1">
                  <div className="space-y-4">
                    {activeConversation.messages.map((message) => {
                      const isOwnMessage = message.senderId === currentUser.id
                      const messageTimestamp =
                        message.status === "scheduled" && message.scheduledFor
                          ? message.scheduledFor
                          : message.timestamp

                      return (
                        <div key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                          <div className={`flex max-w-2xl gap-3 ${isOwnMessage ? "flex-row-reverse text-right" : ""}`}>
                            <Avatar className="h-8 w-8 mt-1">
                              <AvatarFallback className="bg-[#2d682d] text-white text-xs">
                                {(isOwnMessage ? currentUser.name : message.senderName)
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-2">
                              <div
                                className={`rounded-lg border p-3 ${
                                  isOwnMessage ? "bg-[#2d682d]/10 border-[#2d682d]/30" : "bg-white"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className={`flex items-center gap-2 ${isOwnMessage ? "justify-end" : ""}`}>
                                    <span className="text-sm font-semibold">
                                      {isOwnMessage ? "You" : message.senderName}
                                    </span>
                                    <Badge className={getRoleColor(message.senderRole)} variant="secondary">
                                      {message.senderRole}
                                    </Badge>
                                    {message.priority !== "normal" && (
                                      <Badge className={getPriorityColor(message.priority)}>{message.priority}</Badge>
                                    )}
                                    {message.status === "scheduled" && (
                                      <Badge variant="outline" className="text-xs">
                                        Scheduled
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-400">{messageTimestamp.toLocaleString()}</span>
                                </div>

                                <p className={`text-sm font-semibold text-gray-900 mt-2 ${isOwnMessage ? "text-right" : ""}`}>
                                  {message.subject}
                                </p>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                  {message.content.split(/(@\w+|#\w+)/g).map((part, index) => {
                                    if (part.startsWith("@")) {
                                      return (
                                        <span key={index} className="text-blue-600 font-medium bg-blue-50 px-1 rounded">
                                          {part}
                                        </span>
                                      )
                                    }
                                    if (part.startsWith("#")) {
                                      return (
                                        <span key={index} className="text-green-600 font-medium bg-green-50 px-1 rounded">
                                          {part}
                                        </span>
                                      )
                                    }
                                    return <span key={index}>{part}</span>
                                  })}
                                </p>

                                {(message.tags.length > 0 || message.mentions.length > 0) && (
                                  <div className={`flex flex-wrap gap-1 mt-2 ${isOwnMessage ? "justify-end" : ""}`}>
                                    {message.tags.map((tag, index) => (
                                      <Badge key={`tag-${message.id}-${index}`} variant="outline" className="text-xs">
                                        #{tag}
                                      </Badge>
                                    ))}
                                    {message.mentions.map((mention, index) => (
                                      <Badge
                                        key={`mention-${message.id}-${index}`}
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        @{mention}
                                      </Badge>
                                    ))}
                                  </div>
                                )}

                                {message.attachments && message.attachments.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    {message.attachments.map((attachment, index) => (
                                      <div
                                        key={`${message.id}-attachment-${index}`}
                                        className={`flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2 ${
                                          isOwnMessage ? "flex-row-reverse text-right" : ""
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          {attachment.thumbnail ? (
                                            <img
                                              src={attachment.thumbnail || "/placeholder.svg"}
                                              alt={attachment.name}
                                              className="w-10 h-10 object-cover rounded"
                                            />
                                          ) : (
                                            getFileIcon(attachment.type)
                                          )}
                                          <div className="text-left">
                                            <p className="text-sm font-medium truncate max-w-40">{attachment.name}</p>
                                            <p className="text-xs text-gray-500">{attachment.size}</p>
                                          </div>
                                        </div>
                                        <div className="flex gap-1">
                                          <Button size="sm" variant="outline">
                                            <Eye className="h-4 w-4" />
                                          </Button>
                                          <Button size="sm" variant="outline">
                                            <Download className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div
                                  className={`flex items-center justify-between mt-3 text-xs text-gray-500 ${
                                    isOwnMessage ? "flex-row-reverse" : ""
                                  }`}
                                >
                                  <div className="flex items-center gap-1">
                                    {message.delivered &&
                                      message.senderId === currentUser.id &&
                                      (message.read ? (
                                        <CheckCheck className="h-3 w-3 text-blue-500" />
                                      ) : (
                                        <CheckCircle2 className="h-3 w-3 text-gray-400" />
                                      ))}
                                  </div>
                                  {message.reactions.length > 0 && (
                                    <div className="flex items-center gap-1">
                                      {message.reactions.map((reaction, index) => (
                                        <span
                                          key={`${message.id}-reaction-${index}`}
                                          className="text-xs bg-gray-100 rounded-full px-2 py-1"
                                        >
                                          {reaction.emoji}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div
                                className={`flex flex-wrap items-center gap-1 text-xs text-gray-500 ${
                                  isOwnMessage ? "justify-end" : ""
                                }`}
                              >
                                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setReplyingTo(message)}>
                                  <Reply className="h-3 w-3 mr-1" />
                                  Reply
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => toggleStar(message.id)}>
                                  <Star
                                    className={`h-3 w-3 mr-1 ${message.starred ? "text-yellow-500 fill-current" : ""}`}
                                  />
                                  Star
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => toggleArchive(message.id)}>
                                  <Archive className="h-3 w-3 mr-1" />
                                  Archive
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => deleteMessage(message.id)}>
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t mt-4">
                  <span className="text-sm text-gray-500">Quick reactions:</span>
                  {emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => addReaction(activeConversation.lastMessage.id, emoji)}
                      className="text-lg hover:bg-gray-100 rounded p-1 transition-colors"
                      title={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <div className="border-t pt-4 mt-4">
                  {replyingTo && (
                    <div className="mb-3 p-2 bg-blue-50 rounded-lg flex items-center justify-between">
                      <span className="text-sm text-blue-600">Replying to: {replyingTo.subject}</span>
                      <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>
                        ×
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Textarea
                        placeholder="Type your reply... Use @username to mention or #tag"
                        value={newMessage}
                        onChange={(e) => {
                          setNewMessage(e.target.value)
                          handleTyping()
                        }}
                        rows={3}
                        className="resize-none"
                      />
                      <div className="text-xs text-gray-500 mt-1">{newMessage.length}/1000 characters</div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline" title="Attach file">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" title="Add emoji">
                        <Smile className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" title="Voice message">
                        <Mic className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || !selectedConversation}
                        className="bg-[#2d682d] hover:bg-[#2d682d]/90"
                        title="Send message"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full">
              <CardContent className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No message selected</h3>
                  <p className="text-gray-500 mb-4">Choose a message from the list to view its contents</p>
                  <Button onClick={() => setShowNewMessageDialog(true)} className="bg-[#2d682d] hover:bg-[#2d682d]/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Start New Conversation
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
