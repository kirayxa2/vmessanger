/**
 * Создаёт (или обновляет пароль) первого администратора организации
 * из переменных окружения ADMIN_LOGIN и ADMIN_PASSWORD.
 *
 * Использование:
 *   ADMIN_LOGIN=admin ADMIN_PASSWORD=supersecret npx tsx prisma/seed-admin.ts
 * или добавьте ADMIN_LOGIN/ADMIN_PASSWORD в .env и запустите:
 *   npm run seed:admin
 */
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const login = process.env.ADMIN_LOGIN?.trim()
  const password = process.env.ADMIN_PASSWORD

  if (!login || !password) {
    console.error("❌ Укажите ADMIN_LOGIN и ADMIN_PASSWORD в переменных окружения (или в .env)")
    process.exit(1)
  }
  if (password.length < 8) {
    console.error("❌ ADMIN_PASSWORD должен быть не короче 8 символов")
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const admin = await prisma.admin.upsert({
    where: { login },
    update: { passwordHash, isActive: true },
    create: { login, passwordHash, fullName: "Администратор" },
  })

  console.log(`✅ Администратор "${admin.login}" готов (id: ${admin.id}).`)
  console.log(`   Вход: /admin/login`)
}

main()
  .catch((e) => {
    console.error("Ошибка seed-скрипта:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
