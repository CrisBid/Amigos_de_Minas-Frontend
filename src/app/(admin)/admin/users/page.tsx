'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Search, Users as UsersIcon, Loader2, Check, X, AlertCircle, KeyRound, Shield,
  Eye, EyeOff, Copy, RefreshCw, Wand2, CheckCircle2, Mail, Phone,
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

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  STAFF: 'Equipe',
  SPONSOR: 'Padrinho',
};

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'bg-red-100 text-red-700 ring-red-200',
  STAFF: 'bg-blue-100 text-blue-700 ring-blue-200',
  SPONSOR: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
};

const MIN_PASSWORD = 6;
const proxyBase = '/api/admin/users';

async function errorText(res: Response, fallback: string) {
  try {
    const j = await res.json();
    const msg = j?.message ?? j?.error;
    if (msg) return Array.isArray(msg) ? msg.join(' ') : String(msg);
  } catch {
    // sem corpo JSON
  }
  return `${fallback} (${res.status})`;
}

// sem caracteres ambíguos (0/O, 1/l/I) para facilitar ditar a senha ao usuário
function generatePassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function initials(name?: string, email?: string) {
  const base = (name || email || '?').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

export default function Page() {
  const { data: session, status } = useSession();
  const myId: string | undefined = (session?.user as any)?.id;
  const myRoles: string[] = (session?.user as any)?.roles ?? [];
  const isAdmin = myRoles.includes('ADMIN');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');

  const [rolesFor, setRolesFor] = useState<User | null>(null);
  const [passwordFor, setPasswordFor] = useState<User | null>(null);

  // carrega todos uma vez; busca e filtro são feitos aqui para os contadores ficarem corretos
  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(proxyBase, { cache: 'no-store' });
      if (!res.ok) throw new Error(await errorText(res, 'Falha ao carregar usuários'));
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : (data.items ?? []));
    } catch (e: any) {
      setError(e.message || 'Erro ao buscar usuários');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === 'authenticated') fetchUsers();
  }, [status]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const counts = useMemo(() => {
    const c: Record<Role | 'ALL', number> = { ALL: users.length, ADMIN: 0, STAFF: 0, SPONSOR: 0 };
    for (const u of users) for (const r of u.roles) c[r] = (c[r] ?? 0) + 1;
    return c;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    return users
      .filter((u) => roleFilter === 'ALL' || u.roles.includes(roleFilter))
      .filter((u) => {
        if (!q) return true;
        return (
          (u.name ?? '').toLowerCase().includes(q) ||
          (u.email ?? '').toLowerCase().includes(q) ||
          (!!qDigits && (u.phone ?? '').replace(/\D/g, '').includes(qDigits))
        );
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  }, [users, query, roleFilter]);

  async function saveRoles(user: User, roles: Role[]) {
    const res = await fetch(`${proxyBase}/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles }),
    });
    if (!res.ok) throw new Error(await errorText(res, 'Erro ao salvar papéis'));
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, roles } : u)));
    setRolesFor(null);
    setToast(`Papéis de ${user.name || user.email} atualizados.`);
  }

  async function savePassword(user: User, password: string) {
    const res = await fetch(`${proxyBase}/${user.id}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.status === 403) throw new Error('Somente administradores podem alterar senhas.');
    if (!res.ok) throw new Error(await errorText(res, 'Erro ao alterar a senha'));
  }

  if (status === 'loading') {
    return <div className="px-6 py-10 flex items-center gap-2 text-gray-600"><Loader2 className="animate-spin" /> Verificando sessão…</div>;
  }
  if (status !== 'authenticated') {
    return <div className="px-6 py-10 text-red-600">Você precisa estar autenticado.</div>;
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gray-900 text-white">
            <UsersIcon size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Gestão de Usuários</h1>
            <p className="text-sm text-gray-500">
              Busque usuários, altere papéis{isAdmin ? ' e redefina senhas de acesso' : ''}.
            </p>
          </div>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="px-3 py-2 rounded-lg ring-1 ring-gray-300 bg-white text-sm hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </header>

      {/* filtros */}
      <section className="mb-5 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl ring-1 ring-gray-300 bg-white px-3 py-2">
          <Search size={16} className="text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone…"
            className="w-full outline-none text-sm"
          />
          {query ? (
            <button onClick={() => setQuery('')} className="p-1 rounded hover:bg-gray-100 text-gray-500" aria-label="Limpar busca">
              <X size={14} />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['ALL', ...ALL_ROLES] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-2 rounded-lg ring-1 text-sm transition inline-flex items-center gap-2
                ${roleFilter === r ? 'bg-gray-900 text-white ring-gray-900' : 'bg-white ring-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {r === 'ALL' ? 'Todos' : ROLE_LABEL[r]}
              <span className={`text-xs px-1.5 rounded-full ${roleFilter === r ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}`}>
                {counts[r]}
              </span>
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <div className="mb-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 ring-1 ring-red-200 px-3 py-2 rounded-xl">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto p-1 rounded hover:bg-red-100">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* lista */}
      <section className="overflow-hidden rounded-2xl ring-1 ring-gray-200 bg-white">
        <div className="hidden md:grid grid-cols-12 px-4 py-3 text-xs font-semibold text-gray-600 bg-gray-50">
          <div className="col-span-4">Usuário</div>
          <div className="col-span-3">Contato</div>
          <div className="col-span-2">Papéis</div>
          <div className="col-span-3 text-right">Ações</div>
        </div>

        {loading ? (
          <div className="p-6 text-gray-600 flex items-center gap-2">
            <Loader2 className="animate-spin" /> Carregando usuários…
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-6 text-gray-600">Nenhum usuário encontrado.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filteredUsers.map((u) => (
              <li key={u.id} className="px-4 py-3 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-0 md:items-center hover:bg-gray-50/60">
                <div className="md:col-span-4 flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-gray-900 text-white text-xs font-semibold flex items-center justify-center">
                    {initials(u.name, u.email)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {u.name || '—'}
                      {u.id === myId ? <span className="ml-2 text-xs font-normal text-gray-500">(você)</span> : null}
                    </div>
                    <div className="text-xs text-gray-500">Desde {formatDate(u.createdAt)}</div>
                  </div>
                </div>
                <div className="md:col-span-3 text-sm min-w-0">
                  <div className="flex items-center gap-1.5 truncate"><Mail size={12} className="text-gray-400 shrink-0" /> {u.email}</div>
                  <div className="flex items-center gap-1.5 text-gray-500"><Phone size={12} className="text-gray-400 shrink-0" /> {u.phone || '—'}</div>
                </div>
                <div className="md:col-span-2 flex flex-wrap gap-1">
                  {u.roles.length
                    ? u.roles.map((r) => <RoleBadge key={r} r={r} />)
                    : <span className="text-xs text-gray-500">sem papéis</span>}
                </div>
                <div className="md:col-span-3 flex items-center md:justify-end gap-2">
                  <button
                    onClick={() => setRolesFor(u)}
                    className="px-3 py-1.5 text-sm rounded-lg ring-1 ring-gray-300 bg-white hover:bg-gray-50 inline-flex items-center gap-1.5"
                  >
                    <Shield size={14} /> Papéis
                  </button>
                  {isAdmin ? (
                    <button
                      onClick={() => setPasswordFor(u)}
                      className="px-3 py-1.5 text-sm rounded-lg ring-1 ring-gray-300 bg-white hover:bg-gray-50 inline-flex items-center gap-1.5"
                    >
                      <KeyRound size={14} /> Senha
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!loading && filteredUsers.length > 0 ? (
        <p className="mt-3 text-xs text-gray-500">
          Mostrando {filteredUsers.length} de {users.length} usuário(s).
        </p>
      ) : null}

      {rolesFor ? (
        <RolesModal
          user={rolesFor}
          isSelf={rolesFor.id === myId}
          onClose={() => setRolesFor(null)}
          onSave={(roles) => saveRoles(rolesFor, roles)}
        />
      ) : null}

      {passwordFor ? (
        <PasswordModal
          user={passwordFor}
          onClose={() => setPasswordFor(null)}
          onSave={(pwd) => savePassword(passwordFor, pwd)}
        />
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-gray-900 text-white text-sm px-4 py-3 shadow-lg">
          <CheckCircle2 size={16} className="text-emerald-400" /> {toast}
        </div>
      ) : null}
    </div>
  );
}

function RoleBadge({ r }: { r: Role }) {
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ring-1 ${ROLE_BADGE[r] ?? 'bg-gray-100 text-gray-700 ring-gray-200'}`}>
      {ROLE_LABEL[r] ?? r}
    </span>
  );
}

function Modal({ title, subtitle, icon, onClose, children }: {
  title: string;
  subtitle?: React.ReactNode;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    // acima do cabeçalho do site (z-50); no celular abre de baixo, com rolagem própria
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/40" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-2xl sm:rounded-2xl bg-white shadow-xl ring-1 ring-gray-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white flex items-start gap-3 p-5 border-b border-gray-100">
          <div className="p-2 rounded-xl bg-gray-900 text-white">{icon}</div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{title}</h2>
            {subtitle ? <p className="text-sm text-gray-500 truncate">{subtitle}</p> : null}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function RolesModal({ user, isSelf, onClose, onSave }: {
  user: User;
  isSelf: boolean;
  onClose: () => void;
  onSave: (roles: Role[]) => Promise<void>;
}) {
  const [value, setValue] = useState<Role[]>(user.roles);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = [...user.roles].sort().join(',') !== [...value].sort().join(',');
  const losingOwnAdmin = isSelf && user.roles.includes('ADMIN') && !value.includes('ADMIN');

  const toggle = (r: Role) =>
    setValue((prev) => (prev.includes(r) ? prev.filter((v) => v !== r) : [...prev, r]));

  async function submit() {
    if (value.length === 0) return setError('Selecione pelo menos um papel.');
    setSaving(true);
    setError(null);
    try {
      await onSave(value);
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar papéis');
      setSaving(false);
    }
  }

  return (
    <Modal title="Papéis de acesso" subtitle={user.name || user.email} icon={<Shield size={16} />} onClose={onClose}>
      <div className="flex flex-col gap-2">
        {ALL_ROLES.map((r) => (
          <label
            key={r}
            className={`flex items-center gap-3 rounded-xl ring-1 px-3 py-2.5 cursor-pointer transition
              ${value.includes(r) ? 'ring-gray-900 bg-gray-50' : 'ring-gray-200 hover:bg-gray-50'}`}
          >
            <input type="checkbox" checked={value.includes(r)} onChange={() => toggle(r)} disabled={saving} />
            <span className="flex-1 text-sm font-medium">{ROLE_LABEL[r]}</span>
            <RoleBadge r={r} />
          </label>
        ))}
      </div>

      {losingOwnAdmin ? (
        <p className="mt-3 text-xs text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2">
          Atenção: você está removendo o seu próprio acesso de administrador.
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} disabled={saving} className="px-3 py-1.5 rounded-lg ring-1 ring-gray-300 bg-white text-sm hover:bg-gray-50 disabled:opacity-50">
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={!dirty || saving}
          className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvar
        </button>
      </div>
    </Modal>
  );
}

function PasswordModal({ user, onClose, onSave }: {
  user: User;
  onClose: () => void;
  onSave: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  function generate() {
    const p = generatePassword();
    setPassword(p);
    setConfirm(p);
    setShow(true);
    setError(null);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível (ex.: http sem localhost): a senha segue visível na tela
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
    if (password !== confirm) return setError('As senhas não são iguais.');
    setSaving(true);
    try {
      await onSave(password);
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar a senha');
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <Modal title="Senha alterada" subtitle={user.name || user.email} icon={<CheckCircle2 size={16} />} onClose={onClose}>
        <p className="text-sm text-gray-700">
          A nova senha de <strong>{user.email}</strong> já está valendo. As sessões abertas desse usuário foram encerradas.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 ring-1 ring-gray-200 px-3 py-2.5">
          <code className="flex-1 font-mono text-sm break-all">{password}</code>
          <button onClick={copy} className="px-2.5 py-1 rounded-lg ring-1 ring-gray-300 bg-white text-xs hover:bg-gray-50 inline-flex items-center gap-1.5">
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copiada' : 'Copiar'}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">Envie a senha ao usuário por um canal seguro. Ela não será exibida novamente.</p>
        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm hover:opacity-90">
            Concluir
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Redefinir senha" subtitle={user.name || user.email} icon={<KeyRound size={16} />} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nova senha</label>
          <div className="flex items-center gap-2 rounded-xl ring-1 ring-gray-300 bg-white px-3 py-2 focus-within:ring-gray-900">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
              className="w-full outline-none text-sm font-mono"
              placeholder={`Mínimo de ${MIN_PASSWORD} caracteres`}
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="text-gray-500 hover:text-gray-800" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Confirmar nova senha</label>
          <input
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-xl ring-1 ring-gray-300 bg-white px-3 py-2 outline-none text-sm font-mono focus:ring-gray-900"
          />
        </div>

        <button type="button" onClick={generate} className="self-start text-sm text-gray-700 hover:text-gray-900 inline-flex items-center gap-1.5">
          <Wand2 size={14} /> Gerar senha aleatória
        </button>

        <p className="text-xs text-gray-500 bg-gray-50 ring-1 ring-gray-200 rounded-lg px-3 py-2">
          O usuário será desconectado dos dispositivos onde estiver logado e precisará entrar com a nova senha.
          Links de &quot;esqueci minha senha&quot; pendentes deixam de valer.
        </p>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="px-3 py-1.5 rounded-lg ring-1 ring-gray-300 bg-white text-sm hover:bg-gray-50 disabled:opacity-50">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !password}
            className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Alterar senha
          </button>
        </div>
      </form>
    </Modal>
  );
}
