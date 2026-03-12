import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"

const conversationInclude = {
  drafts: true,
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
    const { userId, type, name, memberIds, description, avatar } = body

    // ── Saved Messages ──
    if (type === "saved") {
      const existing = await prisma.conversation.findFirst({
        where: { type: "saved", participants: { some: { userId: currentUserId } } },
        include: conversationInclude,
      })
      if (existing) return NextResponse.json(existing)
      const created = await prisma.conversation.create({
        data: {
          type: "saved", name: "Saved Messages",
          participants: { create: { userId: currentUserId } },
        },
        include: conversationInclude,
      })
      return NextResponse.json(created, { status: 201 })
    }

    // ── System chat ──
    if (type === "system") {
      const existing = await prisma.conversation.findFirst({
        where: { type: "system", participants: { some: { userId: currentUserId } } },
        include: conversationInclude,
      })
      if (existing) return NextResponse.json(existing)
      const created = await prisma.conversation.create({
        data: {
          type: "system", name: "Vortex",
          participants: { create: { userId: currentUserId } },
        },
        include: conversationInclude,
      })
      await prisma.message.create({
        data: {
          content: "👋 Добро пожаловать в Vortex!\n\nЗдесь вы будете получать уведомления о безопасности вашего аккаунта:\n• Входы с новых устройств\n• Изменения пароля или email\n• Подозрительная активность\n\nЕсли вы не совершали это действие — немедленно смените пароль в настройках.",
          conversationId: created.id, senderId: currentUserId,
        },
      })
      const withMsg = await prisma.conversation.findUnique({ where: { id: created.id }, include: conversationInclude })
      return NextResponse.json(withMsg, { status: 201 })
    }

    // ── Group chat ──
    if (type === "group") {
      if (!name?.trim()) return NextResponse.json({ error: "Group name required" }, { status: 400 })
      const members: number[] = Array.isArray(memberIds) ? memberIds.map(Number).filter(Boolean) : []
      if (!members.includes(currentUserId)) members.push(currentUserId)
      if (members.length > 200000) return NextResponse.json({ error: "Max 200,000 members" }, { status: 400 })

      const conversation = await prisma.conversation.create({
        data: {
          type: "group", isGroup: true, name: name.trim(),
          description: description || null, avatar: avatar || null,
          maxMembers: 200000,
          participants: {
            create: members.map(uid => ({
              userId: uid,
              role: uid === currentUserId ? "owner" : "member",
            })),
          },
        },
        include: conversationInclude,
      })
      return NextResponse.json(conversation, { status: 201 })
    }

    // ── Private chat ──
    if (userId) {
      const otherUserId = parseInt(userId)
      if (isNaN(otherUserId)) return NextResponse.json({ error: "Invalid userId" }, { status: 400 })

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
        return NextResponse.json({
          ...existingConversation,
          drafts: existingConversation.drafts.filter((d: any) => d.userId === currentUserId),
        })
      }

      const conversation = await prisma.conversation.create({
        data: {
          type: "private",
          participants: { create: [{ userId: currentUserId }, { userId: otherUserId }] },
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
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const currentUserId = parseInt(session.user.id)

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId: currentUserId,
            deletedAt: null, // скрытые не показываем
          }
        },
        NOT: { isGroup: true, type: "private" },
        OR: [
          { type: "private" },
          { type: "saved" },
          { type: "system" },
          { type: "group" },
        ],
      },
      include: {
        drafts: { where: { userId: currentUserId } },
        participants: {
          include: { user: { select: { id: true, username: true, avatar: true } } },
        },
        messages: {
          orderBy: { createdAt: "desc" }, take: 1,
          include: { sender: { select: { id: true, username: true, avatar: true } } },
        },
      },
    })

    // Добавляем folder/isMuted в каждый чат для текущего юзера
    const result = conversations.map(conv => {
      const myParticipant = conv.participants.find((p: any) => p.userId === currentUserId)
      return {
        ...conv,
        _folder: myParticipant?.folder ?? null,
        _isMuted: myParticipant?.isMuted ?? false,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Conversations fetch error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// DELETE — скрыть чат у себя (софт delete)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const currentUserId = parseInt(session.user.id)
    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get("conversationId")
    if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 })

    await prisma.conversationParticipant.updateMany({
      where: { conversationId: parseInt(conversationId), userId: currentUserId },
      data: { deletedAt: new Date(), clearedAt: new Date() }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// PATCH — update group OR archive/mute/folder
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const currentUserId = parseInt(session.user.id)
    const body = await req.json()
    const { conversationId, name, avatar, description, action, folder, mutedUntil } = body

    // ── Архив, мют, папка — обновляем participant ──
    if (action === "archive" || action === "unarchive" || action === "mute" || action === "unmute" || action === "folder") {
      const updateData: any = {}
      if (action === "archive") updateData.folder = "archive"
      if (action === "unarchive") updateData.folder = null
      if (action === "mute") updateData.isMuted = true, updateData.mutedUntil = mutedUntil ? new Date(mutedUntil) : null
      if (action === "unmute") updateData.isMuted = false, updateData.mutedUntil = null
      if (action === "folder") updateData.folder = folder ?? null

      await prisma.conversationParticipant.updateMany({
        where: { conversationId: parseInt(conversationId), userId: currentUserId },
        data: updateData
      })
      return NextResponse.json({ success: true })
    }

    // ── Редактирование группы ──
    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId: parseInt(conversationId), userId: currentUserId },
    })
    if (!participant || !["owner", "admin"].includes(participant.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const updated = await prisma.conversation.update({
      where: { id: parseInt(conversationId) },
      data: { name, avatar, description },
      include: conversationInclude,
    })
    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
