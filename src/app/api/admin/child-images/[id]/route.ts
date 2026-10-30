import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL;

async function requireAccessToken(request: Request) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) throw new Response('Unauthorized', { status: 401 });
  return at;
}

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, ctx: Ctx) {
  const at = await requireAccessToken(request);
  const { id } = await ctx.params;
  const r = await fetch(`${API}/child-images/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${at}` } });
  return new Response(await r.text(), { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } });
}
