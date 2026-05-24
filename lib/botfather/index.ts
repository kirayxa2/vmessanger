import { prisma } from "@/lib/prisma"
import { generateBotToken, formatBot } from "@/lib/botUtils"

type BFState = { step: string; data: Record<string, unknown> }

const HELP_TEXT = `🤖 *BotFather* — управление ботами Vortex

/newbot — создать нового бота
/mybots — список твоих ботов
/setname — изменить имя бота
/setdescription — изменить описание
/setabout — изменить раздел "О боте"
/setcommands — задать команды бота
/deletebot — удалить бота
/token — получить токен бота
/help — это сообщение`

// ── State helpers ──────────────────────────────────────────────

async function getState(userId: number): Promise<BFState> {
  const s = await prisma.botFatherSession.findUnique({ where: { userId } })
  return (s?.data as BFState) ?? { step: "idle", data: {} }
}

async function setState(userId: number, step: string, data: Record<string, unknown>) {
  await prisma.botFatherSession.upsert({
    where: { userId },
    update: { step, data: { step, data } },
    create: { userId, step, data: { step, data } },
  })
}

async function clearState(userId: number) {
  await setState(userId, "idle", {})
}

function reply(text: string, replyMarkup?: object) {
  return [{ text, replyMarkup }]
}

// ── Main entry ─────────────────────────────────────────────────

export async function processBotFatherMessage(
  userId: number,
  text: string,
  conversationId: number
): Promise<{ text: string; replyMarkup?: object }[]> {
  const trimmed = text.trim()
  const state = await getState(userId)

  // Если мы в шаге ввода текста и это не команда — передаём в handleStep
  const inputSteps = ["newbot_name", "newbot_username", "setname_input", "setdesc_input", "setabout_input", "setcmds_input"]
  if (inputSteps.includes(state.step) && !trimmed.startsWith("/")) {
    return handleStep(state, trimmed, userId)
  }

  if (!trimmed.startsWith("/")) {
    return reply("Не понял. /help — список команд.")
  }

  const cmd = trimmed.split(" ")[0].toLowerCase().replace("@botfather", "")
  return handleCommand(cmd, userId)
}

// ── Commands ───────────────────────────────────────────────────

async function handleCommand(cmd: string, userId: number): Promise<{ text: string; replyMarkup?: object }[]> {
  switch (cmd) {
    case "/start":
    case "/help":
      await clearState(userId)
      return reply(HELP_TEXT)

    case "/newbot":
      await setState(userId, "newbot_name", {})
      return reply("Как будет называться бот? (отображаемое имя, например: *My Awesome Bot*)")

    case "/mybots": {
      await clearState(userId)
      const bots = await prisma.bot.findMany({ where: { ownerId: userId }, include: { commands: true } })
      if (!bots.length) return reply("У тебя пока нет ботов. /newbot — создать первого.")
      const inline_keyboard = bots.map(b => [{ text: `🤖 @${b.username}`, callback_data: `bot_menu:${b.id}` }])
      return reply("Твои боты:", { inline_keyboard })
    }

    case "/token": {
      const bots = await prisma.bot.findMany({ where: { ownerId: userId } })
      if (!bots.length) return reply("Нет ботов. /newbot — создать.")
      const inline_keyboard = bots.map(b => [{ text: `@${b.username}`, callback_data: `token:${b.id}` }])
      return reply("Выбери бота:", { inline_keyboard })
    }

    case "/setname": {
      const bots = await prisma.bot.findMany({ where: { ownerId: userId } })
      if (!bots.length) return reply("Нет ботов.")
      const inline_keyboard = bots.map(b => [{ text: `@${b.username}`, callback_data: `setname:${b.id}` }])
      return reply("Выбери бота:", { inline_keyboard })
    }

    case "/setdescription": {
      const bots = await prisma.bot.findMany({ where: { ownerId: userId } })
      if (!bots.length) return reply("Нет ботов.")
      const inline_keyboard = bots.map(b => [{ text: `@${b.username}`, callback_data: `setdesc:${b.id}` }])
      return reply("Выбери бота:", { inline_keyboard })
    }

    case "/setabout": {
      const bots = await prisma.bot.findMany({ where: { ownerId: userId } })
      if (!bots.length) return reply("Нет ботов.")
      const inline_keyboard = bots.map(b => [{ text: `@${b.username}`, callback_data: `setabout:${b.id}` }])
      return reply("Выбери бота:", { inline_keyboard })
    }

    case "/setcommands": {
      const bots = await prisma.bot.findMany({ where: { ownerId: userId } })
      if (!bots.length) return reply("Нет ботов.")
      const inline_keyboard = bots.map(b => [{ text: `@${b.username}`, callback_data: `setcmds:${b.id}` }])
      return reply("Выбери бота:", { inline_keyboard })
    }

    case "/deletebot": {
      const bots = await prisma.bot.findMany({ where: { ownerId: userId } })
      if (!bots.length) return reply("Нет ботов.")
      const inline_keyboard = bots.map(b => [{ text: `⚠️ @${b.username}`, callback_data: `deletebot:${b.id}` }])
      return reply("Выбери бота для удаления:", { inline_keyboard })
    }

    default:
      return reply("Неизвестная команда. /help — список команд.")
  }
}

// ── Step input ─────────────────────────────────────────────────

