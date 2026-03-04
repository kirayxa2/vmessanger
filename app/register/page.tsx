"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Registration failed")
        setLoading(false)
        return
      }

      router.push("/login")
    } catch (err) {
      setError("Something went wrong")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e1621]">
      <div className="bg-[#0e1621] p-8 rounded-none w-full max-w-md">
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
          VortexMessenger
        </h1>
        <p className="text-center text-white mb-8">
          Create your account <br /> to get started.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Поле */}
          <div className="relative">
            <label className="absolute -top-2 left-4 bg-[#0e1621] px-1 text-xs font-medium text-white z-10">
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white placeholder-white "
              placeholder="your@email.com"
            />
          </div>

          {/* Username Поле */}
          <div className="relative">
            <label className="absolute -top-2 left-4 bg-[#0e1621] px-1 text-xs font-medium text-white z-10">
              Username
            </label>
            <input
              type="text"
              required
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white placeholder-white"
              placeholder="@username"
            />
          </div>

          {/* Password Поле */}
          <div className="relative">
            <label className="absolute -top-2 left-4 bg-[#0e1621] px-1 text-xs font-medium text-white z-10">
              Password
            </label>
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-4 rounded-xl font-semibold hover:bg-blue-600 transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? "Загрузка..." : "Register Now"}
          </button>
        </form>

        <p className="text-center text-white mt-8">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-blue-500 hover:underline font-semibold">
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}