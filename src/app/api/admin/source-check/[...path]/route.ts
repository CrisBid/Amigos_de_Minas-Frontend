import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL!;

type Ctx = { params: Promise<{ path: string[] }> };

// /api/admin/source-check/{config|sheet|photos|site-md5} → backend /source-check/...
async function forward(req: NextRequest, ctx: Ctx, method: 'GET' | 'PUT' | 'POST') {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) return new Response('Unauthorized', { status: 401 });

  const { path } = await ctx.params;
  const res = await fetch(`${API}/source-check/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`, {
    method,
    headers: { Authorization: `Bearer ${at}`, ...(method === 'GET' ? {} : { 'content-type': 'application/json' }) },
    body: method === 'GET' ? undefined : await req.text(),
    cache: 'no-store',
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export const GET = (req: NextRequest, ctx: Ctx) => forward(req, ctx, 'GET');
export const PUT = (req: NextRequest, ctx: Ctx) => forward(req, ctx, 'PUT');
export const POST = (req: NextRequest, ctx: Ctx) => forward(req, ctx, 'POST');