async function handleStep(state: BFState, text: string, userId: number): Promise<{ text: string; replyMarkup?: object }[]> {
  switch (state.step) {
    case "newbot_name":
      await setState(userId, "newbot_username", { name: text })
      return reply(`Хорошо! Теперь придумай username.\n\nДолжен заканчиваться на *bot*, например: *myawesomebot*\nТолько латиница, цифры и _`)

    case "newbot_username": {
      const name = state.data.name as string
      const username = text.toLowerCase().replace(/[^a-z0-9_]/g, "")
      if (!username.endsWith("bot")) return reply("Username должен заканчиваться на *bot*. Попробуй ещё раз:")
      const exists = await prisma.bot.findUnique({ where: { username } })
      if (exists) return reply(`@${username} уже занят. Придумай другой:`)

      const bot = await prisma.bot.create({ data: { token: `tmp_${Date.now()}`, username, name, ownerId: userId } })
      const token = generateBotToken(bot.id)
      await prisma.bot.update({ where: { id: bot.id }, data: { token } })
      await clearState(userId)

      return reply(`✅ Бот создан!\n\n🤖 *${name}*\n@${username}\n\n🔑 Токен:\n\`${token}\`\n\nBot API: \`POST /api/bot/{token}/{method}\``)
    }

    case "setname_input": {
      await prisma.bot.update({ where: { id: state.data.botId as number }, data: { name: text } })
      await clearState(userId)
      return reply(`✅ Имя обновлено: *${text}*`)
    }

    case "setdesc_input": {
      await prisma.bot.update({ where: { id: state.data.botId as number }, data: { description: text } })
      await clearState(userId)
      return reply("✅ Описание обновлено.")
    }

    case "setabout_input": {
      await prisma.bot.update({ where: { id: state.data.botId as number }, data: { about: text } })
      await clearState(userId)
      return reply('✅ Раздел "О боте" обновлён.')
    }

    case "setcmds_input": {
      const botId = state.data.botId as number
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean)
      const commands: { command: string; description: string }[] = []
      for (const line of lines) {
        const m = line.match(/^\/?([\w]+)\s*[-—–]\s*(.+)$/)
        if (m) commands.push({ command: m[1].toLowerCase(), description: m[2].trim() })
      }
      if (!commands.length) return reply("Не удалось распознать команды. Формат:\n`/command — описание`")
      await prisma.botCommand.deleteMany({ where: { botId } })
      await prisma.botCommand.createMany({ data: commands.map(c => ({ ...c, botId })) })
      await clearState(userId)
      return reply(`✅ Команды сохранены:\n${commands.map(c => `/${c.command} — ${c.description}`).join("\n")}`)
    }

    default:
      return reply("Не понял. /help — список команд.")
  }
}

// ── Callback buttons ───────────────────────────────────────────

export async function processBotFatherCallback(
  userId: number,
  callbackData: string
): Promise<{ text: string; replyMarkup?: object } | null> {
  const [action, idStr] = callbackData.split(":")
  const botId = parseInt(idStr)
  const bot = await prisma.bot.findFirst({ where: { id: botId, ownerId: userId }, include: { commands: true } })

  if (action === "bot_menu" && bot) {
    return {
      text: `🤖 @${bot.username} — *${bot.name}*\n\nОписание: ${bot.description ?? "—"}\nКоманд: ${bot.commands.length}`,
      replyMarkup: {
        inline_keyboard: [
          [{ text: "🔑 Токен", callback_data: `token:${bot.id}` }],
          [{ text: "✏️ Имя", callback_data: `setname:${bot.id}` }, { text: "📝 Описание", callback_data: `setdesc:${bot.id}` }],
          [{ text: "📋 Команды", callback_data: `setcmds:${bot.id}` }],
          [{ text: "🗑 Удалить", callback_data: `deletebot:${bot.id}` }],
        ],
      },
    }
  }

  if (action === "token" && bot) {
    await clearState(userId)
    return { text: `🔑 Токен @${bot.username}:\n\`${bot.token}\`` }
  }

  if (action === "setname" && bot) {
    await setState(userId, "setname_input", { botId })
    return { text: `Пришли новое имя для @${bot.username}:` }
  }

  if (action === "setdesc" && bot) {
    await setState(userId, "setdesc_input", { botId })
    return { text: `Пришли новое описание для @${bot.username}:` }
  }

  if (action === "setabout" && bot) {
    await setState(userId, "setabout_input", { botId })
    return { text: `Пришли текст "О боте" для @${bot.username}:` }
  }

  if (action === "setcmds" && bot) {
    await setState(userId, "setcmds_input", { botId })
    return { text: `Команды для @${bot.username} в формате:\n\`/command — описание\`\nкаждая с новой строки:` }
  }

  if (action === "deletebot" && bot) {
    return {
      text: `⚠️ Удалить @${bot.username}? Это нельзя отменить.`,
      replyMarkup: {
        inline_keyboard: [[
          { text: "✅ Да", callback_data: `deletebot_confirm:${bot.id}` },
          { text: "❌ Отмена", callback_data: `deletebot_cancel:${bot.id}` },
        ]],
      },
    }
  }

  if (action === "deletebot_confirm" && bot) {
    await prisma.bot.delete({ where: { id: bot.id } })
    await clearState(userId)
    return { text: `🗑 Бот @${bot.username} удалён.` }
  }

  if (action === "deletebot_cancel") {
    await clearState(userId)
    return { text: "Отмена. Бот не удалён." }
  }

  return null
}
