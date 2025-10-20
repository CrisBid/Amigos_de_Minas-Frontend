'use client';

import Link from 'next/link';
import { FileSpreadsheet, Users, Baby, ArrowRight } from 'lucide-react';

export default function ExportsHubPage() {
  const cards = [
    {
      href: '/admin/exports/sponsorships', // ajuste se sua pasta base diferir
      title: 'Exportar Apadrinhamentos',
      desc:
        'Gere planilhas com dados de criança, padrinho e localização. Abas inteligentes por cidade, comunidade ou padrinho.',
      icon: <Users className="w-6 h-6" />,
      badge: 'Excel (.xlsx)',
    },
    {
      href: '/admin/exports/children',
      title: 'Exportar Crianças',
      desc:
        'Exporte crianças apadrinhadas, sem apadrinhamento ou todas. Abas por cidade, comunidade ou escola.',
      icon: <Baby className="w-6 h-6" />,
      badge: 'Excel (.xlsx)',
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Exports</h1>
          <p className="text-sm text-gray-600">
            Centralize os relatórios em Excel para apadrinhamentos e crianças.
          </p>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {cards.map((c) => (
          <Link
            key={c.title}
            href={c.href}
            className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-4">
              <div className="shrink-0 rounded-xl bg-emerald-50 p-3 text-emerald-700">
                {c.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-900">{c.title}</h2>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                    {c.badge}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{c.desc}</p>

                <div className="mt-4 inline-flex items-center gap-2 text-emerald-700 group-hover:text-emerald-800">
                  <span className="text-sm font-medium">Abrir</span>
                  <ArrowRight className="w-4 h-4 translate-x-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Ajuda / notas rápidas */}
      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-600">
          Dica: se precisar, você pode filtrar por cidade, comunidade, padrinho ou uma seleção
          específica de IDs diretamente nas telas de exportação.
        </p>
      </div>
    </div>
  );
}
