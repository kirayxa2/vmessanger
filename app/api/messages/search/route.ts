import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q")
    const conversationId = searchParams.get("conversationId")

    if (!q || q.trim().length === 0) {
      return NextResponse.json([])
    }
    if (q.length > 200) {
      return NextResponse.json({ error: "Query too long" }, { status: 400 })
    }

    // Build where clause
    const where: any = {
      content: { contains: q, mode: "insensitive" },
    }

    if (conversationId) {
      // Verify user is participant
      const participant = await prisma.conversationParticipant.findFirst({
        where: { conversationId: Number(conversationId), userId: Number(session.user.id) }
      })
      if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      where.conversationId = Number(conversationId)
    } else {
      // Search across all user's conversations
      const userConvs = await prisma.conversationParticipant.findMany({
        where: { userId: Number(session.user.id) },
        select: { conversationId: true },
      })
      where.conversationId = { in: userConvs.map(c => c.conversationId) }
    }

    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: { select: { id: true, username: true, avatar: true } },
        conversation: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    return NextResponse.json(messages)
  } catch (error) {
    console.error("Message search error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
