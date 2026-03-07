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

    // Update conversation with pinned message ID
    await prisma.conversation.update({
      where: { id: Number(conversationId) },
      data: { pinnedMessageId: Number(messageId) },
    })

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

    await prisma.conversation.update({
      where: { id: Number(conversationId) },
      data: { pinnedMessageId: null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
