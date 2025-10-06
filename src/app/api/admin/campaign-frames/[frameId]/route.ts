import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
const API = process.env.NEXT_PUBLIC_NEST_API_URL;

export async function PATCH(req: NextRequest, { params }: { params: { frameId: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) return new Response('Unauthorized', { status: 401 });

  const body = await req.text();
  const res = await fetch(`${API}/campaign-frames/${encodeURIComponent(params.frameId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${at}`, 'content-type': 'application/json' },
    body,
  });
  return new Response(await res.text(), { status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' } });
}

export async function DELETE(req: NextRequest, { params }: { params: { frameId: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) return new Response('Unauthorized', { status: 401 });

  const res = await fetch(`${API}/campaign-frames/${encodeURIComponent(params.frameId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${at}` },
  });
  return new Response(await res.text(), { status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' } });
}
