"use client"

import { motion } from "framer-motion"
import { X, Users, MessageSquare, User } from "lucide-react"
import { useTranslation } from "react-i18next"
import TitleBadge from "./TitleBadge"

interface Participant {
  userId: string | number
  role: string
  user: {
    id: string | number
    username: string
    avatar?: string
    bio?: string
    lastSeen?: string
  }
}

interface GroupProfilePanelProps {
  conversationId: string | number
  name: string
  participants: Participant[]
  currentUserId: string | number
  onClose: () => void
  isMobile: boolean
  onUserClick?: (userId: string | number) => void
}

const ACCENT = "var(--accent, #7e85e1)"
const DEV_USER_ID = 1

export default function GroupProfilePanel({ name, participants, currentUserId, onClose, isMobile, onUserClick }: GroupProfilePanelProps) {
  const { t } = useTranslation()

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className={`
        bg-[#1c242f] border-l border-white/5 flex flex-col z-50 shrink-0 shadow-2xl
        ${isMobile ? 'fixed inset-0 w-full' : 'w-[320px] h-full'}
      `}
    >
      <div className="h-[60px] px-4 flex items-center justify-between border-b border-white/5 shrink-0 bg-[#1c242f]/80 backdrop-blur-md">
        <h2 className="text-[17px] font-bold text-white tracking-wide">Информация о группе</h2>
        <motion.button onClick={onClose} whileTap={{ scale: 0.9 }} className="p-2 rounded-full hover:bg-white/10 text-gray-400">
          <X size={20} />
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar pb-8">
        <div className="p-6 flex flex-col items-center border-b border-white/5 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}
            className="w-28 h-28 rounded-full mb-4 flex items-center justify-center text-4xl font-bold text-white shadow-xl border-4 border-[#1c242f] relative z-10"
            style={{ backgroundColor: "#7e85e1" }}>
            {name?.[0]?.toUpperCase() || "G"}
          </motion.div>
          
          <motion.h3 initial={{ y: 5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
            className="text-[22px] font-bold text-white tracking-tight text-center relative z-10">
            {name}
          </motion.h3>
          
          <motion.p initial={{ y: 5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
            className="text-[14px] text-gray-400 flex items-center gap-1.5 mt-1 relative z-10">
            <Users size={14} /> Участники: {participants.length}
          </motion.p>
        </div>

        <div className="p-4">
          <h4 className="text-[13px] font-semibold text-[#7e85e1] uppercase tracking-wider mb-2 ml-1">Список участников</h4>
          <div className="flex flex-col gap-1">
            {participants.map((p, index) => {
              const u = p.user
              const isDevUser = u?.id !== undefined && (u.id === DEV_USER_ID || u.id === DEV_USER_ID.toString() || Number(u.id) === DEV_USER_ID)
              const isCurrentUser = String(u.id) === String(currentUserId)
              
              return (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + index * 0.05 }}
                  onClick={() => {
                    if (onUserClick && !isCurrentUser) {
                      onUserClick(u.id)
                    }
                  }}
                  className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${!isCurrentUser ? 'cursor-pointer hover:bg-white/5' : 'opacity-80'}`}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0 overflow-hidden" 
                    style={{ backgroundColor: ACCENT }}>
                    {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.username?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[15px] font-semibold text-white truncate">{u.username}</p>
                      {isDevUser && <span className="text-[#3b82f6] shrink-0" title="Владелец"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.9 14.7L6 12.6l1.4-1.4 2.7 2.7 6.5-6.5 1.4 1.4-7.9 7.9z"/></svg></span>}
                      {isCurrentUser && <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300 ml-1">Вы</span>}
                      <TitleBadge userId={u.id} />
                      {p.role === "admin" && <span className="text-[10px] bg-[#7e85e1]/20 text-[#7e85e1] px-1.5 py-0.5 rounded ml-1">Admin</span>}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
