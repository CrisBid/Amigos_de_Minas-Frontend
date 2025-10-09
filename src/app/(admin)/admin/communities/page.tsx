'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Edit, Trash2, Users, Layers, MapPin, ChevronLeft, ChevronRight, X } from 'lucide-react';

/* ===================== Tipos ===================== */
type CityMin = { id: string; name: string; state?: string | null };
type Community = {
  id: string;
  publicId?: number | null;
  name: string;
  slug?: string | null;
  description?: string | null;
  cityId: string;
  city?: CityMin | null;
  cityName?: string | null;
  createdAt?: string; updatedAt?: string; deletedAt?: string | null;
};
type PageResp<T> = { items: T[]; total: number; page: number; pageSize: number; pages: number };

/* ===================== Helpers ===================== */
const pageSize = 20;
const normalize = <T,>(raw: any, p: number): PageResp<T> => {
  const items: T[] = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw)
    ? raw
    : [];
  const total = typeof raw?.total === 'number' ? raw.total : items.length;
  const pages = typeof raw?.pages === 'number' ? raw.pages : Math.max(1, Math.ceil(total / pageSize));
  const currentPage = typeof raw?.page === 'number' ? raw.page : p;
  return { items, total, page: currentPage, pageSize, pages };
};

/* ===================== Página ===================== */
export default function AdminCommunitiesPage() {
  const [data, setData] = useState<PageResp<Community> | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [cityId, setCityId] = useState<string>('');
  const [cities, setCities] = useState<CityMin[]>([]);

  const loadCities = async () => {
    const url = new URL('/api/admin/cities', window.location.origin);
    url.searchParams.set('page', '1');
    url.searchParams.set('pageSize', '1000');
    const res = await fetch(url.toString(), { credentials: 'include' });
    if (!res.ok) return setCities([]);
    const json = await res.json();
    const norm = normalize<CityMin>(json, 1);
    setCities(norm.items as any);
  };

  const load = async () => {
    setLoading(true);
    try {
      const url = new URL('/api/admin/communities', window.location.origin);
      if (q) url.searchParams.set('q', q);
      if (cityId) url.searchParams.set('cityId', cityId);
      url.searchParams.set('page', String(page));
      url.searchParams.set('pageSize', String(pageSize));
      const res = await fetch(url.toString(), {
        cache: 'no-store',
        credentials: 'include',
        headers: { accept: 'application/json' },
      });
      if (!res.ok) setData({ items: [], total: 0, page: 1, pageSize, pages: 1 });
      else setData(normalize<Community>(await res.json(), page));
    } catch {
      setData({ items: [], total: 0, page: 1, pageSize, pages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCities(); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, page, cityId]);

  const rows = data?.items ?? [];
  const headerStats = useMemo(() => {
    const total = data?.total ?? rows.length;
    const withDesc = rows.filter(r => !!r.description?.trim()).length;
    const slugs = rows.filter(r => !!r.slug?.trim()).length;
    return { total, withDesc, slugs };
  }, [data, rows]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Comunidades</h1>
            <p className="text-gray-600 text-lg">Gerencie as comunidades por cidade</p>
          </div>
          <CreateCommunityButton cities={cities} onCreated={load} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard title="Total de Comunidades" value={headerStats.total} icon={<Layers className="w-6 h-6 text-blue-600" />} />
          <StatCard title="Com Descrição" value={headerStats.withDesc} icon={<Users className="w-6 h-6 text-emerald-600" />} />
          <StatCard title="Com Slug" value={headerStats.slugs} icon={<MapPin className="w-6 h-6 text-amber-600" />} />
        </div>

        {/* Filtros */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="Buscar comunidades por nome/slug/descrição..."
                value={q}
                onChange={(e) => { setPage(1); setQ(e.target.value); }}
              />
            </div>
            <div className="w-full lg:w-80">
              <CitySelect cities={cities} value={cityId} onChange={(v) => { setPage(1); setCityId(v); }} />
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <Th>#</Th>
                  <Th>Comunidade</Th>
                  <Th>Cidade</Th>
                  <Th>Slug</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && <LoadingRow colSpan={5} label="Carregando comunidades..." />}
                {!loading && rows.length === 0 && <EmptyRow colSpan={5} label="Nenhuma comunidade encontrada" />}
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-blue-50/50 transition-colors">
                    <Td>{c.publicId ?? '—'}</Td>
                    <Td>
                      <div className="font-semibold text-gray-900">{c.name}</div>
                      {c.description && <div className="text-xs text-gray-500 line-clamp-1">{c.description}</div>}
                    </Td>
                    <Td>{c.city?.name ?? c.cityName ?? '—'}</Td>
                    <Td className="text-gray-700">{c.slug ?? '—'}</Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <EditCommunityButton cities={cities} community={c} onUpdated={load} />
                        <DeleteCommunityButton community={c} onDeleted={load} />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Paginação */}
        {data && data.pages > 1 && (
          <div className="mt-8">
            <Pagination page={data.page} pages={data.pages} onChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================== UI Miúdos ===================== */
function Th({ children, className = '' }: { children: any; className?: string }) {
  return <th className={`text-left px-6 py-4 text-sm font-semibold text-gray-900 ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: any; className?: string }) {
  return <td className={`px-6 py-4 text-sm ${className}`}>{children}</td>;
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
          <p className="text-gray-400 text-sm">Tente ajustar filtros ou cadastre um novo item</p>
        </div>
      </td>
    </tr>
  );
}
function StatCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
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
function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  const prev = () => onChange(Math.max(1, page - 1));
  const next = () => onChange(Math.min(pages, page + 1));
  const label = useMemo(() => `Página ${page} de ${pages}`, [page, pages]);
  return (
    <div className="flex items-center justify-center gap-4">
      <button className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 border border-white/20 rounded-xl text-gray-700 hover:bg-white hover:shadow-lg disabled:opacity-50 transition-all" onClick={prev} disabled={page <= 1}>
        <ChevronLeft className="w-4 h-4" /> Anterior
      </button>
      <div className="bg-white/70 px-4 py-2 rounded-xl border border-white/20 shadow-lg">
        <span className="text-gray-700 font-medium">{label}</span>
      </div>
      <button className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 border border-white/20 rounded-xl text-gray-700 hover:bg-white hover:shadow-lg disabled:opacity-50 transition-all" onClick={next} disabled={page >= pages}>
        Próxima <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ===================== Selects ===================== */
function CitySelect({ cities, value, onChange }: { cities: CityMin[]; value: string; onChange: (v: string) => void; }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-semibold text-gray-700">Cidade</label>
      <select
        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Todas</option>
        {cities.map(c => (
          <option key={c.id} value={c.id}>{c.name}{c.state ? ` (${c.state})` : ''}</option>
        ))}
      </select>
    </div>
  );
}

/* ===================== Dialogs: Comunidade ===================== */
function CreateCommunityButton({ cities, onCreated }: { cities: CityMin[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg transition-all transform hover:scale-105"
        onClick={() => setOpen(true)}
      >
        <Plus className="w-5 h-5" /> Nova Comunidade
      </button>
      {open && (
        <CommunityDialog
          title="Nova Comunidade"
          cities={cities}
          onClose={() => setOpen(false)}
          onSubmit={async (payload) => {
            const res = await fetch('/api/admin/communities', {
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payload),
            });
            if (!res.ok) { alert(await res.text()); return; }
            setOpen(false); onCreated();
          }}
        />
      )}
    </>
  );
}
function EditCommunityButton({ community, cities, onUpdated }: { community: Community; cities: CityMin[]; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200" onClick={() => setOpen(true)}>
        <Edit className="w-4 h-4" /> Editar
      </button>
      {open && (
        <CommunityDialog
          title="Editar Comunidade"
          cities={cities}
          initial={community}
          onClose={() => setOpen(false)}
          onSubmit={async (payload) => {
            const res = await fetch(`/api/admin/communities/${community.id}`, {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payload),
            });
            if (!res.ok) { alert(await res.text()); return; }
            setOpen(false); onUpdated();
          }}
        />
      )}
    </>
  );
}
function DeleteCommunityButton({ community, onDeleted }: { community: Community; onDeleted: () => void }) {
  const del = async () => {
    if (!confirm(`Excluir a comunidade "${community.name}"?`)) return;
    const res = await fetch(`/api/admin/communities/${community.id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) { alert(await res.text()); return; }
    onDeleted();
  };
  return (
    <button className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200" onClick={del}>
      <Trash2 className="w-4 h-4" /> Excluir
    </button>
  );
}
function CommunityDialog({
  title, initial, cities, onClose, onSubmit,
}: {
  title: string;
  initial?: Partial<Community>;
  cities: CityMin[];
  onClose: () => void;
  onSubmit: (payload: { publicId?: number; cityId: string; name: string; slug?: string; description?: string }) => Promise<void>;
}) {
  const [publicId, setPublicId] = useState<number | ''>(initial?.publicId ?? '');
  const [cityId, setCityId] = useState<string>(initial?.cityId ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');

  const submit = async () => {
    if (!cityId) { alert('Selecione a cidade'); return; }
    if (name.trim().length < 2) { alert('Nome deve ter pelo menos 2 caracteres'); return; }
    const payload: any = { cityId, name: name.trim() };
    if (slug) payload.slug = slug.trim();
    if (description) payload.description = description.trim();
    if (publicId !== '') payload.publicId = Number(publicId);
    await onSubmit(payload);
  };

  return (
    <Modal title={title} subtitle="Preencha os dados da comunidade" onClose={onClose} onConfirm={submit} confirmText="Salvar Comunidade">
      <div className="space-y-4">
        <Field label="ID Público (Opcional)">
          <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
            type="number" min={1} value={publicId} onChange={(e) => setPublicId(e.target.value === '' ? '' : Number(e.target.value))} />
        </Field>
        <Field label="Cidade *">
          <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={cityId} onChange={(e) => setCityId(e.target.value)}>
            <option value="">Selecione</option>
            {cities.map(c => (<option key={c.id} value={c.id}>{c.name}{c.state ? ` (${c.state})` : ''}</option>))}
          </select>
        </Field>
        <Field label="Nome *">
          <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Vila Esperança" />
        </Field>
        <Field label="Slug">
          <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={slug ?? ''} onChange={(e) => setSlug(e.target.value)} placeholder="ex: vila-esperanca" />
        </Field>
        <Field label="Descrição">
          <textarea className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" rows={3} value={description ?? ''} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/* ===================== Modal + Field ===================== */
function Modal({ title, subtitle, onClose, onConfirm, confirmText, children }: {
  title: string; subtitle?: string; onClose: () => void; onConfirm: () => void; confirmText: string; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
              {subtitle && <p className="text-gray-600 mt-1">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl">
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>
        <div className="px-6 py-6">{children}</div>
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-3xl">
          <div className="flex justify-end gap-3">
            <button className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-semibold" onClick={onClose}>Cancelar</button>
            <button className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 text-white rounded-xl font-semibold shadow-lg transform hover:scale-105"
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      {children}
    </div>
  );
}
