// hooks/useProfanityFilter.ts
import { useState, useEffect, useCallback } from "react"
import { filterProfanity } from "@/lib/profanityFilter"

export const PROFANITY_KEY = "vortex_profanity_filter"

export function useProfanityFilter() {
  const [enabled, setEnabled] = useState<boolean>(false)

  // Читаем из localStorage только на клиенте (после гидрации)
  useEffect(() => {
    setEnabled(localStorage.getItem(PROFANITY_KEY) === "true")
  }, [])

  // Синхронизация между вкладками
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === PROFANITY_KEY) setEnabled(e.newValue === "true")
    }
    window.addEventListener("storage", handler)
    return () => window.removeEventListener("storage", handler)
  }, [])

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev
      localStorage.setItem(PROFANITY_KEY, String(next))
      return next
    })
  }, [])

  // filter() — применяет фильтр если включён, иначе возвращает оригинал
  const filter = useCallback((text: string): string => {
    if (!enabled || !text) return text
    return filterProfanity(text)
  }, [enabled])

  return { enabled, toggle, filter }
}
