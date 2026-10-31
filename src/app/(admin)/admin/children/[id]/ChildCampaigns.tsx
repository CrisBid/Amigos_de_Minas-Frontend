'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Heart, ImagePlus, LayoutTemplate, Loader2, PencilRuler, Save, Trash2 } from 'lucide-react';
import ComposedImage, { ComposeSample } from '@/components/media/ComposedImage';
import { composeConfigForFrame } from '@/components/media/composeConfig';
import ComposeEditor from './ComposeEditor';

type CampaignImage = {
  id: string;
  campaignId: string;
  createdAt?: string;
  originalUrl?: string | null;
  processedUrl?: string | null;
  framedUrl?: string | null;
  layoutUrl?: string | null;
  Config?: unknown;
};

export type CampaignHistoryItem = {
  campaign: { id: string; name: string; year?: number | null; status?: string | null };
  publicId: number | null;
  campaignPublicId: number | null;
  wantedGift: string | null;
  image: CampaignImage | null;
  display: CampaignImage | null;
  displayFromCampaign: { id: string; name: string | null } | null;
  layout: { id: string; name: string | null; url: string; config: unknown; source: 'city' | 'default' } | null;
  migratedFrom: { id: string | null; name: string | null; at: string } | null;
  sponsorships: {
    id: string;
    status: string;
    method?: string | null;
    createdAt?: string;
    sponsor?: { id: string; name: string; email?: string | null } | null;
  }[];
};

export const SPONSORSHIP_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  IN_PURCHASE: 'Em compra',
  PACKED: 'Embalado',
  BOXED: 'Encaixotado',
  AWAITING_DELIVERY: 'Aguardando entrega',
  COMPLETED: 'Concluído',
  ENDED: 'Encerrado',
  CANCELLED: 'Cancelado',
};

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  ENDED: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

async function extractError(res: Response, fallback: string) {
  try {
    const body = await res.json();
    if (body?.message) return Array.isArray(body.message) ? body.message.join(' ') : String(body.message);
  } catch {
    // sem corpo JSON
  }
  return fallback;
}

const formatDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

/**
 * Campanhas da criança, uma por aba: a arte como o apadrinhamento mostra (foto +
 * layout atual da cidade/campanha), ID e presente da campanha, apadrinhamentos,
 * troca de foto e ajuste de enquadramento — tudo restrito à campanha da aba.
 */
