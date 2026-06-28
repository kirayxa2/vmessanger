import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/authOptions"
import { NextRequest, NextResponse } from "next/server"
import { SignJWT } from "jose"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  // jose — нативный ESM без зависимости от @types, уже есть в next-auth.
  // Подписываем тем же NEXTAUTH_SECRET, server.js верифицирует через jsonwebtoken.
  const token = await new SignJWT({ id: session.user.id, name: session.user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1d")
    .sign(new TextEncoder().encode(secret))

  return NextResponse.json({ token })
}
