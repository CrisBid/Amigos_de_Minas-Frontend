'use client';
import Image from 'next/image';
import { Gift, Loader2, ShieldCheck } from 'lucide-react';

export default function ChildCard({
  child,
  onSponsor,
  sponsoring = false,
}: {
  child: {
    id: string;
    nome: string;
    idade: number;
    cidade: string;
    escola?: string;
    categoria?: string;
    descricao?: string;
    foto?: string;
    apadrinhado: boolean;
    status?: 'PENDING' | 'ACTIVE' | 'ENDED' | 'CANCELLED' | 'NONE';
  };
  onSponsor?: () => void;
  sponsoring?: boolean;
}) {
  const indisponivel = child.apadrinhado; // ACTIVE ou PENDING

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition bg-white">
      <div className="aspect-[1/1] bg-gray-100 relative">
        {child.foto ? (
          <Image unoptimized src={child.foto} alt={child.nome} fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">Sem foto</div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[#253243]">{child.nome}</h3>
          {indisponivel ? (
            <span className="text-xs border px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border-amber-100">
              {child.status === 'PENDING' ? 'Pendente' : 'Apadrinhado'}
            </span>
          ) : (
            <span className="text-xs border px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border-emerald-100">
              Disponível
            </span>
          )}
        </div>

        <p className="text-sm text-gray-600">{child.cidade}{child.escola ? ` • ${child.escola}` : ''}</p>
        {child.categoria && <p className="text-sm text-gray-600">Categoria: {child.categoria}</p>}
        {child.descricao && <p className="text-sm text-gray-500 line-clamp-2">{child.descricao}</p>}

        <div className="pt-2 flex gap-2">
          {!indisponivel ? (
            <button
              onClick={onSponsor}
              disabled={sponsoring}
              className="text-sm px-3 py-1.5 bg-[#253243] text-white rounded-lg hover:bg-[#375A7F] inline-flex items-center gap-1 disabled:opacity-70"
            >
              {sponsoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {sponsoring ? 'Apadrinhando...' : 'Apadrinhar'}
            </button>
          ) : (
            <button
              disabled
              className="text-sm px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg inline-flex items-center gap-1 cursor-not-allowed"
              title="Indisponível nesta campanha"
            >
              <Gift className="w-4 h-4" /> Indisponível
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