export default function ChildCampaigns({
  childId,
  baseSample,
  currentGift,
  fallbackPublicId,
}: {
  childId: string;
  /** dados da criança para os textos da arte (nome, idade, cidade, comunidade) */
  baseSample: ComposeSample;
  currentGift?: string | null;
  fallbackPublicId?: number | null;
}) {
  const [history, setHistory] = useState<CampaignHistoryItem[] | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'upload' | 'delete' | 'data' | null>(null);

  // formulário de dados da campanha selecionada
  const [idText, setIdText] = useState('');
  const [giftText, setGiftText] = useState('');

  async function load(keep?: string) {
    try {
      const r = await fetch(`/api/admin/children/${childId}/campaigns`, { cache: 'no-store' });
      const list: CampaignHistoryItem[] = r.ok ? await r.json() : [];
      setHistory(list);
      setSelected((prev) => {
        const want = keep ?? prev;
        return list.some((h) => h.campaign.id === want) ? want : list[0]?.campaign.id ?? '';
      });
    } catch {
      setHistory([]);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [childId]);

  const item = useMemo(() => history?.find((h) => h.campaign.id === selected) ?? null, [history, selected]);

  useEffect(() => {
    setIdText(item?.campaignPublicId != null ? String(item.campaignPublicId) : '');
    setGiftText(item?.wantedGift ?? '');
  }, [item]);

  if (history === null) {
    return <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando campanhas…</div>;
  }
  if (history.length === 0) {
    return <p className="text-sm text-gray-500">Esta criança ainda não participou de nenhuma campanha. Envie uma foto pelo cadastro guiado ou migre-a para uma campanha.</p>;
  }

  const sample: ComposeSample = {
    ...baseSample,
    publicId: item?.publicId ?? fallbackPublicId ?? '',
    wantedGift: item?.wantedGift ?? currentGift ?? '',
  };
  const display = item?.display ?? null; // sem foto: vem só o layout (placeholder) para mostrar a área vazia
  const displayPhoto = display?.processedUrl || display?.originalUrl || '';
  const displayConfig = composeConfigForFrame(display?.Config ?? item?.layout?.config);
  const layoutConfig = composeConfigForFrame(item?.layout?.config ?? display?.Config);
  const ownLayoutOutdated = !!item?.image && !!item.layout && item.image.layoutUrl !== item.layout.url;
  const dataDirty = !!item && (idText.trim() !== (item.campaignPublicId != null ? String(item.campaignPublicId) : '') || giftText.trim() !== (item.wantedGift ?? ''));

  async function uploadPhoto(file: File) {
    if (!item) return;
    setBusy('upload');
    try {
      const fd = new FormData();
      fd.append('file', file);
      // mesma composição do cadastro guiado: padrão + layout da cidade/campanha
      fd.append('Config', JSON.stringify(composeConfigForFrame(item.layout?.config)));
      const qs = new URLSearchParams({ campaignId: item.campaign.id });
      if (item.layout?.id) qs.set('layoutId', item.layout.id);
      const res = await fetch(`/api/admin/children/${childId}/photo?${qs.toString()}`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await extractError(res, 'Falha no envio da foto.'));
      await load(item.campaign.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Falha no envio da foto.');
    } finally {
      setBusy(null);
    }
  }

  async function removePhoto() {
    if (!item?.image) return;
    if (!confirm(`Remover a foto desta criança da campanha "${item.campaign.name}"?`)) return;
    setBusy('delete');
    try {
      const res = await fetch(`/api/admin/child-images/${item.image.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await extractError(res, 'Falha ao remover a foto.'));
      await load(item.campaign.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Falha ao remover a foto.');
    } finally {
      setBusy(null);
    }
  }

  async function saveCampaignData() {
    if (!item) return;
    setBusy('data');
    try {
      const res = await fetch(`/api/admin/children/${childId}/campaigns/${item.campaign.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ publicId: idText.trim() || null, wantedGift: giftText.trim() || null }),
      });
      if (!res.ok) throw new Error(await extractError(res, 'Falha ao salvar os dados da campanha.'));
      await load(item.campaign.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Falha ao salvar os dados da campanha.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {/* abas: uma por campanha, mais recente primeiro */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {history.map((h) => {
          const sp = h.sponsorships[0];
          const active = h.campaign.id === selected;
          return (
            <button
              key={h.campaign.id}
              onClick={() => { setSelected(h.campaign.id); setEditing(false); }}
              className={[
                'shrink-0 text-left rounded-xl border px-3 py-2 transition-colors',
                active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50',
              ].join(' ')}
            >
              <span className="block text-sm font-semibold text-gray-900 whitespace-nowrap">
                {h.campaign.name}{h.campaign.year ? ` · ${h.campaign.year}` : ''}
              </span>
              <span className="block text-xs text-gray-500 whitespace-nowrap">
                ID #{h.publicId ?? '—'} · {sp ? SPONSORSHIP_STATUS_LABEL[sp.status] ?? sp.status : 'sem apadrinhamento'}
              </span>
            </button>
          );
        })}
      </div>

      {item && (
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-6">
          {/* arte, como o apadrinhamento mostra */}
          <div>
            {/* com layout: arte montada (sem foto, a área da foto fica vazia, como no site) */}
            {display?.layoutUrl ? (
              <ComposedImage
                photoUrl={displayPhoto}
                layoutUrl={display.layoutUrl}
                config={displayConfig as any}
                sample={sample}
                fallbackUrl={display.framedUrl ?? null}
                alt={`Arte na campanha ${item.campaign.name}`}
                className="w-full"
                imgClassName="rounded-xl shadow"
              />
            ) : displayPhoto || display?.framedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={display?.framedUrl || displayPhoto} alt="" className="w-full rounded-xl shadow" />
            ) : (
              <div className="aspect-[4/5] rounded-xl border-2 border-dashed grid place-content-center text-sm text-gray-400">Sem foto</div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''} bg-gray-900 text-white`}>
                {busy === 'upload' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                {item.image ? 'Trocar foto' : 'Enviar foto'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadPhoto(f); }}
                />
              </label>
              <button
                onClick={() => setEditing(true)}
                disabled={!item.image || !!busy}
                title={item.image ? 'Ajustar a posição da foto e dos textos' : 'Envie uma foto para esta campanha para ajustar o enquadramento'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <PencilRuler className="w-4 h-4" /> Enquadramento
              </button>
              {item.image && (
                <button
                  onClick={removePhoto}
                  disabled={!!busy}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 text-sm hover:bg-red-50 disabled:opacity-50"
                  title="Remover a foto desta campanha"
                >
                  {busy === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-5 min-w-0">
            {/* situação da foto e do layout */}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 p-3">
                <dt className="text-xs text-gray-500 flex items-center gap-1"><LayoutTemplate className="w-3.5 h-3.5" /> Layout</dt>
                <dd className="mt-0.5 text-gray-900">
                  {item.layout
                    ? <>{item.layout.name || 'Sem nome'} <span className="text-gray-500">({item.layout.source === 'city' ? 'da cidade' : 'padrão da campanha'})</span></>
                    : <span className="text-gray-500">Campanha sem layout</span>}
                </dd>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <dt className="text-xs text-gray-500 flex items-center gap-1"><ImagePlus className="w-3.5 h-3.5" /> Foto</dt>
                <dd className="mt-0.5 text-gray-900">
                  {item.image
                    ? <>Enviada para esta campanha em {formatDate(item.image.createdAt)}</>
                    : item.displayFromCampaign
                      ? <>Usando a foto de <strong>{item.displayFromCampaign.name ?? 'outra campanha'}</strong> (sem foto nova)</>
                      : <span className="text-gray-500">Nenhuma foto</span>}
                </dd>
              </div>
              {item.migratedFrom && (
                <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
                  <dt className="text-xs text-gray-500 flex items-center gap-1"><ArrowRightLeft className="w-3.5 h-3.5" /> Migração</dt>
                  <dd className="mt-0.5 text-gray-900">
                    Migrada{item.migratedFrom.name ? ` de ${item.migratedFrom.name}` : ''} em {formatDate(item.migratedFrom.at)}
                  </dd>
                </div>
              )}
            </dl>
            {ownLayoutOutdated && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
                A foto foi montada com outro layout. O site já mostra com o layout atual; ao salvar o enquadramento, a foto passa a usar o layout atual.
              </p>
            )}

            {/* ID e presente desta campanha */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Dados nesta campanha</h3>
              <div className="grid grid-cols-1 sm:grid-cols-[140px_minmax(0,1fr)_auto] gap-3 items-end">
                <label className="text-xs text-gray-600">
                  ID na campanha
                  <input
                    value={idText}
                    onChange={(e) => setIdText(e.target.value)}
                    inputMode="numeric"
                    placeholder={fallbackPublicId != null ? `#${fallbackPublicId}` : ''}
                    className="mt-1 w-full border rounded-lg px-3 py-2 font-mono text-sm"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Presente na campanha
                  <input
                    value={giftText}
                    onChange={(e) => setGiftText(e.target.value)}
                    placeholder={currentGift ?? ''}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <button
                  onClick={saveCampaignData}
                  disabled={!dataDirty || !!busy}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-40"
                >
                  {busy === 'data' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">ID vazio usa o ID principal do cadastro (#{fallbackPublicId ?? '—'}).</p>
            </div>

            {/* apadrinhamentos desta campanha */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5"><Heart className="w-4 h-4 text-gray-500" /> Apadrinhamentos</h3>
              {item.sponsorships.length === 0 ? (
                <p className="text-sm text-gray-500">Sem apadrinhamento nesta campanha.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {item.sponsorships.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="font-medium text-gray-900">{s.sponsor?.name ?? 'Padrinho'}</span>
                        {s.sponsor?.email && <span className="text-gray-500"> · {s.sponsor.email}</span>}
                        <span className="block text-xs text-gray-500">
                          {s.method === 'PIX' ? 'PIX' : 'Presente'} · {formatDate(s.createdAt)}
                        </span>
                      </span>
                      <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${STATUS_TONE[s.status] ?? 'bg-blue-100 text-blue-800'}`}>
                        {SPONSORSHIP_STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {editing && item?.image && (
        <ComposeEditor
          imageId={item.image.id}
          photoUrl={item.image.processedUrl || item.image.originalUrl || ''}
          layoutUrl={item.layout?.url ?? item.image.layoutUrl ?? ''}
          frameId={item.layout?.id}
          initialConfig={displayConfig}
          layoutConfig={layoutConfig}
          sample={sample}
          title={`${item.campaign.name}${item.layout?.name ? ` · layout ${item.layout.name}` : ''}`}
          onClose={() => setEditing(false)}
          onSaved={() => load(item.campaign.id)}
        />
      )}
    </div>
  );
}
