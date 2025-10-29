'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Heart,
  Users,
  Clock,
  UserCheck,
  Calendar,
  Trash2,
  ExternalLink,
  User,
  Eye,
  X,
  Mail,
  Phone,
  MapPin,
  CheckSquare,
  Square,
  ArrowRightLeft,
  FileText,
} from 'lucide-react';

// >>> PDF exporter
import { exportSponsorshipsPdf } from '@/lib/pdf/exportSponsorshipsPdf';

// >>> Status unificado
import {
  STATUS_PT,
  type SponsorshipStatus,
} from '@/lib/sponsorship-status';
import StatusBadge from '@/components/Sponsorship/StatusBadge';

/* ===================== */
/* Tipos                 */
/* ===================== */
type SponsorshipMethod = 'PIX' | 'GIFT';

type ChildLite = {
  id: string;
  publicId?: number | null;
  name: string;
  community?: { name?: string } | null;
  city?: { name?: string } | null;
  cityName?: string | null;
  [key: string]: any;
};

type SponsorLite = { id: string; name: string; email?: string | null };

type CampaignLite = { id: string; name: string; slug: string; year?: number | null };

type CollectionPointLite = {
  id: string;
  name: string;
  cityName?: string | null;
  state?: string | null;
  address?: string | null;
  district?: string | null;
  phone?: string | null;
};

type Sponsorship = {
  id: string;
  status: SponsorshipStatus;
  method?: SponsorshipMethod | null; // PIX/GIFT
  startDate?: string | null;
  endDate?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;

  child?: ChildLite | null;
  sponsor?: SponsorLite | null;
  campaign?: CampaignLite | null;

  collectionPointId?: string | null;
  collectionPoint?: CollectionPointLite | null;
};

type TabKey = Extract<SponsorshipStatus, 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'>;

