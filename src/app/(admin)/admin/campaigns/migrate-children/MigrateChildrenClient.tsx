'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckSquare, Loader2, Search, Square, Trash2, Users } from 'lucide-react';

type Campaign = { id: string; name: string; slug: string; year?: number | null };
type City = { id: string; name: string; state?: string | null };
type CommunityOpt = { id: string; name: string; cityId?: string | null };

type CandidateChild = {
  id: string;
  publicId?: number | null;
  name: string;
  cityName?: string | null;
  city?: { id: string; name: string } | null;
  community?: { id: string; name: string } | null;
  photoUrl?: string | null;
};

type IncludedRow = {
  childId: string;
  sourceCampaignId: string | null;
  includedAt: string;
  child: {
    id: string;
    publicId?: number | null;
    name: string;
    cityName?: string | null;
    city?: { id: string; name: string } | null;
    community?: { id: string; name: string } | null;
  };
};

const TAKE = 48;
const MAX_SELECT_ALL_BATCHES = 40; // até ~4000 crianças por segurança

async function extractError(res: Response, fallback: string) {
  try {
    const body = await res.json();
    if (body?.message) return Array.isArray(body.message) ? body.message.join(' ') : String(body.message);
  } catch {
    // sem corpo JSON
  }
  return fallback;
}

