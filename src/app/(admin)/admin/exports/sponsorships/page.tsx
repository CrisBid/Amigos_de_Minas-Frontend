// app/(admin)/admin/exports/sponsorships/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, Columns3, Download, Eye, FileSpreadsheet, FileText, Loader2, RotateCcw, SlidersHorizontal,
} from 'lucide-react';
import CampaignFilter, { useAdminCampaign } from '@/components/Admin/CampaignFilter';
import {
  cellText, DEFAULT_FIELDS, EXPORT_FIELDS, FIELD_LABEL, GROUP_LABEL, groupRows,
  type ExportRow, type GroupBy, type SortBy, type SponsorContact,
} from '@/lib/exportFields';
import { STATUS_PT, type SponsorshipStatus } from '@/lib/sponsorship-status';

type Option = { id: string; name: string };
type Level = 'general' | 'city' | 'community' | 'sponsor' | 'selection';

const ALL_STATUS = Object.keys(STATUS_PT) as SponsorshipStatus[];
const DEFAULT_STATUS = ALL_STATUS.filter((s) => s !== 'CANCELLED');
const METHOD_OPTIONS = [
  { id: 'GIFT', name: 'Presente' },
  { id: 'PIX', name: 'PIX' },
];
const FIELDS_KEY = 'admin:export:sponsorships:fields';
const OPTS_KEY = 'admin:export:sponsorships:options';

const chip = (on: boolean) =>
  `px-3 py-1 rounded-full border text-sm ${on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300'}`;
const btn = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50';

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? { ...fallback, ...JSON.parse(v) } : fallback; } catch { return fallback; }
}

