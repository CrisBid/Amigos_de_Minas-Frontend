'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Filter, Search, Loader2, AlertCircle, X, CheckSquare, Square } from 'lucide-react';
import Stats from '@/components/Apadrinhamento/Stats';
import ChildCard from '@/components/Apadrinhamento/ChildCard';

// 🔽 Core unificado de status (front-only)
import {
  type SponsorshipStatus,
  ACTIVE_STATUSES,
} from '@/lib/sponsorship-status';

type City = { id: string; publicId?: number | null; name: string; state?: string | null; };
type Community = { id: string; publicId?: number | null; cityId?: string | null; name: string; slug?: string | null; description?: string | null; };
type SchoolObj = { id: string; publicId?: number | null; name: string; slug?: string | null; address?: string | null; };

type ImageConfig = {
  version: number;
  canvas: { width: number; height: number; background: string | null };
  layout: { onTop?: boolean; opacity?: number; resizeToCanvas?: boolean };
  photoRect: {
    x: number; y: number; width: number; height: number;
    fit: 'cover' | 'contain';
    scale: number;
    gravity: 'north'|'northeast'|'east'|'southeast'|'south'|'southwest'|'west'|'northwest'|'center';
    offsetX: number; offsetY: number; cornerRadius: number;
  };
  texts: any[];
};

type ChildImage = {
  id: string; childId: string; campaignId: string;
  originalKey: string | null; originalUrl: string | null;
  processedKey: string | null; processedUrl: string | null;
  framedKey: string | null; framedUrl: string | null;
  layoutKey: string | null; layoutUrl: string | null;
  Config: ImageConfig; width: number | null; height: number | null;
  status: 'UPLOADED'|'PROCESSED'|'COMPOSED'|string;
  notes: string | null; version: number; createdAt: string; updatedAt: string;
};

type Child = {
  id: string; publicId?: number | null; name: string;
  birthDate?: string | Date | null; age?: number | null;
  cityName?: string | null; schoolLegacy?: string | null;
  city?: City | null; community?: Community | null; school?: SchoolObj | null;
  category?: string | null; wantedGift?: string | null; description?: string | null;
  photoUrl?: string | null; photoKey?: string | null;
  sponsorships?: Array<{ id: string; status: SponsorshipStatus; campaignId: string; createdAt?: string }>;
  sponsorshipStatus: SponsorshipStatus | 'NONE';
  media?: Array<{ framedUrl?: string; processedUrl?: string }>;
  images?: ChildImage[];
};

type Campaign = { id: string; name: string; slug: string; year?: number; status: 'DRAFT'|'ACTIVE'|'FINISHED'|'ARCHIVED' };
type Props = { initialScanFs: boolean };
type StatusFiltro = '' | 'disponivel' | 'apadrinhado';

const FAIXAS_ETARIAS = ['0-3 anos','4-6 anos','7-9 anos','10-12 anos','13+ anos'];

// ===== helpers =====
function normalizeStatus(s?: string): SponsorshipStatus | 'NONE' {
  const allowed = new Set<string>([
    'PENDING',
    'IN_PROGRESS',
    'IN_PURCHASE',
    'PACKED',
    'BOXED',
    'AWAITING_DELIVERY',
    'COMPLETED',
    'ENDED',
    'CANCELLED',
  ]);
  if (!s) return 'NONE';
  return (allowed.has(s) ? (s as SponsorshipStatus) : 'NONE');
}

async function safeErrMsg(res: Response) {
  try {
    const d = await res.json();
    return (d as any)?.message || (d as any)?.error || res.statusText;
  } catch { return res.statusText; }
}

function calcularIdade(birthDate?: string | Date | null): number {
  if (!birthDate) return 0;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return 0;
  const hoje = new Date();
  let idade = hoje.getFullYear() - d.getFullYear();
  if (hoje.getMonth() < d.getMonth() || (hoje.getMonth() === d.getMonth() && hoje.getDate() < d.getDate())) idade--;
  return idade;
}
function parseFaixa(fo?: string): { minAge?: number; maxAge?: number } {
  switch (fo) {
    case '0-3 anos': return { minAge: 0, maxAge: 3 };
    case '4-6 anos': return { minAge: 4, maxAge: 6 };
    case '7-9 anos': return { minAge: 7, maxAge: 9 };
    case '10-12 anos': return { minAge: 10, maxAge: 12 };
    case '13+ anos': return { minAge: 13 };
    default: return {};
  }
}

