"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { generateKeyPair } from "@/lib/crypto"
import { Loader2, ArrowLeft, MailCheck } from "lucide-react"

const ACCENT = "#7e85e1"

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<"form" | "code">("form")
  const [formData, setFormData] = useState({ email: "", username: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [devCode, setDevCode] = useState<string | null>(null)

  // OTP
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""])
  const codeRefs = useRef<(HTMLInputElement | null)[]>([])
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const startVerification = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError("")
    setLoading(true)
    try {
      const { publicKey } = await generateKeyPair()
      const res = await fetch("/api/register/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, publicKey }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Не удалось начать регистрацию"); setLoading(false); return }
      if (data.devCode) setDevCode(data.devCode) // почта не настроена — показываем код для теста
      setStep("code")
      setResendIn(30)
      setCode(["", "", "", "", "", ""])
      setTimeout(() => codeRefs.current[0]?.focus(), 100)
    } catch {
      setError("Что-то пошло не так")
    }
    setLoading(false)
  }

  const submitCode = async (full?: string) => {
    const value = full ?? code.join("")
    if (value.length !== 6) return
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, code: value }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Неверный код")
        setCode(["", "", "", "", "", ""])
        setTimeout(() => codeRefs.current[0]?.focus(), 50)
        setLoading(false)
        return
      }
      // Авто-вход после подтверждения
      const result = await signIn("credentials", { redirect: false, email: formData.email, password: formData.password })
      if (result?.error) { router.push("/login") } else { router.push("/") }
    } catch {
      setError("Что-то пошло не так")
      setLoading(false)
    }
  }

  const onCodeChange = (i: number, v: string) => {
    const digits = v.replace(/\D/g, "")
    if (!digits) { const next = [...code]; next[i] = ""; setCode(next); return }
    if (digits.length > 1) {
      // вставка нескольких цифр (paste)
      const next = [...code]
      for (let k = 0; k < digits.length && i + k < 6; k++) next[i + k] = digits[k]
      setCode(next)
      const filled = next.join("")
      const focusIdx = Math.min(i + digits.length, 5)
      codeRefs.current[focusIdx]?.focus()
      if (filled.length === 6) submitCode(filled)
      return
    }
    const next = [...code]
    next[i] = digits
    setCode(next)
    if (i < 5) codeRefs.current[i + 1]?.focus()
    if (next.join("").length === 6) submitCode(next.join(""))
  }

  const onCodeKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[i] && i > 0) codeRefs.current[i - 1]?.focus()
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 relative overflow-hidden" style={{ background: "#0e1621" }}>
      {/* фоновое свечение */}
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(600px circle at 50% 0%, ${ACCENT}22, transparent 60%)` }} />

      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="relative w-full max-w-md rounded-3xl p-7 sm:p-8"
        style={{ background: "rgba(23,27,38,0.7)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 70px rgba(0,0,0,0.45)" }}
      >
        <div className="flex flex-col items-center mb-6">
          <img src="/logo (1).ico" alt="Vortex" width={92} height={92} style={{ imageRendering: "crisp-edges" }} />
        </div>

        <AnimatePresence mode="wait">
          {step === "form" ? (
            <motion.div key="form" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
              <h1 className="text-2xl font-bold text-center text-white mb-1">Создать аккаунт</h1>
              <p className="text-center text-gray-400 text-sm mb-6">Присоединяйтесь к VortexMessenger</p>

              {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-2.5 rounded-xl mb-5 text-sm">{error}</div>}

              <form onSubmit={startVerification} className="space-y-4">
                <Field label="Email" type="email" value={formData.email} onChange={v => setFormData({ ...formData, email: v })} placeholder="your@email.com" />
                <Field label="Имя пользователя" type="text" value={formData.username} onChange={v => setFormData({ ...formData, username: v })} placeholder="username" />
                <Field label="Пароль" type="password" value={formData.password} onChange={v => setFormData({ ...formData, password: v })} placeholder="Минимум 8 символов" />

                <button type="submit" disabled={loading}
                  className="w-full text-white py-3.5 rounded-xl font-semibold transition-all disabled:opacity-60 active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{ background: ACCENT }}>
                  {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                  {loading ? "Отправляем код..." : "Продолжить"}
                </button>
              </form>

              <p className="text-center text-gray-400 mt-6 text-sm">
                Уже есть аккаунт? <Link href="/login" className="font-semibold hover:underline" style={{ color: ACCENT }}>Войти</Link>
              </p>
            </motion.div>
          ) : (
            <motion.div key="code" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }}>
              <div className="flex flex-col items-center mb-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${ACCENT}22` }}>
                  <MailCheck size={26} style={{ color: ACCENT }} />
                </div>
                <h1 className="text-2xl font-bold text-center text-white mb-1">Проверьте почту</h1>
                <p className="text-center text-gray-400 text-sm">
                  Код отправлен на <span className="text-white">{formData.email}</span>
                </p>
              </div>

              {devCode && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-2.5 rounded-xl mb-4 text-sm text-center">
                  Почта не настроена. Код для теста: <b className="tracking-widest">{devCode}</b>
                </div>
              )}
              {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-2.5 rounded-xl mb-4 text-sm text-center">{error}</div>}

              <div className="flex justify-center gap-2 mb-6" onPaste={e => { e.preventDefault(); onCodeChange(0, e.clipboardData.getData("text")) }}>
                {code.map((d, i) => (
                  <input
                    key={i}
                    ref={el => { codeRefs.current[i] = el }}
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    disabled={loading}
                    onChange={e => onCodeChange(i, e.target.value)}
                    onKeyDown={e => onCodeKey(i, e)}
                    className="w-12 h-14 text-center text-2xl font-bold text-white rounded-xl outline-none transition-all disabled:opacity-60"
                    style={{ background: "#171b26", border: `1px solid ${d ? ACCENT : "rgba(255,255,255,0.1)"}` }}
                  />
                ))}
              </div>

              <button onClick={() => submitCode()} disabled={loading || code.join("").length !== 6}
                className="w-full text-white py-3.5 rounded-xl font-semibold transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ background: ACCENT }}>
                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                {loading ? "Проверяем..." : "Подтвердить"}
              </button>

              <div className="flex items-center justify-between mt-5 text-sm">
                <button onClick={() => { setStep("form"); setError(""); setDevCode(null) }}
                  className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors">
                  <ArrowLeft size={15} /> Назад
                </button>
                <button onClick={() => resendIn === 0 && startVerification()} disabled={resendIn > 0}
                  className="font-medium transition-colors disabled:text-gray-600"
                  style={{ color: resendIn > 0 ? undefined : ACCENT }}>
                  {resendIn > 0 ? `Отправить снова (${resendIn})` : "Отправить код снова"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
        className="w-full px-4 py-3.5 rounded-xl outline-none text-white text-[15px] transition-all placeholder-gray-600 focus:border-transparent focus:ring-2"
        style={{ background: "#171b26", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "none", ...( { "--tw-ring-color": ACCENT } as any) }}
      />
    </div>
  )
}
