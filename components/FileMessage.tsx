"use client"

import { useState, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { Download, FileText, FileArchive, FileCode, Play, Pause, Volume2 } from "lucide-react"
import { useTranslation } from "react-i18next"

const ACCENT = "#7e85e1"

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatTime(sec: number) {
  if (!isFinite(sec)) return "0:00"
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

function getFileIcon(type: string) {
  if (type.includes("pdf")) return <FileText size={22} className="text-red-400" />
  if (type.includes("zip") || type.includes("rar") || type.includes("7z") || type.includes("tar"))
    return <FileArchive size={22} className="text-yellow-400" />
  if (type.includes("text") || type.includes("json") || type.includes("xml") || type.includes("javascript") || type.includes("typescript"))
    return <FileCode size={22} className="text-green-400" />
  return <FileText size={22} className="text-blue-400" />
}

// ── Video Player ──────────────────────────────────────────────
function VideoPlayer({ url, name, isSender }: { url: string; name: string; isSender: boolean }) {
  return (
    <div className="rounded-xl overflow-hidden max-w-[320px]" style={{ backgroundColor: "#0d1117" }}>
      <video
        src={url}
        controls
        preload="metadata"
        className="w-full max-h-[240px] object-contain"
        style={{ display: "block" }}
      />
      <div className="px-3 py-1.5 flex items-center justify-between">
        <span className="text-[12px] text-gray-400 truncate max-w-[200px]">{name}</span>
      </div>
    </div>
  )
}

// ── Audio Player ─────────────────────────────────────────────
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

  const handleTimeUpdate = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    setCurrentTime(a.currentTime)
    setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0)
  }, [])

  const handleLoaded = useCallback(() => {
    const a = audioRef.current
    if (a) setDuration(a.duration)
  }, [])

  const handleEnded = useCallback(() => setPlaying(false), [])

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current
    const bar = progressRef.current
    if (!a || !bar) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    a.currentTime = ratio * a.duration
  }, [])

  const bg = isSender ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)"

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl min-w-[240px] max-w-[300px]"
      style={{ backgroundColor: bg }}>
      <audio ref={audioRef} src={url}
        onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoaded} onEnded={handleEnded} />

      {/* Play button */}
      <motion.button
        onClick={togglePlay}
        whileTap={{ scale: 0.88 }}
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white"
        style={{ backgroundColor: ACCENT }}
      >
        {playing ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" />}
      </motion.button>

      {/* Info + progress */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <span className="text-[13px] text-white font-medium truncate leading-tight">{name}</span>

        {/* Progress bar */}
        <div ref={progressRef} onClick={handleSeek}
          className="h-[3px] rounded-full cursor-pointer relative overflow-hidden"
          style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
          <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-100"
            style={{ width: `${progress}%`, backgroundColor: ACCENT }} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            {playing || currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}
          </span>
          <span className="text-[11px] text-gray-500">{formatBytes(size)}</span>
        </div>
      </div>

      <Volume2 size={14} className="text-gray-500 shrink-0" />
    </div>
  )
}

// ── Generic File ─────────────────────────────────────────────
function GenericFile({ url, name, size, type }: { url: string; name: string; size: number; type: string }) {
  const { t } = useTranslation()
  return (
    <a href={url} download={name} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl min-w-[200px] max-w-[280px] hover:bg-white/5 transition-colors group"
      style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
        {getFileIcon(type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-white font-medium truncate leading-tight">{name}</p>
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
}

export default function FileMessage({ fileUrl, fileName, fileSize, fileType, isSender, caption }: FileMessageProps) {
  const isVideo = fileType.startsWith("video/")
  const isAudio = fileType.startsWith("audio/")
  const isImage = fileType.startsWith("image/")

  return (
    <div className="flex flex-col gap-1">
      {isImage && (
        <div className="rounded-xl overflow-hidden max-w-[300px]">
          <img src={fileUrl} alt={fileName} className="w-full object-cover" loading="lazy" />
        </div>
      )}
      {isVideo && <VideoPlayer url={fileUrl} name={fileName} isSender={isSender} />}
      {isAudio && <AudioPlayer url={fileUrl} name={fileName} size={fileSize} isSender={isSender} />}
      {!isImage && !isVideo && !isAudio && (
        <GenericFile url={fileUrl} name={fileName} size={fileSize} type={fileType} />
      )}
      {caption && <p className="text-[14px] text-white mt-0.5 px-1">{caption}</p>}
    </div>
  )
}
