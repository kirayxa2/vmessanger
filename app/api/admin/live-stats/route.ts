import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth/getAdminSession"

// GET — живая статистика по сотрудникам: кто онлайн прямо сейчас,
// последняя активность. Данные об онлайне берём из живых socket.io-соединений
// (global.__io), которые поднимает server.js — это единственный источник правды
// о том, кто реально подключён в моменте (не полагаемся только на lastSeen в БД).
export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    // Собираем set онлайн userId, обходя все живые сокеты.
    const onlineUserIds = new Set<string>()
    const io: any = (global as any).__io
    if (io?.sockets?.sockets) {
      for (const socket of io.sockets.sockets.values()) {
        if (socket?.data?.userId) onlineUserIds.add(String(socket.data.userId))
      }
    }

    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        login: true,
        position: true,
        user: { select: { id: true, avatar: true, lastSeen: true } },
      },
      orderBy: { fullName: "asc" },
    })

    const now = Date.now()
    const list = employees.map((e) => {
      const uid = String(e.user.id)
      const online = onlineUserIds.has(uid)
      const lastSeenMs = e.user.lastSeen ? new Date(e.user.lastSeen).getTime() : null
      return {
        employeeId: e.id,
        userId: e.user.id,
        fullName: e.fullName,
        login: e.login,
        position: e.position,
        avatar: e.user.avatar,
        online,
        lastSeen: e.user.lastSeen,
        idleMinutes: !online && lastSeenMs ? Math.round((now - lastSeenMs) / 60000) : null,
      }
    })

    // Сортировка: сначала онлайн, потом по последней активности
    list.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1
      const at = a.lastSeen ? new Date(a.lastSeen).getTime() : 0
      const bt = b.lastSeen ? new Date(b.lastSeen).getTime() : 0
      return bt - at
    })

    return NextResponse.json({
      total: list.length,
      onlineCount: list.filter((e) => e.online).length,
      employees: list,
      serverTime: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Live stats error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
