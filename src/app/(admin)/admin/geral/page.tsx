'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import {
  Building2,
  Landmark,
  GraduationCap,
  ChevronRight,
  User,
  ListCheck,
} from 'lucide-react';

export default function CadastrosGeraisPage() {
  // Atalhos de teclado: 1=cidades, 2=comunidades, 3=escolas
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (e.key === '1') window.location.href = '/admin/cities';
      if (e.key === '2') window.location.href = '/admin/communities';
      if (e.key === '3') window.location.href = '/admin/schools';
      if (e.key === '4') window.location.href = '/admin/users';
      if (e.key === '5') window.location.href = '/admin/conferencia';
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Cadastros Gerais</h1>
          <p className="text-gray-600 text-lg mt-1">
            Selecione um módulo para gerenciar as entidades do Amigos de Minas.
            <span className="ml-2 text-sm text-gray-500">(atalhos: 1, 2, 3)</span>
          </p>
        </div>

        {/* Grid de módulos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NavCard
            href="/admin/cities"
            icon={<Building2 className="w-6 h-6" />}
            title="Cidades"
            desc="Gerencie cidades e UFs onde as crianças estão localizadas."
            kbd="1"
            accent="from-blue-600 to-indigo-600"
          />

          <NavCard
            href="/admin/communities"
            icon={<Landmark className="w-6 h-6" />}
            title="Comunidades"
            desc="Organize comunidades dentro de cada cidade."
            kbd="2"
            accent="from-emerald-600 to-green-600"
          />

          <NavCard
            href="/admin/schools"
            icon={<GraduationCap className="w-6 h-6" />}
            title="Escolas"
            desc="Cadastre escolas e relacione com cidades e comunidades."
            kbd="3"
            accent="from-fuchsia-600 to-rose-600"
          />

          <NavCard
            href="/admin/users"
            icon={<User className="w-6 h-6" />}
            title="Usuarios"
            desc="Gerencie usuários do sistema e suas permissões."
            kbd="4"
            accent="from-fuchsia-600 to-rose-600"
          />

          <NavCard
            href="/admin/conferencia"
            icon={<ListCheck className="w-6 h-6" />}
            title="Conferencia"
            desc="Conferência de dados e estatísticas."
            kbd="5"
            accent="from-fuchsia-600 to-rose-600"
          />
        </div>

        {/* Dicas */}
        <div className="mt-10 bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Dicas rápidas</h2>
          <ul className="text-gray-700 list-disc ml-5 space-y-1">
            <li>Use a busca e os filtros em cada módulo para localizar registros rapidamente.</li>
            <li>
              Cidades &rarr; Comunidades &rarr; Escolas: mantenha essa hierarquia para evitar duplicidades.
            </li>
            <li>Atalhos: pressione <span className="px-1.5 py-0.5 rounded bg-gray-100 border text-xs">1</span> / <span className="px-1.5 py-0.5 rounded bg-gray-100 border text-xs">2</span> / <span className="px-1.5 py-0.5 rounded bg-gray-100 border text-xs">3</span> para navegar.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function NavCard({
  href,
  icon,
  title,
  desc,
  kbd,
  accent = 'from-blue-600 to-indigo-600',
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  kbd?: string;
  accent?: string; // gradient tailwind classes after "from-... to-..."
}) {
  return (
    <Link
      href={href}
      className="group relative block rounded-2xl bg-white/70 backdrop-blur-sm border border-white/20 shadow-lg hover:shadow-xl transition-all"
    >
      {/* Accent bar */}
      <div className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r ${accent}`} />

      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${accent} text-white`}>
            {icon}
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
        </div>

        <h3 className="mt-4 text-xl font-bold text-gray-900">{title}</h3>
        <p className="mt-1 text-gray-600">{desc}</p>

        <div className="mt-4 inline-flex items-center gap-2 text-sm text-gray-500">
          <span className="px-1.5 py-0.5 rounded bg-gray-100 border">{kbd}</span>
          <span>Acessar</span>
        </div>
      </div>
    </Link>
  );
}
