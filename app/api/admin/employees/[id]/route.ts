import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth/getAdminSession"
import bcrypt from "bcryptjs"

// PATCH — обновить данные сотрудника, сбросить пароль, активировать/деактивировать
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 })

  try {
    const body = await req.json()
    const { fullName, position, isActive, newPassword } = body

    const data: any = {}
    if (typeof fullName === "string" && fullName.trim().length >= 2) data.fullName = fullName.trim()
    if (typeof position === "string") data.position = position.trim() || null
    if (typeof isActive === "boolean") data.isActive = isActive
    if (typeof newPassword === "string" && newPassword.length > 0) {
      if (newPassword.length < 8) {
        return NextResponse.json({ error: "Пароль должен быть не короче 8 символов" }, { status: 400 })
      }
      data.passwordHash = await bcrypt.hash(newPassword, 12)
    }

    const employee = await prisma.employee.update({
      where: { id },
      data,
      select: { id: true, login: true, fullName: true, position: true, isActive: true },
    })

    // Синхронизируем displayName в User-профиле, если менялось имя
    if (data.fullName) {
      const emp = await prisma.employee.findUnique({ where: { id }, select: { userId: true } })
      if (emp) await prisma.user.update({ where: { id: emp.userId }, data: { displayName: data.fullName } })
    }

    return NextResponse.json({ employee })
  } catch (error) {
    console.error("Update employee error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// DELETE — удалить сотрудника (вместе со связанным User-аккаунтом)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 })

  try {
    const employee = await prisma.employee.findUnique({ where: { id }, select: { userId: true } })
    if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // Каскад в схеме удалит Employee при удалении User (onDelete: Cascade на Employee.user)
    await prisma.user.delete({ where: { id: employee.userId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete employee error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
