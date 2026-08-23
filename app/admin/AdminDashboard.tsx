"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { LogOut, Plus, Trash2, Pencil, Loader2, KeyRound, X, Users, ShieldAlert, Circle } from "lucide-react"

const ACCENT = "var(--accent, #7e85e1)"

type Employee = {
  id: number
  login: string
  fullName: string
  position: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  user: { id: number; avatar: string | null; lastSeen: string | null }
}

export default function AdminDashboard({ adminName }: { adminName: string }) {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/employees")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEmployees(data.employees)
    } catch {
      setError("Не удалось загрузить список сотрудников")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить сотрудника? Это действие необратимо.")) return
    try {
      const res = await fetch(`/api/admin/employees/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setEmployees(prev => prev.filter(e => e.id !== id))
    } catch {
      alert("Не удалось удалить сотрудника")
    }
  }

  const handleDeleteAll = async () => {
    if (employees.length === 0) return
    if (!confirm(`Удалить ВСЕХ сотрудников (${employees.length})? Это действие необратимо.`)) return
    if (!confirm("Вы точно уверены? Все аккаунты сотрудников будут удалены безвозвратно.")) return
    setDeletingAll(true)
    try {
      const res = await fetch("/api/admin/employees", { method: "DELETE" })
      if (!res.ok) throw new Error()
      setEmployees([])
    } catch {
      alert("Не удалось удалить сотрудников")
    } finally {
      setDeletingAll(false)
    }
  }

  const toggleActive = async (emp: Employee) => {
    try {
      const res = await fetch(`/api/admin/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !emp.isActive }),
      })
      if (!res.ok) throw new Error()
      setEmployees(prev => prev.map(e => (e.id === emp.id ? { ...e, isActive: !e.isActive } : e)))
    } catch {
      alert("Не удалось изменить статус")
    }
  }

  const handleSignOut = async () => {
    // Аналогично входу: signOut() из next-auth/react бьёт в /api/auth, а надо /api/admin-auth
    try {
      const csrfRes = await fetch("/api/admin-auth/csrf")
      const { csrfToken } = await csrfRes.json()
      await fetch("/api/admin-auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken, json: "true" }),
      })
    } finally {
      router.push("/admin/login")
      router.refresh()
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10 grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 items-start">
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${ACCENT}22` }}>
            <Users size={22} color={ACCENT} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Сотрудники организации</h1>
            <p className="text-sm text-gray-400">Вы вошли как {adminName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white text-sm transition-all active:scale-[0.97]"
            style={{ background: ACCENT }}
          >
            <Plus size={16} /> Добавить
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={deletingAll || employees.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-red-300 transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)" }}
            title="Удалить всех сотрудников"
          >
            {deletingAll ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
            Удалить всех
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-gray-300 transition-all active:scale-[0.97]"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <LogOut size={16} /> Выйти
          </button>
        </div>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-2.5 rounded-xl mb-5 text-sm">{error}</div>}

      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(23,27,38,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
        ) : employees.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">Пока нет ни одного сотрудника</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <th className="px-5 py-3 font-medium">Сотрудник</th>
                <th className="px-5 py-3 font-medium">Логин</th>
                <th className="px-5 py-3 font-medium">Должность</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3 font-medium">Последний вход</th>
                <th className="px-5 py-3 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} className="border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <td className="px-5 py-3 text-white font-medium">{emp.fullName}</td>
                  <td className="px-5 py-3 text-gray-300 font-mono">{emp.login}</td>
                  <td className="px-5 py-3 text-gray-400">{emp.position || "—"}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleActive(emp)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium"
                      style={emp.isActive
                        ? { background: "rgba(74,222,128,0.15)", color: "#4ade80" }
                        : { background: "rgba(248,113,113,0.15)", color: "#f87171" }}
                    >
                      {emp.isActive ? "Активен" : "Заблокирован"}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-gray-400">
                    {emp.lastLoginAt ? new Date(emp.lastLoginAt).toLocaleString("ru-RU") : "Ещё не входил"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setEditing(emp)} className="p-2 rounded-lg text-gray-400 hover:text-white" style={{ background: "rgba(255,255,255,0.05)" }} title="Редактировать">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(emp.id)} className="p-2 rounded-lg text-red-400 hover:text-red-300" style={{ background: "rgba(248,113,113,0.1)" }} title="Удалить">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AnimatePresence>
        {showCreate && (
          <EmployeeModal
            title="Новый сотрудник"
            onClose={() => setShowCreate(false)}
            onSaved={(emp) => { setEmployees(prev => [emp, ...prev]); setShowCreate(false) }}
          />
        )}
        {editing && (
          <EmployeeModal
            title="Редактировать сотрудника"
            employee={editing}
            onClose={() => setEditing(null)}
            onSaved={(emp) => {
              setEmployees(prev => prev.map(e => (e.id === emp.id ? { ...e, ...emp } : e)))
              setEditing(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>

    <LiveWidget />
    </div>
  )
}

function EmployeeModal({
  title, employee, onClose, onSaved,
}: {
  title: string
  employee?: Employee
  onClose: () => void
  onSaved: (emp: any) => void
}) {
  const isEdit = !!employee
  const [login, setLogin] = useState(employee?.login || "")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState(employee?.fullName || "")
  const [position, setPosition] = useState(employee?.position || "")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      if (isEdit) {
        const res = await fetch(`/api/admin/employees/${employee!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName, position, ...(password ? { newPassword: password } : {}) }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || "Ошибка"); setSaving(false); return }
        onSaved(data.employee)
      } else {
        const res = await fetch("/api/admin/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login, password, fullName, position }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || "Ошибка"); setSaving(false); return }
        onSaved({ ...data.employee, user: { id: 0, avatar: null, lastSeen: null }, lastLoginAt: null })
      }
    } catch {
      setError("Что-то пошло не так")
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: "#171b26", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-2.5 rounded-xl mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Field label="Имя сотрудника" value={fullName} onChange={setFullName} placeholder="Иван Иванов" />
          <Field label="Должность (необязательно)" value={position} onChange={setPosition} placeholder="Менеджер" />
          {!isEdit && (
            <Field label="Логин для входа" value={login} onChange={setLogin} placeholder="ivanov" mono />
          )}
          <Field
            label={isEdit ? "Новый пароль (оставьте пустым, если не менять)" : "Пароль"}
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            type="password"
          />

          <button type="submit" disabled={saving}
            className="w-full text-white py-3 rounded-xl font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            style={{ background: ACCENT }}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {saving ? "Сохранение..." : isEdit ? "Сохранить" : "Создать сотрудника"}
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}

