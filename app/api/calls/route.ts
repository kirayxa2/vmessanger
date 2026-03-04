import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { conversationId, receiverId, type } = await req.json()

    const call = await prisma.call.create({
      data: {
        conversationId: Number(conversationId),
        initiatorId: Number(session.user.id),
        receiverId: Number(receiverId),
        type: type || "audio",
        status: "calling",
      }
    })

    return NextResponse.json(call)
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { callId, status } = await req.json()

    const call = await prisma.call.update({
      where: { id: Number(callId) },
      data: {
        status,
        ...(status === "ended" || status === "declined" ? { endedAt: new Date() } : {})
      }
    })

    return NextResponse.json(call)
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
