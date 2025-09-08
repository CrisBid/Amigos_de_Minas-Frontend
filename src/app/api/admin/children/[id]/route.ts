import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEST_AUTH_BASE_URL!;

async function access(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const t = (token as any)?.accessToken as string | undefined;
  if (!t) throw new Response('Unauthorized', { status: 401 });
  return t;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const at = await access(req);
  const r = await fetch(`${API}/children/${params.id}`, {
    headers: { Authorization: `Bearer ${at}` },
    cache: 'no-store',
  });
  return new Response(await r.text(), { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const at = await access(req);
  const body = await req.text();
  const r = await fetch(`${API}/children/${params.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${at}`, 'content-type': 'application/json' },
    body,
  });
  return new Response(await r.text(), { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const at = await access(req);
  const r = await fetch(`${API}/children/${params.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${at}` },
  });
  return new Response(await r.text(), { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } });
}
