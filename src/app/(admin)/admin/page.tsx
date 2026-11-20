'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/api';
import CampaignFilter, { useAdminCampaign } from '@/components/Admin/CampaignFilter';
import { STATUS_PT, type SponsorshipStatus } from '@/lib/sponsorship-status';
import { STATUS_STYLE, FLOW_STEPS } from '@/components/Sponsorship/statusStyle';
import {
  Heart, Baby, Calendar, Clock, AlertTriangle, ImageOff, Gift, Users, RefreshCw,
  Activity, UserPlus, Truck, ArrowUpRight, ArrowDownRight, Minus, ClipboardList,
  ArrowRightLeft, FileDown, MapPin, Wallet, History, ScanSearch, Store, X, Search, Download, Maximize2, ChevronDown, ChevronRight,
} from 'lucide-react';

/* ===================== Tipos (GET /dashboard) ===================== */

/** situação da criança: o status do apadrinhamento (sem cancelado) ou disponível */
type ChildKey = Exclude<SponsorshipStatus, 'CANCELLED'> | 'AVAILABLE';
type Group = {
  id: string; name: string; cityId: string | null; cityName: string | null;
  total: number; sponsored: number; sponsoredRate: number; withoutPhoto: number; withoutGift: number;
  counts: Record<ChildKey, number>;
};
type SponsorRow = {
  id: string; name: string; email: string | null; phone: string | null; count: number; gift: number; pix: number; pixAmount: number;
  byStatus: Partial<Record<SponsorshipStatus, number>>; communities: string[]; firstAt: string; lastAt: string;
};
type PointRow = {
  id: string; name: string; cityName: string | null; kind: 'point' | 'pix' | 'none'; count: number;
  byStatus: Partial<Record<SponsorshipStatus, number>>; sponsors: number; communities: string[];
};
type ActivityItem = {
  id: string;
  kind: 'sponsorship_requested' | 'sponsorship_updated' | 'children_registered' | 'sponsor_registered';
  at: string;
  title: string;
  detail?: string | null;
  status?: SponsorshipStatus | null;
  href?: string | null;
};
type Dashboard = {
  generatedAt: string;
  campaign: { id: string; name: string; status: string; startDate?: string | null; endDate?: string | null; daysLeft: number | null } | null;
  children: {
    total: number; sponsored: number; withoutPhoto: number; withoutGift: number; sponsoredRate: number; reservedRate: number;
    counts: Record<ChildKey, number>;
  };
  sponsorships: {
    total: number;
    byStatus: Record<SponsorshipStatus, number>;
    methods: {
      GIFT: { count: number; withoutPoint: number };
      PIX: { count: number; amount: number; withAmount: number; withoutAmount: number; paidCount: number; paidAmount: number; byStatus: Record<SponsorshipStatus, number> };
    };
    sponsors: number;
    topSponsors: { id: string; name: string; count: number }[];
    sponsorsAll: SponsorRow[];
    collectionPoints: { id: string; name: string; count: number }[];
    pointsAll: PointRow[];
  };
  pending: { count: number; oldestAt: string | null; over3Days: number };
  timeline: { days: { date: string; requested: number }[]; last7: number; prev7: number };
  byCity: Group[];
  byCommunity: Group[];
  activity: ActivityItem[];
};

/* ===================== Cores: as mesmas da tela de apadrinhamentos ===================== */

const CHILD_KEYS: ChildKey[] = ['PENDING', 'IN_PROGRESS', 'AWAITING_DELIVERY', 'IN_PURCHASE', 'PACKED', 'BOXED', 'COMPLETED', 'ENDED', 'AVAILABLE'];
const KEY_META: Record<ChildKey, { label: string; bar: string; text: string }> = {
  ...(Object.fromEntries(CHILD_KEYS.filter((k) => k !== 'AVAILABLE').map((k) => [k, {
    label: STATUS_PT[k as SponsorshipStatus],
    bar: STATUS_STYLE[k as SponsorshipStatus].bar,
    text: STATUS_STYLE[k as SponsorshipStatus].text,
  }])) as Record<Exclude<ChildKey, 'AVAILABLE'>, { label: string; bar: string; text: string }>),
  AVAILABLE: { label: 'Disponível', bar: 'bg-gray-200', text: 'text-gray-600' },
};
const viaLabel = (s: SponsorshipStatus) => (STATUS_STYLE[s]?.via === 'GIFT' ? ' (presente)' : STATUS_STYLE[s]?.via === 'PIX' ? ' (PIX)' : '');

const CAMPAIGN_STATUS_PT: Record<string, string> = { DRAFT: 'Rascunho', ACTIVE: 'Ativa', FINISHED: 'Finalizada', ARCHIVED: 'Arquivada' };

