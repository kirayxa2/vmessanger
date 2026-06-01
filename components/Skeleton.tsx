"use client"

// Скелетон-лоадеры (shimmer) для всех экранов вместо спиннеров.

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} />
}

// Один ряд в списке чатов
function ChatRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Skeleton className="rounded-full shrink-0" style={{ width: 52, height: 52 }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <Skeleton style={{ width: "45%", height: 13 }} />
          <Skeleton style={{ width: 32, height: 10 }} />
        </div>
        <Skeleton style={{ width: "75%", height: 11 }} />
      </div>
    </div>
  )
}

// Список чатов (сайдбар)
export function ChatListSkeleton({ rows = 9 }: { rows?: number }) {
  return (
    <div className="py-1">
      {Array.from({ length: rows }).map((_, i) => <ChatRowSkeleton key={i} />)}
    </div>
  )
}

// Сообщения в открытом чате
export function MessagesSkeleton() {
  // Чередуем входящие/исходящие пузыри разной ширины
  const rows = [
    { me: false, w: 160 }, { me: false, w: 90 }, { me: true, w: 200 },
    { me: false, w: 130 }, { me: true, w: 110 }, { me: true, w: 170 },
    { me: false, w: 210 }, { me: false, w: 75 }, { me: true, w: 140 },
  ]
  return (
    <div className="flex flex-col gap-3 px-4 py-4 w-full max-w-[850px] mx-auto">
      {rows.map((r, i) => (
        <div key={i} className={`flex ${r.me ? "justify-end" : "justify-start"}`}>
          <Skeleton style={{ width: r.w, height: 38, borderRadius: 16 }} />
        </div>
      ))}
    </div>
  )
}

// Полноэкранная загрузка приложения: сайдбар + область чата
export function AppLoadingSkeleton() {
  return (
    <div className="flex h-full w-full" style={{ backgroundColor: "var(--background, #0e1621)" }}>
      {/* Сайдбар */}
      <div className="hidden md:flex flex-col w-[360px] shrink-0 border-r border-white/5" style={{ backgroundColor: "var(--sidebar-bg, #1c242f)" }}>
        <div className="h-[63px] flex items-center gap-3 px-4 border-b border-white/5">
          <Skeleton className="rounded-full" style={{ width: 38, height: 38 }} />
          <Skeleton style={{ width: 140, height: 14 }} />
        </div>
        <ChatListSkeleton />
      </div>
      {/* Область чата */}
      <div className="flex-1 flex flex-col" style={{ backgroundColor: "var(--chat-bg, #0e1621)" }}>
        <div className="h-[63px] flex items-center gap-3 px-4 border-b border-white/5" style={{ backgroundColor: "var(--header-bg, #1c242f)" }}>
          <Skeleton className="rounded-full" style={{ width: 40, height: 40 }} />
          <div>
            <Skeleton style={{ width: 130, height: 13, marginBottom: 6 }} />
            <Skeleton style={{ width: 70, height: 10 }} />
          </div>
        </div>
        <div className="flex-1">
          <MessagesSkeleton />
        </div>
      </div>
    </div>
  )
}
