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
  RefreshCw,
  LayoutList,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
  Code2,
  Gift,
  QrCode,
  FilterX,
} from 'lucide-react';

// >>> PDF exporter
import { exportSponsorshipsPdf } from '@/lib/pdf/exportSponsorshipsPdf';
import { campaignLabel, useAdminCampaign } from '@/components/Admin/CampaignFilter';

// >>> Status unificado
import {
  STATUS_PT,
  type SponsorshipStatus,
} from '@/lib/sponsorship-status';
import StatusBadge, { StatusDistribution, StatusSteps } from '@/components/Sponsorship/StatusBadge';
import { FLOW_STEPS, OFF_FLOW, STATUS_STYLE } from '@/components/Sponsorship/statusStyle';
import { normalizeText } from '@/lib/sheetImport';

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

const ALL_STATUSES: SponsorshipStatus[] = [
  'PENDING', 'IN_PROGRESS', 'IN_PURCHASE', 'PACKED', 'BOXED', 'AWAITING_DELIVERY', 'COMPLETED', 'ENDED', 'CANCELLED',
];
// "em andamento": aprovado e ainda no caminho até a entrega
const IN_FLOW: SponsorshipStatus[] = ['IN_PROGRESS', 'IN_PURCHASE', 'PACKED', 'BOXED', 'AWAITING_DELIVERY'];

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
/** Mensagem de erro do backend ({ message }) ou o status HTTP */
async function errorMessage(r: Response) {
  const txt = await r.text().catch(() => '');
  try {
    const j = JSON.parse(txt);
    const m = j?.message ?? j?.error;
    if (m) return Array.isArray(m) ? m.join(' ') : String(m);
  } catch {}
  return txt.slice(0, 200) || `erro ${r.status}`;
}
function countByStatus(items: Sponsorship[]) {
  const m = new Map<SponsorshipStatus, number>();
  for (const it of items) m.set(it.status, (m.get(it.status) ?? 0) + 1);
  return [...m.entries()];
}
/** Iniciais da criança num círculo (cor fixa por nome, para reconhecer de relance) */
function ChildAvatar({ name }: { name?: string | null }) {
  const parts = (name || '?').trim().split(/\s+/);
  const ini = (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
  const tones = ['bg-pink-100 text-pink-700', 'bg-sky-100 text-sky-700', 'bg-amber-100 text-amber-700', 'bg-violet-100 text-violet-700', 'bg-teal-100 text-teal-700', 'bg-orange-100 text-orange-700'];
  const tone = tones[[...(name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % tones.length];
  return <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${tone}`}>{ini}</div>;
}
function IconBtn({ title, onClick, className = '', children }: { title: string; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} className={`p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition ${className}`}>
      {children}
    </button>
  );
}
/** Select de status pintado com a cor do status atual */
function StatusPicker({ value, onChange }: { value: SponsorshipStatus; onChange: (s: SponsorshipStatus) => void }) {
  const st = STATUS_STYLE[value];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SponsorshipStatus)}
      title="Mudar status"
      className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg ring-1 ring-inset cursor-pointer outline-none ${st?.soft ?? 'bg-gray-50 ring-gray-200'}`}
    >
      {ALL_STATUSES.map((s) => (
        <option key={s} value={s} className="bg-white text-gray-900">
          {STATUS_STYLE[s].step ? `${STATUS_STYLE[s].step}. ` : '× '}{STATUS_PT[s]}
        </option>
      ))}
    </select>
  );
}
/** Atalho para a próxima etapa do fluxo (ex.: Pendente → Em andamento) */
function NextStepButton({ status, onClick }: { status: SponsorshipStatus; onClick: (next: SponsorshipStatus) => void }) {
  const step = STATUS_STYLE[status]?.step;
  if (!step || step >= FLOW_STEPS.length) return null;
  const next = FLOW_STEPS[step];
  const st = STATUS_STYLE[next];
  const Icon = st.icon;
  return (
    <button
      type="button"
      onClick={() => onClick(next)}
      title={`Avançar para "${STATUS_PT[next]}" — ${st.hint}`}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold ring-1 ring-inset transition hover:brightness-95 ${st.soft}`}
    >
      <ArrowRight className="w-3.5 h-3.5" /> <Icon className="w-3.5 h-3.5" /> {STATUS_PT[next]}
    </button>
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
    // celular: abre de baixo (folha), com rolagem própria; computador: centralizado
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-[61] w-full sm:max-w-2xl max-h-[92dvh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 min-w-0 truncate">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition shrink-0" aria-label="Fechar">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
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
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  // busca é feita aqui na tela: espera o usuário parar de digitar
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 250);
    return () => clearTimeout(t);
  }, [qInput]);
  // campanha: começa com a única ativa (se houver) e é lembrada entre as telas do admin
  const { campaigns, campaignId, setCampaignId, ready: campaignReady } = useAdminCampaign();

  // status: vazio = todos; vários podem ser marcados juntos
  const [statusFilters, setStatusFilters] = useState<SponsorshipStatus[]>(['PENDING']);

  const METHOD_OPTIONS = ['PIX', 'GIFT'] as const;
  type MethodOption = (typeof METHOD_OPTIONS)[number];

  const [methodFilters, setMethodFilters] = useState<MethodOption[]>([]);

  function toggleMethodFilter(m: MethodOption) {
    setMethodFilters(prev => (prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]));
  }
  const isFilteringMethods = methodFilters.length > 0;

  // dados
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

  // ===== Exclusão de todos os apadrinhamentos de um padrinho
  const [deleteSponsor, setDeleteSponsor] = useState<{
    name: string;
    email: string | null;
    visible: Sponsorship[]; // os que aparecem na aba/filtro atual
    all: Sponsorship[]; // todos do padrinho na campanha selecionada
  } | null>(null);
  const [deleteScope, setDeleteScope] = useState<'visible' | 'all'>('all');
  const [deleteBusy, setDeleteBusy] = useState(false);

  // padrinhos abertos na visão agrupada (sem escolha: abre se forem poucos)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [groupsDefaultOpen, setGroupsDefaultOpen] = useState<boolean | null>(null);
  function setAllGroupsOpen(open: boolean) {
    setOpenGroups({});
    setGroupsDefaultOpen(open);
  }

  // seleção: status em lote
  const [selStatus, setSelStatus] = useState<SponsorshipStatus>('IN_PROGRESS');
  const [selBusy, setSelBusy] = useState(false);

  // aviso rápido de sucesso
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

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

  // Busca tudo da campanha; status, método e texto são filtrados aqui na tela
  async function load() {
    setLoading(true);
    try {
      const url = new URL('/api/admin/sponsorships', window.location.origin);
      url.searchParams.set('pageSize', '100000');
      if (campaignId) url.searchParams.set('campaignId', campaignId);
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
    if (!campaignReady) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, campaignReady]);

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

  // (1) status (nenhum marcado = todos)
  const filteredBySelection = useMemo(() => {
    if (statusFilters.length === 0) return allRows;
    return allRows.filter(r => statusFilters.includes(r.status));
  }, [allRows, statusFilters]);

  // (2) método
  const filteredByMethod = useMemo(() => {
    if (!isFilteringMethods) return filteredBySelection;
    return filteredBySelection.filter(r => {
      // se método estiver vazio, ele não passa por nenhum filtro explícito
      if (!r.method) return false;
      return methodFilters.includes(r.method as MethodOption);
    });
  }, [filteredBySelection, isFilteringMethods, methodFilters]);

  // (3) texto: criança (nome ou ID), padrinho (nome ou e-mail) e ponto de coleta, sem diferença de acentos
  const visibleRows = useMemo(() => {
    const raw = q.trim();
    const base = filteredByMethod;
    if (!raw) return base;
    const needle = normalizeText(raw);
    const idNeedle = raw.replace(/^#/, '');
    const isId = /^\d+$/.test(idNeedle);
    return base.filter((r) => {
      if (isId && String(r.child?.publicId ?? '') === String(parseInt(idNeedle, 10))) return true;
      const cpName = r.collectionPoint?.name || (r.collectionPointId ? cpMap.get(r.collectionPointId)?.name : '') || '';
      const haystack = normalizeText([r.child?.name, r.sponsor?.name, cpName].join(' '));
      return haystack.includes(needle) || (r.sponsor?.email ?? '').toLowerCase().includes(raw.toLowerCase());
    });
  }, [filteredByMethod, q, cpMap]);


  const noRows = !loading && visibleRows.length === 0;

  /* ===== Método ===== */
  function MethodBadge({ method }: { method?: SponsorshipMethod | null }) {
    // neutro (contorno + ícone) para não competir com as cores dos status
    if (!method) return <Badge className="bg-white text-gray-500 border-gray-200">—</Badge>;
    if (method === 'PIX') return <Badge className="bg-white text-gray-700 border-gray-300 gap-1"><QrCode className="w-3 h-3" /> PIX</Badge>;
    return <Badge className="bg-white text-gray-700 border-gray-300 gap-1"><Gift className="w-3 h-3" /> Presente no ponto</Badge>;
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
  function patchStatus(id: string, status: SponsorshipStatus) {
    return fetch(`/api/admin/sponsorships/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }
  // atualiza a linha na hora (sem recarregar tudo) e desfaz se o backend recusar
  async function changeStatus(id: string, newStatus: SponsorshipStatus) {
    const before = allRows.find(r => r.id === id)?.status;
    setAllRows(prev => prev.map(r => (r.id === id ? { ...r, status: newStatus } : r)));
    const r = await patchStatus(id, newStatus);
    if (!r.ok) {
      if (before) setAllRows(prev => prev.map(x => (x.id === id ? { ...x, status: before } : x)));
      alert(`Falha ao alterar status: ${await errorMessage(r)}`);
      return;
    }
    setToast(`Status alterado para "${STATUS_PT[newStatus]}".`);
  }
  /** Mesmo status para vários apadrinhamentos (padrinho inteiro ou seleção) */
  async function changeStatusMany(ids: string[], newStatus: SponsorshipStatus) {
    const results = await Promise.allSettled(ids.map(id => patchStatus(id, newStatus)));
    const okIds = new Set(ids.filter((_, i) => results[i].status === 'fulfilled' && (results[i] as PromiseFulfilledResult<Response>).value.ok));
    setAllRows(prev => prev.map(r => (okIds.has(r.id) ? { ...r, status: newStatus } : r)));
    const failed = ids.length - okIds.size;
    if (failed) alert(`Algumas atualizações falharam (${failed}/${ids.length}).`);
    else setToast(`${okIds.size} apadrinhamento(s) agora em "${STATUS_PT[newStatus]}".`);
  }
  async function del(id: string) {
    if (!confirm('Excluir apadrinhamento? Esta ação não pode ser desfeita.')) return;
    const r = await fetch(`/api/admin/sponsorships/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!r.ok) return alert(`Falha ao excluir: ${await errorMessage(r)}`);
    await load();
  }

  // ===== Excluir todos de um padrinho
  function beginDeleteSponsor(group: { sponsorId: string; sponsor: SponsorLite | null; items: Sponsorship[] }) {
    // todos do padrinho carregados (qualquer status), não só os da aba/filtro atual
    const all = allRows.filter(r => (r.sponsor?.id ?? '__sem_padrinho__') === group.sponsorId);
    setDeleteSponsor({
      name: group.sponsor?.name || 'Sem padrinho',
      email: group.sponsor?.email ?? null,
      visible: group.items,
      all,
    });
    setDeleteScope(all.length > group.items.length ? 'visible' : 'all');
  }
  async function applyDeleteSponsor() {
    if (!deleteSponsor) return;
    const items = deleteScope === 'all' ? deleteSponsor.all : deleteSponsor.visible;
    if (!items.length) return;
    setDeleteBusy(true);
    try {
      const r = await fetch('/api/admin/sponsorships/bulk-delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sponsorshipIds: items.map(it => it.id) }),
      });
      if (!r.ok) { alert(`Falha ao excluir: ${await errorMessage(r)}`); return; }
      setDeleteSponsor(null);
      setToast(`${items.length} apadrinhamento(s) excluído(s).`);
      await load();
    } finally {
      setDeleteBusy(false);
    }
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
      setToast(`${transferIds.length} apadrinhamento(s) transferido(s) para ${destSponsor.name}.`);
      setTransferIds([]);
      setSelectedIds({});
      await load();
    } finally {
      setTransferBusy(false);
    }
  }

  const selectedRows = useMemo(() => allRows.filter(r => selectedIds[r.id]), [allRows, selectedIds]);
  const selectedCount = selectedRows.length;

  async function applySelectionStatus() {
    if (!selectedCount) return;
    if (!confirm(`Alterar para "${STATUS_PT[selStatus]}" os ${selectedCount} apadrinhamento(s) selecionado(s)?`)) return;
    setSelBusy(true);
    try { await changeStatusMany(selectedRows.map(r => r.id), selStatus); }
    finally { setSelBusy(false); }
  }
  async function deleteSelection() {
    if (!selectedCount) return;
    if (!confirm(`Excluir definitivamente os ${selectedCount} apadrinhamento(s) selecionado(s)? Esta ação não pode ser desfeita.`)) return;
    setSelBusy(true);
    try {
      const r = await fetch('/api/admin/sponsorships/bulk-delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sponsorshipIds: selectedRows.map(x => x.id) }),
      });
      if (!r.ok) { alert(`Falha ao excluir: ${await errorMessage(r)}`); return; }
      setToast(`${selectedCount} apadrinhamento(s) excluído(s).`);
      await load();
    } finally {
      setSelBusy(false);
    }
  }
  function exportSelection() {
    const sponsors = new Set(selectedRows.map(r => r.sponsor?.id ?? ''));
    const only = sponsors.size === 1 ? selectedRows[0]?.sponsor : null;
    openExportModal(selectedRows, only?.name ? `${only.name} - seleção` : 'Seleção', only?.id);
  }

  /* ===== UI ===== */
  function toggleStatusFilter(s: SponsorshipStatus) {
    setStatusFilters(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]));
  }
  const sameStatuses = (a: SponsorshipStatus[], b: SponsorshipStatus[]) =>
    a.length === b.length && a.every(s => b.includes(s));
  const hasFilters = !!qInput.trim() || isFilteringMethods || !sameStatuses(statusFilters, ['PENDING']);
  function clearFilters() {
    setQInput(''); setQ(''); setMethodFilters([]); setStatusFilters(['PENDING']);
  }

  const sponsorsInView = useMemo(() => new Set(visibleRows.map(r => r.sponsor?.id ?? '')).size, [visibleRows]);
  const sumOf = (list: SponsorshipStatus[]) => list.reduce((acc, s) => acc + (countsAll[s] ?? 0), 0);
  const totalSponsors = useMemo(() => new Set(allRows.map(r => r.sponsor?.id)).size, [allRows]);
  const inFlowTotal = allRows.length - sumOf(OFF_FLOW);
  const deliveredPct = inFlowTotal ? Math.round((countsAll.COMPLETED / inFlowTotal) * 100) : 0;
  const pct = (n: number) => (allRows.length ? Math.round((n / allRows.length) * 100) : 0);

  const chipCls = (active: boolean) =>
    `inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition ${
      active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
    }`;
  const countCls = (active: boolean) => `text-xs px-1.5 rounded-full ${active ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}`;

  /** Cartão de uma etapa: cor e ícone do status, quantidade e % do total; clique liga/desliga o filtro */
  const StepTile = ({ s, compact }: { s: SponsorshipStatus; compact?: boolean }) => {
    const st = STATUS_STYLE[s];
    const Icon = st.icon;
    const active = statusFilters.includes(s);
    const n = countsAll[s] ?? 0;
    return (
      <button
        onClick={() => toggleStatusFilter(s)}
        title={`${st.hint} — clique para ${active ? 'tirar do' : 'incluir no'} filtro`}
        className={`group relative w-full text-left rounded-2xl ring-1 transition ${compact ? 'p-3' : 'p-3.5'} ${
          active ? `${st.soft} ring-2 shadow-md` : 'bg-white ring-gray-200 hover:ring-gray-300 hover:shadow-sm'
        } ${n === 0 && !active ? 'opacity-60' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className={`inline-flex items-center justify-center rounded-xl ${compact ? 'w-8 h-8' : 'w-9 h-9'} ${st.solid}`}>
            <Icon className="w-4 h-4" />
          </span>
          {st.step && <span className="text-[10px] font-bold text-gray-400">ETAPA {st.step}</span>}
          {active && <CheckCircle2 className={`w-4 h-4 ${st.text}`} />}
        </div>
        <div className={`mt-2 font-bold leading-none ${compact ? 'text-xl' : 'text-2xl'} ${n ? st.text : 'text-gray-400'}`}>
          {n.toLocaleString('pt-BR')}
          <span className="ml-1 text-xs font-medium text-gray-400">{pct(n)}%</span>
        </div>
        <div className="mt-1 text-sm font-semibold text-gray-900 truncate">{STATUS_PT[s]}</div>
        {!compact && <div className="text-[11px] text-gray-500 truncate">{st.hint}</div>}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28">
        {/* Header */}
        <div className="mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Apadrinhamentos</h1>
            <p className="text-gray-600 mt-1">Acompanhe e gerencie os vínculos entre padrinhos e crianças</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* resumo */}
            <div className="flex items-center divide-x divide-gray-200 rounded-xl border border-gray-200 bg-white shadow-sm text-sm">
              <div className="px-4 py-2">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Apadrinhamentos</div>
                <div className="font-bold text-gray-900 inline-flex items-center gap-1.5"><Heart className="w-4 h-4 text-pink-500" />{allRows.length.toLocaleString('pt-BR')}</div>
              </div>
              <div className="px-4 py-2">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Padrinhos</div>
                <div className="font-bold text-gray-900 inline-flex items-center gap-1.5"><Users className="w-4 h-4 text-blue-500" />{totalSponsors.toLocaleString('pt-BR')}</div>
              </div>
              <div className="px-4 py-2 min-w-[9rem]">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Entregues</div>
                <div className="font-bold text-emerald-700">{deliveredPct}%</div>
                <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${deliveredPct}%` }} />
                </div>
              </div>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>
        </div>

        {/* Fluxo: cada etapa com sua cor e ícone; clicar filtra */}
        <div className="bg-white/80 rounded-2xl p-4 border border-gray-100 shadow-sm mb-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Caminho até a entrega</h2>
              <p className="text-xs text-gray-500">Clique nas etapas para filtrar a lista (dá para marcar várias).</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setStatusFilters([])} className={chipCls(statusFilters.length === 0)}>
                Todos <span className={countCls(statusFilters.length === 0)}>{allRows.length}</span>
              </button>
              <button onClick={() => setStatusFilters(IN_FLOW)} className={chipCls(sameStatuses(statusFilters, IN_FLOW))} title="Etapas 2 a 6">
                Em andamento <span className={countCls(sameStatuses(statusFilters, IN_FLOW))}>{sumOf(IN_FLOW)}</span>
              </button>
            </div>
          </div>

          <StatusDistribution counts={countsAll} onSelect={(s) => setStatusFilters([s])} className="h-3" />

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {FLOW_STEPS.map(s => <StepTile key={s} s={s} />)}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-semibold text-gray-500">Fora do fluxo:</span>
            {OFF_FLOW.map(s => (
              <div key={s} className="w-44"><StepTile s={s} compact /></div>
            ))}
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white/80 rounded-2xl p-4 border border-gray-100 shadow-sm mb-6 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="w-full pl-9 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Buscar por criança (nome ou ID), padrinho (nome ou e-mail) ou ponto de coleta…"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
              />
              {qInput && (
                <button
                  onClick={() => { setQInput(''); setQ(''); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 text-gray-500"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="relative lg:w-72">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
              >
                <option value="">Todas as campanhas</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{campaignLabel(c)}</option>
                ))}
              </select>
            </div>

            {/* visualização */}
            <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 self-start lg:self-auto">
              {([['agrupado', 'Por padrinho', <Users key="i" className="w-4 h-4" />], ['table', 'Tabela', <LayoutList key="i" className="w-4 h-4" />]] as const).map(([mode, label, icon]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    viewMode === mode ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          {/* método */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 w-16">Método</span>
            <button onClick={() => setMethodFilters([])} className={chipCls(!isFilteringMethods)}>Todos</button>
            {METHOD_OPTIONS.map(m => {
              const active = methodFilters.includes(m);
              return (
                <button key={m} onClick={() => toggleMethodFilter(m)} className={chipCls(active)}>
                  {m === 'PIX' ? <QrCode className="w-4 h-4" /> : <Gift className="w-4 h-4" />}
                  {m === 'PIX' ? 'PIX' : 'Presente no ponto'} <span className={countCls(active)}>{countsByMethod[m]}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-3 border-t border-gray-100 text-sm text-gray-600">
            <span>
              {loading ? 'Carregando…' : (
                <>
                  <strong className="text-gray-900">{visibleRows.length.toLocaleString('pt-BR')}</strong> apadrinhamento{visibleRows.length === 1 ? '' : 's'}
                  {' · '}<strong className="text-gray-900">{sponsorsInView}</strong> padrinho{sponsorsInView === 1 ? '' : 's'}
                </>
              )}
            </span>
            {/* status ativos no filtro */}
            {statusFilters.map(s => (
              <button key={s} onClick={() => toggleStatusFilter(s)} className="inline-flex items-center gap-0.5" title="Tirar do filtro">
                <StatusBadge status={s} /><X className="w-3 h-3 text-gray-400" />
              </button>
            ))}
            {hasFilters && (
              <button onClick={clearFilters} className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900">
                <FilterX className="w-4 h-4" /> Limpar filtros
              </button>
            )}
            {viewMode === 'agrupado' && groupedBySponsor.length > 1 && (
              <span className="ml-auto inline-flex gap-3">
                <button onClick={() => setAllGroupsOpen(true)} className="text-gray-500 hover:text-gray-900 underline">Expandir todos</button>
                <button onClick={() => setAllGroupsOpen(false)} className="text-gray-500 hover:text-gray-900 underline">Recolher todos</button>
              </span>
            )}
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
                      <tr key={s.id} className={`hover:bg-blue-50/50 transition-colors duration-150 ${checked ? 'bg-emerald-50/60' : ''}`}>
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

                        <td className={`px-6 py-4 border-l-4 ${STATUS_STYLE[s.status]?.border ?? ''}`}>
                          <div className="flex flex-col gap-1.5 w-44">
                            <StatusBadge status={s.status} />
                            <StatusSteps status={s.status} />
                          </div>
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
                            <NextStepButton status={s.status} onClick={(next) => changeStatus(s.id, next)} />
                            <StatusPicker value={s.status} onChange={(next) => changeStatus(s.id, next)} />
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
              const bulkValue = bulkChoice[sid] ?? 'IN_PROGRESS';
              const open = openGroups[sid] ?? groupsDefaultOpen ?? groupedBySponsor.length <= 5;
              const groupIds = group.items.map(x => x.id);
              const groupSelected = groupIds.length > 0 && groupIds.every(id => isSelected(id));

              async function applyBulk() {
                if (!confirm(`Alterar para "${STATUS_PT[bulkValue]}" os ${group.total} apadrinhamento(s) deste padrinho que aparecem no filtro?`)) return;
                setBulkLoading(prev => ({ ...prev, [sid]: true }));
                try {
                  await changeStatusMany(groupIds, bulkValue);
                } finally {
                  setBulkLoading(prev => ({ ...prev, [sid]: false }));
                }
              }

              return (
                <div
                  key={sid}
                  className="bg-white/80 rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  {/* Cabeçalho do padrinho (clique para abrir/fechar) + ações */}
                  <div className={`flex flex-col gap-3 px-5 py-4 bg-gray-50 ${open ? 'border-b border-gray-100' : ''}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        className="p-1 rounded hover:bg-gray-100"
                        onClick={() => selectMany(groupIds, !groupSelected)}
                        title={groupSelected ? 'Desmarcar padrinho' : 'Selecionar todos deste padrinho'}
                      >
                        {groupSelected ? <CheckSquare className="w-5 h-5 text-emerald-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                      </button>
                      <button
                        onClick={() => setOpenGroups(prev => ({ ...prev, [sid]: !open }))}
                        className="flex flex-1 min-w-0 items-center gap-3 text-left"
                        aria-expanded={open}
                      >
                        {open ? <ChevronDown className="w-5 h-5 text-gray-500 shrink-0" /> : <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />}
                        <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                          <UserCheck className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-base font-semibold text-gray-900 truncate">
                            {group.sponsor?.name || 'Sem padrinho'}
                          </div>
                          {group.sponsor?.email && (
                            <div className="text-xs text-gray-600 truncate">{group.sponsor.email}</div>
                          )}
                        </div>
                      </button>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className="bg-white text-gray-700 border-gray-200">
                          {group.total} criança{group.total > 1 ? 's' : ''}
                        </Badge>
                        <div className="flex flex-col gap-1 w-56">
                          <StatusDistribution counts={Object.fromEntries(countByStatus(group.items))} />
                          <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
                            {countByStatus(group.items).map(([st, n]) => (
                              <span key={st} className={`inline-flex items-center gap-1 text-[11px] font-semibold ${STATUS_STYLE[st].text}`} title={STATUS_PT[st]}>
                                <span className={`w-2 h-2 rounded-full ${STATUS_STYLE[st].bar}`} />{n} {STATUS_PT[st].toLowerCase()}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Linha de ações */}
                    {open && (
                    <div className="flex flex-wrap items-center gap-2 pl-10">
                      <button
                        onClick={() =>
                          openExportModal(group.items, group.sponsor?.name || 'Sem padrinho', group.sponsor?.id)
                        }
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                        title="Exportar os apadrinhamentos deste padrinho em PDF"
                      >
                        <FileText className="w-4 h-4" /> PDF padrinho
                      </button>

                      {/* status de todos do padrinho (no filtro atual) */}
                      <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
                        <select
                          className="px-2.5 py-1.5 text-xs bg-white border-r border-gray-200 cursor-pointer outline-none"
                          value={bulkValue}
                          onChange={(e) => setBulkChoice(prev => ({ ...prev, [sid]: e.target.value as SponsorshipStatus }))}
                          disabled={bulkBusy}
                          title="Novo status para todos deste padrinho"
                        >
                          {ALL_STATUSES.map(st => <option key={st} value={st}>{STATUS_PT[st]}</option>)}
                        </select>
                        <button
                          onClick={applyBulk}
                          disabled={bulkBusy}
                          className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:text-gray-400"
                        >
                          {bulkBusy ? 'Aplicando…' : 'Aplicar a todos'}
                        </button>
                      </div>

                      <button
                        onClick={() => beginTransfer(groupIds)}
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        title="Transferir os apadrinhamentos deste padrinho"
                      >
                        <ArrowRightLeft className="w-4 h-4" /> Transferir
                      </button>

                      {group.sponsor?.id && (
                        <button
                          onClick={() => openSponsor(group.sponsor!.id)}
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                        >
                          <Eye className="w-4 h-4" /> Detalhes
                        </button>
                      )}

                      <button
                        onClick={() => beginDeleteSponsor(group)}
                        className="ml-auto inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        title="Excluir apadrinhamentos deste padrinho"
                      >
                        <Trash2 className="w-4 h-4" /> Excluir todos
                      </button>
                    </div>
                    )}
                  </div>

                  {/* Subgrupos: Cidade ➜ Comunidade */}
                  {open && (
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
                                      <li
                                        key={s.id}
                                        className={`border-l-4 ${STATUS_STYLE[s.status]?.border ?? 'border-l-gray-300'} px-4 py-3.5 transition ${checked ? 'bg-emerald-50/60' : 'hover:bg-gray-50'}`}
                                      >
                                        <div className="flex flex-col gap-2.5">
                                          {/* Linha 1: criança + status com a trilha de etapas */}
                                          <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                              <button
                                                className="p-1 rounded hover:bg-gray-100"
                                                onClick={() => toggleOne(s.id)}
                                                title={checked ? 'Desmarcar' : 'Selecionar'}
                                              >
                                                {checked ? (
                                                  <CheckSquare className="w-5 h-5 text-emerald-600" />
                                                ) : (
                                                  <Square className="w-5 h-5 text-gray-400" />
                                                )}
                                              </button>
                                              <ChildAvatar name={s.child?.name} />
                                              <div className="min-w-0">
                                                <a href={s.child ? `/admin/children/${s.child.id}` : undefined} className="text-sm font-semibold text-gray-900 hover:text-blue-700 truncate block">
                                                  {s.child?.name || '—'}
                                                </a>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                                                  <span className="font-mono">#{s.child?.publicId ?? '—'}</span>
                                                  {s.campaign?.name && <span>{s.campaign.name}{s.campaign.year ? ` (${s.campaign.year})` : ''}</span>}
                                                  <span title={`Criado em ${fmtDateBR(s.createdAt)}`}>atualizado {fmtDateBR(s.updatedAt)}</span>
                                                </div>
                                              </div>
                                            </div>

                                            <div className="flex flex-col items-end gap-1.5 w-48 shrink-0">
                                              <StatusBadge status={s.status} size="md" />
                                              <StatusSteps status={s.status} className="w-full" />
                                            </div>
                                          </div>

                                          {/* Linha 2: método/ponto de coleta + ações */}
                                          <div className="flex flex-wrap items-center justify-between gap-2 pl-11">
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
                                              <MethodBadge method={s.method ?? null} />
                                              {s.method === 'GIFT' && cp && (
                                                <span className="inline-flex items-center gap-1">
                                                  <MapPin className="w-3.5 h-3.5 text-gray-500" />
                                                  {cpLabel(s)}
                                                </span>
                                              )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <NextStepButton status={s.status} onClick={(next) => changeStatus(s.id, next)} />
                                              <StatusPicker value={s.status} onChange={(next) => changeStatus(s.id, next)} />
                                              <IconBtn title="Transferir para outro padrinho" onClick={() => beginTransfer([s.id])} className="text-emerald-700 hover:bg-emerald-50">
                                                <ArrowRightLeft className="w-4 h-4" />
                                              </IconBtn>
                                              <IconBtn title="PDF desta criança" onClick={() => openExportModal([s], `${s.child?.name || 'crianca'}`, group.sponsor?.id)}>
                                                <FileText className="w-4 h-4" />
                                              </IconBtn>
                                              {s.child && (
                                                <IconBtn title="Detalhes da criança" onClick={() => openChild(s.child!.id)}>
                                                  <Eye className="w-4 h-4" />
                                                </IconBtn>
                                              )}
                                              <IconBtn title="Ver dados brutos (model)" onClick={() => openChildModelFromRow(s.child)}>
                                                <Code2 className="w-4 h-4" />
                                              </IconBtn>
                                              <IconBtn title="Excluir apadrinhamento" onClick={() => del(s.id)} className="text-red-600 hover:bg-red-50">
                                                <Trash2 className="w-4 h-4" />
                                              </IconBtn>
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
                  )}
                </div>
              );

            })}
          </div>
        )}

      </div>

      {/* Barra da seleção */}
      {selectedCount > 0 && (
        <div className="fixed bottom-4 inset-x-0 z-50 px-4">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-2 rounded-2xl bg-gray-900 text-white shadow-2xl px-4 py-3">
            <span className="text-sm font-semibold mr-2">{selectedCount} selecionado(s)</span>
            <div className="inline-flex items-center rounded-lg bg-white/10 overflow-hidden">
              <select
                value={selStatus}
                onChange={(e) => setSelStatus(e.target.value as SponsorshipStatus)}
                disabled={selBusy}
                className="bg-transparent text-sm px-2.5 py-1.5 outline-none [&>option]:text-gray-900"
                title="Novo status para a seleção"
              >
                {ALL_STATUSES.map(st => <option key={st} value={st}>{STATUS_PT[st]}</option>)}
              </select>
              <button onClick={applySelectionStatus} disabled={selBusy} className="px-3 py-1.5 text-sm hover:bg-white/10 border-l border-white/10 disabled:opacity-50">
                Aplicar status
              </button>
            </div>
            <button
              onClick={() => beginTransfer(selectedRows.map(r => r.id))}
              disabled={selBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm disabled:opacity-50"
            >
              <ArrowRightLeft className="w-4 h-4" /> Transferir
            </button>
            <button
              onClick={exportSelection}
              disabled={selBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm disabled:opacity-50"
            >
              <FileText className="w-4 h-4" /> PDF
            </button>
            <button
              onClick={deleteSelection}
              disabled={selBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-sm disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Excluir
            </button>
            <button onClick={() => setSelectedIds({})} disabled={selBusy} className="ml-auto inline-flex items-center gap-1 text-sm text-white/70 hover:text-white">
              <X className="w-4 h-4" /> Limpar seleção
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed right-6 z-50 flex items-center gap-2 rounded-xl bg-gray-900 text-white text-sm px-4 py-3 shadow-lg ${selectedCount ? 'bottom-24' : 'bottom-6'}`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {toast}
        </div>
      )}

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
        open={!!deleteSponsor}
        title="Excluir apadrinhamentos do padrinho"
        onClose={() => { if (!deleteBusy) setDeleteSponsor(null); }}
      >
        {deleteSponsor && (() => {
          const chosen = deleteScope === 'all' ? deleteSponsor.all : deleteSponsor.visible;
          const campaignText = campaignId ? 'nesta campanha' : 'em todas as campanhas';
          const options: { key: 'visible' | 'all'; label: string; items: Sponsorship[] }[] = [
            { key: 'visible', label: 'Somente os que aparecem no filtro atual', items: deleteSponsor.visible },
            { key: 'all', label: `Todos do padrinho ${campaignText} (qualquer status)`, items: deleteSponsor.all },
          ];
          return (
            <div className="space-y-4">
              <div>
                <div className="text-base font-semibold text-gray-900">{deleteSponsor.name}</div>
                {deleteSponsor.email && <div className="text-sm text-gray-600">{deleteSponsor.email}</div>}
              </div>

              <div className="space-y-2">
                {options
                  // os dois são iguais: mostra só uma opção
                  .filter(o => o.key === 'all' || deleteSponsor.visible.length !== deleteSponsor.all.length)
                  .map(o => (
                    <label
                      key={o.key}
                      className={`block rounded-xl border px-4 py-3 cursor-pointer transition ${
                        deleteScope === o.key ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="delete-scope"
                          checked={deleteScope === o.key}
                          onChange={() => setDeleteScope(o.key)}
                          disabled={deleteBusy}
                        />
                        <span className="text-sm font-medium text-gray-900">{o.label}</span>
                        <span className="ml-auto text-sm font-semibold text-gray-700">{o.items.length}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
                        {countByStatus(o.items).map(([st, n]) => (
                          <span key={st} className="inline-flex items-center gap-1">
                            <StatusBadge status={st} /> <span className="text-xs text-gray-600">{n}</span>
                          </span>
                        ))}
                      </div>
                    </label>
                  ))}
              </div>

              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {chosen.length} apadrinhamento{chosen.length === 1 ? '' : 's'} será{chosen.length === 1 ? '' : 'ão'} excluído{chosen.length === 1 ? '' : 's'} definitivamente
                e as crianças deixam de ter este padrinho. Esta ação não pode ser desfeita.
              </p>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteSponsor(null)}
                  disabled={deleteBusy}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={applyDeleteSponsor}
                  disabled={deleteBusy || chosen.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleteBusy ? 'Excluindo…' : `Excluir ${chosen.length}`}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

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
