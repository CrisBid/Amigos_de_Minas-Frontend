// src/lib/api.ts
const RAW_API_BASE = (process.env.NEXT_PUBLIC_NEST_API_URL || '').trim();
export const API_BASE = RAW_API_BASE.replace(/\/+$/, '');
export const apiPath = (p: string) => `${API_BASE}${p.startsWith('/') ? p : `/${p}`}`;

// Monta headers mesclando "accept" e "Authorization: Bearer <token>" se vier token
export function withAuth(token?: string | null, extra: HeadersInit = {}): HeadersInit {
  const h = new Headers(extra as any);
  if (!h.has('accept')) h.set('accept', 'application/json');
  if (token && !h.has('authorization')) h.set('authorization', `Bearer ${token}`);
  return h as any;
}

// fetch com base da API + credentials + Authorization (opcional)
export async function apiFetch(
  pathOrUrl: string | URL,
  init: RequestInit = {},
  token?: string | null
) {
  const url =
    typeof pathOrUrl === 'string'
      ? (pathOrUrl.startsWith('http') ? pathOrUrl : apiPath(pathOrUrl))
      : pathOrUrl.toString();

  return fetch(url, {
    credentials: init.credentials ?? 'include',
    ...init,
    headers: withAuth(token, init.headers || {}),
  });
}

export async function apiJson<T = any>(
  pathOrUrl: string | URL,
  init: RequestInit = {},
  token?: string | null
): Promise<T> {
  const res = await apiFetch(pathOrUrl, init, token);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json() as Promise<T>;
}

// Açúcar: cria um “client” já amarrado ao token (se preferir)
export const createApiClient = (token?: string | null) => ({
  fetch: (p: string | URL, i?: RequestInit) => apiFetch(p, i, token),
  json:  <T=any>(p: string | URL, i?: RequestInit) => apiJson<T>(p, i, token),
});
