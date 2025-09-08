'use client';

import { useEffect, useMemo, useState } from 'react';

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
  }, [q, status, page]);

  const rows: Campaign[] = Array.isArray(data?.items) ? (data!.items as Campaign[]) : [];
  const noRows = !loading && rows.length === 0;

  const headerStats = useMemo(() => {
    const total = typeof data?.total === 'number' ? data.total : rows.length;
    const active = rows.filter((c) => c.status === 'ACTIVE').length;
    return { total, active };
  }, [data?.total, rows]);

  const fmtDate = (s?: string | null) => {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
  };

  const pill = (s: CampaignStatus) => {
    const base = 'text-xs px-2 py-1 rounded';
    switch (s) {
      case 'ACTIVE':
        return <span className={`${base} bg-green-100 text-green-700`}>Ativa</span>;
      case 'DRAFT':
        return <span className={`${base} bg-gray-200 text-gray-700`}>Rascunho</span>;
      case 'FINISHED':
        return <span className={`${base} bg-blue-100 text-blue-700`}>Finalizada</span>;
      case 'ARCHIVED':
        return <span className={`${base} bg-zinc-200 text-zinc-700`}>Arquivada</span>;
      default:
        return <span className={`${base} bg-gray-100 text-gray-600`}>—</span>;
    }
  };

  async function changeStatus(id: string, newStatus: CampaignStatus) {
    const res = await fetch(`/api/admin/campaigns/${id}`, {
      method: 'PATCH',
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
    const res = await fetch(`/api/admin/campaigns/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Falha ao excluir.');
      return;
    }
    load();
  }

  return (
    <div className="space-y-6">
      {/* Top actions */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Campanhas</h1>
          <p className="text-sm text-gray-600">Gerencie campanhas (nome, período, status, molduras).</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-black text-white px-3 py-2 rounded" onClick={() => setOpenCreate(true)}>
            + Nova Campanha
          </button>
        </div>
      </div>

      {/* Quick KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-lg font-semibold">{headerStats.total}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-gray-500">Ativas</div>
          <div className="text-lg font-semibold">{headerStats.active}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-2">
        <input
          className="border rounded px-3 py-2 w-full md:w-96"
          placeholder="Buscar por nome/slug"
          value={q}
          onChange={(e) => { setPage(1); setQ(e.target.value); }}
        />
        <select
          className="border rounded px-3 py-2 w-full md:w-56"
          value={status}
          onChange={(e) => { setPage(1); setStatus(e.target.value as any); }}
        >
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">Nome</th>
              <th className="text-left px-3 py-2">Slug</th>
              <th className="text-left px-3 py-2">Ano</th>
              <th className="text-left px-3 py-2">Período</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Carregando…</td></tr>
            )}
            {!loading && noRows && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Nenhuma campanha encontrada.</td></tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-3 py-2">{c.publicId ?? '—'}</td>
                <td className="px-3 py-2">{c.name}</td>
                <td className="px-3 py-2">{c.slug}</td>
                <td className="px-3 py-2">{c.year ?? '—'}</td>
                <td className="px-3 py-2">{`${fmtDate(c.startDate)} — ${fmtDate(c.endDate)}`}</td>
                <td className="px-3 py-2">{pill(c.status)}</td>
                <td className="px-3 py-2 text-right">
                  <a href={`/admin/campaigns/${c.id}`} className="border px-2 py-1 rounded mr-2 hover:bg-gray-50">Editar</a>
                  <StatusMenu current={c.status} onChange={(s) => changeStatus(c.id, s)} />
                  <button onClick={() => deleteCampaign(c.id, c.name)} className="border px-2 py-1 rounded hover:bg-gray-50 ml-2">
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && (data.pages ?? 1) > 1 && (
        <Pagination page={data.page} pages={data.pages} onChange={setPage} />
      )}

      {/* Create Dialog */}
      {openCreate && (
        <CreateCampaignDialog
          onClose={() => setOpenCreate(false)}
          onCreated={() => { setOpenCreate(false); load(); }}
        />
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

function StatusMenu({ current, onChange }: { current: CampaignStatus; onChange: (s: CampaignStatus) => void }) {
  return (
    <select
      className="border px-2 py-1 rounded"
      value={current}
      onChange={(e) => onChange(e.target.value as CampaignStatus)}
      title="Alterar status"
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nova Campanha</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-black">✕</button>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-gray-600">Nome*</span>
            <input className="border rounded px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-gray-600">Slug*</span>
            <input className="border rounded px-3 py-2" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex: natal-2025" />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-gray-600">Ano</span>
            <input className="border rounded px-3 py-2" type="number" value={year} onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))} />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-gray-600">Status</span>
            <select className="border rounded px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as CampaignStatus)}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-gray-600">Início</span>
            <input className="border rounded px-3 py-2" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-gray-600">Fim</span>
            <input className="border rounded px-3 py-2" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label className="md:col-span-2 grid gap-1">
            <span className="text-sm text-gray-600">Descrição</span>
            <textarea className="border rounded px-3 py-2 min-h-[90px]" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 border rounded" onClick={onClose}>Cancelar</button>
          <button className="px-3 py-2 bg-black text-white rounded" onClick={submit}>Criar</button>
        </div>
      </div>
    </div>
  );
}
