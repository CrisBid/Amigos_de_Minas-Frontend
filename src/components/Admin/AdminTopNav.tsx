"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_ROUTES, AdminRoute } from "@/config/adminNav";
import { Settings, Users, Calendar, BarChart3, Home } from "lucide-react";

// Mapeamento de ícones para as rotas (ajuste conforme suas rotas)
const ROUTE_ICONS: Record<string, any> = {
  "/admin": Home,
  "/admin/campaigns": Calendar,
  "/admin/users": Users,
  "/admin/analytics": BarChart3,
  "/admin/settings": Settings,
};

function isActive(pathname: string, route: AdminRoute) {
  if (route.exact) return pathname === route.href;
  return pathname === route.href || pathname.startsWith(route.href + "/");
}

export default function AdminTopNav() {
  const pathname = usePathname();

  return (
    <div className="w-full">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          {/* Brand/Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">AM</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-sm text-gray-600">Amigos de Minas</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2">
            {ADMIN_ROUTES.map((route) => {
              const active = isActive(pathname, route);
              const Icon = ROUTE_ICONS[route.href] || Settings;
              
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={[
                    "group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
                      : "text-gray-700 hover:text-gray-900 hover:bg-white/80 hover:shadow-md hover:scale-105"
                  ].join(" ")}
                >
                  <Icon className="w-4 h-4" />
                  <span className="whitespace-nowrap">{route.label}</span>
                  
                  {/* Active indicator */}
                  {active && (
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full opacity-80"></div>
                  )}
                </Link>
              );
            })}
          </div>

          {/* User Menu (opcional) */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
              <span className="text-gray-700 text-sm font-medium">U</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}