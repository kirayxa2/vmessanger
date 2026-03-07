import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth/authOptions"
import bcrypt from "bcryptjs"

// PATCH — change password
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Both passwords required" }, { status: 400 })
    }
    if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
      return NextResponse.json({ error: "New password must be 8–128 characters" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(session.user.id) },
    })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
      where: { id: Number(session.user.id) },
      data: { password: hashedPassword },
    })

    // Send system notification
    try {
      const systemConv = await prisma.conversation.findFirst({
        where: { type: "system", participants: { some: { userId: Number(session.user.id) } } },
      })
      if (systemConv) {
        await prisma.message.create({
          data: {
            content: `🔒 Пароль был изменён.\n\nВремя: ${new Date().toLocaleString("ru-RU")}\n\nЕсли это были не вы — немедленно свяжитесь с поддержкой.`,
            conversationId: systemConv.id,
            senderId: Number(session.user.id),
          },
        })
      }
    } catch {}

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Password change error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
