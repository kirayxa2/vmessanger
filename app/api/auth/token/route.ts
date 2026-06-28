import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/authOptions"
import { NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  // Создаём обычный подписанный JWT (JWS).
  // NextAuth хранит токен как JWE (зашифрованный) — jsonwebtoken его не понимает.
  // Поэтому берём данные из сессии и подписываем сами тем же секретом.
  const token = jwt.sign(
    { id: session.user.id, name: session.user.name },
    secret,
    { expiresIn: "1d" }
  )

  return NextResponse.json({ token })
}
