import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"
import { ensureBotFatherUser } from "@/lib/botfather/system"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const query = searchParams.get("query")

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json([])
    }
    if (query.length > 50) {
      return NextResponse.json({ error: "Query too long" }, { status: 400 })
    }

    // Гарантируем что BotFather-юзер существует — чтобы он искался первым же запросом
    await ensureBotFatherUser()

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
        ],
        NOT: {
          id: parseInt(session.user.id)
        }
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        isBot: true,
      },
      take: 15,
      // Боты в начало списка чтобы их легко находить
      orderBy: [
        { isBot: "desc" },
        { username: "asc" },
      ],
    })

    // Маппим в публичный формат, поле is_bot для фронтенда
    const result = users.map(u => ({
      id: u.id,
      username: u.username,
      avatar: u.avatar,
      is_bot: u.isBot,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Users search error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
