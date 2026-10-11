"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

export default function BackButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back()
        else router.push("/register")
      }}
      className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
      style={{ color: "var(--accent, #7e85e1)" }}
    >
      <ArrowLeft size={16} /> Назад
    </button>
  )
}
