"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Monitor, Smartphone, Tablet, Loader2, LogOut, Trash2, Wifi } from "lucide-react"
import { useSocket } from "@/app/ClientProviders"
import { useSession } from "next-auth/react"

const ACCENT = "var(--accent, #7e85e1)"

interface SessionData {
  id: string
  deviceName: string
  deviceType: string
  os?: string
  browser?: string
  ip?: string
  lastActive: string
  createdAt: string
}

function DeviceIcon({ type }: { type: string }) {
  if (type === "mobile") return <Smartphone size={22} className="text-white" />
  if (type === "tablet") return <Tablet size={22} className="text-white" />
  return <Monitor size={22} className="text-white" />
}

function formatLastActive(dateStr: string) {
  const d = new Date(dateStr)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return "Только что"
  if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
}

interface DevicesScreenProps {
  onBack: () => void
  currentSessionId: string
}

export default function DevicesScreen({ onBack, currentSessionId }: DevicesScreenProps) {
  const { socket } = useSocket()
  const { data: session } = useSession()
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [loading, setLoading] = useState(true)
  const [terminating, setTerminating] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/sessions?currentSessionId=${currentSessionId}`)
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const terminate = async (sessionId: string) => {
    setTerminating(sessionId)
    try {
      await fetch("/api/users/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, currentSessionId }),
      })
      // Notify that device via socket
      if (socket && session?.user?.id) {
        socket.emit("terminate-session", {
          targetUserId: session.user.id,
          sessionId,
        })
      }
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    } catch {}
    setTerminating(null)
  }

  const terminateAll = async () => {
    setTerminating("all")
    try {
      await fetch("/api/users/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terminateAll: true, currentSessionId }),
      })
      // Notify ALL other sessions
      if (socket && session?.user?.id) {
        socket.emit("terminate-session", {
          targetUserId: session.user.id,
          sessionId: null, // null means all except current on client side
        })
      }
      setSessions(prev => prev.filter(s => s.id === currentSessionId))
    } catch {}
    setTerminating(null)
  }

  const currentSession = sessions.find(s => s.id === currentSessionId)
  const otherSessions = sessions.filter(s => s.id !== currentSessionId)

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col bg-[#1c242f]"
      initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
    >
      {/* Header */}
      <div className="px-4 h-[63px] flex items-center gap-3 border-b border-white/5 shrink-0">
        <motion.button onClick={onBack} whileTap={{ scale: 0.9 }}
          className="p-2 -ml-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors">
          <ArrowLeft size={22} />
        </motion.button>
        <h2 className="text-[18px] font-bold text-white flex-1">Устройства</h2>
        {otherSessions.length > 0 && (
          <motion.button
            onClick={terminateAll}
            disabled={terminating === "all"}
            whileTap={{ scale: 0.9 }}
            className="text-red-400 text-[13px] font-medium hover:text-red-300 transition-colors px-2"
          >
            {terminating === "all" ? <Loader2 size={14} className="animate-spin" /> : "Завершить все"}
          </motion.button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center pt-20">
            <Loader2 size={28} className="animate-spin" style={{ color: ACCENT }} />
          </div>
        ) : (
          <>
            {/* Current device */}
            {currentSession && (
              <>
                <div className="pt-5 pb-2 px-5">
                  <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
                    Текущее устройство
                  </p>
                </div>
                <div className="mx-3 rounded-2xl overflow-hidden" style={{ backgroundColor: "#1a2332" }}>
                  <div className="px-4 py-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0"
                      style={{ backgroundColor: ACCENT }}>
                      <DeviceIcon type={currentSession.deviceType} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-[15px] font-semibold truncate">{currentSession.deviceName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        <span className="text-[12px] text-green-400">Онлайн сейчас</span>
                      </div>
                      {currentSession.ip && (
                        <p className="text-[11px] text-gray-600 mt-0.5 flex items-center gap-1">
                          <Wifi size={10} /> {currentSession.ip}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Other devices */}
            {otherSessions.length > 0 && (
              <>
                <div className="pt-5 pb-2 px-5">
                  <p className="text-[12px] font-semibold uppercase tracking-wider text-gray-500">
                    Другие устройства
                  </p>
                </div>
                <div className="mx-3 rounded-2xl overflow-hidden" style={{ backgroundColor: "#1a2332" }}>
                  <AnimatePresence>
                    {otherSessions.map((s, i) => (
                      <motion.div
                        key={s.id}
                        exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                        transition={{ duration: 0.25 }}
                        className={`px-4 py-4 flex items-center gap-4 ${i < otherSessions.length - 1 ? "border-b border-white/5" : ""}`}
                      >
                        <div className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 bg-[#2d3f57]">
                          <DeviceIcon type={s.deviceType} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-[15px] font-medium truncate">{s.deviceName}</p>
                          <p className="text-[12px] text-gray-500 mt-0.5">{formatLastActive(s.lastActive)}</p>
                          {s.ip && (
                            <p className="text-[11px] text-gray-600 mt-0.5 flex items-center gap-1">
                              <Wifi size={10} /> {s.ip}
                            </p>
                          )}
                        </div>
                        <motion.button
                          onClick={() => terminate(s.id)}
                          disabled={terminating === s.id}
                          whileTap={{ scale: 0.88 }}
                          className="p-2 rounded-full hover:bg-red-500/15 text-red-400 transition-colors shrink-0"
                          title="Завершить сессию"
                        >
                          {terminating === s.id
                            ? <Loader2 size={18} className="animate-spin" />
                            : <LogOut size={18} />
                          }
                        </motion.button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <p className="px-5 pt-3 text-[12px] text-gray-600 leading-relaxed">
                  Если вы не узнаёте устройство — завершите сессию и смените пароль.
                </p>
              </>
            )}

            {otherSessions.length === 0 && !loading && (
              <div className="pt-10 flex flex-col items-center gap-3 text-gray-600">
                <Monitor size={48} strokeWidth={1} />
                <p className="text-[14px]">Нет других активных сессий</p>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}
