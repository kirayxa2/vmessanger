import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"

// GET /api/users/profile?userId=X — получить профиль пользователя
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId") || session.user.id

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { id: true, username: true, avatar: true, bio: true, createdAt: true }
    })

    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(user)
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// PATCH /api/users/profile — обновить username и/или bio
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { username, bio } = body

    // ── Input validation ──
    if (username !== undefined) {
      if (typeof username !== "string") {
        return NextResponse.json({ error: "Invalid username" }, { status: 400 })
      }
      const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/
      if (!usernameRegex.test(username)) {
        return NextResponse.json({ error: "Username must be 3–30 characters (letters, numbers, underscores)" }, { status: 400 })
      }
    }
    if (bio !== undefined && (typeof bio !== "string" || bio.length > 500)) {
      return NextResponse.json({ error: "Bio must be under 500 characters" }, { status: 400 })
    }

    // Проверяем уникальность username если он меняется
    if (username && username !== session.user.name) {
      const existing = await prisma.user.findUnique({ where: { username } })
      if (existing && existing.id !== Number(session.user.id)) {
        return NextResponse.json({ error: "Username already taken" }, { status: 409 })
      }
    }

    const updated = await prisma.user.update({
      where: { id: Number(session.user.id) },
      data: {
        ...(username ? { username } : {}),
        ...(bio !== undefined ? { bio } : {}),
      },
      select: { id: true, username: true, avatar: true, bio: true }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Profile update error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
