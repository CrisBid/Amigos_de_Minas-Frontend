// app/(admin)/admin/exports/sponsorships/page.tsx
'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowDown, ArrowLeft, ArrowUp, Columns3, Download, Eye, FileSpreadsheet, FileText, Images, Layers, ListOrdered, Loader2,
  RotateCcw, SlidersHorizontal, UserX,
} from 'lucide-react';
import CampaignFilter, { useAdminCampaign } from '@/components/Admin/CampaignFilter';
import {
  CAPTION_FIELDS, cellText, DEFAULT_CAPTION_FIELDS, DEFAULT_FIELDS, DEFAULT_SPONSOR_FIELDS, EXPORT_FIELDS, FIELD_LABEL, GROUP_LABEL, groupRows, SPONSOR_FIELDS,
  type ExportRow, type GroupBy, type SortBy, type SponsorContact,
} from '@/lib/exportFields';
import ColumnPicker from '@/components/Admin/ColumnPicker';
import { CARD_LIST_FIELDS, DEFAULT_GENERAL_COLUMNS, DEFAULT_LIST_COLUMNS } from '@/lib/exportFields';
import { STATUS_PT, type SponsorshipStatus } from '@/lib/sponsorship-status';
import type { PdfGroupBy, PdfItem } from '@/lib/pdf/exportSponsorshipsPdf';

/* Exportar apadrinhamentos: um lugar só para a lista de presentes (PDF), os cartões com foto
   (PDF) e a planilha (Excel) — mesmos filtros, organização por comunidade, cidade, ponto de
   coleta ou padrinho, e as crianças sem padrinho, se quiser. */

type Option = { id: string; name: string };
type Level = 'general' | 'city' | 'community' | 'school' | 'sponsor' | 'selection';
type SchoolOption = { id: string; name: string; communities: Option[] };
type Format = 'list' | 'cards' | 'excel';

const ALL_STATUS = Object.keys(STATUS_PT) as SponsorshipStatus[];
const DEFAULT_STATUS = ALL_STATUS.filter((s) => s !== 'CANCELLED');
const METHOD_OPTIONS = [
  { id: 'GIFT', name: 'Presente' },
  { id: 'PIX', name: 'PIX' },
];
const FIELDS_KEY = 'admin:export:sponsorships:fields';
const OPTS_KEY = 'admin:export:sponsorships:options:v3';

const FORMATS: { id: Format; title: string; desc: string; icon: typeof FileText }[] = [
  { id: 'list', title: 'Lista de presentes', desc: 'PDF em tabela, com as colunas que você escolher', icon: FileText },
  { id: 'cards', title: 'Cartões com foto', desc: 'PDF com a arte de cada criança (foto, presente, padrinho)', icon: Images },
  { id: 'excel', title: 'Planilha', desc: 'Excel para editar, filtrar e conferir', icon: FileSpreadsheet },
];
/** "Separar por" em cada formato (os cartões não têm escola) */
const GROUPS_FOR: Record<Format, GroupBy[]> = {
  list: ['community', 'city', 'collectionPoint', 'sponsor', 'school', 'none'],
  excel: ['community', 'city', 'collectionPoint', 'sponsor', 'school', 'none'],
  cards: ['community', 'city', 'school', 'collectionPoint', 'sponsor', 'none'],
};
const SORT_LABEL: Record<SortBy, string> = { id: 'Por ID', name: 'Alfabética', sponsor: 'Por padrinho' };
const PER_PAGE = [1, 2, 4, 6, 9];

const chip = (on: boolean) =>
  `px-3 py-1 rounded-full border text-sm ${on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300'}`;
const seg = (on: boolean) => `flex-1 px-3 py-2 text-sm ${on ? 'bg-emerald-600 text-white font-semibold' : 'bg-white text-gray-700 hover:bg-gray-50'}`;
const btn = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50';
const box = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4';
const select = 'mt-1 w-full rounded-xl border border-gray-300 bg-white text-gray-900 px-3 py-2';

type Opts = {
  format: Format; groupBy: GroupBy; sortBy: SortBy; bySponsor: boolean; includeFree: boolean;
  sponsorList: boolean; giftSum: boolean; layout: 'tabs' | 'single'; breakPerGroup: boolean; textScale: number;
  perPage: number; caption: boolean; includeNoPhoto: boolean; general: boolean;
  /** colunas: listas dos cartões, listagem geral e padrinhos */
  listCols: string[]; generalCols: string[]; sponsorCols: string[]; captionCols: string[];
  /** cartões: página final com os padrinhos; todos: folha de resumo dos pontos de coleta */
  sponsorPage: boolean; pointsSummary: boolean;
  /** cartões separados por padrinho: página de resumo antes dos cartões de cada um */
  sponsorSummaryPages: boolean;
};
const DEFAULT_OPTS: Opts = {
  format: 'list', groupBy: 'community', sortBy: 'id', bySponsor: true, includeFree: false,
  sponsorList: true, giftSum: true, layout: 'tabs', breakPerGroup: true, textScale: 1,
  perPage: 4, caption: true, includeNoPhoto: true, general: true,
  listCols: DEFAULT_LIST_COLUMNS, generalCols: DEFAULT_GENERAL_COLUMNS, sponsorCols: DEFAULT_SPONSOR_FIELDS, captionCols: DEFAULT_CAPTION_FIELDS,
  sponsorPage: true, pointsSummary: false, sponsorSummaryPages: true,
};

