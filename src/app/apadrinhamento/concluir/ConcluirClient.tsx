'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowLeft, CalendarClock, Check, CheckCircle, Copy, Gift, Info, Loader2, MapPin, MessageSquare, Phone, QrCode, Shield,
} from 'lucide-react';

type Props = {
  initialChildId: string;
  initialCampaignId: string;
};

type PaymentMethod = 'PIX' | 'DROP_OFF';
type SponsorshipMethod = 'PIX' | 'GIFT';

type CollectionPoint = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  address?: string | null;
  district?: string | null;
  cityName?: string | null;
  state?: string | null;
  zipCode?: string | null;
  phone?: string | null;
  active: boolean;
};

type ChildInfo = {
  id: string;
  publicId?: number | null;
  name: string;
  wantedGift?: string | null;
  cityName?: string | null;
  city?: { name: string } | null;
  community?: { name: string } | null;
};

type CampaignInfo = { id: string; name: string; status?: string; endDate?: string | null };

// PIX config
const PIX_KEY = process.env.NEXT_PUBLIC_PIX_KEY || '';
const PIX_FAV = process.env.NEXT_PUBLIC_PIX_FAVORECIDO || 'ONG Amigos de Minas';
const PIX_CNPJ = process.env.NEXT_PUBLIC_PIX_CNPJ || '';
const PIX_OBS = process.env.NEXT_PUBLIC_PIX_OBS || 'Apadrinhamento';

// Imagem com os pontos, se a lista não vier do backend
const DROP_IMG = process.env.NEXT_PUBLIC_DROPPOINTS_IMAGE || '/assets/Coleta.jpg';

