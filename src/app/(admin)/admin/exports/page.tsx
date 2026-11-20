'use client';

import Link from 'next/link';
import {
  ArrowRight, Baby, FileSpreadsheet, FileText, Gift, HeartHandshake, History, Images, MapPin, ScanSearch, Store, Users,
} from 'lucide-react';

/* Central de exportações: atalhos prontos (já com o formato e a organização escolhidos) e as
   telas completas, onde dá para ajustar tudo. */

type Shortcut = { href: string; title: string; desc: string; icon: React.ReactNode; tag: string };

const q = (p: Record<string, string>) => `/admin/exports/sponsorships?${new URLSearchParams(p)}`;

const SPONSORSHIP_SHORTCUTS: Shortcut[] = [
  {
    href: q({ format: 'list', group: 'community', sort: 'id' }),
    title: 'Lista de presentes por comunidade',
    desc: 'Criança, idade, presente e padrinho, cada comunidade numa página, com resumo dos presentes e os padrinhos com contato no final.',
    icon: <Gift className="w-5 h-5" />,
    tag: 'PDF · lista',
  },
  {
    href: q({ format: 'cards', group: 'community', bySponsor: '1', sort: 'id' }),
    title: 'Cartões por comunidade, separados por padrinho',
    desc: 'Cada comunidade com a lista dela; depois cada padrinho com a lista e os cartões com foto das crianças dele; listagem geral no final.',
    icon: <HeartHandshake className="w-5 h-5" />,
    tag: 'PDF · fotos',
  },
  {
    href: q({ format: 'list', group: 'collectionPoint', sort: 'sponsor' }),
    title: 'Lista por ponto de coleta',
    desc: 'O que cada ponto de coleta vai receber: crianças, presentes e padrinhos, ordenados por padrinho.',
    icon: <Store className="w-5 h-5" />,
    tag: 'PDF · lista',
  },
  {
    href: q({ format: 'cards', group: 'collectionPoint', bySponsor: '1', sort: 'id' }),
    title: 'Cartões por ponto de coleta',
    desc: 'Os cartões com foto separados por ponto de coleta e, dentro dele, por padrinho.',
    icon: <MapPin className="w-5 h-5" />,
    tag: 'PDF · fotos',
  },
  {
    href: q({ format: 'cards', group: 'sponsor', sort: 'name' }),
    title: 'Cartões por padrinho',
    desc: 'Cada padrinho com a lista das crianças dele (e contato) e os cartões com foto.',
    icon: <Users className="w-5 h-5" />,
    tag: 'PDF · fotos',
  },
  {
    href: q({ format: 'excel', group: 'community', sort: 'id' }),
    title: 'Planilha de apadrinhamentos',
    desc: 'Uma aba por comunidade, aba de resumo dos presentes e aba dos padrinhos com contato.',
    icon: <FileSpreadsheet className="w-5 h-5" />,
    tag: 'Excel',
  },
];

function Card({ s }: { s: Shortcut }) {
  return (
    <Link href={s.href} className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-emerald-300 transition flex gap-3">
      <div className="shrink-0 rounded-xl bg-emerald-50 p-2.5 text-emerald-700 h-fit">{s.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">{s.title}</h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{s.tag}</span>
        </div>
        <p className="mt-1 text-xs text-gray-600">{s.desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-700 self-center shrink-0" />
    </Link>
  );
}

export default function ExportsHubPage() {
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <FileText className="w-5 h-5 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Exportações</h1>
          <p className="text-sm text-gray-600">Escolha um modelo pronto ou abra a tela completa para ajustar formato, filtros, organização e colunas.</p>
        </div>
      </div>

      {/* apadrinhamentos */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Apadrinhamentos</h2>
            <p className="text-xs text-gray-600">Todos podem incluir as crianças sem padrinho (opção na tela) e sair em ordem de ID, alfabética ou por padrinho.</p>
          </div>
          <Link href="/admin/exports/sponsorships" className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
            Montar do meu jeito <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {SPONSORSHIP_SHORTCUTS.map((s) => <Card key={s.title} s={s} />)}
        </div>
        <div className="grid gap-3 sm:grid-cols-3 text-xs text-gray-600">
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3"><b className="text-gray-800 inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Lista</b> — tabela para conferir e comprar: colunas à escolha, resumo dos presentes, padrinhos com contato.</div>
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3"><b className="text-gray-800 inline-flex items-center gap-1"><Images className="w-3.5 h-3.5" /> Cartões com foto</b> — a arte de cada criança, para entregar ao padrinho ou fixar no ponto de coleta.</div>
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3"><b className="text-gray-800 inline-flex items-center gap-1"><FileSpreadsheet className="w-3.5 h-3.5" /> Planilha</b> — para editar e filtrar no Excel ou no Google Planilhas.</div>
        </div>
      </section>

      {/* crianças e outros */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Crianças e cadastro</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Card s={{ href: '/admin/exports/children', title: 'Exportar crianças', desc: 'Apadrinhadas, sem padrinho ou todas, em Excel, com abas por cidade, comunidade ou escola.', icon: <Baby className="w-5 h-5" />, tag: 'Excel' }} />
          <Card s={{ href: '/admin/children/source-check', title: 'Conferir com a origem', desc: 'Compara a planilha e as fotos do Google com o site e baixa o CSV das diferenças.', icon: <ScanSearch className="w-5 h-5" />, tag: 'CSV' }} />
          <Card s={{ href: '/admin/audit', title: 'Histórico de alterações', desc: 'Quem mudou o quê e quando, com filtros, e exportação em CSV.', icon: <History className="w-5 h-5" />, tag: 'CSV' }} />
        </div>
      </section>
    </div>
  );
}
