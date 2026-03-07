import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"

// POST — add reaction
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { messageId, emoji } = body

    if (!messageId || !emoji || typeof emoji !== "string") {
      return NextResponse.json({ error: "messageId and emoji are required" }, { status: 400 })
    }

    // Validate emoji (allow common emojis)
    const allowedEmojis = ["❤️", "👍", "👎", "😂", "😮", "😢", "🔥", "🎉", "🤔", "💯", "👀", "🙏"]
    if (!allowedEmojis.includes(emoji)) {
      return NextResponse.json({ error: "Invalid emoji" }, { status: 400 })
    }

    // Verify user has access to the message's conversation
    const message = await prisma.message.findUnique({
      where: { id: Number(messageId) },
      select: { conversationId: true },
    })
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 })

    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId: message.conversationId, userId: Number(session.user.id) }
    })
    if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Upsert reaction (toggle behavior)
    const existing = await prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: Number(messageId),
          userId: Number(session.user.id),
          emoji,
        }
      }
    })

    if (existing) {
      // Remove if already exists (toggle off)
      await prisma.reaction.delete({ where: { id: existing.id } })
      return NextResponse.json({ action: "removed", messageId: Number(messageId), emoji, userId: Number(session.user.id) })
    }

    const reaction = await prisma.reaction.create({
      data: {
        messageId: Number(messageId),
        userId: Number(session.user.id),
        emoji,
      },
      include: {
        user: { select: { id: true, username: true } }
      }
    })

    return NextResponse.json({ action: "added", ...reaction, conversationId: message.conversationId })
  } catch (error) {
    console.error("Reaction error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// DELETE — remove reaction  
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const messageId = searchParams.get("messageId")
    const emoji = searchParams.get("emoji")

    if (!messageId || !emoji) {
      return NextResponse.json({ error: "messageId and emoji required" }, { status: 400 })
    }

    const reaction = await prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: Number(messageId),
          userId: Number(session.user.id),
          emoji,
        }
      }
    })

    if (!reaction) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await prisma.reaction.delete({ where: { id: reaction.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
