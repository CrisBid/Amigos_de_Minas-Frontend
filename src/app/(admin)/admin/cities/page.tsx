'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Edit, Trash2, MapPin, Building2, Map, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { apiPath, apiFetch, apiJson, createApiClient } from '@/lib/api';

type City = { 
  id: string; 
  publicId: number; 
  name: string; 
  state?: string | null; 
  createdAt: string; 
  updatedAt: string 
};

type PageResp = { 
  items: City[]; 
  total: number; 
  page: number; 
  pageSize: number; 
  pages: number 
};

export default function AdminCitiesPage() {
  const { data: session, status } = useSession()
  const token = (session as any)?.accessToken ?? null; // vem do seu NextAuth

  const [data, setData] = useState<PageResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const normalize = (raw: any): PageResp => {
    const items: City[] = Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw)
      ? raw
      : [];
    const total = typeof raw?.total === 'number' ? raw.total : items.length;
    const pages = typeof raw?.pages === 'number' ? raw.pages : Math.max(1, Math.ceil(total / pageSize));
    const currentPage = typeof raw?.page === 'number' ? raw.page : page;
    return { items, total, page: currentPage, pageSize, pages };
  };

  const load = async () => {
    setLoading(true);
    try {
      const url = new URL(apiPath('/cities'));
      url.searchParams.set('q', q);
      url.searchParams.set('page', String(page));
      url.searchParams.set('pageSize', String(pageSize));

      const res = await apiFetch(
        url.toString(), 
        {
          cache: 'no-store',
          credentials: 'include',
          headers: { accept: 'application/json' },
        }, 
        token
      );

      if (!res.ok) {
        setData({ items: [], total: 0, page: 1, pageSize, pages: 1 });
      } else {
        const json = await res.json();
        setData(normalize(json));
      }
    } catch {
      setData({ items: [], total: 0, page: 1, pageSize, pages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, page]);

  const rows: City[] = Array.isArray(data?.items) ? data.items : [];
  const noRows = !loading && rows.length === 0;

  const headerStats = useMemo(() => {
    const total = typeof data?.total === 'number' ? data.total : rows.length;
    const states = new Set(rows.filter(c => c.state).map(c => c.state)).size;
    const withoutState = rows.filter(c => !c.state).length;
    return { total, states, withoutState };
  }, [data?.total, rows]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Cidades dos Amigos de Minas
              </h1>
              <p className="text-gray-600 text-lg">
                Gerencie as cidades onde as crianças estão localizadas
              </p>
            </div>
            <CreateCityButton onCreated={load} />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total de Cidades</p>
                <p className="text-3xl font-bold text-gray-900">{headerStats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Estados</p>
                <p className="text-3xl font-bold text-emerald-600">{headerStats.states}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Map className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Sem Estado</p>
                <p className="text-3xl font-bold text-amber-600">{headerStats.withoutState}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <MapPin className="w-6 h-6 text-amber-600" />
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
                placeholder="Buscar cidades por nome ou UF..."
                value={q}
                onChange={(e) => { setPage(1); setQ(e.target.value); }}
              />
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
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Cidade</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Estado</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-900">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <p className="text-gray-500 font-medium">Carregando cidades...</p>
                      </div>
                    </td>
                  </tr>
                )}
                
                {!loading && noRows && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-gray-100 rounded-full">
                          <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">Nenhuma cidade encontrada</p>
                        <p className="text-gray-400 text-sm">Tente ajustar a busca ou cadastrar uma nova cidade</p>
                      </div>
                    </td>
                  </tr>
                )}
                
                {rows.map((city) => (
                  <tr key={city.id} className="hover:bg-blue-50/50 transition-colors duration-150">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {city.publicId}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Building2 className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{city.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {city.state ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                          {city.state}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <EditCityButton city={city} onUpdated={load} />
                        <DeleteCityButton city={city} onDeleted={load} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
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
  const label = useMemo(() => `Página ${page} de ${pages}`, [page, pages]);

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
        <span className="text-gray-700 font-medium">{label}</span>
      </div>
      
      <button 
        className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 backdrop-blur-sm border border-white/20 rounded-xl text-gray-700 hover:bg-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duração-200"
        onClick={next} 
        disabled={page >= pages}
      >
        Próxima
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function CreateCityButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  
  return (
    <>
      <button 
        className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duração-200 transform hover:scale-105"
        onClick={() => setOpen(true)}
      >
        <Plus className="w-5 h-5" />
        Nova Cidade
      </button>
      {open && (
        <CityDialog 
          title="Nova Cidade" 
          onClose={() => setOpen(false)} 
          onSubmit={async (payload) => {
            const res = await fetch(apiPath('/cities'), { 
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json' }, 
              body: JSON.stringify(payload) 
            });
            if (!res.ok) { 
              alert(await res.text()); 
              return; 
            }
            setOpen(false); 
            onCreated();
          }} 
        />
      )}
    </>
  );
}

function EditCityButton({ city, onUpdated }: { city: City; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  
  return (
    <>
      <button 
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors duração-150"
        onClick={() => setOpen(true)}
      >
        <Edit className="w-4 h-4" />
        Editar
      </button>
      {open && (
        <CityDialog 
          title="Editar Cidade" 
          initial={city} 
          onClose={() => setOpen(false)} 
          onSubmit={async (payload) => {
            const res = await fetch(apiPath(`/cities/${city.id}`), { 
              method: 'PATCH',
              credentials: 'include',
              headers: { 'content-type': 'application/json' }, 
              body: JSON.stringify(payload) 
            });
            if (!res.ok) { 
              alert(await res.text()); 
              return; 
            }
            setOpen(false); 
            onUpdated();
          }} 
        />
      )}
    </>
  );
}

function DeleteCityButton({ city, onDeleted }: { city: City; onDeleted: () => void }) {
  const del = async () => {
    if (!confirm(`Excluir a cidade "${city.name}"? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch(apiPath(`/cities/${city.id}`), { 
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) { 
      alert(await res.text()); 
      return; 
    }
    onDeleted();
  };
  
  return (
    <button 
      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 transition-colors duração-150"
      onClick={del}
    >
      <Trash2 className="w-4 h-4" />
      Excluir
    </button>
  );
}

function CityDialog({
  title, 
  initial, 
  onClose, 
  onSubmit,
}: {
  title: string;
  initial?: Partial<City>;
  onClose: () => void;
  onSubmit: (payload: { publicId?: number; name: string; state?: string }) => Promise<void>;
}) {
  const [publicId, setPublicId] = useState<number | ''>(initial?.publicId ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [state, setState] = useState(initial?.state ?? '');

  const submit = async () => {
    if (name.trim().length < 2) { 
      alert('Nome deve ter pelo menos 2 caracteres'); 
      return; 
    }
    const payload: any = { name: name.trim() };
    if (state) payload.state = state.trim().toUpperCase();
    if (publicId !== '') payload.publicId = Number(publicId);
    await onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
              <p className="text-gray-600 mt-1">Preencha os dados da cidade</p>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors duração-150"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="px-6 py-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">ID Público (Opcional)</label>
              <input 
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duração-200"
                type="number" 
                min={1} 
                value={publicId} 
                onChange={(e) => setPublicId(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Deixe em branco para gerar automaticamente"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Nome da Cidade *</label>
              <input 
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duração-200"
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
                placeholder="Ex: São Paulo"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Estado (UF)</label>
              <input 
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duração-200"
                maxLength={10} 
                placeholder="MG" 
                value={state ?? ''} 
                onChange={(e) => setState(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-3xl">
          <div className="flex justify-end gap-3">
            <button 
              className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-semibold transition-all duração-200"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button 
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duração-200 transform hover:scale-105"
              onClick={submit}
            >
              Salvar Cidade
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
