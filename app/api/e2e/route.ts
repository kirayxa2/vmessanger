import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/authOptions"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/e2e?userId=123
 * Получить публичный ключ конкретного пользователя.
 * Публичный ключ не секретный — его могут видеть все участники чата.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { id: true, publicKey: true },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json({ userId: user.id, publicKey: user.publicKey ?? null })
}

/**
 * POST /api/e2e
 * Обновить / загрузить свой публичный ключ.
 * Вызывается при первом входе если ключ не был сохранён при регистрации,
 * или при смене устройства (перегенерация ключей).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { publicKey } = body

  if (!publicKey || typeof publicKey !== "string") {
    return NextResponse.json({ error: "publicKey required" }, { status: 400 })
  }

  // Базовая валидация — должен быть base64
  if (!/^[A-Za-z0-9+/]+=*$/.test(publicKey) || publicKey.length < 100) {
    return NextResponse.json({ error: "Invalid publicKey format" }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: Number(session.user.id) },
    data: { publicKey },
  })

  return NextResponse.json({ ok: true })
}
