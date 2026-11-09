'use client';

import { useState, useMemo } from 'react';
import { Cake, Gift, Loader2, MapPin, ShieldCheck } from 'lucide-react';
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
  footer,
}: {
  child: {
    id: string;
    publicId: number;       // opcional para mostrar no Card / ComposedImage
    nome: string;
    idade?: number;         // já calculada (sem data nem idade no cadastro: não mostra)
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
  /** substitui o botão "Apadrinhar" (ex.: acompanhamento em "Meus apadrinhamentos") */
  footer?: React.ReactNode;
}) {
  const [imgErr, setImgErr] = useState(false);
  const indisponivel = child.apadrinhado === true; // compat: vem pronto do backend

  const metaLineParts = [child.cidade, child.comunidade, child.escola].filter(Boolean);
  const metaLine = metaLineParts.join(' • ');
  const ageText = typeof child.idade === 'number' ? `${child.idade} ${child.idade === 1 ? 'ano' : 'anos'}` : '';

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
    <div className="h-full flex flex-col border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition duration-200">
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

      <div className="p-2.5 sm:p-4 flex flex-col gap-1.5 sm:gap-2 flex-1">
        {/* nome e ID; o selo fica embaixo para caber em cartões estreitos (2 colunas no celular) */}
        <div className="min-w-0">
          <h3 className="font-semibold text-[#253243] text-sm sm:text-base leading-snug line-clamp-2" title={child.nome}>
            {child.nome}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {child.publicId ? <span className="text-[11px] sm:text-xs font-mono text-gray-500">#{child.publicId}</span> : null}
            {indisponivel ? (
              child.status && child.status !== 'NONE' ? (
                <StatusBadge status={child.status as SponsorshipStatus} />
              ) : (
                <span className="text-xs border px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border-amber-100">
                  {fallbackBadgeText}
                </span>
              )
            ) : (
              <span className="text-[11px] sm:text-xs font-semibold border px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border-emerald-100">
                Disponível
              </span>
            )}
          </div>
        </div>

        <div className="space-y-1 text-xs sm:text-sm text-gray-600">
          {typeof child.idade === 'number' && (
            <p className="flex items-center gap-1.5"><Cake className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {ageText}</p>
          )}
          {metaLine && (
            <p className="flex items-start gap-1.5" title={metaLine}>
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" /> <span className="line-clamp-2">{metaLine}</span>
            </p>
          )}
          {(child.presente || child.categoria) && (
            <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-100 px-2 py-1.5 text-amber-900" title={child.presente || child.categoria}>
              <Gift className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" /> <span className="line-clamp-2 font-medium">{child.presente || child.categoria}</span>
            </p>
          )}
        </div>

        <div className="pt-1 sm:pt-2 mt-auto">
          {footer ? footer : !indisponivel ? (
            <button
              onClick={onSponsor}
              disabled={sponsoring}
              className="w-full text-sm px-3 py-2 sm:py-2.5 bg-[#253243] text-white font-semibold rounded-lg hover:bg-[#375A7F] active:scale-[0.98] inline-flex items-center justify-center gap-1.5 disabled:opacity-70 transition"
            >
              {sponsoring ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Abrindo…</span>
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
              className="w-full text-sm px-3 py-2 bg-gray-100 text-gray-500 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-not-allowed"
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
