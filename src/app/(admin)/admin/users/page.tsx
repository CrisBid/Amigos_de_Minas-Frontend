'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Search, Users as UsersIcon, Shield, Loader2, Check, X,
  ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';

type Role = 'ADMIN' | 'STAFF' | 'SPONSOR';

type User = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  roles: Role[];
  createdAt?: string;
  updatedAt?: string;
};

const ALL_ROLES: Role[] = ['ADMIN', 'STAFF', 'SPONSOR'];

export default function Page() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ------- calls go to Next proxy ------- //
  const proxyBase = '/api/admin/users';

  async function fetchUsers() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('query', query.trim());
      if (roleFilter !== 'ALL') params.set('roles', roleFilter);

      const res = await fetch(`${proxyBase}?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Falha ao carregar usuários: ${res.status}`);
      }
      const data = await res.json();
      const items: User[] = Array.isArray(data) ? data : (data.items ?? []);
      setUsers(items);
    } catch (e: any) {
      setError(e.message || 'Erro ao buscar usuários');
    } finally {
      setLoading(false);
    }
  }

  async function patchUserRoles(userId: string, roles: Role[]) {
    const res = await fetch(`${proxyBase}/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Erro ao salvar: ${res.status} ${txt}`);
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchUsers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const t = setTimeout(() => { fetchUsers(); }, 350);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, roleFilter]);

  const allVisibleIds = useMemo(() => users.map(u => u.id), [users]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = allVisibleIds.every(id => next.has(id));
      if (allSelected) allVisibleIds.forEach(id => next.delete(id));
      else allVisibleIds.forEach(id => next.add(id));
      return next;
    });
  };

  function RoleBadge({ r }: { r: Role }) {
    const map = {
      ADMIN: 'bg-red-100 text-red-700 ring-red-200',
      STAFF: 'bg-blue-100 text-blue-700 ring-blue-200',
      SPONSOR: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    } as const;
    const cls = (map as any)[r] ?? 'bg-gray-100 text-gray-700 ring-gray-200';
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ring-1 ${cls}`}>
        {r}
      </span>
    );
  }

  function RoleSelector({
    value, onChange, disabled,
  }: { value: Role[]; onChange: (next: Role[]) => void; disabled?: boolean; }) {
    const has = (r: Role) => value.includes(r);
    const toggle = (r: Role) => {
      if (disabled) return;
      const next = has(r) ? value.filter(v => v !== r) : [...value, r];
      onChange(next);
    };
    const only = (r: Role) => onChange([r]);

    return (
      <div className="flex flex-wrap gap-2">
        {ALL_ROLES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => toggle(r)}
            disabled={disabled}
            className={`px-3 py-1 text-sm rounded-full ring-1 transition
              ${has(r)
                ? 'bg-gray-900 text-white ring-gray-900'
                : 'bg-white text-gray-700 ring-gray-300 hover:bg-gray-50'}`}
            title={has(r) ? 'Remover' : 'Adicionar'}
          >
            {r}
          </button>
        ))}
        <div className="h-6 w-px bg-gray-200 mx-1" />
        {ALL_ROLES.map((r) => (
          <button
            key={`${r}-only`}
            type="button"
            onClick={() => only(r)}
            disabled={disabled}
            className="px-2 py-1 text-xs rounded ring-1 ring-gray-300 text-gray-600 hover:bg-gray-50"
            title={`Definir somente ${r}`}
          >
            somente {r}
          </button>
        ))}
      </div>
    );
  }

  const [bulkRole, setBulkRole] = useState<Role>('SPONSOR');

  async function applyBulkReplace() {
    if (selectedIds.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all(Array.from(selectedIds).map(id => patchUserRoles(id, [bulkRole])));
      setUsers(prev => prev.map(u => selectedIds.has(u.id) ? { ...u, roles: [bulkRole] } : u));
    } catch (e: any) {
      setError(e.message || 'Erro ao aplicar em lote');
    } finally {
      setSaving(false);
    }
  }

  async function applyBulkToggle(r: Role) {
    if (selectedIds.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const updates: { id: string; next: Role[] }[] = [];
      for (const id of selectedIds) {
        const u = users.find(x => x.id === id);
        if (!u) continue;
        const has = u.roles.includes(r);
        const next = has ? u.roles.filter(x => x !== r) : [...u.roles, r];
        updates.push({ id, next });
      }
      await Promise.all(updates.map(u => patchUserRoles(u.id, u.next)));
      setUsers(prev => prev.map(u => {
        const f = updates.find(x => x.id === u.id);
        return f ? { ...u, roles: f.next } : u;
      }));
    } catch (e: any) {
      setError(e.message || 'Erro ao aplicar em lote');
    } finally {
      setSaving(false);
    }
  }

  async function saveSingleRoles(userId: string, roles: Role[]) {
    setSaving(true);
    setError(null);
    try {
      await patchUserRoles(userId, roles);
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, roles } : u)));
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar papéis');
    } finally {
      setSaving(false);
    }
  }

  const filteredUsers = useMemo(() => {
    let out = users;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter(u =>
        (u.name?.toLowerCase() ?? '').includes(q) ||
        (u.email?.toLowerCase() ?? '').includes(q) ||
        (u.phone ?? '').includes(q)
      );
    }
    if (roleFilter !== 'ALL') {
      out = out.filter(u => u.roles.includes(roleFilter));
    }
    return [...out].sort((a,b) => (a.name || '').localeCompare(b.name || ''));
  }, [users, query, roleFilter]);

  if (status === 'loading') {
    return <div className="px-6 py-10 flex items-center gap-2 text-gray-600"><Loader2 className="animate-spin" /> Verificando sessão…</div>;
  }
  if (status !== 'authenticated') {
    return <div className="px-6 py-10 text-red-600">Você precisa estar autenticado.</div>;
  }

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gray-900 text-white">
            <UsersIcon size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Gestão de Usuários</h1>
            <p className="text-sm text-gray-500">Busque, filtre e altere os níveis de permissão (roles).</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saving ? (
            <span className="inline-flex items-center gap-2 text-sm text-gray-700">
              <Loader2 className="animate-spin" size={16} /> Salvando…
            </span>
          ) : null}
        </div>
      </header>

      {/* filtros */}
      <section className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex items-center gap-2 rounded-xl ring-1 ring-gray-300 bg-white px-3 py-2">
          <Search size={16} className="text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone…"
            className="w-full outline-none text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setRoleFilter('ALL')}
            className={`px-3 py-2 rounded-lg ring-1 text-sm transition
              ${roleFilter === 'ALL' ? 'bg-gray-900 text-white ring-gray-900' : 'bg-white ring-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            Todos
          </button>
          {ALL_ROLES.map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-2 rounded-lg ring-1 text-sm transition
                ${roleFilter === r ? 'bg-gray-900 text-white ring-gray-900' : 'bg-white ring-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={toggleSelectAll}
            className="px-3 py-2 rounded-lg ring-1 ring-gray-300 bg-white text-sm hover:bg-gray-50"
            title="Selecionar/desmarcar todos da lista"
          >
            {selectedIds.size === allVisibleIds.length && allVisibleIds.length > 0 ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
          <span className="text-sm text-gray-600">
            {selectedIds.size} selecionado(s)
          </span>
        </div>
      </section>

      {/* ações em lote */}
      {/* 
      <section className="mb-6 rounded-2xl ring-1 ring-gray-200 bg-gray-50 p-4">
        <div className="flex items-center gap-2 mb-3 text-gray-700">
          <Shield size={16} />
          <strong className="text-sm">Ações em lote</strong>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Definir somente:</span>
            <div className="flex gap-2">
              {ALL_ROLES.map(r => (
                <button
                  key={`bulk-only-${r}`}
                  onClick={() => { setBulkRole(r); void applyBulkReplace(); }}
                  disabled={selectedIds.size === 0 || saving}
                  className="px-3 py-1.5 rounded-lg ring-1 ring-gray-300 bg-white text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="h-6 w-px bg-gray-200 hidden lg:block" />

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Alternar papel:</span>
            <div className="flex gap-2">
              {ALL_ROLES.map(r => (
                <button
                  key={`bulk-toggle-${r}`}
                  onClick={() => void applyBulkToggle(r)}
                  disabled={selectedIds.size === 0 || saving}
                  className="px-3 py-1.5 rounded-lg ring-1 ring-gray-300 bg-white text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
      */}

      {/* erros */}
      {error ? (
        <div className="mb-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 ring-1 ring-red-200 px-3 py-2 rounded-xl">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto p-1 rounded hover:bg-red-100">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* tabela */}
      <section className="overflow-hidden rounded-2xl ring-1 ring-gray-200 bg-white">
        <div className="grid grid-cols-12 gap-0 px-4 py-3 text-xs font-semibold text-gray-600 bg-gray-50">
          <div className="col-span-1">
            <input
              type="checkbox"
              onChange={toggleSelectAll}
              checked={allVisibleIds.length > 0 && selectedIds.size === allVisibleIds.length}
              aria-label="Selecionar todos"
            />
          </div>
          <div className="col-span-3">Usuário</div>
          <div className="col-span-3">Contato</div>
          <div className="col-span-3">Papéis atuais</div>
          <div className="col-span-2 text-right">Ações</div>
        </div>

        {loading ? (
          <div className="p-6 text-gray-600 flex items-center gap-2">
            <Loader2 className="animate-spin" /> Carregando usuários…
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-6 text-gray-600">Nenhum usuário encontrado.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filteredUsers.map((u) => {
              const selected = selectedIds.has(u.id);
              const expanded = expandedId === u.id;
              return (
                <li key={u.id} className="px-4 py-3">
                  <div className="grid grid-cols-12 items-center">
                    <div className="col-span-1">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelect(u.id)}
                        aria-label={`Selecionar ${u.name}`}
                      />
                    </div>
                    <div className="col-span-3">
                      <div className="font-medium">{u.name || '—'}</div>
                      <div className="text-xs text-gray-500">ID: {u.id}</div>
                    </div>
                    <div className="col-span-3 text-sm">
                      <div>{u.email}</div>
                      <div className="text-gray-500">{u.phone || '—'}</div>
                    </div>
                    <div className="col-span-3 flex flex-wrap gap-1">
                      {u.roles.length ? u.roles.map(r => <RoleBadge key={r} r={r} />) : <span className="text-xs text-gray-500">sem papéis</span>}
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <button
                        onClick={() => setExpandedId(expanded ? null : u.id)}
                        className="px-3 py-1.5 text-sm rounded-lg ring-1 ring-gray-300 bg-white hover:bg-gray-50 inline-flex items-center gap-1"
                        title="Editar papéis"
                      >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Editar
                      </button>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="mt-3 rounded-xl bg-gray-50 ring-1 ring-gray-200 p-3">
                      <p className="text-xs text-gray-600 mb-2">
                        Selecione os papéis para <strong>{u.name || u.email}</strong>. Você pode adicionar/remover múltiplos papéis.
                      </p>
                      <RoleEditorRow
                        initial={u.roles}
                        onCancel={() => setExpandedId(null)}
                        onSave={async (next) => {
                          await saveSingleRoles(u.id, next);
                          setExpandedId(null);
                        }}
                        saving={saving}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function RoleEditorRow({
  initial, onCancel, onSave, saving,
}: {
  initial: Role[];
  onCancel: () => void;
  onSave: (roles: Role[]) => Promise<void> | void;
  saving?: boolean;
}) {
  const [value, setValue] = useState<Role[]>(initial);

  useEffect(() => { setValue(initial); }, [initial]);

  const dirty = useMemo(() => {
    const a = [...initial].sort().join(',');
    const b = [...value].sort().join(',');
    return a !== b;
  }, [initial, value]);

  return (
    <div className="flex flex-col gap-3">
      <RoleSelector value={value} onChange={setValue} disabled={!!saving} />
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={onCancel}
          disabled={!!saving}
          className="px-3 py-1.5 rounded-lg ring-1 ring-gray-300 bg-white text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={() => onSave(value)}
          disabled={!dirty || !!saving}
          className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Salvar mudanças
        </button>
      </div>
    </div>
  );
}

function RoleSelector({
  value,
  onChange,
  disabled,
}: {
  value: Role[];
  onChange: (next: Role[]) => void;
  disabled?: boolean;
}) {
  const ALL_ROLES: Role[] = ['ADMIN', 'STAFF', 'SPONSOR'];
  const has = (r: Role) => value.includes(r);
  const toggle = (r: Role) => {
    if (disabled) return;
    const next = has(r) ? value.filter(v => v !== r) : [...value, r];
    onChange(next);
  };
  const only = (r: Role) => onChange([r]);

  return (
    <div className="flex flex-wrap gap-2">
      {ALL_ROLES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => toggle(r)}
          disabled={disabled}
          className={`px-3 py-1 text-sm rounded-full ring-1 transition
            ${has(r)
              ? 'bg-gray-900 text-white ring-gray-900'
              : 'bg-white text-gray-700 ring-gray-300 hover:bg-gray-50'}`}
          title={has(r) ? 'Remover' : 'Adicionar'}
        >
          {r}
        </button>
      ))}
      <div className="h-6 w-px bg-gray-200 mx-1" />
      {ALL_ROLES.map((r) => (
        <button
          key={`${r}-only`}
          type="button"
          onClick={() => only(r)}
          disabled={disabled}
          className="px-2 py-1 text-xs rounded ring-1 ring-gray-300 text-gray-600 hover:bg-gray-50"
          title={`Definir somente ${r}`}
        >
          somente {r}
        </button>
      ))}
    </div>
  );
}
