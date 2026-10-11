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
      select: { id: true, username: true, displayName: true, avatar: true, bio: true, createdAt: true,
        // настройки приватности — только своему профилю
        ...(String(userId) === session.user.id ? { showLastSeen: true, showOnlineStatus: true, phone: true, birthday: true } : {})
      }
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
    const { username, bio, displayName, showLastSeen, showOnlineStatus, phone, birthday } = body

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
    if (displayName !== undefined && (typeof displayName !== "string" || displayName.length > 30)) {
      return NextResponse.json({ error: "Display name must be under 30 characters" }, { status: 400 })
    }
    if (bio !== undefined && (typeof bio !== "string" || bio.length > 500)) {
      return NextResponse.json({ error: "Bio must be under 500 characters" }, { status: 400 })
    }

    if (phone !== undefined && phone !== null && phone !== "" &&
      (typeof phone !== "string" || !/^\+?[0-9\s\-()]{7,20}$/.test(phone))) {
      return NextResponse.json({ error: "Некорректный номер телефона" }, { status: 400 })
    }
    let birthdayDate: Date | null | undefined = undefined
    if (birthday !== undefined) {
      if (birthday === null || birthday === "") {
        birthdayDate = null
      } else if (typeof birthday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
        const d = new Date(`${birthday}T00:00:00.000Z`)
        if (isNaN(d.getTime()) || d.getTime() > Date.now() || d.getUTCFullYear() < 1900) {
          return NextResponse.json({ error: "Некорректная дата рождения" }, { status: 400 })
        }
        birthdayDate = d
      } else {
        return NextResponse.json({ error: "Некорректная дата рождения" }, { status: 400 })
      }
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
        ...(displayName !== undefined ? { displayName: displayName || null } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(phone !== undefined ? { phone: phone ? String(phone).trim() : null } : {}),
        ...(birthdayDate !== undefined ? { birthday: birthdayDate } : {}),
        ...(showLastSeen !== undefined ? { showLastSeen: Boolean(showLastSeen) } : {}),
        ...(showOnlineStatus !== undefined ? { showOnlineStatus: Boolean(showOnlineStatus) } : {}),
      },
      select: { id: true, username: true, displayName: true, avatar: true, bio: true, phone: true, birthday: true, showLastSeen: true, showOnlineStatus: true }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Profile update error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