/** Data da campanha por extenso. A data é guardada à meia-noite UTC: formatar em UTC evita mostrar o dia anterior. */
function formatDeadline(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

function pointAddress(p: CollectionPoint) {
  return `${p.address || '—'}${p.district ? `, ${p.district}` : ''}`;
}

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

  // estado UI
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [guidelinesAccepted, setGuidelinesAccepted] = useState(false);

  // crianças e campanha
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [loadingNames, setLoadingNames] = useState(true);
  // crianças que outra pessoa apadrinhou antes de confirmar (lote)
  const [skippedIds, setSkippedIds] = useState<string[]>([]);

  // pontos de coleta
  const [points, setPoints] = useState<CollectionPoint[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(true);
  const [selectedPointId, setSelectedPointId] = useState<string>('');

  // Data limite: vem da campanha (sem data cadastrada, o aviso não aparece)
  const deadline = formatDeadline(campaign?.endDate);
  const campaignClosed = !!campaign?.status && campaign.status !== 'ACTIVE';

  // Crianças (ID e presente desta campanha) e campanha
  useEffect(() => {
    async function fetchNames() {
      if (!api || !campaignId) {
        setLoadingNames(false);
        return;
      }
      setLoadingNames(true);
      try {
        const [kids, resCamp] = await Promise.all([
          Promise.all(
            childIds.map(async (id) => {
              const r = await fetch(`${api}/children/${id}?campaignId=${encodeURIComponent(campaignId)}`);
              return r.ok ? ((await r.json()) as ChildInfo) : null;
            })
          ),
          fetch(`${api}/campaigns/${campaignId}`),
        ]);
        setChildren(kids.filter((k): k is ChildInfo => !!k));
        setCampaign(resCamp.ok ? await resCamp.json() : null);
      } catch {
        setChildren([]);
        setCampaign(null);
      } finally {
        setLoadingNames(false);
      }
    }
    fetchNames();
  }, [api, campaignId, childIds]);

  // Carrega pontos de coleta ativos do backend
  useEffect(() => {
    async function fetchPoints() {
      if (!api) { setLoadingPoints(false); return; }
      setLoadingPoints(true);
      try {
        const res = await fetch(`${api}/collection-points?active=true`, { cache: 'no-store' });
        if (!res.ok) { setPoints([]); return; }
        const js = await res.json();
        const list: CollectionPoint[] = Array.isArray(js?.items)
          ? js.items
          : Array.isArray(js?.data)
          ? js.data
          : Array.isArray(js)
          ? js
          : [];
        setPoints(list.filter(p => p.active));
      } catch {
        setPoints([]);
      } finally {
        setLoadingPoints(false);
      }
    }
    fetchPoints();
  }, [api]);

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

  // Auto-seleciona um ponto quando o usuário escolhe DROP_OFF e houver pontos
  useEffect(() => {
    if (paymentMethod !== 'DROP_OFF') return;
    if (loadingPoints) return;
    if (!points || points.length === 0) return;
    if (!selectedPointId) setSelectedPointId(points[0].id);
  }, [paymentMethod, loadingPoints, points, selectedPointId]);

  async function confirm() {
    if (!api || !accessToken) {
      setError('Sessão inválida. Entre novamente para continuar.');
      return;
    }
    if (!campaignId) {
      setError('Campanha inválida.');
      return;
    }
    if (campaignClosed) {
      setError('Esta campanha não está mais recebendo apadrinhamentos.');
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

    const method: SponsorshipMethod = mapPaymentToMethod(paymentMethod);

    // Regras para GIFT (DROP_OFF)
    if (method === 'GIFT') {
      if (loadingPoints) {
        setError('Aguarde carregar os pontos de coleta.');
        return;
      }
      if (!selectedPointId?.trim()) {
        setError('Selecione um ponto de coleta para a entrega.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      // monta body conforme quantidade (inclui collectionPointId quando método = GIFT)
      const common: any = {
        campaignId,
        method,
        ...(method === 'GIFT' ? { collectionPointId: selectedPointId.trim() } : {}),
      };

      const body =
        childIds.length === 1
          ? { ...common, childId: childIds[0] }
          : { ...common, childIds };

      const res = await fetch(`${api}/sponsorships`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(await safeErrMsg(res));

      // Lote: o backend pula quem já foi apadrinhado e responde 201 mesmo sem criar nenhum
      const result = await res.json().catch(() => null);
      if (childIds.length > 1 && result) {
        if (!result.created) {
          throw new Error('Essas crianças já foram apadrinhadas por outras pessoas. Volte à lista e escolha outras.');
        }
        setSkippedIds([...(result.skipped?.duplicatedIds ?? []), ...(result.skipped?.missingIds ?? [])]);
      }

      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível concluir o apadrinhamento.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedPoint = points.find(p => p.id === selectedPointId) ?? null;
  const skipped = children.filter(c => skippedIds.includes(c.id));
  const confirmedChildren = children.filter(c => !skippedIds.includes(c.id));
  const multiple = childIds.length > 1;

  if (childIds.length === 0 || !campaignId) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-bold text-[#253243] mb-2">Confirmar apadrinhamento</h1>
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-700">
          <p className="mb-4">Nenhuma criança foi selecionada. Escolha uma criança na lista para continuar.</p>
          <Link href="/apadrinhamento" className="inline-flex px-4 py-2 bg-[#253243] text-white rounded-lg hover:bg-[#375A7F]">
            Ver crianças
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2 text-lg font-semibold text-emerald-700">
            <CheckCircle className="w-6 h-6 shrink-0" /> Apadrinhamento registrado com sucesso!
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-700 mb-3"><b>Campanha:</b> {campaign?.name ?? campaignId}</p>
            <ChildList items={confirmedChildren} />
          </div>

          {skipped.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {skipped.length === 1 ? 'Esta criança foi apadrinhada' : 'Estas crianças foram apadrinhadas'} por outra pessoa antes da sua confirmação e não {skipped.length === 1 ? 'entrou' : 'entraram'} no seu pedido:{' '}
                <b>{skipped.map(c => c.name).join(', ')}</b>.
              </span>
            </div>
          )}

          {paymentMethod === 'PIX' ? (
            <PixInstructions />
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-white p-4 text-sm text-gray-800">
              <div className="font-semibold mb-2">Ponto de coleta escolhido</div>
              {selectedPoint ? <PointDetails point={selectedPoint} /> : <div>—</div>}
              <ul className="text-xs text-gray-600 list-disc pl-5 space-y-1 mt-3">
                <li>Embale o presente com material <b>impermeável</b> e identifique com <b>Nº, nome, cidade</b> e campanha.</li>
                <li>Confira os horários de funcionamento do ponto escolhido.</li>
              </ul>
            </div>
          )}

          <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-sm text-yellow-900">
            <MessageSquare className="w-4 h-4 mt-0.5 shrink-0 text-yellow-700" />
            <span>
              Nossa equipe entrará em contato para <b>finalizar</b> e confirmar todos os detalhes. 💛
              {deadline && (
                <>
                  <br />
                  <b>Data limite {paymentMethod === 'PIX' ? 'para a contribuição' : 'para entrega'}: {deadline}</b>.
                </>
              )}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push('/meus-apadrinhamentos')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
            >
              Ver meus apadrinhamentos
            </button>
            <button
              onClick={() => router.push('/apadrinhamento')}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              Apadrinhar mais crianças
            </button>
          </div>
        </div>
      </div>
    );
  }

  const canConfirm =
    !submitting &&
    !campaignClosed &&
    status === 'authenticated' &&
    guidelinesAccepted &&
    (paymentMethod !== 'DROP_OFF' || (!loadingPoints && !!selectedPointId));

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/apadrinhamento" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar à lista
      </Link>
      <h1 className="text-2xl font-bold text-[#253243] mb-1">Confirmar apadrinhamento</h1>
      <p className="text-sm text-gray-600 mb-6">
        Confira {multiple ? 'as crianças' : 'a criança'}, leia as orientações e escolha como contribuir.
      </p>

      {campaignClosed && (
        <div className="mb-4 flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>A campanha <b>{campaign?.name}</b> não está mais recebendo apadrinhamentos.</span>
        </div>
      )}

      {/* 1. Quem será apadrinhado */}
      <section className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <StepTitle n={1} title={multiple ? `${childIds.length} crianças selecionadas` : 'Criança selecionada'} />
        {loadingNames ? (
          <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando dados…</p>
        ) : (
          <>
            <p className="text-sm text-gray-700 mb-3"><b>Campanha:</b> {campaign?.name ?? campaignId}</p>
            <ChildList items={children} />
            {children.length < childIds.length && (
              <p className="text-xs text-amber-700 mt-2">Não conseguimos carregar os dados de {childIds.length - children.length} criança(s).</p>
            )}
          </>
        )}
      </section>

      {/* 2. Orientações */}
      <section className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-4">
        <StepTitle n={2} title="Orientações do presente" />

        <div className="text-sm text-gray-700 space-y-2">
          <p className="font-medium text-[#253243]">Gentileza respeitar a opção da criança!</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>O presente deve ser o escolhido pela criança, podendo haver complementos, mas <b>sem substituições</b>.</li>
            <li>Somente <b>itens novos</b> (brinquedos usados devem ir à campanha de brinquedos).</li>
            <li>Use <b>embalagem impermeável</b> e identifique com <b>Nº, nome, cidade</b> e campanha.</li>
          </ul>
        </div>

        {deadline && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-sm text-yellow-900">
            <CalendarClock className="w-4 h-4 shrink-0 text-yellow-700" />
            <span><b>Data limite para entrega: {deadline}</b></span>
          </div>
        )}

        <label className="flex items-start gap-2 text-sm cursor-pointer rounded-lg bg-blue-50 border border-blue-100 p-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={guidelinesAccepted}
            onChange={(e) => setGuidelinesAccepted(e.target.checked)}
          />
          <span className="text-blue-950">Li e concordo com as orientações do programa de apadrinhamento.</span>
        </label>
      </section>

      {/* 3. Como contribuir */}
      <section className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <StepTitle n={3} title="Como você prefere contribuir?" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <MethodOption
            active={paymentMethod === 'PIX'}
            onSelect={() => setPaymentMethod('PIX')}
            icon={<QrCode className="w-5 h-5" />}
            title="PIX"
            text="Transferência para a ONG, a partir de R$ 50,00"
          />
          <MethodOption
            active={paymentMethod === 'DROP_OFF'}
            onSelect={() => setPaymentMethod('DROP_OFF')}
            icon={<Gift className="w-5 h-5" />}
            title="Entregar o presente"
            text="Você compra e leva a um ponto de coleta"
          />
        </div>

        {paymentMethod === 'PIX' && (
          <p className="text-xs text-gray-500 mt-3 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Os dados do PIX aparecem depois de confirmar.
          </p>
        )}

        {paymentMethod === 'DROP_OFF' && (
          <div className="mt-4 space-y-3">
            {loadingPoints ? (
              <p className="text-sm text-gray-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando pontos de coleta…</p>
            ) : points.length > 0 ? (
              <>
                <label className="block text-sm font-semibold text-gray-700">
                  Ponto de coleta *
                  <select
                    value={selectedPointId}
                    onChange={(e) => setSelectedPointId(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 bg-white font-normal focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Selecione…</option>
                    {points.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.cityName ? `• ${p.cityName}${p.state ? `/${p.state}` : ''}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedPoint && (
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm">
                    <PointDetails point={selectedPoint} />
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  Não há pontos de coleta disponíveis no momento, então esta opção não pode ser confirmada agora. Escolha o PIX ou tente mais tarde.
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={DROP_IMG} alt="Pontos de coleta" className="w-full rounded-lg border border-gray-100" />
              </>
            )}
          </div>
        )}
      </section>

      {error && (
        <div className="mb-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3" role="alert">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}

      <button
        onClick={confirm}
        disabled={!canConfirm}
        className="w-full sm:w-auto px-6 py-3 bg-[#253243] text-white rounded-lg hover:bg-[#375A7F] inline-flex items-center justify-center gap-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        {submitting ? 'Confirmando…' : 'Confirmar apadrinhamento'}
      </button>
      {!guidelinesAccepted && !submitting && (
        <p className="text-xs text-gray-500 mt-2">Para confirmar, aceite as orientações no passo 2.</p>
      )}
    </div>
  );
}

/* ===================== Partes da tela ===================== */

function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-6 h-6 rounded-full bg-[#253243] text-white text-xs font-bold flex items-center justify-center shrink-0">{n}</span>
      <h2 className="text-base font-semibold text-[#253243]">{title}</h2>
    </div>
  );
}

/** Quem está sendo apadrinhado e o presente de cada um, nesta campanha */
function ChildList({ items }: { items: ChildInfo[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg max-h-72 overflow-y-auto">
      {items.map((c) => {
        const place = [c.community?.name, c.city?.name ?? c.cityName].filter(Boolean).join(' • ');
        return (
          <li key={c.id} className="px-3 py-2 text-sm">
            <div className="font-medium text-gray-900">
              {c.publicId != null && <span className="text-gray-500 font-normal">{c.publicId} · </span>}
              {c.name}
            </div>
            {place && <div className="text-xs text-gray-500">{place}</div>}
            <div className="text-xs text-gray-700 mt-0.5 flex items-center gap-1">
              <Gift className="w-3 h-3 text-emerald-600 shrink-0" />
              {c.wantedGift?.trim() || 'Presente a confirmar com a equipe'}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MethodOption({ active, onSelect, icon, title, text }: {
  active: boolean; onSelect: () => void; icon: React.ReactNode; title: string; text: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`text-left rounded-xl border p-3 transition ${active ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-gray-200 hover:bg-gray-50'}`}
    >
      <div className={`flex items-center gap-2 font-semibold ${active ? 'text-emerald-800' : 'text-gray-800'}`}>{icon} {title}</div>
      <div className="text-xs text-gray-600 mt-1">{text}</div>
    </button>
  );
}

function PointDetails({ point }: { point: CollectionPoint }) {
  return (
    <div className="space-y-1 text-gray-700">
      <div className="font-semibold text-gray-900">{point.name}</div>
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-gray-500 shrink-0" />
        <span>{pointAddress(point)}</span>
      </div>
      <div>
        {point.cityName || ''}{point.state ? `/${point.state}` : ''} {point.zipCode ? `• CEP ${point.zipCode}` : ''}
      </div>
      {point.phone && (
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-gray-500 shrink-0" />
          <span>{point.phone}</span>
        </div>
      )}
    </div>
  );
}

function PixInstructions() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <p>
        Obrigado por apadrinhar! 💚 Para fazer a contribuição via <b>PIX</b>, use os dados abaixo:
      </p>

      <div className="bg-white border border-emerald-200 rounded-xl p-4">
        <div className="text-sm text-gray-700 space-y-2">
          <div>
            <b>Chave PIX:</b> <span className="select-all break-all">{PIX_KEY || '—'}</span>
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

      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 rounded-lg">
        <Shield className="w-4 h-4 mt-0.5 shrink-0" />
        <span><b>Importante:</b> o valor mínimo para contribuição via PIX é de <b>R$ 50,00</b>.</span>
      </div>
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
