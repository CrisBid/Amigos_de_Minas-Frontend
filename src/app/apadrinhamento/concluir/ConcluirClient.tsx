'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

type Props = {
  initialChildId: string;
  initialCampaignId: string;
};

export default function ConcluirClient({ initialChildId, initialCampaignId }: Props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const api = process.env.NEXT_PUBLIC_NEST_API_URL;

  const childId = initialChildId || '';
  const campaignId = initialCampaignId || '';

  // se você tiver tipagem do token/sessão, troque esse cast
  const accessToken = useMemo(
    () => (session as unknown as { accessToken?: string } | null)?.accessToken,
    [session]
  );

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // se não logado, manda para registro especial
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(
        `/apadrinhamento/registro?childId=${encodeURIComponent(childId)}&campaignId=${encodeURIComponent(
          campaignId
        )}`
      );
    }
  }, [status, childId, campaignId, router]);

  async function confirm() {
    if (!api || !accessToken) {
      setError('Sessão inválida.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${api}/sponsorships`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ childId, campaignId }),
      });
      if (!res.ok) throw new Error(await safeErrMsg(res));
      setDone(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível concluir o apadrinhamento.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-[#253243] mb-2">Confirmar Apadrinhamento</h1>
      <p className="text-sm text-gray-600 mb-6">
        Revise os dados e confirme para concluir o apadrinhamento desta campanha.
      </p>

      {/* Resumo simples */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="text-sm text-gray-700">
          <div>
            <b>Campanha:</b> {campaignId}
          </div>
          <div>
            <b>Criança:</b> {childId}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {!done ? (
        <button
          onClick={confirm}
          disabled={submitting}
          className="px-4 py-2 bg-[#253243] text-white rounded-lg hover:bg-[#375A7F] inline-flex items-center gap-2 disabled:opacity-70"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {submitting ? 'Confirmando...' : 'Confirmar apadrinhamento'}
        </button>
      ) : (
        <div className="text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <b>Pronto!</b> Seu apadrinhamento foi registrado. 💚
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => router.push('/meus-apadrinhamentos')}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
            >
              Ver meus apadrinhamentos
            </button>
            <button
              onClick={() => router.push('/apadrinhamento')}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              Voltar à lista
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

async function safeErrMsg(res: Response) {
  try {
    const d = await res.json();
    return (d as { message?: string; error?: string })?.message || d?.error || res.statusText;
  } catch {
    return res.statusText;
  }
}
