'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/api';
import CampaignFilter, { useAdminCampaign } from '@/components/Admin/CampaignFilter';
import { STATUS_PT, LOGISTICS_FLOW, type SponsorshipStatus } from '@/lib/sponsorship-status';
import {
  Heart, Baby, Calendar, Clock, AlertTriangle, ImageOff, Gift, Users, RefreshCw,
  Activity, UserPlus, Truck, ArrowUpRight, ArrowDownRight, Minus, ClipboardList,
  ArrowRightLeft, FileDown, MapPin, Wallet,
} from 'lucide-react';

/* ===================== Tipos (GET /dashboard) ===================== */

type ChildState = 'completed' | 'inProgress' | 'pending' | 'available';
type Group = { id: string; name: string; cityName?: string | null; total: number; withoutPhoto: number } & Record<ChildState, number>;
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
  children: Record<ChildState, number> & {
    total: number; sponsored: number; withoutPhoto: number; withoutGift: number; sponsoredRate: number; reservedRate: number;
  };
  sponsorships: {
    total: number;
    byStatus: Record<SponsorshipStatus, number>;
    methods: { GIFT: { count: number }; PIX: { count: number; amount: number; paidCount: number; paidAmount: number } };
    sponsors: number;
    topSponsors: { id: string; name: string; count: number }[];
    collectionPoints: { id: string; name: string; count: number }[];
  };
  pending: { count: number; oldestAt: string | null; over3Days: number };
  timeline: { days: { date: string; requested: number }[]; last7: number; prev7: number };
  byCity: Group[];
  byCommunity: Group[];
  activity: ActivityItem[];
};

/* ===================== Cores da situação (validadas: CVD ok, rótulos sempre visíveis) ===================== */

const STATE_META: { key: ChildState; label: string; bar: string; dot: string }[] = [
  { key: 'completed', label: 'Concluídas', bar: 'bg-emerald-600', dot: 'bg-emerald-600' },
  { key: 'inProgress', label: 'Em andamento', bar: 'bg-blue-500', dot: 'bg-blue-500' },
  { key: 'pending', label: 'Pendentes', bar: 'bg-amber-500', dot: 'bg-amber-500' },
  { key: 'available', label: 'Disponíveis', bar: 'bg-gray-200', dot: 'bg-gray-300' },
];

const CAMPAIGN_STATUS_PT: Record<string, string> = { DRAFT: 'Rascunho', ACTIVE: 'Ativa', FINISHED: 'Finalizada', ARCHIVED: 'Arquivada' };

const nf = new Intl.NumberFormat('pt-BR');
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');

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
  const [groupBy, setGroupBy] = useState<'city' | 'community'>('city');

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

          <Card
            title="Situação por local"
            subtitle="Quantas crianças de cada lugar já têm padrinho"
            icon={<MapPin className="w-5 h-5 text-indigo-600" />}
            action={
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-sm">
                {(['city', 'community'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGroupBy(g)}
                    className={`px-3 py-1 rounded-md ${groupBy === g ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-600'}`}
                  >
                    {g === 'city' ? 'Cidades' : 'Comunidades'}
                  </button>
                ))}
              </div>
            }
          >
            <PlaceTable rows={groupBy === 'city' ? data.byCity : data.byCommunity} showCity={groupBy === 'community'} />
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2" title="Atividade recente" subtitle="Pedidos, mudanças de etapa, cadastros e novos padrinhos" icon={<Activity className="w-5 h-5 text-gray-600" />}>
              <ActivityList items={data.activity} />
            </Card>
            <div className="space-y-6">
              <Card title="Padrinhos que mais apadrinharam" icon={<Users className="w-5 h-5 text-emerald-600" />}>
                <RankList rows={data.sponsorships.topSponsors} unit="criança" empty="Nenhum apadrinhamento ainda." />
              </Card>
              <Card title="Presentes por ponto de coleta" icon={<Gift className="w-5 h-5 text-amber-600" />}>
                <RankList rows={data.sponsorships.collectionPoints} unit="presente" empty="Nenhum presente com ponto de coleta." />
              </Card>
            </div>
          </div>

          <QuickActions />
        </div>
      )}
    </div>
  );
}

/* ===================== Blocos ===================== */

