import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth/getAdminSession"
import bcrypt from "bcryptjs"

// GET — список сотрудников организации
export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const employees = await prisma.employee.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      login: true,
      fullName: true,
      position: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      user: { select: { id: true, avatar: true, lastSeen: true } },
    },
  })

  return NextResponse.json({ employees })
}

// POST — создать нового сотрудника (+ связанный User-аккаунт для мессенджера)
export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const { login, password, fullName, position } = body

    if (!login || typeof login !== "string" || login.trim().length < 3) {
      return NextResponse.json({ error: "Логин должен быть не короче 3 символов" }, { status: 400 })
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Пароль должен быть не короче 8 символов" }, { status: 400 })
    }
    if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
      return NextResponse.json({ error: "Укажите имя сотрудника" }, { status: 400 })
    }

    const normalizedLogin = login.trim().toLowerCase()
    if (!/^[a-z0-9_.-]+$/.test(normalizedLogin)) {
      return NextResponse.json(
        { error: "Логин может содержать только латинские буквы, цифры, точку, дефис и подчёркивание" },
        { status: 400 }
      )
    }

    const existing = await prisma.employee.findUnique({ where: { login: normalizedLogin } })
    if (existing) return NextResponse.json({ error: "Такой логин уже занят" }, { status: 409 })

    // Внутренний username/email для User-аккаунта — не используется для входа, только для работы мессенджера
    const internalUsername = `emp_${normalizedLogin}`
    const internalEmail = `${normalizedLogin}@employees.local`

    const usernameTaken = await prisma.user.findUnique({ where: { username: internalUsername } })
    if (usernameTaken) return NextResponse.json({ error: "Такой логин уже занят" }, { status: 409 })

    const passwordHash = await bcrypt.hash(password, 12)
    // У User тоже нужен password — генерируем случайный, вход для сотрудника всегда идёт через login/password Employee
    const randomUserPassword = await bcrypt.hash(crypto.randomUUID(), 12)

    const employee = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: internalEmail,
          username: internalUsername,
          password: randomUserPassword,
          displayName: fullName.trim(),
          emailVerified: true,
        },
      })

      return tx.employee.create({
        data: {
          login: normalizedLogin,
          passwordHash,
          fullName: fullName.trim(),
          position: position?.trim() || null,
          userId: user.id,
          createdById: Number(session.user.id),
        },
        select: {
          id: true,
          login: true,
          fullName: true,
          position: true,
          isActive: true,
          createdAt: true,
        },
      })
    })

    return NextResponse.json({ employee }, { status: 201 })
  } catch (error) {
    console.error("Create employee error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
