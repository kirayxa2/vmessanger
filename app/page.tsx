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

const ACCENT = "#7e85e1"

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

  const [conversations, setConversations] = useState<any[]>([])
  const [messagesCache, setMessagesCache] = useState<{ [key: string]: any[] }>({})
  const [selectedId, setSelectedId] = useState<string | null>(conversationId || null)
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({})
  const [loading, setLoading] = useState(true)
  const [showChatOnMobile, setShowChatOnMobile] = useState(false)

  // Мобильные вкладки докбара
  // "chats" | "settings" | "profile"
  const [mobileTab, setMobileTab] = useState<"chats" | "settings" | "profile">("chats")

  const isFetching = useRef(false)
  const selectedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (conversationId) {
      setSelectedId(conversationId)
      setShowChatOnMobile(true)
    }
  }, [conversationId])

  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  const ensureSpecialChats = useCallback(async () => {
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

  const fetchConversations = useCallback(async () => {
    if (isFetching.current) return
    isFetching.current = true
    try {
      await ensureSpecialChats()
      const response = await fetch("/api/conversations")
      const data = await response.json()
      const raw = Array.isArray(data) ? data.filter((c: any) => c.id != null) : []
      const allChats = applyVirtualIds(raw)
      setConversations(allChats)
      if (!selectedId && allChats.length > 0 && window.innerWidth >= 768) {
        const saved = allChats.find((c: any) => c.type === "saved")
        setSelectedId(saved ? saved.id.toString() : allChats[0].id.toString())
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error)
    } finally {
      setLoading(false)
      isFetching.current = false
    }
  }, [selectedId, ensureSpecialChats, applyVirtualIds])

  useEffect(() => {
    if (status === "authenticated" && socket && conversations.length > 0) {
      conversations.forEach(c => {
        if (c.id != null) socket.emit("join-conversation", c.id.toString())
      })
    }
  }, [status, socket, conversations])

  useEffect(() => {
    if (status === "authenticated" && socket) {
      const handleNewMessage = (message: any) => {
        setMessagesCache(prev => ({
          ...prev,
          [message.conversationId]: [...(prev[message.conversationId] || []), message],
        }))
        if (
          message.conversationId.toString() !== selectedIdRef.current?.toString() &&
          message.sender.id.toString() !== session?.user?.id?.toString()
        ) {
          setUnreadCounts(prev => ({ ...prev, [message.conversationId]: (prev[message.conversationId] || 0) + 1 }))
        }
        setConversations(prev =>
          prev.map(c => c.id.toString() === message.conversationId.toString() ? { ...c, messages: [message] } : c)
        )
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
      socket.on("new-message-global", handleNewMessage)
      socket.on("user-avatar-updated", handleAvatarUpdate)
      return () => {
        socket.off("new-message-global", handleNewMessage)
        socket.off("user-avatar-updated", handleAvatarUpdate)
      }
    }
  }, [status, socket, session?.user?.id])

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return }
    if (status === "authenticated") fetchConversations()
  }, [status, router, fetchConversations])

  const handleSelectConversation = (id: string) => {
    setSelectedId(id)
    setShowChatOnMobile(true)
    setUnreadCounts(prev => ({ ...prev, [id]: 0 }))
    if (typeof window !== "undefined") window.history.pushState({ conversationId: id }, "", `/${id}`)
  }

  const handleConversationCreated = (conversation: any) => {
    setConversations(prev => {
      if (prev.find(c => c.id.toString() === conversation.id.toString())) return prev
      return [conversation, ...prev]
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
      <div className="flex h-[100dvh] w-full bg-[#070d14] overflow-hidden fixed inset-0 p-2 md:p-3 gap-2 md:gap-3">
        <div className="w-full md:w-[420px] h-full flex flex-col shrink-0 overflow-hidden rounded-2xl md:rounded-3xl bg-[#1c242f] shadow-2xl border border-white/5">
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
        <div className="flex-1 flex flex-col relative h-full overflow-hidden rounded-2xl md:rounded-3xl bg-[#1c242f] shadow-2xl border border-white/5">
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
  // Структура: весь контент + докбар внизу
  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#0a0f17] overflow-hidden fixed inset-0">

      {/* ── Основной контент ── */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">

          {/* Открытый чат */}
          {showChatOnMobile && selectedId ? (
            <motion.div
              key="chat"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.9 }}
              className="absolute inset-0 bg-[#1c242f]"
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
            /* Вкладки сайдбара — не пересоздаём компонент, просто меняем проп */
            <motion.div
              key="sidebar"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-[#1c242f]"
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
            className="shrink-0 px-4 pb-4 pt-2"
            style={{ backgroundColor: "#0a0f17" }}
          >
            {/* Капсула-докбар */}
            <div
              className="flex items-center justify-around rounded-[28px] px-2 py-2"
              style={{
                backgroundColor: "#1c242f",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
              }}
            >
              {/* Чаты */}
              <DockButton
                label="Чаты"
                icon={<MessageSquare size={22} />}
                active={mobileTab === "chats"}
                badge={totalUnread > 0 ? totalUnread : undefined}
                avatar={null}
                onClick={() => { setMobileTab("chats"); setShowChatOnMobile(false) }}
              />

              {/* Настройки */}
              <DockButton
                label="Настройки"
                icon={<Settings size={22} />}
                active={mobileTab === "settings"}
                onClick={() => { setMobileTab("settings"); setShowChatOnMobile(false) }}
              />

              {/* Профиль */}
              <DockButton
                label="Профиль"
                icon={<User size={22} />}
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

// ── Кнопка докбара ────────────────────────────────────────────
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
      whileTap={{ scale: 0.88 }}
      className="flex flex-col items-center gap-1 px-5 py-1.5 rounded-2xl relative transition-colors"
      style={{ minWidth: 72 }}
    >
      {/* Активный фон */}
      {active && (
        <motion.div
          layoutId="dock-active"
          className="absolute inset-0 rounded-2xl"
          style={{ backgroundColor: `${ACCENT}22` }}
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}

      {/* Иконка / аватар */}
      <div className="relative">
        {avatar ? (
          // Профиль — круглая аватарка
          <div
            className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-white text-[13px] font-bold"
            style={{ backgroundColor: active ? ACCENT : "#2d3f57" }}
          >
            <img src={avatar} className="w-full h-full object-cover" alt="" />
          </div>
        ) : avatarLetter && label === "Профиль" ? (
          // Профиль без фото — буква в кружке
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[13px] font-bold"
            style={{ backgroundColor: active ? ACCENT : "#2d3f57" }}
          >
            {avatarLetter}
          </div>
        ) : (
          // Обычная иконка
          <div style={{ color: active ? ACCENT : "#6b7280" }}>
            {icon}
          </div>
        )}

        {/* Бейдж непрочитанных */}
        {badge !== undefined && badge > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-white text-[10px] font-bold px-1"
            style={{ backgroundColor: ACCENT }}
          >
            {badge > 99 ? "99+" : badge}
          </motion.div>
        )}
      </div>

      {/* Подпись */}
      <span
        className="text-[11px] font-medium relative z-10"
        style={{ color: active ? ACCENT : "#6b7280" }}
      >
        {label}
      </span>
    </motion.button>
  )
}
