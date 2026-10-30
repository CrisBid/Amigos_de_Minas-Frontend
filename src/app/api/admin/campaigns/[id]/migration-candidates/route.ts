import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) return new Response('Unauthorized', { status: 401 });

  const { id } = await ctx.params;
  const qs = req.nextUrl.searchParams.toString();
  const r = await fetch(`${API}/campaigns/${id}/migration-candidates${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${at}` },
    cache: 'no-store',
  });
  return new Response(await r.text(), { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } });
}
