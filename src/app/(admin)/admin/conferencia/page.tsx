'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Percent,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  MapPin,
  Building2,
  RefreshCcw,
  Download
} from 'lucide-react';

/* ====== Tipos ====== */
type Totals = {
  total: number;
  active: number;
  pending: number;
  in_progress: number;
  available: number;
  sponsorshipRate: number;
};

type CityRow = {
  cityId: string;
  cityName: string;
  total: number;
  active: number;
  pending: number;
  in_progress: number;
  available: number;
  sponsorshipRate: number;
};

type CommunityRow = {
  communityId: string;
  communityName: string;
  cityId: string;
  cityName: string;
  total: number;
  active: number;
  pending: number;
  in_progress: number;
  available: number;
  sponsorshipRate: number;
};

type Overview = {
  general: Totals;
  byCity: CityRow[];
  byCommunity: CommunityRow[];
  generatedAt: string;
};

/* ====== Página ====== */
export default function ConferenciaStatsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [qCity, setQCity] = useState('');
  const [qComm, setQComm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // >>> usando o proxy do Next
      const res = await fetch(`/api/admin/children/stats/overview`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
        headers: { accept: 'application/json' },
      });
      const json = (await res.json()) as Overview;
      setData(json);
    } catch (e) {
      console.error(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCities = useMemo(() => {
    if (!data) return [];
    const q = qCity.trim().toLowerCase();
    return data.byCity.filter(r => !q || r.cityName.toLowerCase().includes(q));
  }, [data, qCity]);

  const filteredCommunities = useMemo(() => {
    if (!data) return [];
    const q = qComm.trim().toLowerCase();
    return data.byCommunity.filter(r =>
      !q ||
      r.communityName.toLowerCase().includes(q) ||
      r.cityName.toLowerCase().includes(q)
    );
  }, [data, qComm]);

  const exportCsv = () => {
    if (!data) return;

    const rowsCity = [
      ['Cidade','Total','Ativos','Pending','InProgress','Disponíveis','Taxa (%)'],
      ...data.byCity.map(r => [
        r.cityName, r.total, r.active, r.pending, r.in_progress, r.available, r.sponsorshipRate
      ]),
    ];
    const rowsComm = [
      ['Cidade','Comunidade','Total','Ativos','Pending','InProgress','Disponíveis','Taxa (%)'],
      ...data.byCommunity.map(r => [
        r.cityName, r.communityName, r.total, r.active, r.pending, r.in_progress, r.available, r.sponsorshipRate
      ]),
    ];

    const toCsv = (rows: (string|number)[][]) =>
      rows.map(cols => cols.map(v => {
        const s = String(v ?? '');
        return /[",;\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
      }).join(';')).join('\n');

    const blob = new Blob(
      [
        '### Geral\n',
        `Total;Ativos;Pending;InProgress;Disponíveis;Taxa (%)\n`,
        `${data.general.total};${data.general.active};${data.general.pending};${data.general.in_progress};${data.general.available};${data.general.sponsorshipRate}\n\n`,
        '### Por Cidade\n',
        toCsv(rowsCity),
        '\n\n### Por Comunidade\n',
        toCsv(rowsComm),
      ],
      { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'conferencia-estatisticas.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-fuchsia-50 to-rose-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Conferência — Estatísticas</h1>
            <p className="text-gray-600 text-lg">
              Painel de conferência com visão geral, por cidade e por comunidade
            </p>
            {!!data?.generatedAt && (
              <p className="text-gray-500 text-sm mt-1">
                Atualizado em {new Date(data.generatedAt).toLocaleString('pt-BR')}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              className="inline-flex items-center gap-2 px-4 py-3 bg-white/70 border border-white/20 rounded-xl text-gray-700 hover:bg-white hover:shadow-lg transition-all"
              onClick={fetchData}
              disabled={loading}
              title="Recarregar"
            >
              <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Recarregar
            </button>
            <button
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg transition-all transform hover:scale-105"
              onClick={exportCsv}
              disabled={!data}
              title="Exportar CSV"
            >
              <Download className="w-5 h-5" />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Geral */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Geral</h2>
          {(!data && loading) ? (
            <LoadingStrip />
          ) : data ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <StatCard title="Total de Crianças" value={data.general.total} icon={<Users className="w-6 h-6 text-indigo-600" />} />
                <StatCard title="Ativos (COMPLETED)" value={data.general.active} icon={<CheckCircle className="w-6 h-6 text-emerald-600" />} />
                <StatCard title="Aguardando (PENDING)" value={data.general.pending} icon={<Clock className="w-6 h-6 text-amber-600" />} />
                <StatCard title="Em andamento (IN_PROGRESS)" value={data.general.in_progress} icon={<AlertCircle className="w-6 h-6 text-rose-600" />} />
                <StatCard title="Taxa de Apadrinhamento" value={`${data.general.sponsorshipRate}%`} icon={<Percent className="w-6 h-6 text-fuchsia-600" />} />
              </div>
              <div className="mt-3 text-sm text-gray-700">
                Disponíveis para apadrinhamento: <strong>{data.general.available}</strong>
              </div>
            </>
          ) : (
            <EmptyBox label="Sem dados no momento" />
          )}
        </section>

        {/* Filtros — Por Cidade e Por Comunidade */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Buscar Cidade</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  placeholder="Ex: São João das Missões…"
                  value={qCity}
                  onChange={(e) => setQCity(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Buscar Comunidade/Cidade</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  placeholder="Ex: Sumaré II ou Itacarambi…"
                  value={qComm}
                  onChange={(e) => setQComm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabela: Por Cidade */}
        <section className="space-y-3 mb-8">
          <h2 className="text-lg font-semibold">Por Cidade</h2>
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <tr>
                    <Th>Cidade</Th>
                    <Th className="text-right">Total</Th>
                    <Th className="text-right">Ativos</Th>
                    <Th className="text-right">Pending</Th>
                    <Th className="text-right">In Prog.</Th>
                    <Th className="text-right">Disponíveis</Th>
                    <Th className="text-right">Taxa</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && <LoadingRow colSpan={7} label="Carregando cidades..." />}
                  {!loading && data && filteredCities.length === 0 && (
                    <EmptyRow colSpan={7} label="Nenhuma cidade encontrada" />
                  )}
                  {!loading && data && filteredCities.map((r) => (
                    <tr key={r.cityId} className="hover:bg-indigo-50/50 transition-colors">
                      <Td>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-700" />
                          <span className="font-semibold text-gray-900">{r.cityName}</span>
                        </div>
                      </Td>
                      <Td numeric>{r.total}</Td>
                      <Td numeric>{r.active}</Td>
                      <Td numeric>{r.pending}</Td>
                      <Td numeric>{r.in_progress}</Td>
                      <Td numeric>{r.available}</Td>
                      <Td numeric>{r.sponsorshipRate}%</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Tabela: Por Comunidade */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Por Comunidade</h2>
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <tr>
                    <Th>Cidade</Th>
                    <Th>Comunidade</Th>
                    <Th className="text-right">Total</Th>
                    <Th className="text-right">Ativos</Th>
                    <Th className="text-right">Pending</Th>
                    <Th className="text-right">In Prog.</Th>
                    <Th className="text-right">Disponíveis</Th>
                    <Th className="text-right">Taxa</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && <LoadingRow colSpan={8} label="Carregando comunidades..." />}
                  {!loading && data && filteredCommunities.length === 0 && (
                    <EmptyRow colSpan={8} label="Nenhuma comunidade encontrada" />
                  )}
                  {!loading && data && filteredCommunities.map((r) => (
                    <tr key={r.communityId} className="hover:bg-indigo-50/50 transition-colors">
                      <Td>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-700" />
                          <span className="font-semibold text-gray-900">{r.cityName}</span>
                        </div>
                      </Td>
                      <Td>{r.communityName}</Td>
                      <Td numeric>{r.total}</Td>
                      <Td numeric>{r.active}</Td>
                      <Td numeric>{r.pending}</Td>
                      <Td numeric>{r.in_progress}</Td>
                      <Td numeric>{r.available}</Td>
                      <Td numeric>{r.sponsorshipRate}%</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ====== UI helpers (iguais ao seu estilo) ====== */
function Th({ children, className = '' }: { children: any; className?: string }) {
  return <th className={`text-left px-6 py-4 text-sm font-semibold text-gray-900 ${className}`}>{children}</th>;
}
function Td({ children, numeric = false, className = '' }: { children: any; numeric?: boolean; className?: string }) {
  return <td className={`px-6 py-4 text-sm ${numeric ? 'text-right' : ''} ${className}`}>{children}</td>;
}
function LoadingRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">{label}</p>
        </div>
      </td>
    </tr>
  );
}
function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="p-4 bg-gray-100 rounded-full">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">{label}</p>
          <p className="text-gray-400 text-sm">Tente ajustar os filtros</p>
        </div>
      </td>
    </tr>
  );
}
function EmptyBox({ label }: { label: string }) {
  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-8 text-center text-gray-600">
      {label}
    </div>
  );
}
function LoadingStrip() {
  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
      <div className="h-6 w-40 bg-gray-200 rounded mb-4 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 border border-white/20 shadow">
            <div className="h-4 w-24 bg-gray-200 rounded mb-3 animate-pulse" />
            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
function StatCard({ title, value, icon }: { title: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="p-3 bg-blue-100 rounded-xl">{icon}</div>
      </div>
    </div>
  );
}
