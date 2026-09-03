import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL;

async function requireAccessToken(request: Request) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) throw new Response('Unauthorized', { status: 401 });
  return at;
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const at = await requireAccessToken(request);
  const { id } = await ctx.params;
  const r = await fetch(`${API}/campaigns/${id}/included-children`, {
    headers: { Authorization: `Bearer ${at}` },
    cache: 'no-store',
  });
  return new Response(await r.text(), { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } });
}

export async function POST(request: Request, ctx: Ctx) {
  const at = await requireAccessToken(request);
  const { id } = await ctx.params;
  const body = await request.text();
  const r = await fetch(`${API}/campaigns/${id}/included-children`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${at}`, 'content-type': 'application/json' },
    body,
  });
  return new Response(await r.text(), { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const at = await requireAccessToken(request);
  const { id } = await ctx.params;
  const body = await request.text();
  const r = await fetch(`${API}/campaigns/${id}/included-children`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${at}`, 'content-type': 'application/json' },
    body,
  });
  return new Response(await r.text(), { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } });
}
