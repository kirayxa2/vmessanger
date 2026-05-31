import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"

// Команды бота-участника текущего чата — для автокомплита по "/" в композере.
// Возвращает [] если в чате нет бота.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const conversationId = new URL(req.url).searchParams.get("conversationId")
    if (!conversationId) return NextResponse.json({ error: "conversationId is required" }, { status: 400 })

    // Запрашивающий должен быть участником
    const me = await prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId: Number(session.user.id), conversationId: Number(conversationId) } },
      select: { id: true },
    })
    if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Ищем бота среди участников (User.isBot)
    const botParticipant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId: Number(conversationId),
        userId: { not: Number(session.user.id) },
        user: { isBot: true },
      },
      select: { userId: true },
    })
    if (!botParticipant) return NextResponse.json({ commands: [], botUsername: null })

    const bot = await prisma.bot.findUnique({
      where: { userId: botParticipant.userId },
      select: {
        username: true,
        commands: { select: { command: true, description: true }, orderBy: { command: "asc" } },
      },
    })
    if (!bot) return NextResponse.json({ commands: [], botUsername: null })

    return NextResponse.json({ commands: bot.commands, botUsername: bot.username })
  } catch {
    return NextResponse.json({ commands: [], botUsername: null })
  }
}
