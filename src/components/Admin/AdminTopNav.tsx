"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_ROUTES, AdminRoute } from "@/config/adminNav";

function isActive(pathname: string, route: AdminRoute) {
  if (route.exact) return pathname === route.href;
  return pathname === route.href || pathname.startsWith(route.href + "/");
}

export default function AdminTopNav() {
  const pathname = usePathname();

  return (
    <div className="w-full border-b bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/40">
      <div className="mx-auto max-w-7xl px-3">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2">
          {ADMIN_ROUTES.map((r) => {
            const active = isActive(pathname, r);
            return (
              <Link
                key={r.href}
                href={r.href}
                className={[
                  "whitespace-nowrap rounded-full px-4 py-2 text-sm transition",
                  active
                    ? "bg-black text-white"
                    : "hover:bg-gray-100 text-gray-700",
                ].join(" ")}
              >
                {r.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
