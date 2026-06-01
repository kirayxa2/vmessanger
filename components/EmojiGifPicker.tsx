"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Smile, Image, Sticker, Search, X } from "lucide-react"
import data from "@emoji-mart/data"
import Picker from "@emoji-mart/react"

const ACCENT = "var(--accent, #7e85e1)"
const TABS = [
  { id: "emoji", icon: <Smile size={18} />, label: "Эмодзи" },
  { id: "gif", icon: <Image size={18} />, label: "GIF" },
  { id: "sticker", icon: <Sticker size={18} />, label: "Стикеры" },
] as const

type TabId = "emoji" | "gif" | "sticker"

// ── Telegram стикеры (бесплатный набор от Telegram)
const STICKER_PACKS = [
  {
    name: "Durov",
    stickers: [
      "https://tlgrm.ru/_/stickers/1c2/628/1c26283e-3e7e-4b12-b1dd-aca940dfacf0/1.webp",
    ],
  },
]

// Встроенные стикеры (emoji большие)
const BUILTIN_STICKERS = [
  "😀","😂","🥹","😍","🤩","😎","🥺","😭","😡","🤯",
  "🎉","🔥","💯","✨","❤️","💔","👀","🙏","💪","🤝",
  "🐶","🐱","🦊","🐸","🦋","🌸","🌈","⭐","🍕","🎮",
]

interface GifResult {
  id: string
  title: string
  url: string
  preview: string
}

async function searchGifs(query: string): Promise<GifResult[]> {
  // Using Tenor v2 API (free, no key needed for basic use)
  // Fallback to static popular gifs if no query
  const q = query || "funny"
  try {
    const res = await fetch(
      `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=AIzaSyAyimkuYQYF_FXVALexPzpuGiCePj7CNZU&limit=20&media_filter=gif`
    )
    const json = await res.json()
    return (json.results || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      url: r.media_formats?.gif?.url || r.media_formats?.tinygif?.url || "",
      preview: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || "",
    }))
  } catch {
    return []
  }
}

interface EmojiGifPickerProps {
  open: boolean
  onClose: () => void
  onEmojiSelect: (emoji: string) => void
  onGifSelect: (url: string) => void
  onStickerSelect: (sticker: string) => void
  anchorRef?: React.RefObject<HTMLElement>
}

export default function EmojiGifPicker({
  open, onClose, onEmojiSelect, onGifSelect, onStickerSelect
}: EmojiGifPickerProps) {
  const [tab, setTab] = useState<TabId>("emoji")
  const [gifQuery, setGifQuery] = useState("")
  const [gifs, setGifs] = useState<GifResult[]>([])
  const [loadingGifs, setLoadingGifs] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (tab !== "gif") return
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(async () => {
      setLoadingGifs(true)
      const results = await searchGifs(gifQuery)
      setGifs(results)
      setLoadingGifs(false)
    }, gifQuery ? 400 : 0)
  }, [gifQuery, tab])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[150]" onClick={onClose} />

          <motion.div
  initial={{ opacity: 0, scale: 0.92, y: 8 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.92, y: 8 }}
  transition={{ type: "spring", stiffness: 440, damping: 28, mass: 0.7 }}
  className="fixed z-[151] bottom-[80px] left-[60px] w-[340px] rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col"
  style={{ 
    transformOrigin: "bottom left", 
    backgroundColor: "#1a2332" 
     }}
>
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-3 pt-3 pb-2 border-b border-white/5">
              {TABS.map(t => (
                <motion.button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  whileTap={{ scale: 0.9 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors"
                  style={{
                    backgroundColor: tab === t.id ? ACCENT : "transparent",
                    color: tab === t.id ? "white" : "#6b7280",
                  }}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </motion.button>
              ))}
              <div className="flex-1" />
              <motion.button onClick={onClose} whileTap={{ scale: 0.9 }}
                className="p-1.5 rounded-full hover:bg-white/10 text-gray-500">
                <X size={14} />
              </motion.button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden" style={{ height: 340 }}>
              <AnimatePresence mode="wait">
                {tab === "emoji" && (
                  <motion.div key="emoji" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="h-full overflow-hidden">
                    <Picker
                      data={data}
                      onEmojiSelect={(e: any) => { onEmojiSelect(e.native); }}
                      theme="dark"
                      locale="ru"
                      previewPosition="none"
                      skinTonePosition="none"
                      set="native"
                      emojiSize={22}
                      emojiButtonSize={34}
                      maxFrequentRows={2}
                      navPosition="bottom"
                      style={{ width: "100%", height: "100%", border: "none", background: "transparent" }}
                    />
                  </motion.div>
                )}

                {tab === "gif" && (
                  <motion.div key="gif" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="h-full flex flex-col">
                    {/* Search */}
                    <div className="px-3 py-2 border-b border-white/5">
                      <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                        <Search size={14} className="text-gray-500 shrink-0" />
                        <input
                          autoFocus
                          value={gifQuery}
                          onChange={e => setGifQuery(e.target.value)}
                          placeholder="Поиск GIF..."
                          className="flex-1 bg-transparent text-white text-[13px] outline-none placeholder-gray-500"
                        />
                        {gifQuery && (
                          <button onClick={() => setGifQuery("")} className="text-gray-500"><X size={12} /></button>
                        )}
                      </div>
                    </div>
                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto hide-scrollbar p-2">
                      {loadingGifs ? (
                        <div className="flex items-center justify-center pt-10">
                          <div className="w-6 h-6 rounded-full border-2 border-[#7e85e1] border-t-transparent animate-spin" />
                        </div>
                      ) : gifs.length === 0 ? (
                        <div className="flex flex-col items-center pt-10 gap-2 text-gray-600">
                          <Image size={36} strokeWidth={1} />
                          <p className="text-[13px]">Введите запрос для поиска GIF</p>
                        </div>
                      ) : (
                        <div className="columns-2 gap-2 space-y-2">
                          {gifs.map(gif => (
                            <motion.button
                              key={gif.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => { onGifSelect(gif.url); onClose(); }}
                              className="w-full rounded-xl overflow-hidden break-inside-avoid"
                            >
                              <img
                                src={gif.preview}
                                alt={gif.title}
                                loading="lazy"
                                className="w-full h-auto object-cover rounded-xl"
                              />
                            </motion.button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-center text-[10px] text-gray-700 pb-1">Powered by Tenor</p>
                  </motion.div>
                )}

                {tab === "sticker" && (
                  <motion.div key="sticker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="h-full overflow-y-auto hide-scrollbar p-3">
                    <p className="text-[11px] text-gray-600 mb-3 uppercase tracking-wider font-semibold">Базовые стикеры</p>
                    <div className="grid grid-cols-6 gap-2">
                      {BUILTIN_STICKERS.map((s, i) => (
                        <motion.button
                          key={i}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.85 }}
                          onClick={() => { onStickerSelect(s); onClose(); }}
                          className="w-full aspect-square flex items-center justify-center text-3xl rounded-xl hover:bg-white/8 transition-colors"
                        >
                          {s}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
