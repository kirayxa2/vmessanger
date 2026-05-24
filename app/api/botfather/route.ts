import { NextRequest, NextResponse } from "next/server"
import { processBotFatherMessage } from "@/lib/botfather"

// Внутренний endpoint — вызывается только из server.js
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret")
  if (secret !== (process.env.INTERNAL_SECRET || "botfather-secret")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId, text, conversationId } = await req.json()
  if (!userId || !text || !conversationId) {
    return NextResponse.json({ error: "userId, text, conversationId required" }, { status: 400 })
  }

  const replies = await processBotFatherMessage(userId, text, conversationId)
  return NextResponse.json(replies)
}
