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
} from 'lucide-react';

/* ===================== */
/* Tipos                 */
/* ===================== */
type SponsorshipStatus = 'PENDING' | 'COMPLETED' | 'IN_PROGRESS' | 'ENDED' | 'CANCELLED';
type SponsorshipMethod = 'PIX' | 'GIFT';

type ChildLite = {
  id: string;
  publicId?: number | null;
  name: string;
  community?: { name?: string } | null;
  city?: { name?: string } | null;
  cityName?: string | null;
  [key: string]: any; // permite campos extras do backend
};

type SponsorLite = { id: string; name: string; email?: string | null };

type CampaignLite = { id: string; name: string; slug: string; year?: number | null };

type Sponsorship = {
  id: string;
  status: SponsorshipStatus;
  method?: SponsorshipMethod | null; // ✅ exibir método (PIX/GIFT)
  startDate?: string | null;
  endDate?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  child?: ChildLite | null;
  sponsor?: SponsorLite | null;
  campaign?: CampaignLite | null;
};

type PageResp<T> = {
  items: T[];
  total?: number;
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
/* Página principal      */
/* ===================== */
export default function AdminSponsorshipsPage() {
  // filtros
  const [q, setQ] = useState('');
  const [campaignId, setCampaignId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabKey>('PENDING'); // ✅ abas funcionam client-side

  // dados
  const [campaigns, setCampaigns] = useState<CampaignLite[]>([]);
  const [allRows, setAllRows] = useState<Sponsorship[]>([]);
  const [loading, setLoading] = useState(false);

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

  // Carrega campanhas
  useEffect(() => {
    (async () => {
      try {
        const url = new URL('/api/admin/campaigns', window.location.origin);
        url.searchParams.set('pageSize', '10000'); // sem paginação
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

  // Busca SEM status; filtro por status é no cliente (conserta bug das abas)
  async function load() {
    setLoading(true);
    try {
      const url = new URL('/api/admin/sponsorships', window.location.origin);
      url.searchParams.set('pageSize', '100000'); // sem paginação
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

  /* ===== Filtros no cliente ===== */

  // Filtra por status (aba)
  const filteredByTab = useMemo(() => {
    return allRows.filter((r) => r.status === activeTab);
  }, [allRows, activeTab]);

  // Stats por aba (contados a partir de allRows)
  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0 };
    for (const r of allRows) {
      if (r.status === 'PENDING') counts.PENDING++;
      else if (r.status === 'IN_PROGRESS') counts.IN_PROGRESS++;
      else if (r.status === 'COMPLETED') counts.COMPLETED++;
    }
    return counts;
  }, [allRows]);

  // filtro por texto adicional no cliente (reforço)
  const visibleRows = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    if (!qLower) return filteredByTab;
    return filteredByTab.filter((r) => {
      const childName = r.child?.name?.toLowerCase() ?? '';
      const sponsorName = r.sponsor?.name?.toLowerCase() ?? '';
      const sponsorEmail = r.sponsor?.email?.toLowerCase() ?? '';
      return childName.includes(qLower) || sponsorName.includes(qLower) || sponsorEmail.includes(qLower);
    });
  }, [filteredByTab, q]);

  const noRows = !loading && visibleRows.length === 0;

  /* ===== Helpers de status/método ===== */
  function getStatusConfig(s: SponsorshipStatus) {
    switch (s) {
      case 'COMPLETED':
        return { label: 'Concluído', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
      case 'IN_PROGRESS':
        return { label: 'Em Progresso', className: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500' };
      case 'PENDING':
        return { label: 'Pendente', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
      case 'ENDED':
        return { label: 'Encerrado', className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' };
      case 'CANCELLED':
        return { label: 'Cancelado', className: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' };
      default:
        return { label: '—', className: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-500' };
    }
  }

  function StatusBadge({ status }: { status: SponsorshipStatus }) {
    const config = getStatusConfig(status);
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${config.className}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
    );
  }

  function MethodBadge({ method }: { method?: SponsorshipMethod | null }) {
    if (!method) return <Badge className="bg-gray-50 text-gray-600 border-gray-200">—</Badge>;
    if (method === 'PIX') {
      return <Badge className="bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200">PIX</Badge>;
    }
    return <Badge className="bg-sky-50 text-sky-700 border-sky-200">Presente no ponto (GIFT)</Badge>;
  }

  /* ===== Ações ===== */
  async function changeStatus(id: string, newStatus: SponsorshipStatus) {
    const r = await fetch(`/api/admin/sponsorships/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!r.ok) {
      alert('Falha ao alterar status.');
      return;
    }
    // recarrega tudo; o item pode sair da aba atual
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
    } catch (e) {
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
    } catch (e) {
      setSponsorDetail({ __error: 'Não foi possível carregar os dados do padrinho.' });
    } finally {
      setModalLoading(false);
    }
  }

  /* ===== Agrupamento (Padrinho -> Comunidade) ===== */
  function deriveCommunityName(s: Sponsorship): string {
    const cAny = s.child as any;
    return cAny?.community?.name || cAny?.city?.name || cAny?.cityName || 'Sem comunidade';
  }

  type GroupSponsor = {
    sponsorId: string;
    sponsor: SponsorLite | null;
    total: number;
    items: Sponsorship[];
    byCommunity: Array<{
      name: string;
      total: number;
      items: Sponsorship[];
    }>;
  };

  const groupedBySponsor: GroupSponsor[] = useMemo(() => {
    const map = new Map<string, { sponsor: SponsorLite | null; items: Sponsorship[] }>();
    for (const s of visibleRows) {
      const sid = s.sponsor?.id ?? '__sem_padrinho__';
      const cur = map.get(sid) ?? { sponsor: s.sponsor ?? null, items: [] };
      cur.items.push(s);
      map.set(sid, cur);
    }

    const result: GroupSponsor[] = [];
    for (const [sid, { sponsor, items }] of map.entries()) {
      const commMap = new Map<string, Sponsorship[]>();
      for (const it of items) {
        const cname = deriveCommunityName(it);
        const arr = commMap.get(cname) ?? [];
        arr.push(it);
        commMap.set(cname, arr);
      }
      result.push({
        sponsorId: sid,
        sponsor,
        total: items.length,
        items,
        byCommunity: Array.from(commMap.entries())
          .map(([name, arr]) => ({ name, total: arr.length, items: arr }))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      });
    }

    return result.sort((a, b) => {
      const an = a.sponsor?.name || 'zzz~Sem padrinho';
      const bn = b.sponsor?.name || 'zzz~Sem padrinho';
      return an.localeCompare(bn, 'pt-BR');
    });
  }, [visibleRows]);

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
            <div className="flex gap-3">
              <div className="text-sm text-gray-500 px-4 py-2 bg-white/50 rounded-xl border border-white/20">
                Funcionalidades extras em breve
              </div>
            </div>
          </div>
        </div>

        {/* Stats (da aba atual) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total (aba)</p>
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
                <p className="text-sm font-medium text-gray-600 mb-1">Concluídos (na aba)</p>
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
                <p className="text-sm font-medium text-gray-600 mb-1">Pendentes (na aba)</p>
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
                <p className="text-sm font-medium text-gray-600 mb-1">Em Progresso (na aba)</p>
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

        {/* Abas */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <Tab
              id="PENDING"
              label="Pendentes"
              count={tabCounts.PENDING}
              active={activeTab === 'PENDING'}
              onClick={() => setActiveTab('PENDING')}
            />
            <Tab
              id="IN_PROGRESS"
              label="Em andamento"
              count={tabCounts.IN_PROGRESS}
              active={activeTab === 'IN_PROGRESS'}
              onClick={() => setActiveTab('IN_PROGRESS')}
            />
            <Tab
              id="COMPLETED"
              label="Concluídos"
              count={tabCounts.COMPLETED}
              active={activeTab === 'COMPLETED'}
              onClick={() => setActiveTab('COMPLETED')}
            />
          </div>
        </div>

        {/* Filtros (sem seletor de status) */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                placeholder="Buscar por criança ou padrinho..."
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

            {/* Toggle visualização */}
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
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Criança</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Padrinho</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Campanha</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Método</th>{/* ✅ método */}
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Status</th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-gray-900">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                          <p className="text-gray-500 font-medium">Carregando apadrinhamentos...</p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && noRows && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
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

                  {visibleRows.map((s) => (
                    <tr key={s.id} className="hover:bg-blue-50/50 transition-colors duration-150">
                      {/* Criança */}
                      <td className="px-6 py-4">
                        {s.child ? (
                          <div className="flex items-center justify-between gap-2">
                            <a
                              href={`/admin/children/${s.child.id}`}
                              className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                            >
                              <div className="p-2 bg-pink-100 rounded-lg">
                                <User className="w-4 h-4 text-pink-600" />
                              </div>
                              <div>
                                <span className="text-sm font-semibold text-gray-900">
                                  {s.child.name}
                                </span>
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

                      {/* Padrinho */}
                      <td className="px-6 py-4">
                        {s.sponsor ? (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="p-2 bg-blue-100 rounded-lg">
                                <UserCheck className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <span className="text-sm font-semibold text-gray-900">{s.sponsor.name}</span>
                                {s.sponsor.email && (
                                  <div className="text-xs text-gray-500">{s.sponsor.email}</div>
                                )}
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
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>

                      {/* Campanha */}
                      <td className="px-6 py-4">
                        {s.campaign ? (
                          <a
                            href={`/admin/campaigns/${s.campaign.id}`}
                            className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                            <div>
                              <span className="text-sm font-medium text-gray-900">{s.campaign.name}</span>
                              {s.campaign.year && <div className="text-xs text-gray-500">{s.campaign.year}</div>}
                            </div>
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>

                      {/* Método */}
                      <td className="px-6 py-4">
                        <MethodBadge method={s.method ?? null} />
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <StatusBadge status={s.status} />
                      </td>

                      {/* Ações */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <select
                            className="px-3 py-1.5 text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors duration-150 cursor-pointer appearance-none"
                            value={s.status}
                            onChange={(e) => changeStatus(s.id, e.target.value as SponsorshipStatus)}
                            title="Alterar status"
                          >
                            <option value="PENDING">Pendente</option>
                            <option value="COMPLETED">Concluído</option>
                            <option value="IN_PROGRESS">Em Progresso</option>
                            <option value="ENDED">Encerrado</option>
                            <option value="CANCELLED">Cancelado</option>
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* === AGRUPADO (Padrinho → Comunidade) === */
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
                  if (failed > 0) {
                    alert(`Algumas atualizações falharam (${failed}/${group.total}).`);
                  }
                  await load();
                } finally {
                  setBulkLoading(prev => ({ ...prev, [sid]: false }));
                }
              }

              return (
                <div key={sid} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg">
                  {/* Cabeçalho do padrinho + bulk */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-gray-100">
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
                    <div className="flex items-center gap-3">
                      <Badge className="bg-gray-50 text-gray-700 border-gray-200">
                        {group.total} apadrinhamento{group.total > 1 ? 's' : ''}
                      </Badge>

                      {/* ✅ Bulk status por padrinho */}
                      <select
                        className="px-3 py-1.5 text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors duration-150 cursor-pointer appearance-none"
                        value={bulkValue}
                        onChange={(e) => setBulkChoice(prev => ({ ...prev, [sid]: e.target.value as SponsorshipStatus }))}
                        disabled={bulkBusy}
                        title="Selecionar novo status para todos"
                      >
                        <option value="PENDING">Pendente</option>
                        <option value="COMPLETED">Concluído</option>
                        <option value="IN_PROGRESS">Em Progresso</option>
                        <option value="ENDED">Encerrado</option>
                        <option value="CANCELLED">Cancelado</option>
                      </select>
                      <button
                        onClick={applyBulk}
                        disabled={bulkBusy}
                        className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors duration-150 ${
                          bulkBusy ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                        title="Aplicar novo status a todos os apadrinhamentos deste padrinho"
                      >
                        {bulkBusy ? 'Aplicando…' : 'Aplicar a todos'}
                      </button>

                      {group.sponsor?.id && (
                        <button
                          onClick={() => openSponsor(group.sponsor!.id)}
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                        >
                          <Eye className="w-4 h-4" /> Detalhes do padrinho
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Subgrupos por comunidade */}
                  <div className="p-6 space-y-5">
                    {group.byCommunity.map(comm => (
                      <div key={comm.name} className="rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-t-xl border-b border-gray-200">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-100 rounded-lg">
                              <MapPin className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div className="text-sm font-semibold text-gray-900">{comm.name}</div>
                          </div>
                          <Badge className="bg-white text-gray-700 border-gray-200">{comm.total}</Badge>
                        </div>

                        {/* Cards dos apadrinhamentos da comunidade */}
                        <ul className="divide-y divide-gray-100">
                          {comm.items.map(s => (
                            <li key={s.id} className="px-4 py-3">
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                {/* Esquerda: criança/campanha */}
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-pink-100 rounded-lg">
                                    <User className="w-4 h-4 text-pink-600" />
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-gray-900">
                                      {s.child?.name || '—'}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                                      <span>ID: #{s.child?.publicId ?? '—'}</span>
                                      {s.campaign?.name && (
                                        <span className="inline-flex items-center gap-1">
                                          <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                                          {s.campaign.name}{s.campaign.year ? ` (${s.campaign.year})` : ''}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Meio: método + status */}
                                <div className="flex items-center gap-2">
                                  <MethodBadge method={s.method ?? null} />
                                  <StatusBadge status={s.status} />
                                </div>

                                {/* Direita: ações */}
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
                                  <select
                                    className="px-3 py-1.5 text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors duration-150 cursor-pointer appearance-none"
                                    value={s.status}
                                    onChange={(e) => changeStatus(s.id, e.target.value as SponsorshipStatus)}
                                    title="Alterar status"
                                  >
                                    <option value="PENDING">Pendente</option>
                                    <option value="COMPLETED">Concluído</option>
                                    <option value="IN_PROGRESS">Em Progresso</option>
                                    <option value="ENDED">Encerrado</option>
                                    <option value="CANCELLED">Cancelado</option>
                                  </select>
                                  <button
                                    onClick={() => del(s.id)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 transition-colors duration-150"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Excluir
                                  </button>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
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
                {/* Header com foto e dados principais */}
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
                    {/* mini-galeria */}
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

                    {/* Localização */}
                    <SectionTitle>Localização</SectionTitle>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <KV label="Cidade" value={labelOrDash(childDetail.city?.name ?? childDetail.cityName)} />
                      <KV label="UF" value={labelOrDash(childDetail.city?.state)} />
                      <KV label="Comunidade" value={labelOrDash(childDetail.community?.name)} />
                    </div>

                    {/* Escola */}
                    <SectionTitle>Escola</SectionTitle>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <KV label="Nome" value={labelOrDash(childDetail.school?.name ?? childDetail.schoolLegacy)} />
                      <KV label="Código" value={labelOrDash(childDetail.school?.publicId)} />
                      <KV label="Endereço" value={labelOrDash(childDetail.school?.address)} />
                    </div>
                  </div>
                </div>

                {/* Apadrinhamentos da criança */}
                {Array.isArray(childDetail.sponsorships) && (
                  <div>
                    <SectionTitle>Apadrinhamentos</SectionTitle>
                    {childDetail.sponsorships.length > 0 ? (
                      <div className="space-y-2">
                        {childDetail.sponsorships.map((s: any) => (
                          <div
                            key={s.id}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50"
                          >
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700">
                              <span>
                                <b>Status:</b>{' '}
                                <Badge className="bg-gray-100 text-gray-700 border-gray-200">{s.status}</Badge>
                              </span>
                              <span><b>Início:</b> {fmtDateBR(s.startDate)}</span>
                              <span><b>Fim:</b> {fmtDateBR(s.endDate)}</span>
                              <span><b>Método:</b> {s.method ?? '—'}</span>
                            </div>
                            {s.campaignId && (
                              <a
                                href={`/admin/campaigns/${s.campaignId}`}
                                className="text-xs underline underline-offset-4 text-blue-700 hover:text-blue-900"
                              >
                                abrir campanha
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Nenhum apadrinhamento encontrado.</p>
                    )}
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
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            <span><b>Status:</b> {s.status}</span>
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
    </div>
  );
}