function Card({ title, subtitle, icon, action, className = '', children }: {
  title: string; subtitle?: string; icon?: ReactNode; action?: ReactNode; className?: string; children: ReactNode;
}) {
  return (
    <section className={`bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm ${className}`}>
      <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
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
  if (!items.length) return null;

  const tone = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    slate: 'border-gray-200 bg-white text-gray-900',
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* situação das crianças: barra única empilhada */}
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
        <StackedBar counts={c} total={c.total} className="h-4 mt-5" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {STATE_META.map((s) => (
            <div key={s.key}>
              <p className="text-xs text-gray-600 flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${s.dot}`} />{s.label}</p>
              <p className="text-lg font-semibold text-gray-900">
                {nf.format(c[s.key])}
                <span className="ml-1 text-xs font-normal text-gray-500">{c.total ? Math.round((c[s.key] / c.total) * 100) : 0}%</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-1 gap-6">
        <Tile
          icon={<Users className="w-4 h-4 text-blue-600" />}
          label="Padrinhos"
          value={nf.format(d.sponsorships.sponsors)}
          hint={d.sponsorships.sponsors ? `${(d.sponsorships.total / d.sponsorships.sponsors).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} criança(s) por padrinho` : 'Nenhum ainda'}
        />
        <Tile
          icon={<Wallet className="w-4 h-4 text-emerald-600" />}
          label="Doações PIX"
          value={money.format(pix.amount)}
          hint={pix.count
            ? `${pix.count} pedido(s) · ${money.format(pix.paidAmount)} confirmado(s)`
            : `${nf.format(d.sponsorships.methods.GIFT.count)} presente(s), nenhum PIX`}
        />
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

function StackedBar({ counts, total, className = '' }: { counts: Record<ChildState, number>; total: number; className?: string }) {
  if (!total) return <div className={`rounded-full bg-gray-100 ${className}`} />;
  return (
    <div className={`flex gap-0.5 rounded-full overflow-hidden bg-gray-100 ${className}`}>
      {STATE_META.map((s) =>
        counts[s.key] > 0 ? (
          <div
            key={s.key}
            className={s.bar}
            style={{ width: `${(counts[s.key] / total) * 100}%` }}
            title={`${s.label}: ${nf.format(counts[s.key])} (${Math.round((counts[s.key] / total) * 100)}%)`}
          />
        ) : null,
      )}
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
        {/* tooltip */}
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

function Pipeline({ byStatus }: { byStatus: Record<SponsorshipStatus, number> }) {
  const steps = LOGISTICS_FLOW.filter((s) => s !== 'CANCELLED');
  const max = Math.max(1, ...steps.map((s) => byStatus[s] ?? 0));
  return (
    <div className="space-y-2.5">
      {steps.map((s) => {
        const n = byStatus[s] ?? 0;
        return (
          <div key={s} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-2 text-sm">
            <span className="text-gray-600 truncate">{STATUS_PT[s]}</span>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${s === 'PENDING' ? 'bg-amber-500' : s === 'COMPLETED' ? 'bg-emerald-600' : s === 'ENDED' ? 'bg-gray-400' : 'bg-blue-500'}`} style={{ width: `${(n / max) * 100}%` }} />
            </div>
            <span className="text-right font-medium text-gray-900">{nf.format(n)}</span>
          </div>
        );
      })}
      {byStatus.CANCELLED > 0 && <p className="text-xs text-gray-500 pt-1">{nf.format(byStatus.CANCELLED)} cancelado(s), fora da contagem</p>}
      <Link href="/admin/sponsorships" className="inline-block text-sm text-blue-600 hover:text-blue-700 font-medium pt-2">Ver apadrinhamentos →</Link>
    </div>
  );
}

function PlaceTable({ rows, showCity }: { rows: Group[]; showCity: boolean }) {
  const [all, setAll] = useState(false);
  const visible = all ? rows : rows.slice(0, 8);
  if (!rows.length) return <p className="text-sm text-gray-500">Nenhuma criança nesta seleção.</p>;

  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-gray-600">
        {STATE_META.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${s.dot}`} />{s.label}</span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="py-2 pr-3 font-medium">Local</th>
              <th className="py-2 px-3 font-medium text-right">Crianças</th>
              <th className="py-2 px-3 font-medium w-1/3 min-w-40">Situação</th>
              <th className="py-2 px-3 font-medium text-right">Com padrinho</th>
              <th className="py-2 px-3 font-medium text-right">Disponíveis</th>
              <th className="py-2 pl-3 font-medium text-right">Sem foto</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const done = r.completed + r.inProgress;
              return (
                <tr key={`${r.id}-${r.name}-${r.cityName ?? ''}`} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 pr-3">
                    <p className="font-medium text-gray-900">{r.name}</p>
                    {showCity && r.cityName && <p className="text-xs text-gray-500">{r.cityName}</p>}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">{nf.format(r.total)}</td>
                  <td className="py-2 px-3"><StackedBar counts={r} total={r.total} className="h-2.5" /></td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {nf.format(done)} <span className="text-xs text-gray-500">({r.total ? Math.round((done / r.total) * 100) : 0}%)</span>
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">{nf.format(r.available)}</td>
                  <td className={`py-2 pl-3 text-right tabular-nums ${r.withoutPhoto ? 'text-amber-700 font-medium' : 'text-gray-400'}`}>{nf.format(r.withoutPhoto)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > 8 && (
        <button onClick={() => setAll((v) => !v)} className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
          {all ? 'Mostrar menos' : `Mostrar todos (${rows.length})`}
        </button>
      )}
    </div>
  );
}

const ACTIVITY_ICON: Record<ActivityItem['kind'], { icon: ReactNode; tone: string }> = {
  sponsorship_requested: { icon: <Heart className="w-4 h-4" />, tone: 'bg-pink-50 text-pink-600 border-pink-100' },
  sponsorship_updated: { icon: <Truck className="w-4 h-4" />, tone: 'bg-blue-50 text-blue-600 border-blue-100' },
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
          const body = (
            <div className="flex items-start gap-3 py-2.5">
              <div className={`p-2 rounded-lg border shrink-0 ${meta.tone}`}>{meta.icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-900">{a.title}</p>
                {a.detail && <p className="text-xs text-gray-500 truncate">{a.detail}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-500 whitespace-nowrap">{relTime(a.at)}</p>
                {a.status === 'PENDING' && <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">Pendente</span>}
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

function QuickActions() {
  const actions = [
    { href: '/admin/sponsorships', label: 'Apadrinhamentos', icon: <Heart className="w-5 h-5 text-pink-600" /> },
    { href: '/admin/children/bulk', label: 'Cadastro guiado', icon: <ClipboardList className="w-5 h-5 text-violet-600" /> },
    { href: '/admin/campaigns/migrate-children', label: 'Migrar crianças', icon: <ArrowRightLeft className="w-5 h-5 text-blue-600" /> },
    { href: '/admin/exports', label: 'Exportações', icon: <FileDown className="w-5 h-5 text-emerald-600" /> },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
