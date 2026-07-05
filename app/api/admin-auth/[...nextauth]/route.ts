import NextAuth from "next-auth"
import { adminAuthOptions } from "@/lib/auth/adminAuthOptions"

const handler = NextAuth(adminAuthOptions)

export { handler as GET, handler as POST }
