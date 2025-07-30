import { Users, Heart, Star } from 'lucide-react';

interface StatsProps {
  stats: {
    total: number;
    apadrinhadas: number;
    disponiveis: number;
  };
}

export default function Stats({ stats }: StatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 lg:mb-8">
      {/* Total */}
      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 border-l-4 border-blue-500 hover:shadow-xl transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-600 text-xs sm:text-sm font-medium">Total de Crianças</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-800">{stats.total}</p>
          </div>
          <Users className="h-8 w-8 sm:h-12 sm:w-12 text-blue-500" />
        </div>
      </div>

      {/* Apadrinhadas */}
      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 border-l-4 border-green-500 hover:shadow-xl transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-600 text-xs sm:text-sm font-medium">Apadrinhadas</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-800">{stats.apadrinhadas}</p>
          </div>
          <Heart className="h-8 w-8 sm:h-12 sm:w-12 text-green-500" />
        </div>
      </div>

      {/* Disponíveis */}
      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 border-l-4 border-yellow-500 hover:shadow-xl transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-yellow-600 text-xs sm:text-sm font-medium">Disponíveis</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-800">{stats.disponiveis}</p>
          </div>
          <Star className="h-8 w-8 sm:h-12 sm:w-12 text-yellow-500" />
        </div>
      </div>
    </div>
  );
}
