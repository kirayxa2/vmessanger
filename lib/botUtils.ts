import crypto from "crypto"

/** Генерирует токен в формате {id}:{secret} */
export function generateBotToken(botId: number): string {
  const secret = crypto.randomBytes(24).toString("base64url")
  return `${botId}:${secret}`
}

/** Извлекает id бота из токена */
export function parseBotToken(token: string): { botId: number } | null {
  const [idStr] = token.split(":")
  const botId = parseInt(idStr)
  if (isNaN(botId)) return null
  return { botId }
}

/** Форматирует Update для отправки вебхуку */
export function buildUpdate(type: string, payload: object, updateId: number) {
  return { update_id: updateId, [type]: payload }
}

/** Отправляет update на webhook URL бота */
export async function dispatchWebhook(
  webhookUrl: string,
  update: object,
  secret?: string | null
) {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (secret) headers["X-Vortex-Bot-Secret"] = secret
    await fetch(webhookUrl, { method: "POST", headers, body: JSON.stringify(update) })
  } catch (e) {
    console.error("[Bot webhook] dispatch error:", e)
  }
}

/** Форматирует объект бота для ответа API (без токена) */
export function formatBot(bot: {
  id: number
  username: string
  name: string
  description?: string | null
  about?: string | null
  avatarUrl?: string | null
  isActive: boolean
  commands?: { command: string; description: string }[]
}) {
  return {
    id: bot.id,
    is_bot: true,
    username: bot.username,
    first_name: bot.name,
    description: bot.description,
    about: bot.about,
    avatar_url: bot.avatarUrl,
    is_active: bot.isActive,
    commands: bot.commands ?? [],
  }
}
