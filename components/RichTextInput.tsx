"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bold, Italic, Strikethrough, Underline, Code, Link2, EyeOff,
  Type, MoreVertical, Copy, Scissors, X
} from "lucide-react"

const ACCENT = "#7e85e1"
const MAX_FORMATS = 2

// ── Типы форматирования ───────────────────────────────────────
export type FormatType = "bold" | "italic" | "strike" | "underline" | "mono" | "spoiler" | "link"

export interface TextEntity {
  type: FormatType
  offset: number
  length: number
  url?: string
}

// ── Применяем entities к plain тексту для отображения ──────────
export function renderEntities(text: string, entities: TextEntity[]): React.ReactNode {
  if (!entities.length) return text

  // Сортируем по offset
  const sorted = [...entities].sort((a, b) => a.offset - b.offset)

  const parts: React.ReactNode[] = []
  let cursor = 0

  for (const ent of sorted) {
    if (ent.offset > cursor) parts.push(text.slice(cursor, ent.offset))
    const chunk = text.slice(ent.offset, ent.offset + ent.length)

    if (ent.type === "bold") parts.push(<strong key={cursor} className="font-bold">{chunk}</strong>)
    else if (ent.type === "italic") parts.push(<em key={cursor} className="italic">{chunk}</em>)
    else if (ent.type === "strike") parts.push(<del key={cursor}>{chunk}</del>)
    else if (ent.type === "underline") parts.push(<u key={cursor}>{chunk}</u>)
    else if (ent.type === "mono") parts.push(<code key={cursor} className="font-mono bg-white/10 rounded px-1 text-[13px]">{chunk}</code>)
    else if (ent.type === "spoiler") parts.push(<SpoilerText key={cursor} text={chunk} />)
    else if (ent.type === "link" && ent.url) parts.push(
      <a key={cursor} href={ent.url} target="_blank" rel="noopener noreferrer"
        className="underline" style={{ color: ACCENT }} onClick={e => e.stopPropagation()}>
        {chunk}
      </a>
    )
    else parts.push(chunk)

    cursor = ent.offset + ent.length
  }

  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}

// ── Spoiler текст ─────────────────────────────────────────────
function SpoilerText({ text }: { text: string }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <span
      onClick={e => { e.stopPropagation(); setRevealed(r => !r) }}
      className="cursor-pointer rounded px-0.5 transition-all"
      style={{
        backgroundColor: revealed ? "transparent" : "rgba(255,255,255,0.15)",
        color: revealed ? "inherit" : "transparent",
        filter: revealed ? "none" : "blur(4px)",
        userSelect: revealed ? "text" : "none",
      }}
    >
      {text}
    </span>
  )
}

// ── Formatting toolbar ────────────────────────────────────────
interface FormatToolbarProps {
  visible: boolean
  position: { x: number; y: number }
  onFormat: (type: FormatType) => void
  onCut: () => void
  onCopy: () => void
  appliedFormats: FormatType[]
}

const FORMAT_ITEMS: { type: FormatType; icon: React.ReactNode; label: string }[] = [
  { type: "bold",      icon: <Bold size={15} />,         label: "Жирный" },
  { type: "italic",    icon: <Italic size={15} />,       label: "Курсив" },
  { type: "mono",      icon: <Code size={15} />,         label: "Моно" },
  { type: "strike",    icon: <Strikethrough size={15} />, label: "Зачёркнутый" },
  { type: "underline", icon: <Underline size={15} />,    label: "Подчёркнутый" },
  { type: "spoiler",   icon: <EyeOff size={15} />,       label: "Скрытый" },
  { type: "link",      icon: <Link2 size={15} />,        label: "Ссылка" },
]

