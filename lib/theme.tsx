"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"

type Theme = "dark" | "light"

// Пресеты акцентного цвета (как палитра в Zen / Telegram)
export const ACCENT_PRESETS = [
  "#7e85e1", // Vortex (default)
  "#5b9bd5", // Sky
  "#3ba55d", // Emerald
  "#e0a83c", // Amber
  "#e0533c", // Coral
  "#e15a7e", // Rose
  "#8b5cf6", // Violet
  "#22b8b8", // Teal
  "#d45fb0", // Pink
  "#6b7280", // Graphite
]

const DEFAULT_ACCENT = "#7e85e1"

interface ThemeContextType {
  theme: Theme
  accent: string
  toggleTheme: () => void
  setTheme: (t: Theme) => void
  setAccent: (hex: string) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  accent: DEFAULT_ACCENT,
  toggleTheme: () => {},
  setTheme: () => {},
  setAccent: () => {},
})

export const useTheme = () => useContext(ThemeContext)

// Затемнение hex-цвета на коэффициент (для hover-состояния)
function shade(hex: string, factor: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return hex
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  const r = clamp(parseInt(m[1], 16) * factor)
  const g = clamp(parseInt(m[2], 16) * factor)
  const b = clamp(parseInt(m[3], 16) * factor)
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

// Применяем акцент во ВСЕХ местах через CSS-переменные на <html>
function applyAccentVars(hex: string) {
  const root = document.documentElement
  root.style.setProperty("--accent", hex)
  root.style.setProperty("--accent-hover", shade(hex, 0.86))
  root.style.setProperty("--sidebar-item-active", hex)
  root.style.setProperty("--sender-bubble", hex)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark")
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT)

  useEffect(() => {
    const savedTheme = localStorage.getItem("vortex-theme") as Theme | null
    if (savedTheme === "dark" || savedTheme === "light") {
      setThemeState(savedTheme)
      document.documentElement.setAttribute("data-theme", savedTheme)
    }
    const savedAccent = localStorage.getItem("vortex-accent")
    if (savedAccent && /^#[0-9a-f]{6}$/i.test(savedAccent)) {
      setAccentState(savedAccent)
      applyAccentVars(savedAccent)
    }
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem("vortex-theme", t)
    document.documentElement.setAttribute("data-theme", t)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const next = prev === "dark" ? "light" : "dark"
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

  return (
    <ThemeContext.Provider value={{ theme, accent, toggleTheme, setTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  )
}
