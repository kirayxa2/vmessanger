import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { conversationId } = await req.json()
    if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 })

    const userId = Number(session.user.id)

    // SECURITY: без этой проверки любой авторизованный пользователь мог подсунуть
    // conversationId чужого чата и пометить его сообщения как прочитанные (порча read receipts
    // и создание MessageRead записей от чужого имени).
    const participant = await prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId, conversationId: Number(conversationId) } }
    })
    if (!participant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId: Number(conversationId),
        senderId: { not: userId },
        readBy: { none: { userId } }
      },
      select: { id: true }
    })

    if (unreadMessages.length === 0) return NextResponse.json({ count: 0 })

    await prisma.messageRead.createMany({
      data: unreadMessages.map(m => ({ messageId: m.id, userId })),
      skipDuplicates: true,
    })

    await prisma.message.updateMany({
      where: { id: { in: unreadMessages.map(m => m.id) } },
      data: { isRead: true }
    })

    return NextResponse.json({ count: unreadMessages.length, messageIds: unreadMessages.map(m => m.id) })
  } catch (error) {
    console.error("Read receipt error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
