import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL!;

function getParam(ctx: any, key: string): string {
  const v = ctx.params[key];
  return Array.isArray(v) ? v[0] : v;
}

export async function POST(req: NextRequest, ctx: any) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) return new Response('Unauthorized', { status: 401 });

  const frameId = getParam(ctx, 'frameId');

  const res = await fetch(`${API}/campaign-frames/${encodeURIComponent(frameId)}/set-active`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${at}` },
    cache: 'no-store',
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
