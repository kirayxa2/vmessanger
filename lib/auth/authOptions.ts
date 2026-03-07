import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { loginLimiter } from "@/lib/rateLimiter"

// Helper — sends security notification to user's Vortex chat
async function sendSystemNotification(userId: number, message: string) {
  try {
    let systemConv = await prisma.conversation.findFirst({
      where: {
        type: "system",
        participants: { some: { userId } },
      },
    })
    if (!systemConv) {
      systemConv = await prisma.conversation.create({
        data: {
          type: "system",
          name: "Vortex",
          participants: { create: { userId } },
        },
      })
    }
    await prisma.message.create({
      data: { content: message, conversationId: systemConv.id, senderId: userId },
    })
  } catch (e) {
    if (process.env.NODE_ENV === "development") console.error("System notify error:", e)
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null

        // ── Rate limiting: max 10 attempts per email per 5 minutes ──
        const emailKey = `login:${credentials.email.toLowerCase().trim()}`
        const ipKey = `login-ip:${(req?.headers?.["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? "unknown"}`

        if (!loginLimiter.isAllowed(emailKey) || !loginLimiter.isAllowed(ipKey)) {
          throw new Error("Too many login attempts. Please try again in a few minutes.")
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase().trim() },
          })
          if (!user) return null

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
          if (!isPasswordValid) {
            await sendSystemNotification(
              user.id,
              `⚠️ Неудачная попытка входа в ваш аккаунт.\n\nВремя: ${new Date().toLocaleString("ru-RU")}\n\nЕсли это были не вы — смените пароль немедленно.`
            )
            return null
          }

          await sendSystemNotification(
            user.id,
            `✅ Выполнен вход в аккаунт.\n\nВремя: ${new Date().toLocaleString("ru-RU")}\n\nЕсли это были не вы — немедленно смените пароль в настройках и завершите все сессии.`
          )

          return {
            id: user.id.toString(),
            email: user.email,
            name: user.username,
            image: user.avatar,
          }
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Auth Error:", error)
          return null
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) { token.id = user.id; token.image = user.image }
      if (trigger === "update" && session?.user?.image) token.image = session.user.image
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.image = token.image as string
      }
      return session
    },
  },
  debug: process.env.NODE_ENV === "development",
  logger: {
    error(code, metadata) {
      if (process.env.NODE_ENV === "development") console.error("NextAuth Error:", code, metadata)
    },
    warn(code) {
      if (process.env.NODE_ENV === "development") console.warn("NextAuth Warning:", code)
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
}
