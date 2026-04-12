"use client"

import React, { useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Search, EllipsisVertical, Phone, Bookmark } from "lucide-react"
import { VerifiedBadge } from "../VerifiedBadge"
import TitleBadge from "../TitleBadge"

const ACCENT = "#7e85e1"

interface ChatHeaderProps {
  chatTitle: string
  isSavedChat: boolean
  isSystemChat: boolean
  isGroupChat: boolean
  isSpecialChat: boolean
  otherUser: any
  otherUserAvatar: string | null
  otherUserOnline: boolean
  isOtherTyping: boolean
  isOtherUserDev: boolean
  conversation: any
  onBack?: () => void
  onProfileClick: () => void
  onSearchClick: () => void
  onCallClick: () => void
  t: (key: string) => string
}

export default function ChatHeader({
  chatTitle, isSavedChat, isSystemChat, isGroupChat, isSpecialChat,
  otherUser, otherUserAvatar, otherUserOnline, isOtherTyping, isOtherUserDev,
  conversation, onBack, onProfileClick, onSearchClick, onCallClick, t
}: ChatHeaderProps) {
  const headerLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartX = useRef<number>(0)
  const touchStartY = useRef<number>(0)

  return (
    <div
      className="px-4 flex items-center justify-between h-[63px] bg-[#1c242f] relative z-10 cursor-pointer select-none"
      onClick={onProfileClick}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX
        touchStartY.current = e.touches[0].clientY
        headerLongPressTimerRef.current = setTimeout(() => {
          onSearchClick()
          if (navigator.vibrate) navigator.vibrate(50)
        }, 3000)
      }}
      onTouchEnd={() => {
        if (headerLongPressTimerRef.current) clearTimeout(headerLongPressTimerRef.current)
      }}
      onTouchMove={(e) => {
        if (headerLongPressTimerRef.current) {
          const dx = e.touches[0].clientX - touchStartX.current
          const dy = e.touches[0].clientY - touchStartY.current
          if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
            clearTimeout(headerLongPressTimerRef.current)
          }
        }
      }}
      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
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
          style={{ backgroundColor: isSavedChat ? "#4e8cde" : isSystemChat || isGroupChat ? "#7e85e1" : ACCENT }}
          whileHover={{ scale: 1.05 }}
        >
          {isSavedChat ? <Bookmark size={18} className="text-white" />
            : isSystemChat ? <img src="/logo (1).ico" alt="Vortex" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              : isGroupChat ? chatTitle?.[0]?.toUpperCase() || "G"
                : otherUserAvatar ? <img src={otherUserAvatar} alt="Avatar" className="w-full h-full object-cover" />
                  : otherUser?.username?.[0]?.toUpperCase() || "C"}
          <AnimatePresence>
            {!isSpecialChat && !isGroupChat && otherUserOnline && (
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
          ) : isGroupChat ? (
            <div>
              <h2 className="text-base font-bold truncate text-white leading-tight">{chatTitle}</h2>
              <p className="text-xs text-gray-400">Участники: {conversation?.participants?.length || 0}</p>
            </div>
          ) : (
            <>
              <h2 className="text-base font-bold text-white leading-tight flex items-center gap-1 flex-wrap">
                <span className="truncate">{chatTitle}</span>
                {isOtherUserDev && <VerifiedBadge size={18} />}
                <TitleBadge userId={otherUser?.id} className="mt-[1px]" />
              </h2>
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
                    {t('last_seen')}
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
            onClick={onCallClick}
            className="hover:text-white transition-colors p-2 rounded-full hover:bg-white/5"
            title="Аудиозвонок"
          >
            <Phone size={20} />
          </motion.button>
        )}
        <motion.button whileTap={{ scale: 0.88 }} onClick={onSearchClick}
          className="hidden sm:flex hover:text-white transition-colors p-2 rounded-full hover:bg-white/5">
          <Search size={20} />
        </motion.button>
        <motion.button whileTap={{ scale: 0.88 }} className="hover:text-white transition-colors p-2 rounded-full hover:bg-white/5">
          <EllipsisVertical size={20} />
        </motion.button>
      </div>
    </div>
  )
}