export function FormatToolbar({ visible, position, onFormat, onCut, onCopy, appliedFormats }: FormatToolbarProps) {
  const [showMore, setShowMore] = useState(false)

  if (!visible) return null

  const mainItems = FORMAT_ITEMS.slice(0, 3) // bold, italic, mono
  const moreItems = FORMAT_ITEMS.slice(3)    // strike, underline, spoiler, link

  // Плейсхолдер "plain" — сброс форматирования
  const PlainItem = () => (
    <motion.button
      onClick={() => onFormat("plain" as any)}
      whileTap={{ scale: 0.9 }}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors text-[13px]"
    >
      <Type size={15} /> Обычный
    </motion.button>
  )

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 8 }}
      transition={{ type: "spring", stiffness: 500, damping: 28, mass: 0.6 }}
      className="fixed z-[500] rounded-2xl shadow-2xl overflow-hidden border border-white/10"
      style={{
        left: Math.min(position.x, window.innerWidth - 320),
        top: position.y - 8,
        transform: "translateY(-100%)",
        backgroundColor: "rgba(22,30,44,0.97)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        minWidth: 280,
      }}
    >
      {/* Основная строка */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/8">
        {/* Вырезать / Копировать */}
        <motion.button onClick={onCut} whileTap={{ scale: 0.9 }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors text-[13px]">
          <Scissors size={14} /> Вырезать
        </motion.button>
        <motion.button onClick={onCopy} whileTap={{ scale: 0.9 }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors text-[13px]">
          <Copy size={14} /> Копировать
        </motion.button>

        <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />

        {/* Main format buttons */}
        {mainItems.map(item => {
          const active = appliedFormats.includes(item.type)
          const maxed = !active && appliedFormats.length >= MAX_FORMATS
          return (
            <motion.button key={item.type}
              onClick={() => !maxed && onFormat(item.type)}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: active ? `${ACCENT}30` : "transparent",
                color: active ? ACCENT : maxed ? "#555" : "#ccc",
                cursor: maxed ? "not-allowed" : "pointer",
              }}
              title={item.label}
            >
              {item.icon}
            </motion.button>
          )
        })}

        {/* ••• кнопка */}
        <motion.button
          onClick={() => setShowMore(s => !s)} whileTap={{ scale: 0.9 }}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          style={{ color: showMore ? ACCENT : "#888" }}
        >
          <MoreVertical size={15} />
        </motion.button>
      </div>

      {/* Дополнительные форматы */}
      <AnimatePresence>
        {showMore && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-2 py-1.5 flex flex-col gap-0.5">
              {moreItems.map(item => {
                const active = appliedFormats.includes(item.type)
                const maxed = !active && appliedFormats.length >= MAX_FORMATS
                return (
                  <motion.button key={item.type}
                    onClick={() => !maxed && onFormat(item.type)}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-[13px]"
                    style={{
                      backgroundColor: active ? `${ACCENT}20` : "transparent",
                      color: active ? ACCENT : maxed ? "#555" : "#ccc",
                      cursor: maxed ? "not-allowed" : "pointer",
                    }}
                  >
                    {item.icon}
                    <span className="flex-1 text-left">{item.label}</span>
                    {active && <X size={13} className="opacity-60" />}
                  </motion.button>
                )
              })}
              <PlainItem />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Link input dialog ─────────────────────────────────────────
interface LinkDialogProps {
  visible: boolean
  onConfirm: (url: string) => void
  onCancel: () => void
}

export function LinkDialog({ visible, onConfirm, onCancel }: LinkDialogProps) {
  const [url, setUrl] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (visible) {
      setUrl("")
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [visible])

  if (!visible) return null

  return (
    <motion.div className="fixed inset-0 z-[600] flex items-center justify-center px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl p-5 shadow-2xl"
        style={{ backgroundColor: "#1c242f", border: "1px solid rgba(255,255,255,0.1)" }}
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
      >
        <p className="text-white font-bold text-[16px] mb-4">Добавить ссылку</p>
        <input
          ref={inputRef} value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-full bg-[#242f3d] text-white text-[15px] rounded-xl px-4 py-3 outline-none placeholder-gray-500 mb-4"
          style={{ border: `1.5px solid ${ACCENT}44` }}
          onKeyDown={e => {
            if (e.key === "Enter" && url.trim()) onConfirm(url.trim())
            if (e.key === "Escape") onCancel()
          }}
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl text-gray-400 hover:text-white text-[14px] transition-colors">
            Отмена
          </button>
          <button
            onClick={() => url.trim() && onConfirm(url.trim())}
            className="px-4 py-2 rounded-xl text-white text-[14px] font-semibold"
            style={{ backgroundColor: ACCENT }}>
            Добавить
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
