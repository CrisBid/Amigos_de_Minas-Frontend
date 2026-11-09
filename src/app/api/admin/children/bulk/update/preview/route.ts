import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL!;

// body: { rows, context } → para cada linha, se a criança já existe (com a ficha atual) ou é nova
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) return new Response('Unauthorized', { status: 401 });

  const res = await fetch(`${API}/children/bulk/update/preview`, {
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
