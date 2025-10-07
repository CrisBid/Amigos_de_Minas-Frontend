'use client';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Gift, Loader2, ShieldCheck } from 'lucide-react';
import ComposedImage, { ComposeConfig } from '@/components/media/ComposedImage';
import { pickComposeInputsFromImages } from '@/components/media/pickComposeInputs';

type Status = 'PENDING' | 'COMPLETED' | 'IN_PROGRESS' | 'ENDED' | 'CANCELLED' | 'NONE';

export default function ChildCard({
  child,
  onSponsor,
  sponsoring = false,
}: {
  child: {
    id: string;
    nome: string;
    idade: number;            // já calculada ou fornecida
    cidade: string;
    comunidade?: string;      // NOVO: opcional, quando quiser exibir
    escola?: string;
    categoria?: string;
    presente?: string;        // wantedGift
    descricao?: string;
    foto?: string;
    apadrinhado: boolean;     // true quando ACTIVE/PENDING
    status?: Status;
    images?: any
  };
  onSponsor?: () => void;
  sponsoring?: boolean;
}) {
  const [imgErr, setImgErr] = useState(false);
  const indisponivel = child.apadrinhado; // ACTIVE ou PENDING

  const metaLineParts = [child.cidade, child.comunidade, child.escola].filter(Boolean);
  const metaLine = metaLineParts.join(' • ');

  // monte o ageText (ex.: "10 anos")
  const ageText = `${child.idade} anos`;

  // se tiver images[] disponível:
  const composeInputs = useMemo(() => pickComposeInputsFromImages(child.images), [child.images]);

  //console.log('composeInputs', composeInputs);
  
  const badgeText =
    child.status === 'PENDING'
      ? 'Pendente'
      : child.status === 'COMPLETED'
      ? 'Apadrinhado'
      : child.status === 'ENDED'
      ? 'Encerrado'
      : child.status === 'CANCELLED'
      ? 'Cancelado'
      : 'Indisponível';

    return (
    <div className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition bg-white">
      <div className="aspect-[4/6] bg-gray-100 relative">
        {composeInputs ? (
          <ComposedImage
            photoUrl={composeInputs.photoUrl}
            layoutUrl={composeInputs.layoutUrl}
            config={composeInputs.config as ComposeConfig}
            fallbackUrl={composeInputs.fallbackUrl ?? child.foto /* último recurso */}
            sample={{
              name: child.nome,
              publicId: child.id, // ou child.publicId se tiver
              ageText,
              wantedGift: child.presente,
              cityName: child.cidade,
              communityName: child.comunidade,
            }}
            alt={child.nome}
            className="absolute inset-0"
            imgClassName="object-cover w-full h-full"
            // quality={0.9}
          />
        ) : (
          // fallback antigo (caso não haja images[])
          <img
            src={child.foto || ''}
            alt={child.nome}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </div>

      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[#253243]">
            {child.nome} - {child.idade} anos
          </h3>
          {indisponivel ? (
            <span className="text-xs border px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border-amber-100">
              {badgeText}
            </span>
          ) : (
            <span className="text-xs border px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border-emerald-100">
              Disponível
            </span>
          )}
        </div>

        {metaLine && <p className="text-sm text-gray-600">{metaLine}</p>}

        {(child.presente || child.categoria) && (
          <p className="text-sm text-gray-600">
            Presente: {child.presente ?? child.categoria}
          </p>
        )}

        {/* Se quiser mostrar a descrição:
        {child.descricao && (
          <p className="text-sm text-gray-500 line-clamp-2">{child.descricao}</p>
        )} */}

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
