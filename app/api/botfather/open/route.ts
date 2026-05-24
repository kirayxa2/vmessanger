import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"
import { ensureBotFatherUser } from "@/lib/botfather/system"

// Открыть или создать чат с BotFather
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = parseInt(session.user.id)

  const botFatherUserId = await ensureBotFatherUser()

  // Проверяем существующий чат с BotFather
  const existing = await prisma.conversation.findFirst({
    where: {
      type: "botfather",
      participants: { some: { userId } },
    },
    include: {
      participants: { include: { user: { select: { id: true, username: true, avatar: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  })

  if (existing) {
    // Гарантируем что BotFather тоже participant — для старых чатов до фикса
    await prisma.conversationParticipant.upsert({
      where: { userId_conversationId: { userId: botFatherUserId, conversationId: existing.id } },
      update: {},
      create: { userId: botFatherUserId, conversationId: existing.id, role: "member" },
    })
    return NextResponse.json(existing)
  }

  // Создаём чат и сразу обоих участников: юзер + BotFather
  const conv = await prisma.conversation.create({
    data: {
      type: "botfather",
      name: "BotFather",
      avatar: null,
      participants: {
        create: [
          { userId, role: "member" },
          { userId: botFatherUserId, role: "member" },
        ],
      },
    },
  })

  // Приветственное сообщение от BotFather (а не от пользователя!)
  await prisma.message.create({
    data: {
      conversationId: conv.id,
      senderId: botFatherUserId,
      content:
        "👋 Привет! Я BotFather — здесь ты можешь создавать и управлять своими ботами для Vortex.\n\n/newbot — создать нового бота\n/mybots — список твоих ботов\n/help — все команды",
      botId: 0,
    },
  })

  const result = await prisma.conversation.findUnique({
    where: { id: conv.id },
    include: {
      participants: { include: { user: { select: { id: true, username: true, avatar: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  })

  return NextResponse.json(result, { status: 201 })
}
