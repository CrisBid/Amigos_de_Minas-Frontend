import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL!;

type Ctx = { params: Promise<{ frameId: string }> };

// PUT form-data: file → troca só a imagem do layout
export async function PUT(req: NextRequest, ctx: Ctx) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) return new Response('Unauthorized', { status: 401 });

  const { frameId } = await ctx.params;
  const form = await req.formData();

  const res = await fetch(`${API}/campaign-frames/${encodeURIComponent(frameId)}/file`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${at}` },
    body: form,
    cache: 'no-store',
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
