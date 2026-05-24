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

// Тип update'а — формат как у Telegram getUpdates
type BotUpdate = {
  update_id: number
  message: {
    message_id: number
    from: { id: number; username: string; is_bot: boolean }
    chat: { id: number; type: string }
    date: number
    text: string
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

    const fetchUpdates = async (): Promise<BotUpdate[]> => {
      const messages = await prisma.message.findMany({
        where: {
          id: { gt: offset },
          senderId: { not: bot.userId! },
          conversation: {
            participants: { some: { userId: bot.userId! } },
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

    let updates = await fetchUpdates()

    // Long polling: если ничего нет и просили подождать — поллим раз в секунду
    if (updates.length === 0 && timeout > 0) {
      const deadline = Date.now() + timeout * 1000
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 1000))
        updates = await fetchUpdates()
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
