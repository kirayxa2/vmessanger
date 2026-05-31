"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import ChatWindow from "@/components/ChatWindow"
import ChatSidebar from "@/components/ChatSidebar"
import { Loader2, MessageSquare, Settings, User } from "lucide-react"
import { useSocket } from "./ClientProviders"
import TitleBar from "@/components/TitleBar"
import { motion, AnimatePresence } from "framer-motion"
import { useNotificationSound } from "@/hooks/useNotificationSound"
import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'

const ACCENT = "var(--accent, #7e85e1)"

// Определяем тип платформы
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])
  return isMobile
}

export default function HomePage({ conversationId }: { conversationId?: string }) {
  const { data: session, status } = useSession()
  const { socket } = useSocket()
  const router = useRouter()
  const isMobile = useIsMobile()
  const { play: playNotificationSound } = useNotificationSound()

  const [conversations, setConversations] = useState<any[]>([])
  const [messagesCache, setMessagesCache] = useState<{ [key: string]: any[] }>({})
  const [selectedId, setSelectedId] = useState<string | null>(conversationId || null)
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({})
  const [loading, setLoading] = useState(true)
  const [showChatOnMobile, setShowChatOnMobile] = useState(false)

  const [mobileTab, setMobileTab] = useState<"chats" | "settings" | "profile">("chats")

  // Кнопка назад на Android
  useEffect(() => {
    if (!isMobile) return
    const handlePopState = () => {
      if (showChatOnMobile) {
        setShowChatOnMobile(false)
        setSelectedId(null)
      }
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [isMobile, showChatOnMobile])

  const isFetching = useRef(false)
  const selectedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (conversationId) {
      setSelectedId(conversationId)
      setShowChatOnMobile(true)
    }
  }, [conversationId])

  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  const specialChatsCreated = useRef(false)
  const ensureSpecialChats = useCallback(async () => {
    if (specialChatsCreated.current) return
    specialChatsCreated.current = true
    await Promise.all([
      fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "saved" }) }),
      fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "system" }) }),
    ])
  }, [])

  const SYSTEM_VIRTUAL_ID = "777000"
  const SAVED_VIRTUAL_ID: string = session?.user?.id?.toString() ?? "saved"
  const virtualToReal = useRef<Record<string, string>>({})
  const realToVirtual = useRef<Record<string, string>>({})

  const applyVirtualIds = useCallback((chats: any[]) => {
    return chats.map(c => {
      if (c.type === "system") {
        virtualToReal.current[SYSTEM_VIRTUAL_ID] = c.id.toString()
        realToVirtual.current[c.id.toString()] = SYSTEM_VIRTUAL_ID
        return { ...c, id: SYSTEM_VIRTUAL_ID, _realId: c.id }
      }
      if (c.type === "saved") {
        virtualToReal.current[SAVED_VIRTUAL_ID] = c.id.toString()
        realToVirtual.current[c.id.toString()] = SAVED_VIRTUAL_ID
        return { ...c, id: SAVED_VIRTUAL_ID, _realId: c.id }
      }
      return c
    })
  }, [SAVED_VIRTUAL_ID])

  const resolveRealId = useCallback((id: string) => virtualToReal.current[id] ?? id, [])

  const fetchConversations = useCallback(async (currentSelectedId?: string) => {
    if (isFetching.current) return
    isFetching.current = true
    try {
      await ensureSpecialChats()
      const response = await fetch("/api/conversations")
      const data = await response.json()
      const raw = Array.isArray(data) ? data.filter((c: any) => c.id != null) : []
      const allChats = applyVirtualIds(raw)
      setConversations(allChats)
      const activeId = currentSelectedId ?? selectedIdRef.current
      if (!activeId && allChats.length > 0 && window.innerWidth >= 768) {
        const saved = allChats.find((c: any) => c.type === "saved")
        setSelectedId(saved ? saved.id.toString() : allChats[0].id.toString())
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error)
    } finally {
      setLoading(false)
      isFetching.current = false
    }
  }, [ensureSpecialChats, applyVirtualIds])

  useEffect(() => {
    if (status === "authenticated" && socket && conversations.length > 0) {
      conversations.forEach(c => {
        if (c.id != null) socket.emit("join-conversation", c.id.toString())
      })
    }
  }, [status, socket, conversations])

  useEffect(() => {
    if (status === "authenticated" && socket) {
      // Targeted message delivery — only for conversations the user participates in
      const handleConversationUpdated = (data: { conversationId: string; lastMessage: any }) => {
        const message = data.lastMessage
        if (!message) return
        // Update messages cache (limit to 100 per conversation)
        setMessagesCache(prev => {
          const existing = prev[data.conversationId] || []
          const updated = [...existing, message].slice(-100)
          const newCache = { ...prev, [data.conversationId]: updated }
          // Ограничиваем кеш до 20 чатов чтобы не раздувать память
          const keys = Object.keys(newCache)
          if (keys.length > 20) {
            const oldest = keys.find(k => k !== data.conversationId)
            if (oldest) delete newCache[oldest]
          }
          return newCache
        })
        const isNotActiveChat = data.conversationId.toString() !== selectedIdRef.current?.toString()
        const isNotSender = message.sender?.id?.toString() !== session?.user?.id?.toString()

        if (isNotSender) {
          if (isNotActiveChat) {
            setUnreadCounts(prev => ({ ...prev, [data.conversationId]: (prev[data.conversationId] || 0) + 1 }))
          }
          // "Без звука" (silent): не проигрываем звук и не показываем уведомление
          if (!message.silent) {
          // Global notification: play sound
          playNotificationSound()
          
          const title = "Vortex new message!"
          let body = message.content || "🖼️ Файл"
          if (body.length > 50) body = body.substring(0, 47) + "..."
          const isElectron = typeof window !== 'undefined' && (window as any).electronAPI
          
          if (Capacitor.isNativePlatform()) {
            // Mobile (Capacitor)
            LocalNotifications.schedule({
              notifications: [{
                title,
                body,
                id: new Date().getTime(),
                schedule: { at: new Date(Date.now() + 100) },
                sound: undefined, // Custom sound plays via app
                smallIcon: "res://drawable/screen"
              }]
            }).catch((e: any) => console.error("Capacitor notification error", e))
          } else if (isElectron) {
            // Desktop (Electron)
            (window as any).electronAPI.showNotification(title, body)
          } else if ("Notification" in window && Notification.permission === "granted") {
            // Fallback: Desktop Web
            try {
              new Notification(title, {
                body,
                icon: "/logo (1).ico",
                tag: `msg-${message.id}`,
                silent: true // Custom sound plays instead
              })
            } catch (e) {
              console.error("Web Push notification failed", e)
            }
          }
          }
        }
        setConversations(prev => {
          const exists = prev.find(c => c.id.toString() === data.conversationId.toString())
          if (!exists) {
            // Чата нет в sidebar — подтягиваем список заново чтобы показать его.
            // Это запасной путь: обычно чат уже добавлен через new-conversation event,
            // но если он потерялся — этот fetch его восстановит.
            fetch("/api/conversations")
              .then(r => r.json())
              .then((fresh: any[]) => {
                if (!Array.isArray(fresh)) return
                const raw = fresh.filter((c: any) => c.id != null)
                setConversations(applyVirtualIds(raw))
              })
              .catch(() => {})
            return prev
          }
          return prev.map(c => c.id.toString() === data.conversationId.toString() ? { ...c, messages: [message] } : c)
        })
      }
      const handleAvatarUpdate = (data: { userId: number; avatar: string }) => {
        setConversations(prev =>
          prev.map(conv => ({
            ...conv,
            participants: conv.participants.map((p: any) =>
              p.userId === data.userId ? { ...p, user: { ...p.user, avatar: data.avatar } } : p
            ),
          }))
        )
      }
      // New conversation created by another user — add it to our sidebar
      const handleNewConversation = (conversation: any) => {
        const normalized = applyVirtualIds([conversation])[0]
        setConversations(prev => {
          if (prev.find(c => c.id.toString() === normalized.id.toString())) return prev
          return [normalized, ...prev]
        })
        // Join the socket room for this new conversation
        socket.emit("join-conversation", normalized.id.toString())
      }
      socket.on("conversation-updated", handleConversationUpdated)
      socket.on("user-avatar-updated", handleAvatarUpdate)
      socket.on("new-conversation", handleNewConversation)
      return () => {
        socket.off("conversation-updated", handleConversationUpdated)
        socket.off("user-avatar-updated", handleAvatarUpdate)
        socket.off("new-conversation", handleNewConversation)
      }
    }
  }, [status, socket, session?.user?.id])

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return }
    if (status === "authenticated") {
      fetchConversations()
      // Request permissions
      if (Capacitor.isNativePlatform()) {
        LocalNotifications.requestPermissions().catch((e: any) => console.error(e))
      } else if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission()
      }
    }
  }, [status, router, fetchConversations])

  const handleSelectConversation = (id: string) => {
    setSelectedId(id)
    setShowChatOnMobile(true)
    setUnreadCounts(prev => ({ ...prev, [id]: 0 }))
    if (typeof window !== "undefined") {
      window.history.pushState({ conversationId: id }, "", `/${id}`)
    }
    // Обновляем список чатов в фоне чтобы подтянуть новые чаты (мержим, не перезаписываем)
    setTimeout(() => {
      fetch("/api/conversations")
        .then(r => r.json())
        .then((data: any[]) => {
          if (!Array.isArray(data)) return
          const raw = data.filter((c: any) => c.id != null)
          const fresh = applyVirtualIds(raw)
          setConversations(prev => {
            // Мержим: берём свежие данные с сервера, но сохраняем чаты которых ещё нет на сервере (только что созданные)
            const freshIds = new Set(fresh.map((c: any) => c.id.toString()))
            const localOnly = prev.filter(c => !freshIds.has(c.id.toString()))
            return [...localOnly, ...fresh].sort((a: any, b: any) => {
              const aTime = a.messages?.[0]?.createdAt || a.updatedAt || 0
              const bTime = b.messages?.[0]?.createdAt || b.updatedAt || 0
              return new Date(bTime).getTime() - new Date(aTime).getTime()
            })
          })
        })
        .catch(() => {})
    }, 1500)
  }

  const handleConversationCreated = (conversation: any) => {
    const normalized = applyVirtualIds([conversation])[0]
    setConversations(prev => {
      if (prev.find(c => c.id.toString() === normalized.id.toString())) return prev
      return [normalized, ...prev]
    })
  }

  const handleBackToSidebar = () => {
    setShowChatOnMobile(false)
    setSelectedId(null)
    router.push("/")
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-[#0e1621] fixed inset-0">
        <Loader2 className="animate-spin" size={40} style={{ color: ACCENT }} />
      </div>
    )
  }

  const selectedConversation = conversations.find(c => c.id?.toString() === selectedId?.toString())
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0)

  // ── DESKTOP LAYOUT ────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div className="flex h-[100dvh] w-full bg-[#0e1621] overflow-hidden fixed inset-0">
        <div className="w-full md:w-[420px] h-full flex flex-col shrink-0 overflow-hidden bg-[#1c242f] border-r border-white/5">
          <TitleBar />
          <ChatSidebar
            currentUser={session?.user}
            conversations={conversations}
            selectedId={selectedId}
            unreadCounts={unreadCounts}
            onSelect={handleSelectConversation}
            onConversationCreated={handleConversationCreated}
          />
        </div>
        <div className="flex-1 flex flex-col relative h-full overflow-hidden bg-[#0e1621]">
          {selectedId ? (
            <ChatWindow
              key={selectedId}
              conversationId={selectedId}
              realConversationId={resolveRealId(selectedId)}
              conversation={selectedConversation}
              onBack={handleBackToSidebar}
              initialMessages={messagesCache[selectedId] || []}
              onNewMessage={() => {}}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10 tg-bg">
              <div className="bg-black/20 backdrop-blur-md px-6 py-3 rounded-full border border-white/5">
                <p className="text-gray-400 text-sm">Выберите чат для начала переписки</p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── MOBILE LAYOUT ─────────────────────────────────────────────
  return (
    <div
      id="mobile-chat-wrap"
      className="flex flex-col w-full overflow-hidden"
      style={{ height: 'var(--app-height, 100dvh)', backgroundColor: '#0a0f17' }}
    >

      {/* ── Основной контент ── */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">

          {showChatOnMobile && selectedId ? (
            <motion.div
              key="chat"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.9 }}
              className="absolute inset-0 overflow-hidden"
              style={{ backgroundColor: "#1c242f" }}
            >
              <ChatWindow
                key={selectedId}
                conversationId={selectedId}
                realConversationId={resolveRealId(selectedId)}
                conversation={selectedConversation}
                onBack={handleBackToSidebar}
                initialMessages={messagesCache[selectedId] || []}
                onNewMessage={() => {}}
              />
            </motion.div>
          ) : (
            <motion.div
              key="sidebar"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0"
              style={{ backgroundColor: "#1c242f" }}
            >
              <ChatSidebar
                currentUser={session?.user}
                conversations={conversations}
                selectedId={selectedId}
                unreadCounts={unreadCounts}
                onSelect={handleSelectConversation}
                onConversationCreated={handleConversationCreated}
                mobileInitialView={mobileTab}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Докбар — скрываем когда открыт чат ── */}
      <AnimatePresence>
        {!showChatOnMobile && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className="shrink-0"
            style={{ backgroundColor: "#1c242f", borderTop: "0.5px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-stretch">
              <DockButton
                label="Чаты"
                icon={<MessageSquare size={23} />}
                active={mobileTab === "chats"}
                badge={totalUnread > 0 ? totalUnread : undefined}
                onClick={() => { setMobileTab("chats"); setShowChatOnMobile(false) }}
              />
              <DockButton
                label="Настройки"
                icon={<Settings size={23} />}
                active={mobileTab === "settings"}
                onClick={() => { setMobileTab("settings"); setShowChatOnMobile(false) }}
              />
              <DockButton
                label="Профиль"
                icon={<User size={23} />}
                active={mobileTab === "profile"}
                avatar={session?.user?.image || null}
                avatarLetter={session?.user?.name?.[0]?.toUpperCase() || "?"}
                onClick={() => { setMobileTab("profile"); setShowChatOnMobile(false) }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Кнопка докбара — стиль Telegram ───────────────────────────
function DockButton({ label, icon, active, badge, avatar, avatarLetter, onClick }: {
  label: string
  icon: React.ReactNode
  active: boolean
  badge?: number
  avatar?: string | null
  avatarLetter?: string
  onClick: () => void
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className="flex-1 flex flex-col items-center justify-center gap-[5px] py-[10px] relative"
    >
      {/* Активный фон — подсветка на всю кнопку */}
      <AnimatePresence>
        {active && (
          <motion.div
            layoutId="tg-dock-pill"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 500, damping: 38 }}
            className="absolute inset-x-1 inset-y-1 rounded-[16px]"
            style={{ backgroundColor: `${ACCENT}25` }}
          />
        )}
      </AnimatePresence>

      {/* Иконка / аватар */}
      <div className="relative z-10">
        {avatar ? (
          <div
            className="w-[26px] h-[26px] rounded-full overflow-hidden border-2"
            style={{ borderColor: active ? ACCENT : "transparent" }}
          >
            <img src={avatar} className="w-full h-full object-cover" alt="" />
          </div>
        ) : avatarLetter && label === "Профиль" ? (
          <div
            className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-white text-[12px] font-bold"
            style={{ backgroundColor: active ? ACCENT : "#3a4a5e" }}
          >
            {avatarLetter}
          </div>
        ) : (
          <motion.div
            animate={{ color: active ? ACCENT : "#8896a5" }}
            transition={{ duration: 0.15 }}
          >
            {icon}
          </motion.div>
        )}

        {/* Бейдж */}
        {badge !== undefined && badge > 0 && (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute -top-[6px] -right-[8px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-white text-[10px] font-bold px-1"
            style={{ backgroundColor: ACCENT }}
          >
            {badge > 99 ? "99+" : badge}
          </motion.div>
        )}
      </div>

      {/* Подпись */}
      <motion.span
        animate={{ color: active ? ACCENT : "#8896a5" }}
        transition={{ duration: 0.15 }}
        className="text-[11px] font-medium relative z-10 leading-none"
      >
        {label}
      </motion.span>
    </motion.button>
  )
}
