import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { adminLoginLimiter } from "@/lib/rateLimiter"

// Отдельный NextAuth-инстанс для администраторов организации.
// Полностью изолирован от обычной сессии мессенджера: своя cookie, свой JWT,
// своя модель Admin. Скомпрометированный логин сотрудника/юзера не даёт доступа сюда.
export const adminAuthOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "admin-credentials",
      name: "Admin",
      credentials: {
        login: { label: "Логин", type: "text" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.login || !credentials?.password) return null

        const loginKey = `admin-login:${credentials.login.toLowerCase().trim()}`
        const ipKey = `admin-login-ip:${(req?.headers?.["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? "unknown"}`

        if (!adminLoginLimiter.isAllowed(loginKey) || !adminLoginLimiter.isAllowed(ipKey)) {
          throw new Error("Слишком много попыток входа. Попробуйте позже.")
        }

        try {
          const admin = await prisma.admin.findUnique({
            where: { login: credentials.login.trim() },
          })
          if (!admin || !admin.isActive) return null

          const isValid = await bcrypt.compare(credentials.password, admin.passwordHash)

          await prisma.adminLoginLog.create({
            data: {
              adminId: admin.id,
              success: isValid,
              ip: (req?.headers?.["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? null,
              userAgent: (req?.headers?.["user-agent"] as string) ?? null,
            },
          })

          if (!isValid) return null

          await prisma.admin.update({
            where: { id: admin.id },
            data: { lastLoginAt: new Date() },
          })

          return {
            id: admin.id.toString(),
            name: admin.fullName ?? admin.login,
            login: admin.login,
          } as any
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Admin auth error:", error)
          return null
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name: "admin-session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.login = (user as any).login
        token.role = "admin"
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.id as string
        ;(session.user as any).login = token.login as string
        ;(session.user as any).role = "admin"
      }
      return session
    },
  },
  pages: { signIn: "/admin/login" },
  secret: process.env.ADMIN_NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET,
}
