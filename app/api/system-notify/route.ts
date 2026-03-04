import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Internal-only endpoint — called server-side only with INTERNAL_API_KEY
// Sends a security notification to a user's Vortex system chat
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("x-internal-key")
    if (authHeader !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { userId, message } = await req.json()
    if (!userId || !message) {
      return NextResponse.json({ error: "userId and message required" }, { status: 400 })
    }

    // Find or create system conversation for this user
    let systemConv = await prisma.conversation.findFirst({
      where: {
        type: "system",
        participants: { some: { userId: Number(userId) } },
      },
    })

    if (!systemConv) {
      systemConv = await prisma.conversation.create({
        data: {
          type: "system",
          name: "Vortex",
          participants: { create: { userId: Number(userId) } },
        },
      })
    }

    const msg = await prisma.message.create({
      data: {
        content: message,
        conversationId: systemConv.id,
        senderId: Number(userId),
      },
      include: {
        sender: { select: { id: true, username: true, avatar: true } },
      },
    })

    return NextResponse.json({ success: true, messageId: msg.id })
  } catch (error) {
    console.error("System notification error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
