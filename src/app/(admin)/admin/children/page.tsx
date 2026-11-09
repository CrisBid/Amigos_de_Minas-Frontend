'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Search, Plus, Edit, Trash2, Upload, Heart, Baby, MapPin, Gift, ChevronLeft, ChevronRight, Camera, Loader2,
  Clock, ScanFace, List, FilterX, School, GitCompareArrows, ImagePlus,
} from 'lucide-react';
import CampaignFilter, { useAdminCampaign } from '@/components/Admin/CampaignFilter';
import LocationFilter, { EMPTY_LOCATION, useLocationLabel, type LocationValue } from '@/components/Admin/LocationFilter';
import { apiPath } from '@/lib/api';
import { composeConfigForFrame } from '@/components/media/composeConfig';
import { STATUS_PT, type SponsorshipStatus } from '@/lib/sponsorship-status';
import PhotoReview from './PhotoReview';
import BulkPhotoUpload from './BulkPhotoUpload';

type Sponsorship = { id: string; status: SponsorshipStatus };
type ChildImageLite = { id: string | null; campaignId?: string | null; createdAt?: string; placeholder?: boolean };
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
  images?: ChildImageLite[];
  community?: { id: string; name: string } | null;
  school?: { id: string; name: string } | null;
  cityId?: string | null;
};

type Tab = 'list' | 'photos' | 'upload';
// valor de ?tab= na URL
const TAB_PARAM: Partial<Record<Tab, string>> = { photos: 'fotos', upload: 'enviar-fotos' };

