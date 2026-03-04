"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email: formData.email,
        password: formData.password,
      })

      if (result?.error) {
        setError("Неверный email или пароль")
        setLoading(false)
        return
      }

      router.push("/")
    } catch (err) {
      setError("Что-то пошло не так")
      setLoading(false)
    }
  }

  return (
  /* Контейнер на весь экран, центрирует содержимое, фон — строго белый */
  <div className="min-h-screen w-full flex items-center justify-center bg-[#0e1621]">
    
    {/* Карточка формы */}
    <div className="bg-[#0e1621] p-8 rounded-none  w-full max-w-md ">
      {/* App icon */}
      <div className="flex justify-center mb-0">
        <img
          src="/logo (1).ico"
          alt="VortexMessenger"
          width={200}
          height={200}
          style={{ imageRendering: 'crisp-edges' }}
        />
      </div>
      <h1 className="text-3xl font-bold text-center mb-2 text-white">
        Sign in to Vortex
      </h1>
      <p className="text-center text-white mb-6">
        Please enter your email and <br /> password.
      </p>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
  {/* Поле Email */}
  <div className="relative">
    {/* Заголовок на рамке */}
    <label className="absolute -top-2 left-4 bg-[#0e1621] px-1 text-xs font-medium text-white z-10 transition-all">
      Email
    </label>
    <div className="relative">
      <input
        type="email"
        required
        value={formData.email}
        onChange={(e) =>
          setFormData({ ...formData, email: e.target.value })
        }
        className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white placeholder-white"
        placeholder="your@email.com"
      />
    </div>
  </div>

  {/* Поле Пароль */}
  <div className="relative">
    {/* Заголовок на рамке */}
    <label className="absolute -top-2 left-4 bg-[#0e1621] px-1 text-xs font-medium text-white z-10 transition-all">
      Password
    </label>
    <div className="relative">
      <input
        type="password"
        required
        value={formData.password}
        onChange={(e) =>
          setFormData({ ...formData, password: e.target.value })
        }
        className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white placeholder-white"
        placeholder="••••••••"
      />
    </div>
  </div>

  {/* Кнопка входа */}
  <button
    type="submit"
    disabled={loading}
    className="w-full bg-blue-500 text-white py-4 rounded-xl font-semibold hover:bg-blue-600 transition-all disabled:opacity-50 active:scale-[0.98] "
  >
    {loading ? "Загрузка..." : "Sign In"}
  </button>
</form>

      <p className="text-center text-white mt-6">
        Нет аккаунта?{" "}
        <Link href="/register" className="text-blue-500 hover:underline font-semibold">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  </div>
)
}