// Кастомные титулы для пользователей
// Добавь сюда userId -> { label, colors } чтобы выдать титул

interface TitleConfig {
  label: string
  bg: string       // фон бейджика
  text: string     // цвет текста
  border?: string  // необязательная обводка
}

const TITLE_MAP: Record<number, TitleConfig> = {
  7: {
    label: "ШИПУЧКА",
    bg: "linear-gradient(90deg, #f953c6, #b91d73)",
    text: "#fff",
    border: "rgba(255,255,255,0.25)",
  },
  // Добавляй новые титулы сюда:
  // 5: { label: "ЛЕГЕНДА", bg: "linear-gradient(90deg, #f7971e, #ffd200)", text: "#000" },
}

export function getTitleForUser(userId: string | number | undefined): TitleConfig | null {
  if (userId == null) return null
  const num = Number(userId)
  return TITLE_MAP[num] ?? null
}

interface TitleBadgeProps {
  userId: string | number | undefined
  className?: string
}

export default function TitleBadge({ userId, className = "" }: TitleBadgeProps) {
  const cfg = getTitleForUser(userId)
  if (!cfg) return null

  return (
    <span
      className={`inline-flex items-center px-[5px] py-[1px] rounded-[5px] text-[9px] font-extrabold tracking-[0.08em] leading-none select-none shrink-0 ${className}`}
      style={{
        background: cfg.bg,
        color: cfg.text,
        border: cfg.border ? `1px solid ${cfg.border}` : undefined,
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
        letterSpacing: "0.06em",
      }}
    >
      {cfg.label}
    </span>
  )
}
