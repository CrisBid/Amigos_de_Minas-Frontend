'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays, ChevronDown, Loader2, MapPin
} from 'lucide-react';
import ChildCard from '@/components/Apadrinhamento/ChildCard';
import { exportSponsorshipsPdf  } from '@/lib/pdf/exportSponsorshipsPdf';

/* ---------- Tipos ---------- */

type Campaign = {
  id: string;
  name: string;
  slug: string;
  year?: number;
  status: 'DRAFT' | 'ACTIVE' | 'FINISHED' | 'ARCHIVED';
  startDate?: string;
  endDate?: string;
};

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
  id: string;
  name: string;
  age?: number;
  city: string;
  school?: string;
  category?: string;
  wantedGift?: string;
  photoUrl?: string;
  description?: string;
  publicId?: number | null;
  communityName?: string | null;
  images?: ChildImage[];
  media?: Array<{ framedUrl?: string; processedUrl?: string }>;
  // algumas APIs podem retornar child.community.name
  // então usamos (child as any).community?.name de forma defensiva
};

type Sponsorship = {
  id: string;
  status: 'PENDING' | 'COMPLETED' | 'ENDED' | 'CANCELLED' | 'IN_PROGRESS';
  startDate?: string;
  endDate?: string;
  note?: string;
  child: Child;
  campaign: Campaign;
};

/* ---------- Página ---------- */

