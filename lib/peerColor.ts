// Детерминированный цвет по собеседнику (как в Telegram) — для имён и заглушек аватаров.
const PEER_COLORS = [
  "#e17076", // red
  "#7bc862", // green
  "#e5ca77", // yellow
  "#65aadd", // blue
  "#a695e7", // purple
  "#ee7aae", // pink
  "#6ec9cb", // cyan
  "#faa774", // orange
]

export function peerColor(id: string | number | null | undefined): string {
  if (id == null) return PEER_COLORS[0]
  const digits = ("" + id).replace(/\D/g, "")
  const n = digits ? parseInt(digits.slice(-9)) : 0
  return PEER_COLORS[Math.abs(n) % PEER_COLORS.length]
}

// Градиент для аватара-заглушки (чуть живее, чем плоский цвет)
export function peerGradient(id: string | number | null | undefined): string {
  const base = peerColor(id)
  return `linear-gradient(135deg, ${base}, ${shade(base, 0.75)})`
}

function shade(hex: string, factor: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return hex
  const c = (i: number) => Math.max(0, Math.min(255, Math.round(parseInt(m[i], 16) * factor)))
  return `#${c(1).toString(16).padStart(2, "0")}${c(2).toString(16).padStart(2, "0")}${c(3).toString(16).padStart(2, "0")}`
}
