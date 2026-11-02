'use client';

import { useEffect, useState } from 'react';

type Option = { id: string; name: string; state?: string | null; communityIds?: string[] };

export type LocationValue = { cityId: string; communityId: string; schoolId: string };
export const EMPTY_LOCATION: LocationValue = { cityId: '', communityId: '', schoolId: '' };

const listOf = (raw: any): Option[] => (Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : []);

async function fetchList(path: string) {
  try {
    const r = await fetch(path, { cache: 'no-store', credentials: 'include' });
    return r.ok ? listOf(await r.json()) : [];
  } catch {
    return [];
  }
}

/** Cidade → comunidade → escola. As escolas mostradas são as que atendem a comunidade escolhida. */
export default function LocationFilter({
  value,
  onChange,
  className = '',
  selectClassName = 'w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400',
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  className?: string;
  selectClassName?: string;
}) {
  const [cities, setCities] = useState<Option[]>([]);
  const [communities, setCommunities] = useState<Option[]>([]);
  const [schools, setSchools] = useState<Option[]>([]);

  useEffect(() => {
    fetchList('/api/admin/cities?pageSize=1000').then((l) => setCities(l.sort((a, b) => a.name.localeCompare(b.name))));
  }, []);

  useEffect(() => {
    if (!value.cityId) { setCommunities([]); setSchools([]); return; }
    const qs = `cityId=${encodeURIComponent(value.cityId)}&pageSize=1000`;
    fetchList(`/api/admin/communities?${qs}`).then((l) => setCommunities(l.sort((a, b) => a.name.localeCompare(b.name))));
    fetchList(`/api/admin/schools?${qs}`).then((l) => setSchools(l.sort((a, b) => a.name.localeCompare(b.name))));
  }, [value.cityId]);

  const shownSchools = schools.filter(
    (s) => !value.communityId || !s.communityIds?.length || s.communityIds.includes(value.communityId),
  );

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className}`}>
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">Cidade</span>
        <select
          value={value.cityId}
          onChange={(e) => onChange({ cityId: e.target.value, communityId: '', schoolId: '' })}
          className={selectClassName}
        >
          <option value="">Todas</option>
          {cities.map((c) => <option key={c.id} value={c.id}>{c.name}{c.state ? `/${c.state}` : ''}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">Comunidade</span>
        <select
          value={value.communityId}
          onChange={(e) => onChange({ ...value, communityId: e.target.value, schoolId: '' })}
          disabled={!value.cityId}
          className={selectClassName}
        >
          <option value="">{value.cityId ? 'Todas' : 'Escolha a cidade'}</option>
          {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">Escola</span>
        <select
          value={value.schoolId}
          onChange={(e) => onChange({ ...value, schoolId: e.target.value })}
          disabled={!value.cityId}
          className={selectClassName}
        >
          <option value="">{value.cityId ? 'Todas' : 'Escolha a cidade'}</option>
          {shownSchools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
    </div>
  );
}

/** Nome do local filtrado, para mensagens ("todas as fotos de Forges") */
export function useLocationLabel(value: LocationValue) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    let alive = true;
    (async () => {
      const parts: string[] = [];
      if (value.schoolId) parts.push((await fetchName(`/api/admin/schools/${value.schoolId}`)) ?? 'escola');
      if (value.communityId) parts.push((await fetchName(`/api/admin/communities/${value.communityId}`)) ?? 'comunidade');
      if (value.cityId) parts.push((await fetchName(`/api/admin/cities/${value.cityId}`)) ?? 'cidade');
      if (alive) setLabel(parts.join(' · '));
    })();
    return () => { alive = false; };
  }, [value.cityId, value.communityId, value.schoolId]);
  return label;
}

async function fetchName(path: string): Promise<string | null> {
  try {
    const r = await fetch(path, { cache: 'no-store', credentials: 'include' });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.name ?? null;
  } catch {
    return null;
  }
}
