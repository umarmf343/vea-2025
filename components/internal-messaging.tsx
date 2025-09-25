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

@@ -1053,133 +1055,138 @@ export function InternalMessaging({ currentUser, participants }: InternalMessagi
          )}
        </div>
      </CardHeader>
      <CardContent className="relative z-10 space-y-8 px-8 pb-8 pt-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,260px)_1fr]">
          <div className="flex flex-col gap-5">
            <div className="space-y-2">
              <Label
                htmlFor="search"
                className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-900/70"
              >
                Conversations
              </Label>
              <Input
                id="search"
                placeholder="Search people or roles"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-11 rounded-2xl border border-white/70 bg-white/80 px-4 text-sm text-emerald-950 shadow-inner transition focus:border-emerald-400/60 focus-visible:ring-emerald-500/30"
              />
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_28px_80px_-48px_rgba(15,118,110,0.65)] backdrop-blur-sm">
              <ScrollArea className="h-[360px] pr-2">
                <div className="flex flex-col divide-y divide-emerald-100/70">
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
                          "flex w-full flex-col gap-2 rounded-2xl border border-transparent bg-white/50 px-4 py-3 text-left transition-all duration-200 hover:-translate-y-[1px] hover:border-emerald-200 hover:bg-emerald-50/80 hover:shadow-sm",
                          activeConversation === conversation.id &&
                            "border-emerald-300/70 bg-emerald-50 shadow-[0_16px_50px_-35px_rgba(16,185,129,0.9)]",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <p className="truncate text-sm font-semibold text-emerald-950">{title}</p>
                            <p className="truncate text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{subtitle}</p>
                          </div>
                          {conversation.unreadCount > 0 && (
                            <Badge
                              variant="secondary"
                              className="rounded-full border border-emerald-100 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700"
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
            <div className="rounded-3xl border border-white/70 bg-white/70 shadow-[0_28px_80px_-48px_rgba(15,118,110,0.65)] backdrop-blur-sm">
              {hasComposerParticipants ? (
                <>
                  <div className="flex items-center justify-between border-b border-white/60 px-6 py-4">
                    <div>
                      <p className="text-base font-semibold text-emerald-950">
                        {composerParticipants.map((participant) => participant.name).join(", ")}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                        {composerParticipants.map((participant) => participant.role).join(", ")}
                      </p>
                    </div>
                    {activeTypingIndicators.length > 0 && (
                      <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/70 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-700">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {activeTypingIndicators[0].senderName} is typing…
                      </div>
                    )}
                  </div>
                  <ScrollArea className="h-[280px] px-6 py-4">
                    <div className="flex flex-col gap-4">
                      {activeConversationMessages.length === 0 && (
                        <div className="space-y-1 text-center text-sm text-emerald-900/70">
                          <p className="text-base font-semibold">No messages yet</p>
                          <p className="text-sm">Use the composer below to start chatting.</p>
                        </div>
                      )}
                      {activeConversationMessages.map((message) => renderMessageBubble(message))}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="px-6 py-12 text-center text-emerald-900/70">
                  <p className="text-base font-semibold">Select a recipient</p>
                  <p className="text-sm">Start a new conversation</p>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[0_28px_80px_-48px_rgba(15,118,110,0.65)] backdrop-blur-sm">
              <div className="grid gap-5 md:grid-cols-[minmax(0,240px)_1fr] md:items-start">
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-900/70">Send to</Label>
                  <Select
                    value={recipientId || composerParticipants[0]?.id || ""}
                    onValueChange={(value) => {
                      setRecipientId(value)
                      setActiveConversation(null)
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-2xl border border-white/70 bg-white/80 text-sm text-emerald-950 shadow-inner transition focus:ring-emerald-500/20">
                      <SelectValue placeholder="Choose recipient" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border border-white/70 bg-white/80 shadow-xl">
                      {directory.map((participant) => (
                        <SelectItem key={participant.id} value={participant.id}>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-emerald-950">{participant.name}</span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "rounded-full border border-white/60 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-700",