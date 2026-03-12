import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// POST /api/stories/view — отметить историю как просмотренную
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { storyId } = await req.json()
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 })

  await prisma.storyView.upsert({
    where: { storyId_userId: { storyId: parseInt(storyId), userId: parseInt(session.user.id) } },
    create: { storyId: parseInt(storyId), userId: parseInt(session.user.id) },
    update: { viewedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
