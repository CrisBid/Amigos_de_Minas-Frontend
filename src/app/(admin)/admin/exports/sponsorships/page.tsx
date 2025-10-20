// app/(admin)/exports/sponsorships/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Download, SlidersHorizontal, RefreshCw } from 'lucide-react';

type Option = { id: string; name: string };

type Level = 'general' | 'city' | 'community' | 'sponsor' | 'selection';

const STATUS_OPTIONS = [
  { id: 'PENDING', name: 'Pendente' },
  { id: 'IN_PROGRESS', name: 'Em andamento' },
  { id: 'COMPLETED', name: 'Concluído' },
  { id: 'ENDED', name: 'Encerrado' },
  { id: 'CANCELLED', name: 'Cancelado' },
];

const METHOD_OPTIONS = [
  { id: 'PIX', name: 'PIX' },
  { id: 'GIFT', name: 'Presente físico' },
];

export default function ExportSponsorshipsPage() {
  const [level, setLevel] = useState<Level>('general');

  const [cities, setCities] = useState<Option[]>([]);
  const [communities, setCommunities] = useState<Option[]>([]);
  const [sponsors, setSponsors] = useState<Option[]>([]);

  const [cityId, setCityId] = useState<string>('');
  const [communityId, setCommunityId] = useState<string>('');
  const [sponsorId, setSponsorId] = useState<string>('');

  const [status, setStatus] = useState<string[]>([]);
  const [method, setMethod] = useState<string[]>([]);

  const [ids, setIds] = useState<string>(''); // seleção manual por IDs
  const [loading, setLoading] = useState(false);

  // ====== Loaders (ajuste as rotas conforme seus proxies existentes) ======
  useEffect(() => {
    // Cidades
    (async () => {
      try {
        const res = await fetch('/api/admin/cities', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setCities((data?.items ?? data ?? []).map((c: any) => ({ id: c.id, name: c.name })));
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    // Comunidades por cidade
    if (!cityId) {
      setCommunities([]);
      setCommunityId('');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/admin/communities?cityId=${cityId}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setCommunities((data?.items ?? data ?? []).map((c: any) => ({ id: c.id, name: c.name })));
        }
      } catch {}
    })();
  }, [cityId]);

  // Padrinhos – você pode trocar por um autocomplete se preferir
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/users?limit=200', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setSponsors((data?.items ?? data ?? []).map((s: any) => ({ id: s.id, name: s.name })));
        }
      } catch {}
    })();
  }, []);

  // Helpers
  const toggleStatus = (id: string) =>
    setStatus(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));

  const toggleMethod = (id: string) =>
    setMethod(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));

  const canPickCity = level === 'city' || level === 'community';
  const canPickCommunity = level === 'community';
  const canPickSponsor = level === 'sponsor';
  const canPickIds = level === 'selection';

  // Monta query de export
  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set('level', level);

    if (canPickCity && cityId) p.set('cityId', cityId);
    if (canPickCommunity && communityId) p.set('communityId', communityId);
    if (canPickSponsor && sponsorId) p.set('sponsorId', sponsorId);

    if (status.length) p.set('status', status.join(','));
    if (method.length) p.set('method', method.join(','));

    if (canPickIds && ids.trim()) {
      // Normaliza separadores (vírgula, quebra de linha, espaço)
      const normalized = ids
        .split(/[\s,;\n\r]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .join(',');
      if (normalized) p.set('ids', normalized);
    }

    return p.toString();
  }, [level, canPickCity, canPickCommunity, canPickSponsor, canPickIds, cityId, communityId, sponsorId, status, method, ids]);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/sponsorships/export?${queryString}`);
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        alert(t || 'Falha ao exportar.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `apadrinhamentos-${level}.xlsx`;
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setCityId('');
    setCommunityId('');
    setSponsorId('');
    setStatus([]);
    setMethod([]);
    setIds('');
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Exportar Apadrinhamentos</h1>
          <p className="text-sm text-gray-600">
            Gere um Excel com abas inteligentes (por cidade, comunidade, escola) conforme o nível de filtro selecionado.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-gray-700">
          <SlidersHorizontal className="w-4 h-4" />
          <span className="font-medium">Filtros</span>
        </div>

        {/* Linha 1: Level */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-600">Nível</label>
            <select
              value={level}
              onChange={e => setLevel(e.target.value as Level)}
              className="mt-1 w-full rounded-xl border-gray-300 bg-white text-gray-900"
            >
              <option value="general">Geral (abas por Cidade)</option>
              <option value="city">Por Cidade (abas por Comunidade)</option>
              <option value="community">Por Comunidade (abas por Escola)</option>
              <option value="sponsor">Por Padrinho (uma aba por Padrinho)</option>
              <option value="selection">Por Seleção de IDs</option>
            </select>
          </div>

          {/* City */}
          <div>
            <label className="text-sm text-gray-600">Cidade</label>
            <select
              disabled={!canPickCity}
              value={cityId}
              onChange={e => setCityId(e.target.value)}
              className="mt-1 w-full rounded-xl border-gray-300 bg-white text-gray-900 disabled:bg-gray-100"
            >
              <option value="">— Selecionar —</option>
              {cities.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Community */}
          <div>
            <label className="text-sm text-gray-600">Comunidade</label>
            <select
              disabled={!canPickCommunity}
              value={communityId}
              onChange={e => setCommunityId(e.target.value)}
              className="mt-1 w-full rounded-xl border-gray-300 bg-white text-gray-900 disabled:bg-gray-100"
            >
              <option value="">— Selecionar —</option>
              {communities.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Linha 2: Sponsor + Status + Method */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {/* Sponsor */}
          <div>
            <label className="text-sm text-gray-600">Padrinho</label>
            <select
              disabled={!canPickSponsor}
              value={sponsorId}
              onChange={e => setSponsorId(e.target.value)}
              className="mt-1 w-full rounded-xl border-gray-300 bg-white text-gray-900 disabled:bg-gray-100"
            >
              <option value="">— Selecionar —</option>
              {sponsors.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-sm text-gray-600 block">Status</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {STATUS_OPTIONS.map(o => {
                const checked = status.includes(o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => toggleStatus(o.id)}
                    className={`px-3 py-1 rounded-full border text-sm ${checked ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300'}`}
                    type="button"
                  >
                    {o.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Method */}
          <div>
            <label className="text-sm text-gray-600 block">Forma de Apadrinhamento</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {METHOD_OPTIONS.map(o => {
                const checked = method.includes(o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => toggleMethod(o.id)}
                    className={`px-3 py-1 rounded-full border text-sm ${checked ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300'}`}
                    type="button"
                  >
                    {o.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Linha 3: IDs seleção manual */}
        <div className="mt-4">
          <label className="text-sm text-gray-600">IDs (quando “Por Seleção de IDs”)</label>
          <textarea
            disabled={!canPickIds}
            value={ids}
            onChange={e => setIds(e.target.value)}
            placeholder="Cole aqui uma lista de IDs (separados por vírgula, espaço ou quebra de linha)"
            className="mt-1 w-full rounded-xl border-gray-300 bg-white text-gray-900 disabled:bg-gray-100 min-h-[90px] p-3"
          />
        </div>

        {/* Ações */}
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={handleExport}
            disabled={loading || (level === 'city' && !cityId) || (level === 'community' && !communityId) || (level === 'sponsor' && !sponsorId) || (level === 'selection' && !ids.trim())}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2 hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Exportando…
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Exportar Excel
              </>
            )}
          </button>

          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {/* Ajuda */}
      <div className="text-sm text-gray-600">
        <p className="mb-1">• <b>Geral</b>: cria uma aba por <b>Cidade</b>.</p>
        <p className="mb-1">• <b>Por Cidade</b>: cria uma aba por <b>Comunidade</b> daquela cidade.</p>
        <p className="mb-1">• <b>Por Comunidade</b>: cria uma aba por <b>Escola</b> daquela comunidade.</p>
        <p className="mb-1">• <b>Por Padrinho</b>: cria uma aba para cada <b>Padrinho</b>.</p>
        <p>• <b>Por Seleção de IDs</b>: use uma lista de IDs de apadrinhamento.</p>
      </div>
    </div>
  );
}
