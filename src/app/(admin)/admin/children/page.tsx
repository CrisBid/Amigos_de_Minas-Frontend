'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

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

  // --- FIX: normalizador de resposta ---
  function normalize(raw: any): PageResp {
    const items: ChildListItem[] = Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw)
      ? raw
      : [];

    const total =
      typeof raw?.total === 'number'
        ? raw.total
        : items.length;

    const pages =
      typeof raw?.pages === 'number'
        ? raw.pages
        : Math.max(1, Math.ceil(total / PAGE_SIZE));

    return { items, total, page, pageSize: PAGE_SIZE, pages };
  }

  const load = async () => {
    setLoading(true);
    try {
      const url = new URL('/api/admin/children', window.location.origin);
      url.searchParams.set('page', String(page));
      url.searchParams.set('pageSize', String(PAGE_SIZE));
      if (q.trim()) url.searchParams.set('q', q.trim());

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
  }, [q, page]);

  const statusBadge = (s?: Sponsorship['status']) => {
    if (!s) return <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">—</span>;
    const base = 'text-xs px-2 py-1 rounded';
    switch (s) {
      case 'ACTIVE':
        return <span className={`${base} bg-green-100 text-green-700`}>Ativo</span>;
      case 'PENDING':
        return <span className={`${base} bg-amber-100 text-amber-700`}>Pendente</span>;
      case 'ENDED':
        return <span className={`${base} bg-blue-100 text-blue-700`}>Encerrado</span>;
      case 'CANCELLED':
        return <span className={`${base} bg-red-100 text-red-700`}>Cancelado</span>;
      default:
        return <span className={`${base} bg-gray-100 text-gray-600`}>—</span>;
    }
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

  // --- FIX: sempre trabalhar com um array seguro ---
  const rows: ChildListItem[] = Array.isArray(data?.items) ? (data!.items as ChildListItem[]) : [];

  const headerStats = useMemo(() => {
    const total = typeof data?.total === 'number' ? data.total : rows.length;
    const active = rows.filter(i => latestStatus(i.sponsorships) === 'ACTIVE').length;
    return { total, active };
  }, [data?.total, rows]);

  const noRows = !loading && rows.length === 0;

  return (
    <div className="space-y-6">
      {/* Top actions */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Crianças</h1>
          <p className="text-sm text-gray-600">Gerencie o cadastro de crianças e o status de apadrinhamento.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/children/import" className="border px-3 py-2 rounded hover:bg-white">Importar CSV</Link>
          <Link href="/admin/children/new" className="bg-black text-white px-3 py-2 rounded">+ Nova Criança</Link>
        </div>
      </div>

      {/* Quick KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-lg font-semibold">{headerStats.total}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-gray-500">% Apadrinhadas (ativas)</div>
          <div className="text-lg font-semibold">
            {headerStats.total ? Math.round((headerStats.active / headerStats.total) * 100) : 0}%
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-2">
        <input
          className="border rounded px-3 py-2 w-full md:w-96"
          placeholder="Buscar por nome/descrição"
          value={q}
          onChange={(e) => { setPage(1); setQ(e.target.value); }}
        />
        {/* filtros futuros: campanha, cidade, categoria, status */}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">Foto</th>
              <th className="text-left px-3 py-2">Nome</th>
              <th className="text-left px-3 py-2">Idade</th>
              <th className="text-left px-3 py-2">Cidade</th>
              <th className="text-left px-3 py-2">Categoria</th>
              <th className="text-left px-3 py-2">Presente</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-500">Carregando…</td></tr>
            )}
            {noRows && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-500">Nenhum registro.</td></tr>
            )}
            {rows.map((c) => {
              const age = calcAge(c.birthDate ?? undefined, c.age ?? undefined);
              const status = latestStatus(c.sponsorships);
              return (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2">{c.publicId}</td>
                  <td className="px-3 py-2">
                    <img
                      src={c.photoUrl || '/placeholder.png'}
                      alt={c.name}
                      className="w-12 h-12 rounded object-cover bg-gray-100"
                    />
                  </td>
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2">{age ?? '—'}</td>
                  <td className="px-3 py-2">
                    {c.city?.name ? `${c.city.name}${c.city.state ? `/${c.city.state}` : ''}` : (c.cityName || '—')}
                  </td>
                  <td className="px-3 py-2">{c.category || '—'}</td>
                  <td className="px-3 py-2">{c.wantedGift || '—'}</td>
                  <td className="px-3 py-2">{statusBadge(status)}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/admin/children/${c.id}`} className="border px-2 py-1 rounded mr-2 hover:bg-gray-50">
                      Editar
                    </Link>
                    <DeleteChildButton id={c.id} name={c.name} onDone={load} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && (data.pages ?? 1) > 1 && (
        <Pagination page={data.page} pages={data.pages} onChange={setPage} />
      )}
    </div>
  );
}

function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  const prev = () => onChange(Math.max(1, page - 1));
  const next = () => onChange(Math.min(pages, page + 1));
  return (
    <div className="flex items-center gap-2">
      <button className="border px-3 py-1 rounded" onClick={prev} disabled={page <= 1}>Anterior</button>
      <span className="text-gray-600">Página {page} de {pages}</span>
      <button className="border px-3 py-1 rounded" onClick={next} disabled={page >= pages}>Próxima</button>
    </div>
  );
}

function DeleteChildButton({ id, name, onDone }: { id: string; name: string; onDone: () => void }) {
  const del = async () => {
    if (!confirm(`Excluir (soft) "${name}"?`)) return;
    const res = await fetch(`/api/admin/children/${id}`, {
      method: 'PATCH',
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
    <button onClick={del} className="border px-2 py-1 rounded hover:bg-gray-50">
      Excluir
    </button>
  );
}