const STATUS_STYLE: Partial<Record<SponsorshipStatus, { className: string; dot: string }>> = {
  PENDING: { className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  COMPLETED: { className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  ENDED: { className: 'bg-slate-50 text-slate-700 border-slate-200', dot: 'bg-slate-500' },
  CANCELLED: { className: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
};
// em andamento (em compra, embalado, encaixotado, aguardando entrega)
const IN_PROGRESS_STYLE = { className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' };

const PAGE_SIZES = [20, 50, 100];
const inputCls = 'w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none';

/** Miniatura da foto (sem moldura) gerada pelo backend no tamanho da listagem. */
function thumbUrl(childId: string, allImages: ChildImageLite[] | undefined, campaignId: string, size = 112) {
  // "só layout" (criança sem foto) não tem miniatura
  const images = (allImages ?? []).filter((i) => i.id && !i.placeholder);
  // com campanha, só a foto dela (migrada sem foto nova = sem miniatura, igual às novas)
  const pool = campaignId ? images.filter((i) => i.campaignId === campaignId) : images;
  if (!pool.length) return null;
  const latest = [...pool].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
  const qs = new URLSearchParams({ w: String(size), v: String(latest.id) });
  if (campaignId) qs.set('campaignId', campaignId);
  return apiPath(`/children/${childId}/thumb?${qs.toString()}`);
}

function calcAge(birthDate?: string | null, fallback?: number | null) {
  if (birthDate) {
    const d = new Date(birthDate);
    if (!isNaN(d.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
      return age;
    }
  }
  return typeof fallback === 'number' && !isNaN(fallback) ? fallback : undefined;
}

export default function AdminChildrenPage() {
  const { campaigns, campaignId, setCampaignId, ready } = useAdminCampaign();

  // aba e filtros (a aba fica na URL: ?tab=fotos / ?tab=enviar-fotos)
  const [tab, setTab] = useState<Tab>('list');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [location, setLocation] = useState<LocationValue>(EMPTY_LOCATION);
  const [statusFilter, setStatusFilter] = useState<'' | 'available' | 'assigned'>('');
  const [photoFilter, setPhotoFilter] = useState<'' | 'without' | 'with'>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const locationLabel = useLocationLabel(location);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const p = sp.get('photo');
    if (p === 'without' || p === 'with') setPhotoFilter(p); // link do dashboard
    const t = (Object.keys(TAB_PARAM) as Tab[]).find((k) => TAB_PARAM[k] === sp.get('tab'));
    if (t) setTab(t);
  }, []);
  const changeTab = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    const param = TAB_PARAM[t];
    if (param) url.searchParams.set('tab', param); else url.searchParams.delete('tab');
    window.history.replaceState(null, '', url.toString());
  };

  // busca com uma pequena espera para não consultar a cada tecla
  useEffect(() => {
    const t = setTimeout(() => { setQ(qInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const hasFilters = !!(q || location.cityId || statusFilter || photoFilter);
  const clearFilters = () => {
    setQInput(''); setQ(''); setLocation(EMPTY_LOCATION); setStatusFilter(''); setPhotoFilter(''); setPage(1);
  };

  /* ---------- dados da lista ---------- */
  const [rows, setRows] = useState<ChildListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [missingPhotos, setMissingPhotos] = useState<number | null>(null);
  const [stats, setStats] = useState({ total: 0, sponsored: 0, pending: 0, available: 0, rate: 0 });

  const filterParams = () => {
    const qs = new URLSearchParams();
    if (campaignId) qs.set('campaignId', campaignId);
    if (q.trim()) qs.set('q', q.trim());
    if (location.cityId) qs.set('cityId', location.cityId);
    if (location.communityId) qs.set('communityId', location.communityId);
    if (location.schoolId) qs.set('schoolId', location.schoolId);
    if (statusFilter) qs.set('status', statusFilter);
    return qs;
  };

  const load = async () => {
    setLoading(true);
    try {
      const qs = filterParams();
      qs.set('skip', String((page - 1) * pageSize));
      qs.set('take', String(pageSize));
      if (photoFilter) qs.set('photo', photoFilter);
      const res = await fetch(`/api/admin/children?${qs}`, { cache: 'no-store', credentials: 'include' });
      const json = res.ok ? await res.json() : null;
      setRows(Array.isArray(json?.items) ? json.items : []);
      setTotal(typeof json?.total === 'number' ? json.total : 0);
    } catch {
      setRows([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // sem foto: com os mesmos filtros de local (é o que aparece só com a moldura)
  const loadMissingCount = async () => {
    try {
      const qs = filterParams();
      qs.set('photo', 'without'); qs.set('take', '1');
      const r = await fetch(`/api/admin/children?${qs}`, { cache: 'no-store' });
      const j = r.ok ? await r.json() : null;
      setMissingPhotos(typeof j?.total === 'number' ? j.total : null);
    } catch {
      setMissingPhotos(null);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch(`/api/admin/children/stats${campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : ''}`, { cache: 'no-store' });
      const json = res.ok ? await res.json() : {};
      // "apadrinhadas" = concluídas + em andamento (compra, embalado, entrega…)
      const t = json.total ?? 0;
      const sponsored = (json.active ?? 0) + (json.in_progress ?? 0);
      setStats({
        total: t,
        sponsored,
        pending: json.pending ?? 0,
        available: json.available ?? Math.max(0, t - sponsored - (json.pending ?? 0)),
        rate: t ? Math.round((sponsored / t) * 100) : 0,
      });
    } catch {
      setStats({ total: 0, sponsored: 0, pending: 0, available: 0, rate: 0 });
    }
  };

  useEffect(() => {
    if (!ready || tab !== 'list') return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tab, q, page, pageSize, campaignId, location.cityId, location.communityId, location.schoolId, statusFilter, photoFilter]);

  useEffect(() => {
    if (!ready) return;
    loadMissingCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, campaignId, q, location.cityId, location.communityId, location.schoolId, statusFilter]);

  useEffect(() => {
    if (!ready) return;
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, campaignId]);

  /* ---------- envio de foto pela lista ---------- */
  const [frames, setFrames] = useState<{ id: string; config?: unknown; active?: boolean }[]>([]);
  const [frameByCity, setFrameByCity] = useState<Record<string, string>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    setFrames([]); setFrameByCity({});
    if (!campaignId) return;
    (async () => {
      const [rf, rc] = await Promise.all([
        fetch(`/api/admin/campaigns/${campaignId}/layouts`, { cache: 'no-store' }).catch(() => null),
        fetch(`/api/admin/campaigns/${campaignId}/city-layouts`, { cache: 'no-store' }).catch(() => null),
      ]);
      setFrames(rf?.ok ? await rf.json() : []);
      const byCity: { cityId: string; frameId: string }[] = rc?.ok ? await rc.json() : [];
      setFrameByCity(Object.fromEntries(byCity.map((l) => [l.cityId, l.frameId])));
    })();
  }, [campaignId]);

  async function uploadPhoto(child: ChildListItem, file: File) {
    if (!campaignId) return;
    setUploadingId(child.id);
    try {
      const cityId = child.city?.id ?? child.cityId ?? '';
      const frame = frames.find((f) => f.id === frameByCity[cityId]) ?? frames.find((f) => f.active) ?? null;
      const fd = new FormData();
      fd.append('file', file);
      // mesma composição do cadastro guiado: padrão + layout da cidade/campanha
      fd.append('Config', JSON.stringify(composeConfigForFrame(frame?.config)));
      const qs = new URLSearchParams({ campaignId });
      if (frame?.id) qs.set('layoutId', frame.id);
      const res = await fetch(`/api/admin/children/${child.id}/photo?${qs.toString()}`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      await Promise.all([load(), loadMissingCount()]);
    } catch {
      alert(`Não foi possível enviar a foto de ${child.name}.`);
    } finally {
      setUploadingId(null);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const statusOf = (s?: SponsorshipStatus) =>
    !s
      ? { label: 'Disponível', className: 'bg-slate-50 text-slate-700 border-slate-200', dot: 'bg-slate-400' }
      : { label: STATUS_PT[s] ?? s, ...(STATUS_STYLE[s] ?? IN_PROGRESS_STYLE) };

  const statCards = useMemo(() => [
    { label: 'Crianças', value: stats.total, hint: campaignId ? 'na campanha' : 'no cadastro', icon: <Baby className="w-5 h-5 text-blue-600" />, tone: 'bg-blue-100', text: 'text-gray-900' },
    { label: 'Apadrinhadas', value: stats.sponsored, hint: `${stats.rate}% do total`, icon: <Heart className="w-5 h-5 text-emerald-600" />, tone: 'bg-emerald-100', text: 'text-emerald-700' },
    { label: 'Pendentes', value: stats.pending, hint: 'aguardando aprovação', icon: <Clock className="w-5 h-5 text-amber-600" />, tone: 'bg-amber-100', text: 'text-amber-700' },
    { label: 'Disponíveis', value: stats.available, hint: 'sem padrinho', icon: <Gift className="w-5 h-5 text-slate-600" />, tone: 'bg-slate-100', text: 'text-slate-700' },
  ], [stats, campaignId]);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Crianças</h1>
            <p className="text-gray-600 mt-1">Cadastro, fotos e apadrinhamentos das crianças</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/children/bulk" className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-800 px-4 py-2.5 rounded-xl font-semibold border border-gray-200 shadow-sm">
              <Upload className="w-4 h-4" /> Cadastro guiado
            </Link>
            <Link href="/admin/children/update" className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-800 px-4 py-2.5 rounded-xl font-semibold border border-gray-200 shadow-sm">
              <GitCompareArrows className="w-4 h-4" /> Atualizar por planilha
            </Link>
            <Link href="/admin/children/new" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-sm">
              <Plus className="w-4 h-4" /> Nova criança
            </Link>
          </div>
        </div>

        {/* Indicadores */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <div key={s.label} className="bg-white/80 rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-600">{s.label}</p>
                <p className={`text-2xl font-bold ${s.text}`}>{s.value.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-gray-500 truncate">{s.hint}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${s.tone}`}>{s.icon}</div>
            </div>
          ))}
        </div>

        {/* Filtros (valem para as duas abas) */}
        <div className="bg-white/80 rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_24rem] gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">Buscar</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className={`${inputCls} pl-9`}
                  placeholder="Nome, ID, presente ou categoria…"
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                />
              </div>
            </label>
            <CampaignFilter campaigns={campaigns} value={campaignId} onChange={(id) => { setPage(1); setCampaignId(id); }} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr_1fr] gap-3">
            <LocationFilter value={location} onChange={(v) => { setPage(1); setLocation(v); }} />
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">Situação</span>
              <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value as typeof statusFilter); }} className={inputCls}>
                <option value="">Todas</option>
                <option value="available">Disponíveis</option>
                <option value="assigned">Com padrinho / pendente</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">Foto</span>
              <select
                value={photoFilter}
                onChange={(e) => { setPage(1); setPhotoFilter(e.target.value as typeof photoFilter); }}
                className={inputCls}
                disabled={tab !== 'list'}
                title={tab === 'photos' ? 'A conferência mostra só quem tem foto' : tab === 'upload' ? 'O envio em lote mostra só quem está sem foto' : undefined}
              >
                <option value="">Todas</option>
                <option value="without">Sem foto{campaignId ? ' na campanha' : ''}</option>
                <option value="with">Com foto</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!!missingPhotos && (
              <button
                onClick={() => { changeTab('list'); setPage(1); setPhotoFilter(photoFilter === 'without' ? '' : 'without'); }}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border ${
                  photoFilter === 'without' && tab === 'list' ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <Camera className="w-4 h-4" />
                {missingPhotos} sem foto{campaignId ? ' nesta campanha' : ''}{locationLabel ? ` · ${locationLabel}` : ''}
              </button>
            )}
            {!!missingPhotos && !!campaignId && tab !== 'upload' && (
              <button
                onClick={() => changeTab('upload')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                <ImagePlus className="w-4 h-4" /> Enviar fotos em lote
              </button>
            )}
            {hasFilters && (
              <button onClick={clearFilters} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
                <FilterX className="w-4 h-4" /> Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Abas */}
        <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto no-scrollbar">
          {([
            ['list', 'Crianças', <List key="i" className="w-4 h-4" />],
            ['photos', 'Verificar fotos', <ScanFace key="i" className="w-4 h-4" />],
            ['upload', 'Enviar fotos em lote', <ImagePlus key="i" className="w-4 h-4" />],
          ] as [Tab, string, ReactNode][]).map(([key, label, icon]) => (
            <button
              key={key}
              onClick={() => changeTab(key)}
              className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
                tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {tab === 'upload' ? (
          campaignId ? (
            <BulkPhotoUpload
              campaignId={campaignId}
              location={location}
              locationLabel={locationLabel}
              q={q}
              onUploaded={loadMissingCount}
            />
          ) : (
            <div className="py-16 text-center text-gray-600 bg-white/80 rounded-2xl border border-gray-100">
              Escolha uma campanha no filtro acima para enviar as fotos que faltam nela.
            </div>
          )
        ) : tab === 'photos' ? (
          campaignId ? (
            <PhotoReview campaignId={campaignId} location={location} locationLabel={locationLabel} q={q} />
          ) : (
            <div className="py-16 text-center text-gray-600 bg-white/80 rounded-2xl border border-gray-100">
              Escolha uma campanha no filtro acima para conferir as fotos dela.
            </div>
          )
        ) : (
          <>
            <div className="bg-white/80 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 text-sm text-gray-600">
                <span>
                  {loading ? 'Carregando…' : `${total.toLocaleString('pt-BR')} criança${total === 1 ? '' : 's'}`}
                  {locationLabel && ` · ${locationLabel}`}
                </span>
                <label className="inline-flex items-center gap-2">
                  Por página
                  <select value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }} className="px-2 py-1 border border-gray-200 rounded-lg bg-white">
                    {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>
              {/* celular: cartões em vez da tabela */}
              <ul className="md:hidden divide-y divide-gray-100">
                {loading && <li className="px-4 py-12 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin inline" /></li>}
                {!loading && rows.length === 0 && (
                  <li className="px-4 py-12 text-center">
                    <p className="text-gray-600 font-medium">Nenhuma criança encontrada</p>
                    <p className="text-gray-400 text-sm">Ajuste os filtros ou cadastre uma nova criança</p>
                  </li>
                )}
                {!loading && rows.map((child) => {
                  const age = calcAge(child.birthDate, child.age);
                  const st = statusOf(child.sponsorships?.[0]?.status);
                  const thumb = thumbUrl(child.id, child.images, campaignId, 160);
                  const city = child.city?.name ? `${child.city.name}${child.city.state ? `/${child.city.state}` : ''}` : child.cityName || '—';
                  return (
                    <li key={child.id} className="p-3 flex gap-3">
                      <Link href={`/admin/children/${child.id}`} className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt={child.name} width={80} height={80} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        ) : uploadingId === child.id ? (
                          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                        ) : (
                          <Camera className="w-6 h-6 text-gray-400" />
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/children/${child.id}`} className="block text-sm font-semibold text-gray-900 leading-snug">
                          <span className="text-gray-500 font-medium">{child.publicId}</span> · {child.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-gray-600 truncate">
                          {age !== undefined ? `${age} ${age === 1 ? 'ano' : 'anos'} · ` : ''}{child.community?.name ?? city}
                        </p>
                        {child.wantedGift && <p className="text-xs text-gray-500 line-clamp-1">🎁 {child.wantedGift}</p>}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${st.className}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                          </span>
                          {child.category && <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{child.category}</span>}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Link href={`/admin/children/${child.id}`} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                            <Edit className="w-4 h-4" /> Editar
                          </Link>
                          {!thumb && campaignId && (
                            <label className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 rounded-lg border border-gray-200 bg-white cursor-pointer ${uploadingId ? 'pointer-events-none opacity-50' : ''}`}>
                              <Upload className="w-4 h-4" /> Foto
                              {/* no celular o seletor já oferece câmera ou galeria */}
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadPhoto(child, f); }} />
                            </label>
                          )}
                          <span className="ml-auto"><DeleteChildButton id={child.id} name={child.name} onDone={load} /></span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <th className="px-4 py-3">Criança</th>
                      <th className="px-4 py-3">Idade</th>
                      <th className="px-4 py-3">Local</th>
                      <th className="px-4 py-3">Presente</th>
                      <th className="px-4 py-3">Situação</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading && (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin inline" /></td></tr>
                    )}
                    {!loading && rows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center">
                          <p className="text-gray-600 font-medium">Nenhuma criança encontrada</p>
                          <p className="text-gray-400 text-sm">Ajuste os filtros ou cadastre uma nova criança</p>
                        </td>
                      </tr>
                    )}
                    {!loading && rows.map((child) => {
                      const age = calcAge(child.birthDate, child.age);
                      const st = statusOf(child.sponsorships?.[0]?.status);
                      const thumb = thumbUrl(child.id, child.images, campaignId);
                      const city = child.city?.name ? `${child.city.name}${child.city.state ? `/${child.city.state}` : ''}` : child.cityName || '—';
                      return (
                        <tr key={child.id} className="hover:bg-blue-50/40">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                                {thumb ? (
                                  // miniatura da foto (sem moldura), com carregamento sob demanda
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={thumb} alt={child.name} width={56} height={56} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                ) : uploadingId === child.id ? (
                                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                                ) : (
                                  <Camera className="w-5 h-5 text-gray-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <Link href={`/admin/children/${child.id}`} className="text-sm font-semibold text-gray-900 hover:underline">
                                  <span className="text-gray-500 font-medium">{child.publicId}</span> · {child.name}
                                </Link>
                                {child.category && <span className="ml-2 text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{child.category}</span>}
                                {/* sem foto: envio direto daqui, montado com o layout da cidade na campanha */}
                                {!thumb && campaignId && (
                                  <label className={`mt-1 flex w-fit items-center gap-1 text-xs text-blue-700 hover:underline cursor-pointer ${uploadingId ? 'pointer-events-none opacity-50' : ''}`}>
                                    <Upload className="w-3 h-3" /> Enviar foto
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadPhoto(child, f); }} />
                                  </label>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                            {age !== undefined ? `${age} ${age === 1 ? 'ano' : 'anos'}` : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            <div className="flex items-start gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p>{child.community?.name ?? city}</p>
                                {child.community?.name && <p className="text-xs text-gray-500">{city}</p>}
                                {child.school?.name && <p className="text-xs text-gray-500 flex items-center gap-1"><School className="w-3 h-3" />{child.school.name}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 max-w-[14rem]">
                            {child.wantedGift ? <span className="line-clamp-2">{child.wantedGift}</span> : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${st.className}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Link href={`/admin/children/${child.id}`} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200">
                                <Edit className="w-4 h-4" /> Editar
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

            {pages > 1 && <Pagination page={page} pages={pages} onChange={setPage} />}
          </>
        )}
      </div>
    </div>
  );
}

function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
      >
        <ChevronLeft className="w-4 h-4" /> Anterior
      </button>
      <span className="text-sm text-gray-700">Página {page} de {pages}</span>
      <button
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        onClick={() => onChange(Math.min(pages, page + 1))}
        disabled={page >= pages}
      >
        Próxima <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function DeleteChildButton({ id, name, onDone }: { id: string; name: string; onDone: () => void }) {
  const del = async () => {
    if (!confirm(`Excluir "${name}"? A criança sai das listagens e campanhas; o histórico é mantido no banco.`)) return;
    // exclusão lógica do backend (marca deletedAt)
    const res = await fetch(`/api/admin/children/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) { alert('Falha ao excluir.'); return; }
    onDone();
  };
  return (
    <button onClick={del} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200" title="Excluir">
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
