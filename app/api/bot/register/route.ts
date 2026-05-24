import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"
import { generateBotToken, formatBot } from "@/lib/botUtils"

// GET /api/bot/register — список всех ботов пользователя
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = parseInt(session.user.id)

  const bots = await prisma.bot.findMany({
    where: { ownerId: userId },
    include: { commands: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(bots.map(b => ({ ...formatBot(b), token: b.token })))
}

// POST /api/bot/register — создать нового бота
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = parseInt(session.user.id)

  const { username, name, description } = await req.json()
  if (!username || !name) {
    return NextResponse.json({ error: "username and name are required" }, { status: 400 })
  }

  const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, "")
  if (!cleanUsername.endsWith("bot")) {
    return NextResponse.json({ error: "Bot username must end with 'bot'" }, { status: 400 })
  }

  const existing = await prisma.bot.findUnique({ where: { username: cleanUsername } })
  if (existing) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 })
  }

  // Создаём с временным токеном, потом обновляем с реальным id
  const bot = await prisma.bot.create({
    data: {
      token: `tmp_${Date.now()}`,
      username: cleanUsername,
      name,
      description: description ?? null,
      ownerId: userId,
    },
  })

  const realToken = generateBotToken(bot.id)
  const updated = await prisma.bot.update({
    where: { id: bot.id },
    data: { token: realToken },
    include: { commands: true },
  })

  return NextResponse.json({ ...formatBot(updated), token: updated.token }, { status: 201 })
}

// PATCH /api/bot/register — обновить бота (имя, описание, about, webhook)
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = parseInt(session.user.id)

  const { botId, name, description, about, avatarUrl, webhookUrl } = await req.json()
  if (!botId) return NextResponse.json({ error: "botId required" }, { status: 400 })

  const bot = await prisma.bot.findFirst({ where: { id: botId, ownerId: userId } })
  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await prisma.bot.update({
    where: { id: botId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(about !== undefined && { about }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(webhookUrl !== undefined && { webhookUrl }),
    },
    include: { commands: true },
  })

  return NextResponse.json({ ...formatBot(updated), token: updated.token })
}

// DELETE /api/bot/register — удалить бота
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = parseInt(session.user.id)

  const { botId } = await req.json()
  const bot = await prisma.bot.findFirst({ where: { id: botId, ownerId: userId } })
  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.bot.delete({ where: { id: botId } })
  return NextResponse.json({ ok: true })
}
