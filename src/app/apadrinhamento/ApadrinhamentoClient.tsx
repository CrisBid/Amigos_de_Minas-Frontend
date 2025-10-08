// app/apadrinhamento/ApadrinhamentoClient.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Filter, Search, Loader2, AlertCircle } from 'lucide-react';
import Stats from '@/components/Apadrinhamento/Stats';
import ChildCard from '@/components/Apadrinhamento/ChildCard';

type SponsorshipStatus = 'PENDING' | 'COMPLETED' | 'IN_PROGRESS' | 'ENDED' | 'CANCELLED' | 'NONE';

type City = {
  id: string;
  publicId?: number | null;
  name: string;
  state?: string | null;
};

type Community = {
  id: string;
  publicId?: number | null;
  cityId?: string | null;
  name: string;
  slug?: string | null;
  description?: string | null;
};

type SchoolObj = {
  id: string;
  publicId?: number | null;
  name: string;
  slug?: string | null;
  address?: string | null;
};

type ImageConfig = {
  version: number;
  canvas: { width: number; height: number; background: string | null };
  layout: { onTop?: boolean; opacity?: number; resizeToCanvas?: boolean };
  photoRect: {
    x: number; y: number; width: number; height: number;
    fit: 'cover' | 'contain';
    scale: number;
    gravity:
      | 'north' | 'northeast' | 'east' | 'southeast'
      | 'south' | 'southwest' | 'west' | 'northwest' | 'center';
    offsetX: number; offsetY: number; cornerRadius: number;
  };
  texts: any[];
};

type ChildImage = {
  id: string;
  childId: string;
  campaignId: string;
  originalKey: string | null; originalUrl: string | null;
  processedKey: string | null; processedUrl: string | null;
  framedKey: string | null; framedUrl: string | null;
  layoutKey: string | null; layoutUrl: string | null;
  Config: ImageConfig;
  width: number | null; height: number | null;
  status: 'UPLOADED' | 'PROCESSED' | 'COMPOSED' | string;
  notes: string | null; version: number;
  createdAt: string; updatedAt: string;
};

type Child = {
  id: string;
  publicId?: number | null;
  name: string;
  birthDate?: string | Date | null;
  age?: number | null;

  cityName?: string | null;
  schoolLegacy?: string | null;

  city?: City | null;
  community?: Community | null;
  school?: SchoolObj | null;

  category?: string | null;
  wantedGift?: string | null;
  description?: string | null;
  photoUrl?: string | null;
  photoKey?: string | null;

  sponsorships?: Array<{ id: string; status: SponsorshipStatus; campaignId: string }>;
  sponsorshipStatus: SponsorshipStatus;
  media?: Array<{ framedUrl?: string; processedUrl?: string }>;
  images?: ChildImage[];
};

type Campaign = {
  id: string; name: string; slug: string; year?: number;
  status: 'DRAFT' | 'ACTIVE' | 'FINISHED' | 'ARCHIVED';
};

type Props = { initialScanFs: boolean };

type StatusFiltro = '' | 'disponivel' | 'apadrinhado';

const FAIXAS_ETARIAS = ['0-3 anos', '4-6 anos', '7-9 anos', '10-12 anos', '13+ anos'];

// ===== Helpers gerais =====
function uniq(arr: (string | undefined | null)[]) {
  return Array.from(new Set(arr.filter(Boolean) as string[]));
}
function uniqBy<T extends Record<string, unknown>>(arr: T[], key: keyof T) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const k = String(it[key]);
    if (!seen.has(k)) { seen.add(k); out.push(it); }
  }
  return out;
}
function normalizeStatus(s?: string): SponsorshipStatus {
  return s === 'COMPLETED' || s === 'PENDING' || s === 'ENDED' || s === 'CANCELLED' ? s : 'NONE';
}
async function safeErrMsg(res: Response) {
  try {
    const d = await res.json();
    return (d as { message?: string; error?: string })?.message || (d as any)?.error || res.statusText;
  } catch { return res.statusText; }
}
// calcula idade por birthDate
function calcularIdade(birthDate?: string | Date | null): number {
  if (!birthDate) return 0;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return 0;
  const hoje = new Date();
  let idade = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth();
  const dia = hoje.getDate();
  if (m < d.getMonth() || (m === d.getMonth() && dia < d.getDate())) idade--;
  return idade;
}

