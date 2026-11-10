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
  Pencil,
  Building2,
  Undo2,
  Loader2,
  Store,
} from 'lucide-react';

// >>> PDF exporter
import { sponsorshipToPdfItem } from '@/lib/pdf/exportSponsorshipsPdf';
import ExportPdfDialog from '@/components/Sponsorship/ExportPdfDialog';
import { campaignLabel, useAdminCampaign } from '@/components/Admin/CampaignFilter';

// >>> Status unificado
import {
  STATUS_PT,
  type SponsorshipStatus,
} from '@/lib/sponsorship-status';
import StatusBadge, { StatusDistribution, StatusSteps } from '@/components/Sponsorship/StatusBadge';
import { FLOW_STEPS, OFF_FLOW, STATUS_STYLE, nextStatus } from '@/components/Sponsorship/statusStyle';
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

  donationAmount?: string | number | null;
  pixTxid?: string | null;
  pixPaidAt?: string | null;
};

type UserLite = SponsorLite & { phone?: string | null; roles?: string[] };

/** Edição de um apadrinhamento (forma, ponto, PIX, etapa e observação) */
type EditForm = {
  method: SponsorshipMethod;
  collectionPointId: string;
  donationAmount: string;
  pixPaidAt: string; // yyyy-mm-dd
  pixTxid: string;
  status: SponsorshipStatus;
  note: string;
};

type ViewMode = 'agrupado' | 'cidade' | 'ponto' | 'table';
const VIEW_KEY = 'admin:sponsorships:view';

// ordem do fluxo: aguardando entrega (presente) e em compra (PIX) são a mesma etapa
const ALL_STATUSES: SponsorshipStatus[] = [
  'PENDING', 'IN_PROGRESS', 'AWAITING_DELIVERY', 'IN_PURCHASE', 'PACKED', 'BOXED', 'COMPLETED', 'ENDED', 'CANCELLED',
];
// "em andamento": aprovado e ainda no caminho até a entrega (etapas 2 a 5)
const IN_FLOW: SponsorshipStatus[] = ['IN_PROGRESS', 'AWAITING_DELIVERY', 'IN_PURCHASE', 'PACKED', 'BOXED'];

/* ===================== */
/* Utils                 */
/* ===================== */
/**
 * A etapa 3 é diferente em cada forma (presente: aguardando entrega; PIX: em compra).
 * Ao trocar a forma, leva para a etapa equivalente da outra.
 */
function statusForMethod(status: SponsorshipStatus, method: SponsorshipMethod): SponsorshipStatus {
  if (method === 'PIX' && status === 'AWAITING_DELIVERY') return 'IN_PURCHASE';
  if (method === 'GIFT' && status === 'IN_PURCHASE') return 'AWAITING_DELIVERY';
  return status;
}
const moneyBR = (v?: string | number | null) =>
  v == null || v === '' || isNaN(Number(v)) ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '');
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
/** "Maria da Silva" -> "maria-da-silva" (nome do arquivo) */
function slugFile(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'apadrinhamentos';
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
/** "3 pendente · 2 concluído" com o ponto na cor de cada status */
function StatusCounts({ items }: { items: Sponsorship[] }) {
  return (
    <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
      {countByStatus(items).map(([st, n]) => (
        <span key={st} className={`inline-flex items-center gap-1 text-[11px] font-semibold ${STATUS_STYLE[st].text}`} title={STATUS_PT[st]}>
          <span className={`w-2 h-2 rounded-full ${STATUS_STYLE[st].bar}`} />{n} {STATUS_PT[st].toLowerCase()}
        </span>
      ))}
    </div>
  );
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
          {STATUS_STYLE[s].step ? `${STATUS_STYLE[s].step}. ` : '× '}{STATUS_PT[s]}{viaLabel(s)}
        </option>
      ))}
    </select>
  );
}
/** " (presente)" / " (PIX)" nos dois caminhos da etapa 3 */
function viaLabel(s: SponsorshipStatus) {
  const via = STATUS_STYLE[s]?.via;
  return via === 'GIFT' ? ' (presente)' : via === 'PIX' ? ' (PIX)' : '';
}
/**
 * Atalho para a próxima etapa (ex.: Pendente → Em andamento). De "Em andamento" segue pelo
 * método: presente no ponto → Aguardando entrega; PIX → Em compra.
 */
