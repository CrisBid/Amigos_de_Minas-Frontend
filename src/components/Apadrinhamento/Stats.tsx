import { Users, Heart, Star } from 'lucide-react';

interface StatsProps {
  stats: {
    total: number;
    active: number;
    pending: number;
    in_progress?: number;
    available: number;
    sponsorshipRate: number;
  };
}

export default function Stats({ stats }: StatsProps) {
  const pct = stats.total ? Math.round((stats.active / stats.total) * 100) : 0;
  const cards = [
    { label: 'Crianças', value: stats.total, icon: Users, tone: 'border-blue-500', text: 'text-blue-600', iconCls: 'text-blue-500' },
    { label: 'Apadrinhadas', value: stats.active, icon: Heart, tone: 'border-green-500', text: 'text-green-600', iconCls: 'text-green-500' },
    { label: 'Disponíveis', value: stats.available, icon: Star, tone: 'border-yellow-500', text: 'text-yellow-600', iconCls: 'text-yellow-500' },
  ];

  return (
    <div className="mb-5 lg:mb-8">
      {/* três lado a lado também no celular, compactos */}
      <div className="grid grid-cols-3 gap-2 sm:gap-6">
        {cards.map(({ label, value, icon: Icon, tone, text, iconCls }) => (
          <div key={label} className={`bg-white rounded-2xl shadow-md sm:shadow-lg p-3 sm:p-6 border-l-4 ${tone} hover:shadow-xl transition-shadow`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className={`${text} text-[11px] sm:text-sm font-medium truncate`}>{label}</p>
                <p className="text-xl sm:text-3xl font-bold text-gray-800">{value.toLocaleString('pt-BR')}</p>
              </div>
              <Icon className={`hidden sm:block h-12 w-12 ${iconCls} shrink-0`} />
            </div>
          </div>
        ))}
      </div>

      {/* quanto da campanha já tem padrinho */}
      {stats.total > 0 && (
        <div className="mt-3 flex items-center gap-3 text-xs sm:text-sm text-gray-600">
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="whitespace-nowrap"><strong className="text-gray-800">{pct}%</strong> já têm padrinho</span>
        </div>
      )}
    </div>
  );
}
