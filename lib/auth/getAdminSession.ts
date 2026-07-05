import { getServerSession } from "next-auth"
import { adminAuthOptions } from "@/lib/auth/adminAuthOptions"

/**
 * Возвращает сессию администратора на сервере (Server Component / Route Handler).
 * null — если не залогинен как админ.
 */
export async function getAdminSession() {
  const session = await getServerSession(adminAuthOptions)
  if (!session?.user || (session.user as any).role !== "admin") return null
  return session
}
