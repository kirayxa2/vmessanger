"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronLeft, ChevronRight, Plus, Camera } from "lucide-react"
import { useSession } from "next-auth/react"

const ACCENT = "#7e85e1"

interface StoryUser {
  user: { id: number; username: string; avatar?: string | null }
  stories: Array<{
    id: number
    mediaUrl: string
    mediaType: string
    text?: string | null
    createdAt: string
    expiresAt: string
    viewed: boolean
  }>
  hasUnviewed: boolean
}

// ── Компонент аватарки истории (одна кружочек) ─────────────────
function StoryAvatar({
  storyUser,
  size = 52,
  onClick,
}: {
  storyUser: StoryUser
  size?: number
  onClick: () => void
}) {
  const u = storyUser.user
  const hasUnviewed = storyUser.hasUnviewed
  const ringColor = hasUnviewed ? ACCENT : "rgba(255,255,255,0.2)"

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      className="flex flex-col items-center gap-1 shrink-0"
      style={{ width: size + 8 }}
    >
      {/* Ring + Avatar */}
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: size + 6,
          height: size + 6,
          background: hasUnviewed
            ? `conic-gradient(${ACCENT} 0deg, ${ACCENT} 270deg, transparent 270deg)`
            : "rgba(255,255,255,0.12)",
          padding: 2,
        }}
      >
        {/* Animated gradient ring for unviewed */}
        <div
          className="rounded-full overflow-hidden flex items-center justify-center text-white font-bold"
          style={{
            width: size,
            height: size,
            background: ACCENT,
            border: "2.5px solid #1c242f",
            fontSize: size * 0.35,
          }}
        >
          {u.avatar ? (
            <img src={u.avatar} className="w-full h-full object-cover" alt="" />
          ) : (
            u.username?.[0]?.toUpperCase() || "?"
          )}
        </div>
      </div>
      {/* Username под аватаркой */}
      <span
        className="text-center leading-tight truncate w-full"
        style={{
          fontSize: 11,
          color: hasUnviewed ? "white" : "rgba(255,255,255,0.5)",
          maxWidth: size + 8,
        }}
      >
        {u.username}
      </span>
    </motion.button>
  )
}

