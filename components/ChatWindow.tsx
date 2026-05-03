"use client"

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Loader2, Search, EllipsisVertical, Smile, Paperclip, Send, Mic, ArrowLeft, CheckCircle, X, Forward, Bookmark, Phone, Video, Pin, Clock } from "lucide-react"
import { Virtuoso } from "react-virtuoso"
import Linkify from "linkify-react"
import EmojiGifPicker from "./EmojiGifPicker"
import useSound from "use-sound"
import ChatMessage from "./ChatMessage"
import FileMessage from "./FileMessage"
import CallModal from "./CallModal"
import { AnimatePresence, motion, LazyMotion, domAnimation } from "framer-motion"
import { useTranslation } from "react-i18next"
import { useSocket } from "@/app/ClientProviders"
import UserProfilePanel from "./UserProfilePanel"
import GroupProfilePanel from "./GroupProfilePanel"
import { VerifiedBadge } from "./VerifiedBadge"
import TitleBadge from "./TitleBadge"
import ChatHeader from "./chat/ChatHeader"
import PinnedMessageBanner from "./chat/PinnedMessageBanner"
import { useE2E } from "@/hooks/useE2E"

const ACCENT = "#7e85e1"

interface Message {
  id: string | number
  content: string
  createdAt: string
  conversationId?: string | number
  isRead?: boolean
  isEncrypted?: boolean
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
  const { e2eEnabled, encrypt, decrypt, decryptMessages } = useE2E()

  const [messages, setMessages] = useState<Message[]>(initialMessages || [])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")

  const DEV_USER_ID = process.env.NODE_ENV === "development" ? 1 : -1


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
  const [mentionProfileUsername, setMentionProfileUsername] = useState<string | null>(null)

  const handleMentionClick = useCallback(async (username: string) => {
    // Находим пользователя по username и открываем профиль
    setMentionProfileUsername(username)
  }, [])
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

  // ── Search ──────────────────────────────────────────────────
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Message[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // ── Pinned message ──────────────────────────────────────────
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null)

