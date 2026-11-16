'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCopy, Download, ExternalLink, FileSpreadsheet, FolderOpen, Loader2,
  RefreshCw, ScanSearch, Search, Settings2,
} from 'lucide-react';
import CampaignFilter, { useAdminCampaign } from '@/components/Admin/CampaignFilter';
import { normalizeText } from '@/lib/sheetImport';
import {
  compareSource, ISSUE_LABEL, matchTabToCity, parseCampaignTab, toSheetTsv,
  type DriveFile, type Issue, type IssueKind, type SheetChild, type SiteChild,
} from '@/lib/sourceCompare';
import { STATUS_PT, type SponsorshipStatus } from '@/lib/sponsorship-status';

type Config = {
  sheetId: string | null; photosFolderId: string | null;
  sheetUrl: string | null; photosFolderUrl: string | null;
  serviceAccountEmail: string | null;
};
type Loaded = {
  sheetTitle: string;
  tabs: { title: string; rows: string[][] }[];
  driveName: string;
  drive: DriveFile[];
  site: SiteChild[];
  at: Date;
};

const KIND_ORDER: IssueKind[] = ['new', 'removed', 'idMismatch', 'otherChild', 'changed', 'photoNotOnSite', 'photoNewer', 'photoDifferent', 'photoMissing', 'orphanPhoto'];
const KIND_TONE: Record<IssueKind, string> = {
  new: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  removed: 'bg-red-50 text-red-800 border-red-200',
  idMismatch: 'bg-amber-50 text-amber-800 border-amber-200',
  otherChild: 'bg-red-50 text-red-800 border-red-200',
  changed: 'bg-blue-50 text-blue-800 border-blue-200',
  photoNotOnSite: 'bg-violet-50 text-violet-800 border-violet-200',
  photoNewer: 'bg-violet-50 text-violet-800 border-violet-200',
  photoDifferent: 'bg-violet-50 text-violet-800 border-violet-200',
  photoMissing: 'bg-gray-50 text-gray-700 border-gray-200',
  orphanPhoto: 'bg-gray-50 text-gray-700 border-gray-200',
};
const KIND_HINT: Record<IssueKind, string> = {
  new: 'Está na planilha e ainda não foi cadastrada no site',
  removed: 'Está no site e não aparece mais na planilha',
  idMismatch: 'O nome está no site, mas com outro ID nesta campanha',
  otherChild: 'O ID da planilha é de outra criança no site',
  changed: 'Nome, presente, nascimento ou comunidade diferentes',
  photoNotOnSite: 'Tem foto no Drive e no site está sem foto',
  photoNewer: 'A foto do Drive foi alterada depois do envio para o site',
  photoDifferent: 'O arquivo do Drive não é o mesmo que está no site',
  photoMissing: 'A planilha tem a criança e o Drive não tem foto com esse ID',
  orphanPhoto: 'Arquivo no Drive com ID que não está na planilha',
};
const PAGE = 100;
const btn = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40';

async function errorText(res: Response) {
  try { const j = await res.json(); const m = j?.message ?? j?.error; return Array.isArray(m) ? m.join(' ') : String(m ?? `erro ${res.status}`); }
  catch { return `erro ${res.status}`; }
}

