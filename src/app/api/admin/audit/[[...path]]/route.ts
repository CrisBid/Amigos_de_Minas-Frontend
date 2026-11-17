import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL!;

type Ctx = { params: Promise<{ path?: string[] }> };

// /api/admin/audit{,/facets,/batches} → backend /audit/... (só leitura)
export async function GET(req: NextRequest, ctx: Ctx) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) return new Response('Unauthorized', { status: 401 });

  const { path = [] } = await ctx.params;
  const sub = path.length ? `/${path.map(encodeURIComponent).join('/')}` : '';
  const res = await fetch(`${API}/audit${sub}${req.nextUrl.search}`, {
    headers: { Authorization: `Bearer ${at}` },
    cache: 'no-store',
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
