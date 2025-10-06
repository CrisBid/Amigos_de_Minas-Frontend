'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Filter,
  Heart,
  Users,
  Clock,
  UserCheck,
  Calendar,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  User,
  Eye,
  X,
  Mail,
  Phone,
  MapPin,
  Hash,
} from 'lucide-react';

type SponsorshipStatus = 'PENDING' | 'COMPLETED' | 'IN_PROGRESS' | 'ENDED' | 'CANCELLED';

type ChildLite = { id: string; publicId?: number | null; name: string };
type SponsorLite = { id: string; name: string; email?: string | null };
type CampaignLite = { id: string; name: string; slug: string; year?: number | null };

type Sponsorship = {
  id: string;
  status: SponsorshipStatus;
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
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

const PAGE_SIZE = 20;
const STATUS_OPTS: SponsorshipStatus[] = ['PENDING', 'COMPLETED', 'IN_PROGRESS', 'ENDED', 'CANCELLED'];

/* ===================== */
/* Util */
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

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
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

function LinkPill({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center px-2 py-1 rounded-full text-[11px] border border-gray-300 text-blue-700 hover:text-blue-900 hover:bg-blue-50"
    >
      {children}
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
/* Modal reutilizável */
/* ===================== */
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
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* dialog */}
      <div className="relative z-[61] w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ===================== */
/* Página principal */
/* ===================== */
export default function AdminSponsorshipsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | SponsorshipStatus>('');
  const [campaignId, setCampaignId] = useState<string>('');
  const [page, setPage] = useState(1);

  const [dataState, setDataState] = useState<PageResp<Sponsorship> | null>(null);
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignLite[]>([]);

  // Estados dos modais e detalhes
  const [childModalId, setChildModalId] = useState<string | null>(null);
  const [sponsorModalId, setSponsorModalId] = useState<string | null>(null);
  const [childDetail, setChildDetail] = useState<any | null>(null);
  const [sponsorDetail, setSponsorDetail] = useState<any | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);

  // Carrega campanhas para o filtro (via Next API)
  useEffect(() => {
    (async () => {
      try {
        const url = new URL('/api/admin/campaigns', window.location.origin);
        url.searchParams.set('page', '1');
        url.searchParams.set('pageSize', '200');
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

  function normalize(raw: any): PageResp<Sponsorship> {
    const items: Sponsorship[] = Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw)
      ? raw
      : [];
    const total = typeof raw?.total === 'number' ? raw.total : items.length;
    const pages = typeof raw?.pages === 'number' ? raw.pages : Math.max(1, Math.ceil(total / PAGE_SIZE));
    return { items, total, page, pageSize: PAGE_SIZE, pages };
  }

  const load = async () => {
    setLoading(true);
    try {
      const url = new URL('/api/admin/sponsorships', window.location.origin);
      url.searchParams.set('page', String(page));
      url.searchParams.set('pageSize', String(PAGE_SIZE));
      if (q.trim()) url.searchParams.set('q', q.trim());
      if (status) url.searchParams.set('status', status);
      if (campaignId) url.searchParams.set('campaignId', campaignId);

      const res = await fetch(url.toString(), { cache: 'no-store', credentials: 'include' });
      if (!res.ok) {
        setDataState({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE, pages: 1 });
      } else {
        const json = await res.json();
        setDataState(normalize(json));
      }
    } catch {
      setDataState({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE, pages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, campaignId, page]);

  const rows: Sponsorship[] = Array.isArray(dataState?.items) ? (dataState!.items as Sponsorship[]) : [];
  const noRows = !loading && rows.length === 0;

  const headerStats = useMemo(() => {
    const total = typeof dataState?.total === 'number' ? dataState.total : rows.length;
    const pending = rows.filter(r => r.status === 'PENDING').length;
    const active = rows.filter(r => r.status === 'COMPLETED').length;
    const in_progress = rows.filter(r => r.status === 'IN_PROGRESS').length;
    const ended = rows.filter(r => r.status === 'ENDED').length;
    const cancelled = rows.filter(r => r.status === 'CANCELLED').length;
    return { total, pending, active, ended, cancelled };
  }, [dataState?.total, rows]);

  const getStatusConfig = (s: SponsorshipStatus) => {
    switch (s) {
      case 'COMPLETED':
        return { label: 'Concluido', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
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
  };

  const StatusBadge = ({ status }: { status: SponsorshipStatus }) => {
    const config = getStatusConfig(status);
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${config.className}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></div>
        {config.label}
      </span>
    );
  };

  async function changeStatus(id: string, newStatus: SponsorshipStatus) {
    const r = await fetch(`/api/admin/sponsorships/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!r.ok) return alert('Falha ao alterar status.');
    load();
  }

  async function del(id: string) {
    if (!confirm('Excluir apadrinhamento? Esta ação não pode ser desfeita.')) return;
    const r = await fetch(`/api/admin/sponsorships/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!r.ok) return alert('Falha ao excluir.');
    load();
  }

  /* ===================== */
  /* Abertura dos modais   */
  /* ===================== */

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
      // tenta sponsors/:id
      let r = await fetch(`/api/admin/users/${id}`, { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error('Erro ao carregar padrinho');
      const json = await r.json();
      
      console.log(json);
      
      setSponsorDetail(json);
    } catch (e) {
      setSponsorDetail({ __error: 'Não foi possível carregar os dados do padrinho.' });
    } finally {
      setModalLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total</p>
                <p className="text-3xl font-bold text-gray-900">{headerStats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Heart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Apadrinhamentos Ativos</p>
                <p className="text-3xl font-bold text-emerald-600">{headerStats.active}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <UserCheck className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Pendentes</p>
                <p className="text-3xl font-bold text-amber-600">{headerStats.pending}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Encerrados</p>
                <p className="text-3xl font-bold text-blue-600">{headerStats.ended}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                placeholder="Buscar por criança ou padrinho..."
                value={q}
                onChange={(e) => { setPage(1); setQ(e.target.value); }}
              />
            </div>
            <div className="relative lg:w-48">
              <Filter className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <select
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 appearance-none cursor-pointer"
                value={status}
                onChange={(e) => { setPage(1); setStatus(e.target.value as SponsorshipStatus | ''); }}
              >
                <option value="">Todos os status</option>
                <option value="COMPLETED">Comcluido</option>
                <option value="IN_PROGRESS">Em Atendimento</option>
                <option value="PENDING">Pendente</option>
                <option value="ENDED">Encerrado</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>
            <div className="relative lg:w-64">
              <Calendar className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <select
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 appearance-none cursor-pointer"
                value={campaignId}
                onChange={(e) => { setPage(1); setCampaignId(e.target.value); }}
              >
                <option value="">Todas as campanhas</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.year ? ` (${c.year})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Criança</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Padrinho</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Campanha</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Início</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Fim</th>
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
                        <p className="text-gray-400 text-sm">Tente ajustar os filtros de busca</p>
                      </div>
                    </td>
                  </tr>
                )}
                
                {rows.map((sponsorship) => (
                  <tr key={sponsorship.id} className="hover:bg-blue-50/50 transition-colors duration-150">
                    {/* Criança */}
                    <td className="px-6 py-4">
                      {sponsorship.child ? (
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={`/admin/children/${sponsorship.child.id}`}
                            className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                          >
                            <div className="p-2 bg-pink-100 rounded-lg">
                              <User className="w-4 h-4 text-pink-600" />
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-gray-900">
                                {sponsorship.child.name}
                              </span>
                              <div className="text-xs text-gray-500">
                                ID: #{sponsorship.child.publicId ?? '—'}
                              </div>
                            </div>
                          </a>
                          <button
                            onClick={() => openChild(sponsorship.child!.id)}
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                            title="Ver detalhes da criança"
                          >
                            <Eye className="w-4 h-4" />
                            Detalhes
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>

                    {/* Padrinho */}
                    <td className="px-6 py-4">
                      {sponsorship.sponsor ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <UserCheck className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-gray-900">
                                {sponsorship.sponsor.name}
                              </span>
                              {sponsorship.sponsor.email && (
                                <div className="text-xs text-gray-500">
                                  {sponsorship.sponsor.email}
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => openSponsor(sponsorship.sponsor!.id)}
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
                      {sponsorship.campaign ? (
                        <a 
                          href={`/admin/campaigns/${sponsorship.campaign.id}`}
                          className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              {sponsorship.campaign.name}
                            </span>
                            {sponsorship.campaign.year && (
                              <div className="text-xs text-gray-500">
                                {sponsorship.campaign.year}
                              </div>
                            )}
                          </div>
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    
                    {/* Status */}
                    <td className="px-6 py-4">
                      <StatusBadge status={sponsorship.status} />
                    </td>
                    
                    {/* Datas */}
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {fmtDateBR(sponsorship.startDate)}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {fmtDateBR(sponsorship.endDate)}
                      </span>
                    </td>
                    
                    {/* Ações */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          className="px-3 py-1.5 text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors duration-150 cursor-pointer appearance-none"
                          value={sponsorship.status}
                          onChange={(e) => changeStatus(sponsorship.id, e.target.value as SponsorshipStatus)}
                          title="Alterar status"
                        >
                          <option value="PENDING">Pendente</option>
                          <option value="COMPLETED">Concluido</option>
                          <option value="IN_PROGRESS">Em Progresso</option>
                          <option value="ENDED">Encerrado</option>
                          <option value="CANCELLED">Cancelado</option>
                        </select>
                        <button 
                          onClick={() => del(sponsorship.id)}
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

        {/* Pagination */}
        {dataState && (dataState.pages ?? 1) > 1 && (
          <div className="mt-8">
            <Pagination page={dataState.page} pages={dataState.pages} onChange={setPage} />
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
                        src={childDetail.photoUrl ?? childDetail.images?.[0]?.framedUrl ?? childDetail.images?.[0]?.processedUrl ?? childDetail.images?.[0]?.originalUrl}
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
                          return (
                            <ImageThumb key={k} url={url} label={k.replace('Url','')} />
                          );
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

                {/* Apadrinhamentos */}
                <div>
                  <SectionTitle>Apadrinhamentos</SectionTitle>
                  {Array.isArray(childDetail.sponsorships) && childDetail.sponsorships.length > 0 ? (
                    <div className="space-y-2">
                      {childDetail.sponsorships.map((s: any) => (
                        <div
                          key={s.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50"
                        >
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700">
                            <span><b>Status:</b> <Badge>{s.status}</Badge></span>
                            <span><b>Início:</b> {fmtDateBR(s.startDate)}</span>
                            <span><b>Fim:</b> {fmtDateBR(s.endDate)}</span>
                            {s.campaignId && (
                              <a
                                href={`/admin/campaigns/${s.campaignId}`}
                                className="underline underline-offset-4 text-blue-700 hover:text-blue-900"
                              >
                                abrir campanha
                              </a>
                            )}
                          </div>
                          {s.sponsorId && (
                            <button
                              onClick={() => openSponsor(s.sponsorId)}
                              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                              title="Ver padrinho"
                            >
                              Ver padrinho
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Nenhum apadrinhamento encontrado.</p>
                  )}
                </div>

                {/* Composição (JSON) */}
                {Array.isArray(childDetail.images) && childDetail.images[0]?.Config && (
                  <details className="group rounded-xl border border-gray-200 bg-white">
                    <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between">
                      <span className="font-semibold text-gray-900">Composição da Imagem (JSON)</span>
                      <span className="text-xs text-gray-500 group-open:hidden">clicar para abrir</span>
                      <span className="text-xs text-gray-500 hidden group-open:inline">clicar para fechar</span>
                    </summary>
                    <div className="px-4 pb-4">
                      <pre className="max-h-80 overflow-auto text-xs bg-gray-50 border border-gray-200 rounded-lg p-3">
      {JSON.stringify(childDetail.images[0].Config, null, 2)}
                      </pre>
                    </div>
                  </details>
                )}

                {/* Metadados de imagem */}
                {Array.isArray(childDetail.images) && childDetail.images.length > 0 && (
                  <div>
                    <SectionTitle>Imagens (1ª versão)</SectionTitle>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {childDetail.images.map((im: any) => (
                        <div key={im.id} className="rounded-lg border border-gray-200 p-3 bg-white">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">#{im.id.slice(-6)}</span>
                            <Badge>{im.status ?? '—'}</Badge>
                          </div>
                          <div className="space-y-1 text-xs text-gray-600">
                            <div><b>Campanha:</b> {im.campaignId ?? '—'}</div>
                            <div><b>Created:</b> {fmtDateBR(im.createdAt)}</div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {im.framedUrl && <LinkPill href={im.framedUrl}>framed</LinkPill>}
                              {im.processedUrl && <LinkPill href={im.processedUrl}>processed</LinkPill>}
                              {im.originalUrl && <LinkPill href={im.originalUrl}>original</LinkPill>}
                              {im.layoutUrl && <LinkPill href={im.layoutUrl}>layout</LinkPill>}
                            </div>
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
                  {/* 
                  <InfoRow icon={<Phone className="w-4 h-4" />} label="Telefone" value={labelOrDash(sponsorDetail.profile.phone ?? sponsorDetail.mobile)} />
                  <InfoRow icon={<Hash className="w-4 h-4" />} label="Documento" value={labelOrDash(sponsorDetail.profile.document ?? sponsorDetail.cpfCnpj)} />
                  */}
                  <InfoRow icon={<MapPin className="w-4 h-4" />} label="Endereço" value={labelOrDash(
                    sponsorDetail.address
                      ? `${sponsorDetail.address ?? ''} ${sponsorDetail.city ?? ''}`.trim()
                      : sponsorDetail.city ? `${sponsorDetail.city} - ${sponsorDetail.state ?? ''}` : undefined
                  )} />
                  <InfoRow icon={<Clock className="w-4 h-4" />} label="Criado em" value={fmtDateBR(sponsorDetail.createdAt)} />
                </div>

                {Array.isArray(sponsorDetail.sponsorships) && sponsorDetail.sponsorships.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Apadrinhamentos</h4>
                    <div className="space-y-2">
                      {sponsorDetail.sponsorships.map((s: any) => (
                        <div key={s.id} className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            <span><b>Status:</b> {s.status}</span>
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

function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  const prev = () => onChange(Math.max(1, page - 1));
  const next = () => onChange(Math.min(pages, page + 1));
  
  return (
    <div className="flex items-center justify-center gap-4">
      <button 
        className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 backdrop-blur-sm border border-white/20 rounded-xl text-gray-700 hover:bg-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        onClick={prev} 
        disabled={page <= 1}
      >
        <ChevronLeft className="w-4 h-4" />
        Anterior
      </button>
      
      <div className="bg-white/70 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20 shadow-lg">
        <span className="text-gray-700 font-medium">
          Página {page} de {pages}
        </span>
      </div>
      
      <button 
        className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 backdrop-blur-sm border border-white/20 rounded-xl text-gray-700 hover:bg-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        onClick={next} 
        disabled={page >= pages}
      >
        Próxima
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