export default function MeusApadrinhamentosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const api = process.env.NEXT_PUBLIC_NEST_API_URL;
  const provider = useMemo(() => (session as any)?.user?.provider as string | undefined, [session]);
  const accessToken = useMemo(() => (session as any)?.accessToken as string | undefined, [session]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Sponsorship[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignFilter, setCampaignFilter] = useState<string>(''); // campaignId
  const [error, setError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; phase: 'compose'|'pdf' } | null>(null);

  const [cardsPerPage, setCardsPerPage] = useState<number>(1);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/login?callbackUrl=/meus-apadrinhamentos');
      return;
    }
    if (status !== 'authenticated') return;

    if (!api) {
      setError('Defina NEXT_PUBLIC_NEST_API_URL.');
      setLoading(false);
      return;
    }
    if (provider !== 'nest' || !accessToken) {
      setError('Faça login com e-mail e senha para ver seus apadrinhamentos.');
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // campanhas ativas e todas (para filtrar por campanha)
        const cRes = await fetch(`${api}/campaigns?status=ACTIVE`, { cache: 'no-store' });
        const allRes = await fetch(`${api}/campaigns`, { cache: 'no-store' });
        const cJson = cRes.ok ? await cRes.json() : [];
        const allJson = allRes.ok ? await allRes.json() : [];
        const merged = uniqBy([...(cJson ?? []), ...(allJson ?? [])], 'id')
          .sort((a: any, b: any) => (b.year ?? 0) - (a.year ?? 0));
        setCampaigns(merged);

        // apadrinhamentos do usuário (com filtro opcional)
        const url = new URL(`${api}/sponsorships/me`);
        if (campaignFilter) url.searchParams.set('campaignId', campaignFilter);
        const sRes = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        if (!sRes.ok) throw new Error(await safeErrMsg(sRes));
        const sJson = await sRes.json();
        setItems(Array.isArray(sJson) ? sJson : []);
      } catch (e: any) {
        setError(e?.message || 'Falha ao carregar apadrinhamentos.');
      } finally {
        setLoading(false);
      }
    })();
  }, [status, api, provider, accessToken, campaignFilter, router]);

  const handleExportPdf = async () => {
    if (loading || items.length === 0) return;

    setExporting(true);
    setProgress({ current: 0, total: items.length, phase: 'compose' });

    try {
      const data = items.map(sp => {
        const ch: any = sp.child || {};
        const processedUrl =
          ch?.images?.[0]?.processedUrl ||
          ch?.media?.find((m: any) => !!m.processedUrl)?.processedUrl ||
          ch?.photoUrl || null;

        const layoutUrl = ch?.images?.[0]?.layoutUrl || null;
        const config    = ch?.images?.[0]?.Config || null;
        const framedUrl =
          ch?.images?.[0]?.framedUrl ||
          ch?.media?.find((m: any) => !!m.framedUrl)?.framedUrl ||
          null;

        return {
          sponsorshipId: sp.id,
          status: sp.status,
          campaign: { id: sp.campaign.id, name: sp.campaign.name, year: sp.campaign.year ?? null },
          child: {
            id: ch.id,
            name: ch.name,
            publicId: typeof ch.publicId === 'number' ? ch.publicId : null,
            age: typeof ch.age === 'number' ? ch.age : null,
            city: ch.city?.name ?? ch.city ?? ch.cityName ?? null,
            community: ch.community?.name ?? ch.communityName ?? null,
            school: ch.school?.name ?? ch.school ?? ch.schoolLegacy ?? null,
            wantedGift: ch.wantedGift ?? null,
            processedUrl,
            layoutUrl,
            config,
            framedUrl,
            photoUrl: ch.photoUrl ?? null,
          }
        };
      });

      await exportSponsorshipsPdf(data, {
        fileName: `meus-apadrinhamentos-${cardsPerPage}pp.pdf`,
        perPage: cardsPerPage,
        onProgress: setProgress,
      });

    } finally {
      setExporting(false);
      setProgress(null);
    }
  };

  const grouped = groupByCampaignThenCommunity(items);

  return (
    <div className="min-h-[calc(100dvh-64px)] bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#253243]">Meus Apadrinhamentos</h1>
            <p className="text-gray-600">Veja suas crianças apadrinhadas por campanha e comunidade.</p>
          </div>

          {/* Filtros e export */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-10 text-sm text-[#253243] hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Todas as campanhas</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.year ? ` (${c.year})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <select
              value={cardsPerPage}
              onChange={(e) => setCardsPerPage(Number(e.target.value))}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#253243] hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
              title="Cartões por página"
            >
              <option value={1}>1 por página (1×1)</option>
              <option value={2}>2 por página (2×1)</option>
              <option value={4}>4 por página (2×2)</option>
              <option value={6}>6 por página (3×2)</option>
              <option value={8}>8 por página (4×2)</option>
              <option value={9}>9 por página (3×3)</option>
            </select>

            <button
              onClick={handleExportPdf}
              disabled={loading || items.length === 0 || exporting}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-2"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {exporting ? 'Gerando PDF…' : `Exportar PDF (${cardsPerPage} por página)`}
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-6">
          {loading ? (
            <div className="flex items-center gap-3 text-[#253243]">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" fill="none" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 004 12z"></path>
              </svg>
              <span>Carregando…</span>
            </div>
          ) : error ? (
            <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="text-gray-600">Você ainda não possui apadrinhamentos{campaignFilter ? ' nesta campanha.' : '.'}</div>
          ) : (
            <div className="space-y-10">
              {grouped.map(group => (
                <section key={group.campaign.id} className="space-y-6">
                  <header className="flex items-center gap-3">
                    <CalendarDays className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-[#253243]">
                      {group.campaign.name}{group.campaign.year ? ` (${group.campaign.year})` : ''}
                    </h2>
                    <CampaignBadge status={group.campaign.status} />
                    <span className="ml-auto text-sm text-gray-500">
                      {group.total} criança(s) · {group.communities.length} comunidade(s)
                    </span>
                  </header>

                  {/* Comunidades dentro da campanha */}
                  <div className="space-y-8">
                    {group.communities.map(com => (
                      <div key={com.name} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-emerald-600" />
                          <h3 className="text-base font-semibold text-[#253243]">
                            {com.name}
                          </h3>
                          <span className="ml-auto text-sm text-gray-500">{com.items.length} criança(s)</span>
                        </div>

                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                          {com.items.map(sp => (
                            <div key={sp.id} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition bg-white">
                              <ChildCard
                                child={toChildCardData(sp)}
                                onSponsor={() => {}}
                                sponsoring={false}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {exporting && progress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-5 h-5 animate-spin text-emerald-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" fill="none" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 004 12z" />
              </svg>
              <h3 className="font-semibold text-gray-800">Gerando PDF</h3>
            </div>

            <p className="text-sm text-gray-600 mb-3">
              {progress.phase === 'compose' ? 'Compondo imagens' : 'Montando documento'} — {progress.current} de {progress.total}
            </p>

            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
              />
            </div>

            <p className="mt-2 text-xs text-gray-500">Não feche esta janela até finalizar o download.</p>
          </div>
        </div>
      )}
      {/* --- fim do modal --- */}
    </div>
  );
}

/* ---------- UI auxiliares ---------- */

function CampaignBadge({ status }: { status: Campaign['status'] }) {
  const map = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    DRAFT: 'bg-gray-50 text-gray-700 border-gray-200',
    FINISHED: 'bg-blue-50 text-blue-700 border-blue-100',
    ARCHIVED: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  } as const;
  const cls = (map as any)[status] ?? map.DRAFT;
  return (
    <span className={`text-xs border px-2 py-0.5 rounded-full ${cls}`}>{status}</span>
  );
}

/* ---------- Helpers ---------- */

function uniqBy<T extends Record<string, any>>(arr: T[], key: keyof T) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const k = String(it[key]);
    if (!seen.has(k)) { seen.add(k); out.push(it); }
  }
  return out;
}

function getCommunityName(child: Child): string {
  const fromNested = (child as any)?.community?.name; // se vier do backend aninhado
  const raw = fromNested ?? child.communityName ?? '';
  const name = (raw ?? '').toString().trim();
  return name || 'Sem comunidade';
}

function groupByCampaignThenCommunity(items: Sponsorship[]) {
  // 1) agrupa por campanha
  const campMap = new Map<string, { campaign: Campaign; items: Sponsorship[] }>();
  items.forEach(sp => {
    const id = sp.campaign.id;
    if (!campMap.has(id)) campMap.set(id, { campaign: sp.campaign, items: [] });
    campMap.get(id)!.items.push(sp);
  });

  // 2) dentro de cada campanha, agrupa por comunidade (ordenado)
  const result = Array.from(campMap.values()).map(group => {
    const comMap = new Map<string, Sponsorship[]>();
    for (const sp of group.items) {
      const name = getCommunityName(sp.child);
      if (!comMap.has(name)) comMap.set(name, []);
      comMap.get(name)!.push(sp);
    }

    // ordena crianças por nome dentro de cada comunidade
    const communities = Array.from(comMap.entries())
      .map(([name, arr]) => ({
        name,
        items: arr.sort((a, b) => a.child.name.localeCompare(b.child.name, 'pt-BR', { sensitivity: 'base' })),
      }))
      // ordena comunidades por nome (Sem comunidade vai pro final)
      .sort((a, b) => {
        const aIsNone = a.name === 'Sem comunidade';
        const bIsNone = b.name === 'Sem comunidade';
        if (aIsNone && !bIsNone) return 1;
        if (!aIsNone && bIsNone) return -1;
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      });

    return {
      campaign: group.campaign,
      communities,
      total: group.items.length,
    };
  });

  // opcional: ordenar campanhas por ano desc e nome
  return result.sort((a, b) => {
    const ay = a.campaign.year ?? 0;
    const by = b.campaign.year ?? 0;
    if (by !== ay) return by - ay;
    return a.campaign.name.localeCompare(b.campaign.name, 'pt-BR', { sensitivity: 'base' });
  });
}

async function safeErrMsg(res: Response) {
  try { const d = await res.json(); return d?.message || d?.error || res.statusText }
  catch { return res.statusText }
}

/**
 * Converte um Sponsorship (com child dentro) no shape esperado por <ChildCard />
 */
function toChildCardData(sp: Sponsorship) {
  const c = sp.child || ({} as Child);

  const apadrinhado = sp.status === 'COMPLETED' || sp.status === 'PENDING' || sp.status === 'IN_PROGRESS';
  const statusMap = {
    ACTIVE: 'IN_PROGRESS',
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    ENDED: 'ENDED',
    CANCELLED: 'CANCELLED',
  } as const;
  const status = (statusMap as any)[sp.status] ?? 'NONE';

  const images = c.images ?? undefined;
  const foto = c.photoUrl ?? (c.media?.[0]?.framedUrl || c.media?.[0]?.processedUrl || '');

  return {
    id: c.id,
    publicId: c.publicId ?? 0,
    nome: c.name,
    idade: c.age ?? 0,
    cidade: (c as any)?.city?.name ?? c.city ?? '',
    escola: (c as any)?.school?.name ?? (c as any)?.school ?? '',
    categoria: c.category ?? '',
    presente: c.wantedGift ?? '',
    descricao: c.description ?? '',
    apadrinhado,
    foto,
    images,
    status,
    comunidade: getCommunityName(c),
  };
}
