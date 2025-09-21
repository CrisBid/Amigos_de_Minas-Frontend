"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_ROUTES } from "@/config/adminNav";
import { ChevronRight } from "lucide-react";

export default function AdminSubNav() {
  const pathname = usePathname();

  // Encontra a rota principal ativa
  const activeRoute = ADMIN_ROUTES.find((r) => {
    if (r.exact) return pathname === r.href;
    return pathname === r.href || pathname.startsWith(r.href + "/");
  });

  if (!activeRoute?.children?.length) return null;

  return (
    <div className="w-full border-t border-white/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-gray-600">{activeRoute.label}</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Submenu</span>
          </div>

          {/* Sub Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {activeRoute.children.map((subRoute, index) => {
              const active =
                pathname === subRoute.href ||
                (subRoute.href.includes("?")
                  ? pathname === subRoute.href.split("?")[0]
                  : pathname.startsWith(subRoute.href + "/"));

              return (
                <Link
                  key={subRoute.href}
                  href={subRoute.href}
                  className={[
                    "relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200",
                    active
                      ? "bg-white/90 text-gray-900 shadow-md border border-white/40"
                      : "text-gray-600 hover:text-gray-900 hover:bg-white/60 hover:shadow-sm"
                  ].join(" ")}
                >
                  <span>{subRoute.label}</span>
                  
                  {/* Active pill indicator */}
                  {active && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full opacity-80"></div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}