export default function ExportSponsorshipsPage() {
  const { campaigns, campaignId, setCampaignId } = useAdminCampaign();

  const [level, setLevel] = useState<Level>('general');
  const [cities, setCities] = useState<Option[]>([]);
  const [communities, setCommunities] = useState<Option[]>([]);
  const [sponsors, setSponsors] = useState<Option[]>([]);
  const [cityId, setCityId] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [sponsorId, setSponsorId] = useState('');
  const [ids, setIds] = useState('');
  const [status, setStatus] = useState<string[]>(DEFAULT_STATUS);
  const [method, setMethod] = useState<string[]>([]);

  // colunas e opções (lembradas neste navegador)
  const [fields, setFields] = useState<string[]>(DEFAULT_FIELDS);
  const [groupBy, setGroupBy] = useState<GroupBy>('community');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sponsorList, setSponsorList] = useState(true);
  const [layout, setLayout] = useState<'tabs' | 'single'>('tabs');
  const [breakPerGroup, setBreakPerGroup] = useState(false);
  const [textScale, setTextScale] = useState(1);
  const [restored, setRestored] = useState(false);

  const [preview, setPreview] = useState<{ rows: ExportRow[]; sponsors: SponsorContact[]; key: string } | null>(null);
  const [busy, setBusy] = useState<null | 'preview' | 'excel' | 'pdf'>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const f = JSON.parse(localStorage.getItem(FIELDS_KEY) ?? 'null');
      if (Array.isArray(f)) {
        const valid = f.filter((k: unknown) => typeof k === 'string' && FIELD_LABEL[k]);
        if (valid.length) setFields(valid);
      }
    } catch { /* sem preferências salvas */ }
    const o = load(OPTS_KEY, { sortBy: 'name' as SortBy, groupBy: 'community' as GroupBy, sponsorList: true, layout: 'tabs' as 'tabs' | 'single', breakPerGroup: false, textScale: 1 });
    setGroupBy(o.groupBy); setSortBy(o.sortBy); setSponsorList(o.sponsorList); setLayout(o.layout); setBreakPerGroup(o.breakPerGroup); setTextScale(o.textScale);
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(FIELDS_KEY, JSON.stringify(fields));
      localStorage.setItem(OPTS_KEY, JSON.stringify({ groupBy, sortBy, sponsorList, layout, breakPerGroup, textScale }));
    } catch { /* navegador sem armazenamento */ }
  }, [restored, fields, groupBy, sortBy, sponsorList, layout, breakPerGroup, textScale]);

  // listas dos filtros
  useEffect(() => {
    fetch('/api/admin/cities', { cache: 'no-store' })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d) => d && setCities((d?.items ?? d ?? []).map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
    fetch('/api/admin/users?limit=200', { cache: 'no-store' })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d) => d && setSponsors((d?.items ?? d ?? []).map((s: any) => ({ id: s.id, name: s.name })).sort((a: Option, b: Option) => a.name.localeCompare(b.name, 'pt-BR'))))
      .catch(() => {});
  }, []);
  useEffect(() => {
    setCommunityId('');
    if (!cityId) { setCommunities([]); return; }
    fetch(`/api/admin/communities?cityId=${cityId}&take=500`, { cache: 'no-store' })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d) => d && setCommunities((d?.items ?? d ?? []).map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, [cityId]);

  const canPickCity = level === 'city' || level === 'community';
  const canPickCommunity = level === 'community';

  const filterQuery = useMemo(() => {
    const p = new URLSearchParams();
    p.set('level', level);
    if (campaignId) p.set('campaignId', campaignId);
    if (canPickCity && cityId) p.set('cityId', cityId);
    if (canPickCommunity && communityId) p.set('communityId', communityId);
    if (level === 'sponsor' && sponsorId) p.set('sponsorId', sponsorId);
    if (level === 'selection') {
      const list = ids.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean).join(',');
      if (list) p.set('ids', list);
    }
    if (status.length && status.length < ALL_STATUS.length) p.set('status', status.join(','));
    if (method.length) p.set('method', method.join(','));
    return p.toString();
  }, [level, campaignId, canPickCity, cityId, canPickCommunity, communityId, sponsorId, ids, status, method]);

  const missing =
    (level === 'city' && !cityId) ? 'Escolha a cidade.' :
    (level === 'community' && !communityId) ? 'Escolha a comunidade.' :
    (level === 'sponsor' && !sponsorId) ? 'Escolha o padrinho.' :
    (level === 'selection' && !ids.trim()) ? 'Cole os IDs dos apadrinhamentos.' :
    !status.length ? 'Marque pelo menos um status.' :
    !fields.length ? 'Escolha pelo menos uma coluna.' : null;

  async function loadRows() {
    if (preview?.key === filterQuery) return preview;
    const r = await fetch(`/api/admin/sponsorships/export/rows?${filterQuery}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status === 403 ? 'Sem permissão para exportar.' : `Falha ao buscar os dados (${r.status}).`);
    const j = await r.json();
    const data = { rows: j.rows as ExportRow[], sponsors: j.sponsors as SponsorContact[], key: filterQuery };
    setPreview(data);
    return data;
  }

  async function doPreview() {
    setBusy('preview'); setError(null);
    try { await loadRows(); } catch (e) { setError(e instanceof Error ? e.message : 'Falha.'); } finally { setBusy(null); }
  }

  const subtitle = () => {
    const camp = campaigns.find((c) => c.id === campaignId);
    const parts = [camp ? camp.name + (camp.year ? ` (${camp.year})` : '') : 'Todas as campanhas'];
    if (canPickCity && cityId) parts.push(cities.find((c) => c.id === cityId)?.name ?? '');
    if (canPickCommunity && communityId) parts.push(communities.find((c) => c.id === communityId)?.name ?? '');
    if (level === 'sponsor' && sponsorId) parts.push(sponsors.find((s) => s.id === sponsorId)?.name ?? '');
    return parts.filter(Boolean).join(' · ');
  };

  async function exportExcel() {
    setBusy('excel'); setError(null);
    try {
      const q = new URLSearchParams(filterQuery);
      q.set('fields', fields.join(','));
      q.set('groupBy', groupBy);
      q.set('sortBy', sortBy);
      q.set('layout', layout);
      q.set('sponsorList', sponsorList ? '1' : '0');
      const res = await fetch(`/api/admin/sponsorships/export?${q}`);
      if (!res.ok) throw new Error((await res.text().catch(() => '')) || 'Falha ao exportar.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `apadrinhamentos-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao exportar.');
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf() {
    setBusy('pdf'); setError(null);
    try {
      const data = await loadRows();
      const { giftListPdf } = await import('@/lib/pdf/giftListPdf');
      giftListPdf(data.rows, data.sponsors, {
        title: 'Lista de presentes e padrinhos',
        subtitle: subtitle(),
        fields, groupBy, sortBy, breakPerGroup, sponsorList, textScale,
        fileName: `lista-de-presentes-${new Date().toISOString().slice(0, 10)}.pdf`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao gerar o PDF.');
    } finally {
      setBusy(null);
    }
  }

  const move = (k: string, d: -1 | 1) => setFields((prev) => {
    const i = prev.indexOf(k), j = i + d;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const toggleField = (k: string) => setFields((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((s) => s !== id) : [...list, id]);

  const previewGroups = useMemo(() => (preview && preview.key === filterQuery ? groupRows(preview.rows, groupBy, sortBy) : null), [preview, filterQuery, groupBy, sortBy]);
  const stale = !!preview && preview.key !== filterQuery;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <Link href="/admin/exports" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-2"><ArrowLeft className="w-4 h-4" /> Exportações</Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center"><FileSpreadsheet className="w-5 h-5 text-emerald-700" /></div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Exportar apadrinhamentos</h1>
            <p className="text-sm text-gray-600">Escolha as colunas e o agrupamento. Sai em Excel ou em PDF (lista de presentes e padrinhos), com os contatos dos padrinhos no final.</p>
          </div>
        </div>
      </div>

      {/* Quais apadrinhamentos */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-gray-700"><SlidersHorizontal className="w-4 h-4" /><span className="font-medium">Quais apadrinhamentos</span></div>
        <CampaignFilter campaigns={campaigns} value={campaignId} onChange={setCampaignId} className="w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-sm text-gray-600">Recorte
            <select value={level} onChange={(e) => setLevel(e.target.value as Level)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white text-gray-900 px-3 py-2">
              <option value="general">Todos</option>
              <option value="city">Uma cidade</option>
              <option value="community">Uma comunidade</option>
              <option value="sponsor">Um padrinho</option>
              <option value="selection">Lista de IDs de apadrinhamento</option>
            </select>
          </label>
          {canPickCity && (
            <label className="text-sm text-gray-600">Cidade
              <select value={cityId} onChange={(e) => setCityId(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white text-gray-900 px-3 py-2">
                <option value="">— Selecionar —</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          {canPickCommunity && (
            <label className="text-sm text-gray-600">Comunidade
              <select value={communityId} onChange={(e) => setCommunityId(e.target.value)} disabled={!cityId} className="mt-1 w-full rounded-xl border border-gray-300 bg-white text-gray-900 px-3 py-2 disabled:bg-gray-100">
                <option value="">— Selecionar —</option>
                {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          {level === 'sponsor' && (
            <label className="text-sm text-gray-600 md:col-span-2">Padrinho
              <select value={sponsorId} onChange={(e) => setSponsorId(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white text-gray-900 px-3 py-2">
                <option value="">— Selecionar —</option>
                {sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
        </div>
        {level === 'selection' && (
          <textarea value={ids} onChange={(e) => setIds(e.target.value)} placeholder="IDs dos apadrinhamentos, separados por vírgula, espaço ou linha" className="w-full rounded-xl border border-gray-300 bg-white text-gray-900 min-h-[80px] p-3 text-sm" />
        )}
        <div>
          <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
            Status
            <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => setStatus(ALL_STATUS)}>todos</button>
            <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => setStatus(DEFAULT_STATUS)}>todos menos cancelados</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_STATUS.map((s) => <button key={s} type="button" onClick={() => toggle(status, setStatus, s)} className={chip(status.includes(s))}>{STATUS_PT[s]}</button>)}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600 mb-2">Forma (nenhuma marcada = todas)</div>
          <div className="flex flex-wrap gap-2">
            {METHOD_OPTIONS.map((o) => <button key={o.id} type="button" onClick={() => toggle(method, setMethod, o.id)} className={chip(method.includes(o.id))}>{o.name}</button>)}
          </div>
        </div>
      </section>

      {/* Colunas e agrupamento */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-gray-700">
          <Columns3 className="w-4 h-4" /><span className="font-medium">Colunas</span>
          <span className="text-xs text-gray-500">marque as que quer e use as setas para ordenar</span>
          <button type="button" onClick={() => setFields(DEFAULT_FIELDS)} className="ml-auto inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"><RotateCcw className="w-3.5 h-3.5" /> Voltar ao padrão</button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Na exportação, nesta ordem ({fields.length})</p>
            <ol className="space-y-1">
              {fields.map((k, i) => (
                <li key={k} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2 py-1.5 text-sm">
                  <input type="checkbox" checked onChange={() => toggleField(k)} className="accent-emerald-600" aria-label={`Tirar ${FIELD_LABEL[k]}`} />
                  <span className="w-5 text-xs text-gray-500">{i + 1}.</span>
                  <span className="flex-1 text-gray-900">{FIELD_LABEL[k]}</span>
                  <button type="button" onClick={() => move(k, -1)} disabled={i === 0} className="p-1 rounded hover:bg-white disabled:opacity-30" aria-label="Subir"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => move(k, 1)} disabled={i === fields.length - 1} className="p-1 rounded hover:bg-white disabled:opacity-30" aria-label="Descer"><ArrowDown className="w-3.5 h-3.5" /></button>
                </li>
              ))}
              {!fields.length && <li className="text-sm text-amber-700">Nenhuma coluna marcada.</li>}
            </ol>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Outras colunas</p>
            <div className="flex flex-wrap gap-2">
              {EXPORT_FIELDS.filter((f) => !fields.includes(f.key)).map((f) => (
                <button key={f.key} type="button" onClick={() => toggleField(f.key)} className="px-3 py-1 rounded-full border border-gray-300 bg-white text-sm text-gray-700 hover:border-emerald-400">+ {f.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 pt-2 border-t border-gray-100">
          <label className="text-sm text-gray-600">Separar por
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white text-gray-900 px-3 py-2">
              {(Object.keys(GROUP_LABEL) as GroupBy[]).map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
            </select>
          </label>
          <label className="text-sm text-gray-600">Ordem dentro do grupo
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white text-gray-900 px-3 py-2">
              <option value="name">Nome da criança</option>
              <option value="id">ID</option>
            </select>
          </label>
          <div className="text-sm text-gray-700 space-y-1.5 md:col-span-3">
            <label className="flex items-center gap-2"><input type="checkbox" checked={sponsorList} onChange={(e) => setSponsorList(e.target.checked)} className="accent-emerald-600" /> Lista dos padrinhos com contato no final</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={layout === 'tabs'} disabled={groupBy === 'none'} onChange={(e) => setLayout(e.target.checked ? 'tabs' : 'single')} className="accent-emerald-600" /> Excel: uma aba para cada {GROUP_LABEL[groupBy].toLowerCase()} (desmarcado: tudo numa aba, com títulos)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={breakPerGroup} disabled={groupBy === 'none'} onChange={(e) => setBreakPerGroup(e.target.checked)} className="accent-emerald-600" /> PDF: página nova para cada {GROUP_LABEL[groupBy].toLowerCase()}</label>
            <label className="flex items-center gap-2">PDF: tamanho do texto
              <select value={textScale} onChange={(e) => setTextScale(Number(e.target.value))} className="rounded-lg border border-gray-300 bg-white px-2 py-1">
                <option value={0.9}>menor</option><option value={1}>normal</option><option value={1.15}>maior</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      {/* Ações */}
      <section className="flex flex-wrap items-center gap-3">
        <button onClick={exportPdf} disabled={!!busy || !!missing} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>
          {busy === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Lista de presentes (PDF)
        </button>
        <button onClick={exportExcel} disabled={!!busy || !!missing} className={`${btn} border border-emerald-600 text-emerald-700 bg-white hover:bg-emerald-50`}>
          {busy === 'excel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Excel
        </button>
        <button onClick={doPreview} disabled={!!busy || !!missing} className={`${btn} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>
          {busy === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} {preview && !stale ? 'Prévia atualizada' : 'Ver prévia'}
        </button>
        {missing && <span className="text-sm text-amber-700">{missing}</span>}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </section>

      {/* Prévia */}
      {previewGroups && preview && (
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-700">
            <b>{preview.rows.length}</b> criança(s) em <b>{previewGroups.length}</b> {groupBy === 'none' ? 'lista' : `grupo(s) por ${GROUP_LABEL[groupBy].toLowerCase()}`} · <b>{preview.sponsors.length}</b> padrinho(s)
          </div>
          <div className="overflow-x-auto max-h-[28rem]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600 text-left sticky top-0">
                <tr>{fields.map((k) => <th key={k} className="px-3 py-2 whitespace-nowrap">{FIELD_LABEL[k]}</th>)}</tr>
              </thead>
              <tbody>
                {previewGroups.slice(0, 5).map((g) => (
                  <PreviewGroup key={g.label} label={groupBy === 'none' ? null : g.label} rows={g.rows} fields={fields} />
                ))}
              </tbody>
            </table>
          </div>
          {previewGroups.length > 5 && <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">Mostrando os 5 primeiros grupos (até 8 crianças cada). A exportação leva tudo.</p>}
        </section>
      )}
      {stale && <p className="text-xs text-gray-500">Os filtros mudaram desde a prévia.</p>}
    </div>
  );
}

function PreviewGroup({ label, rows, fields }: { label: string | null; rows: ExportRow[]; fields: string[] }) {
  return (
    <>
      {label && (
        <tr className="bg-emerald-50">
          <td colSpan={fields.length} className="px-3 py-1.5 font-semibold text-emerald-900">{label} — {rows.length} criança(s)</td>
        </tr>
      )}
      {rows.slice(0, 8).map((r) => (
        <tr key={r.sponsorshipId} className="border-t border-gray-100 align-top">
          {fields.map((k) => <td key={k} className={`px-3 py-1.5 ${k === 'childName' ? 'font-medium text-gray-900' : 'text-gray-700'}`}>{cellText(r, k) || '—'}</td>)}
        </tr>
      ))}
      {rows.length > 8 && (
        <tr><td colSpan={fields.length} className="px-3 py-1 text-xs text-gray-500">… mais {rows.length - 8}</td></tr>
      )}
    </>
  );
}
