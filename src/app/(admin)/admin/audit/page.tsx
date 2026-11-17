'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, Download, History, Loader2, Search, Undo2, X } from 'lucide-react';

/* Histórico de alterações: quem mudou o quê e quando. Os ajustes da conferência com a origem
   guardam a ficha antes/depois e podem ser desfeitos daqui. */

type Entry = {
  id: string; createdAt: string; actorId: string | null; actorName: string | null; actorEmail: string | null;
  action: string; entity: string | null; entityId: string | null; campaignId: string | null; batchId: string | null; source: string | null;
  summary: string; before: unknown; after: unknown; meta: unknown; revertedAt: string | null; revertedBy: string | null;
};
type Facets = {
  actors: { id: string; name: string | null; email: string | null; count: number }[];
  actions: { action: string; count: number }[];
  entities: { entity: string; count: number }[];
};

const UNDOABLE = ['child.create', 'child.update', 'child.renumber', 'child.photo', 'child.remove'];
const ACTION_PT: Record<string, string> = {
  'child.create': 'Conferência: cadastro',
  'child.update': 'Conferência: atualização',
  'child.renumber': 'Conferência: ID corrigido',
  'child.photo': 'Conferência: foto',
  'child.remove': 'Conferência: saída da campanha',
  'child.undo': 'Conferência: desfeito',
  'sponsorship.cancel': 'Conferência: apadrinhamento cancelado',
  'sponsorship.replace': 'Conferência: apadrinhamento trocado',
  'community.create': 'Conferência: comunidade criada',
  'community.reactivate': 'Conferência: comunidade reativada',
};
const PAGE = 50;
const FILTERS = ['q', 'actorId', 'action', 'entity', 'from', 'to', 'batchId', 'campaignId', 'entityId'] as const;
type FilterKey = (typeof FILTERS)[number];

async function errorText(res: Response) {
  try { const j = await res.json(); const m = j?.message ?? j?.error; return Array.isArray(m) ? m.join(' ') : String(m ?? `erro ${res.status}`); }
  catch { return `erro ${res.status}`; }
}

/** Achata o JSON em "caminho → valor" (listas viram um resumo) */
function flatten(v: unknown, prefix = '', out: Record<string, string> = {}, depth = 0): Record<string, string> {
  if (v === null || v === undefined) { if (prefix) out[prefix] = ''; return out; }
  if (Array.isArray(v)) {
    if (v.every((x) => x === null || typeof x !== 'object')) out[prefix] = v.join(', ');
    else if (depth > 2) out[prefix] = `${v.length} item(ns)`;
    else v.forEach((x, i) => flatten(x, `${prefix}[${(x as any)?.id ? String((x as any).id).slice(-6) : i}]`, out, depth + 1));
    if (!v.length) out[prefix] = '(nenhum)';
    return out;
  }
  if (typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) flatten(x, prefix ? `${prefix}.${k}` : k, out, depth + 1);
    return out;
  }
  out[prefix] = String(v);
  return out;
}

