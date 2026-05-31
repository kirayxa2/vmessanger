import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"
import { messageLimiter } from "@/lib/rateLimiter"

const messageInclude = {
  sender: { select: { id: true, username: true, avatar: true } },
  replyTo: {
    include: {
      sender: { select: { id: true, username: true, avatar: true } }
    }
  },
  // Full reactions with user info — used for POST (single message confirm)
  reactions: {
    include: {
      user: { select: { id: true, username: true } }
    }
  }
}

// Lightweight include for GET list — reactions as count only saves significant data on large chats
const messageListInclude = {
  sender: { select: { id: true, username: true, avatar: true } },
  replyTo: {
    include: {
      sender: { select: { id: true, username: true, avatar: true } }
    }
  },
  reactions: {
    include: {
      user: { select: { id: true, username: true } }
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!messageLimiter.isAllowed(session.user.id)) {
      return NextResponse.json({ error: "Too many messages, slow down" }, { status: 429 })
    }

    const body = await req.json()
    const { content, contentForSender, isEncrypted, conversationId, replyToId, forwardFromId, fileUrl, fileName, fileSize, fileType, voiceUrl, voiceDuration, selfDestructSeconds, linkPreview, scheduledAt } = body

    // ── Validate input ──
    const hasText = content && typeof content === "string" && content.trim().length > 0
    const hasFile = fileUrl && typeof fileUrl === "string"
    const hasVoice = voiceUrl && typeof voiceUrl === "string"
    if (!hasText && !hasFile && !hasVoice) {
      return NextResponse.json({ error: "Content or file is required" }, { status: 400 })
    }
    if (hasText && content.length > 4096) {
      return NextResponse.json({ error: "Message must be 1–4096 characters" }, { status: 400 })
    }
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 })
    }

    // ── Verify user is participant in this conversation ──
    const participant = await prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId: Number(session.user.id), conversationId: Number(conversationId) } }
    })
    if (!participant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // ── Self-destruct timer ──
    let selfDestructAt: Date | undefined
    if (selfDestructSeconds && typeof selfDestructSeconds === "number" && selfDestructSeconds > 0) {
      selfDestructAt = new Date(Date.now() + selfDestructSeconds * 1000)
    }

    // ── Scheduled send: дата в будущем (макс. 1 год) ──
    let scheduledAtDate: Date | undefined
    if (scheduledAt) {
      const d = new Date(scheduledAt)
      if (!isNaN(d.getTime()) && d.getTime() > Date.now() + 5000 && d.getTime() < Date.now() + 365 * 24 * 3600 * 1000) {
        scheduledAtDate = d
      }
    }

    const message = await prisma.message.create({
      data: {
        content: hasText ? content : "",
        ...(contentForSender ? { contentForSender } : {}),
        ...(isEncrypted ? { isEncrypted: true } : {}),
        conversationId: Number(conversationId),
        senderId: Number(session.user.id),
        ...(replyToId ? { replyToId: Number(replyToId) } : {}),
        ...(forwardFromId ? { forwardFromId: Number(forwardFromId) } : {}),
        ...(fileUrl ? { fileUrl, fileName: fileName || "file", fileSize: fileSize || 0, fileType: fileType || "application/octet-stream" } : {}),
        ...(voiceUrl ? { voiceUrl, voiceDuration: voiceDuration || 0 } : {}),
        ...(selfDestructAt ? { selfDestructAt } : {}),
        ...(linkPreview && typeof linkPreview === "object" ? { linkPreview } : {}),
        ...(scheduledAtDate ? { scheduledAt: scheduledAtDate } : {}),
      },
      include: messageInclude
    })

    return NextResponse.json({ ...message, conversationId: message.conversationId })
  } catch (error) {
    console.error("Message creation error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get("conversationId")
    const cursor = searchParams.get("cursor") // message ID for cursor-based pagination
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 })
    }

    // ── Verify user is participant ──
    const participant = await prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId: Number(session.user.id), conversationId: Number(conversationId) } }
    })
    if (!participant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // ── Cursor-based pagination ──
    const messages = await prisma.message.findMany({
      where: {
        conversationId: Number(conversationId),
        // Filter out expired self-destructing messages
        OR: [
          { selfDestructAt: null },
          { selfDestructAt: { gt: new Date() } },
        ],
        // Скрываем отложенные сообщения, время которых ещё не наступило
        scheduledAt: null,
        // If the user cleared history, only show messages after that timestamp
        ...(participant.clearedAt ? { createdAt: { gt: participant.clearedAt } } : {}),
        ...(cursor ? { id: { lt: Number(cursor) } } : {}),
      },
      include: messageListInclude,
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    // Reverse to show in chronological order
    messages.reverse()

    // Return with pagination info
    const hasMore = messages.length === limit
    const nextCursor = messages.length > 0 ? messages[0].id : null

    return NextResponse.json({
      messages,
      hasMore,
      nextCursor,
    })
  } catch (error) {
    console.error("Messages fetch error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const messageId = searchParams.get("id")
    if (!messageId) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const message = await prisma.message.findUnique({ where: { id: Number(messageId) } })
    if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // Allow delete if participant in that conversation (Telegram-style)
    const isParticipant = await prisma.conversationParticipant.findFirst({
      where: { conversationId: message.conversationId, userId: Number(session.user.id) }
    })
    if (!isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    await prisma.message.delete({ where: { id: Number(messageId) } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { id, content, contentForSender, isEncrypted } = body

    if (!id || !content || typeof content !== "string") {
      return NextResponse.json({ error: "id and content are required" }, { status: 400 })
    }
    if (content.trim().length === 0 || content.length > 4096) {
      return NextResponse.json({ error: "Message must be 1–4096 characters" }, { status: 400 })
    }

    const message = await prisma.message.findUnique({ where: { id: Number(id) } })
    if (!message || message.senderId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updatedMessage = await prisma.message.update({
      where: { id: Number(id) },
      data: {
        content,
        ...(contentForSender !== undefined ? { contentForSender: contentForSender || null } : {}),
        ...(isEncrypted !== undefined ? { isEncrypted: isEncrypted === true } : {}),
      },
      include: messageInclude
    })

    return NextResponse.json(updatedMessage)
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
