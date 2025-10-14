'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Loader2, AlertCircle, Copy, Check, Info, Shield, MessageSquare } from 'lucide-react';
import PixQr from '@/components/Pix/PixQr';

type Props = {
  initialChildId: string;
  initialCampaignId: string;
};

type PaymentMethod = 'PIX' | 'DROP_OFF';
type SponsorshipMethod = 'PIX' | 'GIFT';

export default function ConcluirClient({ initialChildId, initialCampaignId }: Props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const api = process.env.NEXT_PUBLIC_NEST_API_URL;

  // --- Campanha
  const campaignId = (initialCampaignId || '').trim();

  // --- Suporte a múltiplos IDs vindos por query (?childIds=a,b,c) OU único via prop
  const childIdsFromQuery = useMemo(() => {
    const qs = searchParams?.get('childIds') || '';
    if (!qs) return [];
    return qs.split(',').map(s => s.trim()).filter(Boolean);
  }, [searchParams]);

  const singleChildId = (initialChildId || '').trim();
  const childIds: string[] = useMemo(() => {
    if (childIdsFromQuery.length > 0) return childIdsFromQuery;
    return singleChildId ? [singleChildId] : [];
  }, [childIdsFromQuery, singleChildId]);

  // token
  const accessToken = useMemo(
    () => (session as unknown as { accessToken?: string } | null)?.accessToken,
    [session]
  );

  // PIX/Dropoff config
  const PIX_KEY = process.env.NEXT_PUBLIC_PIX_KEY || '';
  const PIX_FAV = process.env.NEXT_PUBLIC_PIX_FAVORECIDO || 'ONG Amigos de Minas';
  const PIX_CNPJ = process.env.NEXT_PUBLIC_PIX_CNPJ || '';
  const PIX_OBS = process.env.NEXT_PUBLIC_PIX_OBS || 'Apadrinhamento';
  const DROP_IMG = process.env.NEXT_PUBLIC_DROPPOINTS_IMAGE || '/images/pontos-coleta.png';

  // estado UI
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [copied, setCopied] = useState(false);
  const [guidelinesAccepted, setGuidelinesAccepted] = useState(false);

  // nomes
  const [childName, setChildName] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState<string | null>(null);
  const [loadingNames, setLoadingNames] = useState(true);

  // Busca nomes (se 1 criança, busca nome; se múltiplas, só campanha)
  useEffect(() => {
    async function fetchNames() {
      if (!api || !campaignId) {
        setLoadingNames(false);
        return;
      }
      setLoadingNames(true);
      try {
        let fetchedChildName: string | null = null;
        if (childIds.length === 1) {
          const resChild = await fetch(`${api}/children/${childIds[0]}`);
          if (resChild.ok) {
            const jd = await resChild.json();
            fetchedChildName = jd?.name ?? null;
          }
        }
        const resCamp = await fetch(`${api}/campaigns/${campaignId}`);
        const campData = resCamp.ok ? await resCamp.json() : null;

        setChildName(fetchedChildName);
        setCampaignName(campData?.name ?? null);
      } catch {
        setChildName(null);
        setCampaignName(null);
      } finally {
        setLoadingNames(false);
      }
    }
    fetchNames();
  }, [api, campaignId, childIds]);

  // Redireciona se não logado (preserva childIds quando múltiplo)
  useEffect(() => {
    if (status === 'unauthenticated') {
      const base = `/apadrinhamento/registro`;
      const q = new URLSearchParams();
      if (childIds.length > 1) q.set('childIds', childIds.join(','));
      if (childIds.length === 1) q.set('childId', childIds[0]);
      q.set('campaignId', campaignId);
      router.replace(`${base}?${q.toString()}`);
    }
  }, [status, childIds, campaignId, router]);

  function mapPaymentToMethod(p: PaymentMethod): SponsorshipMethod {
    return p === 'PIX' ? 'PIX' : 'GIFT';
  }

  async function confirm() {
    if (!api || !accessToken) {
      setError('Sessão inválida.');
      return;
    }
    if (!campaignId) {
      setError('Campanha inválida.');
      return;
    }
    if (childIds.length === 0) {
      setError('Nenhuma criança selecionada.');
      return;
    }
    if (!guidelinesAccepted) {
      setError('Você precisa aceitar as orientações antes de confirmar.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const method: SponsorshipMethod = mapPaymentToMethod(paymentMethod);

      // monta body conforme quantidade
      const body =
        childIds.length === 1
          ? { childId: childIds[0], campaignId, method }
          : { childIds, campaignId, method };

      const res = await fetch(`${api}/sponsorships`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(await safeErrMsg(res));

      // opcional: você pode ler o resumo de criação para exibir detalhes
      // const summary = await res.json();

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
            {/* Se você quiser gerar QR dinâmico por criança/campanha, reative o PixQr e adapte a descrição */}
            {/* <PixQr ... /> */}
            <div>
              <b>Chave PIX:</b> <span className="select-all">{PIX_KEY || '—'}</span>
            </div>
            <div>
              <b>Favorecido:</b> {PIX_FAV}
            </div>
            {PIX_CNPJ && (
              <div>
                <b>CNPJ:</b> {PIX_CNPJ}
              </div>
            )}
            {PIX_OBS && (
              <div>
                <b>Observação:</b> {PIX_OBS}
              </div>
            )}
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
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar chave'}
            </button>
          </div>
        </div>
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
            <li>Embale o presente com material <b>impermeável</b> e identifique com o nome/numeração e campanha.</li>
            <li>Entregue em um dos pontos de coleta listados na imagem abaixo.</li>
          </ul>

          <div className="mt-4">
            <img src={DROP_IMG} alt="Pontos de coleta" className="w-full rounded-lg border border-emerald-100" />
          </div>
        </div>
      </div>
    );
  }

  function GuidelinesCard() {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
            <Info className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-[#253243]">Orientações do presente</h2>
        </div>

        <div className="text-sm text-gray-700 space-y-3">
          <p className="font-medium text-[#253243]">Gentileza respeitar a opção da criança!</p>
          <p>O presente deve ser o escolhido pela criança, podendo haver complementos, mas <b>sem substituições</b>.</p>
          <p>Somente <b>itens novos</b> (brinquedos usados devem ir à campanha de brinquedos).</p>
          <p>Use <b>embalagem impermeável</b> e identifique com <b>Nº/Nome/Cidade</b> e campanha.</p>
        </div>

        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
          <Shield className="w-4 h-4 text-blue-700" />
          <span className="text-xs sm:text-sm text-blue-900">
            Essas orientações garantem que o presente chegue corretamente e com segurança. 💙
          </span>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={guidelinesAccepted}
            onChange={(e) => setGuidelinesAccepted(e.target.checked)}
          />
          <span>Li e concordo com as orientações do programa de apadrinhamento.</span>
        </label>
      </div>
    );
  }

  // helper para título/identificação
  const childLabel = useMemo(() => {
    if (childIds.length === 0) return '—';
    if (childIds.length === 1) return childName || childIds[0];
    return `${childIds.length} crianças selecionadas`;
  }, [childIds, childName]);

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-[#253243] mb-2">Confirmar Apadrinhamento</h1>
      <p className="text-sm text-gray-600 mb-6">
        Revise as informações abaixo, leia as orientações e confirme seu apadrinhamento.
      </p>

      {/* Exibe nomes */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        {loadingNames ? (
          <p className="text-sm text-gray-500">Carregando dados...</p>
        ) : (
          <div className="text-sm text-gray-700 space-y-1">
            <div>
              <b>Campanha:</b> {campaignName || campaignId || '—'}
            </div>
            <div>
              <b>{childIds.length > 1 ? 'Crianças:' : 'Criança:'}</b> {childLabel}
            </div>
          </div>
        )}
      </div>

      {!done && <GuidelinesCard />}

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
          disabled={submitting || !guidelinesAccepted || childIds.length === 0}
          className="px-4 py-2 bg-[#253243] text-white rounded-lg hover:bg-[#375A7F] inline-flex items-center gap-2 disabled:opacity-70"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {submitting ? 'Confirmando...' : 'Confirmar apadrinhamento'}
        </button>
      ) : (
        <div className="text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-5">
          <div className="flex items-center gap-2 font-semibold text-emerald-700">
            <CheckCircle className="w-5 h-5" /> Apadrinhamento registrado com sucesso!
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3 text-sm text-gray-700">
            <div>
              <b>Campanha:</b> {campaignName || campaignId}
            </div>
            <div>
              <b>{childIds.length > 1 ? 'Crianças:' : 'Criança:'}</b> {childLabel}
            </div>
          </div>

          {paymentMethod === 'PIX' ? <PixInstructions /> : <DropOffInstructions />}

          <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-sm text-yellow-900">
            <MessageSquare className="w-4 h-4 mt-0.5 text-yellow-700" />
            <span>
              Nossa equipe entrará em contato para <b>finalizar</b> e confirmar todos os detalhes. 💛
            </span>
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
