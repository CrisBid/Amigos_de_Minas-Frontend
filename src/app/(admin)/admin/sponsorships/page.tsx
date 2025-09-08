'use client';

import { useEffect, useMemo, useState } from 'react';

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

  // dropdown de campanhas
  const [campaigns, setCampaigns] = useState<CampaignLite[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const url = new URL('/api/admin/campaigns', window.location.origin);
        url.searchParams.set('page', '1');
        url.searchParams.set('pageSize', '200'); // simples
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

  const header = useMemo(() => {
    const total = typeof data?.total === 'number' ? data.total : rows.length;
    return {
      total,
      pending: rows.filter(r => r.status === 'PENDING').length,
      active: rows.filter(r => r.status === 'ACTIVE').length,
    };
  }, [data?.total, rows]);

  const fmtDate = (s?: string | null) => {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
    // ajuste locale se quiser: toLocaleDateString('pt-BR')
  };

  const pill = (s: SponsorshipStatus) => {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Apadrinhamentos</h1>
          <p className="text-sm text-gray-600">Acompanhe e gerencie os vínculos entre padrinhos e crianças por campanha.</p>
        </div>
        {/* Botões futuros: importar/exportar, criar manualmente, etc. */}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-lg font-semibold">{header.total}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-gray-500">Pendentes</div>
          <div className="text-lg font-semibold">{header.pending}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-gray-500">Ativos</div>
          <div className="text-lg font-semibold">{header.active}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-2">
        <input
          className="border rounded px-3 py-2 w-full md:w-80"
          placeholder="Buscar por criança/padrinho"
          value={q}
          onChange={(e) => { setPage(1); setQ(e.target.value); }}
        />
        <select
          className="border rounded px-3 py-2 md:w-56"
          value={status}
          onChange={(e) => { setPage(1); setStatus(e.target.value as SponsorshipStatus | ''); }}
        >
          <option value="">Todos os status</option>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          className="border rounded px-3 py-2 md:w-72"
          value={campaignId}
          onChange={(e) => { setPage(1); setCampaignId(e.target.value); }}
        >
          <option value="">Todas as campanhas</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.year ? ` (${c.year})` : ''}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">Criança</th>
              <th className="text-left px-3 py-2">Padrinho</th>
              <th className="text-left px-3 py-2">Campanha</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Início</th>
              <th className="text-left px-3 py-2">Fim</th>
              <th className="text-right px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Carregando…</td></tr>
            )}
            {!loading && noRows && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Nenhum apadrinhamento encontrado.</td></tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2">
                  {s.child ? (
                    <a href={`/admin/children/${s.child.id}`} className="hover:underline">
                      #{s.child.publicId ?? '—'} {s.child.name}
                    </a>
                  ) : '—'}
                </td>
                <td className="px-3 py-2">
                  {s.sponsor ? (
                    <>
                      <span>{s.sponsor.name}</span>
                      {s.sponsor.email ? <span className="text-gray-500"> — {s.sponsor.email}</span> : null}
                    </>
                  ) : '—'}
                </td>
                <td className="px-3 py-2">
                  {s.campaign ? (
                    <a href={`/admin/campaigns/${s.campaign.id}`} className="hover:underline">
                      {s.campaign.name}{s.campaign.year ? ` • ${s.campaign.year}` : ''}
                    </a>
                  ) : '—'}
                </td>
                <td className="px-3 py-2">{pill(s.status)}</td>
                <td className="px-3 py-2">{fmtDate(s.startDate)}</td>
                <td className="px-3 py-2">{fmtDate(s.endDate)}</td>
                <td className="px-3 py-2 text-right">
                  <select
                    className="border px-2 py-1 rounded"
                    value={s.status}
                    onChange={(e) => changeStatus(s.id, e.target.value as SponsorshipStatus)}
                    title="Alterar status"
                  >
                    {STATUS_OPTS.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                  <button onClick={() => del(s.id)} className="border px-2 py-1 rounded hover:bg-gray-50 ml-2">
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
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
