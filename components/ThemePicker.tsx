"use client"

import { motion } from "framer-motion"
import { ArrowLeft, Check, Moon, Sun, Pipette } from "lucide-react"
import { useRef } from "react"
import { useTheme, ACCENT_PRESETS } from "@/lib/theme"

export default function ThemePicker({ onBack }: { onBack: () => void }) {
  const { theme, accent, setTheme, setAccent } = useTheme()
  const colorInputRef = useRef<HTMLInputElement>(null)

  const isPreset = ACCENT_PRESETS.some(c => c.toLowerCase() === accent.toLowerCase())

  return (
    <motion.div
      className="absolute inset-0 z-[100] flex flex-col"
      style={{ backgroundColor: "var(--sidebar-bg, #1c242f)" }}
      initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
    >
      {/* Header */}
      <div className="px-4 h-[63px] flex items-center gap-3 border-b border-white/5 shrink-0">
        <motion.button onClick={onBack} whileTap={{ scale: 0.9 }}
          className="p-2 -ml-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors">
          <ArrowLeft size={22} />
        </motion.button>
        <h2 className="text-[18px] font-bold text-white flex-1">Внешний вид</h2>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-5">
        {/* ── Живое превью ── */}
        <div className="rounded-2xl overflow-hidden mb-6 border border-white/8" style={{ backgroundColor: "var(--chat-bg, #0e1621)" }}>
          <div className="tg-bg p-4 flex flex-col gap-2">
            <div className="self-start max-w-[75%] px-3 py-2 rounded-2xl rounded-bl-md text-[14px] text-white shadow"
              style={{ backgroundColor: "var(--recipient-bubble, #212d3b)" }}>
              Привет! Как тебе новая тема? 🎨
            </div>
            <div className="self-end max-w-[75%] px-3 py-2 rounded-2xl rounded-br-md text-[14px] text-white shadow"
              style={{ backgroundColor: "var(--accent)" }}>
              Огонь! Цвет меняется везде ✨
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 border-t border-white/5" style={{ backgroundColor: "var(--input-bg, #242f3d)" }}>
            <div className="flex-1 h-9 rounded-full bg-black/20 flex items-center px-3 text-gray-500 text-[13px]">Сообщение…</div>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: "var(--accent)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" /></svg>
            </div>
          </div>
        </div>

        {/* ── Тема ── */}
        <p className="text-[12px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Тема</p>
        <div className="grid grid-cols-2 gap-3 mb-7">
          <ThemeCard active={theme === "dark"} onClick={() => setTheme("dark")} label="Тёмная"
            icon={<Moon size={16} />} bg="#0e1621" bar="#1c242f" bubble={accent} />
          <ThemeCard active={theme === "light"} onClick={() => setTheme("light")} label="Светлая"
            icon={<Sun size={16} />} bg="#e8ecf1" bar="#ffffff" bubble={accent} />
        </div>

        {/* ── Акцентный цвет ── */}
        <p className="text-[12px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Акцент</p>
        <div className="grid grid-cols-6 gap-3">
          {ACCENT_PRESETS.map(c => (
            <motion.button key={c} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              onClick={() => setAccent(c)}
              className="aspect-square rounded-full flex items-center justify-center shadow-md"
              style={{ backgroundColor: c, outline: accent.toLowerCase() === c.toLowerCase() ? "2px solid white" : "none", outlineOffset: 2 }}>
              {accent.toLowerCase() === c.toLowerCase() && <Check size={16} className="text-white" />}
            </motion.button>
          ))}
          {/* Кастомный цвет */}
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={() => colorInputRef.current?.click()}
            className="aspect-square rounded-full flex items-center justify-center shadow-md relative overflow-hidden"
            style={{
              background: isPreset
                ? "conic-gradient(from 0deg, #ef4444, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)"
                : accent,
              outline: !isPreset ? "2px solid white" : "none", outlineOffset: 2,
            }}>
            {!isPreset ? <Check size={16} className="text-white drop-shadow" /> : <Pipette size={15} className="text-white drop-shadow" />}
            <input ref={colorInputRef} type="color" value={accent} onChange={e => setAccent(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer" tabIndex={-1} />
          </motion.button>
        </div>
        <p className="text-[12px] text-gray-500 mt-3">Выбери готовый цвет или нажми на радужный кружок для точного выбора. Тема применяется ко всему мессенджеру.</p>
      </div>
    </motion.div>
  )
}

function ThemeCard({ active, onClick, label, icon, bg, bar, bubble }: {
  active: boolean; onClick: () => void; label: string; icon: React.ReactNode; bg: string; bar: string; bubble: string
}) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick}
      className="rounded-2xl overflow-hidden border-2 transition-colors text-left"
      style={{ borderColor: active ? "var(--accent)" : "rgba(255,255,255,0.1)" }}>
      <div className="h-20 p-2 flex flex-col justify-between" style={{ backgroundColor: bg }}>
        <div className="h-3 w-2/3 rounded-full" style={{ backgroundColor: bar }} />
        <div className="self-end h-4 w-1/2 rounded-full" style={{ backgroundColor: bubble }} />
      </div>
      <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: bar }}>
        <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: bg === "#e8ecf1" ? "#1a1a1a" : "#fff" }}>{icon}{label}</span>
        {active && <Check size={15} style={{ color: "var(--accent)" }} />}
      </div>
    </motion.button>
  )
}
