'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  SlidersHorizontal,
  RefreshCw,
} from 'lucide-react';

type Option = { id: string; name: string };
type Level = 'general' | 'city' | 'community' | 'selection';
type Bind = 'all' | 'sponsored' | 'unsponsored';

const LEVEL_OPTIONS: { id: Level; name: string; hint: string }[] = [
  { id: 'general', name: 'Geral', hint: 'Cria abas por Cidade' },
  { id: 'city', name: 'Por Cidade', hint: 'Cria abas por Comunidade' },
  { id: 'community', name: 'Por Comunidade', hint: 'Cria abas por Escola' },
  { id: 'selection', name: 'Por Seleção de IDs', hint: 'Cole IDs específicos' },
];

const BIND_OPTIONS: { id: Bind; name: string }[] = [
  { id: 'all', name: 'Todas' },
  { id: 'sponsored', name: 'Somente apadrinhadas' },
  { id: 'unsponsored', name: 'Somente sem apadrinhamento' },
];

export default function ExportChildrenPage() {
  const [level, setLevel] = useState<Level>('general');
  const [bind, setBind] = useState<Bind>('all');

  const [cities, setCities] = useState<Option[]>([]);
  const [communities, setCommunities] = useState<Option[]>([]);

  const [cityId, setCityId] = useState<string>('');
  const [communityId, setCommunityId] = useState<string>('');
  const [ids, setIds] = useState<string>('');

  const [loading, setLoading] = useState(false);

  const canPickCity = level === 'city' || level === 'community';
  const canPickCommunity = level === 'community';
  const canPickIds = level === 'selection';

  // Carrega cidades
  useEffect(() => {
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

  // Carrega comunidades por cidade
  useEffect(() => {
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

  // Monta query
  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set('level', level);
    p.set('bind', bind);

    if (canPickCity && cityId) p.set('cityId', cityId);
    if (canPickCommunity && communityId) p.set('communityId', communityId);

    if (canPickIds && ids.trim()) {
      const normalized = ids
        .split(/[\s,;\n\r]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .join(',');
      if (normalized) p.set('ids', normalized);
    }

    return p.toString();
  }, [level, bind, canPickCity, canPickCommunity, canPickIds, cityId, communityId, ids]);

  // Exportar
  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/children/export?${queryString}`);
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        alert(t || 'Falha ao exportar.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `criancas-${bind}-${level}.xlsx`;
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setBind('all');
    setLevel('general');
    setCityId('');
    setCommunityId('');
    setIds('');
  }

  const levelHint = LEVEL_OPTIONS.find(l => l.id === level)?.hint ?? '';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Exportar Crianças</h1>
          <p className="text-sm text-gray-600">
            Gere um Excel com abas inteligentes conforme o nível selecionado. {levelHint && <span className="italic">({levelHint})</span>}
          </p>
        </div>
      </div>

      {/* Card de filtros */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-gray-700">
          <SlidersHorizontal className="w-4 h-4" />
          <span className="font-medium">Filtros</span>
        </div>

        {/* Linha 1: Bind + Level */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Vinculação */}
          <div>
            <label className="text-sm text-gray-600">Vinculação</label>
            <select
              value={bind}
              onChange={(e) => setBind(e.target.value as Bind)}
              className="mt-1 w-full rounded-xl border-gray-300 bg-white text-gray-900"
            >
              {BIND_OPTIONS.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>

          {/* Nível */}
          <div>
            <label className="text-sm text-gray-600">Nível</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as Level)}
              className="mt-1 w-full rounded-xl border-gray-300 bg-white text-gray-900"
            >
              {LEVEL_OPTIONS.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            {levelHint && <p className="text-xs text-gray-500 mt-1">{levelHint}</p>}
          </div>

          {/* Cidade */}
          <div>
            <label className="text-sm text-gray-600">Cidade</label>
            <select
              disabled={!canPickCity}
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="mt-1 w-full rounded-xl border-gray-300 bg-white text-gray-900 disabled:bg-gray-100"
            >
              <option value="">— Selecionar —</option>
              {cities.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Linha 2: Comunidade + IDs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {/* Comunidade */}
          <div>
            <label className="text-sm text-gray-600">Comunidade</label>
            <select
              disabled={!canPickCommunity}
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
              className="mt-1 w-full rounded-xl border-gray-300 bg-white text-gray-900 disabled:bg-gray-100"
            >
              <option value="">— Selecionar —</option>
              {communities.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* IDs (somente selection) */}
          <div className="md:col-span-2">
            <label className="text-sm text-gray-600">IDs (quando “Por Seleção de IDs”)</label>
            <textarea
              disabled={!canPickIds}
              value={ids}
              onChange={(e) => setIds(e.target.value)}
              placeholder="Cole aqui IDs de crianças (separados por vírgula, espaço ou quebra de linha)"
              className="mt-1 w-full rounded-xl border-gray-300 bg-white text-gray-900 disabled:bg-gray-100 min-h-[90px] p-3"
            />
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={handleExport}
            disabled={
              loading ||
              (level === 'city' && !cityId) ||
              (level === 'community' && !communityId) ||
              (level === 'selection' && !ids.trim())
            }
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
      <div className="text-sm text-gray-600 space-y-1">
        <p>• <b>Geral</b>: cria abas por <b>Cidade</b>.</p>
        <p>• <b>Por Cidade</b>: cria abas por <b>Comunidade</b> da cidade selecionada.</p>
        <p>• <b>Por Comunidade</b>: cria abas por <b>Escola</b> da comunidade selecionada.</p>
        <p>• <b>Por Seleção de IDs</b>: exporta somente as crianças listadas.</p>
        <p>• <b>Vinculação</b>: escolha <i>Todas</i>, <i>Somente apadrinhadas</i> ou <i>Somente sem apadrinhamento</i>.</p>
      </div>
    </div>
  );
}
