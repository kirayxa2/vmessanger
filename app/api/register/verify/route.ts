import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex")

// Шаг 2 регистрации: проверяем код и создаём пользователя.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email: rawEmail, code } = body
    if (!rawEmail || !code) {
      return NextResponse.json({ error: "Введите код" }, { status: 400 })
    }
    const email = String(rawEmail).toLowerCase().trim()

    const pending = await prisma.pendingRegistration.findUnique({ where: { email } })
    if (!pending) {
      return NextResponse.json({ error: "Запрос не найден. Зарегистрируйтесь заново." }, { status: 400 })
    }
    if (new Date(pending.expiresAt).getTime() < Date.now()) {
      await prisma.pendingRegistration.delete({ where: { email } }).catch(() => {})
      return NextResponse.json({ error: "Код истёк. Запросите новый." }, { status: 400 })
    }
    if (pending.attempts >= 5) {
      await prisma.pendingRegistration.delete({ where: { email } }).catch(() => {})
      return NextResponse.json({ error: "Слишком много попыток. Зарегистрируйтесь заново." }, { status: 429 })
    }
    if (sha256(String(code).trim()) !== pending.codeHash) {
      await prisma.pendingRegistration.update({ where: { email }, data: { attempts: { increment: 1 } } })
      const left = 5 - (pending.attempts + 1)
      return NextResponse.json({ error: `Неверный код. Осталось попыток: ${Math.max(0, left)}` }, { status: 400 })
    }

    // Финальная проверка уникальности (на случай гонки)
    const taken = await prisma.user.findFirst({
      where: { OR: [{ email }, { username: pending.username }] },
      select: { id: true },
    })
    if (taken) {
      await prisma.pendingRegistration.delete({ where: { email } }).catch(() => {})
      return NextResponse.json({ error: "Аккаунт уже существует" }, { status: 400 })
    }

    const user = await prisma.user.create({
      data: {
        email,
        username: pending.username,
        password: pending.passwordHash,
        emailVerified: true,
        ...(pending.publicKey ? { publicKey: pending.publicKey } : {}),
      },
      select: { id: true, email: true, username: true },
    })

    // Saved Messages + системный чат Vortex с приветствием
    await prisma.conversation.create({
      data: { type: "saved", name: "Saved Messages", participants: { create: { userId: user.id } } },
    })
    const systemConv = await prisma.conversation.create({
      data: { type: "system", name: "Vortex", participants: { create: { userId: user.id } } },
    })
    await prisma.message.create({
      data: {
        content: `👋 Добро пожаловать в VortexMessenger, ${user.username}!\n\nЗдесь вы будете получать уведомления безопасности:\n• Вход с новых устройств\n• Неудачные попытки входа\n• Изменения пароля или email\n\nℹ️ Если вы получили уведомление, которое не совершали — немедленно смените пароль в Настройках.`,
        conversationId: systemConv.id,
        senderId: user.id,
      },
    })

    await prisma.pendingRegistration.delete({ where: { email } }).catch(() => {})

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error("register/verify error:", error)
    return NextResponse.json({ error: "Внутренняя ошибка" }, { status: 500 })
  }
}