function NextStepButton({ status, method, onClick }: {
  status: SponsorshipStatus; method?: SponsorshipMethod | null; onClick: (next: SponsorshipStatus) => void;
}) {
  const next = nextStatus(status, method);
  if (!next) return null;
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

/**
 * Grupo que abre e fecha (cidade ou comunidade): título, quantidade, resumo dos status,
 * selecionar todos, PDF e transferir.
 */
function SubGroup({
  level, open, onToggle, title, subtitle, items, selected, onSelect, onPdf, onTransfer, children, icon,
}: {
  level: 'top' | 'city' | 'community';
  /** ícone no lugar do padrão (ex.: ponto de coleta) */
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  title: string;
  subtitle?: string;
  items: Sponsorship[];
  selected: boolean;
  onSelect: (on: boolean) => void;
  onPdf: () => void;
  onTransfer: () => void;
  children: React.ReactNode;
}) {
  const big = level === 'top';
  const Icon = level === 'community' ? Users : MapPin;
  return (
    <div className={`${big ? 'bg-white/80 rounded-2xl shadow-sm border border-gray-100' : 'rounded-xl border border-gray-200 bg-white'} overflow-hidden`}>
      <div className={`flex flex-wrap items-center gap-2 px-3 sm:px-4 ${big ? 'py-3 bg-gray-50' : 'py-2 bg-gray-50/70'} ${open ? 'border-b border-gray-200' : ''}`}>
        <button className="p-1 rounded hover:bg-gray-100 shrink-0" onClick={() => onSelect(!selected)} title={selected ? 'Desmarcar todos' : 'Selecionar todos'}>
          {selected ? <CheckSquare className="w-5 h-5 text-emerald-600" /> : <Square className="w-5 h-5 text-gray-400" />}
        </button>
        <button onClick={onToggle} className="flex flex-1 min-w-0 items-center gap-2 text-left" aria-expanded={open}>
          {open ? <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />}
          {icon ?? <Icon className={`w-4 h-4 shrink-0 ${level === 'community' ? 'text-teal-600' : 'text-indigo-600'}`} />}
          <span className="min-w-0">
            <span className={`block truncate ${big ? 'text-base font-semibold' : 'text-sm font-semibold'} text-gray-900`}>{title}</span>
            {subtitle && <span className="block text-xs text-gray-500 truncate">{subtitle}</span>}
          </span>
        </button>
        <Badge className="shrink-0 bg-white text-gray-700 border-gray-200">{items.length}</Badge>
        <div className="hidden md:block w-44 shrink-0">
          <StatusDistribution counts={Object.fromEntries(countByStatus(items))} className="h-1.5" />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <IconBtn title="PDF deste grupo" onClick={onPdf}><FileText className="w-4 h-4" /></IconBtn>
          <IconBtn title="Transferir os apadrinhamentos deste grupo" onClick={onTransfer} className="text-emerald-700 hover:bg-emerald-50">
            <ArrowRightLeft className="w-4 h-4" />
          </IconBtn>
        </div>
      </div>
      {!open && (
        <div className="px-3 sm:px-4 py-1.5 pl-12 bg-white">
          <StatusCounts items={items} />
        </div>
      )}
      {open && <div className={level === 'community' ? '' : 'p-2 sm:p-3 space-y-2'}>{children}</div>}
    </div>
  );
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
  // modo de visualização, lembrado neste navegador
  const [viewMode, setViewModeState] = useState<ViewMode>('agrupado');
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === 'agrupado' || v === 'cidade' || v === 'ponto' || v === 'table') setViewModeState(v);
    } catch {}
  }, []);
  function setViewMode(v: ViewMode) {
    setViewModeState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch {}
  }

  // edição de um apadrinhamento
  const [editing, setEditing] = useState<Sponsorship | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  // forma de apadrinhamento em lote (seleção)
  const [methodBulkOpen, setMethodBulkOpen] = useState(false);
  const [methodBulk, setMethodBulk] = useState<{ method: SponsorshipMethod; collectionPointId: string }>({ method: 'GIFT', collectionPointId: '' });

  // estado para ação em massa por padrinho
  const [bulkChoice, setBulkChoice] = useState<Record<string, SponsorshipStatus>>({});
  const [bulkLoading, setBulkLoading] = useState<Record<string, boolean>>({});

  // ===== Export PDF (admin por padrinho)
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSponsor, setExportSponsor] = useState<{ id: string; name: string } | null>(null);
  const [exportItems, setExportItems] = useState<Sponsorship[]>([]);

  // ===== Transferência
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferIds, setTransferIds] = useState<string[]>([]);
  const [destQuery, setDestQuery] = useState('');
  const [destSponsor, setDestSponsor] = useState<UserLite | null>(null);
  // todos os usuários (a busca é feita aqui: sem diferença de acento, por nome, e-mail ou telefone)
  const [users, setUsers] = useState<UserLite[] | null>(null);
  const [usersError, setUsersError] = useState(false);
  // última transferência, para poder desfazer
  const [lastTransfer, setLastTransfer] = useState<{ label: string; groups: { toSponsorId: string; ids: string[] }[] } | null>(null);

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
  // cidades e comunidades dentro dos grupos (abertas até alguém fechar)
  const [openNested, setOpenNested] = useState<Record<string, boolean>>({});
  const [nestedDefaultOpen, setNestedDefaultOpen] = useState(true);
  function setAllGroupsOpen(open: boolean) {
    setOpenGroups({});
    setGroupsDefaultOpen(open);
    setOpenNested({});
    setNestedDefaultOpen(open);
  }
  const isNestedOpen = (key: string) => openNested[key] ?? nestedDefaultOpen;
  const toggleNested = (key: string) => setOpenNested((prev) => ({ ...prev, [key]: !(prev[key] ?? nestedDefaultOpen) }));

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
  /* ===== Editar apadrinhamento ===== */
  function beginEdit(s: Sponsorship) {
    setEditing(s);
    setEditForm({
      method: (s.method as SponsorshipMethod) ?? 'GIFT',
      collectionPointId: s.collectionPointId ?? s.collectionPoint?.id ?? '',
      donationAmount: s.donationAmount != null && s.donationAmount !== '' ? String(Number(s.donationAmount)) : '',
      pixPaidAt: s.pixPaidAt ? new Date(s.pixPaidAt).toISOString().slice(0, 10) : '',
      pixTxid: s.pixTxid ?? '',
      status: s.status,
      note: s.note ?? '',
    });
  }
  /** Campos alterados, no formato do backend; null = nada mudou */
  function editPayload(s: Sponsorship, f: EditForm) {
    const body: Record<string, unknown> = {};
    if (f.method !== s.method) body.method = f.method;
    const cp = f.method === 'GIFT' ? f.collectionPointId || null : null;
    if (cp !== (s.collectionPointId ?? null)) body.collectionPointId = cp;
    if (f.status !== s.status) body.status = f.status;
    if ((f.note ?? '') !== (s.note ?? '')) body.note = f.note;
    if (f.method === 'PIX') {
      const amount = f.donationAmount.trim() ? Number(f.donationAmount.replace(',', '.')) : null;
      if (amount != null && !isNaN(amount) && amount !== Number(s.donationAmount ?? NaN)) body.donationAmount = amount;
      if (f.pixPaidAt && f.pixPaidAt !== (s.pixPaidAt ? new Date(s.pixPaidAt).toISOString().slice(0, 10) : '')) body.pixPaidAt = `${f.pixPaidAt}T12:00:00.000Z`;
      if (f.pixTxid.trim() !== (s.pixTxid ?? '')) body.pixTxid = f.pixTxid.trim();
    }
    return Object.keys(body).length ? body : null;
  }
  /** Atualiza a linha na tela com o que o backend gravou (sem recarregar tudo) */
  function mergeSaved(id: string, saved: any) {
    setAllRows((prev) => prev.map((r) => (r.id === id ? {
      ...r,
      method: saved.method ?? r.method,
      status: saved.status ?? r.status,
      note: saved.note ?? null,
      collectionPointId: saved.collectionPointId ?? null,
      collectionPoint: saved.collectionPoint ?? null,
      donationAmount: saved.donationAmount ?? null,
      pixTxid: saved.pixTxid ?? null,
      pixPaidAt: saved.pixPaidAt ?? null,
      startDate: saved.startDate ?? r.startDate,
      endDate: saved.endDate ?? r.endDate,
      updatedAt: saved.updatedAt ?? r.updatedAt,
    } : r)));
  }
  async function saveEdit() {
    if (!editing || !editForm) return;
    if (editForm.method === 'GIFT' && !editForm.collectionPointId) { alert('Escolha o ponto de coleta do presente.'); return; }
    const body = editPayload(editing, editForm);
    if (!body) { setEditing(null); return; }
    setEditBusy(true);
    try {
      const r = await fetch(`/api/admin/sponsorships/${editing.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) { alert(`Falha ao salvar: ${await errorMessage(r)}`); return; }
      mergeSaved(editing.id, await r.json());
      setToast('Apadrinhamento atualizado.');
      setEditing(null);
    } finally {
      setEditBusy(false);
    }
  }

  /** Mesma forma (e ponto de coleta) para a seleção; a etapa 3 acompanha a forma */
  async function applyMethodBulk() {
    if (methodBulk.method === 'GIFT' && !methodBulk.collectionPointId) { alert('Escolha o ponto de coleta.'); return; }
    const targets = selectedRows;
    if (!confirm(`Mudar para ${methodBulk.method === 'PIX' ? 'PIX' : 'presente no ponto'} os ${targets.length} apadrinhamento(s) selecionado(s)?`)) return;
    setSelBusy(true);
    let ok = 0;
    try {
      for (let i = 0; i < targets.length; i += 6) {
        await Promise.all(targets.slice(i, i + 6).map(async (s) => {
          const status = statusForMethod(s.status, methodBulk.method);
          const body: Record<string, unknown> = {
            method: methodBulk.method,
            collectionPointId: methodBulk.method === 'GIFT' ? methodBulk.collectionPointId : null,
            ...(status !== s.status ? { status } : {}),
          };
          const r = await fetch(`/api/admin/sponsorships/${s.id}`, {
            method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
          });
          if (r.ok) { mergeSaved(s.id, await r.json()); ok++; }
        }));
      }
    } finally {
      setSelBusy(false);
      setMethodBulkOpen(false);
      if (ok < targets.length) alert(`${targets.length - ok} de ${targets.length} não puderam ser alterados.`);
      else setToast(`${ok} apadrinhamento(s) agora ${methodBulk.method === 'PIX' ? 'em PIX' : 'com presente no ponto'}.`);
    }
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

  /* ===== Agrupamento (Cidade → Comunidade) ===== */
  const groupedByCity = useMemo(() => {
    const cityMap = new Map<string, Map<string, Sponsorship[]>>();
    for (const it of visibleRows) {
      const city = deriveCityName(it);
      const comm = cityMap.get(city) ?? new Map<string, Sponsorship[]>();
      const community = deriveCommunityName(it);
      comm.set(community, [...(comm.get(community) ?? []), it]);
      cityMap.set(city, comm);
    }
    return [...cityMap.entries()]
      .map(([city, comm]) => {
        const byCommunity = [...comm.entries()]
          .map(([community, items]) => ({
            community,
            items: items.sort((a, b) => (a.child?.name || '').localeCompare(b.child?.name || '', 'pt-BR')),
          }))
          .sort((a, b) => a.community.localeCompare(b.community, 'pt-BR'));
        return { city, items: byCommunity.flatMap((c) => c.items), byCommunity };
      })
      .sort((a, b) => a.city.localeCompare(b.city, 'pt-BR'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRows]);

  /* ===== Agrupamento (Ponto de coleta → Cidade → Comunidade) ===== */
  // PIX e presente ainda sem ponto ficam em grupos próprios, no fim
  const groupedByPoint = useMemo(() => {
    const NO_POINT = '__sem_ponto__', PIX = '__pix__';
    const pointMap = new Map<string, Sponsorship[]>();
    for (const it of visibleRows) {
      const k = it.method === 'PIX' ? PIX : resolveCP(it)?.id ?? NO_POINT;
      pointMap.set(k, [...(pointMap.get(k) ?? []), it]);
    }
    const nest = (items: Sponsorship[]) => {
      const cityMap = new Map<string, Map<string, Sponsorship[]>>();
      for (const it of items) {
        const comm = cityMap.get(deriveCityName(it)) ?? new Map<string, Sponsorship[]>();
        const c = deriveCommunityName(it);
        comm.set(c, [...(comm.get(c) ?? []), it]);
        cityMap.set(deriveCityName(it), comm);
      }
      return [...cityMap.entries()]
        .map(([city, comm]) => {
          const byCommunity = [...comm.entries()]
            .map(([community, list]) => ({
              community,
              items: list.sort((a, b) => (a.child?.name || '').localeCompare(b.child?.name || '', 'pt-BR')),
            }))
            .sort((a, b) => a.community.localeCompare(b.community, 'pt-BR'));
          return { city, items: byCommunity.flatMap((c) => c.items), byCommunity };
        })
        .sort((a, b) => a.city.localeCompare(b.city, 'pt-BR'));
    };
    return [...pointMap.entries()]
      .map(([key, items]) => {
        const cp = key === PIX || key === NO_POINT ? null : resolveCP(items[0]);
        const where = cp ? [cp.address, cp.district, cp.cityName ? `${cp.cityName}${cp.state ? `/${cp.state}` : ''}` : ''].filter(Boolean).join(' · ') : '';
        return {
          key,
          kind: key === PIX ? ('pix' as const) : key === NO_POINT ? ('none' as const) : ('point' as const),
          title: key === PIX ? 'PIX (sem entrega em ponto)' : key === NO_POINT ? 'Presente sem ponto de coleta' : cp?.name ?? 'Ponto de coleta',
          where,
          items,
          byCity: nest(items),
        };
      })
      .sort((a, b) => (a.kind === 'point' ? 0 : a.kind === 'none' ? 1 : 2) - (b.kind === 'point' ? 0 : b.kind === 'none' ? 1 : 2) || a.title.localeCompare(b.title, 'pt-BR'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRows, cpMap]);

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
    setTransferOpen(true);
    if (!users) loadUsers();
  }
  async function loadUsers() {
    setUsersError(false);
    try {
      const r = await fetch('/api/admin/users', { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error();
      const js = await r.json();
      setUsers(Array.isArray(js?.items) ? js.items : Array.isArray(js) ? js : []);
    } catch {
      setUsersError(true);
      setUsers([]);
    }
  }
  // quantos apadrinhamentos cada padrinho já tem nesta lista (ajuda a escolher o destino)
  const countBySponsor = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of allRows) if (r.sponsor?.id) m.set(r.sponsor.id, (m.get(r.sponsor.id) ?? 0) + 1);
    return m;
  }, [allRows]);
  const transferRows = useMemo(() => allRows.filter((r) => transferIds.includes(r.id)), [allRows, transferIds]);
  const transferFrom = useMemo(() => {
    const m = new Map<string, { sponsor: SponsorLite | null; n: number }>();
    for (const r of transferRows) {
      const k = r.sponsor?.id ?? '';
      m.set(k, { sponsor: r.sponsor ?? null, n: (m.get(k)?.n ?? 0) + 1 });
    }
    return [...m.values()];
  }, [transferRows]);
  // busca: palavras em qualquer ordem, sem acento; telefone pelos dígitos
  const destMatches = useMemo(() => {
    const q = normalizeText(destQuery);
    if (!users || q.length < 2) return [];
    const words = q.split(' ').filter(Boolean);
    const qDigits = digits(destQuery);
    return users
      .filter((u) => {
        const text = normalizeText(`${u.name} ${u.email ?? ''}`);
        return words.every((w) => text.includes(w)) || (qDigits.length >= 4 && digits(u.phone).includes(qDigits));
      })
      .sort((a, b) => (countBySponsor.get(b.id) ?? 0) - (countBySponsor.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, 30);
  }, [users, destQuery, countBySponsor]);

  async function applyTransfer() {
    if (!transferIds.length || !destSponsor?.id) return;
    const moving = transferRows.filter((r) => r.sponsor?.id !== destSponsor.id);
    if (!moving.length) { alert('Esses apadrinhamentos já são deste padrinho.'); return; }
    setTransferBusy(true);
    try {
      const res = await fetch('/api/admin/sponsorships/transfer', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sponsorshipIds: moving.map((r) => r.id), toSponsorId: destSponsor.id }),
      });
      if (!res.ok) {
        alert(`Falha ao transferir: ${await errorMessage(res)}`);
        return;
      }
      // para desfazer: cada apadrinhamento volta para o padrinho de antes
      const back = new Map<string, string[]>();
      for (const r of moving) if (r.sponsor?.id) back.set(r.sponsor.id, [...(back.get(r.sponsor.id) ?? []), r.id]);
      setLastTransfer({
        label: `${moving.length} apadrinhamento(s) transferido(s) para ${destSponsor.name}.`,
        groups: [...back.entries()].map(([toSponsorId, ids]) => ({ toSponsorId, ids })),
      });
      setTransferOpen(false);
      setTransferIds([]);
      setSelectedIds({});
      await load();
    } finally {
      setTransferBusy(false);
    }
  }
  async function undoTransfer() {
    if (!lastTransfer) return;
    const groups = lastTransfer.groups;
    setLastTransfer(null);
    const results = await Promise.all(groups.map((g) => fetch('/api/admin/sponsorships/transfer', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sponsorshipIds: g.ids, toSponsorId: g.toSponsorId }),
    })));
    if (results.some((r) => !r.ok)) alert('Não foi possível desfazer toda a transferência.');
    else setToast('Transferência desfeita.');
    await load();
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

  /** Uma criança apadrinhada (visões agrupadas): status, forma, ponto e ações */
  function renderItem(s: Sponsorship, opts: { showSponsor?: boolean; sponsorId?: string }) {
    const cp = resolveCP(s);
    const checked = isSelected(s.id);
    return (
      <li
        key={s.id}
        className={`border-l-4 ${STATUS_STYLE[s.status]?.border ?? 'border-l-gray-300'} px-3 sm:px-4 py-3 sm:py-3.5 transition ${checked ? 'bg-emerald-50/60' : 'hover:bg-gray-50'}`}
      >
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button className="p-1 rounded hover:bg-gray-100" onClick={() => toggleOne(s.id)} title={checked ? 'Desmarcar' : 'Selecionar'}>
                {checked ? <CheckSquare className="w-5 h-5 text-emerald-600" /> : <Square className="w-5 h-5 text-gray-400" />}
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
                {opts.showSponsor && (
                  <button
                    onClick={() => s.sponsor && openSponsor(s.sponsor.id)}
                    className="mt-0.5 inline-flex items-center gap-1 text-xs text-blue-700 hover:underline max-w-full"
                    title="Ver detalhes do padrinho"
                  >
                    <UserCheck className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{s.sponsor?.name || 'Sem padrinho'}{s.sponsor?.email ? ` · ${s.sponsor.email}` : ''}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-1.5 w-full sm:w-48 sm:shrink-0 pl-11 sm:pl-0">
              <StatusBadge status={s.status} size="md" />
              <StatusSteps status={s.status} className="w-full" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 sm:pl-11">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
              <MethodBadge method={s.method ?? null} />
              {s.method === 'GIFT' && cp && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-500" />
                  {cpLabel(s)}
                </span>
              )}
              {s.method === 'PIX' && s.donationAmount != null && <span>{moneyBR(s.donationAmount)}{s.pixPaidAt ? ` · pago em ${fmtDateBR(s.pixPaidAt)}` : ''}</span>}
              {s.note && <span className="italic text-gray-500 truncate max-w-[16rem]" title={s.note}>“{s.note}”</span>}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <NextStepButton status={s.status} method={s.method} onClick={(next) => changeStatus(s.id, next)} />
              <StatusPicker value={s.status} onChange={(next) => changeStatus(s.id, next)} />
              <IconBtn title="Editar forma, ponto de coleta, PIX e observação" onClick={() => beginEdit(s)}>
                <Pencil className="w-4 h-4" />
              </IconBtn>
              <IconBtn title="Transferir para outro padrinho" onClick={() => beginTransfer([s.id])} className="text-emerald-700 hover:bg-emerald-50">
                <ArrowRightLeft className="w-4 h-4" />
              </IconBtn>
              <IconBtn title="PDF desta criança" onClick={() => openExportModal([s], `${s.child?.name || 'crianca'}`, opts.sponsorId ?? s.sponsor?.id)}>
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
          {st.step && <span className="text-[10px] font-bold text-gray-400 text-right leading-tight">ETAPA {st.step}{st.via && <span className="block font-semibold">{st.via === 'GIFT' ? 'PRESENTE' : 'PIX'}</span>}</span>}
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
              <button onClick={() => setStatusFilters(IN_FLOW)} className={chipCls(sameStatuses(statusFilters, IN_FLOW))} title="Etapas 2 a 5: aprovado, aguardando entrega/em compra, embalado e encaixotado">
                Em andamento <span className={countCls(sameStatuses(statusFilters, IN_FLOW))}>{sumOf(IN_FLOW)}</span>
              </button>
            </div>
          </div>

          <StatusDistribution counts={countsAll} onSelect={(s) => setStatusFilters([s])} className="h-3" />

          {/* celular: faixa que rola de lado (com encerrado/cancelado no fim); a partir do tablet, grade */}
          <div className="sm:hidden -mx-4 px-4 flex gap-2 overflow-x-auto no-scrollbar snap-x pb-1">
            {[...FLOW_STEPS, ...OFF_FLOW].map(s => (
              <div key={s} className="snap-start shrink-0 w-32"><StepTile s={s} compact /></div>
            ))}
          </div>
          <div className="hidden sm:grid grid-cols-4 lg:grid-cols-7 gap-2">
            {FLOW_STEPS.map(s => <StepTile key={s} s={s} />)}
          </div>

          <div className="hidden sm:flex flex-wrap items-center gap-2 pt-1">
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
              {([
                ['agrupado', 'Por padrinho', <Users key="i" className="w-4 h-4" />],
                ['cidade', 'Por cidade', <Building2 key="i" className="w-4 h-4" />],
                ['ponto', 'Por ponto de coleta', <Store key="i" className="w-4 h-4" />],
                ['table', 'Tabela', <LayoutList key="i" className="w-4 h-4" />],
              ] as const).map(([mode, label, icon]) => (
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
            {viewMode !== 'table' && (viewMode === 'agrupado' ? groupedBySponsor.length > 1 : viewMode === 'ponto' ? groupedByPoint.length > 0 : groupedByCity.length > 0) && (
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
                            <NextStepButton status={s.status} method={s.method} onClick={(next) => changeStatus(s.id, next)} />
                            <StatusPicker value={s.status} onChange={(next) => changeStatus(s.id, next)} />
                            <IconBtn title="Editar forma, ponto de coleta, PIX e observação" onClick={() => beginEdit(s)}>
                              <Pencil className="w-4 h-4" />
                            </IconBtn>
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
        ) : viewMode === 'ponto' ? (
          /* === POR PONTO DE COLETA (Ponto → Cidade → Comunidade), com o padrinho em cada criança === */
          <div className="space-y-4">
            {loading && (
              <div className="bg-white/70 rounded-2xl border border-white/20 shadow-lg p-10 text-center">
                <div className="mx-auto w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <p className="mt-3 text-gray-500 font-medium">Carregando apadrinhamentos...</p>
              </div>
            )}
            {!loading && noRows && (
              <div className="bg-white/70 rounded-2xl border border-white/20 shadow-lg p-10 text-center text-gray-500">
                Nenhum apadrinhamento encontrado. Tente ajustar os filtros.
              </div>
            )}
            {!loading && !noRows && groupedByPoint.map((pg) => {
              const pointKey = `point|${pg.key}`;
              const sponsorsHere = new Set(pg.items.map((x) => x.sponsor?.id)).size;
              const icon =
                pg.kind === 'pix' ? <QrCode className="w-4 h-4 shrink-0 text-indigo-600" />
                  : pg.kind === 'none' ? <Gift className="w-4 h-4 shrink-0 text-amber-600" />
                  : <Store className="w-4 h-4 shrink-0 text-emerald-600" />;
              return (
                <SubGroup
                  key={pointKey}
                  level="top"
                  icon={icon}
                  open={isNestedOpen(pointKey)}
                  onToggle={() => toggleNested(pointKey)}
                  title={pg.title}
                  subtitle={[pg.where, `${sponsorsHere} padrinho${sponsorsHere === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                  items={pg.items}
                  selected={pg.items.every((x) => isSelected(x.id))}
                  onSelect={(on) => selectMany(pg.items.map((x) => x.id), on)}
                  onPdf={() => openExportModal(pg.items, pg.title)}
                  onTransfer={() => beginTransfer(pg.items.map((x) => x.id))}
                >
                  {pg.kind === 'none' && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Presente sem ponto de coleta definido: use o lápis (editar) em cada criança, ou selecione e use &quot;Forma&quot; para escolher o ponto.
                    </p>
                  )}
                  {pg.byCity.map((cityGroup) => {
                    const cityKey = `${pointKey}|${cityGroup.city}`;
                    return (
                      <SubGroup
                        key={cityKey}
                        level="city"
                        open={isNestedOpen(cityKey)}
                        onToggle={() => toggleNested(cityKey)}
                        title={cityGroup.city}
                        items={cityGroup.items}
                        selected={cityGroup.items.every((x) => isSelected(x.id))}
                        onSelect={(on) => selectMany(cityGroup.items.map((x) => x.id), on)}
                        onPdf={() => openExportModal(cityGroup.items, `${pg.title} - ${cityGroup.city}`)}
                        onTransfer={() => beginTransfer(cityGroup.items.map((x) => x.id))}
                      >
                        {cityGroup.byCommunity.map((comm) => {
                          const commKey = `${cityKey}|${comm.community}`;
                          return (
                            <SubGroup
                              key={commKey}
                              level="community"
                              open={isNestedOpen(commKey)}
                              onToggle={() => toggleNested(commKey)}
                              title={comm.community}
                              items={comm.items}
                              selected={comm.items.every((x) => isSelected(x.id))}
                              onSelect={(on) => selectMany(comm.items.map((x) => x.id), on)}
                              onPdf={() => openExportModal(comm.items, `${pg.title} - ${cityGroup.city} - ${comm.community}`)}
                              onTransfer={() => beginTransfer(comm.items.map((x) => x.id))}
                            >
                              <ul className="divide-y divide-gray-100">
                                {comm.items.map((s) => renderItem(s, { showSponsor: true }))}
                              </ul>
                            </SubGroup>
                          );
                        })}
                      </SubGroup>
                    );
                  })}
                </SubGroup>
              );
            })}
          </div>
        ) : viewMode === 'cidade' ? (
          /* === POR CIDADE (Cidade → Comunidade), com o padrinho em cada criança === */
          <div className="space-y-4">
            {loading && (
              <div className="bg-white/70 rounded-2xl border border-white/20 shadow-lg p-10 text-center">
                <div className="mx-auto w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <p className="mt-3 text-gray-500 font-medium">Carregando apadrinhamentos...</p>
              </div>
            )}
            {!loading && noRows && (
              <div className="bg-white/70 rounded-2xl border border-white/20 shadow-lg p-10 text-center text-gray-500">
                Nenhum apadrinhamento encontrado. Tente ajustar os filtros.
              </div>
            )}
            {!loading && !noRows && groupedByCity.map((cityGroup) => {
              const cityKey = `city|${cityGroup.city}`;
              const sponsorsHere = new Set(cityGroup.items.map((x) => x.sponsor?.id)).size;
              return (
                <SubGroup
                  key={cityKey}
                  level="top"
                  open={isNestedOpen(cityKey)}
                  onToggle={() => toggleNested(cityKey)}
                  title={cityGroup.city}
                  subtitle={`${sponsorsHere} padrinho${sponsorsHere === 1 ? '' : 's'} · ${cityGroup.byCommunity.length} comunidade${cityGroup.byCommunity.length === 1 ? '' : 's'}`}
                  items={cityGroup.items}
                  selected={cityGroup.items.every((x) => isSelected(x.id))}
                  onSelect={(on) => selectMany(cityGroup.items.map((x) => x.id), on)}
                  onPdf={() => openExportModal(cityGroup.items, cityGroup.city)}
                  onTransfer={() => beginTransfer(cityGroup.items.map((x) => x.id))}
                >
                  {cityGroup.byCommunity.map((comm) => {
                    const commKey = `${cityKey}|${comm.community}`;
                    return (
                      <SubGroup
                        key={commKey}
                        level="community"
                        open={isNestedOpen(commKey)}
                        onToggle={() => toggleNested(commKey)}
                        title={comm.community}
                        items={comm.items}
                        selected={comm.items.every((x) => isSelected(x.id))}
                        onSelect={(on) => selectMany(comm.items.map((x) => x.id), on)}
                        onPdf={() => openExportModal(comm.items, `${cityGroup.city} - ${comm.community}`)}
                        onTransfer={() => beginTransfer(comm.items.map((x) => x.id))}
                      >
                        <ul className="divide-y divide-gray-100">
                          {comm.items.map((s) => renderItem(s, { showSponsor: true }))}
                        </ul>
                      </SubGroup>
                    );
                  })}
                </SubGroup>
              );
            })}
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
                  <div className={`flex flex-col gap-2.5 sm:gap-3 px-3 sm:px-5 py-3 sm:py-4 bg-gray-50 ${open ? 'border-b border-gray-100' : ''}`}>
                    {/* linha 1: seleção + nome (sempre com espaço) + total */}
                    <div className="flex items-center gap-2 sm:gap-3">
                      <button
                        className="p-1 rounded hover:bg-gray-100 shrink-0"
                        onClick={() => selectMany(groupIds, !groupSelected)}
                        title={groupSelected ? 'Desmarcar padrinho' : 'Selecionar todos deste padrinho'}
                      >
                        {groupSelected ? <CheckSquare className="w-5 h-5 text-emerald-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                      </button>
                      <button
                        onClick={() => setOpenGroups(prev => ({ ...prev, [sid]: !open }))}
                        className="flex flex-1 min-w-0 items-center gap-2 sm:gap-3 text-left"
                        aria-expanded={open}
                      >
                        {open ? <ChevronDown className="w-5 h-5 text-gray-500 shrink-0" /> : <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />}
                        <div className="hidden sm:block p-2 bg-blue-100 rounded-lg shrink-0">
                          <UserCheck className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                            {group.sponsor?.name || 'Sem padrinho'}
                          </div>
                          {group.sponsor?.email && (
                            <div className="text-xs text-gray-600 truncate">{group.sponsor.email}</div>
                          )}
                        </div>
                      </button>
                      <Badge className="shrink-0 bg-white text-gray-700 border-gray-200">
                        {group.total} <span className="hidden sm:inline">&nbsp;criança{group.total > 1 ? 's' : ''}</span>
                      </Badge>
                      {/* computador: resumo dos status ao lado do nome */}
                      <div className="hidden md:flex flex-col gap-1 w-56 shrink-0">
                        <StatusDistribution counts={Object.fromEntries(countByStatus(group.items))} />
                        <StatusCounts items={group.items} />
                      </div>
                    </div>

                    {/* celular: resumo dos status embaixo, na largura toda */}
                    <div className="md:hidden flex flex-col gap-1 pl-8">
                      <StatusDistribution counts={Object.fromEntries(countByStatus(group.items))} className="h-1.5" />
                      <StatusCounts items={group.items} />
                    </div>

                    {/* Linha de ações */}
                    {open && (
                    <div className="flex flex-wrap items-center gap-2 sm:pl-10">
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

                  {/* Subgrupos: Cidade ➜ Comunidade, cada um abre e fecha */}
                  {open && (
                  <div className="p-2 sm:p-5 space-y-3">
                    {group.byCity.map((cityGroup) => {
                      const cityKey = `${sid}|${cityGroup.city}`;
                      const cityItems = cityGroup.byCommunity.flatMap((c) => c.items);
                      return (
                        <SubGroup
                          key={cityKey}
                          level="city"
                          open={isNestedOpen(cityKey)}
                          onToggle={() => toggleNested(cityKey)}
                          title={cityGroup.city}
                          items={cityItems}
                          selected={cityItems.every((x) => isSelected(x.id))}
                          onSelect={(on) => selectMany(cityItems.map((x) => x.id), on)}
                          onPdf={() => openExportModal(cityItems, `${group.sponsor?.name || 'Sem padrinho'} - ${cityGroup.city}`, group.sponsor?.id)}
                          onTransfer={() => beginTransfer(cityItems.map((x) => x.id))}
                        >
                          {cityGroup.byCommunity.map((comm) => {
                            const commKey = `${cityKey}|${comm.community}`;
                            return (
                              <SubGroup
                                key={commKey}
                                level="community"
                                open={isNestedOpen(commKey)}
                                onToggle={() => toggleNested(commKey)}
                                title={comm.community}
                                items={comm.items}
                                selected={comm.items.every((x) => isSelected(x.id))}
                                onSelect={(on) => selectMany(comm.items.map((x) => x.id), on)}
                                onPdf={() => openExportModal(comm.items, `${group.sponsor?.name || 'Sem padrinho'} - ${cityGroup.city} - ${comm.community}`, group.sponsor?.id)}
                                onTransfer={() => beginTransfer(comm.items.map((x) => x.id))}
                              >
                                <ul className="divide-y divide-gray-100">
                                  {comm.items.map((s) => renderItem(s, { sponsorId: group.sponsor?.id }))}
                                </ul>
                              </SubGroup>
                            );
                          })}
                        </SubGroup>
                      );
                    })}
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
              onClick={() => setMethodBulkOpen(true)}
              disabled={selBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm disabled:opacity-50"
            >
              <Pencil className="w-4 h-4" /> Forma
            </button>
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
      {lastTransfer && (
        <div className={`fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl bg-gray-900 text-white text-sm px-4 py-3 shadow-lg max-w-[calc(100%-2rem)] ${selectedCount ? 'bottom-24' : 'bottom-6'}`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{lastTransfer.label}</span>
          <button onClick={undoTransfer} className="inline-flex items-center gap-1 font-semibold text-emerald-300 hover:text-emerald-200">
            <Undo2 className="w-4 h-4" /> Desfazer
          </button>
          <button onClick={() => setLastTransfer(null)} className="text-white/60 hover:text-white" aria-label="Fechar"><X className="w-4 h-4" /></button>
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
          {/* o que vai ser transferido */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">De</div>
            <div className="flex flex-wrap gap-1.5">
              {transferFrom.map(({ sponsor, n }) => (
                <span key={sponsor?.id ?? '-'} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-gray-200 text-sm">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" /> {sponsor?.name || 'Sem padrinho'} <b className="text-gray-600">{n}</b>
                </span>
              ))}
            </div>
            <div className="text-xs text-gray-600 line-clamp-2">
              {transferRows.slice(0, 12).map((r) => `${r.child?.publicId ?? ''} ${r.child?.name ?? ''}`.trim()).join(' · ')}
              {transferRows.length > 12 && ` · e mais ${transferRows.length - 12}`}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Para</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={destQuery}
                onChange={e => { setDestQuery(e.target.value); setDestSponsor(null); }}
                placeholder="Nome, e-mail ou telefone do padrinho"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg bg-white"
                disabled={transferBusy}
                autoFocus
              />
            </div>
            {users === null && <div className="text-xs text-gray-500 mt-2 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Carregando padrinhos…</div>}
            {usersError && (
              <div className="text-xs text-red-700 mt-2">Não foi possível carregar os usuários. <button onClick={loadUsers} className="underline">Tentar de novo</button></div>
            )}
            {destMatches.length > 0 && (
              <ul className="mt-2 max-h-64 overflow-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {destMatches.map(u => {
                  const isSource = transferFrom.length === 1 && transferFrom[0].sponsor?.id === u.id;
                  const n = countBySponsor.get(u.id) ?? 0;
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => setDestSponsor(u)}
                        disabled={isSource}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-3 ${destSponsor?.id === u.id ? 'bg-emerald-50' : 'hover:bg-gray-50'} disabled:opacity-50`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 truncate">{u.name}</div>
                          <div className="text-xs text-gray-600 truncate">{[u.email, u.phone].filter(Boolean).join(' · ')}</div>
                        </div>
                        <span className="text-xs text-gray-500 shrink-0">
                          {isSource ? 'é o padrinho atual' : n ? `${n} apadrinhamento${n === 1 ? '' : 's'}` : 'sem apadrinhamentos aqui'}
                        </span>
                        {destSponsor?.id === u.id && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {users && normalizeText(destQuery).length >= 2 && destMatches.length === 0 && (
              <div className="text-xs text-gray-500 mt-2">Nenhum usuário encontrado. O padrinho precisa ter cadastro no site.</div>
            )}
          </div>

          {!!destSponsor && (
            <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {transferRows.filter((r) => r.sponsor?.id !== destSponsor.id).length} apadrinhamento(s) passa(m) para <b>{destSponsor.name}</b>
              {destSponsor.email ? ` (${destSponsor.email})` : ''}. Status, forma e ponto de coleta continuam iguais.
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

      {/* Modal: editar apadrinhamento */}
      <Modal
        open={!!editing && !!editForm}
        title="Editar apadrinhamento"
        onClose={() => { if (!editBusy) setEditing(null); }}
      >
        {editing && editForm && (() => {
          const f = editForm;
          const set = (patch: Partial<EditForm>) => setEditForm((prev) => (prev ? { ...prev, ...patch } : prev));
          const changeMethod = (method: SponsorshipMethod) => {
            const status = statusForMethod(f.status, method);
            set({ method, status, collectionPointId: method === 'GIFT' ? f.collectionPointId || editing.collectionPointId || '' : f.collectionPointId });
          };
          const adjusted = f.method !== editing.method && f.status !== editing.status && statusForMethod(editing.status, f.method) === f.status;
          return (
            <div className="space-y-5">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                <div className="font-semibold text-gray-900">{editing.child?.publicId ? `${editing.child.publicId} · ` : ''}{editing.child?.name ?? '—'}</div>
                <div className="text-gray-600 text-xs">Padrinho: {editing.sponsor?.name ?? '—'}{editing.sponsor?.email ? ` · ${editing.sponsor.email}` : ''}</div>
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-800 mb-2">Forma de apadrinhamento</div>
                <div className="grid grid-cols-2 gap-2">
                  {([['GIFT', 'Presente no ponto', <Gift key="i" className="w-4 h-4" />], ['PIX', 'PIX', <QrCode key="i" className="w-4 h-4" />]] as const).map(([m, label, icon]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => changeMethod(m)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium ${f.method === m ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
              </div>

              {f.method === 'GIFT' ? (
                <label className="block text-sm">
                  <span className="font-semibold text-gray-800">Ponto de coleta *</span>
                  <select
                    value={f.collectionPointId}
                    onChange={(e) => set({ collectionPointId: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
                  >
                    <option value="">Selecione…</option>
                    {cps.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.cityName ? ` • ${c.cityName}${c.state ? `/${c.state}` : ''}` : ''}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block text-sm">
                    <span className="font-semibold text-gray-800">Valor (R$)</span>
                    <input value={f.donationAmount} onChange={(e) => set({ donationAmount: e.target.value })} inputMode="decimal" placeholder="50,00" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg" />
                  </label>
                  <label className="block text-sm">
                    <span className="font-semibold text-gray-800">Pago em</span>
                    <input type="date" value={f.pixPaidAt} onChange={(e) => set({ pixPaidAt: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg" />
                  </label>
                  <label className="block text-sm">
                    <span className="font-semibold text-gray-800">ID da transação</span>
                    <input value={f.pixTxid} onChange={(e) => set({ pixTxid: e.target.value })} placeholder="opcional" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg" />
                  </label>
                </div>
              )}

              <label className="block text-sm">
                <span className="font-semibold text-gray-800">Etapa</span>
                <select
                  value={f.status}
                  onChange={(e) => set({ status: e.target.value as SponsorshipStatus })}
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
                >
                  {ALL_STATUSES.map((st) => (
                    <option key={st} value={st}>{STATUS_STYLE[st].step ? `${STATUS_STYLE[st].step}. ` : '× '}{STATUS_PT[st]}{viaLabel(st)}</option>
                  ))}
                </select>
                {adjusted && (
                  <span className="block text-xs text-amber-700 mt-1">Etapa ajustada para a equivalente da nova forma ({STATUS_PT[f.status]}).</span>
                )}
              </label>

              <label className="block text-sm">
                <span className="font-semibold text-gray-800">Observação</span>
                <textarea value={f.note} onChange={(e) => set({ note: e.target.value })} rows={3} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg" />
              </label>

              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setEditing(null)} disabled={editBusy} className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50">Cancelar</button>
                <button onClick={saveEdit} disabled={editBusy} className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
                  {editBusy && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Modal: forma de apadrinhamento da seleção */}
      <Modal
        open={methodBulkOpen}
        title={`Forma de apadrinhamento · ${selectedCount} selecionado(s)`}
        onClose={() => { if (!selBusy) setMethodBulkOpen(false); }}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {([['GIFT', 'Presente no ponto', <Gift key="i" className="w-4 h-4" />], ['PIX', 'PIX', <QrCode key="i" className="w-4 h-4" />]] as const).map(([m, label, icon]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethodBulk((prev) => ({ ...prev, method: m }))}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium ${methodBulk.method === m ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
              >
                {icon} {label}
              </button>
            ))}
          </div>
          {methodBulk.method === 'GIFT' && (
            <label className="block text-sm">
              <span className="font-semibold text-gray-800">Ponto de coleta *</span>
              <select
                value={methodBulk.collectionPointId}
                onChange={(e) => setMethodBulk((prev) => ({ ...prev, collectionPointId: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
              >
                <option value="">Selecione…</option>
                {cps.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.cityName ? ` • ${c.cityName}${c.state ? `/${c.state}` : ''}` : ''}</option>
                ))}
              </select>
            </label>
          )}
          <p className="text-xs text-gray-500">
            Quem estiver em &quot;Aguardando entrega&quot; (presente) ou &quot;Em compra&quot; (PIX) passa para a etapa equivalente da nova forma.
            {methodBulk.method === 'PIX' ? ' O ponto de coleta é retirado.' : ''}
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setMethodBulkOpen(false)} disabled={selBusy} className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50">Cancelar</button>
            <button onClick={applyMethodBulk} disabled={selBusy} className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              {selBusy && <Loader2 className="w-4 h-4 animate-spin" />} Aplicar
            </button>
          </div>
        </div>
      </Modal>

      {/* Exportar PDF (padrinho, cidade, comunidade, criança ou seleção) */}
      <ExportPdfDialog
        open={exportOpen}
        onClose={() => { setExportOpen(false); setExportSponsor(null); setExportItems([]); }}
        title={exportSponsor?.name ?? ''}
        count={exportItems.length}
        defaultSummary={exportItems.length > 1}
        fileName={`apadrinhamentos-${slugFile(exportSponsor?.name || 'padrinho')}.pdf`}
        loadItems={async () => {
          // dados com a imagem da campanha de cada apadrinhamento (sem foto nela: sai sem foto)
          const r = await fetch('/api/admin/sponsorships/pdf-data', {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sponsorshipIds: exportItems.map((it) => it.id) }),
          });
          if (!r.ok) throw new Error(`Falha ao buscar os dados: ${await errorMessage(r)}`);
          const rows: unknown[] = await r.json();
          return rows.map(sponsorshipToPdfItem);
        }}
      />
    </div>
  );
}
