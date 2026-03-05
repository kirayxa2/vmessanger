import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"

// Простой in-memory rate limiter: не более 30 сообщений в минуту на пользователя
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 30) return false
  entry.count++
  return true
}

const messageInclude = {
  sender: { select: { id: true, username: true, avatar: true } },
  replyTo: {
    include: {
      sender: { select: { id: true, username: true, avatar: true } }
    }
  }
}

const messageSelect = {
  id: true, content: true, createdAt: true, isRead: true,
  senderId: true, receiverId: true, conversationId: true,
  replyToId: true, forwardFromId: true,
  fileUrl: true, fileName: true, fileSize: true, fileType: true,
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json({ error: "Too many messages, slow down" }, { status: 429 })
    }

    const body = await req.json()
    const { content, conversationId, replyToId, forwardFromId, fileUrl, fileName, fileSize, fileType, voiceUrl, voiceDuration } = body

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
    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId: Number(conversationId), userId: Number(session.user.id) }
    })
    if (!participant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const message = await prisma.message.create({
      data: {
        content: hasText ? content : "",
        conversationId: Number(conversationId),
        senderId: Number(session.user.id),
        ...(replyToId ? { replyToId: Number(replyToId) } : {}),
        ...(forwardFromId ? { forwardFromId: Number(forwardFromId) } : {}),
        ...(fileUrl ? { fileUrl, fileName: fileName || "file", fileSize: fileSize || 0, fileType: fileType || "application/octet-stream" } : {}),
        ...(voiceUrl ? { voiceUrl, voiceDuration: voiceDuration || 0 } : {}),
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

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 })
    }

    // ── Verify user is participant ──
    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId: Number(conversationId), userId: Number(session.user.id) }
    })
    if (!participant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: Number(conversationId) },
      include: messageInclude,
      orderBy: { createdAt: "asc" }
    })

    return NextResponse.json(messages)
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

    // Allow delete if sender OR participant in that conversation
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
    const { id, content } = body

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
      data: { content },
      include: messageInclude
    })

    return NextResponse.json(updatedMessage)
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