/* ===================== */
/* Utils                 */
/* ===================== */
function fmtDateBR(s?: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}
function labelOrDash(v?: string | number | null) {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}
function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${className}`}>
      {children}
    </span>
  );
}
function ImageThumb({ url, label }: { url: string; label: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="group block">
      <div className="aspect-square overflow-hidden rounded-lg border border-gray-200 bg-white">
        <img src={url} alt={label} className="w-full h-full object-cover group-hover:opacity-90" />
      </div>
      <div className="mt-1 text-[11px] text-gray-600 text-center">{label}</div>
    </a>
  );
}
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {}
      }}
      className="text-xs px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
      title="Copiar"
    >
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  );
}

/* ===================== */
/* Componentes menores   */
/* ===================== */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mt-4 mb-2 text-sm font-semibold text-gray-900">{children}</h4>;
}
function KV({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-28 text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-900 break-words">{value ?? '—'}</div>
    </div>
  );
}
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="p-2 bg-gray-100 rounded-lg">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm font-medium text-gray-900 truncate">{value ?? '—'}</div>
      </div>
    </div>
  );
}
function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-[61] w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition" aria-label="Fechar">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ===================== */
/* Helpers p/ export PDF */
/* ===================== */
type PdfItem = Parameters<typeof exportSponsorshipsPdf>[0][number];
function pickComposeFromImages(images: any[] | undefined) {
  if (!Array.isArray(images) || images.length === 0) return null;
  const sorted = [...images].sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
  );
  const best = sorted.find(it => it.processedUrl) || sorted[0];
  return {
    processedUrl: best?.processedUrl || null,
    layoutUrl: best?.layoutUrl || best?.framedUrl || null,
    framedUrl: best?.framedUrl || null,
    config: best?.Config || null,
  };
}
async function enrichItemsForSponsor(items: Sponsorship[]): Promise<PdfItem[]> {
  const byChildId: Record<string, any> = {};
  const uniqueChildIds = Array.from(new Set(items.map(it => it.child?.id).filter(Boolean))) as string[];
  const results = await Promise.allSettled(
    uniqueChildIds.map(id => fetch(`/api/admin/children/${id}`, { credentials: 'include', cache: 'no-store' }))
  );
  for (let i = 0; i < results.length; i++) {
    const id = uniqueChildIds[i];
    const r = results[i];
    if (r.status === 'fulfilled' && r.value.ok) {
      byChildId[id] = await r.value.json();
    }
  }
  const out: PdfItem[] = [];
  for (const it of items) {
    const c0 = it.child;
    if (!c0) continue;
    const full = byChildId[c0.id] ?? {};
    const picked = pickComposeFromImages(full.images);
    out.push({
      sponsorshipId: it.id,
      status: it.status,
      campaign: {
        id: it.campaign?.id ?? '',
        name: it.campaign?.name ?? '',
        year: it.campaign?.year ?? undefined,
      },
      child: {
        id: c0.id,
        name: full.name ?? c0.name ?? '—',
        publicId: full.publicId ?? c0.publicId ?? null,
        age: full.age ?? undefined,
        city: full.city?.name ?? full.cityName ?? c0.city?.name ?? c0.cityName ?? null,
        community: full.community?.name ?? undefined,
        school: full.school?.name ?? full.schoolLegacy ?? undefined,
        wantedGift: full.wantedGift ?? undefined,
        processedUrl: picked?.processedUrl ?? full.photoUrl ?? null,
        layoutUrl: picked?.layoutUrl ?? null,
        framedUrl: picked?.framedUrl ?? null,
        photoUrl: full.photoUrl ?? null,
        config: picked?.config ?? null,
      },
    });
  }
  return out;
}

/* ===================== */
/* Página principal      */
/* ===================== */
export default function AdminSponsorshipsPage() {
  // filtros
  const [q, setQ] = useState('');
  const [campaignId, setCampaignId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabKey>('PENDING');

  // NOVO: filtros extras por mais status
  const EXTRA_STATUS: SponsorshipStatus[] = [
    'IN_PURCHASE',
    'PACKED',
    'BOXED',
    'AWAITING_DELIVERY',
    'ENDED',
    'CANCELLED',
  ];
  const [statusFilters, setStatusFilters] = useState<SponsorshipStatus[]>([]); // se não-vazio, sobrepõe aba

  const METHOD_OPTIONS = ['PIX', 'GIFT'] as const;
  type MethodOption = (typeof METHOD_OPTIONS)[number];

  const [methodFilters, setMethodFilters] = useState<MethodOption[]>([]);

  function toggleMethodFilter(m: MethodOption) {
    setMethodFilters(prev => (prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]));
  }
  const isFilteringMethods = methodFilters.length > 0;

  // dados
  const [campaigns, setCampaigns] = useState<CampaignLite[]>([]);
  const [allRows, setAllRows] = useState<Sponsorship[]>([]);
  const [loading, setLoading] = useState(false);

  // pontos de coleta
  const [cps, setCps] = useState<CollectionPointLite[]>([]);
  const cpMap = useMemo(() => {
    const m = new Map<string, CollectionPointLite>();
    cps.forEach(c => m.set(c.id, c));
    return m;
  }, [cps]);

  // modais / detalhes
  const [childModalId, setChildModalId] = useState<string | null>(null);
  const [sponsorModalId, setSponsorModalId] = useState<string | null>(null);
  const [childDetail, setChildDetail] = useState<any | null>(null);
  const [sponsorDetail, setSponsorDetail] = useState<any | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);

  // modal do model "raw" da criança
  const [childModelOpen, setChildModelOpen] = useState(false);
  const [childModelPayload, setChildModelPayload] = useState<any | null>(null);

  // UI
  const [viewMode, setViewMode] = useState<'table' | 'agrupado'>('agrupado');

  // estado para ação em massa por padrinho
  const [bulkChoice, setBulkChoice] = useState<Record<string, SponsorshipStatus>>({});
  const [bulkLoading, setBulkLoading] = useState<Record<string, boolean>>({});

  // ===== Export PDF (admin por padrinho)
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSponsor, setExportSponsor] = useState<{ id: string; name: string } | null>(null);
  const [exportItems, setExportItems] = useState<Sponsorship[]>([]);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportProgress, setExportProgress] =
    useState<{ current: number; total: number; phase: 'compose' | 'pdf' } | null>(null);
  const [exportPerPage, setExportPerPage] = useState<number>(1);
  const [exportTextScale, setExportTextScale] = useState<number>(1);

  // ===== Transferência
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferIds, setTransferIds] = useState<string[]>([]);
  const [destQuery, setDestQuery] = useState('');
  const [destResults, setDestResults] = useState<SponsorLite[]>([]);
  const [destSponsor, setDestSponsor] = useState<SponsorLite | null>(null);

  // Carrega campanhas
  useEffect(() => {
    (async () => {
      try {
        const url = new URL('/api/admin/campaigns', window.location.origin);
        url.searchParams.set('pageSize', '10000');
        const r = await fetch(url.toString(), { cache: 'no-store', credentials: 'include' });
        if (!r.ok) return;
        const raw = await r.json();
        const items: CampaignLite[] = Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw)
          ? raw
          : [];
        setCampaigns(items);
      } catch {}
    })();
  }, []);

  // Carrega pontos de coleta
  useEffect(() => {
    (async () => {
      try {
        const url = new URL('/api/admin/collection-points', window.location.origin);
        url.searchParams.set('pageSize', '100000');
        const r = await fetch(url.toString(), { cache: 'no-store', credentials: 'include' });
        if (!r.ok) return;
        const json = await r.json();
        const items: CollectionPointLite[] = Array.isArray(json?.items)
          ? json.items
          : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json)
          ? json
          : [];
        setCps(items);
      } catch {}
    })();
  }, []);

  // Busca SEM status; filtro por status é no cliente
  async function load() {
    setLoading(true);
    try {
      const url = new URL('/api/admin/sponsorships', window.location.origin);
      url.searchParams.set('pageSize', '100000');
      if (campaignId) url.searchParams.set('campaignId', campaignId);
      if (q.trim()) url.searchParams.set('q', q.trim());
      const res = await fetch(url.toString(), { cache: 'no-store', credentials: 'include' });
      const ok = res.ok;
      const json = ok ? await res.json() : { items: [] as Sponsorship[] };
      const items: Sponsorship[] = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json)
        ? json
        : [];
      setAllRows(items);
      // limpa seleção quando recarrega
      setSelectedIds({});
    } catch {
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, campaignId]);

  // ===== Export PDF helper (abre o modal padrão com as opções)
  function openExportModal(items: Sponsorship[], label: string, sponsorId?: string) {
    if (!items?.length) {
      alert('Nenhum item para exportar.');
      return;
    }
    setExportItems(items);
    setExportSponsor({ id: sponsorId ?? '', name: label });
    setExportOpen(true);
    // reset de progresso a cada abertura
    setExportProgress(null);
  }

  /* ===== Contagens por status ===== */
  const countsAll = useMemo(() => {
    const base: Record<SponsorshipStatus, number> = {
      PENDING: 0,
      IN_PROGRESS: 0,
      IN_PURCHASE: 0,
      PACKED: 0,
      BOXED: 0,
      AWAITING_DELIVERY: 0,
      COMPLETED: 0,
      ENDED: 0,
      CANCELLED: 0,
    };
    for (const r of allRows) base[r.status] = (base[r.status] ?? 0) + 1;
    return base;
  }, [allRows]);

  const countsByMethod = useMemo(() => {
    const base: Record<MethodOption, number> = { PIX: 0, GIFT: 0 };
    for (const r of allRows) {
      const k = (r.method ?? '') as MethodOption;
      if (k === 'PIX' || k === 'GIFT') base[k] += 1;
    }
    return base;
  }, [allRows]);

  /* ===== Filtros no cliente ===== */

  // [MODIFICAR] o bloco que calcula "filteredBySelection" e "visibleRows"

  // (1) mantém como está a parte de status (aba x filtros extras)
  const filteredBySelection = useMemo(() => {
    if (statusFilters.length > 0) {
      return allRows.filter(r => statusFilters.includes(r.status));
    }
    return allRows.filter(r => r.status === activeTab);
  }, [allRows, activeTab, statusFilters]);

  // (2) [ADICIONAR] aplicar filtro por método sobre o resultado acima
  const filteredByMethod = useMemo(() => {
    if (!isFilteringMethods) return filteredBySelection;
    return filteredBySelection.filter(r => {
      // se método estiver vazio, ele não passa por nenhum filtro explícito
      if (!r.method) return false;
      return methodFilters.includes(r.method as MethodOption);
    });
  }, [filteredBySelection, isFilteringMethods, methodFilters]);

  // (3) [MODIFICAR] visibleRows para usar "filteredByMethod" como base
  const visibleRows = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    const base = filteredByMethod;
    if (!qLower) return base;
    return base.filter((r) => {
      const childName = r.child?.name?.toLowerCase() ?? '';
      const sponsorName = r.sponsor?.name?.toLowerCase() ?? '';
      const sponsorEmail = r.sponsor?.email?.toLowerCase() ?? '';
      const cpName =
        (r.collectionPoint?.name ||
          (r.collectionPointId ? cpMap.get(r.collectionPointId || '')?.name : ''))?.toLowerCase() ?? '';
      return (
        childName.includes(qLower) ||
        sponsorName.includes(qLower) ||
        sponsorEmail.includes(qLower) ||
        cpName.includes(qLower)
      );
    });
  }, [filteredByMethod, q, cpMap]);


  const noRows = !loading && visibleRows.length === 0;

  /* ===== Método ===== */
  function MethodBadge({ method }: { method?: SponsorshipMethod | null }) {
    if (!method) return <Badge className="bg-gray-50 text-gray-600 border-gray-200">—</Badge>;
    if (method === 'PIX') return <Badge className="bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200">PIX</Badge>;
    return <Badge className="bg-sky-50 text-sky-700 border-sky-200">Presente no ponto (GIFT)</Badge>;
  }

  /* ===== Helpers de Ponto de Coleta ===== */
  function resolveCP(s: Sponsorship): CollectionPointLite | null {
    return s.collectionPoint ?? (s.collectionPointId ? cpMap.get(s.collectionPointId) ?? null : null);
  }
  function cpLabel(s: Sponsorship) {
    const cp = resolveCP(s);
    if (!cp) return '—';
    const loc = cp.cityName ? `${cp.cityName}${cp.state ? `/${cp.state}` : ''}` : '';
    return loc ? `${cp.name} • ${loc}` : cp.name;
  }

  /* ===== Ações ===== */
  async function changeStatus(id: string, newStatus: SponsorshipStatus) {
    const r = await fetch(`/api/admin/sponsorships/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!r.ok) { alert('Falha ao alterar status.'); return; }
    await load();
  }
  async function del(id: string) {
    if (!confirm('Excluir apadrinhamento? Esta ação não pode ser desfeita.')) return;
    const r = await fetch(`/api/admin/sponsorships/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!r.ok) return alert('Falha ao excluir.');
    await load();
  }
  function openChildModelFromRow(childObj: any) {
    setChildModelPayload(childObj ?? null);
    setChildModelOpen(true);
  }
  async function openChild(id: string) {
    setChildModalId(id);
    setChildDetail(null);
    setModalLoading(true);
    try {
      const r = await fetch(`/api/admin/children/${id}`, { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error('Erro ao carregar criança');
      const json = await r.json();
      setChildDetail(json);
    } catch {
      setChildDetail({ __error: 'Não foi possível carregar os dados da criança.' });
    } finally {
      setModalLoading(false);
    }
  }
  async function openSponsor(id: string) {
    setSponsorModalId(id);
    setSponsorDetail(null);
    setModalLoading(true);
    try {
      const r = await fetch(`/api/admin/users/${id}`, { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error('Erro ao carregar padrinho');
      const json = await r.json();
      setSponsorDetail(json);
    } catch {
      setSponsorDetail({ __error: 'Não foi possível carregar os dados do padrinho.' });
    } finally {
      setModalLoading(false);
    }
  }

  /* ===== Helpers de localização para agrupamento ===== */
  function deriveCityName(s: Sponsorship): string {
    const cAny = s.child as any;
    return cAny?.city?.name || cAny?.cityName || 'Sem cidade';
  }
  function deriveCommunityName(s: Sponsorship): string {
    const cAny = s.child as any;
    return cAny?.community?.name || 'Sem comunidade';
  }

  /* ===== Agrupamento (Padrinho → Cidade → Comunidade) ===== */
  type GroupSponsor = {
    sponsorId: string;
    sponsor: SponsorLite | null;
    total: number;
    items: Sponsorship[];
    byCity: Array<{
      city: string;
      total: number;
      byCommunity: Array<{
        community: string;
        total: number;
        items: Sponsorship[];
      }>;
    }>;
  };

  const groupedBySponsor: GroupSponsor[] = useMemo(() => {
    const sponsorMap = new Map<string, { sponsor: SponsorLite | null; items: Sponsorship[] }>();
    for (const s of visibleRows) {
      const sid = s.sponsor?.id ?? '__sem_padrinho__';
      const cur = sponsorMap.get(sid) ?? { sponsor: s.sponsor ?? null, items: [] };
      cur.items.push(s);
      sponsorMap.set(sid, cur);
    }
    const out: GroupSponsor[] = [];
    for (const [sid, { sponsor, items }] of sponsorMap.entries()) {
      const cityMap = new Map<string, Map<string, Sponsorship[]>>();
      for (const it of items) {
        const city = deriveCityName(it);
        const community = deriveCommunityName(it);
        const commMap = cityMap.get(city) ?? new Map<string, Sponsorship[]>();
        const arr = commMap.get(community) ?? [];
        arr.push(it);
        commMap.set(community, arr);
        cityMap.set(city, commMap);
      }
      const byCity = Array.from(cityMap.entries())
        .map(([city, commMap]) => {
          const byCommunity = Array.from(commMap.entries())
            .map(([community, arr]) => ({
              community,
              total: arr.length,
              items: arr.sort((a, b) => (a.child?.name || '').localeCompare(b.child?.name || '', 'pt-BR')),
            }))
            .sort((a, b) => a.community.localeCompare(b.community, 'pt-BR'));
          return {
            city,
            total: byCommunity.reduce((acc, c) => acc + c.total, 0),
            byCommunity,
          };
        })
        .sort((a, b) => a.city.localeCompare(b.city, 'pt-BR'));
      out.push({ sponsorId: sid, sponsor, total: items.length, items, byCity });
    }
    return out.sort((a, b) => {
      const an = a.sponsor?.name || 'zzz~Sem padrinho';
      const bn = b.sponsor?.name || 'zzz~Sem padrinho';
      return an.localeCompare(bn, 'pt-BR');
    });
  }, [visibleRows]);

  /* ====== Seleção & Transfer ====== */
  function isSelected(id: string) { return !!selectedIds[id]; }
  function toggleOne(id: string) {
    setSelectedIds(prev => ({ ...prev, [id]: !prev[id] }));
  }
  function selectMany(ids: string[], on: boolean) {
    setSelectedIds(prev => {
      const next = { ...prev };
      ids.forEach(id => next[id] = on);
      return next;
    });
  }
  function beginTransfer(ids: string[]) {
    const uniq = Array.from(new Set(ids));
    setTransferIds(uniq);
    setDestSponsor(null);
    setDestQuery('');
    setDestResults([]);
    setTransferOpen(true);
  }
  async function searchSponsors(q: string) {
    try {
      const url = new URL('/api/admin/users', window.location.origin);
      url.searchParams.set('q', q);
      url.searchParams.set('roles', 'SPONSOR');
      url.searchParams.set('pageSize', '20');
      const r = await fetch(url.toString(), { credentials: 'include', cache: 'no-store' });
      if (!r.ok) return setDestResults([]);
      const js = await r.json();
      const items: SponsorLite[] = Array.isArray(js?.items) ? js.items : (Array.isArray(js) ? js : []);
      setDestResults(items);
    } catch {
      setDestResults([]);
    }
  }
  useEffect(() => {
    const t = setTimeout(() => {
      if (destQuery.trim().length >= 2) searchSponsors(destQuery.trim());
      else setDestResults([]);
    }, 300);
    return () => clearTimeout(t);
  }, [destQuery]);

  async function applyTransfer() {
    if (!transferIds.length || !destSponsor?.id) return;
    setTransferBusy(true);
    try {
      const res = await fetch('/api/admin/sponsorships/transfer', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sponsorshipIds: transferIds, toSponsorId: destSponsor.id }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        alert(`Falha ao transferir.\n${txt || ''}`);
        return;
      }
      setTransferOpen(false);
      setTransferIds([]);
      setSelectedIds({});
      await load();
    } finally {
      setTransferBusy(false);
    }
  }

  const selectedCount = useMemo(() => Object.values(selectedIds).filter(Boolean).length, [selectedIds]);

  /* ===== UI ===== */
  function Tab({ id, label, count, active, onClick }: { id: TabKey; label: string; count?: number; active: boolean; onClick: () => void }) {
    return (
      <button
        onClick={onClick}
        className={`px-4 py-2 rounded-xl border text-sm font-medium transition
          ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}
        `}
      >
        {label} {Number.isFinite(count) ? `(${count})` : ''}
      </button>
    );
  }

  // helpers botão de filtro extra
  function toggleStatusFilter(s: SponsorshipStatus) {
    setStatusFilters(prev => {
      const has = prev.includes(s);
      if (has) return prev.filter(x => x !== s);
      return [...prev, s];
    });
  }
  const isFilteringExtras = statusFilters.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Apadrinhamentos dos Amigos de Minas
              </h1>
              <p className="text-gray-600 text-lg">
                Acompanhe e gerencie os vínculos entre padrinhos e crianças
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {selectedCount > 0 && (
                <button
                  onClick={() => beginTransfer(Object.keys(selectedIds).filter(id => selectedIds[id]))}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-sm"
                  title="Transferir itens selecionados"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Transferir selecionados ({selectedCount})
                </button>
              )}
              <div className="text-sm text-gray-500 px-4 py-2 bg-white/50 rounded-xl border border-white/20">
                Funcionalidades extras em breve
              </div>
            </div>
          </div>
        </div>

        {/* Stats (da aba/filtro atual) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total (filtro atual)</p>
                <p className="text-3xl font-bold text-gray-900">{visibleRows.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Heart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Concluídos (filtro)</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {visibleRows.filter(r => r.status === 'COMPLETED').length}
                </p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <UserCheck className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Pendentes (filtro)</p>
                <p className="text-3xl font-bold text-amber-600">
                  {visibleRows.filter(r => r.status === 'PENDING').length}
                </p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Em processo/andamento (filtro)</p>
                <p className="text-3xl font-bold text-cyan-600">
                  {visibleRows.filter(r => r.status === 'IN_PROGRESS').length}
                </p>
              </div>
              <div className="p-3 bg-cyan-100 rounded-xl">
                <Users className="w-6 h-6 text-cyan-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Abas principais */}
        <div className="mb-3">
          <div className="flex flex-wrap gap-2">
            <Tab id="PENDING" label="Pendentes" count={countsAll.PENDING} active={!isFilteringExtras && activeTab === 'PENDING'} onClick={() => setActiveTab('PENDING')} />
            <Tab id="IN_PROGRESS" label="Em andamento" count={countsAll.IN_PROGRESS} active={!isFilteringExtras && activeTab === 'IN_PROGRESS'} onClick={() => setActiveTab('IN_PROGRESS')} />
            <Tab id="COMPLETED" label="Concluídos" count={countsAll.COMPLETED} active={!isFilteringExtras && activeTab === 'COMPLETED'} onClick={() => setActiveTab('COMPLETED')} />
          </div>
          {isFilteringExtras && (
            <div className="mt-2 text-xs text-gray-600">
              * Filtro extra por status ativo; as abas ficam desabilitadas enquanto os filtros abaixo estiverem selecionados.
            </div>
          )}
        </div>

        {/* NOVO: Botões de filtro para mais status */}
        <div className="mb-6 bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            {EXTRA_STATUS.map((s) => {
              const active = statusFilters.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleStatusFilter(s)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm transition ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                  title={`Filtrar por ${STATUS_PT[s]}`}
                >
                  <StatusBadge status={s} />
                  <span className="text-xs">{countsAll[s]}</span>
                </button>
              );
            })}

            {/* Botão para limpar filtros extras */}
            <button
              onClick={() => setStatusFilters([])}
              className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              title="Limpar filtros de status"
            >
              Limpar filtros
            </button>
          </div>
        </div>

        {/* === Filtros por método === */}
        <div className="mb-6 bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            {METHOD_OPTIONS.map((m) => {
              const active = methodFilters.includes(m);
              const label = m === 'PIX' ? 'PIX' : 'Presente no ponto (GIFT)';
              return (
                <button
                  key={m}
                  onClick={() => toggleMethodFilter(m)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm transition ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                  title={`Filtrar por ${label}`}
                >
                  <span className="text-xs font-medium">{label}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full border bg-white/70 text-gray-700">
                    {countsByMethod[m]}
                  </span>
                </button>
              );
            })}

            {/* Limpar filtros de método */}
            <button
              onClick={() => setMethodFilters([])}
              className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              title="Limpar filtros de método"
            >
              Limpar filtros de método
            </button>
          </div>

          {(isFilteringMethods) && (
            <div className="mt-2 text-xs text-gray-600">
              * Filtro por método ativo; a busca e contagens acima consideram apenas os métodos selecionados.
            </div>
          )}
        </div>

        {/* Filtros de busca/campanha */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                placeholder="Buscar por criança, padrinho ou ponto de coleta..."
                value={q}
                onChange={(e) => { setQ(e.target.value); }}
              />
            </div>

            <div className="relative lg:w-64">
              <Calendar className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <select
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 appearance-none cursor-pointer"
                value={campaignId}
                onChange={(e) => { setCampaignId(e.target.value); }}
              >
                <option value="">Todas as campanhas</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.year ? ` (${c.year})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setViewMode(viewMode === 'agrupado' ? 'table' : 'agrupado')}
                className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-700"
                title="Alternar visualização"
              >
                {viewMode === 'agrupado' ? 'Ver como Tabela' : 'Ver Agrupado'}
              </button>
            </div>
          </div>
        </div>

        {/* === Renderização condicional: Tabela x Agrupado === */}
        {viewMode === 'table' ? (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4"></th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Criança</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Padrinho</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Campanha</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Método</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Ponto de coleta</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Status</th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-gray-900">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                          <p className="text-gray-500 font-medium">Carregando apadrinhamentos...</p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && noRows && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="p-4 bg-gray-100 rounded-full">
                            <Search className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-gray-500 font-medium">Nenhum apadrinhamento encontrado</p>
                          <p className="text-gray-400 text-sm">Tente ajustar os filtros</p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {visibleRows.map((s) => {
                    const cp = resolveCP(s);
                    const checked = isSelected(s.id);
                    return (
                      <tr key={s.id} className="hover:bg-blue-50/50 transition-colors duration-150">
                        <td className="px-6 py-4">
                          <button
                            className="p-1 rounded hover:bg-gray-100"
                            onClick={() => toggleOne(s.id)}
                            title={checked ? 'Desmarcar' : 'Selecionar'}
                          >
                            {checked ? <CheckSquare className="w-5 h-5 text-emerald-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          {s.child ? (
                            <div className="flex items-center justify-between gap-2">
                              <a href={`/admin/children/${s.child.id}`} className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                                <div className="p-2 bg-pink-100 rounded-lg">
                                  <User className="w-4 h-4 text-pink-600" />
                                </div>
                                <div>
                                  <span className="text-sm font-semibold text-gray-900">{s.child.name}</span>
                                  <div className="text-xs text-gray-500">ID: #{s.child.publicId ?? '—'}</div>
                                </div>
                              </a>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openChild(s.child!.id)}
                                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                                  title="Ver detalhes da criança"
                                >
                                  <Eye className="w-4 h-4" />
                                  Detalhes
                                </button>
                                <button
                                  onClick={() => openChildModelFromRow(s.child)}
                                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                                  title="Ver model (payload) da criança"
                                >
                                  Model
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {s.sponsor ? (
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                  <UserCheck className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <span className="text-sm font-semibold text-gray-900">{s.sponsor.name}</span>
                                  {s.sponsor.email && <div className="text-xs text-gray-500">{s.sponsor.email}</div>}
                                </div>
                              </div>
                              <button
                                onClick={() => openSponsor(s.sponsor!.id)}
                                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                                title="Ver detalhes do padrinho"
                              >
                                <Eye className="w-4 h-4" />
                                Detalhes
                              </button>
                            </div>
                          ) : <span className="text-sm text-gray-400">—</span>}
                        </td>

                        <td className="px-6 py-4">
                          {s.campaign ? (
                            <a href={`/admin/campaigns/${s.campaign.id}`} className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                              <ExternalLink className="w-4 h-4 text-gray-400" />
                              <div>
                                <span className="text-sm font-medium text-gray-900">{s.campaign.name}</span>
                                {s.campaign.year && <div className="text-xs text-gray-500">{s.campaign.year}</div>}
                              </div>
                            </a>
                          ) : <span className="text-sm text-gray-400">—</span>}
                        </td>

                        <td className="px-6 py-4"><MethodBadge method={s.method ?? null} /></td>

                        <td className="px-6 py-4">
                          {s.method === 'GIFT' ? (
                            resolveCP(s) ? (
                              <div className="flex items-center gap-2 text-sm text-gray-800">
                                <MapPin className="w-4 h-4 text-gray-500" />
                                <div className="min-w-0">
                                  <div className="font-medium">{cpLabel(s)}</div>
                                </div>
                              </div>
                            ) : <span className="text-sm text-gray-400">—</span>
                          ) : <span className="text-sm text-gray-400">—</span>}
                        </td>

                        <td className="px-6 py-4">
                          <StatusBadge status={s.status} />
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => beginTransfer([s.id])}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition-colors duration-150"
                              title="Transferir esta criança"
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                              Transferir
                            </button>
                            <select
                              className="px-3 py-1.5 text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors duration-150 cursor-pointer appearance-none"
                              value={s.status}
                              onChange={(e) => changeStatus(s.id, e.target.value as SponsorshipStatus)}
                              title="Alterar status"
                            >
                              {(
                                [
                                  'PENDING',
                                  'IN_PROGRESS',
                                  'IN_PURCHASE',
                                  'PACKED',
                                  'BOXED',
                                  'AWAITING_DELIVERY',
                                  'COMPLETED',
                                  'ENDED',
                                  'CANCELLED',
                                ] as SponsorshipStatus[]
                              ).map((st) => (
                                <option key={st} value={st}>{STATUS_PT[st]}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => del(s.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 transition-colors duration-150"
                            >
                              <Trash2 className="w-4 h-4" />
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* === AGRUPADO (Padrinho → Cidade → Comunidade) === */
          <div className="space-y-6">
            {loading && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-10 text-center">
                <div className="mx-auto w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <p className="mt-3 text-gray-500 font-medium">Carregando apadrinhamentos...</p>
              </div>
            )}

            {!loading && noRows && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-10 text-center">
                <div className="inline-flex p-4 bg-gray-100 rounded-full">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <p className="mt-3 text-gray-500 font-medium">Nenhum apadrinhamento encontrado</p>
                <p className="text-gray-400 text-sm">Tente ajustar os filtros</p>
              </div>
            )}

            {!loading && !noRows && groupedBySponsor.map(group => {
              const sid = group.sponsorId;
              const bulkBusy = !!bulkLoading[sid];
              const bulkValue = bulkChoice[sid] ?? 'PENDING';

              async function applyBulk() {
                if (!confirm(`Alterar o status de TODOS os ${group.total} apadrinhamentos deste padrinho?`)) return;
                setBulkLoading(prev => ({ ...prev, [sid]: true }));
                try {
                  const ops = group.items.map(it =>
                    fetch(`/api/admin/sponsorships/${it.id}`, {
                      method: 'PATCH',
                      credentials: 'include',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ status: bulkValue }),
                    })
                  );
                  const results = await Promise.allSettled(ops);
                  const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !(r.value as any)?.ok)).length;
                  if (failed > 0) alert(`Algumas atualizações falharam (${failed}/${group.total}).`);
                  await load();
                } finally {
                  setBulkLoading(prev => ({ ...prev, [sid]: false }));
                }
              }

              return (
                <div
                  key={sid}
                  className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg"
                >
                  {/* Cabeçalho do padrinho + ações */}
                  <div className="flex flex-col gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <UserCheck className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-base font-semibold text-gray-900">
                          {group.sponsor?.name || 'Sem padrinho'}
                        </div>
                        {group.sponsor?.email && (
                          <div className="text-xs text-gray-600">{group.sponsor.email}</div>
                        )}
                      </div>
                    </div>

                    {/* Linha de ações */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-gray-50 text-gray-700 border-gray-200">
                        {group.total} apadrinhamento{group.total > 1 ? 's' : ''}
                      </Badge>

                      {/* === EXPORTAÇÕES === */}
                      <button
                        onClick={() =>
                          openExportModal(group.items, group.sponsor?.name || 'Sem padrinho', group.sponsor?.id)
                        }
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                        title="Exportar todos os apadrinhamentos deste padrinho em PDF"
                      >
                        <FileText className="w-4 h-4" /> PDF padrinho
                      </button>

                      <button
                        onClick={() => {
                          const selectedItems = visibleRows.filter((s) => isSelected(s.id));
                          if (selectedItems.length === 0) {
                            alert('Nenhum apadrinhamento selecionado.');
                            return;
                          }
                          openExportModal(
                            selectedItems,
                            `${group.sponsor?.name || 'Sem padrinho'} - seleção`,
                            group.sponsor?.id
                          );
                        }}
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        title="Exportar apenas os apadrinhamentos selecionados"
                      >
                        <FileText className="w-4 h-4" /> PDF seleção
                      </button>

                      {/* Bulk status padrinho */}
                      <select
                        className="px-3 py-1.5 text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg cursor-pointer appearance-none"
                        value={bulkValue}
                        onChange={(e) =>
                          setBulkChoice((prev) => ({
                            ...prev,
                            [sid]: e.target.value as SponsorshipStatus,
                          }))
                        }
                        disabled={bulkBusy}
                        title="Selecionar novo status para todos"
                      >
                        {(
                          [
                            'PENDING',
                            'IN_PROGRESS',
                            'IN_PURCHASE',
                            'PACKED',
                            'BOXED',
                            'AWAITING_DELIVERY',
                            'COMPLETED',
                            'ENDED',
                            'CANCELLED',
                          ] as SponsorshipStatus[]
                        ).map((st) => (
                          <option key={st} value={st}>{STATUS_PT[st]}</option>
                        ))}
                      </select>

                      <button
                        onClick={applyBulk}
                        disabled={bulkBusy}
                        className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          bulkBusy
                            ? 'bg-gray-100 text-gray-400 border-gray-200'
                            : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        {bulkBusy ? 'Aplicando…' : 'Aplicar a todos'}
                      </button>

                      {/* Transferência padrinho */}
                      <button
                        onClick={() => beginTransfer(group.items.map((x) => x.id))}
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        title="Transferir todos os apadrinhamentos deste padrinho"
                      >
                        <ArrowRightLeft className="w-4 h-4" /> Transferir padrinho
                      </button>

                      {/* Detalhes */}
                      {group.sponsor?.id && (
                        <button
                          onClick={() => openSponsor(group.sponsor!.id)}
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                        >
                          <Eye className="w-4 h-4" /> Detalhes
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Subgrupos: Cidade ➜ Comunidade */}
                  <div className="p-6 space-y-6">
                    {group.byCity.map((cityGroup) => (
                      <div
                        key={cityGroup.city}
                        className="rounded-2xl border border-gray-200 overflow-hidden"
                      >
                        {/* Cabeçalho da cidade */}
                        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-gray-50 border-b border-gray-200">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-indigo-600" />
                            <div className="text-sm font-semibold text-gray-900">
                              {cityGroup.city}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-white text-gray-700 border-gray-200">
                              {cityGroup.total}
                            </Badge>
                            <button
                              onClick={() =>
                                openExportModal(
                                  cityGroup.byCommunity.flatMap((c) => c.items),
                                  `${group.sponsor?.name || 'Sem padrinho'} - ${cityGroup.city}`,
                                  group.sponsor?.id
                                )
                              }
                              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                            >
                              <FileText className="w-4 h-4" /> PDF cidade
                            </button>
                          </div>
                        </div>

                        {/* Comunidades dentro da cidade */}
                        <div className="p-4 space-y-4">
                          {cityGroup.byCommunity.map((comm) => {
                            const commIds = comm.items.map((x) => x.id);
                            const allSelected = commIds.every((id) => isSelected(id));
                            return (
                              <div
                                key={`${cityGroup.city}::${comm.community}`}
                                className="rounded-xl border border-gray-200"
                              >
                                {/* Cabeçalho comunidade */}
                                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-gray-50 rounded-t-xl border-b border-gray-200">
                                  <div className="flex items-center gap-3">
                                    <button
                                      className="p-1 rounded hover:bg-gray-100"
                                      onClick={() => selectMany(commIds, !allSelected)}
                                      title={
                                        allSelected
                                          ? 'Desmarcar comunidade'
                                          : 'Selecionar comunidade'
                                      }
                                    >
                                      {allSelected ? (
                                        <CheckSquare className="w-5 h-5 text-emerald-600" />
                                      ) : (
                                        <Square className="w-5 h-5 text-gray-400" />
                                      )}
                                    </button>
                                    <div className="text-sm font-medium text-gray-900">
                                      {comm.community}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge className="bg-white text-gray-700 border-gray-200">
                                      {comm.total}
                                    </Badge>
                                    {/* PDF comunidade */}
                                    <button
                                      onClick={() =>
                                        openExportModal(
                                          comm.items,
                                          `${group.sponsor?.name || 'Sem padrinho'} - ${cityGroup.city} - ${comm.community}`,
                                          group.sponsor?.id
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                                    >
                                      <FileText className="w-4 h-4" /> PDF comunidade
                                    </button>

                                    {/* Transferir comunidade */}
                                    <button
                                      onClick={() => beginTransfer(commIds)}
                                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    >
                                      <ArrowRightLeft className="w-4 h-4" /> Transferir
                                    </button>
                                  </div>
                                </div>

                                {/* Cards das crianças */}
                                <ul className="divide-y divide-gray-100">
                                  {comm.items.map((s) => {
                                    const cp = resolveCP(s);
                                    const checked = isSelected(s.id);
                                    return (
                                      <li key={s.id} className="px-4 py-4 hover:bg-gray-50 transition">
                                        <div className="flex flex-col gap-2">
                                          {/* Linha 1: Criança + campanha */}
                                          <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                              <button
                                                className="p-1 rounded hover:bg-gray-100"
                                                onClick={() => toggleOne(s.id)}
                                              >
                                                {checked ? (
                                                  <CheckSquare className="w-5 h-5 text-emerald-600" />
                                                ) : (
                                                  <Square className="w-5 h-5 text-gray-400" />
                                                )}
                                              </button>

                                              <div className="p-2 bg-pink-100 rounded-lg">
                                                <User className="w-4 h-4 text-pink-600" />
                                              </div>
                                              <div>
                                                <div className="text-sm font-semibold text-gray-900">
                                                  {s.child?.name || '—'}
                                                </div>
                                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                                                  <span>ID: #{s.child?.publicId ?? '—'}</span>
                                                  {s.campaign?.name && (
                                                    <span className="inline-flex items-center gap-1">
                                                      <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                                                      {s.campaign.name}
                                                      {s.campaign.year ? ` (${s.campaign.year})` : ''}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                              <MethodBadge method={s.method ?? null} />
                                              <StatusBadge status={s.status} />
                                            </div>
                                          </div>

                                          {/* Linha 2: Ponto de coleta + ações */}
                                          <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 text-xs text-gray-700">
                                              {s.method === 'GIFT' && cp && (
                                                <>
                                                  <MapPin className="w-4 h-4 text-gray-500" />
                                                  <span>{cpLabel(s)}</span>
                                                </>
                                              )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                              {/* PDF individual */}
                                              <button
                                                onClick={() =>
                                                  openExportModal(
                                                    [s],
                                                    `${s.child?.name || 'crianca'}`,
                                                    group.sponsor?.id
                                                  )
                                                }
                                                className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                                              >
                                                <FileText className="w-4 h-4" /> PDF
                                              </button>

                                              <button
                                                onClick={() => openChild(s.child!.id)}
                                                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                                              >
                                                <Eye className="w-4 h-4" /> Detalhes
                                              </button>
                                              <button
                                                onClick={() => openChildModelFromRow(s.child)}
                                                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                                              >
                                                Model
                                              </button>
                                              <button
                                                onClick={() => beginTransfer([s.id])}
                                                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                              >
                                                <ArrowRightLeft className="w-4 h-4" /> Transferir
                                              </button>
                                              <select
                                                className="px-3 py-1.5 text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg appearance-none"
                                                value={s.status}
                                                onChange={(e) =>
                                                  changeStatus(s.id, e.target.value as SponsorshipStatus)
                                                }
                                              >
                                                {(
                                                  [
                                                    'PENDING',
                                                    'IN_PROGRESS',
                                                    'IN_PURCHASE',
                                                    'PACKED',
                                                    'BOXED',
                                                    'AWAITING_DELIVERY',
                                                    'COMPLETED',
                                                    'ENDED',
                                                    'CANCELLED',
                                                  ] as SponsorshipStatus[]
                                                ).map((st) => (
                                                  <option key={st} value={st}>{STATUS_PT[st]}</option>
                                                ))}
                                              </select>
                                              <button
                                                onClick={() => del(s.id)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200"
                                              >
                                                <Trash2 className="w-4 h-4" /> Excluir
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );

            })}
          </div>
        )}

      </div>

      {/* Modal CRIANÇA */}
      <Modal
        open={!!childModalId}
        title="Detalhes da Criança"
        onClose={() => { setChildModalId(null); setChildDetail(null); }}
      >
        {modalLoading && (
          <div className="flex items-center gap-3 text-gray-600">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
            Carregando...
          </div>
        )}

        {!modalLoading && childDetail && (
          <div className="space-y-6">
            {childDetail.__error ? (
              <p className="text-red-600">{childDetail.__error}</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <div className="aspect-[4/5] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                      <img
                        src={
                          childDetail.photoUrl ??
                          childDetail.images?.[0]?.framedUrl ??
                          childDetail.images?.[0]?.processedUrl ??
                          childDetail.images?.[0]?.originalUrl
                        }
                        alt={childDetail.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {Array.isArray(childDetail.images) && childDetail.images.length > 0 && (
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        {['framedUrl','processedUrl','originalUrl','layoutUrl'].map((k) => {
                          const first = childDetail.images[0];
                          const url = first?.[k];
                          if (!url) return null;
                          return <ImageThumb key={k} url={url} label={k.replace('Url','')} />;
                        })}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <KV label="Nome" value={labelOrDash(childDetail.name)} />
                      <div className="flex items-center gap-2">
                        <KV label="ID Público" value={labelOrDash(childDetail.publicId)} />
                        <CopyButton text={String(childDetail.publicId ?? '')} />
                      </div>
                      <KV label="Nascimento" value={fmtDateBR(childDetail.birthDate)} />
                      <KV label="Idade (calc.)" value={childDetail.age ? `${childDetail.age} anos` : '—'} />
                      <KV label="Categoria" value={labelOrDash(childDetail.category)} />
                      <KV label="Presente desejado" value={labelOrDash(childDetail.wantedGift)} />
                      <KV label="Criado em" value={fmtDateBR(childDetail.createdAt)} />
                      <KV label="Atualizado em" value={fmtDateBR(childDetail.updatedAt)} />
                    </div>

                    <SectionTitle>Localização</SectionTitle>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <KV label="Cidade" value={labelOrDash(childDetail.city?.name ?? childDetail.cityName)} />
                      <KV label="UF" value={labelOrDash(childDetail.city?.state)} />
                      <KV label="Comunidade" value={labelOrDash(childDetail.community?.name)} />
                    </div>

                    <SectionTitle>Escola</SectionTitle>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <KV label="Nome" value={labelOrDash(childDetail.school?.name ?? childDetail.schoolLegacy)} />
                      <KV label="Código" value={labelOrDash(childDetail.school?.publicId)} />
                      <KV label="Endereço" value={labelOrDash(childDetail.school?.address)} />
                    </div>
                  </div>
                </div>

                {Array.isArray(childDetail.sponsorships) && (
                  <div>
                    <SectionTitle>Apadrinhamentos</SectionTitle>
                    {childDetail.sponsorships.length > 0 ? (
                      <div className="space-y-2">
                        {childDetail.sponsorships.map((s: any) => (
                          <div key={s.id} className="flex flex-col gap-1 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700">
                              <span className="inline-flex items-center gap-1">
                                <b>Status:</b> <StatusBadge status={s.status as SponsorshipStatus} />
                              </span>
                              <span><b>Início:</b> {fmtDateBR(s.startDate)}</span>
                              <span><b>Fim:</b> {fmtDateBR(s.endDate)}</span>
                              <span><b>Método:</b> {s.method ?? '—'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-gray-500">Nenhum apadrinhamento encontrado.</p>}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Modal PADRINHO */}
      <Modal
        open={!!sponsorModalId}
        title="Detalhes do Padrinho"
        onClose={() => { setSponsorModalId(null); setSponsorDetail(null); }}
      >
        {modalLoading && (
          <div className="flex items-center gap-3 text-gray-600">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
            Carregando...
          </div>
        )}
        {!modalLoading && sponsorDetail && (
          <div className="space-y-4">
            {sponsorDetail.__error ? (
              <p className="text-red-600">{sponsorDetail.__error}</p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoRow icon={<User className="w-4 h-4" />} label="Nome" value={labelOrDash(sponsorDetail.name)} />
                  <InfoRow icon={<Mail className="w-4 h-4" />} label="E-mail" value={labelOrDash(sponsorDetail.email)} />
                  <InfoRow icon={<Phone className="w-4 h-4" />} label="Telefone" value={labelOrDash(sponsorDetail.phone)} />
                  <InfoRow icon={<Clock className="w-4 h-4" />} label="Criado em" value={fmtDateBR(sponsorDetail.createdAt)} />
                  <InfoRow icon={<MapPin className="w-4 h-4" />} label="Endereço" value={labelOrDash(sponsorDetail.profile?.address)} />
                  <InfoRow icon={<MapPin className="w-4 h-4" />} label="Cidade" value={labelOrDash(sponsorDetail.profile?.city)} />
                </div>

                {Array.isArray(sponsorDetail.sponsorships) && sponsorDetail.sponsorships.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Apadrinhamentos</h4>
                    <div className="space-y-2">
                      {sponsorDetail.sponsorships.map((s: any) => (
                        <div key={s.id} className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                          <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
                            <span className="inline-flex items-center gap-1">
                              <b>Status:</b> <StatusBadge status={s.status as SponsorshipStatus} />
                            </span>
                            <span><b>Método:</b> {s.method ?? '—'}</span>
                            <span><b>Início:</b> {fmtDateBR(s.startDate)}</span>
                            <span><b>Fim:</b> {fmtDateBR(s.endDate)}</span>
                            {s.child?.name && <span><b>Criança:</b> {s.child.name}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Modal: Modelo da Criança (RAW) */}
      <Modal
        open={childModelOpen}
        title="Modelo da Criança (RAW)"
        onClose={() => { setChildModelOpen(false); setChildModelPayload(null); }}
      >
        {!childModelPayload ? (
          <div className="text-sm text-gray-500">Sem payload para exibir.</div>
        ) : (
          <div className="space-y-3">
            {childModelPayload?.id && (
              <a
                href={`/admin/children/${childModelPayload.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900 underline underline-offset-4"
              >
                Abrir página da criança
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            <pre className="max-h-[60vh] overflow-auto text-xs bg-gray-50 border border-gray-200 rounded-lg p-3">
{JSON.stringify(childModelPayload, null, 2)}
            </pre>
          </div>
        )}
      </Modal>

      {/* Modal: Transferir padrinho */}
      <Modal
        open={transferOpen}
        title={`Transferir ${transferIds.length} apadrinhamento${transferIds.length > 1 ? 's' : ''}`}
        onClose={() => { if (!transferBusy) setTransferOpen(false); }}
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-700">
            Selecione o <b>padrinho destino</b>. A transferência altera o dono do(s) apadrinhamento(s) escolhido(s).
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Buscar padrinho destino</label>
            <input
              value={destQuery}
              onChange={e => setDestQuery(e.target.value)}
              placeholder="Digite nome ou e-mail (mín. 2 caracteres)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
              disabled={transferBusy}
            />
            {destResults.length > 0 && (
              <ul className="mt-2 max-h-56 overflow-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {destResults.map(u => (
                  <li key={u.id} className={`px-3 py-2 text-sm flex items-center justify-between ${destSponsor?.id===u.id?'bg-emerald-50':''}`}>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{u.name}</div>
                      {u.email && <div className="text-xs text-gray-600 truncate">{u.email}</div>}
                    </div>
                    <button
                      onClick={() => setDestSponsor(u)}
                      className="ml-3 px-2 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50"
                    >
                      {destSponsor?.id === u.id ? 'Selecionado' : 'Selecionar'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {destQuery && destResults.length === 0 && (
              <div className="text-xs text-gray-500 mt-2">Nenhum padrinho encontrado.</div>
            )}
          </div>

          {!!destSponsor && (
            <div className="text-xs text-gray-600">
              Destino: <b>{destSponsor.name}</b> {destSponsor.email ? `(${destSponsor.email})` : ''}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => !transferBusy && setTransferOpen(false)}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
              disabled={transferBusy}
            >
              Cancelar
            </button>
            <button
              onClick={applyTransfer}
              disabled={transferBusy || !transferIds.length || !destSponsor}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {transferBusy ? 'Transferindo…' : 'Confirmar transferência'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Exportar PDF por padrinho */}
      <Modal
        open={exportOpen}
        title={`Exportar PDF — ${exportSponsor?.name ?? ''}`}
        onClose={() => {
          if (exportBusy) return;
          setExportOpen(false);
          setExportProgress(null);
          setExportSponsor(null);
          setExportItems([]);
        }}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cartões por página</label>
              <select
                value={exportPerPage}
                onChange={(e) => setExportPerPage(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
                disabled={exportBusy}
              >
                <option value={1}>1 por página</option>
                <option value={2}>2 por página</option>
                <option value={3}>3 por página</option>
                <option value={4}>4 por página</option>
                <option value={6}>6 por página</option>
                <option value={8}>8 por página</option>
                <option value={9}>9 por página</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Escala de texto</label>
              <input
                type="number"
                step="0.05"
                min={0.7}
                max={1.3}
                value={exportTextScale}
                onChange={(e) => setExportTextScale(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
                disabled={exportBusy}
              />
              <div className="text-[11px] text-gray-500 mt-1">Ex.: 0.95 reduz 5% | 1.10 aumenta 10%</div>
            </div>
          </div>

          {exportProgress ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
              {exportProgress.phase === 'compose' ? 'Compondo imagens' : 'Escrevendo PDF'}… {exportProgress.current}/{exportProgress.total}
              <div className="mt-2 h-2 bg-blue-100 rounded">
                <div
                  className="h-2 bg-blue-600 rounded"
                  style={{ width: `${(exportProgress.current / Math.max(1, exportProgress.total)) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              Gera um PDF com todas as crianças apadrinhadas por este padrinho, mantendo a composição de imagem do site.
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => {
                if (exportBusy) return;
                setExportOpen(false);
                setExportProgress(null);
                setExportSponsor(null);
                setExportItems([]);
              }}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
              disabled={exportBusy}
            >
              Fechar
            </button>

            <button
              onClick={async () => {
                if (!exportItems.length || !exportSponsor) return;
                setExportBusy(true);
                setExportProgress({ current: 0, total: exportItems.length, phase: 'compose' });
                try {
                  const enriched = await enrichItemsForSponsor(exportItems);
                  await exportSponsorshipsPdf(enriched, {
                    perPage: exportPerPage,
                    fileName: `apadrinhamentos-${(exportSponsor.name || 'padrinho').toLowerCase().replace(/\s+/g,'-')}.pdf`,
                    onProgress: (p) => setExportProgress(p),
                  });
                } finally {
                  setExportBusy(false);
                  setExportProgress(null);
                }
              }}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={exportBusy}
            >
              {exportBusy ? 'Gerando…' : 'Gerar PDF'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