function Section({ n, title, icon: Icon, children }: { n: number; title: string; icon: typeof FileText; children: React.ReactNode }) {
  return (
    <section className={box}>
      <div className="flex items-center gap-2 text-gray-800">
        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">{n}</span>
        <Icon className="w-4 h-4 text-gray-500" />
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ExportSponsorships() {
  const params = useSearchParams();
  const { campaigns, campaignId, setCampaignId } = useAdminCampaign();

  const [level, setLevel] = useState<Level>('general');
  const [cities, setCities] = useState<Option[]>([]);
  const [communities, setCommunities] = useState<Option[]>([]);
  const [sponsors, setSponsors] = useState<Option[]>([]);
  const [cityId, setCityId] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  // escola do recorte: o id, ou "none" = crianças sem escola declarada
  const [schoolId, setSchoolId] = useState('');
  const [sponsorId, setSponsorId] = useState('');
  const [ids, setIds] = useState('');
  const [status, setStatus] = useState<string[]>(DEFAULT_STATUS);
  const [method, setMethod] = useState<string[]>([]);

  const [fields, setFields] = useState<string[]>(DEFAULT_FIELDS);
  const [o, setO] = useState<Opts>(DEFAULT_OPTS);
  const set = (patch: Partial<Opts>) => setO((p) => ({ ...p, ...patch }));
  const [restored, setRestored] = useState(false);

  const [preview, setPreview] = useState<{ rows: ExportRow[]; sponsors: SponsorContact[]; key: string } | null>(null);
  const [busy, setBusy] = useState<null | 'preview' | 'run'>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const cancelRef = useRef({ cancelled: false });

  // preferências do navegador; atalhos da página de exportações (?format=…&group=…) por cima
  useEffect(() => {
    try {
      const f = JSON.parse(localStorage.getItem(FIELDS_KEY) ?? 'null');
      if (Array.isArray(f)) {
        const valid = f.filter((k: unknown) => typeof k === 'string' && FIELD_LABEL[k]);
        if (valid.length) setFields(valid);
      }
    } catch { /* sem preferências salvas */ }
    let saved: Opts = DEFAULT_OPTS;
    try { saved = { ...DEFAULT_OPTS, ...JSON.parse(localStorage.getItem(OPTS_KEY) ?? '{}') }; } catch { /* idem */ }
    const valid = (list: unknown, allowed: { key: string }[], fallback: string[]) => {
      const v = Array.isArray(list) ? list.filter((k) => typeof k === 'string' && allowed.some((f) => f.key === k)) : [];
      return v.length ? v : fallback;
    };
    saved.listCols = valid(saved.listCols, CARD_LIST_FIELDS, DEFAULT_LIST_COLUMNS);
    saved.generalCols = valid(saved.generalCols, CARD_LIST_FIELDS, DEFAULT_GENERAL_COLUMNS);
    saved.sponsorCols = valid(saved.sponsorCols, SPONSOR_FIELDS, DEFAULT_SPONSOR_FIELDS);
    saved.captionCols = valid(saved.captionCols, CAPTION_FIELDS, DEFAULT_CAPTION_FIELDS);
    const fmt = params.get('format') as Format | null;
    const grp = params.get('group') as GroupBy | null;
    const sort = params.get('sort') as SortBy | null;
    setO({
      ...saved,
      ...(fmt && FORMATS.some((x) => x.id === fmt) ? { format: fmt } : {}),
      ...(grp && GROUP_LABEL[grp] ? { groupBy: grp } : {}),
      ...(sort && SORT_LABEL[sort] ? { sortBy: sort } : {}),
      ...(params.get('bySponsor') ? { bySponsor: params.get('bySponsor') === '1' } : {}),
      ...(params.get('free') ? { includeFree: params.get('free') === '1' } : {}),
    });
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(FIELDS_KEY, JSON.stringify(fields));
      localStorage.setItem(OPTS_KEY, JSON.stringify(o));
    } catch { /* navegador sem armazenamento */ }
  }, [restored, fields, o]);

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
    setSchoolId('');
    if (!cityId) { setCommunities([]); setSchools([]); return; }
    fetch(`/api/admin/schools?cityId=${cityId}&take=500`, { cache: 'no-store' })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d) => d && setSchools((d?.items ?? d ?? []).map((x: any) => ({
        id: x.id, name: x.name, communities: (x.communities ?? []).map((c: any) => ({ id: c.id, name: c.name })),
      })).sort((a: SchoolOption, b: SchoolOption) => a.name.localeCompare(b.name, 'pt-BR'))))
      .catch(() => {});
    fetch(`/api/admin/communities?cityId=${cityId}&take=500`, { cache: 'no-store' })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d) => d && setCommunities((d?.items ?? d ?? []).map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, [cityId]);

  const canPickCity = level === 'city' || level === 'community' || level === 'school';
  // escola é um filtro duplo: primeiro a comunidade, depois a escola dentro dela
  const canPickCommunity = level === 'community' || level === 'school';
  const school = schools.find((x) => x.id === schoolId);
  // escolas da comunidade escolhida (pelo vínculo escola × comunidade) e as demais da cidade
  const schoolsHere = schools.filter((x) => x.communities.some((c) => c.id === communityId));
  const schoolsElse = schools.filter((x) => !x.communities.some((c) => c.id === communityId));
  const freeAllowed = !!campaignId && level !== 'sponsor' && level !== 'selection';
  const includeFree = o.includeFree && freeAllowed;
  // o agrupamento escolhido pode não existir no formato (escola nos cartões): cai para comunidade
  const groupBy: GroupBy = GROUPS_FOR[o.format].includes(o.groupBy) ? o.groupBy : 'community';
  const sortBy: SortBy = o.format === 'cards' && o.sortBy === 'sponsor' ? 'id' : o.sortBy;
  const groupNoun = groupBy === 'none' ? '' : GROUP_LABEL[groupBy].toLowerCase();

  const filterQuery = useMemo(() => {
    const p = new URLSearchParams();
    p.set('level', level);
    if (campaignId) p.set('campaignId', campaignId);
    if (canPickCity && cityId) p.set('cityId', cityId);
    if (canPickCommunity && communityId) p.set('communityId', communityId);
    if (level === 'school' && schoolId) p.set('schoolId', schoolId);
    if (level === 'sponsor' && sponsorId) p.set('sponsorId', sponsorId);
    if (level === 'selection') {
      const list = ids.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean).join(',');
      if (list) p.set('ids', list);
    }
    if (status.length && status.length < ALL_STATUS.length) p.set('status', status.join(','));
    if (method.length) p.set('method', method.join(','));
    if (includeFree) p.set('includeUnsponsored', '1');
    return p.toString();
  }, [level, campaignId, canPickCity, cityId, canPickCommunity, communityId, schoolId, sponsorId, ids, status, method, includeFree]);

  const missing =
    (level === 'city' && !cityId) ? 'Escolha a cidade.' :
    (level === 'community' && !communityId) ? 'Escolha a comunidade.' :
    (level === 'school' && !cityId) ? 'Escolha a cidade.' :
    (level === 'school' && !communityId) ? 'Escolha a comunidade.' :
    (level === 'school' && !schoolId) ? 'Escolha a escola.' :
    (level === 'sponsor' && !sponsorId) ? 'Escolha o padrinho.' :
    (level === 'selection' && !ids.trim()) ? 'Cole os IDs dos apadrinhamentos.' :
    !status.length ? 'Marque pelo menos um status.' :
    o.format !== 'cards' && !fields.length ? 'Escolha pelo menos uma coluna.' : null;

  async function loadRows() {
    if (preview?.key === filterQuery) return preview;
    const r = await fetch(`/api/admin/sponsorships/export/rows?${filterQuery}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status === 403 ? 'Sem permissão para exportar.' : `Falha ao buscar os dados (${r.status}).`);
    const j = await r.json();
    const data = { rows: j.rows as ExportRow[], sponsors: j.sponsors as SponsorContact[], key: filterQuery };
    setPreview(data);
    return data;
  }

  const subtitle = () => {
    const camp = campaigns.find((c) => c.id === campaignId);
    const parts = [camp ? camp.name + (camp.year ? ` (${camp.year})` : '') : 'Todas as campanhas'];
    if (canPickCity && cityId) parts.push(cities.find((c) => c.id === cityId)?.name ?? '');
    if (canPickCommunity && communityId) parts.push(communities.find((c) => c.id === communityId)?.name ?? '');
    if (level === 'school' && schoolId) parts.push(schoolId === 'none' ? 'Sem escola declarada' : school?.name ?? '');
    if (level === 'sponsor' && sponsorId) parts.push(sponsors.find((s) => s.id === sponsorId)?.name ?? '');
    return parts.filter(Boolean).join(' · ');
  };
  const stamp = () => new Date().toISOString().slice(0, 10);

  async function run() {
    setBusy('run'); setError(null); setDone(null); setProgress(null);
    cancelRef.current = { cancelled: false };
    try {
      if (o.format === 'excel') {
        const q = new URLSearchParams(filterQuery);
        q.set('fields', fields.join(','));
        q.set('groupBy', groupBy);
        q.set('sortBy', sortBy);
        q.set('layout', o.layout);
        q.set('sponsorList', o.sponsorList ? '1' : '0');
        q.set('giftSummary', o.giftSum ? '1' : '0');
        q.set('sponsorFields', o.sponsorCols.join(','));
        q.set('pointsSummary', o.pointsSummary ? '1' : '0');
        const res = await fetch(`/api/admin/sponsorships/export?${q}`);
        if (!res.ok) throw new Error((await res.text().catch(() => '')) || 'Falha ao exportar.');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `apadrinhamentos-${stamp()}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        setDone('Planilha baixada.');
        return;
      }

      setProgress('Buscando os dados…');
      const data = await loadRows();
      if (!data.rows.length) throw new Error('Nada para exportar com estes filtros.');

      if (o.format === 'list') {
        const { giftListPdf } = await import('@/lib/pdf/giftListPdf');
        giftListPdf(data.rows, data.sponsors, {
          title: 'Lista de presentes e padrinhos',
          subtitle: subtitle(),
          fields, groupBy, sortBy, breakPerGroup: o.breakPerGroup, sponsorList: o.sponsorList, giftSummary: o.giftSum, textScale: o.textScale,
          sponsorFields: o.sponsorCols, pointsSummary: o.pointsSummary,
          fileName: `lista-de-presentes-${stamp()}.pdf`,
        });
        setDone('PDF da lista baixado.');
        return;
      }

      // cartões: dados com a imagem da campanha de cada criança
      const { exportSponsorshipsPdf, sponsorshipToPdfItem } = await import('@/lib/pdf/exportSponsorshipsPdf');
      const post = async (url: string, body: unknown) => {
        const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(`Falha ao buscar as fotos (${r.status}).`);
        return r.json() as Promise<unknown[]>;
      };
      const spIds = data.rows.filter((r) => !r.unsponsored).map((r) => r.sponsorshipId);
      const freeIds = data.rows.filter((r) => r.unsponsored && r.childId).map((r) => r.childId!);
      const all: PdfItem[] = [];
      for (let i = 0; i < spIds.length; i += 300) {
        setProgress(`Buscando as fotos… ${Math.min(spIds.length, i + 300)}/${spIds.length}`);
        all.push(...(await post('/api/admin/sponsorships/pdf-data', { sponsorshipIds: spIds.slice(i, i + 300) })).map(sponsorshipToPdfItem));
      }
      for (let i = 0; i < freeIds.length; i += 300) {
        setProgress(`Buscando as crianças sem padrinho… ${Math.min(freeIds.length, i + 300)}/${freeIds.length}`);
        all.push(...(await post('/api/admin/sponsorships/pdf-data-children', { campaignId, childIds: freeIds.slice(i, i + 300) }))
          .map((x) => ({ ...sponsorshipToPdfItem(x), unsponsored: true })));
      }
      const items = o.includeNoPhoto ? all : all.filter((i) => !!i.child.photoUrl);
      if (!items.length) throw new Error('Nenhuma criança com foto nesta campanha. Marque "Incluir crianças sem foto".');
      const pdfGroup: PdfGroupBy = groupBy === 'community' || groupBy === 'city' || groupBy === 'school' || groupBy === 'collectionPoint' ? groupBy : 'none';
      const r = await exportSponsorshipsPdf(items, {
        title: subtitle(),
        groupBy: pdfGroup,
        groupBySponsor: groupBy === 'sponsor' || (pdfGroup !== 'none' && o.bySponsor),
        order: sortBy === 'sponsor' ? 'id' : sortBy,
        perPage: o.perPage,
        textScale: o.textScale,
        caption: o.caption && o.captionCols.length > 0,
        captionFields: o.captionCols,
        summary: o.general,
        listColumns: o.listCols,
        generalColumns: o.generalCols,
        sponsorPage: o.sponsorPage,
        sponsorColumns: o.sponsorCols,
        pointsSummary: o.pointsSummary,
        sponsorSummaryPages: o.sponsorSummaryPages,
        signal: cancelRef.current,
        fileName: `cartoes-${stamp()}.pdf`,
        onProgress: (p) => setProgress(p.phase === 'compose' ? `Montando as artes… ${p.current}/${p.total}` : `Escrevendo o PDF… ${p.current}/${p.total}`),
      });
      if (!r.cancelled) {
        const free = items.filter((i) => i.unsponsored).length;
        setDone(`PDF baixado: ${r.cards} cartão(ões) em ${r.pages} página(s)${free ? ` · ${free} sem padrinho` : ''}${all.length - items.length ? ` · ${all.length - items.length} sem foto deixada(s) de fora` : ''}.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao exportar.');
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function doPreview() {
    setBusy('preview'); setError(null);
    try { await loadRows(); } catch (e) { setError(e instanceof Error ? e.message : 'Falha.'); } finally { setBusy(null); }
  }

  const move = (k: string, d: -1 | 1) => setFields((prev) => {
    const i = prev.indexOf(k), j = i + d;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const toggleField = (k: string) => setFields((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  const toggle = (list: string[], setter: (v: string[]) => void, id: string) => setter(list.includes(id) ? list.filter((s) => s !== id) : [...list, id]);

  const previewGroups = useMemo(() => (preview && preview.key === filterQuery ? groupRows(preview.rows, groupBy, sortBy) : null), [preview, filterQuery, groupBy, sortBy]);
  const previewFields = o.format === 'cards' ? DEFAULT_FIELDS : fields;
  const stale = !!preview && preview.key !== filterQuery;
  const freeInPreview = preview?.rows.filter((r) => r.unsponsored).length ?? 0;
  const runLabel = o.format === 'excel' ? 'Baixar planilha' : o.format === 'cards' ? 'Gerar PDF com fotos' : 'Gerar lista em PDF';

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <Link href="/admin/exports" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-2"><ArrowLeft className="w-4 h-4" /> Exportações</Link>
        <h1 className="text-xl font-semibold text-gray-900">Exportar apadrinhamentos</h1>
        <p className="text-sm text-gray-600">Escolha o formato, quais crianças entram e como organizar. As escolhas ficam guardadas neste navegador.</p>
      </div>

      {/* 1. formato */}
      <Section n={1} title="Formato" icon={Layers}>
        <div className="grid gap-3 sm:grid-cols-3">
          {FORMATS.map((f) => {
            const on = o.format === f.id;
            const Icon = f.icon;
            return (
              <button key={f.id} type="button" onClick={() => set({ format: f.id })} aria-pressed={on}
                className={`text-left rounded-xl border p-4 transition ${on ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-gray-200 hover:bg-gray-50'}`}>
                <Icon className={`w-5 h-5 ${on ? 'text-emerald-700' : 'text-gray-500'}`} />
                <div className="mt-2 font-semibold text-gray-900">{f.title}</div>
                <div className="text-xs text-gray-600">{f.desc}</div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* 2. quais crianças */}
      <Section n={2} title="Quais crianças" icon={SlidersHorizontal}>
        <CampaignFilter campaigns={campaigns} value={campaignId} onChange={setCampaignId} className="w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-sm text-gray-600">Recorte
            <select value={level} onChange={(e) => setLevel(e.target.value as Level)} className={select}>
              <option value="general">Todas</option>
              <option value="city">Uma cidade</option>
              <option value="community">Uma comunidade</option>
              <option value="school">Uma escola</option>
              <option value="sponsor">Um padrinho</option>
              <option value="selection">Lista de IDs de apadrinhamento</option>
            </select>
          </label>
          {canPickCity && (
            <label className="text-sm text-gray-600">Cidade
              <select value={cityId} onChange={(e) => setCityId(e.target.value)} className={select}>
                <option value="">— Selecionar —</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          {canPickCommunity && (
            <label className="text-sm text-gray-600">Comunidade
              <select value={communityId} onChange={(e) => { setCommunityId(e.target.value); setSchoolId(''); }} disabled={!cityId} className={`${select} disabled:bg-gray-100`}>
                <option value="">— Selecionar —</option>
                {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          {level === 'school' && (
            <label className="text-sm text-gray-600">Escola
              <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} disabled={!communityId} className={`${select} disabled:bg-gray-100`}>
                <option value="">{communityId ? '— Selecionar —' : 'Escolha a comunidade antes'}</option>
                {schoolsHere.length > 0 && (
                  <optgroup label="Escolas desta comunidade">
                    {schoolsHere.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </optgroup>
                )}
                {schoolsElse.length > 0 && (
                  <optgroup label="Outras escolas da cidade">
                    {schoolsElse.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </optgroup>
                )}
                <option value="none">Sem escola declarada</option>
              </select>
            </label>
          )}
          {level === 'sponsor' && (
            <label className="text-sm text-gray-600 md:col-span-2">Padrinho
              <select value={sponsorId} onChange={(e) => setSponsorId(e.target.value)} className={select}>
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
            Status do apadrinhamento
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
            {METHOD_OPTIONS.map((m) => <button key={m.id} type="button" onClick={() => toggle(method, setMethod, m.id)} className={chip(method.includes(m.id))}>{m.name}</button>)}
          </div>
        </div>
        <label className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${freeAllowed ? 'border-gray-200' : 'border-gray-100 bg-gray-50 text-gray-400'}`}>
          <input type="checkbox" className="mt-0.5 accent-emerald-600" checked={includeFree} disabled={!freeAllowed} onChange={(e) => set({ includeFree: e.target.checked })} />
          <span>
            <span className="font-medium inline-flex items-center gap-1.5"><UserX className="w-4 h-4" /> Incluir as crianças sem padrinho</span>
            <span className="block text-xs text-gray-500">
              {freeAllowed
                ? 'As crianças da campanha (no recorte escolhido) que ainda não foram apadrinhadas entram depois das apadrinhadas, com "Sem padrinho".'
                : 'Escolha uma campanha e o recorte "Todas", uma cidade ou uma comunidade.'}
            </span>
          </span>
        </label>
      </Section>

      {/* 3. organização */}
      <Section n={3} title="Organização" icon={ListOrdered}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-gray-600">Separar por
            <select value={groupBy} onChange={(e) => set({ groupBy: e.target.value as GroupBy })} className={select}>
              {GROUPS_FOR[o.format].map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
            </select>
            <span className="text-xs text-gray-500">
              {groupBy === 'collectionPoint' && 'Cada ponto de coleta com as suas crianças; as sem padrinho (sem ponto) ficam no fim. '}
              {groupBy === 'sponsor' && 'Cada padrinho com as suas crianças; as sem padrinho no fim. '}
              {o.format !== 'excel' && groupBy !== 'none' && 'Cada grupo começa em página nova.'}
            </span>
          </label>
          <div className="text-sm text-gray-600">Ordem das crianças
            <div className="mt-1 flex rounded-xl border border-gray-300 overflow-hidden">
              {((o.format === 'cards' ? ['id', 'name'] : ['id', 'name', 'sponsor']) as SortBy[]).map((v) => (
                <button key={v} type="button" onClick={() => set({ sortBy: v })} className={seg(sortBy === v)}>{SORT_LABEL[v]}</button>
              ))}
            </div>
            <span className="text-xs text-gray-500">{sortBy === 'sponsor' ? 'Agrupadas pelo padrinho dentro de cada grupo (e por ID dentro dele).' : 'Vale para as listas e os cartões.'}</span>
          </div>
        </div>
        {o.format === 'cards' && (groupBy === 'community' || groupBy === 'city' || groupBy === 'school' || groupBy === 'collectionPoint') && (
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-0.5 accent-emerald-600" checked={o.bySponsor} onChange={(e) => set({ bySponsor: e.target.checked })} />
            <span>
              Dentro de cada {groupNoun}, separar por padrinho
              <span className="block text-xs text-gray-500">A {groupNoun} começa com a lista de todas as crianças; depois cada padrinho com a lista dele (e contato) e os cartões; as sem padrinho no fim.</span>
            </span>
          </label>
        )}
      </Section>

      {/* 4. conteúdo */}
      <Section n={4} title="Conteúdo" icon={Columns3}>
        {o.format !== 'cards' && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
              <span className="font-medium">Colunas</span>
              <span className="text-xs text-gray-500">marque as que quer e use as setas para ordenar</span>
              <button type="button" onClick={() => setFields(DEFAULT_FIELDS)} className="ml-auto inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"><RotateCcw className="w-3.5 h-3.5" /> Voltar ao padrão</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
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
              <div className="flex flex-wrap content-start gap-2">
                {EXPORT_FIELDS.filter((f) => !fields.includes(f.key)).map((f) => (
                  <button key={f.key} type="button" onClick={() => toggleField(f.key)} className="px-3 py-1 rounded-full border border-gray-300 bg-white text-sm text-gray-700 hover:border-emerald-400">+ {f.label}</button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="grid gap-2 text-sm text-gray-700 pt-2 border-t border-gray-100">
          {o.format !== 'cards' && (
            <>
              <label className="flex items-center gap-2"><input type="checkbox" checked={o.giftSum} onChange={(e) => set({ giftSum: e.target.checked })} className="accent-emerald-600" /> Resumo dos presentes por {['city', 'school', 'collectionPoint'].includes(groupBy) ? groupNoun : 'comunidade'} (quantos de cada), no começo</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={o.pointsSummary} onChange={(e) => set({ pointsSummary: e.target.checked })} className="accent-emerald-600" /> Resumo dos pontos de coleta (crianças, padrinhos, recebidos e comunidades de cada ponto)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={o.sponsorList} onChange={(e) => set({ sponsorList: e.target.checked })} className="accent-emerald-600" /> Padrinhos com contato no final, separados por {['city', 'school', 'collectionPoint'].includes(groupBy) ? groupNoun : 'comunidade'}</label>
              {o.sponsorList && (
                <div className="ml-6 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                  <ColumnPicker title="Colunas dos padrinhos" all={SPONSOR_FIELDS} value={o.sponsorCols} onChange={(v) => set({ sponsorCols: v })} defaults={DEFAULT_SPONSOR_FIELDS} locked={['name']} />
                </div>
              )}
            </>
          )}
          {o.format === 'excel' && (
            <label className="flex items-center gap-2"><input type="checkbox" checked={o.layout === 'tabs'} disabled={groupBy === 'none'} onChange={(e) => set({ layout: e.target.checked ? 'tabs' : 'single' })} className="accent-emerald-600" /> Uma aba para cada {groupNoun || 'grupo'} (desmarcado: tudo numa aba, com títulos)</label>
          )}
          {o.format === 'list' && (
            <label className="flex items-center gap-2"><input type="checkbox" checked={o.breakPerGroup} disabled={groupBy === 'none'} onChange={(e) => set({ breakPerGroup: e.target.checked })} className="accent-emerald-600" /> Começar cada {groupNoun || 'grupo'} em página nova</label>
          )}
          {o.format === 'cards' && (
            <>
              <div className="flex flex-wrap items-center gap-2">Cartões por página
                <div className="flex rounded-xl border border-gray-300 overflow-hidden">
                  {PER_PAGE.map((n) => <button key={n} type="button" onClick={() => set({ perPage: n })} className={`${seg(o.perPage === n)} px-4`}>{n}</button>)}
                </div>
              </div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={o.caption} onChange={(e) => set({ caption: e.target.checked })} className="accent-emerald-600" /> Legenda abaixo de cada arte</label>
              {o.caption && (
                <div className="ml-6 rounded-xl border border-gray-100 bg-gray-50/60 p-3 space-y-2">
                  <ColumnPicker
                    title="O que aparece na legenda"
                    hint="(nome e ID saem juntos na primeira linha; idade e local, juntos numa linha)"
                    all={CAPTION_FIELDS} value={o.captionCols} onChange={(v) => set({ captionCols: v })} defaults={DEFAULT_CAPTION_FIELDS}
                  />
                  <CaptionPreview fields={o.captionCols} />
                </div>
              )}
              <label className="flex items-center gap-2"><input type="checkbox" checked={o.includeNoPhoto} onChange={(e) => set({ includeNoPhoto: e.target.checked })} className="accent-emerald-600" /> Incluir crianças sem foto (saem no fim de cada lista, só com o layout)</label>
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                <ColumnPicker
                  title={groupBy === 'none' ? 'Colunas da lista das crianças' : 'Colunas das listas de cada grupo e padrinho'}
                  hint="(na lista de um padrinho, a coluna Padrinho some)"
                  all={CARD_LIST_FIELDS} value={o.listCols} onChange={(v) => set({ listCols: v })} defaults={DEFAULT_LIST_COLUMNS} locked={['name']}
                />
              </div>
              {groupBy !== 'none' && (
                <>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={o.general} onChange={(e) => set({ general: e.target.checked })} className="accent-emerald-600" /> Listagem geral no final (todas as crianças)</label>
                  {o.general && (
                    <div className="ml-6 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                      <ColumnPicker title="Colunas da listagem geral" hint="(ex.: ponto de coleta, escola)" all={CARD_LIST_FIELDS} value={o.generalCols} onChange={(v) => set({ generalCols: v })} defaults={DEFAULT_GENERAL_COLUMNS} locked={['name']} />
                    </div>
                  )}
                </>
              )}
              {groupBy === 'none' && (
                <label className="flex items-center gap-2"><input type="checkbox" checked={o.general} onChange={(e) => set({ general: e.target.checked })} className="accent-emerald-600" /> Lista de todas as crianças no início</label>
              )}
              {(groupBy === 'sponsor' || (o.bySponsor && ['community', 'city', 'school', 'collectionPoint'].includes(groupBy))) && (
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-0.5 accent-emerald-600" checked={!o.sponsorSummaryPages} onChange={(e) => set({ sponsorSummaryPages: !e.target.checked })} />
                  <span>
                    Sem a página de resumo de cada padrinho (os cartões de cada um continuam em página nova)
                    {!o.captionCols.includes('sponsor') && <span className="block text-xs text-gray-500">Dica: inclua &quot;Padrinho&quot; na legenda para saber de quem é cada cartão.</span>}
                  </span>
                </label>
              )}
              <label className="flex items-center gap-2"><input type="checkbox" checked={o.pointsSummary} onChange={(e) => set({ pointsSummary: e.target.checked })} className="accent-emerald-600" /> Folha de resumo dos pontos de coleta (no final)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={o.sponsorPage} onChange={(e) => set({ sponsorPage: e.target.checked })} className="accent-emerald-600" /> Última página: os padrinhos deste conjunto (crianças de cada um, forma e contato)</label>
              {o.sponsorPage && (
                <div className="ml-6 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                  <ColumnPicker title="Colunas dos padrinhos" all={SPONSOR_FIELDS} value={o.sponsorCols} onChange={(v) => set({ sponsorCols: v })} defaults={DEFAULT_SPONSOR_FIELDS} locked={['name']} />
                </div>
              )}
            </>
          )}
          {o.format !== 'excel' && (
            <label className="flex items-center gap-2">Tamanho do texto
              <select value={o.textScale} onChange={(e) => set({ textScale: Number(e.target.value) })} className="rounded-lg border border-gray-300 bg-white px-2 py-1">
                <option value={0.9}>menor</option><option value={1}>normal</option><option value={1.15}>maior</option>
              </select>
            </label>
          )}
        </div>
      </Section>

      {/* ações */}
      <section className="flex flex-wrap items-center gap-3">
        <button onClick={run} disabled={!!busy || !!missing} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>
          {busy === 'run' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {runLabel}
        </button>
        <button onClick={doPreview} disabled={!!busy || !!missing} className={`${btn} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>
          {busy === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} {preview && !stale ? 'Prévia atualizada' : 'Ver prévia'}
        </button>
        {progress && (
          <span className="text-sm text-blue-800 inline-flex items-center gap-2">
            {progress}
            {o.format === 'cards' && <button onClick={() => { cancelRef.current.cancelled = true; }} className="text-xs underline">cancelar</button>}
          </span>
        )}
        {missing && <span className="text-sm text-amber-700">{missing}</span>}
        {error && <span className="text-sm text-red-700">{error}</span>}
        {done && !busy && <span className="text-sm text-emerald-700">{done}</span>}
      </section>

      {/* prévia */}
      {previewGroups && preview && (
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-700">
            <b>{preview.rows.length}</b> criança(s){freeInPreview ? <> (<b>{freeInPreview}</b> sem padrinho)</> : null} em <b>{previewGroups.length}</b> {groupBy === 'none' ? 'lista' : `grupo(s) por ${groupNoun}`} · <b>{preview.sponsors.length}</b> padrinho(s)
          </div>
          <div className="overflow-x-auto max-h-[28rem]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600 text-left sticky top-0">
                <tr>{previewFields.map((k) => <th key={k} className="px-3 py-2 whitespace-nowrap">{FIELD_LABEL[k]}</th>)}</tr>
              </thead>
              <tbody>
                {previewGroups.slice(0, 5).map((g) => (
                  <PreviewGroup key={g.label} label={groupBy === 'none' ? null : g.label} rows={g.rows} fields={previewFields} />
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

/** Como a legenda vai ficar, com uma criança de exemplo */
function CaptionPreview({ fields }: { fields: string[] }) {
  const lines: { text: string; cls: string }[] = [];
  let meta = false;
  for (const f of fields) {
    if (f === 'name') lines.push({ text: `MARIA DA SILVA${fields.includes('id') ? ' — #612' : ''}`, cls: 'font-bold text-gray-900' });
    else if (f === 'id' && !fields.includes('name')) lines.push({ text: '#612', cls: 'font-bold text-gray-900' });
    else if (['age', 'place', 'community', 'city'].includes(f) && !meta) {
      meta = true;
      const parts = fields.filter((k) => ['age', 'place', 'community', 'city'].includes(k)).map((k) => (k === 'age' ? '7 anos' : k === 'city' ? 'Bonito' : 'Almescla'));
      lines.push({ text: parts.join('  ·  '), cls: 'text-gray-600' });
    } else if (f === 'school') lines.push({ text: 'Escola: Escola Municipal de Sumidouro', cls: 'text-gray-600' });
    else if (f === 'gift') lines.push({ text: 'Presente: BONECA', cls: 'text-amber-800' });
    else if (f === 'sponsor') lines.push({ text: 'Padrinho: Ana Souza', cls: 'text-gray-600' });
    else if (f === 'method') lines.push({ text: 'Forma: Presente', cls: 'text-gray-600' });
    else if (f === 'collectionPoint') lines.push({ text: 'Entrega: Igreja Matriz (Montes Claros)', cls: 'text-gray-600' });
    else if (f === 'campaign') lines.push({ text: 'Natal 2026 (2026)', cls: 'text-gray-600' });
  }
  return (
    <div className="flex items-start gap-3">
      <div className="w-16 h-20 rounded bg-gradient-to-br from-gray-200 to-gray-100 border border-gray-200 shrink-0" />
      <div className="text-xs space-y-0.5">
        <p className="text-[11px] text-gray-500">Exemplo:</p>
        {lines.map((l, i) => <p key={i} className={l.cls}>{l.text}</p>)}
        {fields.includes('status') && <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 ring-1 ring-amber-300">Pendente</span>}
        {!fields.length && <p className="text-gray-500">Nada marcado: o cartão sai só com a arte.</p>}
      </div>
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
        <tr key={r.sponsorshipId} className={`border-t border-gray-100 align-top ${r.unsponsored ? 'bg-gray-50/70' : ''}`}>
          {fields.map((k) => <td key={k} className={`px-3 py-1.5 ${k === 'childName' ? 'font-medium text-gray-900' : 'text-gray-700'}`}>{cellText(r, k) || '—'}</td>)}
        </tr>
      ))}
      {rows.length > 8 && (
        <tr><td colSpan={fields.length} className="px-3 py-1 text-xs text-gray-500">… mais {rows.length - 8}</td></tr>
      )}
    </>
  );
}

export default function ExportSponsorshipsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Carregando…</div>}>
      <ExportSponsorships />
    </Suspense>
  );
}
