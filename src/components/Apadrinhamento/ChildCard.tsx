'use client';

import { useState, useMemo } from 'react';
import { Gift, Loader2, ShieldCheck } from 'lucide-react';
import ComposedImage, { ComposeConfig } from '@/components/media/ComposedImage';
import { pickComposeInputsFromImages } from '@/components/media/pickComposeInputs';

// 🔽 core de status (front-only)
import {
  STATUS_PT,
  type SponsorshipStatus,
} from '@/lib/sponsorship-status';
import StatusBadge from '@/components/Sponsorship/StatusBadge';

type Status = SponsorshipStatus | 'NONE';

export default function ChildCard({
  child,
  onSponsor,
  sponsoring = false,
}: {
  child: {
    id: string;
    publicId: number;       // opcional para mostrar no Card / ComposedImage
    nome: string;
    idade: number;          // já calculada
    cidade: string;
    comunidade?: string;
    escola?: string;
    categoria?: string;
    presente?: string;      // wantedGift
    descricao?: string;
    foto?: string;
    apadrinhado: boolean;   // true quando PENDING/IN_PROGRESS.../COMPLETED
    status?: Status;
    images?: any;
  };
  onSponsor?: () => void;
  sponsoring?: boolean;
}) {
  const [imgErr, setImgErr] = useState(false);
  const indisponivel = child.apadrinhado === true; // compat: vem pronto do backend

  const metaLineParts = [child.cidade, child.comunidade, child.escola].filter(Boolean);
  const metaLine = metaLineParts.join(' • ');
  const ageText = `${child.idade} anos`;

  // se tiver images[] disponível:
  const composeInputs = useMemo(
    () => pickComposeInputsFromImages(child.images),
    [child.images]
  );

  // texto de fallback quando houver status mas não quisermos o componente
  const fallbackBadgeText = child.status && child.status !== 'NONE'
    ? (STATUS_PT[child.status as SponsorshipStatus] ?? 'Indisponível')
    : 'Indisponível';

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition bg-white">
      <div className="aspect-[9/16] bg-gray-100 relative">
        {composeInputs ? (
          <ComposedImage
            photoUrl={composeInputs.photoUrl}
            layoutUrl={composeInputs.layoutUrl}
            config={composeInputs.config as ComposeConfig}
            fallbackUrl={composeInputs.fallbackUrl ?? child.foto /* último recurso */}
            sample={{
              name: child.nome,
              publicId: String(child.publicId ?? child.id),
              ageText,
              wantedGift: child.presente,
              cityName: child.cidade,
              communityName: child.comunidade,
            }}
            alt={child.nome}
            className="absolute inset-0"
            imgClassName="object-cover w-full h-full"
          />
        ) : (
          // fallback (sem composed image)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={child.foto || ''}
            alt={child.nome}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
        )}
      </div>

      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[#253243]">
            {child.nome} {typeof child.publicId !== 'undefined' ? `- ${child.publicId}` : ''}
          </h3>

          {indisponivel ? (
            child.status && child.status !== 'NONE' ? (
              <StatusBadge status={child.status as SponsorshipStatus} />
            ) : (
              <span className="text-xs border px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border-amber-100">
                {fallbackBadgeText}
              </span>
            )
          ) : (
            <span className="text-xs border px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border-emerald-100">
              Disponível
            </span>
          )}
        </div>

        {typeof child.idade === 'number' && (
          <p className="text-sm text-gray-600">Idade: {child.idade} anos</p>
        )}

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
              {sponsoring ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Apadrinhando...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Apadrinhar</span>
                </>
              )}
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
