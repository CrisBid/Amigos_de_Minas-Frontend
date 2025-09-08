'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Loader2, AlertCircle, Copy, Check } from 'lucide-react';

type Props = {
  initialChildId: string;
  initialCampaignId: string;
};

type PaymentMethod = 'PIX' | 'DROP_OFF';

export default function ConcluirClient({ initialChildId, initialCampaignId }: Props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const api = process.env.NEXT_PUBLIC_NEST_API_URL;

  const childId = initialChildId || '';
  const campaignId = initialCampaignId || '';

  // Se tiver tipagem do token/sessão, troque esse cast
  const accessToken = useMemo(
    () => (session as unknown as { accessToken?: string } | null)?.accessToken,
    [session]
  );

  // Configurações via ENV (com defaults seguros)
  const PIX_KEY = process.env.NEXT_PUBLIC_PIX_KEY || '';
  const PIX_FAV = process.env.NEXT_PUBLIC_PIX_FAVORECIDO || 'ONG Amigos de Minas';
  const PIX_CNPJ = process.env.NEXT_PUBLIC_PIX_CNPJ || '';
  const PIX_OBS  = process.env.NEXT_PUBLIC_PIX_OBS || 'Apadrinhamento';
  const DROP_IMG = process.env.NEXT_PUBLIC_DROPPOINTS_IMAGE || '/images/pontos-coleta.png';

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // método escolhido pelo doador
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');

  // UX de copiar chave PIX
  const [copied, setCopied] = useState(false);

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
      // Se quiser registrar a preferência de entrega no backend, envie junto:
      const body: Record<string, unknown> = { childId, campaignId, deliveryMethod: paymentMethod };
      // Ajuste o nome do campo conforme seu DTO no Nest: ex: deliveryMethod / contributionMethod / handoverType

      const res = await fetch(`${api}/sponsorships`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
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

  function PixInstructions() {
    return (
      <div className="space-y-3">
        <p className="text-emerald-800">
          Obrigado por apadrinhar! 💚 Para realizar a contribuição via <b>PIX</b>, use os dados abaixo:
        </p>

        <div className="bg-white border border-emerald-200 rounded-xl p-4">
          <div className="text-sm text-gray-700 space-y-2">
            <div><b>Chave PIX:</b> <span className="select-all">{PIX_KEY || '—'}</span></div>
            <div><b>Favorecido:</b> {PIX_FAV}</div>
            {PIX_CNPJ && <div><b>CNPJ:</b> {PIX_CNPJ}</div>}
            {PIX_OBS && <div><b>Observação:</b> {PIX_OBS}</div>}
          </div>

          <div className="mt-3">
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(PIX_KEY);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {}
              }}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 inline-flex items-center gap-2 disabled:opacity-70"
              disabled={!PIX_KEY}
              title={PIX_KEY ? 'Copiar chave PIX' : 'Nenhuma chave configurada'}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar chave'}
            </button>
          </div>
        </div>

        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
          <li>No comprovante, se possível, informe no campo de <i>mensagem</i> o código/nome da criança.</li>
          <li>Guarde o comprovante. Caso necessário, nossa equipe pode solicitar para conciliação.</li>
          <li>O presente será adquirido e entregue pela ONG, conforme a campanha.</li>
        </ul>
      </div>
    );
  }

  function DropOffInstructions() {
    return (
      <div className="space-y-3">
        <p className="text-emerald-800">
          Obrigado por apadrinhar! 💚 Você escolheu <b>entregar o presente em um ponto de coleta</b>.
        </p>

        <div className="bg-white border border-emerald-200 rounded-xl p-4">
          <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
            <li>Embale o presente com carinho. ✔</li>
            <li>
              Identifique do lado de fora com: <b>Nome da criança</b> (ou código) e <b>Campanha</b>.
              {/** Se você tiver o nome/código real, pode renderizar aqui. */}
            </li>
            <li>Entregue em qualquer um dos pontos de coleta listados na imagem abaixo.</li>
            <li>Prazo recomendado: até a data limite da campanha (informe aqui, se desejar).</li>
          </ul>

          <div className="mt-4">
            {/* A imagem pode ser um banner com endereços/horários. Troque o src via ENV se preferir */}
            <img
              src={DROP_IMG}
              alt="Pontos de coleta"
              className="w-full rounded-lg border border-emerald-100"
            />
          </div>
        </div>

        <p className="text-sm text-gray-600">
          Dúvidas? Fale com a equipe pelo WhatsApp da ONG. Obrigado por fazer a magia acontecer! ✨
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-[#253243] mb-2">Confirmar Apadrinhamento</h1>
      <p className="text-sm text-gray-600 mb-6">
        Revise os dados, escolha a forma de entrega e confirme o apadrinhamento desta campanha.
      </p>

      {/* Resumo simples (se tiver como enriquecer com nome/cidade da criança, ótimo) */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="text-sm text-gray-700 space-y-1">
          <div><b>Campanha:</b> {campaignId}</div>
          <div><b>Criança:</b> {childId}</div>
        </div>
      </div>

      {/* Escolha de método */}
      {!done && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <div className="text-sm font-semibold text-gray-800 mb-2">Como você prefere contribuir?</div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                value="PIX"
                checked={paymentMethod === 'PIX'}
                onChange={() => setPaymentMethod('PIX')}
                className="h-4 w-4"
              />
              <span className="text-sm text-gray-700">PIX (transferência para a ONG)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                value="DROP_OFF"
                checked={paymentMethod === 'DROP_OFF'}
                onChange={() => setPaymentMethod('DROP_OFF')}
                className="h-4 w-4"
              />
              <span className="text-sm text-gray-700">Entregar o presente em um ponto de coleta</span>
            </label>
          </div>
        </div>
      )}

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
        <div className="text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <b>Pronto!</b> Seu apadrinhamento foi registrado. 💚
          <div className="mt-4">
            {paymentMethod === 'PIX' ? <PixInstructions /> : <DropOffInstructions />}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
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
    return (d as { message?: string; error?: string })?.message || (d as any)?.error || res.statusText;
  } catch {
    return res.statusText;
  }
}
