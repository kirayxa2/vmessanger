"use client"

import { useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, AtSign, Info, MessageCircle, BellOff, Phone, Video, QrCode, X, Bell } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"

const ACCENT = "#7e85e1"

interface UserProfilePanelProps {
  userId: string | number | null
  username?: string
  avatar?: string
  isOnline?: boolean
  onClose: () => void
  isMobile?: boolean
  /** If provided, clicking "Chat" navigates to this conversation */
  conversationId?: string | number
}

export default function UserProfilePanel({
  userId,
  username,
  avatar,
  isOnline,
  onClose,
  isMobile,
  conversationId,
}: UserProfilePanelProps) {
  const [profile, setProfile] = useState<{ bio?: string; createdAt?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [muted, setMuted] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const { t } = useTranslation()
  const router = useRouter()

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    fetch(`/api/users/profile?userId=${userId}`)
      .then(r => r.json())
      .then(d => setProfile(d))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }, [userId])

  const handleChat = useCallback(() => {
    if (conversationId) {
      onClose()
      router.push(`/${conversationId}`)
    }
  }, [conversationId, router, onClose])

  const handleCall = useCallback(() => {
    // Trigger audio call — same as ChatWindow's startCall("audio")
    // Emit globally so ChatWindow can pick it up if open
    window.dispatchEvent(new CustomEvent("vortex:start-call", { detail: { userId, type: "audio" } }))
    onClose()
  }, [userId, onClose])

  const handleVideoCall = useCallback(() => {
    window.dispatchEvent(new CustomEvent("vortex:start-call", { detail: { userId, type: "video" } }))
    onClose()
  }, [userId, onClose])

  const profileUrl = typeof window !== "undefined"
    ? `${window.location.origin}/${userId}`
    : `https://vortex.app/${userId}`

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
        <motion.button
          onClick={onClose}
          whileTap={{ scale: 0.88 }}
          className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
        >
          <ArrowLeft size={22} />
        </motion.button>
        <span className="text-white font-semibold text-[17px] flex-1">User Info</span>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {/* ── Avatar + name block ── */}
        <div className="flex flex-col items-center gap-3 pt-8 pb-6 px-4 border-b border-white/5 relative">
          {/* Avatar */}
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

          {/* Name + username row with QR button */}
          <div className="flex items-center gap-2">
            <div className="text-center">
              <h3 className="text-white font-bold text-[20px] leading-tight">{username}</h3>
              <p className="text-[14px] mt-0.5" style={{ color: isOnline ? "#4ade80" : "#6b7280" }}>
                {isOnline ? t("online") : t("offline")}
              </p>
            </div>
            {/* QR mini-button */}
            <motion.button
              onClick={() => setShowQR(true)}
              whileTap={{ scale: 0.85 }}
              className="ml-1 p-2 rounded-xl bg-white/8 hover:bg-white/14 text-gray-400 hover:text-white transition-colors"
              title="Show QR code"
            >
              <QrCode size={18} />
            </motion.button>
          </div>

          {/* ── 4 action buttons (Telegram-style) ── */}
          <div className="flex gap-3 mt-3 w-full justify-center">
            {[
              {
                icon: <MessageCircle size={22} />,
                label: "Chat",
                onClick: handleChat,
                disabled: !conversationId,
              },
              {
                icon: muted ? <BellOff size={22} /> : <Bell size={22} />,
                label: muted ? "Unmute" : "Mute",
                onClick: () => setMuted(p => !p),
                active: muted,
              },
              {
                icon: <Phone size={22} />,
                label: "Call",
                onClick: handleCall,
              },
              {
                icon: <Video size={22} />,
                label: "Video",
                onClick: handleVideoCall,
              },
            ].map(btn => (
              <motion.button
                key={btn.label}
                onClick={btn.onClick}
                whileTap={{ scale: 0.9 }}
                disabled={btn.disabled}
                className="flex flex-col items-center gap-1.5 flex-1 py-3 rounded-2xl transition-all disabled:opacity-30"
                style={{ backgroundColor: btn.active ? `${ACCENT}33` : "rgba(255,255,255,0.06)" }}
              >
                <span style={{ color: btn.active ? ACCENT : "rgba(255,255,255,0.8)" }}>{btn.icon}</span>
                <span className="text-[11px] font-medium" style={{ color: btn.active ? ACCENT : "#9ca3af" }}>
                  {btn.label}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* ── Bio + username — закруглённая карточка как в Telegram ── */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div
              className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: `${ACCENT} transparent transparent transparent` }}
            />
          </div>
        ) : (
          <div className="mx-4 my-4 rounded-2xl overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
            {/* Username row */}
            <div className="flex items-center gap-4 px-4 py-3.5 border-b border-white/5">
              <AtSign size={18} style={{ color: ACCENT }} className="shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-[15px] font-medium">@{username?.toLowerCase()}</p>
                <p className="text-gray-500 text-[12px] mt-0.5">Username</p>
              </div>
            </div>
            {/* Bio row — всегда показываем, даже если пустой */}
            <div className="flex items-start gap-4 px-4 py-3.5">
              <Info size={18} style={{ color: ACCENT }} className="shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-[15px] leading-snug">
                  {profile?.bio || <span className="text-gray-600 italic">No bio</span>}
                </p>
                <p className="text-gray-500 text-[12px] mt-0.5">Bio</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Media tabs ── */}
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

      {/* ── QR modal overlay ── */}
      <AnimatePresence>
        {showQR && (
          <motion.div
            className="absolute inset-0 z-[60] flex flex-col bg-[#161e27]"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            {/* QR header */}
            <div className="flex items-center gap-2 px-4 h-[63px] border-b border-white/5 shrink-0">
              <motion.button
                onClick={() => setShowQR(false)}
                whileTap={{ scale: 0.88 }}
                className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
              >
                <X size={22} />
              </motion.button>
              <span className="text-white font-semibold text-[17px]">QR Code</span>
            </div>

            {/* QR content */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
              {/* Card */}
              <div
                className="w-full max-w-[260px] rounded-[28px] p-6 flex flex-col items-center gap-4 shadow-2xl"
                style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #5b61b9 100%)` }}
              >
                {/* Avatar inside card */}
                <div className="w-16 h-16 rounded-full border-4 border-white overflow-hidden shadow-lg bg-white flex items-center justify-center">
                  {avatar
                    ? <img src={avatar} className="w-full h-full object-cover" alt="avatar" />
                    : <span className="text-2xl font-bold" style={{ color: ACCENT }}>{username?.[0]?.toUpperCase()}</span>
                  }
                </div>

                {/* QR code white box */}
                <div className="bg-white rounded-[20px] p-4 w-full flex flex-col items-center">
                  <QRCodeSVG
                    value={profileUrl}
                    size={160}
                    level="H"
                    includeMargin={false}
                    imageSettings={avatar ? {
                      src: avatar,
                      height: 32,
                      width: 32,
                      excavate: true,
                    } : undefined}
                  />
                  <p className="mt-4 text-[15px] font-bold tracking-tight text-gray-800">
                    @{username?.toUpperCase()}
                  </p>
                </div>
              </div>

              <p className="text-gray-500 text-[13px] text-center leading-relaxed px-4">
                Scan this code to open {username}&apos;s profile in Vortex
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
