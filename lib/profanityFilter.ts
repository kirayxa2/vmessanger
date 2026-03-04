// lib/profanityFilter.ts
// Анти-мат фильтр — заменяет маты на звёздочки

const RU_MATS: string[] = [
  "блять", "блядь", "блядина", "блядский", "блядство",
  "пизда", "пиздец", "пиздить", "пиздёж", "пиздатый", "пиздобол", "пиздюк", "пиздануть", "пиздёнка",
  "хуй", "хуйня", "хуёво", "хуйло", "хуёвый", "нахуй", "похуй", "похуист", "охуеть", "охуел", "охуенно",
  "ебать", "ёбать", "ёбаный", "ебаный", "ебал", "ёбнуть", "ебнуть",
  "выебать", "проебать", "наебать", "заебать", "доебать", "въебать", "наёбывать",
  "долбоёб", "долбоеб", "еблан", "ёблан", "уёбок", "уебок", "уёбище",
  "мудак", "мудила", "мудило",
  "сука", "суки",
  "шлюха", "шлюшка", "курва",
  "залупа", "манда",
  "говно", "говняный", "говнюк",
  "жопа", "жопой", "жопу",
  "срать", "насрать",
  "ёпта", "нахрен", "нахер",
  "сволочь",
  "иди нахуй", "иди нахер", "пошёл нахуй", "пошел нахуй",
]

const EN_MATS: string[] = [
  "fuck", "fucker", "fucking", "fucked", "motherfucker",
  "shit", "shitty", "bullshit",
  "bitch", "bitches",
  "asshole", "bastard",
  "cunt", "dick", "dickhead", "cock", "cocksucker",
  "pussy", "whore", "slut",
  "nigger", "nigga", "faggot",
  "prick", "twat", "wanker", "bollocks",
]

function buildPattern(): RegExp {
  // Сортируем по длине (длинные сначала — жадный матч)
  const ruSorted = [...RU_MATS].sort((a, b) => b.length - a.length)
  const enSorted = [...EN_MATS].sort((a, b) => b.length - a.length)

  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  const parts = [
    ...ruSorted.map(escape),
    ...enSorted.map(w => `\\b${escape(w)}\\b`),
  ]

  return new RegExp(parts.join("|"), "gi")
}

// Паттерн создаётся один раз при импорте модуля
const PATTERN = buildPattern()

export function filterProfanity(text: string): string {
  if (!text) return text
  PATTERN.lastIndex = 0
  return text.replace(PATTERN, match => "*".repeat(match.length))
}
