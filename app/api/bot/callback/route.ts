import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"
import { dispatchWebhook, buildUpdate } from "@/lib/botUtils"
import { processBotFatherCallback } from "@/lib/botfather"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = parseInt(session.user.id)

  const { messageId, botId, callbackData, conversationId } = await req.json()
  if (!messageId || !botId || !callbackData) {
    return NextResponse.json({ error: "messageId, botId, callbackData required" }, { status: 400 })
  }

  // Сохраняем callback query
  const cq = await prisma.botCallbackQuery.create({
    data: { botId, userId, messageId, callbackData },
  })

  const g = global as unknown as {
    __emitToUser?: (userId: number, event: string, data: unknown) => void
    __io?: { to: (r: string) => { emit: (e: string, d: unknown) => void } }
  }

  // BotFather — обрабатываем локально
  if (botId === 0) {
    const result = await processBotFatherCallback(userId, callbackData)
    if (result) {
      // Отправляем ответное сообщение в чат
      const msg = await prisma.message.create({
        data: {
          conversationId,
          senderId: (await prisma.bot.findFirst({ where: { id: 0 } }))?.ownerId ?? 1,
          content: result.text,
          botId: 0,
          replyMarkup: result.replyMarkup ? (result.replyMarkup as object) : undefined,
        },
      })
      g.__io?.to(`conversation:${conversationId}`).emit("new-message", msg)
    }
    g.__emitToUser?.(userId, "callback-answer", { text: "", show_alert: false })
    return NextResponse.json({ ok: true })
  }

  // Обычный бот — диспатчим webhook
  const bot = await prisma.bot.findUnique({ where: { id: botId } })
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, avatar: true },
  })

  const update = buildUpdate(
    "callback_query",
    {
      id: cq.id,
      from: user,
      message: { message_id: messageId, chat: { id: conversationId } },
      data: callbackData,
    },
    cq.id
  )

  if (bot.webhookUrl) {
    await dispatchWebhook(bot.webhookUrl, update, bot.webhookSecret)
  }

  // Эмитим на сокет для polling ботов
  g.__io?.to(`bot:${botId}`).emit("callback_query", update)

  return NextResponse.json({ ok: true, callback_query_id: cq.id })
}