function Field({
  label, value, onChange, placeholder, type = "text", mono = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  mono?: boolean
}) {
  return (
    <div className="relative">
      <label className="absolute -top-2 left-3 px-1.5 text-[11px] font-medium z-10" style={{ background: "#171b26", color: "#9aa4b2" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-3 rounded-xl outline-none text-white text-[14px] transition-all placeholder-gray-600 focus:ring-2 focus:border-transparent ${mono ? "font-mono" : ""}`}
        style={{ background: "#0e1621", border: "1px solid rgba(255,255,255,0.1)", ...({ "--tw-ring-color": ACCENT } as any) }}
      />
    </div>
  )
}

type LiveEmployee = {
  employeeId: number
  userId: number
  fullName: string
  login: string
  position: string | null
  avatar: string | null
  online: boolean
  lastSeen: string | null
  idleMinutes: number | null
}

function formatIdle(min: number | null) {
  if (min === null) return "никогда не был на связи"
  if (min < 1) return "только что был онлайн"
  if (min < 60) return `${min} мин назад`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ч назад`
  const d = Math.floor(h / 24)
  return `${d} д назад`
}

function LiveWidget() {
  const [data, setData] = useState<{ total: number; onlineCount: number; employees: LiveEmployee[] } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/live-stats")
      if (!res.ok) return
      const json = await res.json()
      setData(json)
    } catch {}
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  const online = data?.employees.filter(e => e.online) ?? []
  const offline = data?.employees.filter(e => !e.online) ?? []

  return (
    <div
      className="sticky top-8 rounded-2xl overflow-hidden"
      style={{ background: "rgba(23,27,38,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <h2 className="text-sm font-semibold text-white">Сотрудники онлайн</h2>
          <p className="text-[11px] text-gray-500">Обновляется автоматически</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(74,222,128,0.12)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#4ade80" }} />
          <span className="text-xs font-semibold" style={{ color: "#4ade80" }}>
            {data ? data.onlineCount : "—"}
          </span>
        </div>
      </div>

      <div className="p-4">
        {!data ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="animate-spin text-gray-500" size={18} /></div>
        ) : online.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-3">Сейчас никто не в сети</p>
        ) : (
          <div className="space-y-2 mb-1">
            <AnimatePresence>
              {online.map(emp => (
                <motion.div
                  key={emp.userId}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="flex items-center gap-2.5"
                >
                  <div className="relative shrink-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: ACCENT }}>
                      {emp.fullName.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2" style={{ background: "#4ade80", borderColor: "#171b26" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{emp.fullName}</p>
                    <p className="text-[10.5px] text-gray-500 truncate">{emp.position || emp.login}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {offline.length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[10.5px] font-medium text-gray-500 mb-2 flex items-center gap-1.5">
              <Circle size={6} fill="currentColor" /> Не в сети
            </p>
            <div className="space-y-1.5">
              {offline.slice(0, 6).map(emp => (
                <div key={emp.userId} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-400 truncate">{emp.fullName}</span>
                  <span className="text-[10px] text-gray-600 shrink-0">{formatIdle(emp.idleMinutes)}</span>
                </div>
              ))}
              {offline.length > 6 && (
                <p className="text-[10.5px] text-gray-600">+{offline.length - 6} ещё</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
