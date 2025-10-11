'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Edit, Trash2, Upload, Users, Heart, Baby, MapPin, Gift, ChevronLeft, ChevronRight, Camera } from 'lucide-react';

type Sponsorship = {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'ENDED' | 'CANCELLED';
};

type City = { id: string; name: string; state?: string | null };

type ChildListItem = {
  id: string;
  publicId: number;
  name: string;
  birthDate?: string | null;
  age?: number | null;
  cityName?: string;
  city?: City | null;
  category?: string | null;
  wantedGift?: string | null;
  photoUrl?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  sponsorships?: Sponsorship[];
};

type PageResp = {
  items: ChildListItem[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

const PAGE_SIZE = 20;

export default function AdminChildrenPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ total: number; active: number; pending: number; available: number; sponsorshipRate: number }>({
    total: 0, active: 0, pending: 0, available: 0, sponsorshipRate: 0,
  });


  function normalize(raw: any): PageResp {
    const items: ChildListItem[] = Array.isArray(raw?.items)
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
      const url = new URL('/api/admin/children', window.location.origin);
      url.searchParams.set('page', String(page));
      url.searchParams.set('pageSize', String(PAGE_SIZE));
      if (q.trim()) url.searchParams.set('q', q.trim());

      const res = await fetch(url.toString(), {
        cache: 'no-store',
        credentials: 'include',
        headers: { accept: 'application/json' },
      });

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

  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/children/stats', {
        cache: 'no-store',
        credentials: 'include',
        headers: { accept: 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        setStats({
          total: json.total ?? 0,
          active: json.active ?? 0,
          pending: json.pending ?? 0,
          available: json.available ?? Math.max(0, (json.total ?? 0) - ((json.active ?? 0) + (json.pending ?? 0))),
          sponsorshipRate: json.sponsorshipRate ?? (json.total ? Math.round(((json.active ?? 0) / json.total) * 100) : 0),
        });
      } else {
        setStats({ total: 0, active: 0, pending: 0, available: 0, sponsorshipRate: 0 });
      }
    } catch {
      setStats({ total: 0, active: 0, pending: 0, available: 0, sponsorshipRate: 0 });
    }
  };


  useEffect(() => {
    load();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page]);

  const getStatusConfig = (s?: Sponsorship['status']) => {
    switch (s) {
      case 'ACTIVE':
        return {
          label: 'Apadrinhado',
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
        };
      case 'PENDING':
        return {
          label: 'Pendente',
          className: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500',
        };
      case 'ENDED':
        return {
          label: 'Encerrado',
          className: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-500',
        };
      case 'CANCELLED':
        return {
          label: 'Cancelado',
          className: 'bg-red-50 text-red-700 border-red-200',
          dot: 'bg-red-500',
        };
      default:
        return {
          label: 'Disponível',
          className: 'bg-slate-50 text-slate-700 border-slate-200',
          dot: 'bg-slate-500',
        };
    }
  };

  const StatusBadge = ({ status }: { status?: Sponsorship['status'] }) => {
    const config = getStatusConfig(status);
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${config.className}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></div>
        {config.label}
      </span>
    );
  };

  const calcAge = (birthDate?: string | null, fallback?: number | null) => {
    if (typeof fallback === 'number' && !isNaN(fallback)) return fallback;
    if (!birthDate) return undefined;
    const d = new Date(birthDate);
    if (isNaN(d.getTime())) return undefined;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
  };

  const latestStatus = (sps?: Sponsorship[]) => sps?.[0]?.status;

  const rows: ChildListItem[] = Array.isArray(data?.items) ? (data!.items as ChildListItem[]) : [];
  const noRows = !loading && rows.length === 0;

  const headerStats = stats;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Crianças dos Amigos de Minas
              </h1>
              <p className="text-gray-600 text-lg">
                Gerencie o cadastro das crianças e acompanhe os apadrinhamentos
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/admin/children/bulk" className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm hover:bg-white text-gray-700 px-6 py-3 rounded-xl font-semibold border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
                <Upload className="w-5 h-5" />
                Cadastro Guiado (colar tabela)
              </Link>
              <Link
                href="/admin/children/bulk"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                Nova Criança
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total de Crianças</p>
                <p className="text-3xl font-bold text-gray-900">{headerStats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Baby className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Apadrinhadas</p>
                <p className="text-3xl font-bold text-emerald-600">{headerStats.active}</p>
                <p className="text-xs text-gray-500 mt-1">{headerStats.sponsorshipRate}% do total</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Heart className="w-6 h-6 text-emerald-600" />
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
                <Users className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Disponíveis</p>
                <p className="text-3xl font-bold text-slate-600">{headerStats.available}</p>
              </div>
              <div className="p-3 bg-slate-100 rounded-xl">
                <Gift className="w-6 h-6 text-slate-600" />
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
                placeholder="Buscar crianças por nome, descrição..."
                value={q}
                onChange={(e) => { setPage(1); setQ(e.target.value); }}
              />
            </div>
            {/* Espaço para filtros futuros */}
            <div className="text-sm text-gray-500 flex items-center gap-2 px-3">
              <span>Filtros adicionais em breve</span>
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
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Foto</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Criança</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Idade</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Localização</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Categoria</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Presente Desejado</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Status</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-900">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <p className="text-gray-500 font-medium">Carregando crianças...</p>
                      </div>
                    </td>
                  </tr>
                )}
                
                {!loading && noRows && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-gray-100 rounded-full">
                          <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">Nenhuma criança encontrada</p>
                        <p className="text-gray-400 text-sm">Tente ajustar os filtros ou cadastrar uma nova criança</p>
                      </div>
                    </td>
                  </tr>
                )}
                
                {rows.map((child) => {
                  const age = calcAge(child.birthDate ?? undefined, child.age ?? undefined);
                  const status = latestStatus(child.sponsorships);
                  const cityDisplay = child.city?.name 
                    ? `${child.city.name}${child.city.state ? `/${child.city.state}` : ''}` 
                    : (child.cityName || '—');

                  return (
                    <tr key={child.id} className="hover:bg-blue-50/50 transition-colors duration-150">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {child.publicId}
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shadow-sm">
                          {child.photoUrl ? (
                            <img
                              src={child.photoUrl}
                              alt={child.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Camera className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-900">{child.name}</span>
                          {child.description && (
                            <span className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                              {child.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {age !== undefined ? (
                          <span className="text-sm font-medium text-gray-900">
                            {age} {age === 1 ? 'ano' : 'anos'}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span className="text-sm text-gray-600">{cityDisplay}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {child.category ? (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                            {child.category}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {child.wantedGift ? (
                          <div className="flex items-center gap-1.5 w-32">
                            <Gift className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-600 truncate">{child.wantedGift}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/children/${child.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors duration-150"
                          >
                            <Edit className="w-4 h-4" />
                            Editar
                          </Link>
                          <DeleteChildButton id={child.id} name={child.name} onDone={load} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

function DeleteChildButton({ id, name, onDone }: { id: string; name: string; onDone: () => void }) {
  const del = async () => {
    if (!confirm(`Excluir (soft) "${name}"? Essa ação pode ser revertida.`)) return;
    const res = await fetch(`/api/admin/children/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deletedAt: new Date().toISOString() }),
    });
    if (!res.ok) {
      alert('Falha ao excluir.');
      return;
    }
    onDone();
  };
  
  return (
    <button
      onClick={del}
      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 transition-colors duration-150"
    >
      <Trash2 className="w-4 h-4" />
      Excluir
    </button>
  );
}