export default function SourceCheckPage() {
  const { campaigns, campaignId, setCampaignId, ready } = useAdminCampaign();
  const [config, setConfig] = useState<Config | null>(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [folderUrl, setFolderUrl] = useState('');
  const [editingConfig, setEditingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [tabCity, setTabCity] = useState<Record<string, string>>({});
  const [siteMd5, setSiteMd5] = useState<Record<string, string | null> | undefined>(undefined);
  const [md5Progress, setMd5Progress] = useState<string | null>(null);

  const [kindFilter, setKindFilter] = useState<IssueKind | 'all'>('all');
  const [cityFilter, setCityFilter] = useState('');
  const [communityFilter, setCommunityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(false);

  // configuração da campanha
  useEffect(() => {
    if (!ready || !campaignId) { setConfig(null); return; }
    setData(null); setSiteMd5(undefined); setError(null);
    fetch(`/api/admin/source-check/config?campaignId=${encodeURIComponent(campaignId)}`, { cache: 'no-store' })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(await errorText(r))))
      .then((c: Config) => {
        setConfig(c);
        setSheetUrl(c.sheetUrl ?? '');
        setFolderUrl(c.photosFolderUrl ?? '');
        setEditingConfig(!c.sheetId || !c.photosFolderId);
      })
      .catch((e) => setError(String(e)));
  }, [ready, campaignId]);

  async function saveConfig() {
    setSavingConfig(true); setError(null);
    try {
      const r = await fetch('/api/admin/source-check/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ campaignId, sheetUrl: sheetUrl.trim() || null, photosFolderUrl: folderUrl.trim() || null }),
      });
      if (!r.ok) throw new Error(await errorText(r));
      const c: Config = await r.json();
      setConfig(c);
      setEditingConfig(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSavingConfig(false);
    }
  }

  async function run() {
    setError(null); setSiteMd5(undefined); setPage(1);
    const get = async (path: string, what: string) => {
      setLoading(what);
      const r = await fetch(`/api/admin/source-check/${path}?campaignId=${encodeURIComponent(campaignId)}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(await errorText(r));
      return r.json();
    };
    try {
      const sheet = await get('sheet', 'Lendo a planilha…');
      const photos = await get('photos', 'Listando as fotos do Drive…');
      setLoading('Carregando as crianças do site…');
      const site: SiteChild[] = [];
      for (let skip = 0; ; skip += 100) {
        const r = await fetch(`/api/admin/children?campaignId=${encodeURIComponent(campaignId)}&skip=${skip}&take=100`, { cache: 'no-store' });
        if (!r.ok) throw new Error(await errorText(r));
        const j = await r.json();
        site.push(...(j.items ?? []));
        if (!j.hasMore || !(j.items ?? []).length) break;
      }
      const cities = [...new Set(site.map((c) => c.city?.name ?? c.cityName ?? '').filter(Boolean))];
      const map: Record<string, string> = {};
      for (const t of sheet.tabs) {
        const c = matchTabToCity(t.title, cities);
        if (c) map[t.title] = c;
      }
      setTabCity(map);
      setData({ sheetTitle: sheet.title, tabs: sheet.tabs, driveName: photos.name, drive: photos.files, site, at: new Date() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na conferência.');
    } finally {
      setLoading(null);
    }
  }

  const sheetChildren: SheetChild[] = useMemo(
    () => (data ? data.tabs.flatMap((t) => parseCampaignTab(t.title, t.rows)) : []),
    [data],
  );
  const tabsWithChildren = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of sheetChildren) m.set(r.tab, (m.get(r.tab) ?? 0) + 1);
    return [...m.entries()];
  }, [sheetChildren]);
  const siteCities = useMemo(() => (data ? [...new Set(data.site.map((c) => c.city?.name ?? c.cityName ?? '').filter(Boolean))].sort() : []), [data]);

  const issues: Issue[] = useMemo(
    () => (data ? compareSource({ sheet: sheetChildren, tabCity, site: data.site, drive: data.drive, siteMd5 }) : []),
    [data, sheetChildren, tabCity, siteMd5],
  );

  // comparação exata das fotos: MD5 do arquivo do site × MD5 que o Drive informa
  async function compareExact() {
    if (!data) return;
    const ids = data.site.filter((c) => c.images?.some((i) => i.id && !i.placeholder)).map((c) => c.id);
    const out: Record<string, string | null> = {};
    try {
      for (let i = 0; i < ids.length; i += 300) {
        setMd5Progress(`Comparando fotos: ${Math.min(ids.length, i + 300)} de ${ids.length}`);
        const r = await fetch('/api/admin/source-check/site-md5', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ campaignId, childIds: ids.slice(i, i + 300) }),
        });
        if (!r.ok) throw new Error(await errorText(r));
        Object.assign(out, (await r.json()).md5);
      }
      setSiteMd5(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao comparar as fotos.');
    } finally {
      setMd5Progress(null);
    }
  }

  const counts = useMemo(() => {
    const c = Object.fromEntries(KIND_ORDER.map((k) => [k, 0])) as Record<IssueKind, number>;
    for (const i of issues) if (!cityFilter || i.city === cityFilter) c[i.kind]++;
    return c;
  }, [issues, cityFilter]);

  const communities = useMemo(
    () => [...new Set(issues.filter((i) => !cityFilter || i.city === cityFilter).map((i) => i.community).filter(Boolean))].sort(),
    [issues, cityFilter],
  );

  const shown = useMemo(() => {
    const q = normalizeText(search);
    return issues.filter((i) =>
      (kindFilter === 'all' || i.kind === kindFilter) &&
      (!cityFilter || i.city === cityFilter) &&
      (!communityFilter || normalizeText(i.community) === normalizeText(communityFilter)) &&
      (!q || normalizeText(`${i.publicId} ${i.name} ${i.site?.name ?? ''}`).includes(q)),
    );
  }, [issues, kindFilter, cityFilter, communityFilter, search]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));

  const newRows = shown.filter((i) => i.kind === 'new' && i.sheet).map((i) => i.sheet!);
  async function copyNew() {
    await navigator.clipboard.writeText(toSheetTsv(newRows));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['Tipo', 'Cidade', 'Comunidade', 'ID', 'Criança', 'Detalhes', 'Apadrinhamento', 'Foto no Drive'].map(esc).join(';'),
      ...shown.map((i) => [
        ISSUE_LABEL[i.kind], i.city, i.community, i.publicId, i.name,
        i.details.map((d) => `${d.field}: planilha "${d.sheet}" / site "${d.site}"`).join(' | '),
        i.site?.sponsorships?.[0]?.status ? STATUS_PT[i.site.sponsorships[0].status as SponsorshipStatus] ?? i.site.sponsorships[0].status : '',
        i.photo ? [...i.photo.path, i.photo.name].join('/') : '',
      ].map(esc).join(';')),
    ];
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `conferencia-origem-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const configured = !!config?.sheetId && !!config?.photosFolderId;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
      <div>
        <Link href="/admin/children" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-2">
          <ArrowLeft className="w-4 h-4" /> Crianças
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Conferir com a origem</h1>
        <p className="text-gray-600 mt-1">
          Compara a planilha e a pasta de fotos do Google com o que está no site: crianças novas, que saíram, dados e fotos diferentes. Só confere — nada é gravado.
        </p>
      </div>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <CampaignFilter campaigns={campaigns} value={campaignId} onChange={setCampaignId} className="w-full sm:w-96" />
          {configured && !editingConfig && (
            <button onClick={() => setEditingConfig(true)} className={`${btn} border border-gray-200 bg-white text-gray-700`}>
              <Settings2 className="w-4 h-4" /> Links da origem
            </button>
          )}
          <button onClick={run} disabled={!configured || !!loading || editingConfig} className={`${btn} bg-blue-600 text-white ml-auto`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : data ? <RefreshCw className="w-4 h-4" /> : <ScanSearch className="w-4 h-4" />}
            {loading ?? (data ? 'Conferir de novo' : 'Conferir agora')}
          </button>
        </div>

        {campaignId && config && (editingConfig || !configured) && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <label className="block text-sm">
              <span className="font-semibold text-gray-800 inline-flex items-center gap-1.5"><FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Link da planilha (Google Planilhas)</span>
              <input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg bg-white" />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-gray-800 inline-flex items-center gap-1.5"><FolderOpen className="w-4 h-4 text-amber-600" /> Link da pasta de fotos (Google Drive)</span>
              <input value={folderUrl} onChange={(e) => setFolderUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg bg-white" />
            </label>
            {config.serviceAccountEmail ? (
              <p className="text-xs text-gray-600">
                Compartilhe a planilha e a pasta com <b className="select-all">{config.serviceAccountEmail}</b> como <b>leitor</b>.
                A pasta pode ter subpastas por cidade e comunidade; a foto é ligada à criança pelo ID no começo do nome do arquivo.
              </p>
            ) : (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                A conta de serviço do Google ainda não está configurada no servidor (variável GOOGLE_SERVICE_ACCOUNT_JSON). Os links podem ser salvos, mas a conferência só funciona depois disso.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              {configured && <button onClick={() => setEditingConfig(false)} className={`${btn} border border-gray-200 bg-white text-gray-700`}>Cancelar</button>}
              <button onClick={saveConfig} disabled={savingConfig} className={`${btn} bg-gray-900 text-white`}>
                {savingConfig && <Loader2 className="w-4 h-4 animate-spin" />} Salvar links
              </button>
            </div>
          </div>
        )}

        {configured && !editingConfig && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
            <a href={config!.sheetUrl!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-gray-900"><FileSpreadsheet className="w-4 h-4 text-emerald-600" /> {data?.sheetTitle || 'Planilha'} <ExternalLink className="w-3 h-3" /></a>
            <a href={config!.photosFolderUrl!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-gray-900"><FolderOpen className="w-4 h-4 text-amber-600" /> {data?.driveName || 'Pasta de fotos'} <ExternalLink className="w-3 h-3" /></a>
            {data && <span>Conferido às {data.at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}: {sheetChildren.length} na planilha · {data.drive.length} arquivo(s) no Drive · {data.site.length} no site</span>}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}
      </section>

      {data && (
        <>
          {/* abas da planilha ↔ cidades do site */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-800 mb-2">Abas da planilha</p>
            <div className="flex flex-wrap gap-2">
              {tabsWithChildren.map(([tab, n]) => (
                <label key={tab} className="inline-flex items-center gap-2 text-sm rounded-xl border border-gray-200 px-3 py-1.5">
                  <b>{tab}</b> <span className="text-gray-500">({n})</span> →
                  <select value={tabCity[tab] ?? ''} onChange={(e) => setTabCity((p) => ({ ...p, [tab]: e.target.value }))} className="border border-gray-200 rounded-lg px-2 py-1 bg-white">
                    <option value="">não conferir</option>
                    {siteCities.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              ))}
              {!tabsWithChildren.length && <span className="text-sm text-amber-700">Nenhuma aba com crianças reconhecida (o cabeçalho precisa ter ID e CRIANÇA/NOME).</span>}
            </div>
          </section>

          {/* resumo */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => { setKindFilter('all'); setPage(1); }} className={`px-3 py-1.5 rounded-full text-sm border ${kindFilter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-700'}`}>
                Tudo <b>{Object.values(counts).reduce((a, b) => a + b, 0)}</b>
              </button>
              {KIND_ORDER.filter((k) => counts[k] > 0).map((k) => (
                <button key={k} title={KIND_HINT[k]} onClick={() => { setKindFilter(k); setPage(1); }} className={`px-3 py-1.5 rounded-full text-sm border ${kindFilter === k ? 'bg-gray-900 text-white border-gray-900' : KIND_TONE[k]}`}>
                  {ISSUE_LABEL[k]} <b>{counts[k]}</b>
                </button>
              ))}
              {Object.values(counts).every((n) => !n) && (
                <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Tudo igual entre a origem e o site.</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setCommunityFilter(''); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-xl bg-white text-sm">
                <option value="">Todas as cidades</option>
                {[...new Set(Object.values(tabCity))].sort().map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={communityFilter} onChange={(e) => { setCommunityFilter(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-xl bg-white text-sm">
                <option value="">Todas as comunidades</option>
                {communities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="ID ou nome" className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm" />
              </div>
              <div className="flex flex-wrap gap-2 ml-auto">
                <button onClick={compareExact} disabled={!!md5Progress} className={`${btn} border border-gray-200 bg-white text-gray-700`} title="Compara o arquivo de cada foto do site com o do Drive (pode levar alguns minutos na primeira vez)">
                  {md5Progress ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
                  {md5Progress ?? (siteMd5 ? 'Fotos comparadas pelo arquivo' : 'Comparar fotos pelo arquivo')}
                </button>
                {newRows.length > 0 && (
                  <button onClick={copyNew} className={`${btn} bg-emerald-600 text-white`} title="Copia as novas no formato da planilha, para colar na Atualização de crianças">
                    <ClipboardCopy className="w-4 h-4" /> {copied ? 'Copiado!' : `Copiar ${newRows.length} nova(s)`}
                  </button>
                )}
                <button onClick={exportCsv} disabled={!shown.length} className={`${btn} border border-gray-200 bg-white text-gray-700`}>
                  <Download className="w-4 h-4" /> Exportar
                </button>
              </div>
            </div>
            {!siteMd5 && (
              <p className="text-xs text-gray-500">
                Sem a comparação pelo arquivo, a foto é marcada como &quot;mais nova&quot; quando foi alterada no Drive depois do envio para o site.
                {newRows.length > 0 && <> Para cadastrar as novas, copie e cole na <Link href="/admin/children/update" className="text-blue-700 underline">Atualização de crianças</Link> (escolhendo cidade e comunidade).</>}
              </p>
            )}
          </section>

          {/* lista */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-600 text-left">
                  <tr>
                    <th className="px-3 py-2">Situação</th>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Criança</th>
                    <th className="px-3 py-2">Local</th>
                    <th className="px-3 py-2">Planilha × site</th>
                    <th className="px-3 py-2">Apadrinhamento</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shown.slice((page - 1) * PAGE, page * PAGE).map((i, idx) => {
                    const st = i.site?.sponsorships?.[0]?.status as SponsorshipStatus | undefined;
                    return (
                      <tr key={`${i.kind}-${i.publicId}-${idx}`} className="align-top">
                        <td className="px-3 py-2"><span className={`inline-block text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${KIND_TONE[i.kind]}`} title={KIND_HINT[i.kind]}>{ISSUE_LABEL[i.kind]}</span></td>
                        <td className="px-3 py-2 font-mono text-gray-700">{i.publicId}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900">{i.name}</div>
                          {i.site && !i.details.some((d) => d.field === 'Nome') && i.site.name !== i.name && <div className="text-xs text-gray-500">no site: {i.site.name}</div>}
                          {i.sheet && <div className="text-[11px] text-gray-400">aba {i.sheet.tab}, linha {i.sheet.line}</div>}
                        </td>
                        <td className="px-3 py-2 text-gray-700">{i.city}{i.community ? <div className="text-xs text-gray-500">{i.community}</div> : null}</td>
                        <td className="px-3 py-2">
                          {i.details.map((d) => (
                            <div key={d.field} className="text-xs">
                              <span className="text-gray-500">{d.field}:</span> <span className="text-emerald-800 bg-emerald-50 px-1 rounded">{d.sheet || 'vazio'}</span> × <span className="text-red-700 bg-red-50 px-1 rounded">{d.site || 'vazio'}</span>
                            </div>
                          ))}
                          {i.photo && <div className="text-xs text-gray-500 truncate max-w-[16rem]" title={[...i.photo.path, i.photo.name].join(' / ')}>{[...i.photo.path, i.photo.name].join(' / ')}</div>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">{st ? STATUS_PT[st] ?? st : i.site ? 'sem padrinho' : ''}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {i.site && <Link href={`/admin/children/${i.site.id}`} className="text-xs text-blue-700 hover:underline mr-2">no site</Link>}
                          {i.photo && <a href={`https://drive.google.com/file/d/${i.photo.id}/view`} target="_blank" rel="noreferrer" className="text-xs text-blue-700 hover:underline">foto</a>}
                        </td>
                      </tr>
                    );
                  })}
                  {!shown.length && (
                    <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-500">Nada neste filtro.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-center gap-3 py-3 border-t border-gray-100 text-sm">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded-lg border disabled:opacity-40">Anterior</button>
                <span>Página {page} de {pages} · {shown.length} linha(s)</span>
                <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className="px-3 py-1 rounded-lg border disabled:opacity-40">Próxima</button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