export default function MigrateChildrenClient() {
  const searchParams = useSearchParams();
  const initialTarget = searchParams.get('target') ?? '';
  const initialSource = searchParams.get('source') ?? '';

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [targetCampaignId, setTargetCampaignId] = useState<string>(initialTarget);
  const [sourceCampaignId, setSourceCampaignId] = useState<string>(initialSource);

  const [citiesOpt, setCitiesOpt] = useState<City[]>([]);
  const [communitiesOpt, setCommunitiesOpt] = useState<CommunityOpt[]>([]);
  const [cityId, setCityId] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [q, setQ] = useState('');

  const [candidates, setCandidates] = useState<CandidateChild[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [selectingAll, setSelectingAll] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const [included, setIncluded] = useState<IncludedRow[]>([]);
  const [loadingIncluded, setLoadingIncluded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- carrega a lista de campanhas disponíveis ----
  useEffect(() => {
    (async () => {
      setLoadingCampaigns(true);
      try {
        const res = await fetch('/api/admin/campaigns?pageSize=200', { cache: 'no-store', credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          const items: Campaign[] = Array.isArray(json?.items) ? json.items : Array.isArray(json) ? json : [];
          const sorted = items.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
          setCampaigns(sorted);
          if (!initialTarget && sorted[0]) setTargetCampaignId(sorted[0].id);
          if (!initialSource && sorted[1]) setSourceCampaignId(sorted[1].id);
        }
      } catch {
        setError('Falha ao carregar campanhas.');
      } finally {
        setLoadingCampaigns(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, []);

  const targetCampaign = useMemo(() => campaigns.find((c) => c.id === targetCampaignId) ?? null, [campaigns, targetCampaignId]);
  const sourceOptions = useMemo(() => campaigns.filter((c) => c.id !== targetCampaignId), [campaigns, targetCampaignId]);

  // se a campanha de origem ficar igual à de destino, limpa
  useEffect(() => {
    if (sourceCampaignId && sourceCampaignId === targetCampaignId) {
      const fallback = campaigns.find((c) => c.id !== targetCampaignId);
      setSourceCampaignId(fallback?.id ?? '');
    }
  }, [targetCampaignId, sourceCampaignId, campaigns]);

  // ---- crianças já migradas para a campanha alvo ----
  const loadIncluded = useCallback(async () => {
    if (!targetCampaignId) { setIncluded([]); return; }
    setLoadingIncluded(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${targetCampaignId}/included-children`, { cache: 'no-store', credentials: 'include' });
      if (res.ok) setIncluded(await res.json());
    } catch {
      // silencioso
    } finally {
      setLoadingIncluded(false);
    }
  }, [targetCampaignId]);

  useEffect(() => { loadIncluded(); }, [loadIncluded]);

  // ---- cidades (para filtro) ----
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/cities', { cache: 'no-store', credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setCitiesOpt(Array.isArray(data) ? data : (data?.items ?? []));
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // ---- comunidades dependentes da cidade ----
  useEffect(() => {
    setCommunityId('');
    (async () => {
      try {
        const url = new URL('/api/admin/communities', window.location.origin);
        if (cityId) url.searchParams.set('cityId', cityId);
        const res = await fetch(url.toString(), { cache: 'no-store', credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setCommunitiesOpt(Array.isArray(data) ? data : (data?.items ?? []));
        }
      } catch {
        setCommunitiesOpt([]);
      }
    })();
  }, [cityId]);

  const alreadyIncludedIds = useMemo(() => new Set(included.map((r) => r.childId)), [included]);

  const buildUrl = useCallback((skipVal: number, take: number) => {
    const url = new URL('/api/admin/children', window.location.origin);
    url.searchParams.set('campaignId', sourceCampaignId);
    url.searchParams.set('skip', String(skipVal));
    url.searchParams.set('take', String(take));
    if (q.trim()) url.searchParams.set('q', q.trim());
    if (cityId) url.searchParams.set('cityId', cityId);
    if (communityId) url.searchParams.set('communityId', communityId);
    return url;
  }, [sourceCampaignId, q, cityId, communityId]);

  const fetchPage = useCallback(async (opts?: { reset?: boolean }) => {
    if (!sourceCampaignId) return;
    const reset = !!opts?.reset;
    const skipVal = reset ? 0 : skip;
    try {
      if (reset) { setLoading(true); setError(null); } else { setLoadingMore(true); }
      const res = await fetch(buildUrl(skipVal, TAKE).toString(), { cache: 'no-store', credentials: 'include' });
      if (!res.ok) throw new Error(await extractError(res, 'Falha ao carregar crianças.'));
      const json = await res.json();
      const items: CandidateChild[] = Array.isArray(json) ? json : (json?.items ?? []);
      setCandidates((prev) => (reset ? items : [...prev, ...items]));
      setSkip(skipVal + items.length);
      const serverHasMore = !Array.isArray(json) && typeof json?.hasMore === 'boolean' ? json.hasMore : items.length === TAKE;
      setHasMore(serverHasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar crianças.');
    } finally {
      if (reset) setLoading(false); else setLoadingMore(false);
    }
  }, [sourceCampaignId, skip, buildUrl]);

  // recarrega ao trocar campanha de origem, destino ou filtros
  useEffect(() => {
    if (!sourceCampaignId || !targetCampaignId) { setCandidates([]); setHasMore(false); return; }
    setCandidates([]); setSkip(0); setHasMore(false);
    setSelected(new Set());
    const t = window.setTimeout(() => fetchPage({ reset: true }), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceCampaignId, targetCampaignId, q, cityId, communityId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllLoaded() {
    setSelected((prev) => {
      const next = new Set(prev);
      candidates.forEach((c) => { if (!alreadyIncludedIds.has(c.id)) next.add(c.id); });
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function selectAllMatching() {
    setSelectingAll(true);
    try {
      const ids = new Set(selected);
      let skipVal = 0;
      let batches = 0;
      for (;;) {
        const res = await fetch(buildUrl(skipVal, 100).toString(), { cache: 'no-store', credentials: 'include' });
        if (!res.ok) break;
        const json = await res.json();
        const items: CandidateChild[] = Array.isArray(json) ? json : (json?.items ?? []);
        items.forEach((c) => { if (!alreadyIncludedIds.has(c.id)) ids.add(c.id); });
        skipVal += items.length;
        batches += 1;
        const serverHasMore = !Array.isArray(json) && typeof json?.hasMore === 'boolean' ? json.hasMore : items.length === 100;
        if (!serverHasMore || items.length === 0 || batches >= MAX_SELECT_ALL_BATCHES) break;
      }
      setSelected(ids);
    } finally {
      setSelectingAll(false);
    }
  }

  async function migrateSelected() {
    if (selected.size === 0 || !targetCampaignId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${targetCampaignId}/included-children`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ childIds: Array.from(selected), sourceCampaignId }),
      });
      if (!res.ok) {
        alert(await extractError(res, 'Falha ao migrar crianças.'));
        return;
      }
      clearSelection();
      await loadIncluded();
      alert('Crianças migradas com sucesso.');
    } finally {
      setSubmitting(false);
    }
  }

  async function removeIncluded(childId: string) {
    if (!targetCampaignId) return;
    if (!confirm('Remover esta criança da campanha? Ela deixa de aparecer aqui, mas o cadastro original não é afetado.')) return;
    const res = await fetch(`/api/admin/campaigns/${targetCampaignId}/included-children`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ childIds: [childId] }),
    });
    if (!res.ok) {
      alert(await extractError(res, 'Falha ao remover.'));
      return;
    }
    loadIncluded();
  }

  const selectedCount = selected.size;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <a href="/admin/campaigns" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Voltar para campanhas
        </a>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Migração de Crianças</h1>
          <p className="text-gray-600 mt-1">
            Escolha de qual campanha migrar e para qual campanha, depois selecione as crianças (por cidade, comunidade
            ou individualmente).
          </p>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>
        )}

        {/* Origem / Destino */}
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-6">
          {loadingCampaigns ? (
            <div className="flex items-center gap-2 text-gray-600 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Carregando campanhas…</div>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-gray-600 mb-1 block">De (campanha de origem)</label>
                <select
                  value={sourceCampaignId}
                  onChange={(e) => setSourceCampaignId(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="">Selecione…</option>
                  {sourceOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.year ? ` (${c.year})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-center sm:pb-2.5">
                <ArrowRight className="w-5 h-5 text-gray-400 rotate-90 sm:rotate-0" />
              </div>

              <div className="flex-1">
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Para (campanha de destino)</label>
                <select
                  value={targetCampaignId}
                  onChange={(e) => setTargetCampaignId(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="">Selecione…</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.year ? ` (${c.year})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {!targetCampaignId || !sourceCampaignId ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center text-gray-500">
            Selecione a campanha de origem e a de destino para começar.
          </div>
        ) : (
          <>
            {/* Filtros */}
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Cidade</label>
                  <select
                    value={cityId}
                    onChange={(e) => setCityId(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="">Todas as cidades</option>
                    {citiesOpt.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Comunidade</label>
                  <select
                    value={communityId}
                    onChange={(e) => setCommunityId(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                    disabled={communitiesOpt.length === 0}
                  >
                    <option value="">Todas as comunidades</option>
                    {communitiesOpt.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Buscar por nome</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Nome da criança..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Ações de seleção */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="text-sm text-gray-700">
                {selectedCount > 0 ? <span><strong>{selectedCount}</strong> selecionada{selectedCount > 1 ? 's' : ''}.</span> : <span>Nenhuma criança selecionada.</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={selectAllLoaded} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm">
                  <CheckSquare className="w-4 h-4" /> Selecionar carregadas
                </button>
                <button onClick={selectAllMatching} disabled={selectingAll} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm disabled:opacity-60">
                  {selectingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                  Selecionar todas do filtro
                </button>
                <button onClick={clearSelection} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm">
                  <Square className="w-4 h-4" /> Limpar
                </button>
                <button
                  onClick={migrateSelected}
                  disabled={submitting || selectedCount === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {submitting ? 'Migrando...' : `Migrar ${selectedCount || ''} criança${selectedCount === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>

            {/* Lista de candidatas */}
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-8">
              {loading ? (
                <div className="flex items-center gap-2 text-gray-600 py-8 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" /> Carregando crianças...
                </div>
              ) : candidates.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhuma criança encontrada com os filtros aplicados nesta campanha de origem.</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {candidates.map((c) => {
                      const already = alreadyIncludedIds.has(c.id);
                      const checked = selected.has(c.id);
                      return (
                        <label
                          key={c.id}
                          className={[
                            'flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors',
                            already
                              ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                              : checked
                                ? 'bg-emerald-50 border-emerald-300'
                                : 'bg-white border-gray-200 hover:bg-gray-50',
                          ].join(' ')}
                        >
                          <input
                            type="checkbox"
                            checked={checked || already}
                            disabled={already}
                            onChange={() => toggle(c.id)}
                            className="w-4 h-4 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                            <p className="text-xs text-gray-500 truncate">
                              {c.community?.name ?? '—'} · {c.city?.name ?? c.cityName ?? '—'}
                              {already ? ' · já migrada' : ''}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex justify-center mt-4">
                    {loadingMore ? (
                      <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Carregando mais…</div>
                    ) : hasMore ? (
                      <button onClick={() => fetchPage()} className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50">
                        Carregar mais
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            {/* Já migradas */}
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">
                Já migradas para {targetCampaign?.name ?? 'esta campanha'}{targetCampaign?.year ? ` (${targetCampaign.year})` : ''}
              </h2>
              {loadingIncluded ? (
                <div className="flex items-center gap-2 text-gray-600 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
              ) : included.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma criança migrada ainda.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {included.map((r) => (
                    <div key={r.childId} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{r.child.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {r.child.community?.name ?? '—'} · {r.child.city?.name ?? r.child.cityName ?? '—'}
                        </p>
                      </div>
                      <button
                        onClick={() => removeIncluded(r.childId)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                        title="Remover desta campanha"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
