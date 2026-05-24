import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseBotToken, formatBot, buildUpdate, dispatchWebhook } from "@/lib/botUtils"

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

  let body: Record<string, unknown> = {}
  if (req.method === "POST") {
    try { body = await req.json() } catch {}
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

  // ── sendMessage ──
  if (method === "sendMessage") {
    const { chat_id, text, reply_markup, reply_to_message_id, parse_mode } = body as {
      chat_id: number
      text: string
      reply_markup?: unknown
      reply_to_message_id?: number
      parse_mode?: string
    }
    if (!chat_id || !text) return err("chat_id and text are required")

    // chat_id — это conversationId
    const conversation = await prisma.conversation.findUnique({ where: { id: chat_id } })
    if (!conversation) return err("chat not found", 404)

    // Бот должен быть participant'ом (виртуально через botId на сообщении)
    // Находим первого участника чтобы взять senderId (системный пользователь бота)
    // Мы храним сообщения бота через senderId = ownerId, помечая botId
    const msg = await prisma.message.create({
      data: {
        conversationId: chat_id,
        senderId: bot.ownerId,
        content: text,
        botId: bot.id,
        replyToId: reply_to_message_id ?? null,
        replyMarkup: reply_markup ? (reply_markup as object) : undefined,
      },
      include: {
        sender: { select: { id: true, username: true, avatar: true } },
        replyTo: true,
      },
    })

    // Обновляем updatedAt conversation
    await prisma.conversation.update({
      where: { id: chat_id },
      data: { updatedAt: new Date() },
    })

    // Эмитим через глобальный io
    const g = global as unknown as { __io?: { to: (r: string) => { emit: (e: string, d: unknown) => void } } }
    g.__io?.to(`conversation:${chat_id}`).emit("new-message", {
      ...msg,
      bot: formatBot(bot),
    })

    return ok({
      message_id: msg.id,
      chat: { id: chat_id },
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
      where: { id: message_id, botId: bot.id },
      data: {
        content: text,
        replyMarkup: reply_markup ? (reply_markup as object) : undefined,
      },
    })
    const g = global as unknown as { __io?: { to: (r: string) => { emit: (e: string, d: unknown) => void } } }
    g.__io?.to(`conversation:${msg.conversationId}`).emit("message-edited", msg)
    return ok(true)
  }

  // ── deleteMessage ──
  if (method === "deleteMessage") {
    const { message_id } = body as { message_id: number }
    if (!message_id) return err("message_id is required")
    const msg = await prisma.message.findFirst({ where: { id: message_id, botId: bot.id } })
    if (!msg) return err("message not found", 404)
    await prisma.message.delete({ where: { id: message_id } })
    const g = global as unknown as { __io?: { to: (r: string) => { emit: (e: string, d: unknown) => void } } }
    g.__io?.to(`conversation:${msg.conversationId}`).emit("message-deleted", { id: message_id, conversationId: msg.conversationId })
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
      where: { id: callback_query_id },
      data: { answeredAt: new Date() },
    })
    // Уведомить пользователя через сокет
    // callback_query содержит userId, нужно его найти
    const cq = await prisma.botCallbackQuery.findUnique({ where: { id: callback_query_id } })
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
    const { url, secret_token } = body as { url: string; secret_token?: string }
    await prisma.bot.update({
      where: { id: bot.id },
      data: { webhookUrl: url || null, webhookSecret: secret_token || null },
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
