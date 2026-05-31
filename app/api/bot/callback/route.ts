import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"
import { dispatchWebhook, buildUpdate } from "@/lib/botUtils"
import { processBotFatherCallback } from "@/lib/botfather"
import { ensureBotFatherUser } from "@/lib/botfather/system"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = parseInt(session.user.id)

  const { messageId, botId, callbackData, conversationId } = await req.json()
  if (messageId == null || botId == null || callbackData == null) {
    return NextResponse.json({ error: "messageId, botId, callbackData required" }, { status: 400 })
  }

  const g = global as unknown as {
    __emitToUser?: (userId: number, event: string, data: unknown) => void
    __io?: { to: (r: string) => { emit: (e: string, d: unknown) => void } }
  }

  // ── BotFather — обрабатываем локально ──
  if (Number(botId) === 0) {
    const result = await processBotFatherCallback(userId, callbackData)
    if (result && conversationId) {
      const botFatherUserId = await ensureBotFatherUser()
      // Гарантируем что BotFather — participant
      await prisma.conversationParticipant.upsert({
        where: { userId_conversationId: { userId: botFatherUserId, conversationId: Number(conversationId) } },
        update: {},
        create: { userId: botFatherUserId, conversationId: Number(conversationId), role: "member" },
      })
      const msg = await prisma.message.create({
        data: {
          conversationId: Number(conversationId),
          senderId: botFatherUserId,
          content: result.text,
          botId: 0,
          replyMarkup: result.replyMarkup ? (result.replyMarkup as object) : undefined,
        },
        include: { sender: { select: { id: true, username: true, avatar: true } } },
      })
      const roomId = String(conversationId)
      g.__io?.to(roomId).emit("new-message", { ...msg, conversationId: Number(conversationId) })
      g.__emitToUser?.(userId, "new-message", { ...msg, conversationId: Number(conversationId) })
      g.__emitToUser?.(userId, "conversation-updated", { conversationId: roomId, lastMessage: msg })
    }
    g.__emitToUser?.(userId, "callback-answer", { text: "", show_alert: false })
    return NextResponse.json({ ok: true })
  }

  // ── Обычный бот ──
  const bot = await prisma.bot.findUnique({ where: { id: Number(botId) } })
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 })

  // Сохраняем callback query — его заберёт бот через getUpdates (answeredAt IS NULL)
  // или через webhook ниже.
  const cq = await prisma.botCallbackQuery.create({
    data: { botId: Number(botId), userId, messageId: Number(messageId), callbackData },
  })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, avatar: true },
  })

  const update = buildUpdate(
    "callback_query",
    {
      id: cq.id,
      from: user,
      message: { message_id: Number(messageId), chat: { id: Number(conversationId) } },
      data: callbackData,
    },
    cq.id
  )

  // Если у бота настроен webhook — диспатчим сразу
  if (bot.webhookUrl) {
    await dispatchWebhook(bot.webhookUrl, update, bot.webhookSecret)
  }

  return NextResponse.json({ ok: true, callback_query_id: cq.id })
}
