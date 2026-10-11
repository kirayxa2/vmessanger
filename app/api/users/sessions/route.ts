import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"

function getDeviceType(ua: string): string {
  if (/iPad|Tablet/.test(ua)) return "tablet"
  if (/Mobile|Android|iPhone/.test(ua)) return "mobile"
  return "desktop"
}

// Реальное название устройства: модель (если браузер её отдаёт) или тип ОС + браузер/приложение.
// Важно: iPhone/iPad не сообщают точную модель браузеру/WebView, поэтому у них будет просто "iPhone" / "iPad".
function getDeviceName(ua: string, model?: unknown): string {
  let osName = "Устройство"
  if (/iPhone/.test(ua)) osName = "iPhone"
  else if (/iPad/.test(ua)) osName = "iPad"
  else if (/Android/.test(ua)) osName = /Mobile/.test(ua) ? "Телефон Android" : "Планшет Android"
  else if (/Windows/.test(ua)) osName = "Windows"
  else if (/CrOS/.test(ua)) osName = "Chromebook"
  else if (/Macintosh|Mac OS X/.test(ua)) osName = "Mac"
  else if (/Linux/.test(ua)) osName = "Linux"

  // Модель: сначала из клиента (userAgentData), иначе из User-Agent (в новых Chrome там часто просто "K")
  let rawModel = typeof model === "string" ? model.trim() : ""
  if (!rawModel) {
    const m = ua.match(/Android [\d.]+; ([^;)]+)/)
    if (m) rawModel = m[1].trim()
  }
  if (rawModel && (rawModel === "K" || !/^[\w \-.+()]{2,40}$/.test(rawModel))) rawModel = ""

  let base = osName
  if (rawModel && /Android/.test(ua)) {
    if (/^SM-/.test(rawModel)) base = `Samsung ${rawModel}`
    else if (/^Pixel/i.test(rawModel)) base = `Google ${rawModel}`
    else base = rawModel
  }

  let app = ""
  if (/Electron\//.test(ua) || /; wv\)/.test(ua)) app = "Приложение Vortex"
  else if (/Edg\//.test(ua)) app = "Edge"
  else if (/OPR\/|Opera/.test(ua)) app = "Opera"
  else if (/YaBrowser/.test(ua)) app = "Яндекс Браузер"
  else if (/SamsungBrowser/.test(ua)) app = "Samsung Internet"
  else if (/Firefox|FxiOS/.test(ua)) app = "Firefox"
  else if (/Chrome|CriOS/.test(ua)) app = "Chrome"
  else if (/Safari/.test(ua)) app = "Safari"
  else if (/(iPhone|iPad)/.test(ua)) app = "Приложение Vortex" // WKWebView без Safari-токена

  return (app ? `${base} · ${app}` : base).slice(0, 80)
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
  const { sessionId, userAgent, deviceModel } = body

  const ua = userAgent || req.headers.get("user-agent") || ""
  const deviceType = getDeviceType(ua)
  const deviceName = getDeviceName(ua, deviceModel)

  const userSession = await prisma.userSession.upsert({
    where: { id: sessionId || "nonexistent-id-00000" },
    update: { lastActive: new Date(), deviceName },
    create: {
      id: sessionId,
      userId: Number(session.user.id),
      deviceType,
      deviceName,
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
