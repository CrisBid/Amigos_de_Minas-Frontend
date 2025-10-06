import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL;

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const accessToken = (token as any)?.accessToken as string | undefined;
  if (!accessToken) return new Response('Unauthorized', { status: 401 });

  // corpo JSON vindo do front
  const body = await req.text(); // mantém JSON bruto
  
  const res = await fetch(`${API}/children/bulk/commit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body,
    cache: 'no-store',
  });

  console.log(body);
  console.log(res);

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
