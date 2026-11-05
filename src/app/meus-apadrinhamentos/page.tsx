'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CalendarDays, ChevronDown, Download, Gift, Heart, Loader2, LogIn, MapPin, Package } from 'lucide-react';
import { StatusSteps } from '@/components/Sponsorship/StatusBadge';
import { FLOW_STEPS, STATUS_STYLE } from '@/components/Sponsorship/statusStyle';
import ChildCard from '@/components/Apadrinhamento/ChildCard';
import { exportSponsorshipsPdf } from '@/lib/pdf/exportSponsorshipsPdf';

// 🔽 Core unificado de status (front-only)
import {
  type SponsorshipStatus,
  ACTIVE_STATUSES,
} from '@/lib/sponsorship-status';

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
  birthDate?: string | null;
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
};

type Sponsorship = {
  id: string;
  status: SponsorshipStatus; // 👈 agora usamos o enum do front (inclui os novos)
  startDate?: string;
  endDate?: string;
  note?: string;
  method?: 'PIX' | 'GIFT' | null;
  collectionPoint?: { id: string; name: string; address?: string | null; district?: string | null; cityName?: string | null } | null;
  child: Child;
  campaign: Campaign;
};

const CLOSED: SponsorshipStatus[] = ['ENDED', 'CANCELLED'];
type View = 'all' | 'pending' | 'active' | 'done';
const VIEW_FILTERS: { key: View; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'active', label: 'A caminho' },
  { key: 'done', label: 'Entregues' },
];
const viewOf = (s: SponsorshipStatus): View | null =>
  CLOSED.includes(s) ? null : s === 'PENDING' ? 'pending' : s === 'COMPLETED' ? 'done' : 'active';

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
  const [campaignFilter, setCampaignFilter] = useState<string>(''); // campaignId ('' = todas)
  const [campaignsReady, setCampaignsReady] = useState(false); // lista carregada e campanha ativa escolhida
  const [error, setError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; phase: 'compose'|'pdf' } | null>(null);

  const [cardsPerPage, setCardsPerPage] = useState<number>(1);
  const [view, setView] = useState<View>('all');

  // contagens por andamento (encerrados/cancelados ficam de fora)
  const counts = useMemo(() => {
    const c: Record<View, number> & { total: number } = { all: 0, pending: 0, active: 0, done: 0, total: 0 };
    for (const sp of items) {
      const v = viewOf(sp.status);
      if (!v) continue;
      c[v]++; c.all++; c.total++;
    }
    return c;
  }, [items]);
  const shown = useMemo(
    () => items.filter((sp) => (view === 'all' ? true : view === 'active' ? viewOf(sp.status) === 'active' : viewOf(sp.status) === view)),
    [items, view],
  );

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
      setError('Sua conta entrou pelo Google e não está vinculada ao cadastro. Entre com e-mail e senha para ver seus apadrinhamentos.');
      setLoading(false);
      return;
    }

    // campanhas uma vez só; a ativa já vem escolhida no filtro
    if (!campaignsReady) {
      (async () => {
        try {
          const [cRes, allRes] = await Promise.all([
            fetch(`${api}/campaigns?status=ACTIVE`, { cache: 'no-store' }),
            fetch(`${api}/campaigns`, { cache: 'no-store' }),
          ]);
          const cJson = cRes.ok ? await cRes.json() : [];
          const allJson = allRes.ok ? await allRes.json() : [];
          const merged: Campaign[] = uniqBy([...(cJson ?? []), ...(allJson ?? [])], 'id')
            .sort((a: any, b: any) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') || (b.year ?? 0) - (a.year ?? 0));
          setCampaigns(merged);
          const active = merged.find((c) => c.status === 'ACTIVE');
          if (active) setCampaignFilter(active.id);
        } catch {
          // sem a lista de campanhas: mostra todas
        } finally {
          setCampaignsReady(true);
        }
      })();
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
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
  }, [status, api, provider, accessToken, campaignFilter, campaignsReady, router]);

  const handleExportPdf = async () => {
    if (loading || shown.length === 0) return;

    setExporting(true);
    setProgress({ current: 0, total: shown.length, phase: 'compose' });

    try {
      const data = shown.map(sp => {
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
          status: sp.status, // já no enum correto
          campaign: { id: sp.campaign.id, name: sp.campaign.name, year: sp.campaign.year ?? null },
          child: {
            id: ch.id,
            name: ch.name,
            publicId: typeof ch.publicId === 'number' ? ch.publicId : null,
            age: ageOf(ch) ?? null,
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

  const grouped = groupByCampaignThenCommunity(shown);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Cabeçalho */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-600 via-rose-500 to-amber-500 text-white shadow-xl">
        <div className="absolute -right-12 -top-12 w-52 h-52 rounded-full bg-white/10" aria-hidden />
        <Heart className="absolute right-6 bottom-4 w-24 h-24 text-white/10 fill-white/10" aria-hidden />
        <div className="relative p-5 sm:p-7">
          <h1 className="text-2xl sm:text-3xl font-bold">Meus apadrinhamentos</h1>
          <p className="text-white/85 text-sm sm:text-base mt-1 max-w-xl">
            Acompanhe cada presente até a entrega e baixe os cartões das suas crianças. Obrigado por fazer parte! 💛
          </p>

          {!loading && !error && counts.total > 0 && (
            <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3 max-w-lg">
              {[
                { label: 'Crianças', value: counts.total },
                // no resumo, "em andamento" inclui os que aguardam aprovação
                { label: 'Em andamento', value: counts.active + counts.pending },
                { label: 'Entregues', value: counts.done },
              ].map((c) => (
                <div key={c.label} className="rounded-2xl bg-white/15 backdrop-blur px-3 py-2.5">
                  <div className="text-xl sm:text-2xl font-bold">{c.value}</div>
                  <div className="text-[11px] sm:text-xs text-white/80">{c.label}</div>
                </div>
              ))}
            </div>
          )}
          {!loading && !error && counts.total > 0 && (
            <div className="mt-4 max-w-lg">
              <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full bg-white transition-all" style={{ width: `${counts.total ? Math.round((counts.done / counts.total) * 100) : 0}%` }} />
              </div>
              <p className="mt-1 text-xs text-white/80">{counts.total ? Math.round((counts.done / counts.total) * 100) : 0}% dos presentes já entregues</p>
            </div>
          )}
        </div>
      </div>

      {/* Filtros e exportação */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative lg:w-72">
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm text-[#253243] hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
            aria-label="Campanha"
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

        {/* andamento */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-gray-100 lg:flex-1 lg:max-w-md" role="radiogroup" aria-label="Andamento">
          {VIEW_FILTERS.map((f) => (
            <button
              key={f.key}
              role="radio"
              aria-checked={view === f.key}
              onClick={() => setView(f.key)}
              className={`py-2 px-1 rounded-lg text-xs sm:text-sm font-medium transition truncate ${view === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              {f.label}{counts[f.key] ? <span className="ml-1 text-gray-400">{counts[f.key]}</span> : null}
            </button>
          ))}
        </div>

        <div className="flex gap-2 lg:ml-auto">
          <select
            value={cardsPerPage}
            onChange={(e) => setCardsPerPage(Number(e.target.value))}
            className="flex-1 lg:flex-none appearance-none bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#253243] hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
            title="Cartões por página no PDF"
            aria-label="Cartões por página no PDF"
          >
            <option value={1}>1 por página</option>
            <option value={2}>2 por página</option>
            <option value={4}>4 por página (2×2)</option>
            <option value={6}>6 por página (3×2)</option>
            <option value={8}>8 por página (4×2)</option>
            <option value={9}>9 por página (3×3)</option>
          </select>
          <button
            onClick={handleExportPdf}
            disabled={loading || shown.length === 0 || exporting}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2 whitespace-nowrap"
            title={view === 'all' ? 'Baixar os cartões em PDF' : 'Baixar os cartões do filtro atual em PDF'}
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Gerando…' : `Baixar PDF${shown.length ? ` (${shown.length})` : ''}`}
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white overflow-hidden animate-pulse">
              <div className="aspect-[9/16] bg-gray-100" />
              <div className="p-3 space-y-2"><div className="h-4 bg-gray-100 rounded w-3/4" /><div className="h-3 bg-gray-100 rounded" /></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
          {provider !== 'nest' && (
            <Link href="/auth/login?callbackUrl=/meus-apadrinhamentos" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white bg-[#253243] hover:bg-[#375A7F]">
              <LogIn className="w-4 h-4" /> Entrar com e-mail e senha
            </Link>
          )}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 sm:p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-pink-50 flex items-center justify-center mb-4">
            <Gift className="w-8 h-8 text-pink-500" />
          </div>
          <h2 className="text-lg font-semibold text-[#253243]">
            {campaignFilter ? 'Nenhum apadrinhamento nesta campanha' : 'Você ainda não apadrinhou nenhuma criança'}
          </h2>
          <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
            Escolha uma criança, leve o presente que ela pediu até um ponto de coleta e acompanhe a entrega por aqui.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
            <Link href="/apadrinhamento" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-green-500 text-white font-semibold shadow-sm hover:shadow-md">
              <Heart className="w-4 h-4" /> Apadrinhar uma criança
            </Link>
            {/* a campanha ativa vem escolhida; apadrinhamentos de anos anteriores ficam em "todas" */}
            {campaignFilter && (
              <button onClick={() => setCampaignFilter('')} className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Ver todas as campanhas
              </button>
            )}
          </div>
        </div>
      ) : shown.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-gray-500">
          Nenhum apadrinhamento neste filtro.
          <button onClick={() => setView('all')} className="block mx-auto mt-3 text-sm text-blue-700 hover:underline">Ver todos</button>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(group => (
            <section key={group.campaign.id} className="space-y-5">
              <header className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600"><CalendarDays className="w-5 h-5" /></span>
                <h2 className="text-lg sm:text-xl font-bold text-[#253243]">
                  {group.campaign.name}{group.campaign.year ? ` (${group.campaign.year})` : ''}
                </h2>
                <CampaignBadge status={group.campaign.status} />
                <span className="w-full sm:w-auto sm:ml-auto text-sm text-gray-500">
                  {group.total} criança{group.total === 1 ? '' : 's'} · {group.communities.length} comunidade{group.communities.length === 1 ? '' : 's'}
                </span>
              </header>

              {group.communities.map(com => (
                <div key={com.name} className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm sm:text-base font-semibold text-[#253243]">{com.name}</h3>
                    <span className="ml-auto text-xs sm:text-sm text-gray-500">{com.items.length}</span>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
                    {com.items.map(sp => (
                      <ChildCard
                        key={sp.id}
                        child={toChildCardData(sp)}
                        footer={<SponsorshipProgress sp={sp} />}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {exporting && progress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <h3 className="font-semibold text-gray-800">Gerando PDF</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              {progress.phase === 'compose' ? 'Compondo imagens' : 'Montando documento'} — {progress.current} de {progress.total}
            </p>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{ width: `${Math.round((progress.current / Math.max(1, progress.total)) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">Não feche esta janela até finalizar o download.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- UI auxiliares ---------- */

/** Onde o presente está no caminho até a criança, e onde entregar */
function SponsorshipProgress({ sp }: { sp: Sponsorship }) {
  const st = STATUS_STYLE[sp.status];
  const cp = sp.collectionPoint;
  return (
    <div className="space-y-1.5">
      <StatusSteps status={sp.status} />
      <p className={`text-[11px] sm:text-xs font-medium ${st?.text ?? 'text-gray-600'}`}>
        {st?.step ? `Etapa ${st.step} de ${FLOW_STEPS.length} · ` : ''}{st?.hint}
      </p>
      {sp.method === 'GIFT' && cp && sp.status !== 'COMPLETED' && !CLOSED.includes(sp.status) && (
        <p className="text-[11px] sm:text-xs text-gray-500 flex items-start gap-1" title={[cp.address, cp.district, cp.cityName].filter(Boolean).join(', ')}>
          <Package className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span className="line-clamp-2">Entregar em <strong className="text-gray-700">{cp.name}</strong>{cp.cityName ? ` · ${cp.cityName}` : ''}</span>
        </p>
      )}
    </div>
  );
}

const CAMPAIGN_STATUS: Record<Campaign['status'], { label: string; cls: string }> = {
  ACTIVE: { label: 'Em andamento', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DRAFT: { label: 'Em preparação', cls: 'bg-gray-50 text-gray-700 border-gray-200' },
  FINISHED: { label: 'Encerrada', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  ARCHIVED: { label: 'Arquivada', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
};

function CampaignBadge({ status }: { status: Campaign['status'] }) {
  const s = CAMPAIGN_STATUS[status] ?? CAMPAIGN_STATUS.DRAFT;
  return <span className={`text-xs font-medium border px-2.5 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>;
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
  const fromNested = (child as any)?.community?.name;
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

    const communities = Array.from(comMap.entries())
      .map(([name, arr]) => ({
        name,
        items: arr.sort((a, b) => a.child.name.localeCompare(b.child.name, 'pt-BR', { sensitivity: 'base' })),
      }))
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

  return result.sort((a, b) => {
    const ay = a.campaign.year ?? 0;
    const by = b.campaign.year ?? 0;
    if (by !== ay) return by - ay;
    return a.campaign.name.localeCompare(b.campaign.name, 'pt-BR', { sensitivity: 'base' });
  });
}

async function safeErrMsg(res: Response) {
  try { const d = await res.json(); return d?.message || d?.error || res.statusText; }
  catch { return res.statusText; }
}

/**
 * Converte um Sponsorship (com child dentro) no shape esperado por <ChildCard />
 * Agora repassamos o status real (inclui IN_PURCHASE, PACKED, BOXED, AWAITING_DELIVERY).
 */
function toChildCardData(sp: Sponsorship) {
  const c = sp.child || ({} as Child);

  const apadrinhado = ACTIVE_STATUSES.includes(sp.status);
  const images = c.images ?? undefined;
  const foto = c.photoUrl ?? (c.media?.[0]?.framedUrl || c.media?.[0]?.processedUrl || '');

  return {
    id: c.id,
    publicId: c.publicId ?? 0,
    nome: c.name,
    idade: ageOf(c),
    cidade: (c as any)?.city?.name ?? (c as any)?.city ?? '',
    escola: (c as any)?.school?.name ?? (c as any)?.school ?? '',
    categoria: c.category ?? '',
    presente: c.wantedGift ?? '',
    descricao: c.description ?? '',
    apadrinhado,
    foto,
    images,
    status: sp.status, // 👈 deixa o ChildCard/StatusBadge traduzirem para PT-BR
    comunidade: getCommunityName(c),
  };
}

/** Idade pela data de nascimento (UTC); sem data, a idade do cadastro; sem nenhuma, não mostra */
function ageOf(c: { birthDate?: string | null; age?: number | null }): number | undefined {
  if (c.birthDate) {
    const d = new Date(c.birthDate);
    if (!isNaN(d.getTime())) {
      const now = new Date();
      let a = now.getUTCFullYear() - d.getUTCFullYear();
      if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) a--;
      return a;
    }
  }
  return typeof c.age === 'number' && c.age > 0 ? c.age : undefined;
}
