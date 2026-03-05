"use client"

import { useState, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Download, FileText, FileArchive, FileCode, Play, Pause, Volume2, Check, CheckCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { VideoViewer, ImageViewer } from "./MediaViewer"

const ACCENT = "#7e85e1"

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatTime(sec: number) {
  if (!isFinite(sec) || isNaN(sec)) return "0:00"
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

function getFileIcon(type: string) {
  if (type.includes("pdf")) return <FileText size={22} className="text-red-400" />
  if (type.includes("zip") || type.includes("rar") || type.includes("7z") || type.includes("tar"))
    return <FileArchive size={22} className="text-yellow-400" />
  if (type.includes("text") || type.includes("json") || type.includes("xml") || type.includes("javascript"))
    return <FileCode size={22} className="text-green-400" />
  return <FileText size={22} className="text-blue-400" />
}

// ── Telegram-style Video Thumbnail ────────────────────────────
function VideoThumbnail({
  url, fileName, isSender, senderName, sentAt, timeStr, isRead, onDelete, onForward, onReply, onSave
}: {
  url: string; fileName: string; isSender: boolean; senderName: string; sentAt: string
  timeStr: string; isRead: boolean
  onDelete?: () => void; onForward?: () => void; onReply?: () => void; onSave?: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState(0)
  const [open, setOpen] = useState(false)

  return (
    <>
      <motion.div
        className="relative overflow-hidden cursor-pointer select-none"
        style={{ borderRadius: 16, maxWidth: 280 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen(true)}
      >
        {/* Thumbnail via hidden video */}
        <video
          ref={videoRef}
          src={url}
          className="w-full object-cover"
          style={{ maxHeight: 200, display: "block", borderRadius: 16 }}
          preload="metadata"
          muted
          onLoadedMetadata={() => {
            const v = videoRef.current
            if (v) {
              setDuration(v.duration)
              v.currentTime = 0.5
            }
          }}
        />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/30 rounded-[16px]" />

        {/* Play button center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center border border-white/20">
            <Play size={22} fill="white" color="white" className="ml-1" />
          </div>
        </div>

        {/* Duration top-left */}
        {duration > 0 && (
          <div className="absolute top-2 left-2 bg-black/60 rounded-md px-1.5 py-0.5">
            <span className="text-white text-[11px] font-mono">{formatTime(duration)}</span>
          </div>
        )}

        {/* Time + read bottom-right */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 rounded-md px-1.5 py-0.5">
          <span className="text-white text-[10px]">{timeStr}</span>
          {isSender && (
            isRead
              ? <CheckCheck size={12} style={{ color: "#a8d8f0" }} />
              : <Check size={11} className="text-white/70" />
          )}
        </div>
      </motion.div>

      {/* Full-screen viewer */}
      <AnimatePresence>
        {open && (
          <VideoViewer
            url={url}
            senderName={senderName}
            sentAt={sentAt}
            isSender={isSender}
            onClose={() => setOpen(false)}
            onDelete={onDelete}
            onForward={onForward}
            onReply={onReply}
            onSave={onSave}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ── Image with overlay ────────────────────────────────────────
function ImageMessage({
  url, fileName, isSender, timeStr, isRead, senderName, sentAt
}: {
  url: string; fileName: string; isSender: boolean; timeStr: string; isRead: boolean
  senderName: string; sentAt: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <motion.div
        className="relative overflow-hidden cursor-pointer select-none"
        style={{ borderRadius: 16, maxWidth: 280 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen(true)}
      >
        <img
          src={url}
          alt={fileName}
          className="w-full object-cover block"
          style={{ maxHeight: 300, borderRadius: 16 }}
          loading="lazy"
        />

        {/* Time + read bottom-right overlay */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 rounded-md px-1.5 py-0.5">
          <span className="text-white text-[10px]">{timeStr}</span>
          {isSender && (
            isRead
              ? <CheckCheck size={12} style={{ color: "#a8d8f0" }} />
              : <Check size={11} className="text-white/70" />
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {open && (
          <ImageViewer
            url={url}
            senderName={senderName}
            sentAt={sentAt}
            timeStr={timeStr}
            isRead={isRead}
            isSender={isSender}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ── Audio Player ──────────────────────────────────────────────
function AudioPlayer({ url, name, size, isSender }: { url: string; name: string; size: number; isSender: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const progressRef = useRef<HTMLDivElement>(null)

  const togglePlay = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause() } else { a.play() }
    setPlaying(!playing)
  }, [playing])

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current; const bar = progressRef.current
    if (!a || !bar) return
    const ratio = Math.max(0, Math.min(1, (e.clientX - bar.getBoundingClientRect().left) / bar.offsetWidth))
    a.currentTime = ratio * a.duration
  }, [])

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl min-w-[240px] max-w-[300px]"
      style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
      <audio ref={audioRef} src={url}
        onTimeUpdate={() => { const a = audioRef.current; if (a) { setCurrentTime(a.currentTime); setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0) } }}
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration) }}
        onEnded={() => setPlaying(false)}
      />
      <motion.button onClick={togglePlay} whileTap={{ scale: 0.88 }}
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white"
        style={{ backgroundColor: ACCENT }}>
        {playing ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" />}
      </motion.button>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <span className="text-[13px] text-white font-medium truncate">{name}</span>
        <div ref={progressRef} onClick={handleSeek}
          className="h-[3px] rounded-full cursor-pointer relative overflow-hidden"
          style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
          <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-100"
            style={{ width: `${progress}%`, backgroundColor: ACCENT }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-400">{formatTime(currentTime || duration)}</span>
          <span className="text-[11px] text-gray-500">{formatBytes(size)}</span>
        </div>
      </div>
      <Volume2 size={14} className="text-gray-500 shrink-0" />
    </div>
  )
}

// ── Generic File ──────────────────────────────────────────────
function GenericFile({ url, name, size, type }: { url: string; name: string; size: number; type: string }) {
  return (
    <a href={url} download={name} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl min-w-[200px] max-w-[280px] hover:bg-white/5 transition-colors group"
      style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
        {getFileIcon(type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-white font-medium truncate">{name}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">{formatBytes(size)}</p>
      </div>
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: ACCENT }}>
        <Download size={14} className="text-white" />
      </motion.div>
    </a>
  )
}

// ── Main export ───────────────────────────────────────────────
interface FileMessageProps {
  fileUrl: string
  fileName: string
  fileSize: number
  fileType: string
  isSender: boolean
  caption?: string
  timeStr?: string
  isRead?: boolean
  senderName?: string
  sentAt?: string
  onDelete?: () => void
  onForward?: () => void
  onReply?: () => void
  onSave?: () => void
}

export default function FileMessage({
  fileUrl, fileName, fileSize, fileType, isSender, caption,
  timeStr = "", isRead = false, senderName = "", sentAt = "",
  onDelete, onForward, onReply, onSave
}: FileMessageProps) {
  const isVideo = fileType.startsWith("video/")
  const isAudio = fileType.startsWith("audio/")
  const isImage = fileType.startsWith("image/")

  return (
    <div className="flex flex-col gap-1">
      {isImage && (
        <ImageMessage
          url={fileUrl} fileName={fileName} isSender={isSender}
          timeStr={timeStr} isRead={isRead} senderName={senderName} sentAt={sentAt}
        />
      )}
      {isVideo && (
        <VideoThumbnail
          url={fileUrl} fileName={fileName} isSender={isSender}
          senderName={senderName} sentAt={sentAt} timeStr={timeStr} isRead={isRead}
          onDelete={onDelete} onForward={onForward} onReply={onReply} onSave={onSave}
        />
      )}
      {isAudio && <AudioPlayer url={fileUrl} name={fileName} size={fileSize} isSender={isSender} />}
      {!isImage && !isVideo && !isAudio && (
        <GenericFile url={fileUrl} name={fileName} size={fileSize} type={fileType} />
      )}
      {caption && <p className="text-[14px] text-white mt-0.5 px-1">{caption}</p>}
    </div>
  )
}
