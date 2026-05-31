import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseBotToken, formatBot } from "@/lib/botUtils"

const ok = (result: unknown) => NextResponse.json({ ok: true, result })
const err = (desc: string, code = 400) =>
  NextResponse.json({ ok: false, description: desc }, { status: code })

async function resolveBot(token: string) {
  const parsed = parseBotToken(token)
  if (!parsed) return null
  const bot = await prisma.bot.findUnique({
    where: { token },
    include: { commands: true },
  })
  if (!bot || !bot.isActive) return null
  return bot
}

// Callback-апдейтам даём update_id в отдельном диапазоне, чтобы не путать с message id.
// Клиент должен трекать offset ТОЛЬКО по message-апдейтам (см. пример в доке).
const CALLBACK_ID_BASE = 1_000_000_000

// Тип update'а — формат как у Telegram getUpdates
type BotUpdate = {
  update_id: number
  message?: {
    message_id: number
    from: { id: number; username: string; is_bot: boolean }
    chat: { id: number; type: string }
    date: number
    text: string
  }
  callback_query?: {
    id: number
    from: { id: number; username: string }
    message: { message_id: number; chat: { id: number } }
    data: string
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; method: string }> }
) {
  const { token, method } = await params
  return handleMethod(req, token, method)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; method: string }> }
) {
  const { token, method } = await params
  return handleMethod(req, token, method)
}

