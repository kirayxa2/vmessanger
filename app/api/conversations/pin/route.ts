import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"

// POST — pin a message
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { conversationId, messageId } = body

    if (!conversationId || !messageId) {
      return NextResponse.json({ error: "conversationId and messageId required" }, { status: 400 })
    }

    // Verify participant
    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId: Number(conversationId), userId: Number(session.user.id) }
    })
    if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Verify message belongs to this conversation
    const message = await prisma.message.findFirst({
      where: { id: Number(messageId), conversationId: Number(conversationId) },
      include: { sender: { select: { id: true, username: true, avatar: true } } }
    })
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 })

    // Добавляем в массив pinnedMessageIds (макс 5 как в Telegram)
    const conv = await prisma.conversation.findUnique({ where: { id: Number(conversationId) } })
    const currentPinned: number[] = (conv?.pinnedMessageIds as number[]) || []
    const msgId = Number(messageId)
    if (!currentPinned.includes(msgId)) {
      const newPinned = [msgId, ...currentPinned].slice(0, 5) // макс 5
      await prisma.conversation.update({
        where: { id: Number(conversationId) },
        data: { pinnedMessageId: msgId, pinnedMessageIds: newPinned },
      })
    }

    return NextResponse.json({
      pinnedMessageId: Number(messageId),
      pinnedMessage: message,
      conversationId: Number(conversationId),
    })
  } catch (error) {
    console.error("Pin error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// DELETE — unpin message
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get("conversationId")

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 })
    }

    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId: Number(conversationId), userId: Number(session.user.id) }
    })
    if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams: sp2 } = new URL(req.url)
    const messageId = sp2.get("messageId")

    if (messageId) {
      // Удаляем конкретное сообщение из закреплённых
      const conv = await prisma.conversation.findUnique({ where: { id: Number(conversationId) } })
      const current: number[] = (conv?.pinnedMessageIds as number[]) || []
      const newPinned = current.filter(id => id !== Number(messageId))
      await prisma.conversation.update({
        where: { id: Number(conversationId) },
        data: { pinnedMessageIds: newPinned, pinnedMessageId: newPinned[0] ?? null },
      })
    } else {
      // Снять все закреплённые
      await prisma.conversation.update({
        where: { id: Number(conversationId) },
        data: { pinnedMessageId: null, pinnedMessageIds: [] },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
