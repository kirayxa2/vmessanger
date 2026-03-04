import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../auth/[...nextauth]/route"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { conversationId, text, replyToId, entities } = body

    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID is required" }, { status: 400 })
    }

    if (text === undefined || text === null || text === "") {
      // Clear draft if text is empty
      await prisma.draft.deleteMany({
        where: {
          userId: Number(session.user.id),
          conversationId: Number(conversationId),
        },
      })
      return NextResponse.json({ success: true, cleared: true })
    }

    const draft = await prisma.draft.upsert({
      where: {
        userId_conversationId: {
          userId: Number(session.user.id),
          conversationId: Number(conversationId),
        },
      },
      update: {
        text,
        replyToId,
        entities,
        timestamp: new Date(),
      },
      create: {
        userId: Number(session.user.id),
        conversationId: Number(conversationId),
        text,
        replyToId,
        entities,
      },
    })

    return NextResponse.json(draft)
  } catch (error) {
    console.error("Save draft error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
    try {
      const session = await getServerSession(authOptions)
      
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
  
      const { searchParams } = new URL(req.url)
      const conversationId = searchParams.get("conversationId")
  
      if (!conversationId) {
        return NextResponse.json({ error: "Conversation ID is required" }, { status: 400 })
      }
  
      await prisma.draft.deleteMany({
        where: {
          userId: Number(session.user.id),
          conversationId: Number(conversationId),
        },
      })
  
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("Delete draft error:", error)
      return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}