function Diff({ before, after }: { before: unknown; after: unknown }) {
  const a = flatten(before ?? {});
  const b = flatten(after ?? {});
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const changed = keys.filter((k) => a[k] !== b[k]);
  if (before == null && after == null) return null;
  if (before == null || after == null) {
    const only = flatten(before ?? after);
    return (
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-1">{before == null ? 'Dados gravados' : 'Dados antes'}</p>
        <table className="text-xs w-full"><tbody>
          {Object.entries(only).map(([k, v]) => <tr key={k} className="align-top"><td className="pr-3 text-gray-500 font-mono whitespace-nowrap">{k}</td><td className="text-gray-900 break-all">{v || '—'}</td></tr>)}
        </tbody></table>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 mb-1">O que mudou ({changed.length})</p>
      {changed.length ? (
        <table className="text-xs w-full">
          <thead><tr className="text-gray-500 text-left"><th className="pr-3 font-normal">campo</th><th className="pr-3 font-normal">antes</th><th className="font-normal">depois</th></tr></thead>
          <tbody>
            {changed.map((k) => (
              <tr key={k} className="align-top">
                <td className="pr-3 text-gray-500 font-mono whitespace-nowrap">{k}</td>
                <td className="pr-3"><span className="bg-red-50 text-red-800 px-1 rounded break-all">{a[k] === undefined ? '(não existia)' : a[k] || 'vazio'}</span></td>
                <td><span className="bg-emerald-50 text-emerald-800 px-1 rounded break-all">{b[k] === undefined ? '(removido)' : b[k] || 'vazio'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="text-xs text-gray-500">Nenhuma diferença registrada.</p>}
    </div>
  );
}

function AuditInner() {
  const router = useRouter();
  const params = useSearchParams();
  const filters = useMemo(() => Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? ''])) as Record<FilterKey, string>, [params]);
  const [qInput, setQInput] = useState(filters.q);
  const [items, setItems] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [undoing, setUndoing] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const setFilter = (patch: Partial<Record<FilterKey, string>>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    setSkip(0);
    router.replace(`/admin/audit${next.toString() ? `?${next}` : ''}`);
  };

  useEffect(() => { setQInput(filters.q); }, [filters.q]);

  useEffect(() => {
    fetch('/api/admin/audit/facets', { cache: 'no-store' }).then(async (r) => (r.ok ? setFacets(await r.json()) : null)).catch(() => null);
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams();
    for (const k of FILTERS) if (filters[k]) qs.set(k, filters[k]);
    qs.set('skip', String(skip));
    qs.set('take', String(PAGE));
    setLoading(true); setError(null);
    fetch(`/api/admin/audit?${qs}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 403 ? 'Só administradores veem o histórico.' : await errorText(r));
        const j = await r.json();
        setItems(j.items ?? []);
        setTotal(j.total ?? 0);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar.'))
      .finally(() => setLoading(false));
  }, [filters, skip, reload]);

  async function undo(e: Entry) {
    if (!window.confirm(`Desfazer?\n\n${e.summary}\n\nA criança volta a ficar como estava antes deste ajuste.`)) return;
    setUndoing(e.id); setError(null);
    try {
      const r = await fetch('/api/admin/source-check/undo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ auditId: e.id }) });
      if (!r.ok) throw new Error(await errorText(r));
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao desfazer.');
    } finally {
      setUndoing(null);
    }
  }

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['Data', 'Quem', 'E-mail', 'Ação', 'Resumo', 'Item', 'ID do item', 'Lote', 'Desfeito em'].map(esc).join(';'),
      ...items.map((e) => [
        new Date(e.createdAt).toLocaleString('pt-BR'), e.actorName, e.actorEmail, ACTION_PT[e.action] ?? e.action, e.summary,
        e.entity, e.entityId, e.batchId, e.revertedAt ? new Date(e.revertedAt).toLocaleString('pt-BR') : '',
      ].map(esc).join(';')),
    ];
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `historico-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const active = FILTERS.filter((k) => filters[k] && k !== 'q');
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const page = Math.floor(skip / PAGE) + 1;
  const input = 'px-3 py-2 border border-gray-200 rounded-xl bg-white text-sm';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-2"><ArrowLeft className="w-4 h-4" /> Painel</Link>
        <h1 className="text-3xl font-bold text-gray-900 inline-flex items-center gap-2"><History className="w-7 h-7 text-gray-700" /> Histórico de alterações</h1>
        <p className="text-gray-600 mt-1">Tudo o que foi gravado no painel: quem fez, quando e o que mudou. Os ajustes da conferência com a origem podem ser desfeitos aqui.</p>
      </div>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={(e) => { e.preventDefault(); setFilter({ q: qInput.trim() }); }} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Buscar no resumo, pessoa, ID…" className={`${input} pl-9 w-72 max-w-full`} />
          </form>
          <select value={filters.actorId} onChange={(e) => setFilter({ actorId: e.target.value })} className={input}>
            <option value="">Todas as pessoas</option>
            {facets?.actors.map((a) => <option key={a.id} value={a.id}>{a.name ?? a.email ?? a.id} ({a.count})</option>)}
          </select>
          <select value={filters.action} onChange={(e) => setFilter({ action: e.target.value })} className={`${input} max-w-xs`}>
            <option value="">Todas as ações</option>
            {facets?.actions.map((a) => <option key={a.action} value={a.action}>{ACTION_PT[a.action] ?? a.action} ({a.count})</option>)}
          </select>
          <select value={filters.entity} onChange={(e) => setFilter({ entity: e.target.value })} className={input}>
            <option value="">Todos os tipos</option>
            {facets?.entities.map((a) => <option key={a.entity} value={a.entity}>{a.entity} ({a.count})</option>)}
          </select>
          <label className="text-sm text-gray-600 inline-flex items-center gap-1">de <input type="date" value={filters.from} onChange={(e) => setFilter({ from: e.target.value })} className={input} /></label>
          <label className="text-sm text-gray-600 inline-flex items-center gap-1">até <input type="date" value={filters.to} onChange={(e) => setFilter({ to: e.target.value })} className={input} /></label>
          <button onClick={exportCsv} disabled={!items.length} className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 disabled:opacity-40">
            <Download className="w-4 h-4" /> Exportar página
          </button>
        </div>
        {active.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {active.map((k) => (
              <button key={k} onClick={() => setFilter({ [k]: '' })} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                {k === 'batchId' ? 'lote' : k === 'campaignId' ? 'campanha' : k === 'entityId' ? 'item' : k}: {filters[k].length > 14 ? `…${filters[k].slice(-8)}` : filters[k]} <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}
        {error && <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-2 text-sm text-gray-600 border-b border-gray-100 flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />} {total} registro(s)
        </div>
        <ul className="divide-y divide-gray-100">
          {items.map((e) => {
            const isOpen = open.has(e.id);
            const canUndo = e.source === 'source-check' && UNDOABLE.includes(e.action) && !e.revertedAt;
            return (
              <li key={e.id} className={e.revertedAt ? 'bg-gray-50/70' : ''}>
                <div className="flex items-start gap-3 px-4 py-3">
                  <button onClick={() => setOpen((p) => { const s = new Set(p); if (s.has(e.id)) s.delete(e.id); else s.add(e.id); return s; })} className="mt-0.5 text-gray-500" aria-label="Detalhes">
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${e.revertedAt ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{e.summary}</div>
                    <div className="text-xs text-gray-500 flex flex-wrap gap-x-3">
                      <span>{new Date(e.createdAt).toLocaleString('pt-BR')}</span>
                      <span>{e.actorName ?? e.actorEmail ?? 'sistema'}</span>
                      <span>{ACTION_PT[e.action] ?? e.action}</span>
                      {e.batchId && <button onClick={() => setFilter({ batchId: e.batchId! })} className="text-blue-700 hover:underline">lote …{e.batchId.slice(-6)}</button>}
                      {e.entity === 'Child' && e.entityId && <Link href={`/admin/children/${e.entityId}`} className="text-blue-700 hover:underline">ver criança</Link>}
                      {e.entityId && <button onClick={() => setFilter({ entityId: e.entityId! })} className="text-blue-700 hover:underline">tudo deste item</button>}
                      {e.revertedAt && <span className="text-gray-700">desfeito em {new Date(e.revertedAt).toLocaleString('pt-BR')}</span>}
                    </div>
                  </div>
                  {canUndo && (
                    <button onClick={() => undo(e)} disabled={!!undoing} className="inline-flex items-center gap-1 text-sm text-red-700 hover:underline disabled:opacity-40 shrink-0">
                      {undoing === e.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />} Desfazer
                    </button>
                  )}
                </div>
                {isOpen && (
                  <div className="px-11 pb-4 space-y-3">
                    <Diff before={e.before} after={e.after} />
                    {e.meta != null && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-gray-600">Detalhes técnicos</summary>
                        <pre className="mt-1 bg-gray-50 rounded-lg p-2 overflow-x-auto max-h-64">{JSON.stringify(e.meta, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {!items.length && !loading && <li className="px-4 py-10 text-center text-gray-500">Nada encontrado.</li>}
        </ul>
        {pages > 1 && (
          <div className="flex items-center justify-center gap-3 py-3 border-t border-gray-100 text-sm">
            <button onClick={() => setSkip((s) => Math.max(0, s - PAGE))} disabled={page <= 1} className="px-3 py-1 rounded-lg border disabled:opacity-40">Anterior</button>
            <span>Página {page} de {pages}</span>
            <button onClick={() => setSkip((s) => s + PAGE)} disabled={page >= pages} className="px-3 py-1 rounded-lg border disabled:opacity-40">Próxima</button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Carregando…</div>}>
      <AuditInner />
    </Suspense>
  );
}
