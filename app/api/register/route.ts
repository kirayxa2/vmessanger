import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// Rate limit store (in-memory, resets on server restart)
const registerAttempts = new Map<string, { count: number; resetAt: number }>()

export async function POST(req: NextRequest) {
  try {
    // ── Rate limiting: max 5 registrations per IP per hour ──
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const now = Date.now()
    const entry = registerAttempts.get(ip)
    if (entry) {
      if (now < entry.resetAt) {
        if (entry.count >= 5) {
          return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 })
        }
        entry.count++
      } else {
        registerAttempts.set(ip, { count: 1, resetAt: now + 3600_000 })
      }
    } else {
      registerAttempts.set(ip, { count: 1, resetAt: now + 3600_000 })
    }

    const body = await req.json()
    const { email, username, password } = body

    // ── Input validation ──
    if (!email || !username || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }
    if (typeof email !== "string" || typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
    // Email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email) || email.length > 255) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }
    // Username: 3-30 chars, alphanumeric + underscore only
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/
    if (!usernameRegex.test(username)) {
      return NextResponse.json({ error: "Username must be 3–30 characters (letters, numbers, underscores only)" }, { status: 400 })
    }
    // Password: min 8 chars
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "Password must be 8–128 characters" }, { status: 400 })
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase().trim() },
          { username }
        ]
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        username,
        password: hashedPassword,
      },
      select: { id: true, email: true, username: true }
    })

    // ── Create Saved Messages chat for new user (empty) ──
    await prisma.conversation.create({
      data: {
        type: "saved",
        name: "Saved Messages",
        participants: { create: { userId: user.id } },
      },
    })

    // ── Create Vortex system chat ──
    const systemConv = await prisma.conversation.create({
      data: {
        type: "system",
        name: "Vortex",
        participants: { create: { userId: user.id } },
      },
    })
    await prisma.message.create({
      data: {
        content: `👋 Добро пожаловать в VortexMessenger, ${username}!\n\nЗдесь вы будете получать уведомления безопасности:\n\u2022 Вход с новых устройств\n\u2022 Неудачные попытки входа\n\u2022 Изменения пароля или email\n\n\u2139️ Если вы получили уведомление, которое не совершали — немедленно смените пароль в Настройках.`,
        conversationId: systemConv.id,
        senderId: user.id,
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    )
  }
}