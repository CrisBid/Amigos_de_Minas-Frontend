import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL;

type Ctx = { params: Promise<{ frameId: string }> };

// body: { config? } — grava o enquadramento nas fotos já enviadas com este layout
export async function POST(request: Request, ctx: Ctx) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) return new Response('Unauthorized', { status: 401 });

  const { frameId } = await ctx.params;
  const body = await request.text();
  const r = await fetch(`${API}/campaign-frames/${encodeURIComponent(frameId)}/apply-to-images`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${at}`, 'content-type': 'application/json' },
    body,
  });
  return new Response(await r.text(), { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } });
}
