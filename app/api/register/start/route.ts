import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { registerLimiter } from "@/lib/rateLimiter"
import { sendVerificationEmail } from "@/lib/email"

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex")

// Шаг 1 регистрации: валидируем данные, генерируем код, шлём письмо.
// Пользователь в БД ещё НЕ создаётся — только запись PendingRegistration.
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    if (!registerLimiter.isAllowed(`register:${ip}`)) {
      return NextResponse.json({ error: "Слишком много попыток. Попробуйте позже." }, { status: 429 })
    }

    const body = await req.json()
    const { email: rawEmail, username, password, publicKey } = body

    if (!rawEmail || !username || !password) {
      return NextResponse.json({ error: "Заполните все поля" }, { status: 400 })
    }
    if (typeof rawEmail !== "string" || typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Некорректный ввод" }, { status: 400 })
    }
    const email = rawEmail.toLowerCase().trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email) || email.length > 255) {
      return NextResponse.json({ error: "Некорректный email" }, { status: 400 })
    }
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/
    if (!usernameRegex.test(username)) {
      return NextResponse.json({ error: "Имя пользователя: 3–30 символов (буквы, цифры, _)" }, { status: 400 })
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "Пароль: 8–128 символов" }, { status: 400 })
    }

    // Уже зарегистрированный (подтверждённый) пользователь
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { id: true, email: true, username: true },
    })
    if (existingUser) {
      const field = existingUser.email === email ? "email" : "имя пользователя"
      return NextResponse.json({ error: `Этот ${field} уже занят` }, { status: 400 })
    }

    // username может быть занят другой ожидающей регистрацией
    const usernameTaken = await prisma.pendingRegistration.findFirst({
      where: { username, NOT: { email } },
      select: { id: true },
    })
    if (usernameTaken) {
      return NextResponse.json({ error: "Имя пользователя уже занято" }, { status: 400 })
    }

    // Анти-спам: не чаще раза в 30 секунд для одного email
    const existingPending = await prisma.pendingRegistration.findUnique({ where: { email } })
    if (existingPending && Date.now() - new Date(existingPending.lastSentAt).getTime() < 30_000) {
      return NextResponse.json({ error: "Код уже отправлен. Подождите 30 секунд." }, { status: 429 })
    }

    const code = String(Math.floor(100000 + Math.random() * 900000)) // 6 цифр
    const passwordHash = await bcrypt.hash(password, 12)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 минут

    await prisma.pendingRegistration.upsert({
      where: { email },
      update: { username, passwordHash, publicKey: publicKey || null, codeHash: sha256(code), expiresAt, attempts: 0, lastSentAt: new Date() },
      create: { email, username, passwordHash, publicKey: publicKey || null, codeHash: sha256(code), expiresAt, lastSentAt: new Date() },
    })

    const result = await sendVerificationEmail(email, code)

    // dev-фолбэк: провайдер не настроен — возвращаем код, чтобы можно было тестировать локально
    if (!result.sent && result.dev && process.env.NODE_ENV !== "production") {
      return NextResponse.json({ ok: true, devCode: code, emailConfigured: false })
    }
    if (!result.sent) {
      return NextResponse.json({ error: "Не удалось отправить письмо. Попробуйте позже." }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("register/start error:", error)
    return NextResponse.json({ error: "Внутренняя ошибка" }, { status: 500 })
  }
}