type CategoryItem = { category: string; count?: number };

export default function ApadrinhamentoClient({ initialScanFs }: Props) {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      const returnTo =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : '/apadrinhamento';
      router.replace(`/auth/signin?returnTo=${encodeURIComponent(returnTo)}`);
    },
  });
  const router = useRouter();
  const api = process.env.NEXT_PUBLIC_NEST_API_URL;

  // campanhas
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState<string>('');

  // paginação
  const PAGE_SIZE = 24;
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const nextSkipRef = useRef(0);

  const [sponsoringId, setSponsoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanFs, setScanFs] = useState<boolean>(initialScanFs);

  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, available: 0, sponsorshipRate: 0 });

  const [searchTerm, setSearchTerm] = useState('');
  // filtros por ID
  const [filtros, setFiltros] = useState({
    cidadeId: '',
    comunidadeId: '',
    escolaId: '',
    categoria: '',
    idade: '',
    status: 'disponivel' as StatusFiltro,
  });

  // >>> seleção múltipla
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // opções do backend
  const [citiesOpt, setCitiesOpt] = useState<City[]>([]);
  const [communitiesOpt, setCommunitiesOpt] = useState<Community[]>([]);
  const [schoolsOpt, setSchoolsOpt] = useState<SchoolObj[]>([]);
  const [categoriesOpt, setCategoriesOpt] = useState<CategoryItem[]>([]);
  const [loadingOptions, setLoadingOptions] = useState({ cities: false, communities: false, schools: false, categories: false });

  // sentinela
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ===== campanhas =====
  useEffect(() => {
    if (!api) { setError('Defina NEXT_PUBLIC_NEST_API_URL.'); setLoading(false); return; }
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [cRes, allRes] = await Promise.all([
          fetch(`${api}/campaigns?status=ACTIVE`, { cache: 'no-store' }),
          fetch(`${api}/campaigns`, { cache: 'no-store' }),
        ]);
        const active = cRes.ok ? await cRes.json() : [];
        const all = allRes.ok ? await allRes.json() : [];
        const byId = new Map<string, Campaign>();
        [...active, ...all].forEach((c: Campaign) => byId.set(c.id, c));
        const unique = Array.from(byId.values()).sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
        setCampaigns(unique);
        setCampaignId(unique[0]?.id || '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao carregar campanhas.');
      } finally { setLoading(false); }
    })();
  }, [api]);

  // ===== stats (por campanha selecionada) =====
  useEffect(() => {
    if (!campaignId) return;
    (async () => {
      try {
        const url = new URL('/api/admin/children/stats', window.location.origin);
        url.searchParams.set('campaignId', campaignId);
        const res = await fetch(url.toString(), { cache: 'no-store', credentials: 'include', headers: { accept: 'application/json' } });
        if (res.ok) {
          const j = await res.json();
          setStats({
            total: j.total ?? 0,
            active: j.active ?? 0,
            pending: j.pending ?? 0,
            available: j.available ?? Math.max(0, (j.total ?? 0) - ((j.active ?? 0) + (j.pending ?? 0))),
            sponsorshipRate: j.sponsorshipRate ?? (j.total ? Math.round(((j.active ?? 0) / j.total) * 100) : 0),
          });
        } else {
          setStats({ total: 0, active: 0, pending: 0, available: 0, sponsorshipRate: 0 });
        }
      } catch {
        setStats({ total: 0, active: 0, pending: 0, available: 0, sponsorshipRate: 0 });
      }
    })();
  }, [campaignId]);

  // ===== opções =====
  const fetchCities = useCallback(async () => {
    if (!api) return;
    setLoadingOptions(prev => ({ ...prev, cities: true }));
    try {
      const res = await fetch(`${api}/cities`, { cache: 'no-store' });
      if (!res.ok) throw new Error(await safeErrMsg(res));
      const data = await res.json();
      setCitiesOpt(Array.isArray(data) ? data : (data?.items ?? []));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar cidades.');
      setCitiesOpt([]);
    } finally {
      setLoadingOptions(prev => ({ ...prev, cities: false }));
    }
  }, [api]);

  const fetchCommunities = useCallback(async (cityId?: string) => {
    if (!api) return;
    setLoadingOptions(prev => ({ ...prev, communities: true }));
    try {
      const url = new URL(`${api}/communities`);
      if (cityId) url.searchParams.set('cityId', cityId);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(await safeErrMsg(res));
      const data = await res.json();
      setCommunitiesOpt(Array.isArray(data) ? data : (data?.items ?? []));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar comunidades.');
      setCommunitiesOpt([]);
    } finally {
      setLoadingOptions(prev => ({ ...prev, communities: false }));
    }
  }, [api]);

  const fetchSchools = useCallback(async (cityId?: string, communityId?: string) => {
    if (!api) return;
    setLoadingOptions(prev => ({ ...prev, schools: true }));
    try {
      const url = new URL(`${api}/schools`);
      if (cityId) url.searchParams.set('cityId', cityId);
      if (communityId) url.searchParams.set('communityId', communityId);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(await safeErrMsg(res));
      const data = await res.json();
      setSchoolsOpt(Array.isArray(data) ? data : (data?.items ?? []));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar escolas.');
      setSchoolsOpt([]);
    } finally {
      setLoadingOptions(prev => ({ ...prev, schools: false }));
    }
  }, [api]);

  // >>> categorias (via /children/categories)
  const fetchCategories = useCallback(async () => {
    if (!api) return;
    setLoadingOptions(prev => ({ ...prev, categories: true }));
    try {
      const url = new URL(`${api}/children/categories`);
      if (campaignId) url.searchParams.set('campaignId', campaignId);

      const q = searchTerm.trim();
      if (q) url.searchParams.set('q', q);
      if (filtros.cidadeId) url.searchParams.set('cityId', filtros.cidadeId);
      if (filtros.comunidadeId) url.searchParams.set('communityId', filtros.comunidadeId);
      if (filtros.escolaId) url.searchParams.set('schoolId', filtros.escolaId);
      if (filtros.status === 'disponivel') url.searchParams.set('status', 'available');
      if (filtros.status === 'apadrinhado') url.searchParams.set('status', 'assigned');
      const { minAge, maxAge } = parseFaixa(filtros.idade);
      if (typeof minAge === 'number') url.searchParams.set('minAge', String(minAge));
      if (typeof maxAge === 'number') url.searchParams.set('maxAge', String(maxAge));

      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(await safeErrMsg(res));
      const data = await res.json();

      const items = Array.isArray(data)
        ? data.map((c: any) => (typeof c === 'string' ? { category: c } : c))
        : (data?.items ?? []);
      setCategoriesOpt(items.filter((it: any) => !!it?.category));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar categorias.');
      setCategoriesOpt([]);
    } finally {
      setLoadingOptions(prev => ({ ...prev, categories: false }));
    }
  }, [api, campaignId, searchTerm, filtros.cidadeId, filtros.comunidadeId, filtros.escolaId, filtros.status, filtros.idade]);

  // carregar cidades ao escolher campanha
  useEffect(() => {
    if (!campaignId) return;
    fetchCities();
  }, [campaignId, fetchCities]);

  // quando muda cidade
  useEffect(() => {
    const cid = filtros.cidadeId || undefined;
    setFiltros(prev => ({ ...prev, comunidadeId: '', escolaId: '' }));
    fetchCommunities(cid);
    fetchSchools(cid, undefined);
  }, [filtros.cidadeId, fetchCommunities, fetchSchools]);

  // quando muda comunidade
  useEffect(() => {
    const cid = filtros.cidadeId || undefined;
    const coid = filtros.comunidadeId || undefined;
    setFiltros(prev => ({ ...prev, escolaId: '' }));
    fetchSchools(cid, coid);
  }, [filtros.comunidadeId, fetchSchools, filtros.cidadeId]);

  // ===== map do backend
  const mapChildren = useCallback((data: any[], selectedCampaignId: string): Child[] => {
    return (data ?? []).map((c: any) => {
      // /children já traz sponsorships filtrados (BUSY) e, quando campaignId é enviado,
      // também por campaignId, ordenados desc e take 1 — basta pegar o primeiro.
      const rel = Array.isArray(c.sponsorships) && c.sponsorships.length > 0 ? c.sponsorships[0] : null;
      const status = normalizeStatus(rel?.status);
      return {
        id: c.id,
        publicId: c.publicId ?? null,
        name: c.name,
        birthDate: c.birthDate ?? null,
        age: c.age ?? null,
        cityName: c.city?.name ?? c.cityName ?? null,
        schoolLegacy: c.schoolLegacy ?? null,
        city: c.city ?? null,
        community: c.community ?? null,
        school: c.school ?? null,
        category: c.category ?? null,
        wantedGift: c.wantedGift ?? null,
        description: c.description ?? null,
        photoUrl: c.photoUrl ?? null,
        photoKey: c.photoKey ?? null,
        sponsorships: Array.isArray(c.sponsorships) ? c.sponsorships : [],
        sponsorshipStatus: status,
        media: Array.isArray(c.media) ? c.media : undefined,
        images: c.images,
      } as Child;
    });
  }, []);

  // ===== build URL com filtros por ID =====
  const buildUrl = useCallback((skip: number, take: number) => {
    const url = new URL(`${api}/children`);
    url.searchParams.set('campaignId', campaignId);
    url.searchParams.set('skip', String(skip));
    url.searchParams.set('take', String(take));
    if (scanFs) url.searchParams.set('scan', '1');

    const q = searchTerm.trim();
    if (q) url.searchParams.set('q', q);

    if (filtros.cidadeId) url.searchParams.set('cityId', filtros.cidadeId);
    if (filtros.comunidadeId) url.searchParams.set('communityId', filtros.comunidadeId);
    if (filtros.escolaId) url.searchParams.set('schoolId', filtros.escolaId);

    if (filtros.categoria) url.searchParams.set('category', filtros.categoria);

    if (filtros.status === 'disponivel') url.searchParams.set('status', 'available');
    if (filtros.status === 'apadrinhado') url.searchParams.set('status', 'assigned');

    const { minAge, maxAge } = parseFaixa(filtros.idade);
    if (typeof minAge === 'number') url.searchParams.set('minAge', String(minAge));
    if (typeof maxAge === 'number') url.searchParams.set('maxAge', String(maxAge));

    return url;
  }, [api, campaignId, scanFs, filtros, searchTerm]);

  // ===== fetch página =====
  const fetchPage = useCallback(async (opts?: { reset?: boolean; skip?: number }) => {
    if (!campaignId || !api) return;

    const reset = !!opts?.reset;
    const take = PAGE_SIZE;
    const skip = typeof opts?.skip === 'number' ? opts.skip : nextSkipRef.current;

    const url = buildUrl(skip, take);

    try {
      if (reset) { setLoading(true); setError(null); } else { setLoadingMore(true); }

      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(await safeErrMsg(res));
      const json = await res.json();

      const itemsRaw: any[] = Array.isArray(json) ? json : (json?.items ?? []);
      const mapped = mapChildren(itemsRaw, campaignId);

      if (reset) {
        setChildren(mapped);
        nextSkipRef.current = mapped.length;
        setSelectedIds(new Set());
      } else {
        setChildren(prev => [...prev, ...mapped]);
        nextSkipRef.current = skip + mapped.length;
      }

      const serverHasMore =
        !Array.isArray(json) && typeof json?.hasMore === 'boolean'
          ? Boolean(json.hasMore)
          : mapped.length === take;

      setHasMore(serverHasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar crianças.');
    } finally {
      if (reset) setLoading(false); else setLoadingMore(false);
    }
  }, [api, campaignId, buildUrl, mapChildren]);

  // ===== reset ao trocar campanha/scan =====
  useEffect(() => {
    if (!campaignId) return;
    setChildren([]); setHasMore(true); nextSkipRef.current = 0;
    fetchPage({ reset: true, skip: 0 });
  }, [campaignId, scanFs, fetchPage]);

  // ===== debounce busca/filtros =====
  const debounceTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!campaignId) return;
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      setChildren([]); setHasMore(true); nextSkipRef.current = 0;
      fetchPage({ reset: true, skip: 0 });
    }, 300);
    return () => { if (debounceTimer.current) window.clearTimeout(debounceTimer.current); };
  }, [campaignId, filtros, searchTerm, fetchPage]);

  // >>> debounce para categorias
  const debounceCats = useRef<number | null>(null);
  useEffect(() => {
    if (!campaignId) return;
    if (debounceCats.current) window.clearTimeout(debounceCats.current);
    debounceCats.current = window.setTimeout(() => {
      fetchCategories();
    }, 250);
    return () => { if (debounceCats.current) window.clearTimeout(debounceCats.current); };
  }, [campaignId, searchTerm, filtros.cidadeId, filtros.comunidadeId, filtros.escolaId, filtros.status, filtros.idade, fetchCategories]);

  // ===== infinite scroll =====
  useEffect(() => {
    if (!sentinelRef.current) return;
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }

    observerRef.current = new IntersectionObserver(
      entries => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (!hasMore || loading || loadingMore) return;
        fetchPage();
      },
      { root: null, rootMargin: '600px 0px', threshold: 0 }
    );

    observerRef.current.observe(sentinelRef.current);
    return () => { observerRef.current?.disconnect(); observerRef.current = null; };
  }, [hasMore, loading, loadingMore, fetchPage]);

  // ===== ação apadrinhar (single) =====
  async function handleSponsor(childId: string) {
    if (!campaignId) { setError('Selecione uma campanha.'); return; }
    setSponsoringId(childId);
    try {
      if (status === 'authenticated') {
        router.push(`/apadrinhamento/concluir?childId=${encodeURIComponent(childId)}&campaignId=${encodeURIComponent(campaignId)}`);
      } else {
        router.push(`/apadrinhamento/registro?childId=${encodeURIComponent(childId)}&campaignId=${encodeURIComponent(campaignId)}`);
      }
    } finally { setSponsoringId(null); }
  }

  // ===== seleção múltipla =====
  const isUnavailable = (s: SponsorshipStatus | 'NONE') => (s !== 'NONE') && ACTIVE_STATUSES.includes(s as SponsorshipStatus);

  function toggleSelect(id: string, status: SponsorshipStatus | 'NONE') {
    if (isUnavailable(status)) return; // não permite selecionar indisponíveis
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function selectAllPageAvailable() {
    const next = new Set(selectedIds);
    childrenFiltradas.forEach(ch => {
      if (!isUnavailable(ch.sponsorshipStatus)) next.add(ch.id);
    });
    setSelectedIds(next);
  }

  async function handleBulkSponsor() {
    if (!campaignId) { setError('Selecione uma campanha.'); return; }
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (ids.length === 1) {
      return handleSponsor(ids[0]);
    }

    const childIdsParam = encodeURIComponent(ids.join(','));
    if (status === 'authenticated') {
      router.push(`/apadrinhamento/concluir?childIds=${childIdsParam}&campaignId=${encodeURIComponent(campaignId)}`);
    } else {
      router.push(`/apadrinhamento/registro?childIds=${childIdsParam}&campaignId=${encodeURIComponent(campaignId)}`);
    }
  }

  // ===== filtros locais (reforço) =====
  const childrenFiltradas = useMemo(() => {
    return children.filter((child) => {
      const matchesSearch = child.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategoria = !filtros.categoria || child.category === filtros.categoria;

      const isIndisp = isUnavailable(child.sponsorshipStatus);
      const matchesStatus =
        !filtros.status ||
        (filtros.status === 'disponivel' && !isIndisp) ||
        (filtros.status === 'apadrinhado' && isIndisp);

      let matchesIdade = true;
      const idadeBase = (child.age ?? calcularIdade(child.birthDate)) || 0;
      switch (filtros.idade) {
        case '0-3 anos':   matchesIdade = idadeBase <= 3; break;
        case '4-6 anos':   matchesIdade = idadeBase >= 4 && idadeBase <= 6; break;
        case '7-9 anos':   matchesIdade = idadeBase >= 7 && idadeBase <= 9; break;
        case '10-12 anos': matchesIdade = idadeBase >= 10 && idadeBase <= 12; break;
        case '13+ anos':   matchesIdade = idadeBase >= 13; break;
      }

      return matchesSearch && matchesCategoria && matchesStatus && matchesIdade;
    });
  }, [children, searchTerm, filtros]);

  function limparFiltros() {
    setFiltros({ cidadeId: '', comunidadeId: '', escolaId: '', categoria: '', idade: '', status: 'disponivel' });
    setSearchTerm('');
  }

  const selectedCount = selectedIds.size;

  if (status === 'loading') {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16 text-gray-600 flex items-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Carregando sua sessão…
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Crianças Para Apadrinhamento</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Campanha:</label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.year ? ` (${c.year})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {status !== 'authenticated' && (
        <div className="mb-4 text-sm text-gray-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          Você pode navegar livremente. Para concluir o apadrinhamento, faremos um cadastro rápido no próximo passo. 💚
        </div>
      )}

      <Stats stats={stats} />

      {error && (
        <div className="mt-4 mb-2 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Filter className="h-5 w-5 text-gray-600 mr-2" />
            <h2 className="text-lg font-bold text-gray-800">Filtros e Busca</h2>
          </div>
          <button onClick={limparFiltros} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800" title="Limpar filtros">
            <X className="w-4 h-4" /> Limpar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="sm:col-span-2 xl:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Cidade (IDs) */}
          <select
            value={filtros.cidadeId}
            onChange={(e) => setFiltros({ ...filtros, cidadeId: e.target.value, comunidadeId: '', escolaId: '' })}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">{loadingOptions.cities ? 'Carregando…' : 'Todas as cidades'}</option>
            {citiesOpt.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Comunidade (IDs) */}
          <select
            value={filtros.comunidadeId}
            onChange={(e) => setFiltros({ ...filtros, comunidadeId: e.target.value, escolaId: '' })}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
            disabled={!filtros.cidadeId && communitiesOpt.length === 0}
          >
            <option value="">{loadingOptions.communities ? 'Carregando…' : 'Todas as comunidades'}</option>
            {communitiesOpt.map((co) => (
              <option key={co.id} value={co.id}>{co.name}</option>
            ))}
          </select>

          {/* Escola (IDs) */}
          <select
            value={filtros.escolaId}
            onChange={(e) => setFiltros({ ...filtros, escolaId: e.target.value })}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
            disabled={schoolsOpt.length === 0 && !filtros.cidadeId && !filtros.comunidadeId}
          >
            <option value="">{loadingOptions.schools ? 'Carregando…' : 'Todas as escolas'}</option>
            {schoolsOpt.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* >>> Categoria (via /children/categories) */}
          <select
            value={filtros.categoria}
            onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">
              {loadingOptions.categories ? 'Carregando…' : 'Todas as categorias'}
            </option>
            {categoriesOpt.map((it) => (
              <option key={it.category} value={it.category}>
                {it.category}{typeof it.count === 'number' ? ` (${it.count})` : ''}
              </option>
            ))}
          </select>

          <select
            value={filtros.status}
            onChange={(e) => setFiltros({ ...filtros, status: e.target.value as StatusFiltro })}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">Todos os status</option>
            <option value="disponivel">Disponíveis</option>
            <option value="apadrinhado">Indisponíveis</option>
          </select>

          <select
            value={filtros.idade}
            onChange={(e) => setFiltros({ ...filtros, idade: e.target.value })}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">Todas as idades</option>
            {FAIXAS_ETARIAS.map((f) => (<option key={f} value={f}>{f}</option>))}
          </select>
        </div>
      </div>

      {/* Ações em massa acima da grid */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-700">
          {selectedCount > 0 ? (
            <span>
              <strong>{selectedCount}</strong> selecionada{selectedCount > 1 ? 's' : ''}.
            </span>
          ) : (
            <span>Selecione múltiplas crianças para apadrinhar em lote.</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectAllPageAvailable}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm"
            title="Seleciona todas desta página que estiverem disponíveis"
          >
            <CheckSquare className="w-4 h-4" />
            Selecionar página (disponíveis)
          </button>
          <button
            onClick={clearSelection}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm"
          >
            <Square className="w-4 h-4" />
            Limpar seleção
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {childrenFiltradas.map((child) => {
          const nomeCidade = child.city?.name ?? child.cityName ?? '';
          const idadeCalculada = (child.age ?? calcularIdade(child.birthDate)) || 0;
          const unavailable = isUnavailable(child.sponsorshipStatus);
          const checked = selectedIds.has(child.id);

          return (
            <div key={String(child.id)} className="relative group">
              {/* Checkbox/selector sobre o card */}
              <button
                type="button"
                onClick={() => toggleSelect(child.id, child.sponsorshipStatus)}
                disabled={unavailable}
                className={[
                  'absolute z-10 top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium shadow',
                  unavailable
                    ? 'cursor-not-allowed bg-gray-100 text-gray-400 border border-gray-200'
                    : checked
                      ? 'bg-emerald-600 text-white border border-emerald-700'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                ].join(' ')}
                title={unavailable ? 'Indisponível para seleção' : checked ? 'Remover da seleção' : 'Selecionar'}
              >
                {checked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                {unavailable ? 'Indisp.' : checked ? 'Selecionado' : 'Selecionar'}
              </button>

              {/* Highlight quando selecionado */}
              <div className={checked ? 'ring-2 ring-emerald-500 rounded-2xl transition' : ''}>
                <ChildCard
                  child={{
                    id: child.id,
                    publicId: child.publicId ?? 0,
                    nome: child.name,
                    idade: idadeCalculada,
                    cidade: nomeCidade,
                    escola: child.school?.name ?? child.schoolLegacy ?? '',
                    categoria: child.category ?? '',
                    presente: child.wantedGift ?? '',
                    descricao: child.description ?? '',
                    apadrinhado: unavailable,
                    foto: child.photoUrl ?? '',
                    images: child.images,
                    status: child.sponsorshipStatus,
                    comunidade: child.community?.name ?? '',
                  }}
                  onSponsor={() => handleSponsor(child.id)}
                  sponsoring={sponsoringId === child.id}
                />
              </div>
            </div>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-600 py-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando…
        </div>
      )}

      <div ref={sentinelRef} className="h-1" />

      {!loading && hasMore && (
        <div className="flex flex-col items-center py-6">
          {loadingMore ? (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando mais…
            </div>
          ) : (
            <button className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50" onClick={() => fetchPage()}>
              Carregar mais
            </button>
          )}
        </div>
      )}

      {!loading && !loadingMore && !hasMore && childrenFiltradas.length > 0 && (
        <div className="text-center text-gray-500 py-6">Você chegou ao fim da lista. 🎉</div>
      )}

      {!loading && childrenFiltradas.length === 0 && (
        <div className="text-center text-gray-500 py-10">Nenhuma criança encontrada com os filtros aplicados.</div>
      )}

      {/* ===== Barra fixa de ação em massa ===== */}
      {selectedCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] sm:w-auto">
          <div className="mx-auto flex items-center gap-3 bg-white border border-emerald-200 shadow-xl rounded-2xl px-4 py-3">
            <span className="text-sm text-gray-800">
              <strong>{selectedCount}</strong> criança{selectedCount > 1 ? 's' : ''} selecionada{selectedCount > 1 ? 's' : ''}.
            </span>
            <button
              onClick={handleBulkSponsor}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
            >
              Concluir apadrinhamento em massa
            </button>
            <button
              onClick={clearSelection}
              className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm"
            >
              Limpar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
