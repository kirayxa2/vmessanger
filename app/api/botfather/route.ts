import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { processBotFatherMessage } from "@/lib/botfather"
import { ensureBotFatherUser } from "@/lib/botfather/system"

// Внутренний endpoint — вызывается только из server.js.
// Сразу сохраняет ответы BotFather в БД с senderId системного аккаунта BotFather
// и возвращает готовые message-объекты — server.js просто эмитит их в сокет.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret")
  if (secret !== (process.env.INTERNAL_SECRET || "botfather-secret")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId, text, conversationId } = await req.json()
  if (!userId || !text || !conversationId) {
    return NextResponse.json({ error: "userId, text, conversationId required" }, { status: 400 })
  }

  const replies = await processBotFatherMessage(userId, text, conversationId)
  if (!Array.isArray(replies) || replies.length === 0) return NextResponse.json([])

  const botFatherUserId = await ensureBotFatherUser()

  // Убедимся что BotFather-юзер — участник этого чата (для FK senderId)
  await prisma.conversationParticipant.upsert({
    where: { userId_conversationId: { userId: botFatherUserId, conversationId } },
    update: {},
    create: { userId: botFatherUserId, conversationId, role: "member" },
  })

  // Сохраняем каждый reply отдельным сообщением от BotFather
  const saved = []
  for (const rep of replies) {
    const msg = await prisma.message.create({
      data: {
        conversationId,
        senderId: botFatherUserId,
        content: rep.text,
        botId: 0,
        replyMarkup: rep.replyMarkup ? (rep.replyMarkup as object) : undefined,
      },
      include: {
        sender: { select: { id: true, username: true, avatar: true } },
      },
    })
    saved.push(msg)
  }

  return NextResponse.json(saved)
}
