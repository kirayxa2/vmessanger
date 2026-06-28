import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"

function getDeviceType(ua: string): string {
  if (/Mobile|Android|iPhone/.test(ua)) return "mobile"
  if (/iPad|Tablet/.test(ua)) return "tablet"
  return "desktop"
}

// GET — список всех сессий текущего пользователя
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sessions = await prisma.userSession.findMany({
    where: { userId: Number(session.user.id) },
    orderBy: { lastActive: "desc" },
  })

  // Текущую сессию определяем по ID из query
  const currentSessionId = req.nextUrl.searchParams.get("currentSessionId")

  return NextResponse.json({ sessions, currentSessionId })
}

// POST — создать/обновить сессию (вызывается при входе)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { sessionId, userAgent } = body

  const ua = userAgent || req.headers.get("user-agent") || ""
  const deviceType = getDeviceType(ua)

  const userSession = await prisma.userSession.upsert({
    where: { id: sessionId || "nonexistent-id-00000" },
    update: { lastActive: new Date() },
    create: {
      id: sessionId,
      userId: Number(session.user.id),
      deviceType,
      lastActive: new Date(),
    },
  })

  return NextResponse.json(userSession)
}

// DELETE — завершить сессию(и)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { sessionId, terminateAll } = body

  if (terminateAll) {
    // Удаляем все кроме текущей
    const currentSessionId = body.currentSessionId
    await prisma.userSession.deleteMany({
      where: {
        userId: Number(session.user.id),
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
    })
    return NextResponse.json({ terminated: "all" })
  }

  if (sessionId) {
    // Проверяем что сессия принадлежит этому пользователю
    await prisma.userSession.deleteMany({
      where: { id: sessionId, userId: Number(session.user.id) },
    })
    return NextResponse.json({ terminated: sessionId })
  }

  return NextResponse.json({ error: "No sessionId provided" }, { status: 400 })
}
