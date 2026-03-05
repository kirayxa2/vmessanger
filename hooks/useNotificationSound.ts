"use client"

import { useRef, useCallback, useEffect, useState } from "react"

export type SoundType = "message" | "sent" | "pop" | "chime" | "bubble" | "none"

const STORAGE_KEY = "vortex_sound"

function createAudioContext(): AudioContext | null {
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)()
  } catch { return null }
}

function playMessage(ctx: AudioContext) {
  const t = ctx.currentTime
  const notes = [880, 1100]
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = "sine"
    osc.frequency.setValueAtTime(freq, t + i * 0.12)
    gain.gain.setValueAtTime(0, t + i * 0.12)
    gain.gain.linearRampToValueAtTime(0.18, t + i * 0.12 + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.18)
    osc.start(t + i * 0.12); osc.stop(t + i * 0.12 + 0.2)
  })
}

function playSent(ctx: AudioContext) {
  const t = ctx.currentTime
  const osc = ctx.createOscillator(); const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  osc.type = "sine"
  osc.frequency.setValueAtTime(1200, t)
  osc.frequency.exponentialRampToValueAtTime(900, t + 0.1)
  gain.gain.setValueAtTime(0.15, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
  osc.start(t); osc.stop(t + 0.15)
}

function playPop(ctx: AudioContext) {
  const t = ctx.currentTime
  const osc = ctx.createOscillator(); const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  osc.type = "sine"
  osc.frequency.setValueAtTime(300, t)
  osc.frequency.exponentialRampToValueAtTime(600, t + 0.04)
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.1)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.22, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
  osc.start(t); osc.stop(t + 0.15)
}

function playChime(ctx: AudioContext) {
  const t = ctx.currentTime
  const freqs = [660, 880, 1320]
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = "triangle"
    osc.frequency.setValueAtTime(freq, t + i * 0.1)
    gain.gain.setValueAtTime(0, t + i * 0.1)
    gain.gain.linearRampToValueAtTime(0.14, t + i * 0.1 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.3)
    osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.35)
  })
}

function playBubble(ctx: AudioContext) {
  const t = ctx.currentTime
  const osc = ctx.createOscillator(); const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  osc.type = "sine"
  osc.frequency.setValueAtTime(440, t)
  osc.frequency.linearRampToValueAtTime(520, t + 0.06)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.12, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
  osc.start(t); osc.stop(t + 0.12)

  const osc2 = ctx.createOscillator(); const gain2 = ctx.createGain()
  osc2.connect(gain2); gain2.connect(ctx.destination)
  osc2.type = "sine"
  osc2.frequency.setValueAtTime(660, t + 0.08)
  osc2.frequency.linearRampToValueAtTime(740, t + 0.14)
  gain2.gain.setValueAtTime(0, t + 0.08)
  gain2.gain.linearRampToValueAtTime(0.09, t + 0.1)
  gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
  osc2.start(t + 0.08); osc2.stop(t + 0.2)
}

const PLAYERS: Record<SoundType, ((ctx: AudioContext) => void) | null> = {
  message: playMessage,
  sent:    playSent,
  pop:     playPop,
  chime:   playChime,
  bubble:  playBubble,
  none:    null,
}

export const SOUND_LABELS: Record<SoundType, string> = {
  message: "Двойной тон",
  sent:    "Нисходящий",
  pop:     "Пузырь",
  chime:   "Колокольчик",
  bubble:  "Telegram-стиль",
  none:    "Без звука",
}

export function useNotificationSound() {
  const ctxRef = useRef<AudioContext | null>(null)
  const [soundType, setSoundTypeState] = useState<SoundType>("bubble")

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as SoundType | null
      if (saved && saved in PLAYERS) setSoundTypeState(saved)
    } catch {}
  }, [])

  const setSoundType = useCallback((type: SoundType) => {
    setSoundTypeState(type)
    try { localStorage.setItem(STORAGE_KEY, type) } catch {}
  }, [])

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = createAudioContext()
    }
    return ctxRef.current
  }, [])

  const play = useCallback((type?: SoundType) => {
    const which = type ?? soundType
    const player = PLAYERS[which]
    if (!player) return
    const ctx = getCtx()
    if (!ctx) return
    const run = () => player(ctx)
    if (ctx.state === "suspended") ctx.resume().then(run).catch(() => {})
    else run()
  }, [soundType, getCtx])

  const preview = useCallback((type: SoundType) => {
    const player = PLAYERS[type]
    if (!player) return
    const ctx = getCtx()
    if (!ctx) return
    const run = () => player(ctx)
    if (ctx.state === "suspended") ctx.resume().then(run).catch(() => {})
    else run()
  }, [getCtx])

  return { play, preview, soundType, setSoundType }
}