async function handleMethod(req: NextRequest, token: string, method: string) {
  const bot = await resolveBot(token)
  if (!bot) return err("Unauthorized: invalid token", 401)

  // Параметры можно передавать и в query string (GET) и в body (POST)
  const url = new URL(req.url)
  const queryParams: Record<string, string> = {}
  url.searchParams.forEach((v, k) => { queryParams[k] = v })

  let body: Record<string, unknown> = { ...queryParams }
  if (req.method === "POST") {
    try {
      const json = await req.json()
      body = { ...body, ...json }
    } catch {}
  }

  // ── getMe ──
  if (method === "getMe") {
    return ok(formatBot(bot))
  }

  // ── getMyCommands ──
  if (method === "getMyCommands") {
    return ok(bot.commands.map(c => ({ command: c.command, description: c.description })))
  }

  // ── setMyCommands ──
  if (method === "setMyCommands") {
    const commands = body.commands as { command: string; description: string }[] | undefined
    if (!Array.isArray(commands)) return err("commands must be array")
    await prisma.botCommand.deleteMany({ where: { botId: bot.id } })
    await prisma.botCommand.createMany({
      data: commands.map(c => ({
        botId: bot.id,
        command: c.command.replace(/^\//, "").toLowerCase(),
        description: c.description,
      })),
    })
    return ok(true)
  }

  // ── getUpdates (long polling) ──
  // Возвращает все непросмотренные сообщения от пользователей в чатах с этим ботом.
  // offset: возвращаются update_id > offset. limit: max 100.
  // timeout: сколько секунд ждать новых сообщений (long polling, max 30).
  if (method === "getUpdates") {
    if (!bot.userId) {
      return err("Bot has no user account; recreate the bot via BotFather", 400)
    }
    const offset = Number(body.offset ?? 0) || 0
    const limit = Math.min(Number(body.limit ?? 100) || 100, 100)
    const timeout = Math.min(Math.max(Number(body.timeout ?? 0) || 0, 0), 30)
    const botUserId = bot.userId!

    // Новые сообщения от пользователей (не от самого бота)
    const fetchMessages = async (): Promise<BotUpdate[]> => {
      const messages = await prisma.message.findMany({
        where: {
          id: { gt: offset },
          senderId: { not: botUserId },
          conversation: {
            participants: { some: { userId: botUserId } },
          },
        },
        include: {
          sender: { select: { id: true, username: true, isBot: true } },
          conversation: { select: { id: true, type: true } },
        },
        orderBy: { id: "asc" },
        take: limit,
      })
      return messages.map(m => ({
        update_id: m.id,
        message: {
          message_id: m.id,
          from: { id: m.sender.id, username: m.sender.username, is_bot: m.sender.isBot },
          chat: { id: m.conversation.id, type: m.conversation.type },
          date: Math.floor(m.createdAt.getTime() / 1000),
          text: m.content,
        },
      }))
    }

    // Клики по инлайн-кнопкам. Захватываем АТОМАРНО одним UPDATE ... RETURNING:
    // строка переводится answeredAt=NULL → NOW() под блокировкой Postgres, поэтому
    // даже при нескольких параллельных getUpdates каждый callback достаётся ровно
    // одному поллеру. Это убирает дубли ("два ответа на один клик").
    const fetchCallbacks = async (): Promise<BotUpdate[]> => {
      const claimed = await prisma.$queryRaw<
        Array<{ id: number; userId: number; messageId: number; callbackData: string }>
      >`
        UPDATE "BotCallbackQuery"
        SET "answeredAt" = NOW()
        WHERE "botId" = ${bot.id} AND "answeredAt" IS NULL
        RETURNING id, "userId", "messageId", "callbackData"
      `
      if (claimed.length === 0) return []

      const userIds = [...new Set(claimed.map(c => c.userId))]
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true },
      })
      const userMap = new Map(users.map(u => [u.id, u]))

      const msgIds = [...new Set(claimed.map(c => c.messageId))]
      const msgs = await prisma.message.findMany({
        where: { id: { in: msgIds } },
        select: { id: true, conversationId: true },
      })
      const msgMap = new Map(msgs.map(m => [m.id, m]))

      return claimed.map(c => ({
        update_id: CALLBACK_ID_BASE + c.id,
        callback_query: {
          id: c.id,
          from: { id: c.userId, username: userMap.get(c.userId)?.username ?? "" },
          message: { message_id: c.messageId, chat: { id: msgMap.get(c.messageId)?.conversationId ?? 0 } },
          data: c.callbackData,
        },
      }))
    }

    let updates = [...(await fetchMessages()), ...(await fetchCallbacks())]

    // Long polling: ждём появления сообщений ИЛИ кликов, проверяя оба раз в секунду.
    // Раньше в цикле проверялись только сообщения, а callback'и забирались ОДИН раз
    // после выхода из цикла → клик "висел" до конца timeout (~25с). Теперь ≤ 1с.
    if (updates.length === 0 && timeout > 0) {
      const deadline = Date.now() + timeout * 1000
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 1000))
        updates = [...(await fetchMessages()), ...(await fetchCallbacks())]
        if (updates.length > 0) break
      }
    }

    return ok(updates)
  }

  // ── sendMessage ──
  if (method === "sendMessage") {
    const { chat_id, text, reply_markup, reply_to_message_id } = body as {
      chat_id: number | string
      text: string
      reply_markup?: unknown
      reply_to_message_id?: number
    }
    const chatId = Number(chat_id)
    if (!chatId || !text) return err("chat_id and text are required")

    const conversation = await prisma.conversation.findUnique({ where: { id: chatId } })
    if (!conversation) return err("chat not found", 404)

    // senderId — это User-аккаунт бота (если есть). Иначе fallback на владельца.
    const senderId = bot.userId ?? bot.ownerId

    // Гарантируем что бот — participant в этом чате (для консистентности FK)
    if (bot.userId) {
      await prisma.conversationParticipant.upsert({
        where: { userId_conversationId: { userId: bot.userId, conversationId: chatId } },
        update: {},
        create: { userId: bot.userId, conversationId: chatId, role: "member" },
      })
    }

    const msg = await prisma.message.create({
      data: {
        conversationId: chatId,
        senderId,
        content: text,
        botId: bot.id,
        replyToId: reply_to_message_id ?? null,
        replyMarkup: reply_markup ? (reply_markup as object) : undefined,
      },
      include: {
        sender: { select: { id: true, username: true, avatar: true } },
        replyTo: { include: { sender: { select: { id: true, username: true, avatar: true } } } },
      },
    })

    // Обновляем updatedAt чата
    await prisma.conversation.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    })

    // Эмитим в реалтайме всем participants чата
    const g = global as unknown as {
      __io?: { to: (r: string) => { emit: (e: string, d: unknown) => void } }
      __emitToUser?: (userId: number | string, event: string, data: unknown) => void
    }
    const roomId = String(chatId)
    g.__io?.to(roomId).emit("new-message", { ...msg, conversationId: chatId })
    // На случай если кто-то ещё не joined в комнату — direct-emit участникам
    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId: chatId },
      select: { userId: true },
    })
    for (const p of participants) {
      g.__emitToUser?.(p.userId, "new-message", { ...msg, conversationId: chatId })
      g.__emitToUser?.(p.userId, "conversation-updated", {
        conversationId: roomId,
        lastMessage: msg,
      })
    }

    return ok({
      message_id: msg.id,
      chat: { id: chatId },
      date: Math.floor(msg.createdAt.getTime() / 1000),
      text: msg.content,
    })
  }

  // ── sendPhoto / sendDocument ──
  if (method === "sendPhoto" || method === "sendDocument") {
    const isPhoto = method === "sendPhoto"
    const chatId = Number(body.chat_id)
    const fileUrl = String((isPhoto ? body.photo : body.document) ?? "")
    const caption = typeof body.caption === "string" ? body.caption : ""
    const fileName = typeof body.file_name === "string" ? body.file_name : (isPhoto ? "photo.jpg" : "file")
    if (!chatId || !fileUrl) {
      return err(`chat_id and ${isPhoto ? "photo" : "document"} (url) are required`)
    }

    const conversation = await prisma.conversation.findUnique({ where: { id: chatId } })
    if (!conversation) return err("chat not found", 404)

    const senderId = bot.userId ?? bot.ownerId
    if (bot.userId) {
      await prisma.conversationParticipant.upsert({
        where: { userId_conversationId: { userId: bot.userId, conversationId: chatId } },
        update: {},
        create: { userId: bot.userId, conversationId: chatId, role: "member" },
      })
    }

    const msg = await prisma.message.create({
      data: {
        conversationId: chatId,
        senderId,
        content: caption,
        botId: bot.id,
        fileUrl,
        fileName,
        fileType: isPhoto ? "image/jpeg" : "application/octet-stream",
        fileSize: 0,
        replyMarkup: body.reply_markup ? (body.reply_markup as object) : undefined,
      },
      include: { sender: { select: { id: true, username: true, avatar: true } } },
    })

    await prisma.conversation.update({ where: { id: chatId }, data: { updatedAt: new Date() } })

    const g = global as unknown as {
      __io?: { to: (r: string) => { emit: (e: string, d: unknown) => void } }
      __emitToUser?: (userId: number | string, event: string, data: unknown) => void
    }
    const roomId = String(chatId)
    g.__io?.to(roomId).emit("new-message", { ...msg, conversationId: chatId })
    const parts = await prisma.conversationParticipant.findMany({
      where: { conversationId: chatId },
      select: { userId: true },
    })
    for (const p of parts) {
      g.__emitToUser?.(p.userId, "new-message", { ...msg, conversationId: chatId })
      g.__emitToUser?.(p.userId, "conversation-updated", { conversationId: roomId, lastMessage: msg })
    }

    return ok({ message_id: msg.id, chat: { id: chatId }, date: Math.floor(msg.createdAt.getTime() / 1000) })
  }

  // ── editMessageText ──
  if (method === "editMessageText") {
    const { message_id, text, reply_markup } = body as {
      message_id: number
      text: string
      reply_markup?: unknown
    }
    if (!message_id || !text) return err("message_id and text are required")
    const msg = await prisma.message.update({
      where: { id: Number(message_id), botId: bot.id },
      data: {
        content: text,
        replyMarkup: reply_markup ? (reply_markup as object) : undefined,
      },
    })
    const g = global as unknown as { __io?: { to: (r: string) => { emit: (e: string, d: unknown) => void } } }
    g.__io?.to(String(msg.conversationId)).emit("message-edited", msg)
    return ok(true)
  }

  // ── deleteMessage ──
  if (method === "deleteMessage") {
    const { message_id } = body as { message_id: number }
    if (!message_id) return err("message_id is required")
    const msg = await prisma.message.findFirst({ where: { id: Number(message_id), botId: bot.id } })
    if (!msg) return err("message not found", 404)
    await prisma.message.delete({ where: { id: Number(message_id) } })
    const g = global as unknown as { __io?: { to: (r: string) => { emit: (e: string, d: unknown) => void } } }
    g.__io?.to(String(msg.conversationId)).emit("message-deleted", String(message_id))
    return ok(true)
  }

  // ── answerCallbackQuery ──
  if (method === "answerCallbackQuery") {
    const { callback_query_id, text, show_alert } = body as {
      callback_query_id: number
      text?: string
      show_alert?: boolean
    }
    await prisma.botCallbackQuery.update({
      where: { id: Number(callback_query_id) },
      data: { answeredAt: new Date() },
    })
    const cq = await prisma.botCallbackQuery.findUnique({ where: { id: Number(callback_query_id) } })
    if (cq) {
      const g = global as unknown as {
        __emitToUser?: (userId: number, event: string, data: unknown) => void
      }
      g.__emitToUser?.(cq.userId, "callback-answer", { text, show_alert })
    }
    return ok(true)
  }

  // ── setWebhook ──
  if (method === "setWebhook") {
    const { url: hookUrl, secret_token } = body as { url: string; secret_token?: string }
    await prisma.bot.update({
      where: { id: bot.id },
      data: { webhookUrl: hookUrl || null, webhookSecret: secret_token || null },
    })
    return ok(true)
  }

  // ── deleteWebhook ──
  if (method === "deleteWebhook") {
    await prisma.bot.update({ where: { id: bot.id }, data: { webhookUrl: null, webhookSecret: null } })
    return ok(true)
  }

  // ── getWebhookInfo ──
  if (method === "getWebhookInfo") {
    return ok({ url: bot.webhookUrl ?? "", has_custom_certificate: false })
  }

  return err(`Unknown method: ${method}`, 404)
}
