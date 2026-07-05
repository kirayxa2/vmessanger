"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Loader2, ShieldCheck } from "lucide-react"

const ACCENT = "var(--accent, #7e85e1)"

export default function AdminLoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({ login: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      // Важно: не используем signIn() из next-auth/react — он жёстко привязан к
      // глобальному basePath "/api/auth" (основной NextAuth мессенджера),
      // а админский провайдер живёт на /api/admin-auth. Делаем ручной POST на CSRF + callback.
      const csrfRes = await fetch("/api/admin-auth/csrf")
      const { csrfToken } = await csrfRes.json()

      const res = await fetch("/api/admin-auth/callback/admin-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          login: formData.login,
          password: formData.password,
          csrfToken,
          json: "true",
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok || data?.url?.includes("error")) {
        setError("Неверный логин или пароль")
        setLoading(false)
        return
      }

      router.push("/admin")
      router.refresh()
    } catch {
      setError("Что-то пошло не так")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 relative overflow-hidden" style={{ background: "#0e1621" }}>
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(600px circle at 50% 0%, ${ACCENT}22, transparent 60%)` }} />

      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="relative w-full max-w-md rounded-3xl p-7 sm:p-8"
        style={{ background: "rgba(23,27,38,0.7)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 70px rgba(0,0,0,0.45)" }}
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-[92px] h-[92px] rounded-2xl flex items-center justify-center" style={{ background: `${ACCENT}22` }}>
            <ShieldCheck size={40} color={ACCENT} />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-white mb-1">Панель администратора</h1>
        <p className="text-center text-gray-400 text-sm mb-6">Доступ только для администраторов организации</p>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-2.5 rounded-xl mb-5 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Логин" type="text" value={formData.login} onChange={v => setFormData({ ...formData, login: v })} placeholder="admin" />
          <Field label="Пароль" type="password" value={formData.password} onChange={v => setFormData({ ...formData, password: v })} placeholder="••••••••" />

          <button type="submit" disabled={loading}
            className="w-full text-white py-3.5 rounded-xl font-semibold transition-all disabled:opacity-60 active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ background: ACCENT }}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder }: { label: string; type: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <label className="absolute -top-2 left-3 px-1.5 text-[11px] font-medium z-10" style={{ background: "#171b26", color: "#9aa4b2" }}>{label}</label>
      <input
        type={type}
        required
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3.5 rounded-xl outline-none text-white text-[15px] transition-all placeholder-gray-600 focus:ring-2 focus:border-transparent"
        style={{ background: "#171b26", border: "1px solid rgba(255,255,255,0.1)", ...({ "--tw-ring-color": ACCENT } as any) }}
      />
    </div>
  )
}