// ── Stories Viewer (полноэкранный просмотр) ───────────────────
function StoriesViewer({
  storyGroups,
  startUserIndex,
  currentUserId,
  onClose,
  onMarkViewed,
}: {
  storyGroups: StoryUser[]
  startUserIndex: number
  currentUserId: number
  onClose: () => void
  onMarkViewed: (storyId: number) => void
}) {
  const [userIndex, setUserIndex] = useState(startUserIndex)
  const [storyIndex, setStoryIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const STORY_DURATION = 5000

  const group = storyGroups[userIndex]
  const story = group?.stories[storyIndex]

  // Отмечаем просмотр
  useEffect(() => {
    if (story && !story.viewed) {
      onMarkViewed(story.id)
    }
  }, [story?.id])

  // Прогресс-бар таймер
  useEffect(() => {
    setProgress(0)
    if (timerRef.current) clearInterval(timerRef.current)
    const startTime = Date.now()
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const pct = (elapsed / STORY_DURATION) * 100
      if (pct >= 100) {
        clearInterval(timerRef.current!)
        goNext()
      } else {
        setProgress(pct)
      }
    }, 50)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [userIndex, storyIndex])

  const goNext = useCallback(() => {
    const group = storyGroups[userIndex]
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex(i => i + 1)
    } else if (userIndex < storyGroups.length - 1) {
      setUserIndex(i => i + 1)
      setStoryIndex(0)
    } else {
      onClose()
    }
  }, [userIndex, storyIndex, storyGroups, onClose])

  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(i => i - 1)
    } else if (userIndex > 0) {
      setUserIndex(i => i - 1)
      setStoryIndex(storyGroups[userIndex - 1].stories.length - 1)
    }
  }, [userIndex, storyIndex, storyGroups])

  if (!group || !story) return null

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    if (h > 0) return `${h}ч назад`
    return `${m}м назад`
  }

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
    >
      {/* Story card */}
      <motion.div
        key={`${userIndex}-${storyIndex}`}
        className="relative overflow-hidden"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{
          width: "min(420px, 100vw)",
          height: "min(740px, 100dvh)",
          borderRadius: 24,
          backgroundColor: "#111",
        }}
      >
        {/* Media */}
        {story.mediaType === "video" ? (
          <video
            src={story.mediaUrl}
            autoPlay
            loop={false}
            muted={false}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <img
            src={story.mediaUrl}
            className="absolute inset-0 w-full h-full object-cover"
            alt=""
          />
        )}

        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.7) 100%)" }}
        />

        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 flex gap-1">
          {group.stories.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.3)" }}>
              <motion.div
                className="h-full rounded-full bg-white"
                style={{ width: i < storyIndex ? "100%" : i === storyIndex ? `${progress}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-4 right-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shrink-0 bg-gray-700">
            {group.user.avatar
              ? <img src={group.user.avatar} className="w-full h-full object-cover" alt="" />
              : <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: ACCENT }}>{group.user.username[0].toUpperCase()}</div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-[15px] leading-tight">{group.user.username}</p>
            <p className="text-white/60 text-[12px]">{timeAgo(story.createdAt)}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition-colors">
            <X size={22} className="text-white" />
          </button>
        </div>

        {/* Text overlay */}
        {story.text && (
          <div className="absolute bottom-16 left-4 right-4">
            <p className="text-white text-[16px] font-medium text-center drop-shadow-lg">
              {story.text}
            </p>
          </div>
        )}

        {/* Tap zones */}
        <div className="absolute inset-0 flex">
          <div className="w-1/3 h-full cursor-pointer" onClick={goPrev} />
          <div className="w-2/3 h-full cursor-pointer" onClick={goNext} />
        </div>
      </motion.div>

      {/* Prev/Next user buttons */}
      <AnimatePresence>
        {userIndex > 0 && (
          <motion.button
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            onClick={() => { setUserIndex(i => i - 1); setStoryIndex(0) }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"
          >
            <ChevronLeft size={20} className="text-white" />
          </motion.button>
        )}
        {userIndex < storyGroups.length - 1 && (
          <motion.button
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            onClick={() => { setUserIndex(i => i + 1); setStoryIndex(0) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"
          >
            <ChevronRight size={20} className="text-white" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── StoriesRow: горизонтальный ряд аватарок ───────────────────
export default function StoriesRow({
  className = "",
  compact = false, // compact = маленькие кружочки для ПК-хедера
}: {
  className?: string
  compact?: boolean
}) {
  const { data: session } = useSession()
  const [storyGroups, setStoryGroups] = useState<StoryUser[]>([])
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerUserIndex, setViewerUserIndex] = useState(0)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchStories = useCallback(async () => {
    try {
      const res = await fetch("/api/stories")
      if (res.ok) {
        const data = await res.json()
        setStoryGroups(Array.isArray(data) ? data : [])
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchStories()
    // Обновляем каждые 60 секунд
    const interval = setInterval(fetchStories, 60_000)
    return () => clearInterval(interval)
  }, [fetchStories])

  const handleMarkViewed = useCallback(async (storyId: number) => {
    try {
      await fetch("/api/stories/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      })
      setStoryGroups(prev =>
        prev.map(g => ({
          ...g,
          stories: g.stories.map(s => s.id === storyId ? { ...s, viewed: true } : s),
          hasUnviewed: g.stories.some(s => s.id !== storyId && !s.viewed),
        }))
      )
    } catch {}
  }, [])

  const handleAddStory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
      if (!uploadRes.ok) throw new Error("Upload failed")
      const { url } = await uploadRes.json()
      const mediaType = file.type.startsWith("video") ? "video" : "image"
      await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrl: url, mediaType }),
      })
      await fetchStories()
    } catch (e) {
      console.error("Story upload error", e)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const size = compact ? 38 : 52

  if (storyGroups.length === 0 && !session) return null

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleAddStory}
      />

      <div className={`flex items-center gap-2 ${className}`} style={{ overflowX: "auto", scrollbarWidth: "none" }}>
        {/* Кнопка добавить свою историю */}
        <motion.button
          onClick={() => fileInputRef.current?.click()}
          whileTap={{ scale: 0.9 }}
          className="flex flex-col items-center gap-1 shrink-0"
          style={{ width: size + 8 }}
        >
          <div
            className="rounded-full flex items-center justify-center border-2 border-dashed"
            style={{
              width: size + 6,
              height: size + 6,
              borderColor: "rgba(126,133,225,0.5)",
              backgroundColor: "rgba(126,133,225,0.1)",
              position: "relative",
            }}
          >
            {uploading ? (
              <div
                className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
              />
            ) : session?.user?.image ? (
              <>
                <img src={session.user.image} className="w-full h-full object-cover rounded-full" alt="" />
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: ACCENT }}
                >
                  <Plus size={10} className="text-white" strokeWidth={3} />
                </div>
              </>
            ) : (
              <Camera size={size * 0.4} style={{ color: ACCENT }} />
            )}
          </div>
          {!compact && (
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              Моя история
            </span>
          )}
        </motion.button>

        {/* Истории других пользователей */}
        {storyGroups.map((group, i) => (
          <StoryAvatar
            key={group.user.id}
            storyUser={group}
            size={size}
            onClick={() => {
              setViewerUserIndex(i)
              setViewerOpen(true)
            }}
          />
        ))}
      </div>

      {/* Viewer */}
      <AnimatePresence>
        {viewerOpen && (
          <StoriesViewer
            storyGroups={storyGroups}
            startUserIndex={viewerUserIndex}
            currentUserId={parseInt(session?.user?.id || "0")}
            onClose={() => setViewerOpen(false)}
            onMarkViewed={handleMarkViewed}
          />
        )}
      </AnimatePresence>
    </>
  )
}
