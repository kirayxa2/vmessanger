"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { X, AtSign, Info, Bell } from "lucide-react"
import { useTranslation } from "react-i18next"

const ACCENT = "#7e85e1"

interface UserProfilePanelProps {
  userId: string | number | null
  username?: string
  avatar?: string
  isOnline?: boolean
  onClose: () => void
}

export default function UserProfilePanel({ userId, username, avatar, isOnline, onClose }: UserProfilePanelProps) {
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

  const joined = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString([], { month: 'long', year: 'numeric' })
    : null

  return (
    // Анимируем width — flex-сосед (чат) плавно сжимается вместе
    <motion.div
      className="h-full flex flex-col bg-[#161e27] border-l border-white/5 overflow-hidden shrink-0"
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 300, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      style={{ minWidth: 0 }}
    >
      {/* Всё содержимое в фиксированной ширине, чтобы не ломалось при анимации */}
      <div className="w-[300px] h-full flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 h-[63px] border-b border-white/5 shrink-0">
          <span className="text-white font-semibold text-[16px]">User Info</span>
          <div className="flex items-center gap-1">
            <motion.button
              whileTap={{ scale: 0.88 }}
              className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              {/* Add contact icon placeholder */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </motion.button>
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.88 }}
              className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </motion.button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar">

          {/* Avatar + name block */}
          <div className="flex flex-col items-center gap-3 pt-8 pb-6 px-4 border-b border-white/5">
            <div className="relative">
              <div
                className="w-[88px] h-[88px] rounded-full flex items-center justify-center text-3xl font-bold text-white overflow-hidden shadow-xl"
                style={{ backgroundColor: ACCENT }}
              >
                {avatar
                  ? <img src={avatar} className="w-full h-full object-cover" alt="avatar" />
                  : username?.[0]?.toUpperCase()
                }
              </div>
              {isOnline && (
                <div className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-green-400 rounded-full border-2 border-[#161e27]" />
              )}
            </div>

            <div className="text-center">
              <h3 className="text-white font-bold text-[18px] leading-tight">{username}</h3>
              <p className="text-[13px] mt-0.5" style={{ color: isOnline ? "#4ade80" : "#6b7280" }}>
                {isOnline ? "online" : "last seen recently"}
              </p>
            </div>
          </div>

          {/* Info rows — Telegram style */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: `${ACCENT} transparent transparent transparent` }} />
            </div>
          ) : (
            <div className="py-2 border-b border-white/5">
              {/* Username */}
              <div className="flex items-start gap-4 px-5 py-3">
                <AtSign size={18} className="text-gray-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white text-[15px]">@{username?.toLowerCase()}</p>
                  <p className="text-gray-500 text-[12px] mt-0.5">Username</p>
                </div>
              </div>

              {/* Bio */}
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
              className="flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <Bell size={18} className="text-gray-500 shrink-0" />
              <span className="flex-1 text-white text-[15px]">Notifications</span>
              {/* Toggle */}
              <motion.div
                className="w-10 h-5 rounded-full relative"
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

          {/* Tabs placeholder — Posts, Media, Files etc */}
          <div className="flex border-b border-white/5">
            {["Posts", "Media", "Files", "Links"].map((tab, i) => (
              <button
                key={tab}
                className={`flex-1 py-3 text-[13px] font-medium transition-colors ${i === 0 ? "border-b-2" : ""}`}
                style={i === 0 ? { color: ACCENT, borderColor: ACCENT } : { color: "#6b7280" }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Empty media state */}
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <p className="text-gray-600 text-[13px]">No media yet</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
