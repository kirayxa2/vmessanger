import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"

// ID системного User-аккаунта BotFather, кэшируется на время процесса
let cachedBotFatherId: number | null = null

/**
 * Возвращает id системного пользователя BotFather.
 * Создаёт его при первом вызове (lazy seed).
 */
export async function ensureBotFatherUser(): Promise<number> {
  if (cachedBotFatherId) return cachedBotFatherId

  const existing = await prisma.user.findUnique({
    where: { username: "BotFather" },
    select: { id: true },
  })
  if (existing) {
    cachedBotFatherId = existing.id
    return existing.id
  }

  const created = await prisma.user.create({
    data: {
      username: "BotFather",
      email: "botfather@vortex.system",
      // Пароль не используется — этот юзер никогда не логинится.
      // Храним длинный рандомный hex просто чтобы поле было непустым.
      password: randomBytes(32).toString("hex"),
      isBot: true,
      bio: "Создаю и настраиваю ботов для Vortex. /help — список команд.",
    },
    select: { id: true },
  })
  cachedBotFatherId = created.id
  return created.id
}

/**
 * Создаёт системного User-а для нового бота (вызывается в момент создания бота через BotFather).
 * Возвращает userId этого аккаунта.
 */
export async function createBotUser(botUsername: string, botName: string): Promise<number> {
  const created = await prisma.user.create({
    data: {
      username: botUsername,
      email: `${botUsername.toLowerCase()}@bot.vortex.system`,
      password: randomBytes(32).toString("hex"),
      isBot: true,
      bio: botName,
    },
    select: { id: true },
  })
  return created.id
}
