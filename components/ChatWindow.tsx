"use client"

import { useEffect, useState, useRef, useMemo, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Loader2, Search, EllipsisVertical, Smile, Paperclip, Send, Mic, ArrowLeft, CheckCircle, X, Forward, Bookmark, Phone, Video } from "lucide-react"
import ChatMessage from "./ChatMessage"
import FileMessage from "./FileMessage"
import CallModal from "./CallModal"
import { AnimatePresence, motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { useSocket } from "@/app/ClientProviders"
import UserProfilePanel from "./UserProfilePanel"
import { useNotificationSound } from "@/hooks/useNotificationSound"
import { VerifiedBadge } from "./VerifiedBadge"

const ACCENT = "#7e85e1"

interface Message {
  id: string | number
  content: string
  createdAt: string
  conversationId?: string | number
  isRead?: boolean
  replyTo?: { id: number; content: string; sender: { id: number; username: string; avatar?: string } } | null
  forwardFromId?: number | null
  fileUrl?: string | null
  fileName?: string | null
  fileSize?: number | null
  fileType?: string | null
  voiceUrl?: string | null
  voiceDuration?: number | null
  sender: { id: string | number; username: string; avatar?: string }
}

interface IncomingCall {
  callId: number
  callType: "audio" | "video"
  initiatorId: string
  initiatorName: string
  initiatorAvatar?: string
}

interface OutgoingCall {
  callId: number
  callType: "audio" | "video"
  receiverId: string
  receiverName: string
  receiverAvatar?: string
}

interface ChatWindowProps {
  conversationId: string
  realConversationId?: string
  onBack?: () => void
  initialMessages?: Message[]
  onNewMessage?: (message: Message) => void
  conversation?: any
}

export default function ChatWindow({ conversationId, realConversationId, onBack, initialMessages, onNewMessage, conversation }: ChatWindowProps) {
  const apiId = realConversationId ?? conversationId
  const { data: session } = useSession()
  const { t } = useTranslation()
  const { socket } = useSocket()

  const [messages, setMessages] = useState<Message[]>(initialMessages || [])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const stableKeys = useRef<Map<string, string>>(new Map())
  const newMsgIds = useRef<Set<string>>(new Set())

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const isInitialLoad = useRef(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [otherUserOnline, setOtherUserOnline] = useState(false)
  const [otherUserLastSeen, setOtherUserLastSeen] = useState<string | null>(null)
  const [otherUserAvatar, setOtherUserAvatar] = useState<string | null>(null)
  const [isOtherTyping, setIsOtherTyping] = useState(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingEmitRef = useRef<number>(0)

  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; senderName: string } | null>(null)
  const [forwardingMsg, setForwardingMsg] = useState<{ id: string; content: string } | null>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [forwardSearch, setForwardSearch] = useState("")

  // ── Voice recording ──────────────────────────────────────────
  const { play: playSound } = useNotificationSound()

  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Calls ────────────────────────────────────────────────────
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCall | null>(null)
  const showCallModal = !!(incomingCall || outgoingCall)

  const convType: string = conversation?.type || "private"
  const isSavedChat = convType === "saved"
  const isSystemChat = convType === "system"
  const isSpecialChat = isSavedChat || isSystemChat

  const otherUser = useMemo(() => {
    if (isSpecialChat || !conversation?.participants) return null
    return conversation.participants.find((p: any) => p.userId?.toString() !== session?.user?.id?.toString())?.user
  }, [conversation, session, isSpecialChat])

  const participantIds = useMemo(() => {
    if (!conversation?.participants) return []
    return conversation.participants.map((p: any) => p.userId)
  }, [conversation])

  useEffect(() => { if (otherUser?.avatar) setOtherUserAvatar(otherUser.avatar) }, [otherUser])

  // Online status
  useEffect(() => {
    if (!socket || !otherUser?.id) return
    socket.emit("check-online", otherUser.id)
    const handleUserStatus = (data: { userId: string; online: boolean; lastSeen?: string }) => {
      if (data.userId?.toString() === otherUser.id?.toString()) {
        setOtherUserOnline(data.online)
        if (!data.online && data.lastSeen) setOtherUserLastSeen(data.lastSeen)
        else setOtherUserLastSeen(null)
      }
    }
    socket.on("user-status", handleUserStatus)
    return () => { socket.off("user-status", handleUserStatus) }
  }, [socket, otherUser?.id])

  // Avatar updates
  useEffect(() => {
    if (!socket) return
    const handleAvatarUpdate = (data: { userId: number; avatar: string }) => {
      setMessages(prev => prev.map(msg =>
        msg.sender.id?.toString() === data.userId?.toString()
          ? { ...msg, sender: { ...msg.sender, avatar: data.avatar } } : msg
      ))
      if (otherUser?.id?.toString() === data.userId?.toString()) setOtherUserAvatar(data.avatar)
    }
    socket.on("user-avatar-updated", handleAvatarUpdate)
    return () => { socket.off("user-avatar-updated", handleAvatarUpdate) }
  }, [socket, otherUser?.id])

  // Load messages
  useEffect(() => {
    setLoading(true)
    isInitialLoad.current = true
    fetch(`/api/messages?conversationId=${apiId}`)
      .then(r => r.json())
      .then(data => {
        setMessages(Array.isArray(data) ? data : [])
        setLoading(false)
        // Прокручиваем в низ после загрузки
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "instant" }), 50)
      })
      .catch(() => { setMessages([]); setLoading(false) })
    fetch("/api/conversations")
      .then(r => r.json())
      .then((data: any) => {
        const convs = Array.isArray(data) ? data : []
        setConversations(convs)
        const conv = convs.find((c: any) => c.id?.toString() === apiId.toString() || c._realId?.toString() === apiId.toString())
        setInput(conv?.drafts?.[0]?.text || "")
        isInitialLoad.current = false
      })
      .catch(() => { isInitialLoad.current = false })
  }, [apiId])

  // Mark messages as read when chat opens
  useEffect(() => {
    if (loading || !session?.user?.id) return
    fetch("/api/messages/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: apiId })
    }).then(r => r.json()).then(data => {
      if (data.count > 0) {
        setMessages(prev => prev.map(m => ({
          ...m,
          isRead: m.sender.id?.toString() !== session.user!.id?.toString() ? true : m.isRead
        })))
        socket?.emit("messages-read", {
          conversationId: String(apiId),
          readByUserId: session.user.id,
          messageIds: data.messageIds,
          participantIds,
        })
      }
    }).catch(() => {})
  }, [loading, apiId, session?.user?.id])

  // Draft save
  useEffect(() => {
    if (isInitialLoad.current) return
    const timer = setTimeout(async () => {
      try {
        await fetch("/api/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: apiId, text: input }) })
      } catch {}
    }, 500)
    return () => clearTimeout(timer)
  }, [input, apiId])

  // Socket listeners
  useEffect(() => {
    if (!socket) return
    const roomId = String(apiId)
    socket.emit("join-conversation", roomId)

    const handleNewMessage = (message: Message) => {
      const msgConvId = message.conversationId?.toString()
      if (msgConvId && msgConvId !== roomId) return
      setMessages(prev => {
        if (prev.some(m => m.id?.toString() === message.id?.toString())) return prev
        newMsgIds.current.add(message.id.toString())
        return [...prev, message]
      })
      // Play sound for incoming messages
      if (message.sender.id?.toString() !== session?.user?.id?.toString()) {
        playSound()
      }
      // Auto-mark as read if chat is visible
      if (message.sender.id?.toString() !== session?.user?.id?.toString()) {
        fetch("/api/messages/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: apiId })
        }).then(r => r.json()).then(data => {
          if (data.count > 0) {
            socket.emit("messages-read", {
              conversationId: roomId,
              readByUserId: session?.user?.id,
              messageIds: data.messageIds,
              participantIds,
            })
          }
        }).catch(() => {})
      }
    }

    const handleMessageDeleted = (id: string) => setMessages(prev => prev.filter(m => m.id?.toString() !== String(id)))
    const handleMessageEdited = (updated: Message) => setMessages(prev => prev.map(m => m.id?.toString() === updated.id?.toString() ? updated : m))

    const handleMessagesRead = (data: { readByUserId: string; messageIds: number[] }) => {
      if (data.readByUserId?.toString() === session?.user?.id?.toString()) return
      setMessages(prev => prev.map(m =>
        data.messageIds?.includes(Number(m.id)) ? { ...m, isRead: true } : m
      ))
    }

    const handleTyping = (data: { userId: string; conversationId: string }) => {
      if (data.conversationId !== roomId) return
      if (data.userId?.toString() === session?.user?.id?.toString()) return
      setIsOtherTyping(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => setIsOtherTyping(false), 3000)
    }
    const handleStopTyping = (data: { userId: string; conversationId: string }) => {
      if (data.conversationId !== roomId) return
      if (data.userId?.toString() === session?.user?.id?.toString()) return
      setIsOtherTyping(false)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }

    socket.on("new-message", handleNewMessage)
    socket.on("message-deleted", handleMessageDeleted)
    socket.on("message-edited", handleMessageEdited)
    socket.on("messages-read", handleMessagesRead)
    socket.on("user-typing", handleTyping)
    socket.on("user-stop-typing", handleStopTyping)
    return () => {
      socket.off("new-message", handleNewMessage)
      socket.off("message-deleted", handleMessageDeleted)
      socket.off("message-edited", handleMessageEdited)
      socket.off("messages-read", handleMessagesRead)
      socket.off("user-typing", handleTyping)
      socket.off("user-stop-typing", handleStopTyping)
    }
  }, [apiId, socket, session?.user?.id])

  // Incoming call listener
  useEffect(() => {
    if (!socket) return
    const handleIncoming = (data: IncomingCall) => setIncomingCall(data)
    socket.on("call-incoming", handleIncoming)
    return () => { socket.off("call-incoming", handleIncoming) }
  }, [socket])

  // Auto scroll
  useEffect(() => {
    if (loading) return
    const container = scrollContainerRef.current
    if (!container) return
    const dist = container.scrollHeight - container.scrollTop - container.clientHeight
    if (dist < 250) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 200)
  }, [])

  const scrollToBottom = useCallback(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), [])

  const scrollToMessage = useCallback((msgId: string) => {
    const el = messageRefs.current[msgId]
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      el.style.transition = "background 0.3s"
      el.style.background = "rgba(126,133,225,0.18)"
      setTimeout(() => { el.style.background = "" }, 1200)
    }
  }, [])

  const handleDeleteMessage = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/messages?id=${id}`, { method: "DELETE" })
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id?.toString() !== id))
        socket?.emit("delete-message", { id, conversationId: String(apiId) })
      }
    } catch {}
  }, [socket, apiId])

  const handleStartEdit = useCallback((id: string, content: string) => {
    setEditingMessageId(id); setReplyingTo(null); setInput(content)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const cancelEdit = useCallback(() => { setEditingMessageId(null); setInput("") }, [])
  const handleMenuOpen = useCallback((id: string, x: number, y: number) => { setOpenMenuId(id); setMenuPos({ x, y }) }, [])
  const handleMenuClose = useCallback(() => setOpenMenuId(null), [])
  const handleReply = useCallback((msg: { id: string; content: string; senderName: string }) => {
    setReplyingTo(msg); setEditingMessageId(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])
  const cancelReply = useCallback(() => setReplyingTo(null), [])
  const handleForwardOpen = useCallback((msg: { id: string; content: string }) => { setForwardingMsg(msg); setForwardSearch("") }, [])

  // ── Voice recording ──────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      // Запрашиваем разрешение явно
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })

      // Определяем поддерживаемый формат на этом устройстве
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
        "audio/mp4",
        "",
      ]
      const mimeType = mimeTypes.find(t => !t || MediaRecorder.isTypeSupported(t)) ?? ""

      const options: MediaRecorderOptions = mimeType ? { mimeType } : {}
      const mr = new MediaRecorder(stream, options)
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.start()
      mediaRecorderRef.current = mr
      setIsRecording(true)
      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    } catch (err: any) {
      console.error("Microphone error:", err)
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        alert("Нет доступа к микрофону. Разрешите доступ в настройках браузера/телефона.")
      } else if (err?.name === "NotFoundError") {
        alert("Микрофон не найден на устройстве.")
      } else {
        alert("Ошибка микрофона: " + (err?.message || err))
      }
    }
  }, [])

  const cancelRecording = useCallback(() => {
    mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop())
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    setIsRecording(false)
    setRecordingSeconds(0)
    audioChunksRef.current = []
  }, [])

  const sendVoiceMessage = useCallback(async () => {
    if (!mediaRecorderRef.current || !session?.user) return
    const mr = mediaRecorderRef.current
    const duration = recordingSeconds

    mr.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" })
      mr.stream.getTracks().forEach(t => t.stop())
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      setIsRecording(false)
      setRecordingSeconds(0)

      const formData = new FormData()
      formData.append("file", blob, `voice-${Date.now()}.webm`)
      setIsUploading(true)
      try {
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
        if (!uploadRes.ok) return
        const uploaded = await uploadRes.json()

        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: "",
            conversationId: apiId,
            voiceUrl: uploaded.url,
            voiceDuration: duration,
          })
        })
        if (res.ok) {
          const saved = await res.json()
          setMessages(prev => [...prev, saved])
          socket?.emit("send-message", { ...saved, conversationId: String(apiId), participantIds })
        }
      } finally { setIsUploading(false) }
    }
    mr.stop()
    mediaRecorderRef.current = null
  }, [mediaRecorderRef, recordingSeconds, session, apiId, socket, participantIds])

  // ── Calls ────────────────────────────────────────────────────
  const startCall = useCallback(async (type: "audio" | "video") => {
    if (!otherUser?.id || !session?.user) return
    const res = await fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: apiId, receiverId: otherUser.id, type })
    })
    if (!res.ok) return
    const call = await res.json()
    socket?.emit("call-invite", {
      callId: call.id,
      callType: type,
      conversationId: String(apiId),
      receiverId: String(otherUser.id),
      initiatorId: String(session.user.id),
      initiatorName: session.user.name || session.user.email || "User",
      initiatorAvatar: session.user.image || undefined,
    })
    setOutgoingCall({
      callId: call.id,
      callType: type,
      receiverId: String(otherUser.id),
      receiverName: otherUser.username || "",
      receiverAvatar: otherUserAvatar || otherUser.avatar || undefined,
    })
  }, [otherUser, session, apiId, socket, otherUserAvatar])

  // ── File upload ──────────────────────────────────────────────
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !session?.user) return
    if (file.size > 50 * 1024 * 1024) { setUploadError(t('file_too_large')); return }

    setIsUploading(true)
    setUploadError("")
    try {
      const formData = new FormData()
      formData.append("file", file)
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
      if (!uploadRes.ok) { setUploadError(t('upload_error')); return }
      const uploaded = await uploadRes.json()

      const tempId = "temp-file-" + Date.now()
      const optimistic: Message = {
        id: tempId, content: input || "", conversationId: String(apiId),
        createdAt: new Date().toISOString(),
        fileUrl: uploaded.url, fileName: uploaded.name, fileSize: uploaded.size, fileType: uploaded.type,
        sender: { id: session.user.id, username: session.user.name || "Me", avatar: session.user.image || undefined }
      }
      stableKeys.current.set(tempId, tempId)
      setMessages(prev => [...prev, optimistic])

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: input || "",
          conversationId: apiId,
          fileUrl: uploaded.url, fileName: uploaded.name, fileSize: uploaded.size, fileType: uploaded.type,
        })
      })
      if (res.ok) {
        const saved = await res.json()
        const sk = stableKeys.current.get(tempId) || tempId
        stableKeys.current.set(saved.id.toString(), sk)
        stableKeys.current.delete(tempId)
        setMessages(prev => prev.map(m => m.id === tempId ? { ...saved } : m))
        socket?.emit("send-message", { ...saved, conversationId: String(apiId), participantIds })
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId))
      }
    } catch { setUploadError(t('upload_error')) }
    finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [session, apiId, socket, participantIds, input, t])

  // ── Send text message ────────────────────────────────────────
  const sendMessage = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || !session?.user) return

    if (editingMessageId) {
      try {
        const res = await fetch("/api/messages", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingMessageId, content: input })
        })
        if (res.ok) {
          const updated = await res.json()
          setMessages(prev => prev.map(m => m.id?.toString() === updated.id?.toString() ? updated : m))
          socket?.emit("edit-message", { ...updated, conversationId: String(apiId) })
          setEditingMessageId(null); setInput("")
        }
      } catch {}
      return
    }

    const tempId = "temp-" + Date.now()
    const optimisticMsg: Message = {
      id: tempId, content: input, conversationId: String(apiId),
      createdAt: new Date().toISOString(), isRead: false,
      replyTo: replyingTo ? { id: parseInt(replyingTo.id), content: replyingTo.content, sender: { id: parseInt(replyingTo.id), username: replyingTo.senderName } } : null,
      sender: { id: session.user.id, username: session.user.name || "Me", avatar: session.user.image || undefined }
    }
    stableKeys.current.set(tempId, tempId)
    setMessages(prev => [...prev, optimisticMsg])
    if (onNewMessage) onNewMessage(optimisticMsg)
    const currentInput = input; const currentReplyTo = replyingTo
    setInput(""); setReplyingTo(null)

    try {
      const res = await fetch("/api/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: currentInput, conversationId: apiId, replyToId: currentReplyTo ? parseInt(currentReplyTo.id) : undefined })
      })
      if (res.ok) {
        const saved = await res.json()
        const sk = stableKeys.current.get(tempId) || tempId
        stableKeys.current.set(saved.id.toString(), sk); stableKeys.current.delete(tempId)
        setMessages(prev => prev.map(m => m.id === tempId ? { ...saved } : m))
        socket?.emit("send-message", { ...saved, conversationId: String(apiId), participantIds })
        fetch(`/api/drafts?conversationId=${apiId}`, { method: "DELETE" }).catch(() => {})
      } else { setMessages(prev => prev.filter(m => m.id !== tempId)) }
    } catch { setMessages(prev => prev.filter(m => m.id !== tempId)) }
  }, [input, session, editingMessageId, apiId, socket, onNewMessage, participantIds, replyingTo])

  const handleForwardTo = useCallback(async (targetConvId: string) => {
    if (!forwardingMsg || !session?.user) return
    const res = await fetch("/api/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: forwardingMsg.content, conversationId: targetConvId, forwardFromId: parseInt(forwardingMsg.id) || null })
    })
    if (res.ok) {
      const saved = await res.json()
      if (targetConvId === conversationId) setMessages(prev => [...prev, saved])
      socket?.emit("send-message", { ...saved, conversationId: String(targetConvId), participantIds })
    }
    setForwardingMsg(null)
  }, [forwardingMsg, session, conversationId, socket, participantIds])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() }
    if (e.key === "Escape") { if (editingMessageId) cancelEdit(); if (replyingTo) cancelReply() }
  }, [sendMessage, editingMessageId, cancelEdit, replyingTo, cancelReply])

  const lastSeenText = useMemo(() => {
    if (!otherUserLastSeen) return t('last_seen')
    const d = new Date(otherUserLastSeen)
    const diff = Math.floor((Date.now() - d.getTime()) / 1000)
    if (diff < 60) return t('last_seen_just_now')
    if (diff < 3600) return `${t('last_seen')} ${Math.floor(diff / 60)}m`
    if (diff < 86400) return `${t('last_seen')} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    return `${t('last_seen')} ${d.toLocaleDateString([], { day: "numeric", month: "short" })}`
  }, [otherUserLastSeen, t])

  const filteredConvs = useMemo(() => {
    if (!forwardSearch.trim()) return conversations
    return conversations.filter(c => {
      const other = c.participants?.find((p: any) => p.userId?.toString() !== session?.user?.id?.toString())?.user
      return other?.username?.toLowerCase().includes(forwardSearch.toLowerCase())
    })
  }, [conversations, forwardSearch, session])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0e1621]">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <Loader2 className="text-[#7e85e1]" size={36} />
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div className="flex-1 flex flex-row h-full bg-[#1c242f] relative" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
      <div className="flex-1 flex flex-col h-full min-w-0 tg-bg">

        {/* ── Header ── */}
        <div
          className="px-4 flex items-center justify-between h-[63px] bg-[#1c242f] relative z-10 cursor-pointer"
          onClick={() => setShowProfile(p => !p)}
        >
          <div className="flex items-center gap-3 text-white flex-1 min-w-0">
            {onBack && (
              <motion.button onClick={e => { e.stopPropagation(); onBack() }} whileTap={{ scale: 0.88 }}
                className="md:hidden p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors shrink-0">
                <ArrowLeft size={24} />
              </motion.button>
            )}
            <motion.div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden relative text-white"
              style={{ backgroundColor: isSavedChat ? "#4e8cde" : isSystemChat ? "#7e85e1" : ACCENT }}
              whileHover={{ scale: 1.05 }}
            >
              {isSavedChat ? <Bookmark size={18} className="text-white" />
                : isSystemChat ? <img src="/logo (1).ico" alt="Vortex" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                : otherUserAvatar ? <img src={otherUserAvatar} alt="Avatar" className="w-full h-full object-cover" />
                : otherUser?.username?.[0]?.toUpperCase() || "C"}
              <AnimatePresence>
                {!isSpecialChat && otherUserOnline && (
                  <motion.div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-[#1c242f]"
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 25 }} />
                )}
              </AnimatePresence>
            </motion.div>

            <div className="min-w-0 flex-1">
              {isSystemChat ? (
                <div>
                  <div className="flex items-center gap-1">
                    <h2 className="text-[15px] font-bold text-white leading-tight">Vortex</h2>
                    <VerifiedBadge size={17} />
                  </div>
                  <p className="text-[13px] text-gray-400 leading-tight">{t('service_notifications')}</p>
                </div>
              ) : isSavedChat ? (
                <div>
                  <h2 className="text-base font-bold truncate text-white leading-tight">{t('saved_messages')}</h2>
                  <p className="text-xs text-[#4e8cde]">{t('saved_chat_subtitle')}</p>
                </div>
              ) : (
                <>
                  <h2 className="text-base font-bold truncate text-white leading-tight">{otherUser?.username || t('chat')}</h2>
                  <AnimatePresence mode="wait">
                    {isOtherTyping ? (
                      <motion.div key="typing" className="flex items-center gap-1"
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                        <span className="text-xs text-gray-400">{t('typing')}</span>
                        <span className="flex items-end gap-[2px] ml-0.5 pb-[1px]">
                          {[0, 1, 2].map(i => (
                            <motion.span key={i} className="block w-[3px] h-[3px] rounded-full bg-gray-400"
                              animate={{ y: [0, -4, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }} />
                          ))}
                        </span>
                      </motion.div>
                    ) : otherUserOnline ? (
                      <motion.div key="online" className="flex items-center gap-1"
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                        <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                        <span className="text-xs text-green-400">{t('online')}</span>
                      </motion.div>
                    ) : (
                      <motion.p key="offline" className="text-xs text-gray-500"
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                        {lastSeenText}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          </div>

          {/* Header right buttons */}
          <div className="flex gap-1 text-gray-400 shrink-0" onClick={e => e.stopPropagation()}>
            {!isSpecialChat && (
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => startCall("audio")}
                className="hover:text-white transition-colors p-2 rounded-full hover:bg-white/5"
                title="Аудиозвонок"
              >
                <Phone size={20} />
              </motion.button>
            )}
            {/* Поиск — скрываем на узких экранах */}
            <motion.button whileTap={{ scale: 0.88 }} className="hidden sm:flex hover:text-white transition-colors p-2 rounded-full hover:bg-white/5"><Search size={20} /></motion.button>
            <motion.button whileTap={{ scale: 0.88 }} className="hover:text-white transition-colors p-2 rounded-full hover:bg-white/5"><EllipsisVertical size={20} /></motion.button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 hide-scrollbar relative" onScroll={handleScroll}>
          <div className="flex justify-center mb-4">
            <motion.span initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-black/20 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">{t('today')}</motion.span>
          </div>

          {openMenuId && (
            <div className="fixed inset-0 z-[99]" onClick={handleMenuClose} onContextMenu={e => { e.preventDefault(); handleMenuClose() }} />
          )}

          <div className="flex flex-col w-full max-w-[850px] mx-auto">
            {isSystemChat && messages.map((msg, idx) => (
              <motion.div key={msg.id.toString()} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.22 }} className="mb-3 mx-auto w-full max-w-[560px]">
                <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ backgroundColor: "#1a2332" }}>
                  <div className="h-[3px] w-full" style={{ background: "linear-gradient(90deg, #e15a7e, #7e85e1)" }} />
                  <div className="px-4 py-3 flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 overflow-hidden" style={{ backgroundColor: "#7e85e1" }}>
                      <img src="/logo (1).ico" alt="Vortex" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[13px] font-bold text-white">Vortex</span>
                        <VerifiedBadge size={14} />
                        <span className="text-[11px] text-gray-600">{new Date(msg.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="text-[14px] text-gray-300 whitespace-pre-line leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {!isSystemChat && messages.map((msg, idx) => {
              const isSender = msg.sender.id?.toString() === session?.user?.id?.toString()
              const isFirstInGroup = idx === 0 || messages[idx - 1]?.sender.id?.toString() !== msg.sender.id?.toString()
              const isLastInGroup = idx === messages.length - 1 || messages[idx + 1]?.sender.id?.toString() !== msg.sender.id?.toString()
              const msgIdStr = msg.id.toString()
              const isNew = msgIdStr.startsWith("temp-") || newMsgIds.current.has(msgIdStr)
              const sk = stableKeys.current.get(msgIdStr) || msgIdStr

              return (
                <div key={sk} ref={el => { messageRefs.current[msg.id.toString()] = el }} className="rounded-lg">
                  {msg.fileUrl ? (
                    <div className={`flex mb-1 ${isSender ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] ${isSender ? "items-end" : "items-start"} flex flex-col`}>
                        <FileMessage
                          fileUrl={msg.fileUrl}
                          fileName={msg.fileName || "file"}
                          fileSize={msg.fileSize || 0}
                          fileType={msg.fileType || "application/octet-stream"}
                          isSender={isSender}
                          caption={msg.content || undefined}
                          timeStr={new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          isRead={!!msg.isRead}
                          senderName={msg.sender.username}
                          sentAt={new Date(msg.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          onDelete={() => handleDeleteMessage(msg.id.toString())}
                          onForward={() => handleForwardOpen({ id: msg.id.toString(), content: msg.content })}
                          onReply={() => handleReply({ id: msg.id.toString(), content: msg.content, senderName: msg.sender.username })}
                        />
                      </div>
                    </div>
                  ) : (
                    <ChatMessage
                      id={msg.id} content={msg.content} createdAt={msg.createdAt}
                      isSender={isSender} isFirstInGroup={isFirstInGroup} isLastInGroup={isLastInGroup}
                      hasAbove={!isFirstInGroup} replyTo={msg.replyTo} isForwarded={!!msg.forwardFromId}
                      isRead={msg.isRead} voiceUrl={msg.voiceUrl} voiceDuration={msg.voiceDuration}
                      senderName={msg.sender.username} senderId={msg.sender.id} isTemp={isNew}
                      onDelete={handleDeleteMessage} onEdit={handleStartEdit}
                      onReply={handleReply} onForward={handleForwardOpen} onScrollToMessage={scrollToMessage}
                      openMenuId={openMenuId} onMenuOpen={handleMenuOpen} onMenuClose={handleMenuClose} menuPos={menuPos}
                    />
                  )}
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          <AnimatePresence>
            {showScrollButton && (
              <motion.div className="absolute right-[20px] bottom-[20px] z-50"
                initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                <motion.button onClick={scrollToBottom} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  className="w-[42px] h-[42px] rounded-full flex items-center justify-center shadow-lg text-white" style={{ backgroundColor: ACCENT }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10l5 5 5-5" /></svg>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── System chat footer ── */}
        {isSystemChat && (
          <div className="px-4 pb-6 pt-3 flex justify-center">
            <div className="flex items-center gap-2.5 bg-[#1a2332] border border-white/5 rounded-2xl px-4 py-3 max-w-[600px] w-full">
              <VerifiedBadge size={15} />
              <p className="text-[13px] text-gray-500">{t('service_channel_notice')}</p>
            </div>
          </div>
        )}

        {/* ── Input area ── */}
        {!isSystemChat && (
          <div className="px-3 pb-4 pt-2">
            <AnimatePresence>
              {uploadError && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="px-3 py-1.5 text-red-400 text-[12px] flex items-center gap-2 mb-1">
                  <X size={12} /> {uploadError}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {(editingMessageId || replyingTo) && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  style={{ backgroundColor: "var(--input-bg)", borderRadius: "0.9375rem 0.9375rem 0 0" }}
                  className="overflow-hidden px-3 pt-2 pb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-[3px] h-9 rounded-full shrink-0" style={{ backgroundColor: ACCENT }} />
                    <div className="flex-1 min-w-0">
                      {editingMessageId ? (
                        <><p className="text-[12px] font-semibold leading-tight" style={{ color: ACCENT }}>{t('editing_message')}</p>
                          <p className="text-[12px] text-gray-400 truncate leading-tight">{input}</p></>
                      ) : replyingTo ? (
                        <><p className="text-[12px] font-semibold leading-tight" style={{ color: ACCENT }}>{replyingTo.senderName}</p>
                          <p className="text-[12px] text-gray-400 truncate leading-tight">{replyingTo.content}</p></>
                      ) : null}
                    </div>
                    <motion.button onClick={editingMessageId ? cancelEdit : cancelReply} whileTap={{ scale: 0.88 }}
                      className="p-1 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition-colors shrink-0">
                      <X size={16} />
                    </motion.button>
                  </div>
                  <div className="mt-1 mx-1 border-t border-white/8" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Voice recording UI */}
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl"
                  style={{ backgroundColor: "var(--input-bg)" }}
                >
                  <motion.div className="w-3 h-3 rounded-full bg-red-500"
                    animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                  <span className="text-white text-[14px] flex-1">
                    {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
                  </span>
                  <motion.button whileTap={{ scale: 0.88 }} onClick={cancelRecording}
                    className="text-gray-400 hover:text-red-400 p-1 transition-colors">
                    <X size={18} />
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main input row */}
            <div className="flex items-end gap-2">
              {/* Paperclip */}
              <div
                className="relative w-[46px] h-[46px] rounded-full shrink-0 flex items-center justify-center text-gray-400"
                style={{ backgroundColor: "var(--input-bg)" }}
              >
                {isUploading
                  ? <Loader2 size={20} className="animate-spin text-[#7e85e1]" />
                  : <Paperclip size={22} />
                }
                {!isUploading && !isRecording && (
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,audio/*,image/*,.pdf,.doc,.docx,.txt,.zip,.rar,.7z,.xls,.xlsx,.ppt,.pptx,.json,.csv"
                    onChange={handleFileSelect}
                    style={{
                      position: 'absolute', inset: 0, width: '100%', height: '100%',
                      opacity: 0, cursor: 'pointer', fontSize: 0,
                    }}
                  />
                )}
              </div>

              {/* Text input bubble */}
              <div
                style={{
                  backgroundColor: "var(--input-bg)",
                  borderTopLeftRadius: (editingMessageId || replyingTo) ? "0" : "0.9375rem",
                  borderTopRightRadius: (editingMessageId || replyingTo) ? "0" : "0.9375rem",
                  borderBottomLeftRadius: "0.9375rem",
                  borderBottomRightRadius: "0",
                }}
                className="relative flex items-center flex-1 min-w-0 px-2 py-1 min-h-[46px] shadow-lg"
              >
                <motion.button type="button" whileTap={{ scale: 0.85, rotate: 15 }} className="text-gray-400 hover:text-white transition-colors shrink-0 p-1">
                  <Smile size={24} />
                </motion.button>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={isRecording ? "Запись голоса..." : t('message_placeholder')}
                  value={input}
                  disabled={isRecording}
                  onChange={e => {
                    setInput(e.target.value)
                    const now = Date.now()
                    if (socket && session?.user?.id && now - lastTypingEmitRef.current > 1500) {
                      lastTypingEmitRef.current = now
                      socket.emit("typing", { conversationId: String(apiId), userId: session.user.id })
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent border-none outline-none text-white text-[15px] px-2 py-2 placeholder-gray-500 min-w-0 disabled:opacity-50"
                />
                <div className="absolute bottom-px -right-2 w-2 h-4 pointer-events-none">
                  <svg width="9" height="20"><g fill="#212121" fillRule="evenodd">
                    <path d="M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z" fill="#212121" />
                  </g></svg>
                </div>
              </div>

              {/* Send / Mic button */}
              <motion.button
                onClick={() => {
                  if (isRecording) {
                    sendVoiceMessage()
                  } else if (input.trim() || editingMessageId) {
                    sendMessage()
                  } else {
                    startRecording()
                  }
                }}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.88 }}
                className="text-white w-[46px] h-[46px] rounded-full flex items-center justify-center shrink-0 shadow-lg"
                style={{ backgroundColor: isRecording ? "#e53935" : ACCENT }}
              >
                <AnimatePresence mode="wait">
                  {isRecording ? (
                    <motion.div key="stop" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.15 }}>
                      <Send size={22} />
                    </motion.div>
                  ) : editingMessageId ? (
                    <motion.div key="check" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ duration: 0.15 }}><CheckCircle size={22} /></motion.div>
                  ) : input.trim() ? (
                    <motion.div key="send" initial={{ scale: 0, rotate: 20 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ duration: 0.15 }}><Send size={22} /></motion.div>
                  ) : (
                    <motion.div key="mic" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.15 }}><Mic size={22} /></motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showProfile && (
          <UserProfilePanel
            userId={otherUser?.id}
            username={otherUser?.username}
            avatar={otherUserAvatar || otherUser?.avatar}
            isOnline={otherUserOnline}
            onClose={() => setShowProfile(false)}
            isMobile={typeof window !== "undefined" && window.innerWidth < 768}
          />
        )}
      </AnimatePresence>

      {/* Forward modal */}
      <AnimatePresence>
        {forwardingMsg && (
          <>
            <motion.div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setForwardingMsg(null)} />
            <motion.div className="fixed inset-x-0 bottom-0 z-[201] md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[420px]"
              initial={{ opacity: 0, y: 60, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 60, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}>
              <div className="bg-[#1c242f] rounded-t-3xl md:rounded-2xl border border-white/8 shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
                <div className="px-5 py-4 flex items-center gap-3 border-b border-white/5">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setForwardingMsg(null)} className="p-1.5 rounded-full hover:bg-white/10 text-gray-400"><X size={20} /></motion.button>
                  <input autoFocus value={forwardSearch} onChange={e => setForwardSearch(e.target.value)}
                    placeholder={t('forward_to')} className="flex-1 bg-transparent text-white text-[16px] outline-none placeholder-gray-500" />
                </div>
                <div className="px-5 py-2 border-b border-white/5">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Forward size={14} />
                    <p className="text-[13px] truncate">{forwardingMsg.content}</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto hide-scrollbar py-2">
                  {filteredConvs.map(conv => {
                    const other = conv.participants?.find((p: any) => p.userId?.toString() !== session?.user?.id?.toString())?.user
                    return (
                      <motion.div key={conv.id} onClick={() => handleForwardTo(conv.id.toString())}
                        whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }} whileTap={{ scale: 0.98 }}
                        className="px-5 py-3 flex items-center gap-3 cursor-pointer transition-colors">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0 overflow-hidden text-xl" style={{ backgroundColor: ACCENT }}>
                          {other?.avatar ? <img src={other.avatar} className="w-full h-full object-cover" /> : other?.username?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-[15px] truncate">{other?.username || conv.name}</p>
                          <p className="text-gray-500 text-[13px] truncate">{conv.messages?.[0]?.content || t('no_messages_yet')}</p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Call modal ── */}
      <AnimatePresence>
        {showCallModal && (
          <CallModal
            incomingCall={incomingCall}
            outgoingCall={outgoingCall}
            socket={socket}
            currentUserId={session?.user?.id || ""}
            onAccept={() => {
              setIncomingCall(null)
            }}
            onDecline={() => {
              setIncomingCall(null)
            }}
            onHangup={() => {
              setIncomingCall(null)
              setOutgoingCall(null)
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