  // ── Drag & Drop ─────────────────────────────────────────────
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)

  // ── Pagination ──────────────────────────────────────────────
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const nextCursorRef = useRef<number | null>(null)

  // ── Self-destruct timer ────────────────────────────────────
  const [selfDestructSeconds, setSelfDestructSeconds] = useState<number | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  // ── Mention toast ─────────────────────────────────────────────
  const [mentionToast, setMentionToast] = useState<{ senderName: string; messageId: string } | null>(null)

  // ── Sounds: send.wav + notification.mp3 из /public/sounds ──
  const [playSend] = useSound("/sounds/send.wav", { volume: 0.5 })
  const [playReceive] = useSound("/sounds/notification.mp3", { volume: 0.6 })

  // ── Voice recording ──────────────────────────────────────────

  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Calls ────────────────────────────────────────────────────
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCall | null>(null)
  // callActive: модал остаётся открытым в течение всего звонка
  const [callActive, setCallActive] = useState(false)
  const showCallModal = !!(incomingCall || outgoingCall || callActive)

  const convType: string = conversation?.type || "private"
  const isSavedChat = convType === "saved"
  const isSystemChat = convType === "system"
  const isGroupChat = convType === "group"

  // ── Mobile Header Long Press & Keyboard Fixes ─────────────────────────────
  const headerLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartX = useRef<number>(0)
  const touchStartY = useRef<number>(0)
  const inputContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Huawei-specific keyboard fix
    const isHuawei = /huawei/i.test(navigator.userAgent);

    const handleResize = () => {
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        if (document.activeElement === inputRef.current) {
          setTimeout(() => {
            inputContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }, 100);
        }
      }
    };

    const handleFocus = () => {
      if (isHuawei && inputContainerRef.current) {
        // Huawei: force input container to bottom with fixed positioning
        const container = inputContainerRef.current;
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        const containerHeight = container.offsetHeight;

        // Position container at bottom of visible viewport
        container.style.position = 'fixed';
        container.style.bottom = '0';
        container.style.left = '0';
        container.style.right = '0';
        container.style.zIndex = '9999';

        // Adjust messages container to not overlap
        const messagesContainer = container.previousElementSibling as HTMLElement;
        if (messagesContainer) {
          messagesContainer.style.paddingBottom = `${containerHeight + 20}px`;
        }
      }
    };

    const handleBlur = () => {
      if (isHuawei && inputContainerRef.current) {
        // Reset positioning
        const container = inputContainerRef.current;
        container.style.position = '';
        container.style.bottom = '';
        container.style.left = '';
        container.style.right = '';
        container.style.zIndex = '';

        const messagesContainer = container.previousElementSibling as HTMLElement;
        if (messagesContainer) {
          messagesContainer.style.paddingBottom = '';
        }
      }
    };

    window.addEventListener('resize', handleResize);
    if (inputRef.current) {
      inputRef.current.addEventListener('focus', handleFocus);
      inputRef.current.addEventListener('blur', handleBlur);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (inputRef.current) {
        inputRef.current.removeEventListener('focus', handleFocus);
        inputRef.current.removeEventListener('blur', handleBlur);
      }
    };
  }, []);
  const isGroup = isGroupChat
  const isSpecialChat = isSavedChat || isSystemChat || isGroup

  const otherUser = useMemo(() => {
    if (isSpecialChat || !conversation?.participants) return null
    return conversation.participants.find((p: any) => p.userId?.toString() !== session?.user?.id?.toString())?.user
  }, [conversation, session, isSpecialChat])

  const chatTitle = isSavedChat ? t("saved_messages")
    : isSystemChat ? "Vortex"
      : isGroupChat ? conversation?.name
        : otherUser?.username || t("loading")

  const isOtherUserDev = otherUser?.id === DEV_USER_ID || otherUser?.id === DEV_USER_ID.toString() || Number(otherUser?.id) === DEV_USER_ID

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
      setMessages(prev => {
        const hasChanges = prev.some(msg => msg.sender.id?.toString() === data.userId?.toString())
        if (!hasChanges) return prev
        return prev.map(msg =>
          msg.sender.id?.toString() === data.userId?.toString()
            ? { ...msg, sender: { ...msg.sender, avatar: data.avatar } } : msg
        )
      })
      if (otherUser?.id?.toString() === data.userId?.toString()) setOtherUserAvatar(data.avatar)
    }
    socket.on("user-avatar-updated", handleAvatarUpdate)
    return () => { socket.off("user-avatar-updated", handleAvatarUpdate) }
  }, [socket, otherUser?.id])

  // Load messages (paginated)
  useEffect(() => {
    setLoading(true)
    isInitialLoad.current = true
    fetch(`/api/messages?conversationId=${apiId}&limit=50`)
      .then(r => r.json())
      .then(async data => {
        const msgs = Array.isArray(data.messages) ? data.messages : (Array.isArray(data) ? data : [])
        // E2E: расшифровываем сообщения на клиенте перед показом
        const decrypted = await decryptMessages(msgs)
        setMessages(decrypted)
        setHasMoreMessages(!!data.hasMore)
        nextCursorRef.current = data.nextCursor || null
        setLoading(false)
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
        // Load pinned message if exists
        if (conv?.pinnedMessageId) {
          fetch(`/api/messages?conversationId=${apiId}&limit=100`)
            .then(r => r.json())
            .then(mData => {
              const allMsgs = Array.isArray(mData.messages) ? mData.messages : []
              const pinned = allMsgs.find((m: any) => m.id === conv.pinnedMessageId)
              if (pinned) setPinnedMessage(pinned)
            })
            .catch(() => { })
        }
        isInitialLoad.current = false
      })
      .catch(() => { isInitialLoad.current = false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiId])

  // ── Load more messages (pagination) ──
  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !hasMoreMessages || !nextCursorRef.current) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/messages?conversationId=${apiId}&cursor=${nextCursorRef.current}&limit=50`)
      const data = await res.json()
      const older = Array.isArray(data.messages) ? data.messages : []
      if (older.length > 0) {
        // E2E: расшифровываем подгруженные сообщения
        const decryptedOlder = await decryptMessages(older)
        setMessages(prev => [...decryptedOlder, ...prev])
        setHasMoreMessages(!!data.hasMore)
        nextCursorRef.current = data.nextCursor || null
      } else {
        setHasMoreMessages(false)
      }
    } catch { }
    setLoadingMore(false)
  }, [apiId, loadingMore, hasMoreMessages])

  // ── Search handler ──
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/messages/search?q=${encodeURIComponent(searchQuery)}&conversationId=${apiId}`)
        const data = await res.json()
        setSearchResults(Array.isArray(data) ? data : [])
      } catch { setSearchResults([]) }
      setIsSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, apiId])

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
    }).catch(() => { })
  }, [loading, apiId, session?.user?.id])

  // Draft save
  useEffect(() => {
    if (isInitialLoad.current) return
    const timer = setTimeout(async () => {
      try {
        await fetch("/api/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: apiId, text: input }) })
      } catch { }
    }, 500)
    return () => clearTimeout(timer)
  }, [input, apiId])

  // Socket listeners
  useEffect(() => {
    if (!socket) return
    const roomId = String(apiId)
    socket.emit("join-conversation", roomId)

    const handleNewMessage = async (message: Message) => {
      const msgConvId = message.conversationId?.toString()
      if (msgConvId && msgConvId !== roomId) return
      // E2E: расшифровываем входящее сообщение перед добавлением в список
      let displayMessage = message
      if (message.isEncrypted && message.content) {
        const senderId = String(message.sender?.id)
        const plaintext = await decrypt(message.content, senderId)
        displayMessage = { ...message, content: plaintext ?? "🔒 Зашифрованное сообщение" }
      }
      setMessages(prev => {
        if (prev.some(m => m.id?.toString() === displayMessage.id?.toString())) return prev
        newMsgIds.current.add(displayMessage.id.toString())
        return [...prev, displayMessage]
      })
      // Auto-mark as read if chat is visible
      if (message.sender.id?.toString() !== session?.user?.id?.toString()) {
        try { playReceive() } catch {}
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
        }).catch(() => { })
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

    const handleMessageConfirmed = (data: { tempId: string; message: Message }) => {
      const { tempId, message: saved } = data
      const sk = stableKeys.current.get(tempId) || tempId
      stableKeys.current.set(saved.id.toString(), sk)
      stableKeys.current.delete(tempId)
      setMessages(prev => prev.map(m => m.id === tempId ? { ...saved } : m))
      try { playSend() } catch {}
    }

    const handleMessageFailed = (data: { tempId: string }) => {
      setMessages(prev => prev.map(m =>
        m.id === data.tempId ? { ...m, failed: true } : m
      ) as Message[])
    }

    // Подтверждение редактирования сервером
    const handleEditConfirmed = (data: { tempEditId: string; message: Message }) => {
      setMessages(prev => prev.map(m =>
        m.id?.toString() === data.message.id?.toString() ? { ...data.message } : m
      ))
    }

    // Упоминание — баннер сверху (toast)
    const handleMentioned = (data: { messageId: number; senderId: string; senderName: string; conversationId: string }) => {
      if (data.conversationId !== roomId) return
      // Подсвечиваем сообщение с упоминанием
      setMentionToast({ senderName: data.senderName, messageId: String(data.messageId) })
      setTimeout(() => setMentionToast(null), 3500)
    }

    socket.on("edit-confirmed", handleEditConfirmed)
    socket.on("you-were-mentioned", handleMentioned)

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
    socket.on("message-confirmed", handleMessageConfirmed)
    socket.on("message-failed", handleMessageFailed)
    return () => {
      socket.off("new-message", handleNewMessage)
      socket.off("message-deleted", handleMessageDeleted)
      socket.off("message-edited", handleMessageEdited)
      socket.off("messages-read", handleMessagesRead)
      socket.off("user-typing", handleTyping)
      socket.off("user-stop-typing", handleStopTyping)
      socket.off("message-confirmed", handleMessageConfirmed)
      socket.off("message-failed", handleMessageFailed)
      socket.off("edit-confirmed", handleEditConfirmed)
      socket.off("you-were-mentioned", handleMentioned)
    }
  }, [apiId, socket, session?.user?.id, decrypt])

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
    // Load more when scrolled to top
    if (scrollTop < 100 && hasMoreMessages && !loadingMore) {
      loadMoreMessages()
    }
  }, [hasMoreMessages, loadingMore, loadMoreMessages])

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

  const handleDeleteMessage = useCallback((id: string, deleteForAll = true) => {
    // Оптимистично убираем сразу в UI
    setMessages(prev => prev.filter(m => m.id?.toString() !== id))
    // Сервер удалит из БД и нотифицирует всех
    socket?.emit("delete-message", { id, conversationId: String(apiId), deleteForAll })
  }, [socket, apiId])

  const handleStartEdit = useCallback((id: string, content: string) => {
    setEditingMessageId(id); setReplyingTo(null); setInput(content)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const cancelEdit = useCallback(() => { setEditingMessageId(null); setInput("") }, [])
  const handleMenuOpen = useCallback((id: string, x: number, y: number) => { setOpenMenuId(id); setMenuPos({ x, y }) }, [])

  // ── Фикс клавиатуры — скроллим input в видимую область при фокусе на мобильном ──────────
  useEffect(() => {
    const inp = inputRef.current
    if (!inp) return
    const onFocus = () => {
      // Небольшая задержка чтобы клавиатура успела открыться
      setTimeout(() => {
        inp.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        // Дополнительный скролл через visualViewport offset
        if (window.visualViewport) {
          const vv = window.visualViewport
          const inpRect = inp.getBoundingClientRect()
          const inpBottom = inpRect.bottom
          const vvBottom = vv.offsetTop + vv.height
          if (inpBottom > vvBottom - 8) {
            window.scrollBy({ top: inpBottom - vvBottom + 16, behavior: 'smooth' })
          }
        }
      }, 350)
    }
    inp.addEventListener('focus', onFocus)
    return () => inp.removeEventListener('focus', onFocus)
  }, [])
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
    setCallActive(true)
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

  // ── Send text message — через сокет, без HTTP POST ────────────
  const sendMessage = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || !session?.user) return

    // Редактирование — через сокет (без HTTP)
    if (editingMessageId) {
      if (!socket) return
      const tempEditId = "edit-" + Date.now()
      // Обновляем оптимистично — сразу показываем изменение в UI
      setMessages(prev => prev.map(m => m.id?.toString() === editingMessageId ? { ...m, content: input } : m))

      // E2E: шифруем отредактированное сообщение
      let editContent = input
      if (e2eEnabled && otherUser?.id && !isGroupChat) {
        const enc = await encrypt(input, otherUser.id)
        if (enc) editContent = enc
      }

      socket.emit("edit-message", {
        tempEditId,
        id: editingMessageId,
        content: editContent,
        conversationId: String(apiId),
      })
      setEditingMessageId(null); setInput("")
      return
    }

    if (!socket) return

    const tempId = "temp-" + Date.now()
    const optimisticMsg: Message = {
      id: tempId, content: input, conversationId: String(apiId),
      createdAt: new Date().toISOString(), isRead: false,
      replyTo: replyingTo ? { id: parseInt(replyingTo.id), content: replyingTo.content, sender: { id: parseInt(replyingTo.id), username: replyingTo.senderName } } : null,
      sender: { id: session.user.id, username: session.user.name || "Me", avatar: session.user.image || undefined }
    }
    stableKeys.current.set(tempId, tempId)

    // 1. Показываем сообщение МГНОВЕННО с часиками
    setMessages(prev => [...prev, optimisticMsg])
    if (onNewMessage) onNewMessage(optimisticMsg)
    const currentInput = input
    const currentReplyTo = replyingTo
    setInput(""); setReplyingTo(null)

    // 2. E2E: шифруем перед отправкой — сервер хранит только зашифрованный blob
    let contentToSend = currentInput
    let isEncryptedFlag = false
    if (e2eEnabled && otherUser?.id && !isGroupChat) {
      const encryptedContent = await encrypt(currentInput, otherUser.id)
      if (encryptedContent) {
        contentToSend = encryptedContent
        isEncryptedFlag = true
      }
    }

    // 3. Отправляем через сокет — без HTTP запроса
    socket.emit("send-message", {
      tempId,
      content: contentToSend,
      isEncrypted: isEncryptedFlag,
      conversationId: String(apiId),
      senderId: session.user.id,
      participantIds,
      ...(currentReplyTo ? { replyToId: parseInt(currentReplyTo.id) } : {}),
    })
    // Stop typing indicator as soon as message is sent
    socket.emit("stop-typing", { conversationId: String(apiId), userId: session.user.id })

    // 2b. Если в тексте есть @упоминания — шлём событие
    const mentionMatches = currentInput.match(/@(\w+)/g)
    if (mentionMatches && participantIds.length > 0) {
      socket.emit("mention", {
        conversationId: String(apiId),
        senderId: session.user.id,
        senderName: session.user.name || 'User',
        mentions: mentionMatches.map(m => m.slice(1)), // убираем @
        participantIds,
      })
    }

    // 3. Удаляем черновик в фоне (не блокирует UI)
    fetch(`/api/drafts?conversationId=${apiId}`, { method: "DELETE" }).catch(() => {})
  }, [input, session, editingMessageId, apiId, socket, onNewMessage, participantIds, replyingTo])

  const handleForwardTo = useCallback(async (targetConvId: string) => {
    if (!forwardingMsg || !session?.user || !socket) return
    // Пересылка через сокет — без HTTP
    socket.emit("forward-message", {
      fromMessageId: parseInt(forwardingMsg.id),
      toConversationIds: [targetConvId],
    })
    setForwardingMsg(null)
  }, [forwardingMsg, session, socket])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() }
    if (e.key === "Escape") { if (editingMessageId) cancelEdit(); if (replyingTo) cancelReply() }
  }, [sendMessage, editingMessageId, cancelEdit, replyingTo, cancelReply])

  // ── Pin message handler ──
  const handlePinMessage = useCallback(async (messageId: string) => {
    try {
      const res = await fetch("/api/conversations/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: apiId, messageId }),
      })
      if (res.ok) {
        const data = await res.json()
        setPinnedMessage(data.pinnedMessage)
        socket?.emit("message-pinned", { conversationId: String(apiId), ...data })
      }
    } catch { }
  }, [apiId, socket])

  const handleUnpinMessage = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations/pin?conversationId=${apiId}`, { method: "DELETE" })
      if (res.ok) {
        setPinnedMessage(null)
        socket?.emit("message-unpinned", { conversationId: String(apiId) })
      }
    } catch { }
  }, [apiId, socket])

  // ── Drag & Drop handlers ──
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes("Files")) setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setIsDragOver(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file || !session?.user) return
    if (file.size > 50 * 1024 * 1024) { setUploadError("File too large (max 50MB)"); return }

    setIsUploading(true)
    setUploadError("")
    try {
      const formData = new FormData()
      formData.append("file", file)
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
      if (!uploadRes.ok) { setUploadError("Upload failed"); return }
      const uploaded = await uploadRes.json()
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "", conversationId: apiId,
          fileUrl: uploaded.url, fileName: uploaded.name, fileSize: uploaded.size, fileType: uploaded.type,
        })
      })
      if (res.ok) {
        const saved = await res.json()
        setMessages(prev => [...prev, saved])
        socket?.emit("send-message", { ...saved, conversationId: String(apiId), participantIds })
      }
    } catch { setUploadError("Upload failed") }
    finally { setIsUploading(false) }
  }, [session, apiId, socket, participantIds])

  // ── Pin/unpin listeners ──
  useEffect(() => {
    if (!socket) return
    const handlePinned = (data: any) => {
      if (String(data.conversationId) === String(apiId)) setPinnedMessage(data.pinnedMessage)
    }
    const handleUnpinned = (data: any) => {
      if (String(data.conversationId) === String(apiId)) setPinnedMessage(null)
    }
    socket.on("message-pinned", handlePinned)
    socket.on("message-unpinned", handleUnpinned)
    return () => { socket.off("message-pinned", handlePinned); socket.off("message-unpinned", handleUnpinned) }
  }, [socket, apiId])

  // ── Reaction listeners ──
  useEffect(() => {
    if (!socket) return
    const handleReactionAdded = (data: any) => {
      setMessages(prev => {
        let changed = false
        const updated = prev.map(m => {
          if (m.id?.toString() === data.messageId?.toString()) {
            changed = true
            const reactions = (m as any).reactions || []
            return { ...m, reactions: [...reactions, data] }
          }
          return m
        })
        return changed ? updated : prev
      })
    }
    const handleReactionRemoved = (data: any) => {
      setMessages(prev => {
        let changed = false
        const updated = prev.map(m => {
          if (m.id?.toString() === data.messageId?.toString()) {
            changed = true
            const reactions = ((m as any).reactions || []).filter(
              (r: any) => !(r.userId === data.userId && r.emoji === data.emoji)
            )
            return { ...m, reactions }
          }
          return m
        })
        return changed ? updated : prev
      })
    }
    socket.on("reaction-added", handleReactionAdded)
    socket.on("reaction-removed", handleReactionRemoved)
    return () => { socket.off("reaction-added", handleReactionAdded); socket.off("reaction-removed", handleReactionRemoved) }
  }, [socket])

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



  // 2. Добавляем проверку здесь (выше рендера)

  return (
    <LazyMotion features={domAnimation}>
    <motion.div
      className="flex-1 flex flex-row h-full bg-[#1c242f] relative"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag & Drop overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
              className="bg-[#1c242f] border-2 border-dashed border-[#7e85e1] rounded-3xl px-12 py-10 text-center"
            >
              <Paperclip size={48} className="mx-auto mb-3 text-[#7e85e1]" />
              <p className="text-white text-lg font-bold">Перетащите файл сюда</p>
              <p className="text-gray-400 text-sm mt-1">Максимум 50 МБ</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mention toast ────────────────────────────────────────── */}
      <AnimatePresence>
        {mentionToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="absolute top-[70px] left-1/2 z-[150] cursor-pointer"
            style={{ transform: 'translateX(-50%)' }}
            onClick={() => { scrollToMessage(mentionToast.messageId); setMentionToast(null) }}
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-full shadow-xl text-white text-[13px] font-medium"
              style={{ backgroundColor: ACCENT }}>
              <span>@</span>
              <span>{mentionToast.senderName} упомянул вас</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col h-full min-w-0 tg-bg">

        {/* ── Header ── */}
        <ChatHeader
          chatTitle={chatTitle}
          isSavedChat={isSavedChat}
          isSystemChat={isSystemChat}
          isGroupChat={isGroupChat}
          isSpecialChat={isSpecialChat}
          otherUser={otherUser}
          otherUserAvatar={otherUserAvatar}
          otherUserOnline={otherUserOnline}
          isOtherTyping={isOtherTyping}
          isOtherUserDev={isOtherUserDev}
          conversation={conversation}
          onBack={onBack}
          onProfileClick={() => setShowProfile(p => !p)}
          onSearchClick={() => setShowSearch(true)}
          onCallClick={() => startCall("audio")}
          t={t}
        />

        {/* Search panel */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="bg-[#1c242f] border-b border-white/5 overflow-hidden"
            >
              <div className="flex items-center gap-2 px-4 py-2">
                <Search size={16} className="text-gray-500 shrink-0" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Поиск по сообщениям..."
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-500"
                />
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]) }}
                  className="text-gray-400 hover:text-white p-1"><X size={16} /></motion.button>
              </div>
              {searchResults.length > 0 && (
                <div className="max-h-[200px] overflow-y-auto hide-scrollbar border-t border-white/5">
                  {searchResults.map(r => (
                    <div key={r.id.toString()} onClick={() => { scrollToMessage(r.id.toString()); setShowSearch(false) }}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-white/5 cursor-pointer">
                      <span className="text-xs text-gray-500 shrink-0">{new Date(r.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="text-sm text-white truncate">{r.content}</span>
                    </div>
                  ))}
                </div>
              )}
              {isSearching && <div className="px-4 py-2 text-gray-500 text-xs">Поиск...</div>}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pinned message banner */}
        <PinnedMessageBanner
          pinnedMessage={pinnedMessage}
          onUnpin={handleUnpinMessage}
          onScrollTo={scrollToMessage}
        />

        {/* ── Menu backdrop: прозрачный, только закрывает меню по тапу вне ── */}
        {openMenuId && (
          <div
            className="fixed inset-0 z-[199]"
            onClick={handleMenuClose}
            onContextMenu={e => { e.preventDefault(); handleMenuClose() }}
          />
        )}

        {/* ── Messages ── */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 hide-scrollbar relative" onScroll={handleScroll}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* Loading more indicator */}
          {loadingMore && (
            <div className="flex justify-center py-2">
              <Loader2 size={20} className="animate-spin text-[#7e85e1]" />
            </div>
          )}
          <div className="flex justify-center mb-4">
            <motion.span initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-black/20 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">{t('today')}</motion.span>
          </div>

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
              const isNew = msgIdStr.startsWith("temp-")
              const sk = stableKeys.current.get(msgIdStr) || msgIdStr

              return (
                <MessageItem
                  key={sk}
                  msg={msg}
                  isSender={isSender}
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                  isNew={isNew}
                  isGroupChat={isGroupChat}
                  session={session}
                  openMenuId={openMenuId}
                  menuPos={menuPos}
                  messageRefs={messageRefs}
                  handleDeleteMessage={handleDeleteMessage}
                  handleStartEdit={handleStartEdit}
                  handleReply={handleReply}
                  handleForwardOpen={handleForwardOpen}
                  scrollToMessage={scrollToMessage}
                  handleMenuOpen={handleMenuOpen}
                  handleMenuClose={handleMenuClose}
                  handlePinMessage={handlePinMessage}
                  handleMentionClick={handleMentionClick}
                  socket={socket}
                  apiId={apiId}
                />
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
          <div ref={inputContainerRef} className="px-3 pb-4 pt-2 relative z-20" style={{ background: 'transparent' }}>
            <AnimatePresence>
              {uploadError && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="px-3 py-1.5 text-red-400 text-[12px] flex items-center gap-2 mb-1">
                  <X size={12} /> {uploadError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Voice recording UI */}
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl mx-auto w-full max-w-[calc(100%-108px)]"
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

              {/* Text input bubble & reply/edit preview */}
              <div className="flex-1 flex flex-col min-w-0">
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

                <div
                  style={{
                    backgroundColor: "var(--input-bg)",
                    borderTopLeftRadius: (editingMessageId || replyingTo) ? "0" : "0.9375rem",
                    borderTopRightRadius: (editingMessageId || replyingTo) ? "0" : "0.9375rem",
                    borderBottomLeftRadius: "0.9375rem",
                    borderBottomRightRadius: "0",
                  }}
                  className="relative flex items-center w-full px-2 py-1 min-h-[46px] shadow-lg"
                >
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.85, rotate: 15 }}
                    onClick={() => setShowEmojiPicker(v => !v)}
                    className="text-gray-400 hover:text-white transition-colors shrink-0 p-1"
                    style={{ color: showEmojiPicker ? ACCENT : undefined }}
                  >
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
                      // When field is cleared, immediately emit stop-typing
                      if (!e.target.value) {
                        socket?.emit("stop-typing", { conversationId: String(apiId), userId: session?.user?.id })
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

      {/* Профиль пользователя по клику на @mention */}
      <AnimatePresence>
        {mentionProfileUsername && (
          <MentionProfilePanel
            username={mentionProfileUsername}
            onClose={() => setMentionProfileUsername(null)}
            isMobile={typeof window !== 'undefined' && window.innerWidth < 768}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProfile && (
          isGroup ? (
            <GroupProfilePanel
              conversationId={apiId}
              name={chatTitle || "Group"}
              participants={conversation?.participants || []}
              currentUserId={session?.user?.id || ""}
              onClose={() => setShowProfile(false)}
              isMobile={typeof window !== "undefined" && window.innerWidth < 768}
            />
          ) : (
            <UserProfilePanel
              userId={otherUser?.id}
              username={otherUser?.username}
              avatar={otherUserAvatar || otherUser?.avatar}
              isOnline={otherUserOnline}
              onClose={() => setShowProfile(false)}
              isMobile={typeof window !== "undefined" && window.innerWidth < 768}
              conversationId={apiId}
            />
          )
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

      {/* ── Emoji/GIF picker ── */}
      <EmojiGifPicker
        open={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelect={(emoji) => {
          setInput(prev => prev + emoji)
          setShowEmojiPicker(false)
          inputRef.current?.focus()
        }}
        onGifSelect={async (url) => {
          if (!session?.user) return
          setIsUploading(true)
          try {
            const res = await fetch("/api/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: url, conversationId: apiId, fileUrl: url, fileType: "image/gif", fileName: "gif" })
            })
            if (res.ok) {
              const saved = await res.json()
              setMessages(prev => [...prev, saved])
              socket?.emit("send-message", { ...saved, conversationId: String(apiId), participantIds })
            }
          } finally { setIsUploading(false) }
        }}
        onStickerSelect={(sticker) => {
          setInput(prev => prev + sticker)
          inputRef.current?.focus()
        }}
      />

      {/* ── Call modal ── */}
      <AnimatePresence>
        {showCallModal && (
          <CallModal
            incomingCall={incomingCall}
            outgoingCall={outgoingCall}
            socket={socket}
            currentUserId={session?.user?.id || ""}
            onAccept={() => {
              // НЕ убираем incomingCall здесь!
              // Модал остаётся жить через callActive
              setCallActive(true)
              setIncomingCall(null)
            }}
            onDecline={() => {
              setIncomingCall(null)
              setCallActive(false)
            }}
            onHangup={() => {
              setIncomingCall(null)
              setOutgoingCall(null)
              setCallActive(false)
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  </LazyMotion>
  )
}

// Компонент: поиск пользователя по username и показ профиля
function MentionProfilePanel({ username, onClose, isMobile }: { username: string; onClose: () => void; isMobile: boolean }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/users/search?query=${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then(data => {
        const users = Array.isArray(data) ? data : []
        const match = users.find((u: any) => u.username?.toLowerCase() === username.toLowerCase())
        if (match) {
          setUserId(String(match.id))
          setUserAvatar(match.avatar || null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [username])

  if (loading) return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  )

  if (!userId) return null

  return (
    <UserProfilePanel
      userId={userId}
      username={username}
      avatar={userAvatar || undefined}
      isOnline={false}
      onClose={onClose}
      isMobile={isMobile}
    />
  )
}

// Мемоизированный компонент для рендера одного сообщения
const MessageItem = React.memo(function MessageItem({
  msg, isSender, isFirstInGroup, isLastInGroup, isNew, isGroupChat, session,
  openMenuId, menuPos, messageRefs, handleDeleteMessage, handleStartEdit,
  handleReply, handleForwardOpen, scrollToMessage, handleMenuOpen, handleMenuClose,
  handlePinMessage, handleMentionClick, socket, apiId
}: {
  msg: Message
  isSender: boolean
  isFirstInGroup: boolean
  isLastInGroup: boolean
  isNew: boolean
  isGroupChat: boolean
  session: any
  openMenuId: string | null
  menuPos: { x: number; y: number }
  messageRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>
  handleDeleteMessage: (id: string) => void
  handleStartEdit: (id: string, content: string) => void
  handleReply: (msg: { id: string; content: string; senderName: string }) => void
  handleForwardOpen: (msg: { id: string; content: string }) => void
  scrollToMessage: (id: string) => void
  handleMenuOpen: (id: string, x: number, y: number) => void
  handleMenuClose: () => void
  handlePinMessage: (id: string) => void
  handleMentionClick: (username: string) => void
  socket: any
  apiId: string
}) {
  const handleReactionClick = useCallback(async (messageId: string, emoji: string) => {
    try {
      const res = await fetch("/api/messages/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, emoji }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.action === "added") {
          socket?.emit("reaction-added", { ...data, conversationId: String(apiId) })
        } else {
          socket?.emit("reaction-removed", { ...data, conversationId: String(apiId) })
        }
      }
    } catch { }
  }, [socket, apiId])

  return (
    <div ref={el => { messageRefs.current[msg.id.toString()] = el }} className="rounded-lg">
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
          senderName={isGroupChat ? msg.sender.username : undefined} senderId={msg.sender.id} isTemp={isNew}
          failed={(msg as any).failed}
          isGroupChat={isGroupChat}
          onDelete={handleDeleteMessage} onEdit={handleStartEdit}
          onReply={handleReply} onForward={handleForwardOpen} onScrollToMessage={scrollToMessage}
          openMenuId={openMenuId} onMenuOpen={handleMenuOpen} onMenuClose={handleMenuClose} menuPos={menuPos}
          reactions={(msg as any).reactions}
          currentUserId={session?.user?.id}
          selfDestructAt={(msg as any).selfDestructAt}
          onPin={handlePinMessage}
          onMentionClick={handleMentionClick}
          onReaction={handleReactionClick}
        />
      )}
    </div>
  )
})
