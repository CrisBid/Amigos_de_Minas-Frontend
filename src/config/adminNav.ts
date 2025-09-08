// src/config/adminNav.ts
export type AdminRoute = {
  label: string;
  href: string;        // rota base
  exact?: boolean;     // se true, só ativa quando igual; senão, startsWith
  children?: { label: string; href: string }[];
};

export const ADMIN_ROUTES: AdminRoute[] = [
  {
    label: "Dashboard",
    href: "/admin",
    exact: true,
  },
  {
    label: "Crianças",
    href: "/admin/children",
    children: [
      { label: "Listagem", href: "/admin/children" },
      { label: "Cadastrar", href: "/admin/children/new" },
      { label: "Importação CSV", href: "/admin/children/import" },
    ],
  },
  {
    label: "Campanhas",
    href: "/admin/campaigns",
    children: [
      { label: "Todas", href: "/admin/campaigns" },
      { label: "Nova", href: "/admin/campaigns/new" },
      { label: "Molduras", href: "/admin/campaigns/frames" },
    ],
  },
  {
    label: "Apadrinhamentos",
    href: "/admin/sponsorships",
    children: [
      { label: "Pendentes", href: "/admin/sponsorships?status=PENDING" },
      { label: "Ativos", href: "/admin/sponsorships?status=ACTIVE" },
      { label: "Encerrados", href: "/admin/sponsorships?status=ENDED" },
    ],
  },
  {
    label: "Cidades",
    href: "/admin/cities",
    children: [
      { label: "Listagem", href: "/admin/cities" },
      { label: "Nova", href: "/admin/cities/new" },
    ],
  },
];

export const Backup_ADMIN_ROUTES: AdminRoute[] = [
  {
    label: "Dashboard",
    href: "/admin",
    exact: true,
  },
  {
    label: "Crianças",
    href: "/admin/children",
    children: [
      { label: "Listagem", href: "/admin/children" },
      { label: "Cadastrar", href: "/admin/children/new" },
      { label: "Importação CSV", href: "/admin/children/import" },
    ],
  },
  {
    label: "Campanhas",
    href: "/admin/campaigns",
    children: [
      { label: "Todas", href: "/admin/campaigns" },
      { label: "Nova", href: "/admin/campaigns/new" },
      { label: "Molduras", href: "/admin/campaigns/frames" },
    ],
  },
  {
    label: "Apadrinhamentos",
    href: "/admin/sponsorships",
    children: [
      { label: "Pendentes", href: "/admin/sponsorships?status=PENDING" },
      { label: "Ativos", href: "/admin/sponsorships?status=ACTIVE" },
      { label: "Encerrados", href: "/admin/sponsorships?status=ENDED" },
    ],
  },
  {
    label: "Padrinhos",
    href: "/admin/sponsors",
  },
  {
    label: "Cidades",
    href: "/admin/cities",
    children: [
      { label: "Listagem", href: "/admin/cities" },
      { label: "Nova", href: "/admin/cities/new" },
    ],
  },
  {
    label: "Mídias",
    href: "/admin/media",
  },
  {
    label: "Configurações",
    href: "/admin/settings",
  },
];
