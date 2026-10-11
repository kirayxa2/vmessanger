"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Check, Pipette, CheckCheck } from "lucide-react"
import { useRef, useState, useEffect } from "react"
import { useTheme, ACCENT_PRESETS, THEMES, WALLPAPERS, type ThemeId } from "@/lib/theme"
import { ScreenShell, MUTED } from "./settings/ui"

// Сценарий живого превью: кто пишет, текст, реакция (необязательно)
const DEMO: { me: boolean; text: string; time: string; reaction?: string }[] = [
  { me: false, text: "Привет! Как тебе новая тема? 🎨", time: "12:41" },
  { me: true, text: "Огонь! Меняется прямо на лету ✨", time: "12:41", reaction: "🔥" },
  { me: false, text: "А обои и цвет пузырей можно менять?", time: "12:42" },
  { me: true, text: "Конечно, выбирай ниже 👇", time: "12:42" },
]

function LivePreview() {
  const [step, setStep] = useState(0)   // сколько сообщений показано
  const [typing, setTyping] = useState(false)
  const [round, setRound] = useState(0)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    setStep(0); setTyping(false)
    let t = 500
    DEMO.forEach((m, i) => {
      if (!m.me) { timers.push(setTimeout(() => setTyping(true), t)); t += 900 }
      timers.push(setTimeout(() => { setTyping(false); setStep(i + 1) }, t))
      t += 1100
    })
    timers.push(setTimeout(() => setRound(r => r + 1), t + 3500)) // повтор цикла
    return () => timers.forEach(clearTimeout)
  }, [round])

  return (
    <div className="mx-3 mt-4 rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--chat-bg)", border: "1px solid var(--border-subtle, rgba(127,127,127,0.2))" }}>
      {/* Шапка чата */}
      <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ backgroundColor: "var(--input-bg)" }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[13px] font-bold" style={{ backgroundColor: "var(--accent)" }}>В</div>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary, #fff)" }}>Вортекс</p>
          <p className="text-[11px]" style={{ color: typing ? "var(--accent)" : MUTED }}>{typing ? "печатает…" : "в сети"}</p>
        </div>
      </div>

      {/* Сообщения */}
      <div className="tg-bg px-3 py-3 flex flex-col gap-1.5" style={{ minHeight: 210 }}>
        <AnimatePresence initial={false}>
          {DEMO.slice(0, step).map((m, i) => (
            <motion.div key={`${round}-${i}`}
              initial={{ opacity: 0, y: 14, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              className={`relative max-w-[78%] px-3 py-1.5 text-[14px] shadow ${m.me ? "self-end rounded-2xl rounded-br-md text-white" : "self-start rounded-2xl rounded-bl-md"}`}
              style={m.me ? { backgroundColor: "var(--accent)" } : { backgroundColor: "var(--recipient-bubble)", color: "var(--recipient-text)" }}>
              {m.text}
              <span className="inline-flex items-center gap-0.5 ml-2 text-[10px] align-bottom opacity-70">
                {m.time}{m.me && <CheckCheck size={12} />}
              </span>
              {m.reaction && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: "spring", stiffness: 500, damping: 18 }}
                  className="absolute -bottom-3 left-2 text-[12px] px-1.5 rounded-full shadow"
                  style={{ backgroundColor: "var(--recipient-bubble)", color: "var(--recipient-text)" }}>{m.reaction} 1</motion.span>
              )}
            </motion.div>
          ))}
          {typing && (
            <motion.div key="typing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="self-start flex gap-1 px-3 py-2.5 rounded-2xl rounded-bl-md shadow"
              style={{ backgroundColor: "var(--recipient-bubble)" }}>
              {[0, 1, 2].map(d => (
                <motion.span key={d} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: MUTED }}
                  animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.7, delay: d * 0.15 }} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Поле ввода */}
      <div className="flex items-center gap-2 p-2.5" style={{ backgroundColor: "var(--input-bg)" }}>
        <div className="flex-1 h-9 rounded-full flex items-center px-3 text-[13px]" style={{ backgroundColor: "rgba(127,127,127,0.15)", color: MUTED }}>Сообщение…</div>
        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--accent)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" /></svg>
        </div>
      </div>
    </div>
  )
}

export default function ThemePicker({ onBack }: { onBack: () => void }) {
  const { theme, accent, wallpaper, setTheme, setAccent, setWallpaper } = useTheme()
  const colorInputRef = useRef<HTMLInputElement>(null)

  const isPreset = ACCENT_PRESETS.some(c => c.toLowerCase() === accent.toLowerCase())

  return (
    <ScreenShell title="Внешний вид" onBack={onBack}>
      <LivePreview />

      <div className="p-5 pt-2">

        {/* ── Тема ── */}
        <p className="text-[12px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Тема</p>
        <div className="grid grid-cols-2 gap-3 mb-7">
          {THEMES.map(t => (
            <ThemeCard key={t.id} active={theme === t.id} onClick={() => setTheme(t.id)} label={t.label}
              bg={t.bg} bar={t.bar} bubble={accent} />
          ))}
        </div>

        {/* ── Обои чата ── */}
        <p className="text-[12px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Обои чата</p>
        <div className="grid grid-cols-4 gap-3 mb-7">
          {WALLPAPERS.map(w => {
            const active = wallpaper === w.id
            return (
              <motion.button key={w.id} whileTap={{ scale: 0.95 }} onClick={() => setWallpaper(w.id)}
                className="flex flex-col items-center gap-1.5">
                <div className="w-full rounded-xl relative overflow-hidden"
                  style={{ aspectRatio: "1 / 1.3", background: w.preview, backgroundSize: "cover", border: active ? "2px solid var(--accent)" : "2px solid rgba(255,255,255,0.1)" }}>
                  {w.id === "aurora" && <span className="absolute top-1 right-1 text-[9px] bg-black/40 text-white px-1 rounded">live</span>}
                  {active && <div className="absolute inset-0 flex items-center justify-center bg-black/25"><Check size={18} className="text-white" /></div>}
                </div>
                <span className="text-[11px] text-gray-400">{w.label}</span>
              </motion.button>
            )
          })}
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
        <p className="text-[12px] mt-3" style={{ color: MUTED }}>Тема, обои и акцент применяются ко всему мессенджеру и сохраняются на этом устройстве.</p>
      </div>
    </ScreenShell>
  )
}

function ThemeCard({ active, onClick, label, bg, bar, bubble }: {
  active: boolean; onClick: () => void; label: string; bg: string; bar: string; bubble: string
}) {
  const lightish = bg === "#e8ecf1" || bg === "#ffffff"
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick}
      className="rounded-2xl overflow-hidden border-2 transition-colors text-left"
      style={{ borderColor: active ? "var(--accent)" : "rgba(255,255,255,0.1)" }}>
      <div className="h-16 p-2 flex flex-col justify-between" style={{ backgroundColor: bg }}>
        <div className="h-2.5 w-2/3 rounded-full" style={{ backgroundColor: bar }} />
        <div className="self-end h-3.5 w-1/2 rounded-full" style={{ backgroundColor: bubble }} />
      </div>
      <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: bar }}>
        <span className="text-[13px] font-semibold" style={{ color: lightish ? "#1a1a1a" : "#fff" }}>{label}</span>
        {active && <Check size={15} style={{ color: "var(--accent)" }} />}
      </div>
    </motion.button>
  )
}