const nf = new Intl.NumberFormat('pt-BR');
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');
const pctOf = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 6e4);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return d === 1 ? 'ontem' : `há ${d} dias`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function waitTime(iso: string | null) {
  if (!iso) return '';
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 36e5);
  if (h < 1) return 'menos de 1 hora';
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} dias`;
}

/* ===================== Página ===================== */

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const token = (session as any)?.accessToken ?? null;
  const ready = status === 'authenticated' && !!token;
  // campanha: começa com a única ativa (se houver) e é lembrada entre as telas do admin
  const { campaigns, campaignId, setCampaignId, ready: campaignReady } = useAdminCampaign();

  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<null | 'sponsors' | 'points'>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const qs = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : '';
      const res = await apiFetch(`/dashboard${qs}`, { cache: 'no-store', signal }, token);
      if (!res.ok) throw new Error(`Erro ${res.status} ao carregar o dashboard`);
      setData(await res.json());
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e?.message ?? 'Falha ao carregar');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [campaignId, token]);

  useEffect(() => {
    if (!ready || !campaignReady) return;
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [ready, campaignReady, load]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            {data?.campaign ? <>Visão da campanha <b>{data.campaign.name}</b></> : 'Visão de todas as campanhas'}
            {data && <span className="text-gray-400"> · atualizado {relTime(data.generatedAt)}</span>}
          </p>
        </div>
        <div className="flex items-end gap-2 w-full lg:w-auto">
          <CampaignFilter campaigns={campaigns} value={campaignId} onChange={setCampaignId} className="w-full lg:w-96" />
          <button
            onClick={() => load()}
            disabled={loading}
            title="Atualizar"
            className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}. <button className="underline" onClick={() => load()}>Tentar de novo</button>
        </div>
      )}

      {!data ? (
        <SkeletonDashboard />
      ) : (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {data.campaign && <CampaignBanner c={data.campaign} />}
          <Attention d={data} />
          <Kpis d={data} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2" title="Pedidos de apadrinhamento por dia" subtitle="Últimos 30 dias" icon={<Heart className="w-5 h-5 text-pink-600" />}>
              <Timeline t={data.timeline} />
            </Card>
            <Card title="Etapas dos apadrinhamentos" subtitle={`${nf.format(data.sponsorships.total)} ativos (sem cancelados)`} icon={<Truck className="w-5 h-5 text-indigo-600" />}>
              <Pipeline byStatus={data.sponsorships.byStatus} />
            </Card>
          </div>

          <Places d={data} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2" title="Atividade recente" subtitle="Pedidos, mudanças de etapa, cadastros e novos padrinhos" icon={<Activity className="w-5 h-5 text-gray-600" />}>
              <ActivityList items={data.activity} />
            </Card>
            <div className="space-y-6">
              <Card
                title="Padrinhos que mais apadrinharam"
                icon={<Users className="w-5 h-5 text-emerald-600" />}
                action={data.sponsorships.sponsorsAll.length > 0 && <SeeAll onClick={() => setModal('sponsors')} n={data.sponsorships.sponsorsAll.length} />}
              >
                <RankList rows={data.sponsorships.topSponsors} unit="criança" empty="Nenhum apadrinhamento ainda." />
              </Card>
              <Card
                title="Presentes por ponto de coleta"
                icon={<Gift className="w-5 h-5 text-amber-600" />}
                action={data.sponsorships.pointsAll.length > 0 && <SeeAll onClick={() => setModal('points')} n={data.sponsorships.pointsAll.length} />}
              >
                <RankList rows={data.sponsorships.collectionPoints.slice(0, 6)} unit="presente" empty="Nenhum presente com ponto de coleta." />
              </Card>
            </div>
          </div>

          <QuickActions />
        </div>
      )}

      {data && modal === 'sponsors' && <SponsorsModal rows={data.sponsorships.sponsorsAll} onClose={() => setModal(null)} />}
      {data && modal === 'points' && <PointsModal rows={data.sponsorships.pointsAll} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ===================== Blocos ===================== */

function Card({ title, subtitle, icon, action, className = '', children }: {
  title: string; subtitle?: string; icon?: ReactNode; action?: ReactNode; className?: string; children: ReactNode;
}) {
  return (
    <section className={`bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          {icon && <div className="p-2 bg-gray-50 rounded-lg shrink-0">{icon}</div>}
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

function SeeAll({ onClick, n }: { onClick: () => void; n: number }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
      <Maximize2 className="w-3.5 h-3.5" /> Ver todos ({nf.format(n)})
    </button>
  );
}

function CampaignBanner({ c }: { c: NonNullable<Dashboard['campaign']> }) {
  const left = c.daysLeft;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-blue-100 bg-blue-50/70 px-5 py-3 text-sm text-blue-900">
      <span className="inline-flex items-center gap-2 font-medium">
        <Calendar className="w-4 h-4" /> {c.name}
      </span>
      <span className="px-2 py-0.5 rounded-full bg-white border border-blue-200 text-xs font-medium">{CAMPAIGN_STATUS_PT[c.status] ?? c.status}</span>
      <span>{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</span>
      {left != null && (
        <span className="font-medium">
          {left > 1 ? `faltam ${left} dias` : left === 1 ? 'termina amanhã' : left === 0 ? 'termina hoje' : `encerrada há ${-left} dias`}
        </span>
      )}
    </div>
  );
}

/** O que precisa de ação agora — só aparece o que existe */
function Attention({ d }: { d: Dashboard }) {
  const items: { tone: 'amber' | 'red' | 'slate'; icon: ReactNode; title: string; text: string; href: string; cta: string }[] = [];
  if (d.pending.count > 0) {
    items.push({
      tone: d.pending.over3Days > 0 ? 'red' : 'amber',
      icon: <Clock className="w-5 h-5" />,
      title: `${nf.format(d.pending.count)} pedido${d.pending.count > 1 ? 's' : ''} aguardando aprovação`,
      text: d.pending.over3Days > 0
        ? `${d.pending.over3Days} esperando há mais de 3 dias · o mais antigo há ${waitTime(d.pending.oldestAt)}`
        : `O mais antigo espera há ${waitTime(d.pending.oldestAt)}`,
      href: '/admin/sponsorships',
      cta: 'Aprovar',
    });
  }
  if (d.campaign && d.children.withoutPhoto > 0) {
    items.push({
      tone: 'slate',
      icon: <ImageOff className="w-5 h-5" />,
      title: `${nf.format(d.children.withoutPhoto)} criança${d.children.withoutPhoto > 1 ? 's' : ''} sem foto`,
      text: 'Aparecem só com o layout e o espaço da foto vazio',
      href: '/admin/children?photo=without',
      cta: 'Enviar fotos',
    });
  }
  if (d.children.withoutGift > 0) {
    items.push({
      tone: 'slate',
      icon: <Gift className="w-5 h-5" />,
      title: `${nf.format(d.children.withoutGift)} criança${d.children.withoutGift > 1 ? 's' : ''} sem presente`,
      text: 'Sem presente informado para esta campanha',
      href: '/admin/children',
      cta: 'Ver crianças',
    });
  }
  if (d.sponsorships.methods.GIFT.withoutPoint > 0) {
    items.push({
      tone: 'slate',
      icon: <Store className="w-5 h-5" />,
      title: `${nf.format(d.sponsorships.methods.GIFT.withoutPoint)} presente${d.sponsorships.methods.GIFT.withoutPoint > 1 ? 's' : ''} sem ponto de coleta`,
      text: 'O padrinho ainda não escolheu onde entregar',
      href: '/admin/sponsorships',
      cta: 'Definir',
    });
  }
  if (!items.length) return null;

  const tone = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    slate: 'border-gray-200 bg-white text-gray-900',
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {items.map((i) => (
        <Link key={i.title} href={i.href} className={`group flex items-start gap-3 rounded-2xl border px-4 py-3 hover:shadow-md transition ${tone[i.tone]}`}>
          <div className="mt-0.5 shrink-0">{i.tone === 'red' ? <AlertTriangle className="w-5 h-5" /> : i.icon}</div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{i.title}</p>
            <p className="text-xs opacity-80">{i.text}</p>
          </div>
          <span className="text-xs font-medium whitespace-nowrap opacity-70 group-hover:opacity-100">{i.cta} →</span>
        </Link>
      ))}
    </div>
  );
}

