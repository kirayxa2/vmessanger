import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/stories — получить активные истории всех пользователей
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()

  // Получаем все активные истории (не истёкшие)
  const stories = await prisma.story.findMany({
    where: { expiresAt: { gt: now } },
    include: {
      user: { select: { id: true, username: true, avatar: true } },
      views: { where: { userId: parseInt(session.user.id) }, select: { userId: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  // Группируем по userId
  const grouped: Record<number, any> = {}
  for (const story of stories) {
    if (!grouped[story.userId]) {
      grouped[story.userId] = {
        user: story.user,
        stories: [],
        hasUnviewed: false,
      }
    }
    const viewed = story.views.length > 0
    grouped[story.userId].stories.push({ ...story, viewed })
    if (!viewed) grouped[story.userId].hasUnviewed = true
  }

  return NextResponse.json(Object.values(grouped))
}

// POST /api/stories — создать историю
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { mediaUrl, mediaType = "image", text } = body

  if (!mediaUrl) return NextResponse.json({ error: "mediaUrl required" }, { status: 400 })

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 часа

  const story = await prisma.story.create({
    data: {
      userId: parseInt(session.user.id),
      mediaUrl,
      mediaType,
      text,
      expiresAt,
    },
    include: {
      user: { select: { id: true, username: true, avatar: true } },
    },
  })

  return NextResponse.json(story)
}

// DELETE /api/stories?id=X — удалить свою историю
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  await prisma.story.deleteMany({
    where: { id: parseInt(id), userId: parseInt(session.user.id) },
  })

  return NextResponse.json({ ok: true })
}
