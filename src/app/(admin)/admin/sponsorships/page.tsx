'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Filter, Heart, Users, Clock, UserCheck, Calendar, Trash2, ChevronLeft, ChevronRight, ExternalLink, User } from 'lucide-react';

type SponsorshipStatus = 'PENDING' | 'ACTIVE' | 'ENDED' | 'CANCELLED';

type ChildLite = { id: string; publicId?: number | null; name: string };
type SponsorLite = { id: string; name: string; email?: string | null };
type CampaignLite = { id: string; name: string; slug: string; year?: number | null };

type Sponsorship = {
  id: string;
  status: SponsorshipStatus;
  startDate?: string | null;
  endDate?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  child?: ChildLite | null;
  sponsor?: SponsorLite | null;
  campaign?: CampaignLite | null;
};

type PageResp<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

const PAGE_SIZE = 20;
const STATUS_OPTS: SponsorshipStatus[] = ['PENDING', 'ACTIVE', 'ENDED', 'CANCELLED'];

export default function AdminSponsorshipsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | SponsorshipStatus>('');
  const [campaignId, setCampaignId] = useState<string>('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PageResp<Sponsorship> | null>(null);
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignLite[]>([]);

  // Carrega campanhas para o filtro
  useEffect(() => {
    (async () => {
      try {
        const url = new URL('/api/admin/campaigns', window.location.origin);
        url.searchParams.set('page', '1');
        url.searchParams.set('pageSize', '200');
        const r = await fetch(url.toString(), { cache: 'no-store' });
        if (!r.ok) return;
        const raw = await r.json();
        const items: CampaignLite[] = Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw)
          ? raw
          : [];
        setCampaigns(items);
      } catch {}
    })();
  }, []);

  function normalize(raw: any): PageResp<Sponsorship> {
    const items: Sponsorship[] = Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw)
      ? raw
      : [];
    const total = typeof raw?.total === 'number' ? raw.total : items.length;
    const pages = typeof raw?.pages === 'number' ? raw.pages : Math.max(1, Math.ceil(total / PAGE_SIZE));
    return { items, total, page, pageSize: PAGE_SIZE, pages };
  }

  const load = async () => {
    setLoading(true);
    try {
      const url = new URL('/api/admin/sponsorships', window.location.origin);
      url.searchParams.set('page', String(page));
      url.searchParams.set('pageSize', String(PAGE_SIZE));
      if (q.trim()) url.searchParams.set('q', q.trim());
      if (status) url.searchParams.set('status', status);
      if (campaignId) url.searchParams.set('campaignId', campaignId);

      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) {
        setData({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE, pages: 1 });
      } else {
        const json = await res.json();
        setData(normalize(json));
      }
    } catch {
      setData({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE, pages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, campaignId, page]);

  const rows: Sponsorship[] = Array.isArray(data?.items) ? (data!.items as Sponsorship[]) : [];
  const noRows = !loading && rows.length === 0;

  const headerStats = useMemo(() => {
    const total = typeof data?.total === 'number' ? data.total : rows.length;
    const pending = rows.filter(r => r.status === 'PENDING').length;
    const active = rows.filter(r => r.status === 'ACTIVE').length;
    const ended = rows.filter(r => r.status === 'ENDED').length;
    const cancelled = rows.filter(r => r.status === 'CANCELLED').length;
    return { total, pending, active, ended, cancelled };
  }, [data?.total, rows]);

  const fmtDate = (s?: string | null) => {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
  };

  const getStatusConfig = (s: SponsorshipStatus) => {
    switch (s) {
      case 'ACTIVE':
        return { 
          label: 'Ativo', 
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500'
        };
      case 'PENDING':
        return { 
          label: 'Pendente', 
          className: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500'
        };
      case 'ENDED':
        return { 
          label: 'Encerrado', 
          className: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-500'
        };
      case 'CANCELLED':
        return { 
          label: 'Cancelado', 
          className: 'bg-red-50 text-red-700 border-red-200',
          dot: 'bg-red-500'
        };
      default:
        return { 
          label: '—', 
          className: 'bg-gray-50 text-gray-600 border-gray-200',
          dot: 'bg-gray-500'
        };
    }
  };

  const StatusBadge = ({ status }: { status: SponsorshipStatus }) => {
    const config = getStatusConfig(status);
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${config.className}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></div>
        {config.label}
      </span>
    );
  };

  async function changeStatus(id: string, newStatus: SponsorshipStatus) {
    const r = await fetch(`/api/admin/sponsorships/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!r.ok) return alert('Falha ao alterar status.');
    load();
  }

  async function del(id: string) {
    if (!confirm('Excluir apadrinhamento? Esta ação não pode ser desfeita.')) return;
    const r = await fetch(`/api/admin/sponsorships/${id}`, { method: 'DELETE' });
    if (!r.ok) return alert('Falha ao excluir.');
    load();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Apadrinhamentos dos Amigos de Minas
              </h1>
              <p className="text-gray-600 text-lg">
                Acompanhe e gerencie os vínculos entre padrinhos e crianças
              </p>
            </div>
            {/* Espaço para botões futuros como importar/exportar */}
            <div className="flex gap-3">
              <div className="text-sm text-gray-500 px-4 py-2 bg-white/50 rounded-xl border border-white/20">
                Funcionalidades extras em breve
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total</p>
                <p className="text-3xl font-bold text-gray-900">{headerStats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Heart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Apadrinhamentos Ativos</p>
                <p className="text-3xl font-bold text-emerald-600">{headerStats.active}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <UserCheck className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Pendentes</p>
                <p className="text-3xl font-bold text-amber-600">{headerStats.pending}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Encerrados</p>
                <p className="text-3xl font-bold text-blue-600">{headerStats.ended}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                placeholder="Buscar por criança ou padrinho..."
                value={q}
                onChange={(e) => { setPage(1); setQ(e.target.value); }}
              />
            </div>
            <div className="relative lg:w-48">
              <Filter className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <select
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 appearance-none cursor-pointer"
                value={status}
                onChange={(e) => { setPage(1); setStatus(e.target.value as SponsorshipStatus | ''); }}
              >
                <option value="">Todos os status</option>
                <option value="ACTIVE">Ativo</option>
                <option value="PENDING">Pendente</option>
                <option value="ENDED">Encerrado</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>
            <div className="relative lg:w-64">
              <Calendar className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <select
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 appearance-none cursor-pointer"
                value={campaignId}
                onChange={(e) => { setPage(1); setCampaignId(e.target.value); }}
              >
                <option value="">Todas as campanhas</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.year ? ` (${c.year})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Criança</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Padrinho</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Campanha</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Início</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Fim</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-900">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <p className="text-gray-500 font-medium">Carregando apadrinhamentos...</p>
                      </div>
                    </td>
                  </tr>
                )}
                
                {!loading && noRows && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-gray-100 rounded-full">
                          <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">Nenhum apadrinhamento encontrado</p>
                        <p className="text-gray-400 text-sm">Tente ajustar os filtros de busca</p>
                      </div>
                    </td>
                  </tr>
                )}
                
                {rows.map((sponsorship) => (
                  <tr key={sponsorship.id} className="hover:bg-blue-50/50 transition-colors duration-150">
                    <td className="px-6 py-4">
                      {sponsorship.child ? (
                        <a 
                          href={`/admin/children/${sponsorship.child.id}`} 
                          className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                        >
                          <div className="p-2 bg-pink-100 rounded-lg">
                            <User className="w-4 h-4 text-pink-600" />
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-gray-900">
                              {sponsorship.child.name}
                            </span>
                            <div className="text-xs text-gray-500">
                              ID: #{sponsorship.child.publicId ?? '—'}
                            </div>
                          </div>
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    
                    <td className="px-6 py-4">
                      {sponsorship.sponsor ? (
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <UserCheck className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-gray-900">
                              {sponsorship.sponsor.name}
                            </span>
                            {sponsorship.sponsor.email && (
                              <div className="text-xs text-gray-500">
                                {sponsorship.sponsor.email}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    
                    <td className="px-6 py-4">
                      {sponsorship.campaign ? (
                        <a 
                          href={`/admin/campaigns/${sponsorship.campaign.id}`}
                          className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              {sponsorship.campaign.name}
                            </span>
                            {sponsorship.campaign.year && (
                              <div className="text-xs text-gray-500">
                                {sponsorship.campaign.year}
                              </div>
                            )}
                          </div>
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    
                    <td className="px-6 py-4">
                      <StatusBadge status={sponsorship.status} />
                    </td>
                    
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {fmtDate(sponsorship.startDate)}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {fmtDate(sponsorship.endDate)}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          className="px-3 py-1.5 text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors duration-150 cursor-pointer appearance-none"
                          value={sponsorship.status}
                          onChange={(e) => changeStatus(sponsorship.id, e.target.value as SponsorshipStatus)}
                          title="Alterar status"
                        >
                          <option value="PENDING">Pendente</option>
                          <option value="ACTIVE">Ativo</option>
                          <option value="ENDED">Encerrado</option>
                          <option value="CANCELLED">Cancelado</option>
                        </select>
                        <button 
                          onClick={() => del(sponsorship.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 transition-colors duration-150"
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {data && (data.pages ?? 1) > 1 && (
          <div className="mt-8">
            <Pagination page={data.page} pages={data.pages} onChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}

function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  const prev = () => onChange(Math.max(1, page - 1));
  const next = () => onChange(Math.min(pages, page + 1));
  
  return (
    <div className="flex items-center justify-center gap-4">
      <button 
        className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 backdrop-blur-sm border border-white/20 rounded-xl text-gray-700 hover:bg-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        onClick={prev} 
        disabled={page <= 1}
      >
        <ChevronLeft className="w-4 h-4" />
        Anterior
      </button>
      
      <div className="bg-white/70 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20 shadow-lg">
        <span className="text-gray-700 font-medium">
          Página {page} de {pages}
        </span>
      </div>
      
      <button 
        className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 backdrop-blur-sm border border-white/20 rounded-xl text-gray-700 hover:bg-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        onClick={next} 
        disabled={page >= pages}
      >
        Próxima
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}