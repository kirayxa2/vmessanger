"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { ArrowLeft, ChevronRight, Eye, EyeOff, Loader2 } from "lucide-react"

// ─────────────────────────────────────────────────────────────
// Общие элементы экранов настроек.
// Все цвета берутся из CSS-переменных темы (см. globals.css),
// поэтому экраны одинаково читаются в тёмной, AMOLED, «Ночь» и светлой темах.
// ─────────────────────────────────────────────────────────────

export const ACCENT = "var(--accent, #7e85e1)"
export const CARD_BG = "var(--surface-secondary, #0a0f17)"
export const TEXT = "var(--text-primary, #ffffff)"
export const MUTED = "var(--text-secondary, #8896a5)"
export const LINE = "var(--border-subtle, rgba(255,255,255,0.06))"
export const DANGER = "#f87171"

/** Полноэкранный подэкран настроек с заголовком и кнопкой «назад» */
export function ScreenShell({ title, onBack, right, children }: {
  title: string
  onBack: () => void
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col"
      style={{ backgroundColor: "var(--sidebar-bg, #1c242f)", color: TEXT }}
      initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
    >
      <div className="px-4 h-[63px] flex items-center gap-3 shrink-0" style={{ borderBottom: `1px solid ${LINE}` }}>
        <motion.button
          onClick={onBack}
          whileTap={{ scale: 0.9 }}
          aria-label="Назад"
          className="p-2 -ml-2 rounded-full transition-colors hover:bg-[rgba(127,127,127,0.15)]"
          style={{ color: MUTED }}
        >
          <ArrowLeft size={22} />
        </motion.button>
        <h2 className="text-[18px] font-bold flex-1 truncate" style={{ color: TEXT }}>{title}</h2>
        {right}
      </div>
      <div className="flex-1 overflow-y-auto hide-scrollbar pb-10">{children}</div>
    </motion.div>
  )
}

/** Заголовок секции (акцентный, капсом) */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 pt-6 pb-2 text-[12px] font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
      {children}
    </p>
  )
}

/** Карточка-группа: строки внутри разделены тонкой линией (с отступом под иконку) */
export function Card({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children)
  return (
    <div className="mx-3 rounded-2xl overflow-hidden" style={{ backgroundColor: CARD_BG }}>
      {items.map((child, i) => (
        <div key={i} className="relative">
          {i > 0 && <div className="absolute top-0 right-0 h-px" style={{ left: 64, backgroundColor: LINE }} />}
          {child}
        </div>
      ))}
    </div>
  )
}

/** Пояснение под группой */
export function Footnote({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 pt-2 text-[12px] leading-relaxed" style={{ color: MUTED }}>
      {children}
    </p>
  )
}

/** Строка настроек: иконка, заголовок, подпись, значение справа, стрелка или свой элемент */
export function Row({ icon, color = ACCENT, title, subtitle, value, onClick, right, danger, chevron = true }: {
  icon?: React.ReactNode
  color?: string
  title: string
  subtitle?: string
  value?: string
  onClick?: () => void
  right?: React.ReactNode
  danger?: boolean
  chevron?: boolean
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      className={`flex items-center gap-3.5 px-4 py-3 transition-colors ${onClick ? "cursor-pointer hover:bg-[rgba(127,127,127,0.12)]" : ""}`}
    >
      {icon && (
        <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: color }}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] leading-tight truncate" style={{ color: danger ? DANGER : TEXT }}>{title}</p>
        {subtitle && <p className="text-[12px] mt-0.5 leading-snug" style={{ color: MUTED }}>{subtitle}</p>}
      </div>
      {value && <span className="text-[13px] shrink-0 max-w-[40%] truncate" style={{ color: MUTED }}>{value}</span>}
      {right ?? (onClick && chevron ? <ChevronRight size={16} className="shrink-0 opacity-60" style={{ color: MUTED }} /> : null)}
    </div>
  )
}

/** Переключатель */
export function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={e => { e.stopPropagation(); onToggle() }}
      className="relative w-12 h-7 rounded-full shrink-0 focus:outline-none transition-colors"
      style={{ backgroundColor: enabled ? ACCENT : "rgba(127,127,127,0.35)" }}
    >
      <motion.span
        className="absolute top-[3px] w-[22px] h-[22px] bg-white rounded-full shadow"
        animate={{ left: enabled ? 23 : 3 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  )
}

/** Строка с переключателем */
export function ToggleRow({ icon, color, title, subtitle, enabled, onToggle }: {
  icon?: React.ReactNode
  color?: string
  title: string
  subtitle?: string
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <Row
      icon={icon}
      color={enabled ? (color ?? ACCENT) : "rgba(127,127,127,0.45)"}
      title={title}
      subtitle={subtitle}
      onClick={onToggle}
      right={<Toggle enabled={enabled} onToggle={onToggle} />}
    />
  )
}

/** Поле ввода с плавающей подписью; для паролей — кнопка «показать» */
export function Field({ label, value, onChange, type = "text", autoComplete, error, hint, multiline, maxLength, prefix }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  autoComplete?: string
  error?: string
  hint?: string
  multiline?: boolean
  maxLength?: number
  prefix?: string
}) {
  const [show, setShow] = useState(false)
  const [focused, setFocused] = useState(false)
  const isPassword = type === "password"

  return (
    <div className="flex flex-col gap-1">
      <div
        className="relative rounded-xl px-4 pt-2 pb-1.5 transition-colors"
        style={{ backgroundColor: CARD_BG, border: `1.5px solid ${error ? DANGER : focused ? ACCENT : LINE}` }}
      >
        <label className="block text-[11px]" style={{ color: error ? DANGER : focused ? ACCENT : MUTED }}>{label}</label>
        <div className="flex items-baseline">
          {prefix && <span className="text-[15px] select-none shrink-0" style={{ color: MUTED }}>{prefix}</span>}
          {multiline ? (
            <textarea
              value={value}
              onChange={e => onChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              maxLength={maxLength}
              rows={3}
              className="w-full bg-transparent outline-none text-[15px] resize-none pr-8"
              style={{ color: TEXT }}
            />
          ) : (
            <input
              type={isPassword && show ? "text" : type}
              value={value}
              onChange={e => onChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoComplete={autoComplete}
              maxLength={maxLength}
              className="w-full bg-transparent outline-none text-[15px] pr-9"
              style={{ color: TEXT }}
            />
          )}
        </div>
        {maxLength && (
          <span className="absolute bottom-1.5 right-3 text-[11px]" style={{ color: MUTED }}>{maxLength - value.length}</span>
        )}
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={show ? "Скрыть пароль" : "Показать пароль"}
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
            style={{ color: MUTED }}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {(error || hint) && (
        <p className="text-[12px] px-1" style={{ color: error ? DANGER : MUTED }}>{error || hint}</p>
      )}
    </div>
  )
}

/** Главная кнопка действия */
export function PrimaryButton({ children, onClick, disabled, loading }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || loading}
      whileTap={{ scale: 0.98 }}
      className="w-full py-3 rounded-xl text-white font-semibold text-[15px] shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
      style={{ backgroundColor: ACCENT }}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : children}
    </motion.button>
  )
}
