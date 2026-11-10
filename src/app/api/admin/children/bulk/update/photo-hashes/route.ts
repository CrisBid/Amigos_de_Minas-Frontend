import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL!;

// body: { campaignId, childIds } → impressão digital da foto atual de cada criança (desta e de outra campanha)
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) return new Response('Unauthorized', { status: 401 });

  const res = await fetch(`${API}/children/bulk/update/photo-hashes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${at}`, 'content-type': 'application/json' },
    body: await req.text(),
    cache: 'no-store',
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
