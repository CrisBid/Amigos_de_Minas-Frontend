import type { ReactNode } from "react";
import AdminTopNav from "@/components/Admin/AdminTopNav";
import AdminSubNav from "@/components/Admin/AdminSubNav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Navigation Container */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-white/20 shadow-sm">
        {/* Top Navigation */}
        <AdminTopNav />
        {/* Sub Navigation */}
        <AdminSubNav />
      </div>

      {/* Main Content */}
      <main className="relative">
        {children}
      </main>
    </div>
  );
}