// ===== Componente =====
export default function ApadrinhamentoClient({ initialScanFs }: Props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const api = process.env.NEXT_PUBLIC_NEST_API_URL;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState<string>('');

  // paginação incremental
  const PAGE_SIZE = 24; // ajuste fino aqui
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextSkip, setNextSkip] = useState(0);
  const nextSkipRef = useRef(0);      

  const [sponsoringId, setSponsoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanFs, setScanFs] = useState<boolean>(initialScanFs);

  const [stats, setStats] = useState<{ total: number; active: number; pending: number; available: number; sponsorshipRate: number }>({
    total: 0, active: 0, pending: 0, available: 0, sponsorshipRate: 0,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filtros, setFiltros] = useState({
    cidade: '',
    comunidade: '',
    escola: '',
    categoria: '',
    idade: '',
    status: 'disponivel' as StatusFiltro,
  });

  // sentinel para infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ===== 1) Carregar campanhas =====
  useEffect(() => {
    if (!api) {
      setError('Defina NEXT_PUBLIC_NEST_API_URL.');
      setLoading(false);
      return;
    }
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
        const unique = uniqBy<Campaign>([...active, ...all], 'id').sort(
          (a, b) => (b.year ?? 0) - (a.year ?? 0)
        );
        setCampaigns(unique);
        setCampaignId(unique[0]?.id || '');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Falha ao carregar campanhas.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [api]);

  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/children/stats', {
        cache: 'no-store',
        credentials: 'include',
        headers: { accept: 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        setStats({
          total: json.total ?? 0,
          active: json.active ?? 0,
          pending: json.pending ?? 0,
          available: json.available ?? Math.max(0, (json.total ?? 0) - ((json.active ?? 0) + (json.pending ?? 0))),
          sponsorshipRate: json.sponsorshipRate ?? (json.total ? Math.round(((json.active ?? 0) / json.total) * 100) : 0),
        });
      } else {
        setStats({ total: 0, active: 0, pending: 0, available: 0, sponsorshipRate: 0 });
      }
    } catch {
      setStats({ total: 0, active: 0, pending: 0, available: 0, sponsorshipRate: 0 });
    }
  };

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Mapper do backend -> Child =====
  const mapChildren = useCallback((data: any[], selectedCampaignId: string): Child[] => {
    return (data ?? []).map((c: any) => {
      const rel = Array.isArray(c.sponsorships)
        ? c.sponsorships.find(
            (s: any) =>
              s.campaignId === selectedCampaignId &&
              (s.status === 'ACTIVE' || s.status === 'PENDING' || s.status === 'COMPLETED')
          )
        : null;
      const status: SponsorshipStatus = normalizeStatus(rel?.status) || 'NONE';
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

  // ===== 2) Função para buscar uma página =====
  const fetchPage = useCallback(
    async (opts?: { reset?: boolean; skip?: number }) => {
      if (!campaignId || !api) return;

      const reset = !!opts?.reset;
      const take = PAGE_SIZE;

      // usa o ref como fonte da verdade, a não ser que passe skip explícito
      const skip = typeof opts?.skip === 'number' ? opts.skip : nextSkipRef.current;

      const url = new URL(`${api}/children`);
      url.searchParams.set('campaignId', campaignId);
      url.searchParams.set('skip', String(skip));
      url.searchParams.set('take', String(take));
      if (scanFs) url.searchParams.set('scan', '1');

      try {
        if (reset) { setLoading(true); setError(null); } else { setLoadingMore(true); }

        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (!res.ok) throw new Error(await safeErrMsg(res));
        const json = await res.json();

        // aceita envelope {items,total,hasMore,...} ou array puro (fallback)
        const itemsRaw: any[] = Array.isArray(json) ? json : (json?.items ?? []);
        const mapped = mapChildren(itemsRaw, campaignId);

        if (reset) {
          setChildren(mapped);
          nextSkipRef.current = mapped.length;
          setNextSkip(nextSkipRef.current);
        } else {
          setChildren(prev => [...prev, ...mapped]);
          nextSkipRef.current = skip + mapped.length;
          setNextSkip(nextSkipRef.current);
        }

        // prioridade: hasMore do servidor; senão, heurística local
        const serverHasMore =
          !Array.isArray(json) && typeof json?.hasMore === 'boolean'
            ? Boolean(json.hasMore)
            : mapped.length === take; // se veio menos que take, acabou

        setHasMore(serverHasMore);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Falha ao carregar crianças.';
        setError(msg);
      } finally {
        if (reset) setLoading(false); else setLoadingMore(false);
      }
    },
    // ⚠️ Importante: não coloque nextSkip aqui!
    [api, campaignId, scanFs, mapChildren, PAGE_SIZE]
  );


  // ===== 3) Reset ao trocar campanha/scan ou filtros de busca =====
  // Obs: filtros e busca afetam apenas a renderização; para aliviar ainda mais,
  // você pode enviar filtros ao backend se suportar.
  useEffect(() => {
    if (!campaignId) return;
    // reinicia a lista
    setChildren([]);
    setHasMore(true);
    setNextSkip(0);
    fetchPage({ reset: true, skip: 0 });
  }, [campaignId, scanFs, fetchPage]);

  // ===== 4) Infinite scroll (IntersectionObserver) =====
  useEffect(() => {
    if (!sentinelRef.current) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    observerRef.current = new IntersectionObserver(
      entries => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (!hasMore || loading || loadingMore) return; // guardas fortes
        fetchPage(); // próxima página usando o ref
      },
      { root: null, rootMargin: '600px 0px', threshold: 0 }
    );

    observerRef.current.observe(sentinelRef.current);

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [hasMore, loading, loadingMore, fetchPage]);


  // ===== 5) Ação “Apadrinhar” =====
  async function handleSponsor(childId: string) {
    if (!campaignId) { setError('Selecione uma campanha.'); return; }
    setSponsoringId(childId);
    try {
      if (status === 'authenticated') {
        router.push(`/apadrinhamento/concluir?childId=${encodeURIComponent(childId)}&campaignId=${encodeURIComponent(campaignId)}`);
      } else {
        router.push(`/apadrinhamento/registro?childId=${encodeURIComponent(childId)}&campaignId=${encodeURIComponent(campaignId)}`);
      }
    } finally {
      setSponsoringId(null);
    }
  }

  // ===== 6) Stats (sobre o conjunto carregado até agora) =====
  const headerStats = stats;

  // ===== 7) Opções para filtros =====
  const cidades = useMemo(
    () => uniq(children.map((c) => c.city?.name ?? c.cityName).filter(Boolean) as string[]),
    [children]
  );
  const comunidades = useMemo(
    () => uniq(children.map((c) => c.community?.name).filter(Boolean) as string[]),
    [children]
  );
  const escolas = useMemo(
    () => uniq(children.map((c) => c.school?.name ?? c.schoolLegacy).filter(Boolean) as string[]),
    [children]
  );
  const categorias = useMemo(
    () => uniq(children.map((c) => c.category).filter(Boolean) as string[]),
    [children]
  );

  // ===== 8) Aplicar filtros localmente =====
  const childrenFiltradas = useMemo(() => {
    return children.filter((child) => {
      const nomeCidade = child.city?.name ?? child.cityName ?? '';
      const nomeComunidade = child.community?.name ?? '';
      const nomeEscola = child.school?.name ?? child.schoolLegacy ?? '';

      const matchesSearch = child.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCidade = !filtros.cidade || nomeCidade === filtros.cidade;
      const matchesComunidade = !filtros.comunidade || nomeComunidade === filtros.comunidade;
      const matchesEscola = !filtros.escola || nomeEscola === filtros.escola;
      const matchesCategoria = !filtros.categoria || child.category === filtros.categoria;

      const isIndisp = ['COMPLETED', 'PENDING'].includes(child.sponsorshipStatus);
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

      return (
        matchesSearch &&
        matchesCidade &&
        matchesComunidade &&
        matchesEscola &&
        matchesCategoria &&
        matchesStatus &&
        matchesIdade
      );
    });
  }, [children, searchTerm, filtros]);

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

      {/* banner opcional */}
      {status !== 'authenticated' && (
        <div className="mb-4 text-sm text-gray-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          Você pode navegar livremente. Para concluir o apadrinhamento, faremos um cadastro rápido no próximo passo. 💚
        </div>
      )}

      <Stats stats={headerStats} />

      {error && (
        <div className="mt-4 mb-2 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Filtros e busca */}
      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-8">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 text-gray-600 mr-2" />
          <h2 className="text-lg font-bold text-gray-800">Filtros e Busca</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="sm:col-span-2 xl:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar por nome..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <select
            value={filtros.cidade}
            onChange={(e) => setFiltros({ ...filtros, cidade: e.target.value })}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">Todas as cidades</option>
            {cidades.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={filtros.escola}
            onChange={(e) => setFiltros({ ...filtros, escola: e.target.value })}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">Todas as escolas</option>
            {escolas.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>

          <select
            value={filtros.categoria}
            onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">Todas as categorias</option>
            {categorias.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
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
            {FAIXAS_ETARIAS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {childrenFiltradas.map((child) => {
          const nomeCidade = child.city?.name ?? child.cityName ?? '';
          const idadeCalculada = (child.age ?? calcularIdade(child.birthDate)) || 0;

          return (
            <ChildCard
              key={String(child.id)}
              child={{
                id: child.id,
                nome: child.name,
                idade: idadeCalculada,
                cidade: nomeCidade,
                escola: child.school?.name ?? child.schoolLegacy ?? '',
                categoria: child.category ?? '',
                presente: child.wantedGift ?? '',
                descricao: child.description ?? '',
                apadrinhado: ['COMPLETED', 'PENDING'].includes(child.sponsorshipStatus),
                foto: child.photoUrl ?? '',
                images: child.images,
                status: child.sponsorshipStatus,
                comunidade: child.community?.name ?? '',
              }}
              onSponsor={() => handleSponsor(child.id)}
              sponsoring={sponsoringId === child.id}
            />
          );
        })}
      </div>

      {/* Loader principal */}
      {loading && (
        <div className="flex items-center gap-2 text-gray-600 py-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando…
        </div>
      )}

      {/* Sentinela para infinite scroll */}
      <div ref={sentinelRef} className="h-1"></div>

      {/* Loader incremental / botão fallback */}
      {!loading && hasMore && (
        <div className="flex flex-col items-center py-6">
          {loadingMore ? (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando mais…
            </div>
          ) : (
            <button
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
              onClick={() => fetchPage()}
            >
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
    </div>
  );
}
