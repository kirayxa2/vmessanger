"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"

// Тема = id, под каждый id есть CSS-блок [data-theme="..."] в globals.css
export type ThemeId = "dark" | "amoled" | "night" | "light"

export const THEMES: { id: ThemeId; label: string; bg: string; bar: string }[] = [
  { id: "dark", label: "Тёмная", bg: "#0e1621", bar: "#1c242f" },
  { id: "amoled", label: "AMOLED", bg: "#000000", bar: "#0c0c0c" },
  { id: "night", label: "Ночь", bg: "#0b1b2b", bar: "#13293f" },
  { id: "light", label: "Светлая", bg: "#e8ecf1", bar: "#ffffff" },
]

// Пресеты акцентного цвета (палитра как в Zen / Telegram)
export const ACCENT_PRESETS = [
  "#7e85e1", "#5b9bd5", "#3ba55d", "#e0a83c", "#e0533c",
  "#e15a7e", "#8b5cf6", "#22b8b8", "#d45fb0", "#6b7280",
]

// Обои чата: id → подпись + превью-градиент для свотча
export const WALLPAPERS: { id: string; label: string; preview: string }[] = [
  { id: "default", label: "Узор", preview: "repeating-linear-gradient(45deg,#2a3545,#2a3545 6px,#1c242f 6px,#1c242f 12px)" },
  { id: "solid", label: "Сплошной", preview: "var(--chat-bg)" },
  { id: "aurora", label: "Aurora", preview: "linear-gradient(-45deg,#5b67ea,#22b8b8,#e15a7e)" },
  { id: "ocean", label: "Океан", preview: "linear-gradient(160deg,#1a2980,#26d0ce)" },
  { id: "sunset", label: "Закат", preview: "linear-gradient(160deg,#ff8008,#ffc837)" },
  { id: "forest", label: "Лес", preview: "linear-gradient(160deg,#134e5e,#71b280)" },
  { id: "grape", label: "Виноград", preview: "linear-gradient(160deg,#8e2de2,#4a00e0)" },
  { id: "rose", label: "Роза", preview: "linear-gradient(160deg,#ee9ca7,#ffdde1)" },
]

const DEFAULT_ACCENT = "#7e85e1"

interface ThemeContextType {
  theme: ThemeId
  accent: string
  wallpaper: string
  toggleTheme: () => void
  setTheme: (t: ThemeId) => void
  setAccent: (hex: string) => void
  setWallpaper: (id: string) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  accent: DEFAULT_ACCENT,
  wallpaper: "default",
  toggleTheme: () => {},
  setTheme: () => {},
  setAccent: () => {},
  setWallpaper: () => {},
})

export const useTheme = () => useContext(ThemeContext)

// Затемнение hex-цвета (для hover-состояния)
function shade(hex: string, factor: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return hex
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  const r = clamp(parseInt(m[1], 16) * factor)
  const g = clamp(parseInt(m[2], 16) * factor)
  const b = clamp(parseInt(m[3], 16) * factor)
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

// Акцент применяется во ВСЕХ местах через CSS-переменные на <html>
function applyAccentVars(hex: string) {
  const root = document.documentElement
  root.style.setProperty("--accent", hex)
  root.style.setProperty("--accent-hover", shade(hex, 0.86))
  root.style.setProperty("--sidebar-item-active", hex)
  root.style.setProperty("--sender-bubble", hex)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("dark")
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT)
  const [wallpaper, setWallpaperState] = useState<string>("default")

  useEffect(() => {
    const root = document.documentElement
    const savedTheme = localStorage.getItem("vortex-theme") as ThemeId | null
    if (savedTheme && THEMES.some(t => t.id === savedTheme)) {
      setThemeState(savedTheme)
      root.setAttribute("data-theme", savedTheme)
    }
    const savedAccent = localStorage.getItem("vortex-accent")
    if (savedAccent && /^#[0-9a-f]{6}$/i.test(savedAccent)) {
      setAccentState(savedAccent)
      applyAccentVars(savedAccent)
    }
    const savedWp = localStorage.getItem("vortex-wallpaper")
    if (savedWp) {
      setWallpaperState(savedWp)
      root.setAttribute("data-wallpaper", savedWp)
    } else {
      root.setAttribute("data-wallpaper", "default")
    }
  }, [])

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t)
    localStorage.setItem("vortex-theme", t)
    document.documentElement.setAttribute("data-theme", t)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const next: ThemeId = prev === "light" ? "dark" : "light"
      localStorage.setItem("vortex-theme", next)
      document.documentElement.setAttribute("data-theme", next)
      return next
    })
  }, [])

  const setAccent = useCallback((hex: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return
    setAccentState(hex)
    localStorage.setItem("vortex-accent", hex)
    applyAccentVars(hex)
  }, [])

  const setWallpaper = useCallback((id: string) => {
    setWallpaperState(id)
    localStorage.setItem("vortex-wallpaper", id)
    document.documentElement.setAttribute("data-wallpaper", id)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, accent, wallpaper, toggleTheme, setTheme, setAccent, setWallpaper }}>
      {children}
    </ThemeContext.Provider>
  )
}
