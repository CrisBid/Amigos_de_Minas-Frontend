import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL!;

function getParam(ctx: any, key: string): string {
  const v = ctx.params[key];
  return Array.isArray(v) ? v[0] : v;
}

export async function PATCH(request: NextRequest, ctx: any) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) return new Response('Unauthorized', { status: 401 });

  const frameId = getParam(ctx, 'frameId');
  const body = await request.text();

  const res = await fetch(`${API}/campaign-frames/${encodeURIComponent(frameId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${at}`, 'content-type': 'application/json' },
    body,
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export async function DELETE(request: NextRequest, ctx: any) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) return new Response('Unauthorized', { status: 401 });

  const frameId = getParam(ctx, 'frameId');

  const res = await fetch(`${API}/campaign-frames/${encodeURIComponent(frameId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${at}` },
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
