import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"

const conversationInclude = {
  drafts: true, // filtered per-user below
  participants: {
    include: {
      user: { select: { id: true, username: true, avatar: true } },
    },
  },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: {
      sender: { select: { id: true, username: true, avatar: true } },
    },
  },
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const currentUserId = parseInt(session.user.id)
    const body = await req.json()
    const { userId, type } = body

    // ── Saved Messages (Избранное) ──
    if (type === "saved") {
      const existing = await prisma.conversation.findFirst({
        where: {
          type: "saved",
          participants: { some: { userId: currentUserId } },
        },
        include: conversationInclude,
      })
      if (existing) return NextResponse.json(existing)

      const created = await prisma.conversation.create({
        data: {
          type: "saved",
          name: "Saved Messages",
          participants: { create: { userId: currentUserId } },
        },
        include: conversationInclude,
      })
      return NextResponse.json(created, { status: 201 })
    }

    // ── System chat (Vortex) ──
    if (type === "system") {
      const existing = await prisma.conversation.findFirst({
        where: {
          type: "system",
          participants: { some: { userId: currentUserId } },
        },
        include: conversationInclude,
      })
      if (existing) return NextResponse.json(existing)

      const created = await prisma.conversation.create({
        data: {
          type: "system",
          name: "Vortex",
          participants: { create: { userId: currentUserId } },
        },
        include: conversationInclude,
      })
      // Отправляем приветственное сообщение
      await prisma.message.create({
        data: {
          content: "👋 Добро пожаловать в Vortex!\n\nЗдесь вы будете получать уведомления о безопасности вашего аккаунта:\n• Входы с новых устройств\n• Изменения пароля или email\n• Подозрительная активность\n\nЕсли вы не совершали это действие — немедленно смените пароль в настройках.",
          conversationId: created.id,
          senderId: currentUserId, // system messages sent "from" the user
        },
      })
      const withMsg = await prisma.conversation.findUnique({
        where: { id: created.id },
        include: conversationInclude,
      })
      return NextResponse.json(withMsg, { status: 201 })
    }

    // ── Private chat ──
    if (userId) {
      const otherUserId = parseInt(userId)
      if (isNaN(otherUserId)) {
        return NextResponse.json({ error: "Invalid userId" }, { status: 400 })
      }

      const existingConversation = await prisma.conversation.findFirst({
        where: {
          type: "private",
          AND: [
            { participants: { some: { userId: currentUserId } } },
            { participants: { some: { userId: otherUserId } } },
          ],
        },
        include: conversationInclude,
      })

      if (existingConversation && existingConversation.participants.length === 2) {
        // Filter drafts for current user
        const filtered = {
          ...existingConversation,
          drafts: existingConversation.drafts.filter((d: any) => d.userId === currentUserId),
        }
        return NextResponse.json(filtered)
      }

      const conversation = await prisma.conversation.create({
        data: {
          type: "private",
          participants: {
            create: [{ userId: currentUserId }, { userId: otherUserId }],
          },
        },
        include: conversationInclude,
      })
      return NextResponse.json(conversation, { status: 201 })
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  } catch (error) {
    console.error("Conversation creation error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const currentUserId = parseInt(session.user.id)

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: { some: { userId: currentUserId } },
        // Исключаем старые групповые чаты (Общий чат)
        NOT: { isGroup: true },
      },
      include: {
        drafts: { where: { userId: currentUserId } },
        participants: {
          include: {
            user: { select: { id: true, username: true, avatar: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: { select: { id: true, username: true, avatar: true } },
          },
        },
      },
    })

    return NextResponse.json(conversations)
  } catch (error) {
    console.error("Conversations fetch error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
