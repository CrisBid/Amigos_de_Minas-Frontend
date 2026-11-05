'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Filter, Search, Loader2, AlertCircle, X, CheckSquare, Square, SlidersHorizontal, Heart, Sparkles, ClipboardCheck, Gift, Users } from 'lucide-react';
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

/** Idade pela data de nascimento (guardada em UTC); sem data, a idade informada no cadastro. */
function idadeDe(child: { birthDate?: string | Date | null; age?: number | null }): number | undefined {
  if (child.birthDate) {
    const d = new Date(child.birthDate);
    if (!isNaN(d.getTime())) {
      const hoje = new Date();
      let idade = hoje.getUTCFullYear() - d.getUTCFullYear();
      if (hoje.getUTCMonth() < d.getUTCMonth() || (hoje.getUTCMonth() === d.getUTCMonth() && hoje.getUTCDate() < d.getUTCDate())) idade--;
      return idade;
    }
  }
  return typeof child.age === 'number' ? child.age : undefined;
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
type LocationOption = { id: string; name: string; count?: number };

// valor do filtro para as crianças sem categoria
const NO_CATEGORY = '__none__';
// acima disso, "selecionar todas" pede confirmação
const BULK_CONFIRM = 50;

/** Mantém na lista a opção escolhida mesmo sem crianças no recorte atual, para o select não ficar em branco. */
function keepSelected(list: LocationOption[], prev: LocationOption[], selectedId: string) {
  if (!selectedId || list.some((o) => o.id === selectedId)) return list;
  const old = prev.find((o) => o.id === selectedId);
  return old ? [...list, { ...old, count: 0 }] : list;
}

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

  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, in_progress: 0, available: 0, sponsorshipRate: 0 });

  const [total, setTotal] = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  // a busca só vai ao servidor depois de uma pausa na digitação
  const [debouncedSearch, setDebouncedSearch] = useState('');
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
  // celular: filtros de local/categoria/idade ficam recolhidos
  const [showFilters, setShowFilters] = useState(false);

  // opções do backend
  const [citiesOpt, setCitiesOpt] = useState<LocationOption[]>([]);
  const [communitiesOpt, setCommunitiesOpt] = useState<LocationOption[]>([]);
  const [schoolsOpt, setSchoolsOpt] = useState<LocationOption[]>([]);
  const [categoriesOpt, setCategoriesOpt] = useState<CategoryItem[]>([]);
  const [noCategoryCount, setNoCategoryCount] = useState(0);
  const [loadingOptions, setLoadingOptions] = useState(false);

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
        // a campanha ativa vem primeiro (é a que abre selecionada)
        const unique = Array.from(byId.values()).sort(
          (a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') || (b.year ?? 0) - (a.year ?? 0),
        );
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
          // "apadrinhadas" = todas que já têm padrinho (pendentes e em andamento inclusive): é o filtro "Indisponíveis"
          const taken = (j.active ?? 0) + (j.in_progress ?? 0) + (j.pending ?? 0);
          setStats({
            total: j.total ?? 0,
            active: taken,
            pending: j.pending ?? 0,
            in_progress: j.in_progress ?? 0,
            available: j.available ?? Math.max(0, (j.total ?? 0) - taken),
            sponsorshipRate: j.sponsorshipRate ?? (j.total ? Math.round((taken / j.total) * 100) : 0),
          });
        } else {
          setStats({ total: 0, active: 0, pending: 0, in_progress: 0, available: 0, sponsorshipRate: 0 });
        }
      } catch {
        setStats({ total: 0, active: 0, pending: 0, in_progress: 0, available: 0, sponsorshipRate: 0 });
      }
    })();
  }, [campaignId]);

  // ===== busca: espera uma pausa na digitação =====
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  // ===== opções dos filtros: só o que tem criança nesta campanha e nos outros filtros =====
  useEffect(() => {
    if (!api || !campaignId) return;
    const ac = new AbortController();
    setLoadingOptions(true);

    const url = new URL(`${api}/children/filter-options`);
    url.searchParams.set('campaignId', campaignId);
    if (debouncedSearch) url.searchParams.set('q', debouncedSearch);
    if (filtros.cidadeId) url.searchParams.set('cityId', filtros.cidadeId);
    if (filtros.comunidadeId) url.searchParams.set('communityId', filtros.comunidadeId);
    if (filtros.categoria) url.searchParams.set('category', filtros.categoria);
    if (filtros.status === 'disponivel') url.searchParams.set('status', 'available');
    if (filtros.status === 'apadrinhado') url.searchParams.set('status', 'assigned');
    const { minAge, maxAge } = parseFaixa(filtros.idade);
    if (typeof minAge === 'number') url.searchParams.set('minAge', String(minAge));
    if (typeof maxAge === 'number') url.searchParams.set('maxAge', String(maxAge));

    fetch(url.toString(), { cache: 'no-store', signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await safeErrMsg(res));
        return res.json();
      })
      .then((data) => {
        setCitiesOpt((prev) => keepSelected(data?.cities ?? [], prev, filtros.cidadeId));
        setCommunitiesOpt((prev) => keepSelected(data?.communities ?? [], prev, filtros.comunidadeId));
        setSchoolsOpt((prev) => keepSelected(data?.schools ?? [], prev, filtros.escolaId));
        const cats: CategoryItem[] = data?.categories ?? [];
        const missing = filtros.categoria && filtros.categoria !== NO_CATEGORY && !cats.some((c) => c.category === filtros.categoria);
        setCategoriesOpt(missing ? [...cats, { category: filtros.categoria, count: 0 }] : cats);
        setNoCategoryCount(data?.noCategory ?? 0);
        setLoadingOptions(false);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Falha ao carregar as opções dos filtros.');
        setLoadingOptions(false);
      });
    return () => ac.abort();
  }, [api, campaignId, debouncedSearch, filtros.cidadeId, filtros.comunidadeId, filtros.escolaId, filtros.categoria, filtros.status, filtros.idade]);

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

    if (debouncedSearch) url.searchParams.set('q', debouncedSearch);

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
  }, [api, campaignId, scanFs, filtros, debouncedSearch]);

  // ===== todas as disponíveis com os filtros atuais (sem depender do que já foi carregado) =====
  // mesmos filtros da lista, mas sempre só as disponíveis
  const buildAvailableUrl = useCallback((skip: number, take: number) => {
    const url = buildUrl(skip, take);
    url.searchParams.set('status', 'available');
    url.searchParams.delete('scan');
    return url;
  }, [buildUrl]);

  const [availableTotal, setAvailableTotal] = useState<number | null>(null);
  useEffect(() => {
    if (!api || !campaignId) return;
    const ac = new AbortController();
    setAvailableTotal(null);
    fetch(buildAvailableUrl(0, 1).toString(), { cache: 'no-store', signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!ac.signal.aborted) setAvailableTotal(typeof j?.total === 'number' ? j.total : null); })
      .catch(() => {});
    return () => ac.abort();
  }, [api, campaignId, buildAvailableUrl]);

  const [selectingAll, setSelectingAll] = useState<{ done: number; total: number } | null>(null);
  async function selectAllAvailable() {
    if (!api || !campaignId || selectingAll) return;
    const total = availableTotal ?? 0;
    if (total > BULK_CONFIRM && !confirm(`Selecionar ${total.toLocaleString('pt-BR')} crianças disponíveis${comunidadeNome ? ` de ${comunidadeNome}` : ''}?`)) return;
    setSelectingAll({ done: 0, total });
    setError(null);
    try {
      const ids: string[] = [];
      for (let skip = 0; ; skip += 100) {
        const r = await fetch(buildAvailableUrl(skip, 100).toString(), { cache: 'no-store' });
        if (!r.ok) throw new Error(await safeErrMsg(r));
        const j = await r.json();
        const page: any[] = Array.isArray(j) ? j : (j?.items ?? []);
        // confere de novo: só quem não tem apadrinhamento ativo
        mapChildren(page, campaignId).forEach((c) => { if (!isUnavailable(c.sponsorshipStatus)) ids.push(c.id); });
        setSelectingAll({ done: ids.length, total: Math.max(total, ids.length) });
        if (Array.isArray(j) || !j?.hasMore || page.length === 0) break;
      }
      setSelectedIds((prev) => new Set([...prev, ...ids]));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível selecionar todas as crianças.');
    } finally {
      setSelectingAll(null);
    }
  }

  // ===== fetch página =====
  // só a resposta do pedido mais recente vale: uma busca antiga que chegue depois é descartada
  const requestRef = useRef(0);
  const fetchPage = useCallback(async (opts?: { reset?: boolean; skip?: number }) => {
    if (!campaignId || !api) return;

    const reset = !!opts?.reset;
    const take = PAGE_SIZE;
    const skip = typeof opts?.skip === 'number' ? opts.skip : nextSkipRef.current;
    const request = ++requestRef.current;

    const url = buildUrl(skip, take);

    try {
      if (reset) { setLoading(true); setLoadingMore(false); setError(null); } else { setLoadingMore(true); }

      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(await safeErrMsg(res));
      const json = await res.json();
      if (request !== requestRef.current) return;

      const itemsRaw: any[] = Array.isArray(json) ? json : (json?.items ?? []);
      const mapped = mapChildren(itemsRaw, campaignId);

      if (reset) {
        setChildren(mapped);
        nextSkipRef.current = mapped.length;
      } else {
        setChildren(prev => [...prev, ...mapped]);
        nextSkipRef.current = skip + mapped.length;
      }
      setTotal(typeof json?.total === 'number' ? json.total : null);

      const serverHasMore =
        !Array.isArray(json) && typeof json?.hasMore === 'boolean'
          ? Boolean(json.hasMore)
          : mapped.length === take;

      setHasMore(serverHasMore);
    } catch (e) {
      if (request !== requestRef.current) return;
      setError(e instanceof Error ? e.message : 'Falha ao carregar crianças.');
    } finally {
      if (request === requestRef.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [api, campaignId, buildUrl, mapChildren]);

  // ===== recarrega do início quando muda campanha, filtro ou busca =====
  // (fetchPage muda junto com os filtros, por meio de buildUrl)
  useEffect(() => {
    if (!campaignId) return;
    setHasMore(true); nextSkipRef.current = 0;
    fetchPage({ reset: true, skip: 0 });
  }, [campaignId, scanFs, fetchPage]);

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

  function limparFiltros() {
    setFiltros({ cidadeId: '', comunidadeId: '', escolaId: '', categoria: '', idade: '', status: 'disponivel' });
    setSearchTerm('');
  }

  function trocarCampanha(id: string) {
    setCampaignId(id);
    // a seleção e o local são da campanha anterior
    setSelectedIds(new Set());
    setFiltros((prev) => ({ ...prev, cidadeId: '', comunidadeId: '', escolaId: '', categoria: '' }));
  }

  const filtrosAtivos =
    !!searchTerm.trim() || !!filtros.cidadeId || !!filtros.comunidadeId || !!filtros.escolaId ||
    !!filtros.categoria || !!filtros.idade || filtros.status !== 'disponivel';
  const rotulo = (name: string, count?: number) => (typeof count === 'number' ? `${name} (${count})` : name);

  const selectedCount = selectedIds.size;
  const comunidadeNome = communitiesOpt.find((c) => c.id === filtros.comunidadeId)?.name ?? '';
  // outros recortes além da comunidade (o "selecionar todas" respeita todos eles)
  const outrosFiltros = !!debouncedSearch || !!filtros.escolaId || !!filtros.categoria || !!filtros.idade;

  if (status === 'loading') {
    return (
      <div className="max-w-6xl mx-auto py-16 text-gray-600 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Carregando sua sessão…
      </div>
    );
  }

  const selectCls = 'w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 bg-white min-w-0 text-sm';
  // filtros "escondidos" no botão do celular (busca e situação ficam sempre à mostra)
  const hiddenFilterCount = [filtros.cidadeId, filtros.comunidadeId, filtros.escolaId, filtros.categoria, filtros.idade].filter(Boolean).length;
  const SITUACOES: { value: StatusFiltro; label: string }[] = [
    { value: 'disponivel', label: 'Disponíveis' },
    { value: 'apadrinhado', label: 'Indisponíveis' },
    { value: '', label: 'Todas' },
  ];

  return (
    <div className={`max-w-6xl mx-auto ${selectedCount > 0 ? 'pb-28' : ''}`}>
      {/* Topo: chamada + como funciona */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#253243] via-[#2f5d7c] to-emerald-600 text-white shadow-xl mb-5">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10" aria-hidden />
        <div className="absolute -left-10 -bottom-20 w-56 h-56 rounded-full bg-white/5" aria-hidden />
        <div className="relative p-5 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" /> Campanha de Natal
              </span>
              <h1 className="mt-3 text-2xl sm:text-4xl font-bold leading-tight">Faça o Natal de uma criança mais feliz</h1>
              <p className="mt-2 text-sm sm:text-base text-white/85">
                Escolha uma ou mais crianças, leve o presente que elas pediram e acompanhe a entrega pelo site. 💚
              </p>
            </div>
            <label className="flex flex-col gap-1 lg:min-w-[16rem]">
              <span className="text-xs font-semibold text-white/80">Campanha</span>
              <select
                value={campaignId}
                onChange={(e) => trocarCampanha(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white text-gray-900 text-sm border-0 focus:ring-2 focus:ring-emerald-300"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.year ? ` (${c.year})` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ol className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {[
              { icon: Heart, title: 'Escolha', text: 'Toque em “Apadrinhar” ou selecione várias crianças.' },
              { icon: ClipboardCheck, title: 'Confirme', text: 'Diga como vai ajudar: presente no ponto de coleta ou PIX.' },
              { icon: Gift, title: 'Entregue', text: 'Leve o presente e acompanhe em “Meus apadrinhamentos”.' },
            ].map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex items-start gap-3 rounded-2xl bg-white/10 backdrop-blur px-3 py-3">
                <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-white text-[#253243] shrink-0 relative">
                  <Icon className="w-4 h-4" />
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-400 text-[#253243] text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-xs text-white/80">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {status !== 'authenticated' && (
        <div className="mb-4 text-sm text-gray-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          Você pode navegar livremente. Para concluir o apadrinhamento, faremos um cadastro rápido no próximo passo. 💚
        </div>
      )}

      <Stats stats={stats} />

      {error && (
        <div className="mt-4 mb-2 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} aria-label="Fechar aviso" className="p-0.5 rounded hover:bg-red-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Busca e filtros */}
      <div className="bg-white rounded-2xl shadow-md sm:shadow-lg p-3 sm:p-6 mb-4 space-y-3">
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center">
            <Filter className="h-5 w-5 text-gray-600 mr-2" />
            <h2 className="text-lg font-bold text-gray-800">Filtros e busca</h2>
          </div>
          {filtrosAtivos && (
            <button onClick={limparFiltros} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800">
              <X className="w-4 h-4" /> Limpar filtros
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="search"
              inputMode="search"
              placeholder="Nome, ID ou presente…"
              aria-label="Buscar por nome, ID ou presente"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 text-base sm:text-sm"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600" aria-label="Limpar busca">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {/* celular: abre os demais filtros */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`sm:hidden relative inline-flex items-center gap-1.5 px-3 rounded-xl border text-sm font-medium ${
              showFilters || hiddenFilterCount ? 'border-green-600 text-green-700 bg-green-50' : 'border-gray-300 text-gray-700 bg-white'
            }`}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="w-4 h-4" /> Filtros
            {hiddenFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-green-600 text-white text-[11px] font-bold flex items-center justify-center">
                {hiddenFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* situação: botões grandes para tocar */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-gray-100" role="radiogroup" aria-label="Situação">
          {SITUACOES.map((s) => (
            <button
              key={s.value || 'todas'}
              role="radio"
              aria-checked={filtros.status === s.value}
              onClick={() => setFiltros({ ...filtros, status: s.value })}
              className={`py-2 rounded-lg text-sm font-medium transition ${
                filtros.status === s.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className={`${showFilters ? 'grid' : 'hidden'} sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3`}>
          <select
            aria-label="Cidade"
            value={filtros.cidadeId}
            onChange={(e) => setFiltros({ ...filtros, cidadeId: e.target.value, comunidadeId: '', escolaId: '' })}
            className={selectCls}
          >
            <option value="">Todas as cidades</option>
            {citiesOpt.map((c) => (
              <option key={c.id} value={c.id}>{rotulo(c.name, c.count)}</option>
            ))}
          </select>

          <select
            aria-label="Comunidade"
            value={filtros.comunidadeId}
            onChange={(e) => setFiltros({ ...filtros, comunidadeId: e.target.value, escolaId: '' })}
            className={selectCls}
          >
            <option value="">Todas as comunidades</option>
            {communitiesOpt.map((co) => (
              <option key={co.id} value={co.id}>{rotulo(co.name, co.count)}</option>
            ))}
          </select>

          <select
            aria-label="Escola"
            value={filtros.escolaId}
            onChange={(e) => setFiltros({ ...filtros, escolaId: e.target.value })}
            className={selectCls}
          >
            <option value="">Todas as escolas</option>
            {schoolsOpt.map((s) => (
              <option key={s.id} value={s.id}>{rotulo(s.name, s.count)}</option>
            ))}
          </select>

          <select
            aria-label="Categoria"
            value={filtros.categoria}
            onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}
            className={selectCls}
          >
            <option value="">Todas as categorias</option>
            {categoriesOpt.map((it) => (
              <option key={it.category} value={it.category}>{rotulo(it.category, it.count)}</option>
            ))}
            {(noCategoryCount > 0 || filtros.categoria === NO_CATEGORY) && (
              <option value={NO_CATEGORY}>{rotulo('Sem categoria', noCategoryCount)}</option>
            )}
          </select>

          <select
            aria-label="Idade"
            value={filtros.idade}
            onChange={(e) => setFiltros({ ...filtros, idade: e.target.value })}
            className={selectCls}
          >
            <option value="">Todas as idades</option>
            {FAIXAS_ETARIAS.map((f) => (<option key={f} value={f}>{f}</option>))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600" aria-live="polite">
          <span className="flex items-center gap-2">
            {(loading || loadingOptions) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {total !== null && !loading && (
              <span><strong>{total.toLocaleString('pt-BR')}</strong> criança{total === 1 ? ' encontrada' : 's encontradas'}</span>
            )}
          </span>
          {filtrosAtivos && (
            <button onClick={limparFiltros} className="sm:hidden inline-flex items-center gap-1 text-gray-600 hover:text-gray-800">
              <X className="w-4 h-4" /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* Comunidade escolhida: apadrinhar todas as disponíveis dela de uma vez */}
      {filtros.comunidadeId && comunidadeNome && !!availableTotal && (
        <div className="mb-4 rounded-2xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="p-2.5 rounded-xl bg-emerald-600 text-white self-start sm:self-auto"><Users className="w-5 h-5" /></span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-emerald-900">
              {availableTotal.toLocaleString('pt-BR')} criança{availableTotal === 1 ? '' : 's'} disponíve{availableTotal === 1 ? 'l' : 'is'} em {comunidadeNome}
            </p>
            <p className="text-sm text-emerald-800/80">
              Apadrinhe a comunidade inteira de uma vez{outrosFiltros ? ' (respeitando os outros filtros aplicados)' : ''} — não precisa rolar a lista.
            </p>
          </div>
          <button
            onClick={async () => { await selectAllAvailable(); }}
            disabled={!!selectingAll}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm disabled:opacity-60"
          >
            {selectingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
            {selectingAll ? `Selecionando… ${selectingAll.done}/${selectingAll.total}` : `Selecionar as ${availableTotal.toLocaleString('pt-BR')}`}
          </button>
        </div>
      )}

      {/* Seleção */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-sm text-gray-600">
          {selectedCount > 0 ? (
            <><strong className="text-gray-900">{selectedCount}</strong> selecionada{selectedCount > 1 ? 's' : ''}</>
          ) : (
            <span className="hidden sm:inline">Toque em “Selecionar” ou escolha uma comunidade para apadrinhar várias de uma vez.</span>
          )}
        </p>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={selectAllAvailable}
            disabled={!!selectingAll || !availableTotal}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm disabled:opacity-50"
            title="Seleciona todas as crianças disponíveis com os filtros atuais, mesmo as que ainda não apareceram na lista"
          >
            {selectingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
            {selectingAll
              ? `${selectingAll.done}/${selectingAll.total}`
              : <>Todas as disponíveis{availableTotal ? ` (${availableTotal.toLocaleString('pt-BR')})` : ''}</>}
          </button>
          {selectedCount > 0 && (
            <button
              onClick={clearSelection}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm"
            >
              <Square className="w-4 h-4" /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* Grade: 2 colunas no celular */}
      <div className={`grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 transition-opacity ${loading && children.length ? 'opacity-50' : ''}`}>
        {loading && children.length === 0 && Array.from({ length: 6 }, (_, i) => (
          <div key={`sk-${i}`} className="rounded-xl border border-gray-200 bg-white overflow-hidden animate-pulse">
            <div className="aspect-[9/16] bg-gray-100" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-gray-100 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
              <div className="h-8 bg-gray-100 rounded" />
            </div>
          </div>
        ))}

        {children.map((child) => {
          const nomeCidade = child.city?.name ?? child.cityName ?? '';
          const idadeCalculada = idadeDe(child);
          const unavailable = isUnavailable(child.sponsorshipStatus);
          const checked = selectedIds.has(child.id);

          return (
            <div key={String(child.id)} className={`relative group rounded-xl transition ${checked ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`}>
              {/* seleção sobre a foto */}
              {!unavailable && (
                <button
                  type="button"
                  onClick={() => toggleSelect(child.id, child.sponsorshipStatus)}
                  className={[
                    'absolute z-10 top-2 left-2 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold shadow-md backdrop-blur',
                    checked
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/90 text-gray-700 hover:bg-white',
                  ].join(' ')}
                  aria-pressed={checked}
                  title={checked ? 'Remover da seleção' : 'Selecionar'}
                >
                  {checked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  <span className="hidden sm:inline">{checked ? 'Selecionada' : 'Selecionar'}</span>
                </button>
              )}

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
          );
        })}
      </div>

      <div ref={sentinelRef} className="h-1" />

      {!loading && hasMore && children.length > 0 && (
        <div className="flex flex-col items-center py-6">
          {loadingMore ? (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando mais…
            </div>
          ) : (
            <button className="px-5 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium" onClick={() => fetchPage()}>
              Carregar mais
            </button>
          )}
        </div>
      )}

      {!loading && !loadingMore && !hasMore && children.length > 0 && (
        <div className="text-center text-gray-500 py-6">Você chegou ao fim da lista. 🎉</div>
      )}

      {!loading && children.length === 0 && (
        <div className="text-center text-gray-500 py-12 px-4 bg-white rounded-2xl border border-gray-100">
          <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>Nenhuma criança encontrada com os filtros aplicados.</p>
          {filtrosAtivos && (
            <button onClick={limparFiltros} className="mt-3 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700">
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* ===== Barra fixa da seleção ===== */}
      {selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-xl mx-auto flex items-center gap-2 sm:gap-3 bg-white border border-emerald-200 shadow-2xl rounded-2xl p-2 sm:p-3">
            <button
              onClick={clearSelection}
              className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
              aria-label="Limpar seleção"
              title="Limpar seleção"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0 text-sm text-gray-800 leading-tight">
              <strong>{selectedCount}</strong> criança{selectedCount > 1 ? 's' : ''}
              <span className="block text-xs text-gray-500">selecionada{selectedCount > 1 ? 's' : ''}</span>
            </div>
            <button
              onClick={handleBulkSponsor}
              className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition"
            >
              <Heart className="w-4 h-4" /> Apadrinhar {selectedCount > 1 ? `as ${selectedCount}` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
