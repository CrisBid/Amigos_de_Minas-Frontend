import type { ReactNode } from "react";
import AdminTopNav from "@/components/Admin/AdminTopNav";
import AdminSubNav from "@/components/Admin/AdminSubNav";

// Dica: se usa NextAuth, você pode proteger /admin via middleware.ts
// export const dynamic = "force-dynamic"; // se precisar evitar cache em SSR

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 rounded-2xl max-w-7xl mx-auto">
      {/* Top Tabs */}
      <AdminTopNav />
      {/* Sub Tabs (aparecem quando a aba ativa possui children) */}
      <AdminSubNav />

      {/* Conteúdo */}
      <main className="mx-auto max-w-7xl px-3 py-6">
        {children}
      </main>
    </div>
  );
}
