import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL;

type Ctx = { params: Promise<{ id: string }> };

async function forward(req: NextRequest, ctx: Ctx, method: 'GET' | 'PATCH' | 'DELETE') {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const accessToken = (token as any)?.accessToken as string | undefined;
  if (!accessToken) return new Response('Unauthorized', { status: 401 });

  const { id } = await ctx.params;
  const res = await fetch(`${API}/schools/${encodeURIComponent(id)}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(method === 'PATCH' ? { 'content-type': 'application/json' } : {}),
    },
    body: method === 'PATCH' ? await req.text() : undefined,
    cache: 'no-store',
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export const GET = (req: NextRequest, ctx: Ctx) => forward(req, ctx, 'GET');
export const PATCH = (req: NextRequest, ctx: Ctx) => forward(req, ctx, 'PATCH');
export const DELETE = (req: NextRequest, ctx: Ctx) => forward(req, ctx, 'DELETE');
