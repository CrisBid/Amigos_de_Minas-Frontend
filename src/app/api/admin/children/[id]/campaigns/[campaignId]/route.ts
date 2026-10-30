import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL;

async function requireAccessToken(request: Request) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) throw new Response('Unauthorized', { status: 401 });
  return at;
}

type Ctx = { params: Promise<{ id: string; campaignId: string }> };

// body: { publicId, wantedGift } — ID e presente da criança nesta campanha
export async function PUT(request: Request, ctx: Ctx) {
  const at = await requireAccessToken(request);
  const { id, campaignId } = await ctx.params;
  const body = await request.text();
  const r = await fetch(`${API}/children/${id}/campaigns/${campaignId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${at}`, 'content-type': 'application/json' },
    body,
  });
  return new Response(await r.text(), { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } });
}
