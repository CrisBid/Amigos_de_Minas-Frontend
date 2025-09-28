'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Edit, Trash2, Calendar, Users, TrendingUp, Filter, ChevronLeft, ChevronRight, X } from 'lucide-react';

type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'FINISHED' | 'ARCHIVED';

type Campaign = {
  id: string;
  publicId?: number | null;
  name: string;
  slug: string;
  year?: number | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: CampaignStatus;
  frameKey?: string | null;
  frameUrl?: string | null;
  frameConfig?: any;
  createdAt: string;
  updatedAt: string;
};

type PageResp = {
  items: Campaign[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

const PAGE_SIZE = 20;
const STATUS_OPTIONS: CampaignStatus[] = ['DRAFT', 'ACTIVE', 'FINISHED', 'ARCHIVED'];

export default function AdminCampaignsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | CampaignStatus>('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);

  function normalize(raw: any): PageResp {
    const items: Campaign[] = Array.isArray(raw?.items)
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
      const url = new URL('/api/admin/campaigns', window.location.origin);
      url.searchParams.set('page', String(page));
      url.searchParams.set('pageSize', String(PAGE_SIZE));
      if (q.trim()) url.searchParams.set('q', q.trim());
      if (status) url.searchParams.set('status', status);

      const res = await fetch(url.toString(), { cache: 'no-store', credentials: 'include' });
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
  }, [q, status, page]);

  const rows: Campaign[] = Array.isArray(data?.items) ? (data!.items as Campaign[]) : [];
  const noRows = !loading && rows.length === 0;

  const headerStats = useMemo(() => {
    const total = typeof data?.total === 'number' ? data.total : rows.length;
    const active = rows.filter((c) => c.status === 'ACTIVE').length;
    const finished = rows.filter((c) => c.status === 'FINISHED').length;
    const draft = rows.filter((c) => c.status === 'DRAFT').length;
    return { total, active, finished, draft };
  }, [data?.total, rows]);

  const fmtDate = (s?: string | null) => {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
  };

  const getStatusConfig = (s: CampaignStatus) => {
    switch (s) {
      case 'ACTIVE':
        return { label: 'Ativa', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
      case 'DRAFT':
        return { label: 'Rascunho', className: 'bg-slate-50 text-slate-700 border-slate-200', dot: 'bg-slate-500' };
      case 'FINISHED':
        return { label: 'Finalizada', className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' };
      case 'ARCHIVED':
        return { label: 'Arquivada', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
      default:
        return { label: '—', className: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-500' };
    }
  };

  const StatusBadge = ({ status }: { status: CampaignStatus }) => {
    const config = getStatusConfig(status);
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${config.className}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></div>
        {config.label}
      </span>
    );
  };

  async function changeStatus(id: string, newStatus: CampaignStatus) {
    const res = await fetch(`/api/admin/campaigns/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      alert('Falha ao alterar status.');
      return;
    }
    load();
  }

  async function deleteCampaign(id: string, name: string) {
    if (!confirm(`Excluir campanha "${name}"? Essa ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/admin/campaigns/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) {
      alert('Falha ao excluir.');
      return;
    }
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
                Campanhas dos Amigos de Minas
              </h1>
              <p className="text-gray-600 text-lg">
                Gerencie todas as campanhas e molduras do seu site
              </p>
            </div>
            <button 
              onClick={() => setOpenCreate(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              Nova Campanha
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total de Campanhas</p>
                <p className="text-3xl font-bold text-gray-900">{headerStats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Campanhas Ativas</p>
                <p className="text-3xl font-bold text-emerald-600">{headerStats.active}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Finalizadas</p>
                <p className="text-3xl font-bold text-blue-600">{headerStats.finished}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Rascunhos</p>
                <p className="text-3xl font-bold text-slate-600">{headerStats.draft}</p>
              </div>
              <div className="p-3 bg-slate-100 rounded-xl">
                <Edit className="w-6 h-6 text-slate-600" />
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
                placeholder="Buscar campanhas por nome ou slug..."
                value={q}
                onChange={(e) => { setPage(1); setQ(e.target.value); }}
              />
            </div>
            <div className="relative lg:w-64">
              <Filter className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <select
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 appearance-none cursor-pointer"
                value={status}
                onChange={(e) => { setPage(1); setStatus(e.target.value as any); }}
              >
                <option value="">Todos os status</option>
                <option value="ACTIVE">Ativas</option>
                <option value="DRAFT">Rascunhos</option>
                <option value="FINISHED">Finalizadas</option>
                <option value="ARCHIVED">Arquivadas</option>
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
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">#</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Campanha</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Slug</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Ano</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Período</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Status</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-900">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <p className="text-gray-500 font-medium">Carregando campanhas...</p>
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
                        <p className="text-gray-500 font-medium">Nenhuma campanha encontrada</p>
                        <p className="text-gray-400 text-sm">Tente ajustar os filtros ou criar uma nova campanha</p>
                      </div>
                    </td>
                  </tr>
                )}
                
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-blue-50/50 transition-colors duration-150">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {c.publicId ?? '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                        {c.description && (
                          <span className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                            {c.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-800">
                        {c.slug}
                      </code>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                      {c.year ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="flex flex-col gap-1">
                        <span>{fmtDate(c.startDate)}</span>
                        <span className="text-xs text-gray-400">até</span>
                        <span>{fmtDate(c.endDate)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <a 
                          href={`/admin/campaigns/${c.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors duration-150"
                        >
                          <Edit className="w-4 h-4" />
                          Editar
                        </a>
                        <StatusMenu current={c.status} onChange={(s) => changeStatus(c.id, s)} />
                        <button 
                          onClick={() => deleteCampaign(c.id, c.name)}
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

        {/* Create Dialog */}
        {openCreate && (
          <CreateCampaignDialog
            onClose={() => setOpenCreate(false)}
            onCreated={() => { setOpenCreate(false); load(); }}
          />
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

function StatusMenu({ current, onChange }: { current: CampaignStatus; onChange: (s: CampaignStatus) => void }) {
  return (
    <select
      className="px-3 py-1.5 text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors duration-150 cursor-pointer appearance-none"
      value={current}
      onChange={(e) => onChange(e.target.value as CampaignStatus)}
      title="Alterar status"
    >
      <option value="DRAFT">Rascunho</option>
      <option value="ACTIVE">Ativa</option>
      <option value="FINISHED">Finalizada</option>
      <option value="ARCHIVED">Arquivada</option>
    </select>
  );
}

function CreateCampaignDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [status, setStatus] = useState<CampaignStatus>('DRAFT');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [description, setDescription] = useState('');

  const submit = async () => {
    if (!name.trim() || !slug.trim()) {
      alert('Nome e Slug são obrigatórios.');
      return;
    }
    const payload: any = {
      name: name.trim(),
      slug: slug.trim(),
      status,
    };
    if (year !== '') payload.year = Number(year);
    if (startDate) payload.startDate = new Date(startDate).toISOString();
    if (endDate) payload.endDate = new Date(endDate).toISOString();
    if (description) payload.description = description.trim();

    const res = await fetch('/api/admin/campaigns', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      alert(`Falha ao criar: ${txt}`);
      return;
    }
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Nova Campanha</h2>
              <p className="text-gray-600 mt-1">Crie uma nova campanha para os Amigos de Minas</p>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors duration-150"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="px-6 py-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Nome da Campanha *</label>
              <input 
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Natal dos Amigos de Minas 2025"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Slug *</label>
              <input 
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                value={slug} 
                onChange={(e) => setSlug(e.target.value)}
                placeholder="natal-2025"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Ano</label>
              <input 
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                type="number" 
                value={year} 
                onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="2025"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Status</label>
              <select 
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 appearance-none cursor-pointer"
                value={status} 
                onChange={(e) => setStatus(e.target.value as CampaignStatus)}
              >
                <option value="DRAFT">Rascunho</option>
                <option value="ACTIVE">Ativa</option>
                <option value="FINISHED">Finalizada</option>
                <option value="ARCHIVED">Arquivada</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Data de Início</label>
              <input 
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Data de Fim</label>
              <input 
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Descrição</label>
            <textarea 
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 min-h-[100px] resize-none"
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva os objetivos e detalhes da campanha..."
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-3xl">
          <div className="flex justify-end gap-3">
            <button 
              className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-semibold transition-all duration-200"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button 
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              onClick={submit}
            >
              Criar Campanha
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
