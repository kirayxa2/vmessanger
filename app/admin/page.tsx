import { redirect } from "next/navigation"
import { getAdminSession } from "@/lib/auth/getAdminSession"
import AdminDashboard from "./AdminDashboard"

export default async function AdminPage() {
  const session = await getAdminSession()
  if (!session) redirect("/admin/login")

  return <AdminDashboard adminName={(session.user as any).name || (session.user as any).login} />
}
