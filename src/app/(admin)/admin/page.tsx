'use client';

import { useEffect, useState } from 'react';
import { 
  Heart, Users, Calendar, Baby, MapPin, TrendingUp, Clock, 
  UserCheck, Gift, Building2, ArrowUp, ArrowDown, Activity,
  Star, Target, Award, AlertCircle 
} from 'lucide-react';

// Tipos para os dados do dashboard
type DashboardStats = {
  children: {
    total: number;
    sponsored: number;
    available: number;
    pending: number;
  };
  campaigns: {
    total: number;
    active: number;
    finished: number;
    draft: number;
  };
  sponsorships: {
    total: number;
    active: number;
    pending: number;
    ended: number;
  };
  cities: {
    total: number;
    states: number;
  };
  trends: {
    childrenGrowth: number;
    sponsorshipRate: number;
    activeCampaigns: number;
  };
};

type RecentActivity = {
  id: string;
  type: 'sponsorship' | 'child' | 'campaign';
  message: string;
  timestamp: string;
  status: 'success' | 'pending' | 'info';
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // Carrega dados reais das APIs
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);

        // Buscar dados das crianças
        const childrenRes = await fetch('/api/admin/children?pageSize=1', { cache: 'no-store' });
        const childrenData = childrenRes.ok ? await childrenRes.json() : null;

        // Buscar dados das campanhas
        const campaignsRes = await fetch('/api/admin/campaigns?pageSize=200', { cache: 'no-store' });
        const campaignsData = campaignsRes.ok ? await campaignsRes.json() : null;

        // Buscar dados dos apadrinhamentos
        const sponsorshipsRes = await fetch('/api/admin/sponsorships?pageSize=1', { cache: 'no-store' });
        const sponsorshipsData = sponsorshipsRes.ok ? await sponsorshipsRes.json() : null;

        // Buscar dados das cidades
        const citiesRes = await fetch('/api/admin/cities?pageSize=1', { cache: 'no-store' });
        const citiesData = citiesRes.ok ? await citiesRes.json() : null;

        // Buscar apadrinhamentos por status
        const activeRes = await fetch('/api/admin/sponsorships?status=ACTIVE&pageSize=1', { cache: 'no-store' });
        const activeData = activeRes.ok ? await activeRes.json() : null;

        const pendingRes = await fetch('/api/admin/sponsorships?status=PENDING&pageSize=1', { cache: 'no-store' });
        const pendingData = pendingRes.ok ? await pendingRes.json() : null;

        const endedRes = await fetch('/api/admin/sponsorships?status=ENDED&pageSize=1', { cache: 'no-store' });
        const endedData = endedRes.ok ? await endedRes.json() : null;

        // Processar campanhas por status
        const campaigns = Array.isArray(campaignsData?.items) ? campaignsData.items : [];
        const activeCampaigns = campaigns.filter((c: { status: string; }) => c.status === 'ACTIVE').length;
        const finishedCampaigns = campaigns.filter((c: { status: string; }) => c.status === 'FINISHED').length;
        const draftCampaigns = campaigns.filter((c: { status: string; }) => c.status === 'DRAFT').length;

        // Calcular estatísticas das cidades
        const cities = Array.isArray(citiesData?.items) ? citiesData.items : [];
        const uniqueStates = new Set(cities.filter((c: { state: any; }) => c.state).map((c: { state: any; }) => c.state)).size;

        // Calcular métricas
        const totalChildren = childrenData?.total || 0;
        const totalSponsorships = sponsorshipsData?.total || 0;
        const activeSponsorships = activeData?.total || 0;
        const pendingSponsorships = pendingData?.total || 0;
        const endedSponsorships = endedData?.total || 0;
        
        const sponsorshipRate = totalChildren > 0 ? (activeSponsorships / totalChildren) * 100 : 0;
        const availableChildren = totalChildren - activeSponsorships;

        setStats({
          children: { 
            total: totalChildren, 
            sponsored: activeSponsorships, 
            available: Math.max(0, availableChildren), 
            pending: pendingSponsorships 
          },
          campaigns: { 
            total: campaigns.length, 
            active: activeCampaigns, 
            finished: finishedCampaigns, 
            draft: draftCampaigns 
          },
          sponsorships: { 
            total: totalSponsorships, 
            active: activeSponsorships, 
            pending: pendingSponsorships, 
            ended: endedSponsorships 
          },
          cities: { 
            total: citiesData?.total || 0, 
            states: uniqueStates 
          },
          trends: { 
            childrenGrowth: 0, // Calcular baseado em dados históricos se disponível
            sponsorshipRate: Math.round(sponsorshipRate * 10) / 10, 
            activeCampaigns: activeCampaigns 
          }
        });

        // Buscar atividade recente (últimos registros)
        const recentChildren = await fetch('/api/admin/children?pageSize=5&orderBy=createdAt&order=desc', { cache: 'no-store' });
        const recentChildrenData = recentChildren.ok ? await recentChildren.json() : null;
        
        const recentSponsorships = await fetch('/api/admin/sponsorships?pageSize=5&orderBy=createdAt&order=desc', { cache: 'no-store' });
        const recentSponsorshipsData = recentSponsorships.ok ? await recentSponsorships.json() : null;

        // Montar atividade recente
        const activities: RecentActivity[] = [];

        // Adicionar crianças recentes
        if (recentChildrenData?.items) {
          recentChildrenData.items.slice(0, 2).forEach((child: any) => {
            activities.push({
              id: `child-${child.id}`,
              type: 'child',
              message: `Criança ${child.name} foi cadastrada`,
              timestamp: child.createdAt,
              status: 'success'
            });
          });
        }

        // Adicionar apadrinhamentos recentes
        if (recentSponsorshipsData?.items) {
          recentSponsorshipsData.items.slice(0, 3).forEach((sponsorship: any) => {
            const childName = sponsorship.child?.name || 'Criança';
            const sponsorName = sponsorship.sponsor?.name || 'Padrinho';
            activities.push({
              id: `sponsorship-${sponsorship.id}`,
              type: 'sponsorship',
              message: sponsorship.status === 'ACTIVE' 
                ? `Apadrinhamento confirmado: ${sponsorName} ↔ ${childName}`
                : `Nova solicitação de apadrinhamento para ${childName}`,
              timestamp: sponsorship.createdAt,
              status: sponsorship.status === 'ACTIVE' ? 'success' : 'pending'
            });
          });
        }

        // Ordenar por data mais recente
        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setRecentActivity(activities.slice(0, 4));

      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
        // Definir valores padrão em caso de erro
        setStats({
          children: { total: 0, sponsored: 0, available: 0, pending: 0 },
          campaigns: { total: 0, active: 0, finished: 0, draft: 0 },
          sponsorships: { total: 0, active: 0, pending: 0, ended: 0 },
          cities: { total: 0, states: 0 },
          trends: { childrenGrowth: 0, sponsorshipRate: 0, activeCampaigns: 0 }
        });
        setRecentActivity([]);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Agora há pouco';
    if (diffHours < 24) return `${diffHours}h atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'sponsorship': return <Heart className="w-4 h-4" />;
      case 'child': return <Baby className="w-4 h-4" />;
      case 'campaign': return <Calendar className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'pending': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Dashboard dos Amigos de Minas
          </h1>
          <p className="text-gray-600 text-lg">
            Bem-vindo ao painel administrativo - Visão geral dos apadrinhamentos
          </p>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Crianças */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-pink-100 rounded-xl">
                <Baby className="w-6 h-6 text-pink-600" />
              </div>
              <div className="flex items-center gap-1 text-sm text-emerald-600">
                <ArrowUp className="w-4 h-4" />
                +{stats?.trends.childrenGrowth}%
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {stats?.children.total.toLocaleString()}
            </h3>
            <p className="text-sm text-gray-600 mb-3">Total de Crianças</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-emerald-600">Apadrinhadas</span>
                <span className="font-medium">{stats?.children.sponsored}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Disponíveis</span>
                <span className="font-medium">{stats?.children.available}</span>
              </div>
            </div>
          </div>

          {/* Apadrinhamentos */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Heart className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex items-center gap-1 text-sm text-emerald-600">
                <Target className="w-4 h-4" />
                {stats?.trends.sponsorshipRate}%
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {stats?.sponsorships.active.toLocaleString()}
            </h3>
            <p className="text-sm text-gray-600 mb-3">Apadrinhamentos Ativos</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-amber-600">Pendentes</span>
                <span className="font-medium">{stats?.sponsorships.pending}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-blue-600">Finalizados</span>
                <span className="font-medium">{stats?.sponsorships.ended}</span>
              </div>
            </div>
          </div>

          {/* Campanhas */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex items-center gap-1 text-sm text-blue-600">
                <Activity className="w-4 h-4" />
                {stats?.campaigns.active} ativas
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {stats?.campaigns.total}
            </h3>
            <p className="text-sm text-gray-600 mb-3">Total de Campanhas</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-emerald-600">Ativas</span>
                <span className="font-medium">{stats?.campaigns.active}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Rascunhos</span>
                <span className="font-medium">{stats?.campaigns.draft}</span>
              </div>
            </div>
          </div>

          {/* Localização */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <MapPin className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex items-center gap-1 text-sm text-indigo-600">
                <Building2 className="w-4 h-4" />
                {stats?.cities.states} estados
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {stats?.cities.total}
            </h3>
            <p className="text-sm text-gray-600 mb-3">Cidades Cadastradas</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-indigo-600">Estados</span>
                <span className="font-medium">{stats?.cities.states}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Média/Estado</span>
                <span className="font-medium">{Math.round((stats?.cities.total || 0) / (stats?.cities.states || 1))}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Second Row - Progress Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <UserCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Taxa de Apadrinhamento</h4>
                <p className="text-sm text-gray-600">Meta: 80%</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-2xl font-bold text-emerald-600">71.6%</span>
                <span className="text-sm text-gray-500">892/1247</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{width: '71.6%'}}></div>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Pendências</h4>
                <p className="text-sm text-gray-600">Requer atenção</p>
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-2xl font-bold text-amber-600">78</span>
              <p className="text-sm text-gray-600">Solicitações aguardando aprovação</p>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Crescimento</h4>
                <p className="text-sm text-gray-600">Últimos 30 dias</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-blue-600">+12.5%</span>
                <ArrowUp className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-sm text-gray-600">Novos cadastros de crianças</p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Activity className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Atividade Recente</h3>
                <p className="text-sm text-gray-600">Últimas atualizações do sistema</p>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 p-4 rounded-xl bg-gray-50/50 hover:bg-gray-100/50 transition-colors duration-150">
                  <div className={`p-2 rounded-lg border ${getStatusColor(activity.status)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(activity.timestamp)}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(activity.status)}`}>
                    {activity.status === 'success' ? 'Concluído' : 
                     activity.status === 'pending' ? 'Pendente' : 'Info'}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 text-center">
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                Ver todas as atividades →
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a href="/admin/children/new" className="group p-4 bg-white/50 hover:bg-white/80 rounded-xl border border-white/20 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pink-100 group-hover:bg-pink-200 rounded-lg transition-colors">
                <Baby className="w-5 h-5 text-pink-600" />
              </div>
              <span className="font-medium text-gray-700 group-hover:text-gray-900">Cadastrar Criança</span>
            </div>
          </a>
          
          <a href="/admin/campaigns/new" className="group p-4 bg-white/50 hover:bg-white/80 rounded-xl border border-white/20 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 group-hover:bg-blue-200 rounded-lg transition-colors">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <span className="font-medium text-gray-700 group-hover:text-gray-900">Nova Campanha</span>
            </div>
          </a>
          
          <a href="/admin/sponsorships" className="group p-4 bg-white/50 hover:bg-white/80 rounded-xl border border-white/20 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 group-hover:bg-emerald-200 rounded-lg transition-colors">
                <Heart className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="font-medium text-gray-700 group-hover:text-gray-900">Ver Apadrinhamentos</span>
            </div>
          </a>
          
          <a href="/admin/cities/new" className="group p-4 bg-white/50 hover:bg-white/80 rounded-xl border border-white/20 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 group-hover:bg-indigo-200 rounded-lg transition-colors">
                <MapPin className="w-5 h-5 text-indigo-600" />
              </div>
              <span className="font-medium text-gray-700 group-hover:text-gray-900">Adicionar Cidade</span>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}