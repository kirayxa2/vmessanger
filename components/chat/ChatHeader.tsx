"use client"

import React, { useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Search, EllipsisVertical, Phone, Bookmark, BellOff, BellRing, Trash2, X } from "lucide-react"
import { VerifiedBadge } from "../VerifiedBadge"
import TitleBadge from "../TitleBadge"

const ACCENT = "var(--accent, #7e85e1)"

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
  isMuted?: boolean
  onBack?: () => void
  onProfileClick: () => void
  onSearchClick: () => void
  onCallClick: () => void
  onMute?: (mute: boolean) => void
  onClearChat?: (forBoth: boolean) => void
  onDeleteChat?: () => void
  t: (key: string) => string
}

// Модальное окно подтверждения
function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onCancel, extra }: {
  title: string
  message?: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
  extra?: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        className="relative rounded-2xl p-6 w-full max-w-sm shadow-2xl z-10"
        style={{ backgroundColor: "#1a2332" }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-white font-bold text-[17px] mb-2">{title}</h3>
        {message && <p className="text-gray-400 text-[14px] leading-relaxed mb-4">{message}</p>}
        {extra}
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-white text-[14px] font-medium transition-colors"
            style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
            Отмена
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-white text-[14px] font-bold transition-colors"
            style={{ backgroundColor: danger ? "#e53935" : ACCENT }}>
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function ChatHeader({
  chatTitle, isSavedChat, isSystemChat, isGroupChat, isSpecialChat,
  otherUser, otherUserAvatar, otherUserOnline, isOtherTyping, isOtherUserDev,
  conversation, isMuted, onBack, onProfileClick, onSearchClick, onCallClick,
  onMute, onClearChat, onDeleteChat, t
}: ChatHeaderProps) {
  const headerLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartX = useRef<number>(0)
  const touchStartY = useRef<number>(0)
  const [showMenu, setShowMenu] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [clearForBoth, setClearForBoth] = useState(false)

  const otherName = otherUser?.displayName || otherUser?.username || chatTitle

  return (
    <div
      className="px-4 flex items-center justify-between h-[63px] bg-[var(--header-bg)] relative z-10 cursor-pointer select-none"
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

        {/* Three dots menu */}
        <div className="relative">
          <motion.button whileTap={{ scale: 0.88 }}
            onClick={() => setShowMenu(v => !v)}
            className="hover:text-white transition-colors p-2 rounded-full hover:bg-white/5">
            <EllipsisVertical size={20} />
          </motion.button>

          <AnimatePresence>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-[90]" onClick={() => setShowMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -8 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="absolute right-0 top-full mt-1 w-52 rounded-2xl shadow-2xl overflow-hidden z-[100] py-1"
                  style={{ backgroundColor: "#1e2d40" }}
                >
                  {/* Уведомления */}
                  {!isSpecialChat && onMute && (
                    <button
                      onClick={() => { onMute(!isMuted); setShowMenu(false) }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                    >
                      {isMuted
                        ? <BellRing size={18} className="text-gray-400 shrink-0" />
                        : <BellOff size={18} className="text-gray-400 shrink-0" />
                      }
                      <span className="text-white text-[14px]">
                        {isMuted ? "Включить уведомления" : "Отключить уведомления"}
                      </span>
                    </button>
                  )}

                  {/* Очистить чат */}
                  {!isSpecialChat && onClearChat && (
                    <button
                      onClick={() => { setShowMenu(false); setShowClearModal(true) }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                    >
                      <Trash2 size={18} className="text-orange-400 shrink-0" />
                      <span className="text-orange-400 text-[14px]">Очистить чат</span>
                    </button>
                  )}

                  {/* Разделитель */}
                  {!isSpecialChat && onDeleteChat && (
                    <div className="mx-3 my-1 h-px bg-white/5" />
                  )}

                  {/* Удалить чат */}
                  {!isSpecialChat && onDeleteChat && (
                    <button
                      onClick={() => { setShowMenu(false); setShowDeleteModal(true) }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition-colors text-left"
                    >
                      <X size={18} className="text-red-400 shrink-0" />
                      <span className="text-red-400 text-[14px]">Удалить чат</span>
                    </button>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Модаль очистки чата */}
      <AnimatePresence>
        {showClearModal && (
          <ConfirmModal
            title="Очистить историю чата?"
            confirmLabel="Очистить"
            danger
            onCancel={() => { setShowClearModal(false); setClearForBoth(false) }}
            onConfirm={() => {
              onClearChat?.(clearForBoth)
              setShowClearModal(false)
              setClearForBoth(false)
            }}
            extra={
              !isGroupChat && (
                <button
                  onClick={() => setClearForBoth(v => !v)}
                  className="flex items-center gap-3 w-full py-3 px-1"
                >
                  <div
                    className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      borderColor: clearForBoth ? ACCENT : "rgba(255,255,255,0.3)",
                      backgroundColor: clearForBoth ? ACCENT : "transparent"
                    }}
                  >
                    {clearForBoth && <svg width="12" height="9" viewBox="0 0 12 9" fill="none"><path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <span className="text-white text-[14px]">
                    Очистить также у <span style={{ color: ACCENT }}>{otherName}</span>
                  </span>
                </button>
              )
            }
          />
        )}
      </AnimatePresence>

      {/* Модаль удаления чата */}
      <AnimatePresence>
        {showDeleteModal && (
          <ConfirmModal
            title="Удалить чат?"
            message="История будет удалена только для вас. Собеседник всё ещё видит переписку."
            confirmLabel="Удалить"
            danger
            onCancel={() => setShowDeleteModal(false)}
            onConfirm={() => {
              onDeleteChat?.()
              setShowDeleteModal(false)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
