'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  CalendarDays, ChevronDown, Gift, Loader2, MapPin, ShieldCheck, XCircle
} from 'lucide-react';

type Campaign = {
  id: string;
  name: string;
  slug: string;
  year?: number;
  status: 'DRAFT' | 'ACTIVE' | 'FINISHED' | 'ARCHIVED';
  startDate?: string;
  endDate?: string;
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
};

type Sponsorship = {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'ENDED' | 'CANCELLED';
  startDate?: string;
  endDate?: string;
  note?: string;
  child: Child;
  campaign: Campaign;
};

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
        // campanhas ativas e recentes
        const cRes = await fetch(`${api}/campaigns?status=ACTIVE`, { cache: 'no-store' });
        const allRes = await fetch(`${api}/campaigns`, { cache: 'no-store' });
        const cJson = cRes.ok ? await cRes.json() : [];
        const allJson = allRes.ok ? await allRes.json() : [];
        const merged = uniqBy([...(cJson ?? []), ...(allJson ?? [])], 'id')
          .sort((a: any,b: any) => (b.year ?? 0) - (a.year ?? 0));
        setCampaigns(merged);

        // apadrinhamentos do usuário (opcionalmente com filtro)
        const url = new URL(`${api}/sponsorships/me`);
        if (campaignFilter) url.searchParams.set('campaignId', campaignFilter);
        const sRes = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        if (!sRes.ok) throw new Error(await safeErrMsg(sRes));
        const sJson = await sRes.json();
        setItems(sJson);
      } catch (e: any) {
        setError(e?.message || 'Falha ao carregar apadrinhamentos.');
      } finally {
        setLoading(false);
      }
    })();
  }, [status, api, provider, accessToken, campaignFilter, router]);

  const grouped = groupByCampaign(items);

  return (
    <div className="min-h-[calc(100dvh-64px)] bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#253243]">Meus Apadrinhamentos</h1>
            <p className="text-gray-600">Veja suas crianças apadrinhadas por campanha.</p>
          </div>

          {/* Filtro de campanha */}
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
        </div>

        {/* Conteúdo */}
        <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-6">
          {loading ? (
            <div className="flex items-center gap-3 text-[#253243]">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Carregando…</span>
            </div>
          ) : error ? (
            <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="text-gray-600">Você ainda não possui apadrinhamentos{campaignFilter ? ' nesta campanha.' : '.'}</div>
          ) : (
            <div className="space-y-8">
              {grouped.map(group => (
                <section key={group.campaign.id} className="space-y-4">
                  <header className="flex items-center gap-3">
                    <CalendarDays className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-[#253243]">
                      {group.campaign.name}{group.campaign.year ? ` (${group.campaign.year})` : ''}
                    </h2>
                    <CampaignBadge status={group.campaign.status} />
                    <span className="ml-auto text-sm text-gray-500">{group.items.length} criança(s)</span>
                  </header>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {group.items.map(sp => (
                      <Card key={sp.id} sp={sp} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----- UI components ----- */

function Card({ sp }: { sp: Sponsorship }) {
  const c = sp.child;
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition bg-white">
      <div className="aspect-[1/1] bg-gray-100 relative">
        {c.photoUrl ? (
          <Image unoptimized src={c.photoUrl} alt={c.name} fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">Sem foto</div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[#253243]">{c.name}</h3>
          <StatusBadge status={sp.status} />
        </div>
        <div className="text-sm text-gray-600 flex items-center gap-2">
          <MapPin className="w-4 h-4" /> {c.city}
        </div>
        {c.wantedGift && (
          <div className="text-sm text-gray-600 flex items-center gap-2">
            <Gift className="w-4 h-4" /> Desejo: {c.wantedGift}
          </div>
        )}
        {/* 
        <div className="pt-2 flex gap-2">
          <a
            href={`/criancas/${c.id}`}
            className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Ver criança
          </a>
          {sp.status === 'PENDING' && (
            <a
              href={`/apadrinhamento/${sp.id}`}
              className="text-sm px-3 py-1.5 bg-[#253243] text-white rounded-lg hover:bg-[#375A7F] inline-flex items-center gap-1"
            >
              <ShieldCheck className="w-4 h-4" /> Continuar processo
            </a>
          )}
        </div>
        */}
        {sp.status === 'PENDING' && (
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[#389745]">Nossa Equipe ira Entrar em Contato Para Concluir o Apadrinhamento</h3>
          </div>
          )}
      </div>
    </div>
  );
}

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

function StatusBadge({ status }: { status: Sponsorship['status'] }) {
  const map = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    PENDING: 'bg-amber-50 text-amber-700 border-amber-100',
    ENDED: 'bg-blue-50 text-blue-700 border-blue-100',
    CANCELLED: 'bg-red-50 text-red-700 border-red-100',
  } as const;
  const label = {
    ACTIVE: 'Ativo',
    PENDING: 'Pendente',
    ENDED: 'Encerrado',
    CANCELLED: 'Cancelado',
  } as const;
  const cls = (map as any)[status] ?? map.PENDING;
  return <span className={`text-xs border px-2 py-0.5 rounded-full ${cls}`}>{label[status]}</span>;
}

/* ----- helpers ----- */
function uniqBy<T extends Record<string, any>>(arr: T[], key: keyof T) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const k = String(it[key]);
    if (!seen.has(k)) { seen.add(k); out.push(it); }
  }
  return out;
}

function groupByCampaign(items: Sponsorship[]) {
  const map = new Map<string, { campaign: Campaign; items: Sponsorship[] }>();
  items.forEach(sp => {
    const id = sp.campaign.id;
    if (!map.has(id)) map.set(id, { campaign: sp.campaign, items: [] });
    map.get(id)!.items.push(sp);
  });
  return Array.from(map.values());
}

async function safeErrMsg(res: Response) {
  try { const d = await res.json(); return d?.message || d?.error || res.statusText }
  catch { return res.statusText }
}
