import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"

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
      },
      take: 10
    })

    // Добавляем BotFather если запрос совпадает
    const botfatherNames = ["botfather", "bot father", "бот"]
    const showBotFather = botfatherNames.some(n => n.includes(query.toLowerCase())) || "botfather".startsWith(query.toLowerCase())
    const result = showBotFather
      ? [{ id: -1, username: "BotFather", avatar: null, is_bot: true }, ...users]
      : users

    return NextResponse.json(result)
  } catch (error) {
    console.error("Users search error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
