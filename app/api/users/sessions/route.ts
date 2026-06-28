import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"

function parseUserAgent(ua: string) {
  // OS detection
  let os = "Unknown OS"
  if (/Windows NT 10/.test(ua)) os = "Windows 11/10"
  else if (/Windows NT 6/.test(ua)) os = "Windows 7/8"
  else if (/Mac OS X/.test(ua)) os = "macOS"
  else if (/Android/.test(ua)) os = "Android"
  else if (/iPhone|iPad/.test(ua)) os = "iOS"
  else if (/Linux/.test(ua)) os = "Linux"

  // Browser detection
  let browser = "Unknown Browser"
  if (/Edg\//.test(ua)) browser = "Edge"
  else if (/Chrome\//.test(ua)) browser = "Chrome"
  else if (/Firefox\//.test(ua)) browser = "Firefox"
  else if (/Safari\//.test(ua)) browser = "Safari"

  // Device type
  let deviceType = "desktop"
  if (/Mobile|Android|iPhone/.test(ua)) deviceType = "mobile"
  else if (/iPad|Tablet/.test(ua)) deviceType = "tablet"
  // Electron check
  if (/Electron/.test(ua)) { browser = "VortexMessenger App"; deviceType = "desktop" }

  const deviceName = `${browser} на ${os}`
  return { os, browser, deviceType, deviceName }
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
  const parsed = parseUserAgent(ua)

  const userSession = await prisma.userSession.upsert({
    where: { id: sessionId || "nonexistent-id-00000" },
    update: { lastActive: new Date() },
    create: {
      id: sessionId,
      userId: Number(session.user.id),
      deviceName: parsed.deviceName,
      deviceType: parsed.deviceType,
      os: parsed.os,
      browser: parsed.browser,
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
