import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/authOptions"
import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

// Возвращает подписанный NextAuth JWT для использования в Socket.IO auth.
// Клиент передаёт этот токен в socket.handshake.auth.token,
// сервер проверяет подпись через jwt.verify(token, NEXTAUTH_SECRET).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // getToken с raw: true возвращает подписанную JWT строку
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET!,
    raw: true,
  })

  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 401 })
  }

  return NextResponse.json({ token })
}
