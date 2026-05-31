// Утилиты для текстовой разметки сообщений (Telegram-style markdown)
// Маркеры: **жирный**  __курсив__  ~~зачёркнутый~~  `моно`  ```блок```  ||спойлер||  [текст](url)

// Убираем markdown-маркеры — для коротких превью (ответы, список чатов, уведомления)
export function stripFormatting(text: string): string {
  if (!text) return text
  return text
    .replace(/```([\s\S]+?)```/g, "$1")
    .replace(/`([^`\n]+?)`/g, "$1")
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/~~([\s\S]+?)~~/g, "$1")
    .replace(/\|\|([\s\S]+?)\|\|/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/\[([^\]\n]+?)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
}
