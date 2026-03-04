"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import ChatWindow from "@/components/ChatWindow"
import ChatSidebar from "@/components/ChatSidebar"
import { Loader2 } from "lucide-react"
import { useSocket } from "./ClientProviders"
import TitleBar from "@/components/TitleBar"

export default function HomePage({ conversationId }: { conversationId?: string }) {
  const { data: session, status } = useSession()
  const { socket } = useSocket()
  const router = useRouter()
  const [conversations, setConversations] = useState<any[]>([])
  const [messagesCache, setMessagesCache] = useState<{ [key: string]: any[] }>({})
  const [selectedId, setSelectedId] = useState<string | null>(conversationId || null)
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({})
  const [loading, setLoading] = useState(true)
  const [showChatOnMobile, setShowChatOnMobile] = useState(false)
  const isFetching = useRef(false)
  const selectedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (conversationId) {
      setSelectedId(conversationId)
      setShowChatOnMobile(true)
    }
  }, [conversationId])

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  const ensureSpecialChats = useCallback(async () => {
    // Make sure Saved Messages and Vortex system chat exist for this user
    await Promise.all([
      fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "saved" }),
      }),
      fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "system" }),
      }),
    ])
  }, [])

  // Virtual IDs — like Telegram:
  // system chat = 777000 for everyone
  // saved chat = user's own ID (same concept as writing to yourself)
  const SYSTEM_VIRTUAL_ID = "777000"
  const SAVED_VIRTUAL_ID: string = session?.user?.id?.toString() ?? "saved"

  // Maps: virtualId -> realDbId (for API calls)
  const virtualToReal = useRef<Record<string, string>>({})
  // Maps: realDbId -> virtualId (for display)
  const realToVirtual = useRef<Record<string, string>>({})

  // Patch conversations — replace real IDs of special chats with virtual IDs
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

  // Resolve virtual ID -> real DB ID for API calls
  const resolveRealId = useCallback((id: string) => {
    return virtualToReal.current[id] ?? id
  }, [])

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

      if (!selectedId && allChats.length > 0) {
        if (window.innerWidth >= 768) {
          const saved = allChats.find((c: any) => c.type === "saved")
          setSelectedId(saved ? saved.id.toString() : allChats[0].id.toString())
        }
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
          setUnreadCounts(prev => ({
            ...prev,
            [message.conversationId]: (prev[message.conversationId] || 0) + 1,
          }))
        }

        setConversations(prev =>
          prev.map(c =>
            c.id.toString() === message.conversationId.toString()
              ? { ...c, messages: [message] }
              : c
          )
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
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status === "authenticated") {
      fetchConversations()
    }
  }, [status, router, fetchConversations])

  const handleSelectConversation = (id: string) => {
    setSelectedId(id)
    setShowChatOnMobile(true)
    setUnreadCounts(prev => ({ ...prev, [id]: 0 }))
    if (typeof window !== "undefined") {
      window.history.pushState({ conversationId: id }, "", `/${id}`)
    }
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
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    )
  }

  const selectedConversation = conversations.find(c => c.id?.toString() === selectedId?.toString())

  return (
    <div className="flex h-[100dvh] w-full bg-[#070d14] overflow-hidden fixed inset-0 p-2 md:p-3 gap-2 md:gap-3">
      {/* Sidebar */}
      <div
        className={`w-full md:w-[420px] h-full ${
          showChatOnMobile ? "hidden md:flex" : "flex"
        } flex-col shrink-0 overflow-hidden rounded-2xl md:rounded-3xl bg-[#1c242f] shadow-2xl border border-white/5`}
      >
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

      {/* Main Chat Area */}
      <div
        className={`flex-1 flex flex-col relative h-full ${
          !showChatOnMobile ? "hidden md:flex" : "flex"
        } overflow-hidden rounded-2xl md:rounded-3xl bg-[#1c242f] shadow-2xl border border-white/5`}
      >
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
              <p className="text-gray-400 text-sm">Select a chat to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
