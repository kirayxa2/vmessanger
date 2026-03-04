"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useSession, signOut } from "next-auth/react"
import {
  Search, Menu, LogOut, Moon, Globe, Bookmark,
  ArrowLeft, Camera, Loader2, Check, X, AtSign, Info,
  Bell, Shield, Folder, Monitor, ChevronRight, Edit3, User, ShieldAlert
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useSocket } from "@/app/ClientProviders"
import { motion, AnimatePresence } from "framer-motion"
import { VerifiedBadge } from "./VerifiedBadge"
import { useProfanityFilter } from "@/hooks/useProfanityFilter"

const ACCENT = "#7e85e1"

// ── Toggle Switch компонент ────────────────────────────────────
function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <motion.button
      onClick={onToggle}
      className="relative w-12 h-6 rounded-full shrink-0 focus:outline-none"
      style={{ backgroundColor: enabled ? ACCENT : "rgba(255,255,255,0.15)" }}
      whileTap={{ scale: 0.92 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="absolute top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow-sm"
        animate={{ left: enabled ? "calc(100% - 21px)" : "3px" }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </motion.button>
  )
}

// ── Reusable UI ────────────────────────────────────────────────
const DropdownItem = ({ icon, label, isToggle, toggleEnabled, danger, onClick }: {
  icon: React.ReactNode; label: string; isToggle?: boolean; toggleEnabled?: boolean; danger?: boolean; onClick?: () => void
}) => (
  <div
    onClick={onClick}
    className={`px-3 py-[7px] mx-1 rounded-lg flex items-center gap-3 cursor-pointer transition-colors ${
      danger ? "hover:bg-red-500/10" : "hover:bg-white/5"
    }`}
  >
    <div className={`w-5 flex items-center justify-center shrink-0 ${danger ? "text-red-400" : "text-gray-400"}`}>
      {icon}
    </div>
    <span className={`flex-1 text-[14px] ${danger ? "text-red-400" : "text-white"}`}>{label}</span>
    {isToggle && (
      <div className="w-8 h-[18px] rounded-full relative shrink-0" style={{ backgroundColor: toggleEnabled ? ACCENT : "rgba(255,255,255,0.15)" }}>
        <div
          className="absolute top-[3px] w-3 h-3 bg-white rounded-full shadow-sm transition-all"
          style={{ left: toggleEnabled ? "calc(100% - 15px)" : "3px" }}
        />
      </div>
    )}
  </div>
)

const InfoRow = ({ icon, value, label }: { icon: React.ReactNode; value?: string; label: string }) => (
  <div className="flex items-start gap-4 px-6 py-3">
    <div className="text-gray-500 mt-0.5 shrink-0">{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-white text-[15px] font-medium break-words">
        {value || <span className="text-gray-600 italic">Не указано</span>}
      </p>
      <p className="text-gray-500 text-[12px] mt-0.5">{label}</p>
    </div>
  </div>
)

const SettingsRow = ({ icon, iconColor, label, badge, rightEl, onClick }: {
  icon: React.ReactNode; iconColor: string; label: string; badge?: string; rightEl?: React.ReactNode; onClick?: () => void
}) => (
  <div onClick={onClick} className="flex items-center gap-4 px-4 py-[13px] cursor-pointer hover:bg-white/5 transition-colors group">
    <div
      className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 text-white"
      style={{ backgroundColor: iconColor || "transparent" }}
    >
      {icon}
    </div>
    <span className="flex-1 text-[15px] text-white">{label}</span>
    {badge && <span className="text-[13px] text-gray-500">{badge}</span>}
    {rightEl ?? <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-400 transition-colors" />}
  </div>
)

// ── Floating label input ───────────────────────────────────────
const FloatInput = ({ label, value, onChange, multiline, maxLength, hint }: {
  label: string; value: string; onChange: (v: string) => void
  multiline?: boolean; maxLength?: number; hint?: string
}) => {
  const [focused, setFocused] = useState(false)
  const active = focused || value.length > 0
  return (
    <div className="flex flex-col gap-1">
      <div className="relative rounded-xl transition-all duration-200"
        style={{ border: `1.5px solid ${focused ? ACCENT : "rgba(255,255,255,0.12)"}` }}>
        <label
          className="absolute left-4 pointer-events-none transition-all duration-200 text-gray-400"
          style={{
            top: active ? "6px" : "50%",
            transform: active ? "none" : "translateY(-50%)",
            fontSize: active ? "11px" : "15px",
            color: focused ? ACCENT : undefined,
          }}
        >
          {label}
        </label>
        {multiline ? (
          <textarea value={value} onChange={e => onChange(e.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            maxLength={maxLength} rows={3}
            className="w-full bg-transparent text-white text-[15px] px-4 pt-6 pb-2 outline-none resize-none" />
        ) : (
          <input type="text" value={value} onChange={e => onChange(e.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            maxLength={maxLength}
            className="w-full bg-transparent text-white text-[15px] px-4 pt-6 pb-2 outline-none" />
        )}
        {maxLength && multiline && (
          <span className="absolute bottom-2 right-3 text-[11px] text-gray-500">{maxLength - value.length}</span>
        )}
      </div>
      {hint && <p className="text-[12px] text-gray-500 px-1">{hint}</p>}
    </div>
  )
}

// ── Edit Profile Screen ────────────────────────────────────────
function EditProfileScreen({ session, profile, onSave, onBack, isUploading, fileInputRef, onAvatarClick }: {
  session: any; profile: { username: string; bio: string }
  onSave: (data: { username: string; bio: string }) => Promise<void>
  onBack: () => void; isUploading: boolean
  fileInputRef: React.RefObject<HTMLInputElement>; onAvatarClick: () => void
}) {
  const { t } = useTranslation()
  const [username, setUsername] = useState(profile.username)
  const [bio, setBio] = useState(profile.bio)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const isDirty = username !== profile.username || bio !== profile.bio

  const handleSave = async () => {
    if (!isDirty) return
    setSaving(true); setError("")
    try { await onSave({ username, bio }) }
    catch (e: any) { setError(e.message || "Ошибка") }
    finally { setSaving(false) }
  }

  return (
    <motion.div className="absolute inset-0 z-50 flex flex-col bg-[#1c242f]"
      initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}>
      <div className="px-4 h-[63px] flex items-center gap-3 border-b border-white/5 shrink-0">
        <motion.button onClick={onBack} whileTap={{ scale: 0.9 }}
          className="p-2 -ml-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors">
          <ArrowLeft size={22} />
        </motion.button>
        <h2 className="text-[18px] font-bold text-white flex-1">{t("edit_profile")}</h2>
      </div>
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        <div className="pt-8 pb-6 flex justify-center border-b border-white/5">
          <motion.div onClick={onAvatarClick} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            className="relative w-[90px] h-[90px] rounded-full cursor-pointer overflow-hidden shadow-xl bg-[#2a3545]">
            {isUploading ? (
              <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-white" size={28} /></div>
            ) : session?.user?.image ? (
              <img src={session.user.image} className="w-full h-full object-cover" alt="avatar" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><User size={38} className="text-gray-500" /></div>
            )}
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1">
              <Camera size={22} className="text-white" />
              <span className="text-white text-[9px] font-semibold tracking-wide">PHOTO</span>
            </div>
          </motion.div>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <FloatInput label={t("first_name_label")} value={username} onChange={setUsername} maxLength={30} />
          <FloatInput label={t("bio_label")} value={bio} onChange={setBio} multiline maxLength={200} hint={t("bio_hint")} />
          {error && <p className="text-red-400 text-[13px] px-1">{error}</p>}
        </div>
        <div className="border-t border-white/5 px-5 py-5 flex flex-col gap-3">
          <p className="text-white text-[16px] font-bold">{t("username_label")}</p>
          <FloatInput label={t("username_label")} value={username} onChange={setUsername} maxLength={30} hint={t("username_hint")} />
        </div>
      </div>
      <AnimatePresence>
        {isDirty && (
          <motion.button onClick={handleSave} disabled={saving}
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            className="absolute bottom-6 right-6 w-14 h-14 rounded-full text-white flex items-center justify-center shadow-2xl z-10"
            style={{ backgroundColor: ACCENT }}>
            {saving ? <Loader2 size={24} className="animate-spin" /> : <Check size={26} strokeWidth={2.5} />}
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Privacy Screen (отдельный экран) ──────────────────────────
function PrivacyScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const { enabled, toggle } = useProfanityFilter()

  return (
    <motion.div className="absolute inset-0 z-50 flex flex-col bg-[#1c242f]"
      initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}>

      {/* Header */}
      <div className="px-4 h-[63px] flex items-center gap-3 border-b border-white/5 shrink-0">
        <motion.button onClick={onBack} whileTap={{ scale: 0.9 }}
          className="p-2 -ml-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors">
          <ArrowLeft size={22} />
        </motion.button>
        <h2 className="text-[18px] font-bold text-white flex-1">{t("privacy")}</h2>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar">

        {/* Секция: Контент */}
        <div className="pt-5 pb-1 px-5">
          <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
            {t("content_filter")}
          </p>
        </div>

        {/* Антимат */}
        <div className="mx-3 rounded-2xl overflow-hidden" style={{ backgroundColor: "#1a2332" }}>
          <div className="px-4 py-4 flex items-center gap-4">
            {/* Иконка */}
            <motion.div
              className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0"
              animate={{ backgroundColor: enabled ? ACCENT : "#2d3f57" }}
              transition={{ duration: 0.3 }}
            >
              <ShieldAlert size={20} color="white" />
            </motion.div>

            {/* Текст */}
            <div className="flex-1 min-w-0">
              <p className="text-[15px] text-white font-semibold leading-tight">{t("anti_profanity")}</p>
              <p className="text-[12px] text-gray-500 mt-0.5 leading-snug">{t("anti_profanity_hint")}</p>
            </div>

            {/* Переключатель */}
            <ToggleSwitch enabled={enabled} onToggle={toggle} />
          </div>

          {/* Пример — показывается только когда включено */}
          <AnimatePresence>
            {enabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mx-4 mb-4 px-3 py-2.5 rounded-xl" style={{ backgroundColor: "rgba(126,133,225,0.1)", border: "1px solid rgba(126,133,225,0.2)" }}>
                  <p className="text-[12px] text-gray-400 mb-1 font-medium">{t("example")}:</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] text-gray-300">«блять»</span>
                    <span className="text-gray-600">→</span>
                    <span className="text-[13px] font-mono" style={{ color: ACCENT }}>«*****»</span>
                    <span className="mx-1 text-gray-700">·</span>
                    <span className="text-[13px] text-gray-300">«fuck»</span>
                    <span className="text-gray-600">→</span>
                    <span className="text-[13px] font-mono" style={{ color: ACCENT }}>«****»</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="px-5 pt-2 pb-5 text-[12px] text-gray-600 leading-relaxed">
          {t("anti_profanity_desc")}
        </p>

      </div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════
// ── Main ChatSidebar ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

interface ChatSidebarProps {
  currentUser?: any
  conversations?: any[]
  selectedId?: string | null
  unreadCounts?: { [key: string]: number }
  onSelect?: (id: string) => void
  onConversationCreated?: (conversation: any) => void
  mobileInitialView?: "chats" | "settings" | "profile"
}

export default function ChatSidebar({
  onSelect, selectedId, conversations = [], unreadCounts = {}, onConversationCreated, currentUser, mobileInitialView
}: ChatSidebarProps) {
  const { data: session, update } = useSession()
  const { t, i18n } = useTranslation()
  const { socket } = useSocket()

  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  // mobileInitialView синхронизирует внутренний view с докбаром
  const [view, setView] = useState<"chats" | "settings">(
    mobileInitialView === "settings" || mobileInitialView === "profile" ? "settings" : "chats"
  )
  const [showEditProfile, setShowEditProfile] = useState(mobileInitialView === "profile")
  const [showPrivacy, setShowPrivacy] = useState(false)

  // Когда докбар меняет вкладку — обновляем view
  useEffect(() => {
    if (mobileInitialView === "settings") { setView("settings"); setShowEditProfile(false); setShowPrivacy(false) }
    else if (mobileInitialView === "profile") { setView("settings"); setShowEditProfile(true); setShowPrivacy(false) }
    else if (mobileInitialView === "chats") { setView("chats") }
  }, [mobileInitialView])
  const [globalUsers, setGlobalUsers] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [localConversations, setLocalConversations] = useState<any[]>(conversations)
  const isCreatingConversation = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<{ username: string; bio: string }>({ username: "", bio: "" })

  // ── Profanity filter state (для иконки в настройках) ──
  const { enabled: profanityEnabled } = useProfanityFilter()

  useEffect(() => {
    if (view === "settings") {
      fetch("/api/users/profile")
        .then(r => r.json())
        .then(d => setProfile({ username: d.username || session?.user?.name || "", bio: d.bio || "" }))
        .catch(() => {})
    }
  }, [view, session?.user?.name])

  const handleSaveProfile = useCallback(async (data: { username: string; bio: string }) => {
    const res = await fetch("/api/users/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Error") }
    const saved = await res.json()
    update({ name: saved.username })
    setProfile({ username: saved.username || data.username, bio: data.bio })
    setShowEditProfile(false)
  }, [update])

  useEffect(() => { setLocalConversations(conversations) }, [conversations])

  useEffect(() => {
    if (!socket) return
    const handleAvatarUpdate = (data: { userId: number; avatar: string }) => {
      setLocalConversations(prev => prev.map(conv => ({
        ...conv,
        participants: conv.participants.map((p: any) =>
          p.userId === data.userId ? { ...p, user: { ...p.user, avatar: data.avatar } } : p
        ),
      })))
    }
    socket.on("user-avatar-updated", handleAvatarUpdate)
    return () => { socket.off("user-avatar-updated", handleAvatarUpdate) }
  }, [socket])

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim() && isSearchActive) {
        setIsSearching(true)
        try {
          const res = await fetch(`/api/users/search?query=${encodeURIComponent(searchQuery)}`)
          const data = await res.json()
          setGlobalUsers(Array.isArray(data) ? data : [])
        } catch { setGlobalUsers([]) }
        finally { setIsSearching(false) }
      } else { setGlobalUsers([]) }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, isSearchActive])

  const handleUserClick = async (user: any) => {
    if (isCreatingConversation.current) return
    isCreatingConversation.current = true
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      })
      if (res.ok) {
        const conversation = await res.json()
        onConversationCreated?.(conversation)
        onSelect?.(conversation.id.toString())
        setIsSearchActive(false); setSearchQuery("")
      }
    } catch {}
    finally { isCreatingConversation.current = false }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch("/api/users/avatar", { method: "POST", body: formData })
      if (res.ok) {
        const data = await res.json()
        update({ image: data.avatar })
        if (socket && session?.user?.id) {
          socket.emit("avatar-update", { userId: parseInt(session.user.id), avatar: data.avatar })
        }
      }
    } catch {}
    finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = "" }
  }

  const sortedConversations = useMemo(() => {
    const seen = new Set<string>()
    const unique = localConversations.filter(c => {
      const key = c.id?.toString()
      if (!key || seen.has(key)) return false
      seen.add(key); return true
    })
    return unique.sort((a, b) => {
      if (a.type === "system" && b.type !== "system") return -1
      if (b.type === "system" && a.type !== "system") return 1
      if (a.type === "saved" && b.type !== "saved") return -1
      if (b.type === "saved" && a.type !== "saved") return 1
      const aTime = a.messages?.[0]?.createdAt || a.updatedAt
      const bTime = b.messages?.[0]?.createdAt || b.updatedAt
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })
  }, [localConversations])

  const filteredConversations = sortedConversations.filter(c => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    if (c.type === "saved") return "избранное".includes(q) || "saved messages".includes(q)
    if (c.type === "system") return "vortex".includes(q) || "безопасность".includes(q)
    return c.name?.toLowerCase().includes(q) ||
      c.participants?.some((p: any) => p.user.username.toLowerCase().includes(q))
  })

  const displayName = profile.username || session?.user?.name || ""
  const displayBio = profile.bio || ""

  // ── SETTINGS SCREEN ──────────────────────────────────────────
  if (view === "settings") {
  return (
    <div className="w-full h-full flex flex-col bg-[#0f1721] p-2 pb-0">
      <motion.div className="w-full h-full flex flex-col bg-[#1c242f] relative overflow-hidden rounded-[28px] border border-white/5 shadow-2xl"
        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />

        {/* Header */}
        <div className="px-4 h-[63px] flex items-center gap-3 border-b border-white/5 shrink-0">
          <motion.button onClick={() => { setView("chats"); setShowEditProfile(false); setShowPrivacy(false) }}
            whileTap={{ scale: 0.9 }} className="p-2 -ml-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors">
            <ArrowLeft size={22} />
          </motion.button>
          <h2 className="text-[18px] font-bold text-white flex-1">{t("settings")}</h2>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowEditProfile(true)}
            className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
            <Edit3 size={19} />
          </motion.button>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar">
          {/* Profile card */}
          <div className="pt-6 pb-4 flex flex-col items-center gap-3 border-b border-white/5">
            <div className="relative w-[90px] h-[90px] rounded-full overflow-hidden shadow-xl flex items-center justify-center text-3xl font-bold text-white"
              style={{ backgroundColor: ACCENT }}>
              {session?.user?.image
                ? <img src={session.user.image} className="w-full h-full object-cover" alt="avatar" />
                : <span>{displayName[0]?.toUpperCase()}</span>}
            </div>
            <div className="text-center">
              <h3 className="text-[22px] font-bold text-white leading-tight">{displayName}</h3>
              <p className="text-[13px] mt-0.5" style={{ color: ACCENT }}>{t("online")}</p>
            </div>
          </div>

          {/* Info rows */}
          <div className="py-2 border-b border-white/5">
            <InfoRow icon={<AtSign size={18} />} value={`@${displayName}`} label="Username" />
            <InfoRow icon={<Info size={18} />} value={displayBio} label="Bio" />
          </div>

          {/* Settings rows */}
          <div className="py-2 border-b border-white/5">
            <SettingsRow icon={<Bell size={17} />} iconColor="#5B9BD5" label={t("notifications")} />
            <SettingsRow
              icon={<Shield size={17} />}
              iconColor={profanityEnabled ? ACCENT : "#3a8a6e"}
              label={t("privacy")}
              badge={profanityEnabled ? t("anti_profanity_on") : undefined}
              onClick={() => setShowPrivacy(true)}
            />
            <SettingsRow icon={<Monitor size={17} />} iconColor="#e08a3c" label={t("devices")} badge="2" />
            <SettingsRow icon={<Folder size={17} />} iconColor="#8b6fd6" label={t("chat_folders")} />
          </div>

          {/* Language */}
          <div className="py-2 border-b border-white/5">
            <p className="px-5 pb-1.5 text-[12px] font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
              Language
            </p>
            {[{ code: "en", label: "English" }, { code: "ru", label: "Русский" }].map(lang => (
              <button key={lang.code} onClick={() => i18n.changeLanguage(lang.code)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                style={i18n.language.startsWith(lang.code) ? { color: ACCENT } : { color: "white" }}>
                <div className="flex items-center gap-3">
                  <Globe size={18} className="text-gray-500" />
                  <span className="text-[15px]">{lang.label}</span>
                </div>
                {i18n.language.startsWith(lang.code) && <Check size={16} style={{ color: ACCENT }} />}
              </button>
            ))}
          </div>

          {/* Logout */}
          <div className="py-2">
            <button onClick={() => signOut()}
              className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-white/5 transition-colors text-red-400 hover:text-red-300">
              <LogOut size={18} />
              <span className="text-[15px]">Log Out</span>
            </button>
          </div>
          <div className="h-6" />
        </div>

        {/* Edit profile overlay */}
        <AnimatePresence>
          {showEditProfile && (
            <EditProfileScreen session={session} profile={profile} onSave={handleSaveProfile}
              onBack={() => setShowEditProfile(false)} isUploading={isUploading}
              fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
              onAvatarClick={() => fileInputRef.current?.click()} />
          )}
        </AnimatePresence>

        {/* Privacy overlay */}
        <AnimatePresence>
          {showPrivacy && <PrivacyScreen onBack={() => setShowPrivacy(false)} />}
        </AnimatePresence>
      </motion.div>
      <div className="h-[2px] w-full shrink-0" />
    </div>
  )
}

  // ── CHATS SCREEN ─────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col relative bg-[#1c242f]">
      <motion.div className="px-3 flex items-center gap-2 relative bg-[#1c242f] overflow-hidden"
        layout style={{ height: 56 }} transition={{ type: "spring", stiffness: 380, damping: 32 }}>
        <div className="relative w-10 h-10 shrink-0">
          <motion.button onClick={() => setShowDropdown(v => !v)}
            animate={{ opacity: isSearchActive ? 0 : 1, rotate: isSearchActive ? -90 : 0 }}
            transition={{ duration: 0.2 }} style={{ pointerEvents: isSearchActive ? "none" : "auto" }}
            className="absolute inset-0 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400">
            <Menu size={20} />
          </motion.button>
          <motion.button onClick={() => { setIsSearchActive(false); setSearchQuery("") }}
            animate={{ opacity: isSearchActive ? 1 : 0, rotate: isSearchActive ? 0 : 90 }}
            transition={{ duration: 0.2 }} style={{ pointerEvents: isSearchActive ? "auto" : "none" }}
            className="absolute inset-0 flex items-center justify-center rounded-full hover:bg-white/10 text-[#7e85e1]">
            <ArrowLeft size={20} />
          </motion.button>

          <AnimatePresence>
            {showDropdown && (
              <>
                <div className="fixed inset-0 z-[200]" onClick={() => setShowDropdown(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -8 }}
                  style={{ transformOrigin: "top left", position: "fixed", top: 76, left: 26 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.8 }}
                  className="w-56 z-[201] rounded-xl shadow-2xl overflow-hidden">
                  <div className="absolute inset-0 rounded-xl"
                    style={{ backgroundColor: "rgba(18,24,35,0.82)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }} />
                  <div className="relative z-10">
                    <div onClick={() => { setView("settings"); setShowDropdown(false) }}
                      className="px-3 py-2.5 flex items-center gap-2.5 cursor-pointer hover:bg-white/5 transition-colors">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold overflow-hidden shrink-0" style={{ backgroundColor: ACCENT }}>
                        {session?.user?.image
                          ? <img src={session.user.image} className="w-full h-full object-cover" alt="avatar" />
                          : <span className="text-white text-sm">{session?.user?.name?.[0]?.toUpperCase()}</span>}
                      </div>
                      <span className="font-semibold text-[14px] text-white truncate">{session?.user?.name}</span>
                    </div>
                    <div className="h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
                    <div className="py-1">
                      <DropdownItem icon={<Bookmark size={16} />} label={t("saved_messages")} />
                      <DropdownItem icon={<Moon size={16} />} label={t("night_mode")} isToggle toggleEnabled={false} />
                    </div>
                    <div className="h-px mx-2" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
                    <div className="py-1">
                      <DropdownItem icon={<LogOut size={16} />} label={t("logout")} danger onClick={() => signOut()} />
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Search bar */}
        <motion.div className="relative flex-1"
          animate={isSearchActive ? { scaleX: 1, opacity: 1 } : { scaleX: 0.97, opacity: 0.92 }}
          style={{ transformOrigin: "center" }} transition={{ type: "spring", stiffness: 340, damping: 28 }}>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" size={16}
            style={{ color: isSearchActive ? ACCENT : "#6b7280", transition: "color 0.2s" }} />
          <input type="text" placeholder={t("search_placeholder")} value={searchQuery}
            onFocus={() => setIsSearchActive(true)} onChange={e => setSearchQuery(e.target.value)}
            className="w-full py-[9px] pl-10 pr-4 rounded-full text-[15px] outline-none text-white placeholder-gray-500"
            style={{
              backgroundColor: isSearchActive ? "#2c3a4d" : "#242f3d",
              border: isSearchActive ? `1.5px solid ${ACCENT}55` : "1.5px solid transparent",
              transition: "background-color 0.25s, border-color 0.25s",
            }} />
        </motion.div>
      </motion.div>

      <div className="flex-1 overflow-y-auto hide-scrollbar py-1 relative">
        {!isSearchActive ? (
          <div className="flex flex-col">
            {filteredConversations.map((chat, index) => {
              const isSelected = selectedId === chat.id.toString()
              const unread = unreadCounts[chat.id] || 0
              const isSaved = chat.type === "saved"
              const isSystem = chat.type === "system"
              const otherUser = (!isSaved && !isSystem)
                ? chat.participants?.find((p: any) => p.userId?.toString() !== currentUser?.id?.toString())?.user
                : null

              const avatarContent = isSaved ? <Bookmark size={22} className="text-white" />
                : isSystem ? <img src="/logo (1).ico" alt="Vortex" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                : otherUser?.avatar ? <img src={otherUser.avatar} className="w-full h-full object-cover" />
                : <span className="font-bold text-xl">{otherUser?.username?.[0]?.toUpperCase() || "U"}</span>

              const avatarBg = isSaved ? "#4e8cde" : isSystem ? "#7e85e1" : ACCENT

              const displayNameEl = isSaved ? <span>{t("saved_messages")}</span>
                : isSystem ? <span className="flex items-center gap-1"><span>Vortex</span><VerifiedBadge size={16} /></span>
                : <span>{chat.name || otherUser?.username}</span>

              const previewText = isSaved ? (chat.messages?.[0]?.content || t("saved_chat_subtitle"))
                : isSystem ? t("service_notifications")
                : (chat.messages?.[0]?.content || t("no_messages"))

              return (
                <motion.div key={chat.id} onClick={() => onSelect?.(chat.id.toString())}
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.2 }}
                  className={`p-[9px] px-[12px] mb-[2px] mx-2 rounded-[12px] cursor-pointer flex items-center gap-[12px] transition-all ${
                    isSelected ? "text-white shadow-lg scale-[1.02]" : "bg-transparent hover:bg-white/5"
                  }`}
                  style={isSelected ? { backgroundColor: ACCENT } : {}}>
                  <div className="w-[54px] h-[54px] rounded-full flex items-center justify-center shrink-0 overflow-hidden text-white shadow-md"
                    style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.2)" : avatarBg }}>
                    {avatarContent}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="font-semibold text-[16px] truncate text-white flex items-center gap-1">
                        {displayNameEl}
                      </div>
                      <span className="text-[12px] opacity-60 shrink-0 ml-1">
                        {chat.messages?.[0] ? new Date(chat.messages[0].createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-[1px]">
                      <div className={`text-[14px] truncate pr-2 ${isSystem ? "text-gray-500" : "opacity-80 text-white"}`}>
                        {chat.drafts?.[0] && !isSystem ? (
                          <span className="flex items-center gap-1">
                            <span className="text-red-400 font-medium">{t("draft")}:</span>
                            <span className="opacity-70">{chat.drafts[0].text}</span>
                          </span>
                        ) : previewText}
                      </div>
                      {unread > 0 && !isSelected && (
                        <div className="text-white text-[11px] font-bold px-1.5 rounded-full min-w-[20px] h-[20px] flex items-center justify-center shadow-sm shrink-0"
                          style={{ backgroundColor: isSystem ? "#5B9BD5" : ACCENT }}>
                          {unread}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col">
            <div className="px-4 py-2 text-[13px] font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
              {t("global_search")}
            </div>
            {isSearching
              ? <div className="p-4 text-center text-gray-500 text-[14px]">{t("searching")}</div>
              : globalUsers.map(user => (
                <div key={user.id} onClick={() => handleUserClick(user)}
                  className="px-4 py-2 flex items-center gap-3 hover:bg-white/5 cursor-pointer mx-2 rounded-xl transition-colors">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0 overflow-hidden"
                    style={{ backgroundColor: ACCENT }}>
                    {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.username?.[0].toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-[15px] text-white">{user.username}</span>
                    <span className="text-[13px] text-gray-500">@{user.username?.toLowerCase()}</span>
                  </div>
                </div>
              ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
