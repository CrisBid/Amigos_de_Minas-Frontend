import type { ReactNode } from "react";
import AdminTopNav from "@/components/Admin/AdminTopNav";
import AdminSubNav from "@/components/Admin/AdminSubNav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    // margens negativas: anulam o espaçamento do <main> do site, que já tem o seu próprio aqui
    <div className="-mx-4 sm:-mx-6 -my-6 sm:-my-10 min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* gruda logo abaixo do cabeçalho do site (h-16), em vez de ficar escondida atrás dele */}
      <div className="sticky top-16 z-40 backdrop-blur-xl bg-white/85 border-b border-gray-200/60 shadow-sm">
        <AdminTopNav />
        <AdminSubNav />
      </div>

      <main className="relative pb-8">
        {children}
      </main>
    </div>
  );
}
