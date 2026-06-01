"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, Download, Send, ZoomIn, ZoomOut, Trash2, Play, Pause,
  ArrowLeft, MoreVertical, Reply, Forward, Bookmark, ChevronRight
} from "lucide-react"

const ACCENT = "var(--accent, #7e85e1)"

function formatTime(sec: number) {
  if (!isFinite(sec) || isNaN(sec)) return "0:00"
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

// ─────────────────────────────────────────────────────────────
// VIDEO VIEWER
// ─────────────────────────────────────────────────────────────
interface VideoViewerProps {
  url: string
  senderName: string
  sentAt: string
  isSender: boolean
  onClose: () => void
  onDelete?: () => void
  onForward?: () => void
  onReply?: () => void
  onSave?: () => void
}

export function VideoViewer({
  url, senderName, sentAt, isSender, onClose, onDelete, onForward, onReply, onSave
}: VideoViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [showMore, setShowMore] = useState(false)
  const [zoom, setZoom] = useState(1)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768

  const resetHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setShowControls(true)
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false)
    }, 3000)
  }, [playing])

  useEffect(() => {
    resetHideTimer()
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current) }
  }, [playing])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (playing) { v.pause(); setPlaying(false); setShowControls(true) }
    else { v.play(); setPlaying(true); resetHideTimer() }
  }, [playing, resetHideTimer])

  const handleScreenTap = useCallback(() => {
    if (isMobile) {
      setShowControls(p => {
        if (!p) { resetHideTimer(); return true }
        return p
      })
    }
  }, [isMobile, resetHideTimer])

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const v = videoRef.current
    const bar = (e.currentTarget as HTMLDivElement)
    const rect = bar.getBoundingClientRect()
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    if (v && v.duration) {
      v.currentTime = ratio * v.duration
      setProgress(ratio * 100)
    }
  }, [])

  return (
    <motion.div
      className="fixed inset-0 z-[400] bg-black flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleScreenTap}
    >
      {/* ── TOP BAR ── */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 px-3 pt-safe pb-3"
            style={{
              background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)",
              paddingTop: "env(safe-area-inset-top, 12px)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <motion.button whileTap={{ scale: 0.88 }} onClick={onClose}
              className="p-2 rounded-full bg-black/30 text-white">
              {isMobile ? <ArrowLeft size={22} /> : <X size={22} />}
            </motion.button>

            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-[15px] leading-tight truncate">{senderName}</p>
              <p className="text-white/60 text-[12px] leading-tight">{sentAt}</p>
            </div>

            <div className="flex items-center gap-1">
              {!isMobile && (
                <>
                  <motion.button whileTap={{ scale: 0.88 }} onClick={() => setZoom(z => Math.min(z + 0.5, 3))}
                    className="p-2 rounded-full bg-black/30 text-white"><ZoomIn size={20} /></motion.button>
                  <motion.button whileTap={{ scale: 0.88 }} onClick={() => setZoom(z => Math.max(z - 0.5, 1))}
                    className="p-2 rounded-full bg-black/30 text-white"><ZoomOut size={20} /></motion.button>
                  <motion.button whileTap={{ scale: 0.88 }}
                    className="p-2 rounded-full bg-black/30 text-white"
                    onClick={() => { const a = document.createElement("a"); a.href = url; a.download = "video"; a.click() }}>
                    <Download size={20} />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.88 }} onClick={onForward}
                    className="p-2 rounded-full bg-black/30 text-white"><Send size={20} /></motion.button>
                  {isSender && (
                    <motion.button whileTap={{ scale: 0.88 }} onClick={onDelete}
                      className="p-2 rounded-full bg-black/30 text-red-400"><Trash2 size={20} /></motion.button>
                  )}
                  <motion.button whileTap={{ scale: 0.88 }} onClick={onClose}
                    className="p-2 rounded-full bg-black/30 text-white"><X size={20} /></motion.button>
                </>
              )}
              {isMobile && (
                <div className="relative">
                  <motion.button whileTap={{ scale: 0.88 }} onClick={e => { e.stopPropagation(); setShowMore(p => !p) }}
                    className="p-2 rounded-full bg-black/30 text-white"><MoreVertical size={20} /></motion.button>
                  <AnimatePresence>
                    {showMore && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.85, y: -8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.85, y: -8 }}
                        onClick={e => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1 bg-[#1e2533] rounded-2xl shadow-2xl py-1 min-w-[160px] border border-white/10"
                      >
                        {[
                          { icon: <Reply size={16} />, label: "Ответить", action: onReply },
                          { icon: <Forward size={16} />, label: "Переслать", action: onForward },
                          { icon: <Bookmark size={16} />, label: "Сохранить", action: onSave },
                          { icon: <Download size={16} />, label: "Скачать", action: () => { const a = document.createElement("a"); a.href = url; a.download = "video"; a.click() } },
                          ...(isSender ? [{ icon: <Trash2 size={16} className="text-red-400" />, label: "Удалить", action: onDelete, red: true }] : []),
                        ].map((item, i) => (
                          <div key={i} onClick={() => { item.action?.(); setShowMore(false) }}
                            className="flex items-center gap-3 px-4 py-3 active:bg-white/5 cursor-pointer">
                            <span className={item.red ? "text-red-400" : "text-gray-400"}>{item.icon}</span>
                            <span className={`text-[14px] ${item.red ? "text-red-400" : "text-white"}`}>{item.label}</span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── VIDEO ── */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          src={url}
          className="max-w-full max-h-full object-contain"
          style={{ transform: `scale(${zoom})`, transition: "transform 0.2s" }}
          onTimeUpdate={() => {
            const v = videoRef.current
            if (!v) return
            setCurrentTime(v.currentTime)
            setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0)
          }}
          onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration) }}
          onEnded={() => { setPlaying(false); setShowControls(true) }}
          onClick={e => { e.stopPropagation(); togglePlay() }}
          playsInline
        />
      </div>

      {/* ── CENTER PLAY BUTTON (mobile) ── */}
      <AnimatePresence>
        {showControls && isMobile && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <motion.button
              className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center pointer-events-auto"
              whileTap={{ scale: 0.88 }}
              onClick={e => { e.stopPropagation(); togglePlay() }}
              animate={{ rotate: playing ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
            >
              <AnimatePresence mode="wait">
                {playing ? (
                  <motion.div key="pause" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 90 }} transition={{ duration: 0.15 }}>
                    <Pause size={28} fill="white" color="white" />
                  </motion.div>
                ) : (
                  <motion.div key="play" initial={{ opacity: 0, rotate: 90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: -90 }} transition={{ duration: 0.15 }}>
                    <Play size={28} fill="white" color="white" className="ml-1" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM BAR ── */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-safe pt-4"
            style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
              paddingBottom: "env(safe-area-inset-bottom, 20px)",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* PC center play button */}
            {!isMobile && (
              <div className="flex justify-center mb-4">
                <motion.button
                  className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center"
                  whileTap={{ scale: 0.88 }}
                  onClick={togglePlay}
                >
                  <AnimatePresence mode="wait">
                    {playing ? (
                      <motion.div key="pause" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 90 }} transition={{ duration: 0.15 }}>
                        <Pause size={26} fill="white" color="white" />
                      </motion.div>
                    ) : (
                      <motion.div key="play" initial={{ opacity: 0, rotate: 90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: -90 }} transition={{ duration: 0.15 }}>
                        <Play size={26} fill="white" color="white" className="ml-1" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            )}

            {/* Seekbar */}
            <div className="flex items-center gap-3">
              <span className="text-white text-[13px] font-mono tabular-nums w-[40px]">{formatTime(currentTime)}</span>
              <div
                className="flex-1 h-[4px] rounded-full relative cursor-pointer group"
                style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
                onClick={handleSeek}
                onTouchEnd={handleSeek as any}
              >
                <div className="absolute left-0 top-0 h-full rounded-full"
                  style={{ width: `${progress}%`, backgroundColor: ACCENT }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `calc(${progress}% - 6px)` }} />
              </div>
              <span className="text-white/60 text-[13px] font-mono tabular-nums w-[40px] text-right">{formatTime(duration)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// IMAGE VIEWER
// ─────────────────────────────────────────────────────────────
interface ImageViewerProps {
  url: string
  senderName: string
  sentAt: string
  timeStr: string
  isRead: boolean
  isSender: boolean
  onClose: () => void
}

export function ImageViewer({ url, senderName, sentAt, timeStr, isRead, isSender, onClose }: ImageViewerProps) {
  return (
    <motion.div
      className="fixed inset-0 z-[400] bg-black flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.button
        className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/50 text-white"
        whileTap={{ scale: 0.88 }}
        onClick={e => { e.stopPropagation(); onClose() }}
        style={{ top: "env(safe-area-inset-top, 16px)" }}
      >
        <X size={22} />
      </motion.button>

      <motion.img
        src={url}
        alt="media"
        className="max-w-full max-h-full object-contain"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        onClick={e => e.stopPropagation()}
        draggable={false}
      />
    </motion.div>
  )
}
