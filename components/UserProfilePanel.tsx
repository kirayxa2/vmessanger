"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { ArrowLeft, AtSign, Info, Bell } from "lucide-react"
import { useTranslation } from "react-i18next"

const ACCENT = "#7e85e1"

interface UserProfilePanelProps {
  userId: string | number | null
  username?: string
  avatar?: string
  isOnline?: boolean
  onClose: () => void
  isMobile?: boolean
}

export default function UserProfilePanel({ userId, username, avatar, isOnline, onClose, isMobile }: UserProfilePanelProps) {
  const [profile, setProfile] = useState<{ bio?: string; createdAt?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()
  const [notifs, setNotifs] = useState(true)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    fetch(`/api/users/profile?userId=${userId}`)
      .then(r => r.json())
      .then(d => setProfile(d))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }, [userId])

  // Одинаковая анимация справа на обоих платформах
  // Мобильный — на весь экран, десктоп — 1/3 ширины
  return (
    <motion.div
      className="absolute top-0 right-0 bottom-0 z-50 flex flex-col bg-[#161e27] border-l border-white/5 shadow-2xl overflow-hidden"
      style={{ width: isMobile ? "100%" : "min(320px, 35%)" }}
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 34 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-[63px] border-b border-white/5 shrink-0">
        <motion.button onClick={onClose} whileTap={{ scale: 0.88 }}
          className="p-2 rounded-full hover:bg-white/10 text-white transition-colors">
          <ArrowLeft size={22} />
        </motion.button>
        <span className="text-white font-semibold text-[17px]">User Info</span>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {/* Avatar + name */}
        <div className="flex flex-col items-center gap-3 pt-8 pb-6 px-4 border-b border-white/5">
          <div className="relative">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white overflow-hidden shadow-xl"
              style={{ backgroundColor: ACCENT }}
            >
              {avatar
                ? <img src={avatar} className="w-full h-full object-cover" alt="avatar" />
                : username?.[0]?.toUpperCase()
              }
            </div>
            {isOnline && (
              <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-[#161e27]" />
            )}
          </div>
          <div className="text-center">
            <h3 className="text-white font-bold text-[20px] leading-tight">{username}</h3>
            <p className="text-[14px] mt-1" style={{ color: isOnline ? "#4ade80" : "#6b7280" }}>
              {isOnline ? t('online') : t('offline')}
            </p>
          </div>
        </div>

        {/* Info rows */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: `${ACCENT} transparent transparent transparent` }} />
          </div>
        ) : (
          <div className="py-2 border-b border-white/5">
            <div className="flex items-start gap-4 px-5 py-3">
              <AtSign size={18} className="text-gray-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-white text-[15px]">@{username?.toLowerCase()}</p>
                <p className="text-gray-500 text-[12px] mt-0.5">Username</p>
              </div>
            </div>
            {profile?.bio && (
              <div className="flex items-start gap-4 px-5 py-3">
                <Info size={18} className="text-gray-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white text-[15px] leading-snug">{profile.bio}</p>
                  <p className="text-gray-500 text-[12px] mt-0.5">Bio</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notifications toggle */}
        <div className="py-2 border-b border-white/5">
          <div
            onClick={() => setNotifs(p => !p)}
            className="flex items-center gap-4 px-5 py-4 cursor-pointer active:bg-white/5 transition-colors"
          >
            <Bell size={18} className="text-gray-500 shrink-0" />
            <span className="flex-1 text-white text-[15px]">Notifications</span>
            <motion.div
              className="w-10 h-5 rounded-full relative shrink-0"
              animate={{ backgroundColor: notifs ? ACCENT : "#374151" }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className="absolute top-[3px] w-[14px] h-[14px] bg-white rounded-full shadow"
                animate={{ left: notifs ? "calc(100% - 17px)" : "3px" }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </motion.div>
          </div>
        </div>

        {/* Media tabs */}
        <div className="flex border-b border-white/5">
          {["Posts", "Media", "Files", "Links"].map((tab, i) => (
            <button key={tab}
              className={`flex-1 py-3 text-[13px] font-medium transition-colors ${i === 0 ? "border-b-2" : ""}`}
              style={i === 0 ? { color: ACCENT, borderColor: ACCENT } : { color: "#6b7280" }}>
              {tab}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <p className="text-gray-600 text-[13px]">No media yet</p>
        </div>
      </div>
    </motion.div>
  )
}
