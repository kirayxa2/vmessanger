-- ════════════════════════════════════════════════════════════
-- ОТКАТ ПАРТИЦИОНИРОВАНИЯ (для деплоя на Render)
-- ════════════════════════════════════════════════════════════
-- Выполни это в Supabase SQL Editor

BEGIN;

-- 1. Вернуть старую таблицу Message
DROP TABLE IF EXISTS "Message" CASCADE;
ALTER TABLE "Message_old" RENAME TO "Message";

-- 2. Восстановить индексы
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx"
  ON "Message"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_senderId_idx"
  ON "Message"("senderId");
CREATE INDEX IF NOT EXISTS "Message_conversationId_idx"
  ON "Message"("conversationId");

-- 3. Восстановить Foreign Keys
ALTER TABLE "Message"
  ADD CONSTRAINT "Message_conversationId_fkey"
  FOREIGN KEY ("conversationId")
  REFERENCES "Conversation"(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_senderId_fkey"
  FOREIGN KEY ("senderId")
  REFERENCES "User"(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_receiverId_fkey"
  FOREIGN KEY ("receiverId")
  REFERENCES "User"(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_replyToId_fkey"
  FOREIGN KEY ("replyToId")
  REFERENCES "Message"(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Восстановить связи MessageRead и Reaction
ALTER TABLE "MessageRead" DROP CONSTRAINT IF EXISTS "MessageRead_messageId_fkey";
ALTER TABLE "MessageRead" DROP COLUMN IF EXISTS "messageCreatedAt";
ALTER TABLE "MessageRead"
  ADD CONSTRAINT "MessageRead_messageId_fkey"
  FOREIGN KEY ("messageId")
  REFERENCES "Message"(id)
  ON DELETE CASCADE;

ALTER TABLE "Reaction" DROP CONSTRAINT IF EXISTS "Reaction_messageId_fkey";
ALTER TABLE "Reaction" DROP COLUMN IF EXISTS "messageCreatedAt";
ALTER TABLE "Reaction"
  ADD CONSTRAINT "Reaction_messageId_fkey"
  FOREIGN KEY ("messageId")
  REFERENCES "Message"(id)
  ON DELETE CASCADE;

-- 5. Удалить партиции
DROP TABLE IF EXISTS "Message_2026_q2" CASCADE;
DROP TABLE IF EXISTS "Message_2026_q3" CASCADE;
DROP TABLE IF EXISTS "Message_2026_q4" CASCADE;
DROP TABLE IF EXISTS "Message_2027_q1" CASCADE;
DROP TABLE IF EXISTS "Message_2027_q2" CASCADE;
DROP TABLE IF EXISTS "Message_before_2026_q2" CASCADE;

COMMIT;

-- Проверка
SELECT COUNT(*) FROM "Message";
