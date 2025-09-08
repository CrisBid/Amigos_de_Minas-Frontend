"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_ROUTES } from "@/config/adminNav";

export default function AdminSubNav() {
  const pathname = usePathname();

  // encontra a rota principal ativa
  const activeRoute = ADMIN_ROUTES.find((r) => {
    if (r.exact) return pathname === r.href;
    return pathname === r.href || pathname.startsWith(r.href + "/");
  });

  if (!activeRoute?.children?.length) return null;

  return (
    <div className="w-full border-b bg-gray-50/60">
      <div className="mx-auto max-w-7xl px-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
          {activeRoute.children.map((c) => {
            const active =
              pathname === c.href ||
              (c.href.includes("?")
                ? pathname === c.href.split("?")[0]
                : pathname.startsWith(c.href + "/"));

            return (
              <Link
                key={c.href}
                href={c.href}
                className={[
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition",
                  active
                    ? "bg-gray-900 text-white"
                    : "hover:bg-white text-gray-700",
                ].join(" ")}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