function Kpis({ d }: { d: Dashboard }) {
  const c = d.children;
  const pix = d.sponsorships.methods.PIX;
  const gift = d.sponsorships.methods.GIFT;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* situação das crianças: barra única empilhada, com todos os status */}
      <section className="lg:col-span-2 bg-white/80 rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-gray-600 flex items-center gap-2"><Baby className="w-4 h-4 text-pink-600" /> Crianças {d.campaign ? 'na campanha' : 'cadastradas'}</p>
            <p className="text-4xl font-bold text-gray-900 mt-1">{nf.format(c.total)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Já têm padrinho</p>
            <p className="text-4xl font-bold text-emerald-700 mt-1">{c.sponsoredRate.toLocaleString('pt-BR')}%</p>
            <p className="text-xs text-gray-500">{c.reservedRate.toLocaleString('pt-BR')}% contando os pedidos pendentes</p>
          </div>
        </div>
        <StackedBar counts={c.counts} total={c.total} className="h-4 mt-5" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-3 mt-4">
          {CHILD_KEYS.filter((k) => c.counts[k] > 0 || k === 'AVAILABLE' || k === 'PENDING' || k === 'COMPLETED').map((k) => (
            <div key={k}>
              <p className="text-xs text-gray-600 flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${KEY_META[k].bar}`} />{KEY_META[k].label}{k !== 'AVAILABLE' ? viaLabel(k as SponsorshipStatus) : ''}</p>
              <p className="text-lg font-semibold text-gray-900">
                {nf.format(c.counts[k])}
                <span className="ml-1 text-xs font-normal text-gray-500">{pctOf(c.counts[k], c.total)}%</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-1 gap-6">
        <Tile
          icon={<Users className="w-4 h-4 text-sky-600" />}
          label="Padrinhos"
          value={nf.format(d.sponsorships.sponsors)}
          hint={d.sponsorships.sponsors ? `${(d.sponsorships.total / d.sponsorships.sponsors).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} criança(s) por padrinho · ${nf.format(gift.count)} presente(s)` : 'Nenhum ainda'}
        />
        <section className="bg-white/80 rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-600 flex items-center gap-2"><Wallet className="w-4 h-4 text-indigo-600" />Doações PIX</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{nf.format(pix.count)} <span className="text-sm font-normal text-gray-500">pedido{pix.count === 1 ? '' : 's'}</span></p>
          {pix.count ? (
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between gap-2"><dt className="text-gray-500">Valor informado ({pix.withAmount})</dt><dd className="font-semibold text-gray-900">{money.format(pix.amount)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-gray-500">Pago ({pix.paidCount})</dt><dd className="font-semibold text-emerald-700">{money.format(pix.paidAmount)}</dd></div>
              {pix.withoutAmount > 0 && (
                <div className="flex justify-between gap-2"><dt className="text-amber-700">Sem valor ainda</dt><dd className="font-semibold text-amber-700">{nf.format(pix.withoutAmount)}</dd></div>
              )}
              <div className="pt-1"><MiniStatus byStatus={pix.byStatus} total={pix.count} /></div>
            </dl>
          ) : (
            <p className="text-xs text-gray-500 mt-1">Nenhum pedido por PIX.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Tile({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) {
  return (
    <section className="bg-white/80 rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-sm text-gray-600 flex items-center gap-2">{icon}{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </section>
  );
}

/** Barra empilhada com a situação de cada criança (cores dos status) */
function StackedBar({ counts, total, className = '' }: { counts: Record<ChildKey, number>; total: number; className?: string }) {
  if (!total) return <div className={`rounded-full bg-gray-100 ${className}`} />;
  return (
    <div className={`flex gap-px rounded-full overflow-hidden bg-gray-100 ${className}`}>
      {CHILD_KEYS.map((k) =>
        counts[k] > 0 ? (
          <div key={k} className={KEY_META[k].bar} style={{ width: `${(counts[k] / total) * 100}%` }} title={`${KEY_META[k].label}: ${nf.format(counts[k])} (${pctOf(counts[k], total)}%)`} />
        ) : null,
      )}
    </div>
  );
}

/** Barra fina por status de apadrinhamento (pontos, padrinhos, PIX) */
function MiniStatus({ byStatus, total, className = 'h-1.5' }: { byStatus: Partial<Record<SponsorshipStatus, number>>; total: number; className?: string }) {
  if (!total) return null;
  return (
    <div className={`flex gap-px rounded-full overflow-hidden bg-gray-100 ${className}`}>
      {[...FLOW_STEPS, 'ENDED' as SponsorshipStatus].map((s) => (byStatus[s] ?? 0) > 0 ? (
        <div key={s} className={STATUS_STYLE[s].bar} style={{ width: `${((byStatus[s] ?? 0) / total) * 100}%` }} title={`${STATUS_PT[s]}${viaLabel(s)}: ${byStatus[s]}`} />
      ) : null)}
    </div>
  );
}

function Timeline({ t }: { t: Dashboard['timeline'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...t.days.map((d) => d.requested));
  const total = t.days.reduce((a, d) => a + d.requested, 0);
  const delta = t.last7 - t.prev7;
  const label = (iso: string) => {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  };
  const shown = hover != null ? t.days[hover] : null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 mb-4">
        <p><span className="text-2xl font-bold text-gray-900">{nf.format(total)}</span> <span className="text-sm text-gray-500">pedidos no período</span></p>
        <p className="text-sm text-gray-600 inline-flex items-center gap-1">
          {delta > 0 ? <ArrowUpRight className="w-4 h-4 text-emerald-600" /> : delta < 0 ? <ArrowDownRight className="w-4 h-4 text-red-600" /> : <Minus className="w-4 h-4 text-gray-400" />}
          {nf.format(t.last7)} nos últimos 7 dias · {nf.format(t.prev7)} nos 7 anteriores
        </p>
      </div>

      <div className="relative">
        <div className="h-6 text-xs text-gray-700">
          {shown ? <><b>{label(shown.date)}</b> · {shown.requested} pedido{shown.requested === 1 ? '' : 's'}</> : <span className="text-gray-400">Passe o mouse nas barras</span>}
        </div>
        <div className="flex items-end gap-[2px] h-36 border-b border-gray-200" onMouseLeave={() => setHover(null)}>
          {t.days.map((d, i) => (
            <div key={d.date} className="flex-1 h-full flex items-end cursor-default" onMouseEnter={() => setHover(i)}>
              <div
                className={`w-full rounded-t ${hover === i ? 'bg-pink-600' : 'bg-pink-400'}`}
                style={{ height: d.requested ? `${Math.max(4, (d.requested / max) * 100)}%` : 0 }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-gray-400 mt-1">
          <span>{label(t.days[0].date)}</span>
          <span>{label(t.days[14].date)}</span>
          <span>{label(t.days[t.days.length - 1].date)}</span>
        </div>
      </div>
    </div>
  );
}

/** Etapas do fluxo, com a cor, o ícone e o número da etapa iguais aos da tela de apadrinhamentos */
function Pipeline({ byStatus }: { byStatus: Record<SponsorshipStatus, number> }) {
  const steps: SponsorshipStatus[] = [...FLOW_STEPS, 'ENDED'];
  const max = Math.max(1, ...steps.map((s) => byStatus[s] ?? 0));
  return (
    <div className="space-y-2">
      {steps.map((s) => {
        const n = byStatus[s] ?? 0;
        const st = STATUS_STYLE[s];
        const Icon = st.icon;
        return (
          <div key={s} className="grid grid-cols-[9.5rem_1fr_2.5rem] items-center gap-2 text-sm" title={st.hint}>
            <span className={`inline-flex items-center gap-1.5 truncate ${st.text}`}>
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{st.step ? `${st.step}. ` : ''}{STATUS_PT[s]}{viaLabel(s)}</span>
            </span>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${(n / max) * 100}%` }} />
            </div>
            <span className="text-right font-medium text-gray-900 tabular-nums">{nf.format(n)}</span>
          </div>
        );
      })}
      {byStatus.CANCELLED > 0 && <p className="text-xs text-gray-500 pt-1">{nf.format(byStatus.CANCELLED)} cancelado(s), fora da contagem</p>}
      <Link href="/admin/sponsorships" className="inline-block text-sm text-blue-600 hover:text-blue-700 font-medium pt-2">Ver apadrinhamentos →</Link>
    </div>
  );
}

/* ===================== Situação por local: mapa de calor + tabela ===================== */

type PlaceTab = 'city' | 'community' | 'point';
type Metric = 'sponsored' | 'pending' | 'available' | 'withoutPhoto';
const METRICS: { id: Metric; label: string; of: (g: Group) => number; scale: string[] }[] = [
  { id: 'sponsored', label: '% com padrinho', of: (g) => g.sponsored, scale: ['bg-emerald-50 text-emerald-900', 'bg-emerald-100 text-emerald-900', 'bg-emerald-300 text-emerald-950', 'bg-emerald-500 text-white', 'bg-emerald-700 text-white'] },
  { id: 'pending', label: '% pendentes', of: (g) => g.counts.PENDING, scale: ['bg-amber-50 text-amber-900', 'bg-amber-100 text-amber-900', 'bg-amber-300 text-amber-950', 'bg-amber-500 text-white', 'bg-amber-700 text-white'] },
  { id: 'available', label: '% disponíveis', of: (g) => g.counts.AVAILABLE, scale: ['bg-slate-50 text-slate-900', 'bg-slate-100 text-slate-900', 'bg-slate-300 text-slate-950', 'bg-slate-500 text-white', 'bg-slate-700 text-white'] },
  { id: 'withoutPhoto', label: '% sem foto', of: (g) => g.withoutPhoto, scale: ['bg-rose-50 text-rose-900', 'bg-rose-100 text-rose-900', 'bg-rose-300 text-rose-950', 'bg-rose-500 text-white', 'bg-rose-700 text-white'] },
];
const POINT_SCALE = METRICS[0].scale;
const bucket = (p: number) => (p >= 80 ? 4 : p >= 60 ? 3 : p >= 40 ? 2 : p >= 20 ? 1 : 0);
/** já recebidos no galpão ou entregues (embalado, encaixotado, concluído) */
const RECEIVED: SponsorshipStatus[] = ['PACKED', 'BOXED', 'COMPLETED'];
const pointReceived = (p: PointRow) => RECEIVED.reduce((n, s) => n + (p.byStatus[s] ?? 0), 0);

function Places({ d }: { d: Dashboard }) {
  const [tab, setTab] = useState<PlaceTab>('city');
  const [metric, setMetric] = useState<Metric>('sponsored');
  const [selected, setSelected] = useState<string | null>(null);
  const m = METRICS.find((x) => x.id === metric)!;
  const keyOf = (g: Group) => `${g.cityId ?? g.cityName}|${g.id || g.name}`;

  // comunidades agrupadas por cidade (cidades na ordem de tamanho)
  const communitiesByCity = useMemo(() => {
    const order = new Map(d.byCity.map((c, i) => [c.cityId ?? c.name, i]));
    const map = new Map<string, { city: Group | undefined; name: string; rows: Group[] }>();
    for (const g of d.byCommunity) {
      const k = g.cityId ?? g.cityName ?? '';
      const e = map.get(k) ?? { city: d.byCity.find((c) => (c.cityId ?? c.name) === k), name: g.cityName ?? 'Sem cidade', rows: [] };
      e.rows.push(g);
      map.set(k, e);
    }
    return [...map.entries()].sort((a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99)).map(([, v]) => ({ ...v, rows: v.rows.sort((x, y) => x.name.localeCompare(y.name, 'pt-BR')) }));
  }, [d]);

  useEffect(() => setSelected(null), [tab, d]);
  const selGroup = tab === 'city' ? d.byCity.find((g) => keyOf(g) === selected) : tab === 'community' ? d.byCommunity.find((g) => keyOf(g) === selected) : undefined;
  const selPoint = tab === 'point' ? d.sponsorships.pointsAll.find((p) => `${p.kind}|${p.id}` === selected) : undefined;

  const tile = (g: Group, sub?: string) => {
    const k = keyOf(g);
    const p = pctOf(m.of(g), g.total);
    return (
      <button
        key={k}
        type="button"
        onClick={() => setSelected(selected === k ? null : k)}
        title={`${g.name}${sub ? ` (${sub})` : ''}: ${p}% — ${nf.format(g.total)} criança(s)`}
        className={`rounded-lg px-2.5 py-2 text-left transition ring-offset-1 ${m.scale[bucket(p)]} ${selected === k ? 'ring-2 ring-blue-600' : 'hover:ring-2 hover:ring-gray-300'}`}
      >
        <p className="text-xs font-semibold truncate">{g.name}</p>
        <p className="text-lg font-bold leading-tight">{p}%</p>
        <p className="text-[10px] opacity-80">{nf.format(g.total)} criança{g.total === 1 ? '' : 's'}</p>
      </button>
    );
  };

  return (
    <Card
      title="Situação por local"
      subtitle="Clique num quadro do mapa para ver os detalhes"
      icon={<MapPin className="w-5 h-5 text-indigo-600" />}
      action={
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-sm">
          {([['city', 'Cidades'], ['community', 'Comunidades'], ['point', 'Pontos de coleta']] as [PlaceTab, string][]).map(([g, label]) => (
            <button key={g} onClick={() => setTab(g)} className={`px-3 py-1 rounded-md ${tab === g ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>
      }
    >
      {/* mapa de calor */}
      <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
          {tab !== 'point' ? (
            <>
              <span className="text-gray-600">Cor por</span>
              {METRICS.map((x) => (
                <button key={x.id} onClick={() => setMetric(x.id)} className={`px-2.5 py-1 rounded-full border ${metric === x.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-700'}`}>{x.label}</button>
              ))}
            </>
          ) : (
            <span className="text-gray-600">Cor: % dos presentes já recebidos (embalados, encaixotados ou entregues)</span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-gray-500">
            0%{(tab === 'point' ? POINT_SCALE : m.scale).map((c) => <span key={c} className={`w-5 h-3 rounded-sm ${c.split(' ')[0]}`} />)}100%
          </span>
        </div>
        {tab === 'city' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">{d.byCity.map((g) => tile(g))}</div>
        )}
        {tab === 'community' && (
          <div className="space-y-3">
            {communitiesByCity.map((c) => (
              <div key={c.name}>
                <p className="text-xs font-semibold text-gray-600 mb-1">{c.name} <span className="font-normal text-gray-400">· {c.rows.length} comunidade(s)</span></p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2">{c.rows.map((g) => tile(g, c.name))}</div>
              </div>
            ))}
          </div>
        )}
        {tab === 'point' && (
          d.sponsorships.pointsAll.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {d.sponsorships.pointsAll.map((p) => {
                const k = `${p.kind}|${p.id}`;
                const pc = pctOf(pointReceived(p), p.count);
                return (
                  <button key={k} type="button" onClick={() => setSelected(selected === k ? null : k)}
                    className={`rounded-lg px-2.5 py-2 text-left transition ${POINT_SCALE[bucket(pc)]} ${selected === k ? 'ring-2 ring-blue-600' : 'hover:ring-2 hover:ring-gray-300'} ${p.kind !== 'point' ? 'border border-dashed border-gray-400' : ''}`}
                    title={`${p.name}: ${pc}% recebidos de ${p.count}`}>
                    <p className="text-xs font-semibold truncate">{p.name}</p>
                    <p className="text-lg font-bold leading-tight">{pc}%</p>
                    <p className="text-[10px] opacity-80">{nf.format(p.count)} presente{p.count === 1 ? '' : 's'}</p>
                  </button>
                );
              })}
            </div>
          ) : <p className="text-sm text-gray-500">Nenhum apadrinhamento ainda.</p>
        )}

        {selGroup && <GroupDetail g={selGroup} community={tab === 'community'} onClose={() => setSelected(null)} />}
        {selPoint && <PointDetail p={selPoint} onClose={() => setSelected(null)} />}
      </div>

      {tab === 'city' && <PlaceTable rows={d.byCity} selected={selected} keyOf={keyOf} onSelect={setSelected} />}
      {tab === 'community' && <CommunityTable groups={communitiesByCity} selected={selected} keyOf={keyOf} onSelect={setSelected} />}
      {tab === 'point' && <PointTable rows={d.sponsorships.pointsAll} selected={selected} onSelect={setSelected} />}
    </Card>
  );
}

function StatusLegendCounts({ counts, total }: { counts: Partial<Record<ChildKey, number>>; total: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1.5 mt-3">
      {CHILD_KEYS.filter((k) => (counts[k] ?? 0) > 0).map((k) => (
        <div key={k} className="text-xs">
          <span className="inline-flex items-center gap-1.5 text-gray-600"><span className={`w-2.5 h-2.5 rounded-sm ${KEY_META[k].bar}`} />{KEY_META[k].label}{k !== 'AVAILABLE' ? viaLabel(k as SponsorshipStatus) : ''}</span>
          <p className="font-semibold text-gray-900">{nf.format(counts[k] ?? 0)} <span className="font-normal text-gray-500">{pctOf(counts[k] ?? 0, total)}%</span></p>
        </div>
      ))}
    </div>
  );
}

function GroupDetail({ g, community, onClose }: { g: Group; community: boolean; onClose: () => void }) {
  return (
    <div className="mt-3 rounded-xl border border-blue-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{g.name}{community && g.cityName ? <span className="font-normal text-gray-500"> · {g.cityName}</span> : null}</p>
          <p className="text-xs text-gray-600">
            {nf.format(g.total)} criança(s) · <b className="text-emerald-700">{g.sponsoredRate.toLocaleString('pt-BR')}% com padrinho</b>
            {g.withoutPhoto ? <> · <span className="text-rose-700">{nf.format(g.withoutPhoto)} sem foto</span></> : null}
            {g.withoutGift ? <> · <span className="text-amber-700">{nf.format(g.withoutGift)} sem presente</span></> : null}
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500" aria-label="Fechar"><X className="w-4 h-4" /></button>
      </div>
      <StackedBar counts={g.counts} total={g.total} className="h-3 mt-3" />
      <StatusLegendCounts counts={g.counts} total={g.total} />
      <div className="flex flex-wrap gap-3 mt-3 text-sm">
        <Link href="/admin/sponsorships" className="text-blue-600 hover:underline">Ver apadrinhamentos →</Link>
        <Link href="/admin/children" className="text-blue-600 hover:underline">Ver crianças →</Link>
      </div>
    </div>
  );
}

function PointDetail({ p, onClose }: { p: PointRow; onClose: () => void }) {
  return (
    <div className="mt-3 rounded-xl border border-blue-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{p.name}{p.cityName ? <span className="font-normal text-gray-500"> · {p.cityName}</span> : null}</p>
          <p className="text-xs text-gray-600">
            {nf.format(p.count)} presente(s) · {nf.format(p.sponsors)} padrinho(s) · <b className="text-emerald-700">{pctOf(pointReceived(p), p.count)}% já recebidos</b>
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500" aria-label="Fechar"><X className="w-4 h-4" /></button>
      </div>
      <MiniStatus byStatus={p.byStatus} total={p.count} className="h-3 mt-3" />
      <StatusLegendCounts counts={p.byStatus as Partial<Record<ChildKey, number>>} total={p.count} />
      {p.communities.length > 0 && <p className="text-xs text-gray-600 mt-3"><b>Comunidades:</b> {p.communities.join(' · ')}</p>}
    </div>
  );
}

const thCls = 'py-2 px-3 font-medium';
function PlaceHead({ first }: { first: string }) {
  return (
    <thead>
      <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
        <th className={`${thCls} pl-0`}>{first}</th>
        <th className={`${thCls} text-right`}>Crianças</th>
        <th className={`${thCls} w-1/3 min-w-40`}>Situação</th>
        <th className={`${thCls} text-right`}>Com padrinho</th>
        <th className={`${thCls} text-right`}>Pendentes</th>
        <th className={`${thCls} text-right`}>Disponíveis</th>
        <th className={`${thCls} text-right pr-0`}>Sem foto</th>
      </tr>
    </thead>
  );
}
function PlaceRow({ r, sub, selected, onClick, bold, indent }: { r: Group; sub?: string | null; selected?: boolean; onClick?: () => void; bold?: boolean; indent?: boolean }) {
  return (
    <tr onClick={onClick} className={`border-b border-gray-50 last:border-0 ${onClick ? 'cursor-pointer hover:bg-gray-50' : ''} ${selected ? 'bg-blue-50' : ''} ${bold ? 'bg-gray-50/80' : ''}`}>
      <td className={`py-2 pr-3 ${indent ? 'pl-6' : ''}`}>
        <p className={`text-gray-900 ${bold ? 'font-semibold' : 'font-medium'}`}>{r.name}</p>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </td>
      <td className="py-2 px-3 text-right tabular-nums">{nf.format(r.total)}</td>
      <td className="py-2 px-3"><StackedBar counts={r.counts} total={r.total} className="h-2.5" /></td>
      <td className="py-2 px-3 text-right tabular-nums">{nf.format(r.sponsored)} <span className="text-xs text-gray-500">({pctOf(r.sponsored, r.total)}%)</span></td>
      <td className={`py-2 px-3 text-right tabular-nums ${r.counts.PENDING ? STATUS_STYLE.PENDING.text : 'text-gray-400'}`}>{nf.format(r.counts.PENDING)}</td>
      <td className="py-2 px-3 text-right tabular-nums">{nf.format(r.counts.AVAILABLE)}</td>
      <td className={`py-2 pl-3 text-right tabular-nums ${r.withoutPhoto ? 'text-rose-700 font-medium' : 'text-gray-400'}`}>{nf.format(r.withoutPhoto)}</td>
    </tr>
  );
}

function PlaceTable({ rows, selected, keyOf, onSelect }: { rows: Group[]; selected: string | null; keyOf: (g: Group) => string; onSelect: (k: string | null) => void }) {
  const [all, setAll] = useState(false);
  const visible = all ? rows : rows.slice(0, 10);
  if (!rows.length) return <p className="text-sm text-gray-500">Nenhuma criança nesta seleção.</p>;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <PlaceHead first="Cidade" />
          <tbody>
            {visible.map((r) => <PlaceRow key={keyOf(r)} r={r} selected={selected === keyOf(r)} onClick={() => onSelect(selected === keyOf(r) ? null : keyOf(r))} />)}
          </tbody>
        </table>
      </div>
      {rows.length > 10 && (
        <button onClick={() => setAll((v) => !v)} className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
          {all ? 'Mostrar menos' : `Mostrar todas (${rows.length})`}
        </button>
      )}
    </div>
  );
}

/** Comunidades separadas por cidade: a linha da cidade traz o total e abre/fecha as comunidades */
function CommunityTable({ groups, selected, keyOf, onSelect }: {
  groups: { city: Group | undefined; name: string; rows: Group[] }[]; selected: string | null; keyOf: (g: Group) => string; onSelect: (k: string | null) => void;
}) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  if (!groups.length) return <p className="text-sm text-gray-500">Nenhuma criança nesta seleção.</p>;
  const toggle = (n: string) => setClosed((p) => { const s = new Set(p); if (s.has(n)) s.delete(n); else s.add(n); return s; });
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 justify-end text-xs mb-1">
        <button className="text-blue-600 hover:underline" onClick={() => setClosed(new Set())}>abrir todas</button>
        <button className="text-blue-600 hover:underline" onClick={() => setClosed(new Set(groups.map((g) => g.name)))}>fechar todas</button>
      </div>
      <table className="w-full text-sm">
        <PlaceHead first="Cidade / comunidade" />
        {groups.map((c) => {
          const open = !closed.has(c.name);
          const city: Group = c.city ?? {
            id: '', name: c.name, cityId: null, cityName: c.name,
            total: c.rows.reduce((n, r) => n + r.total, 0), sponsored: c.rows.reduce((n, r) => n + r.sponsored, 0), sponsoredRate: 0,
            withoutPhoto: c.rows.reduce((n, r) => n + r.withoutPhoto, 0), withoutGift: 0,
            counts: Object.fromEntries(CHILD_KEYS.map((k) => [k, c.rows.reduce((n, r) => n + r.counts[k], 0)])) as Record<ChildKey, number>,
          };
          return (
            <tbody key={c.name}>
              <tr className="bg-gray-50/80 border-b border-gray-100 cursor-pointer hover:bg-gray-100" onClick={() => toggle(c.name)}>
                <td className="py-2 pr-3">
                  <span className="inline-flex items-center gap-1 font-semibold text-gray-900">
                    {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />} {c.name}
                  </span>
                  <p className="text-xs text-gray-500 pl-5">{c.rows.length} comunidade(s)</p>
                </td>
                <td className="py-2 px-3 text-right tabular-nums font-semibold">{nf.format(city.total)}</td>
                <td className="py-2 px-3"><StackedBar counts={city.counts} total={city.total} className="h-2.5" /></td>
                <td className="py-2 px-3 text-right tabular-nums font-semibold">{nf.format(city.sponsored)} <span className="text-xs font-normal text-gray-500">({pctOf(city.sponsored, city.total)}%)</span></td>
                <td className="py-2 px-3 text-right tabular-nums font-semibold">{nf.format(city.counts.PENDING)}</td>
                <td className="py-2 px-3 text-right tabular-nums font-semibold">{nf.format(city.counts.AVAILABLE)}</td>
                <td className="py-2 pl-3 text-right tabular-nums font-semibold">{nf.format(city.withoutPhoto)}</td>
              </tr>
              {open && c.rows.map((r) => (
                <PlaceRow key={keyOf(r)} r={r} indent selected={selected === keyOf(r)} onClick={() => onSelect(selected === keyOf(r) ? null : keyOf(r))} />
              ))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

function PointTable({ rows, selected, onSelect }: { rows: PointRow[]; selected: string | null; onSelect: (k: string | null) => void }) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
            <th className={`${thCls} pl-0`}>Ponto de coleta</th>
            <th className={`${thCls} text-right`}>Presentes</th>
            <th className={`${thCls} w-1/3 min-w-40`}>Etapas</th>
            <th className={`${thCls} text-right`}>Recebidos</th>
            <th className={`${thCls} text-right`}>Padrinhos</th>
            <th className={`${thCls} text-right pr-0`}>Comunidades</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const k = `${p.kind}|${p.id}`;
            const rec = pointReceived(p);
            return (
              <tr key={k} onClick={() => onSelect(selected === k ? null : k)} className={`border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 ${selected === k ? 'bg-blue-50' : ''}`}>
                <td className="py-2 pr-3">
                  <p className={`font-medium ${p.kind === 'point' ? 'text-gray-900' : 'text-gray-600 italic'}`}>{p.name}</p>
                  {p.cityName && <p className="text-xs text-gray-500">{p.cityName}</p>}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">{nf.format(p.count)}</td>
                <td className="py-2 px-3"><MiniStatus byStatus={p.byStatus} total={p.count} className="h-2.5" /></td>
                <td className="py-2 px-3 text-right tabular-nums">{nf.format(rec)} <span className="text-xs text-gray-500">({pctOf(rec, p.count)}%)</span></td>
                <td className="py-2 px-3 text-right tabular-nums">{nf.format(p.sponsors)}</td>
                <td className="py-2 pl-3 text-right tabular-nums">{nf.format(p.communities.length)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ===================== Atividade, ranking e janelas ===================== */

const ACTIVITY_ICON: Record<ActivityItem['kind'], { icon: ReactNode; tone: string }> = {
  sponsorship_requested: { icon: <Heart className="w-4 h-4" />, tone: 'bg-pink-50 text-pink-600 border-pink-100' },
  sponsorship_updated: { icon: <Truck className="w-4 h-4" />, tone: 'bg-sky-50 text-sky-600 border-sky-100' },
  children_registered: { icon: <Baby className="w-4 h-4" />, tone: 'bg-violet-50 text-violet-600 border-violet-100' },
  sponsor_registered: { icon: <UserPlus className="w-4 h-4" />, tone: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
};

function ActivityList({ items }: { items: ActivityItem[] }) {
  const [all, setAll] = useState(false);
  if (!items.length) return <p className="text-sm text-gray-500">Nada aconteceu nos últimos 60 dias.</p>;
  const visible = all ? items : items.slice(0, 8);
  return (
    <div>
      <ul className="divide-y divide-gray-50">
        {visible.map((a) => {
          const meta = ACTIVITY_ICON[a.kind];
          const st = a.status ? STATUS_STYLE[a.status] : null;
          const body = (
            <div className="flex items-start gap-3 py-2.5">
              <div className={`p-2 rounded-lg border shrink-0 ${meta.tone}`}>{meta.icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-900">{a.title}</p>
                {a.detail && <p className="text-xs text-gray-500 truncate">{a.detail}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-500 whitespace-nowrap">{relTime(a.at)}</p>
                {st && a.status && <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${st.soft}`}>{STATUS_PT[a.status]}</span>}
              </div>
            </div>
          );
          return (
            <li key={a.id}>
              {a.href ? <Link href={a.href} className="block -mx-2 px-2 rounded-lg hover:bg-gray-50">{body}</Link> : body}
            </li>
          );
        })}
      </ul>
      {items.length > 8 && (
        <button onClick={() => setAll((v) => !v)} className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
          {all ? 'Mostrar menos' : `Mostrar mais (${items.length - 8})`}
        </button>
      )}
    </div>
  );
}

function RankList({ rows, unit, empty }: { rows: { id: string; name: string; count: number }[]; unit: string; empty: string }) {
  if (!rows.length) return <p className="text-sm text-gray-500">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.id} className="text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-gray-800 truncate">{r.name}</span>
            <span className="text-gray-900 font-medium whitespace-nowrap">{r.count} {unit}{r.count === 1 ? '' : 's'}</span>
          </div>
          <div className="h-1.5 mt-1 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Modal({ title, subtitle, onClose, children, actions }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white w-full sm:max-w-5xl sm:rounded-2xl shadow-xl flex flex-col max-h-full sm:max-h-[90vh]">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          {actions}
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function downloadCsv(name: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const blob = new Blob(['﻿' + [header, ...rows].map((r) => r.map(esc).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function SponsorsModal({ rows, onClose }: { rows: SponsorRow[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'count' | 'name' | 'recent'>('count');
  const shown = useMemo(() => {
    const t = norm(q.trim());
    const list = rows.filter((r) => !t || norm(`${r.name} ${r.email ?? ''} ${r.phone ?? ''} ${r.communities.join(' ')}`).includes(t));
    return [...list].sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name, 'pt-BR') : sort === 'recent' ? b.lastAt.localeCompare(a.lastAt) : b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
  }, [rows, q, sort]);
  const total = rows.reduce((n, r) => n + r.count, 0);
  return (
    <Modal
      title="Padrinhos"
      subtitle={`${nf.format(rows.length)} padrinho(s) · ${nf.format(total)} apadrinhamento(s) sem cancelados`}
      onClose={onClose}
      actions={
        <button onClick={() => downloadCsv(`padrinhos-${new Date().toISOString().slice(0, 10)}.csv`,
          ['Padrinho', 'E-mail', 'Telefone', 'Crianças', 'Presentes', 'PIX', 'Valor PIX', 'Comunidades', 'Primeiro pedido', 'Último pedido'],
          shown.map((r) => [r.name, r.email ?? '', r.phone ?? '', r.count, r.gift, r.pix, r.pixAmount ? r.pixAmount.toFixed(2).replace('.', ',') : '', r.communities.join('; '), new Date(r.firstAt).toLocaleDateString('pt-BR'), new Date(r.lastAt).toLocaleDateString('pt-BR')]))}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
          <Download className="w-4 h-4" /> CSV
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, e-mail, telefone ou comunidade" className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm" />
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-sm">
          {([['count', 'Mais crianças'], ['name', 'Nome'], ['recent', 'Mais recentes']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setSort(v)} className={`px-3 py-1 rounded-md ${sort === v ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-600'}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="py-2 pr-3 font-medium w-8">#</th>
              <th className="py-2 pr-3 font-medium">Padrinho</th>
              <th className="py-2 px-3 font-medium text-right">Crianças</th>
              <th className="py-2 px-3 font-medium min-w-32">Etapas</th>
              <th className="py-2 px-3 font-medium text-right">Presente / PIX</th>
              <th className="py-2 pl-3 font-medium">Comunidades</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.id} className="border-b border-gray-50 align-top">
                <td className="py-2 pr-3 text-xs text-gray-400 tabular-nums">{i + 1}</td>
                <td className="py-2 pr-3">
                  <p className="font-medium text-gray-900">{r.name}</p>
                  <p className="text-xs text-gray-500">{[r.email, r.phone].filter(Boolean).join(' · ')}</p>
                </td>
                <td className="py-2 px-3 text-right font-semibold tabular-nums">{nf.format(r.count)}</td>
                <td className="py-2 px-3"><MiniStatus byStatus={r.byStatus} total={r.count} className="h-2" /></td>
                <td className="py-2 px-3 text-right text-xs tabular-nums whitespace-nowrap">{r.gift} / {r.pix}{r.pixAmount ? <span className="block text-gray-500">{money.format(r.pixAmount)}</span> : null}</td>
                <td className="py-2 pl-3 text-xs text-gray-600">{r.communities.join(' · ')}</td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={6} className="py-8 text-center text-gray-500">Ninguém encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function PointsModal({ rows, onClose }: { rows: PointRow[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const shown = rows.filter((r) => !q.trim() || norm(`${r.name} ${r.cityName ?? ''} ${r.communities.join(' ')}`).includes(norm(q.trim())));
  const total = rows.reduce((n, r) => n + r.count, 0);
  return (
    <Modal
      title="Presentes por ponto de coleta"
      subtitle={`${nf.format(rows.filter((r) => r.kind === 'point').length)} ponto(s) · ${nf.format(total)} apadrinhamento(s) sem cancelados`}
      onClose={onClose}
      actions={
        <button onClick={() => downloadCsv(`pontos-de-coleta-${new Date().toISOString().slice(0, 10)}.csv`,
          ['Ponto de coleta', 'Cidade', 'Presentes', 'Recebidos', ...FLOW_STEPS.map((s) => STATUS_PT[s] + viaLabel(s)), 'Encerrados', 'Padrinhos', 'Comunidades'],
          shown.map((r) => [r.name, r.cityName ?? '', r.count, pointReceived(r), ...FLOW_STEPS.map((s) => r.byStatus[s] ?? 0), r.byStatus.ENDED ?? 0, r.sponsors, r.communities.join('; ')]))}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
          <Download className="w-4 h-4" /> CSV
        </button>
      }
    >
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ponto, cidade ou comunidade" className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm" />
      </div>
      <div className="space-y-3">
        {shown.map((p) => (
          <div key={`${p.kind}|${p.id}`} className={`rounded-xl border p-3 ${p.kind === 'point' ? 'border-gray-200' : 'border-dashed border-gray-300 bg-gray-50/60'}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="font-semibold text-gray-900">{p.name}</p>
              {p.cityName && <p className="text-xs text-gray-500">{p.cityName}</p>}
              <p className="ml-auto text-sm"><b>{nf.format(p.count)}</b> presente(s) · {nf.format(p.sponsors)} padrinho(s) · <span className="text-emerald-700">{pctOf(pointReceived(p), p.count)}% recebidos</span></p>
            </div>
            <MiniStatus byStatus={p.byStatus} total={p.count} className="h-2.5 mt-2" />
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
              {[...FLOW_STEPS, 'ENDED' as SponsorshipStatus].filter((s) => (p.byStatus[s] ?? 0) > 0).map((s) => (
                <span key={s} className={`inline-flex items-center gap-1 text-[11px] font-semibold ${STATUS_STYLE[s].text}`}>
                  <span className={`w-2 h-2 rounded-full ${STATUS_STYLE[s].bar}`} />{p.byStatus[s]} {STATUS_PT[s].toLowerCase()}{viaLabel(s)}
                </span>
              ))}
            </div>
            {p.communities.length > 0 && <p className="text-xs text-gray-600 mt-2">{p.communities.join(' · ')}</p>}
          </div>
        ))}
        {!shown.length && <p className="py-8 text-center text-gray-500">Nada encontrado.</p>}
      </div>
    </Modal>
  );
}

function QuickActions() {
  const actions = [
    { href: '/admin/sponsorships', label: 'Apadrinhamentos', icon: <Heart className="w-5 h-5 text-pink-600" /> },
    { href: '/admin/children/bulk', label: 'Cadastro guiado', icon: <ClipboardList className="w-5 h-5 text-violet-600" /> },
    { href: '/admin/campaigns/migrate-children', label: 'Migrar crianças', icon: <ArrowRightLeft className="w-5 h-5 text-blue-600" /> },
    { href: '/admin/exports', label: 'Exportações', icon: <FileDown className="w-5 h-5 text-emerald-600" /> },
    { href: '/admin/children/source-check', label: 'Conferir com a origem', icon: <ScanSearch className="w-5 h-5 text-amber-600" /> },
    { href: '/admin/audit', label: 'Histórico de alterações', icon: <History className="w-5 h-5 text-gray-700" /> },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {actions.map((a) => (
        <Link key={a.href} href={a.href} className="flex items-center gap-3 p-4 bg-white/70 hover:bg-white rounded-xl border border-gray-100 hover:shadow-md transition">
          <div className="p-2 bg-gray-50 rounded-lg">{a.icon}</div>
          <span className="font-medium text-gray-800">{a.label}</span>
        </Link>
      ))}
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-48 rounded-2xl bg-white/70" />
        <div className="h-48 rounded-2xl bg-white/70" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-64 rounded-2xl bg-white/70" />
        <div className="h-64 rounded-2xl bg-white/70" />
      </div>
      <div className="h-72 rounded-2xl bg-white/70" />
    </div>
  );
}
