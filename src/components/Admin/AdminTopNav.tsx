"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ADMIN_ROUTES, AdminRoute } from "@/config/adminNav";
import { Settings, Users, Calendar, BarChart3, Home, Baby, Heart, LayoutGrid } from "lucide-react";
import NotificationBell from "./NotificationBell";

// Ícone de cada rota
const ROUTE_ICONS: Record<string, any> = {
  "/admin": Home,
  "/admin/children": Baby,
  "/admin/sponsorships": Heart,
  "/admin/campaigns": Calendar,
  "/admin/geral": LayoutGrid,
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
  const stripRef = useRef<HTMLDivElement | null>(null);

  // celular: as abas rolam de lado; mantém a aba atual à vista
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    el?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <div className="w-full">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-4 py-2 lg:py-4">
          {/* Marca (no celular só o selo, para sobrar espaço às abas) */}
          <Link href="/admin" className="flex items-center gap-3 shrink-0" title="Painel administrativo">
            <div className="w-9 h-9 lg:w-10 lg:h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-sm lg:text-lg">AM</span>
            </div>
            <div className="hidden xl:block">
              <p className="text-lg font-bold text-gray-900 leading-tight">Painel</p>
              <p className="text-xs text-gray-600">Amigos de Minas</p>
            </div>
          </Link>

          {/* Abas: rolam de lado no celular, cabem inteiras no computador */}
          <nav
            ref={stripRef}
            className="flex-1 min-w-0 flex items-center gap-1 lg:gap-2 overflow-x-auto no-scrollbar snap-x lg:justify-center"
            aria-label="Seções do painel"
          >
            {ADMIN_ROUTES.map((route) => {
              const active = isActive(pathname, route);
              const Icon = ROUTE_ICONS[route.href] || Settings;
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "snap-start shrink-0 flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
                      : "text-gray-700 hover:text-gray-900 hover:bg-white/80 hover:shadow-md",
                  ].join(" ")}
                >
                  <Icon className="w-4 h-4" />
                  <span className="whitespace-nowrap">{route.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Notificações (apadrinhamentos pendentes) */}
          <div className="shrink-0">
            <NotificationBell />
          </div>
        </div>
      </div>
    </div>
  );
}
