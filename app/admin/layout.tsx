// Общий лейаут для /admin/*. Проверка сессии намеренно НЕ делается здесь,
// иначе страница /admin/login тоже будет редиректить сама на себя (петля).
// Каждая защищённая страница сама вызывает getAdminSession() и делает redirect.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#0e1621", minHeight: "100vh" }}>{children}</div>
}
