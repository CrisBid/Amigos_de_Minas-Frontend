import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) return new Response('Unauthorized', { status: 401 });

  const res = await fetch(`${API}/campaigns/${encodeURIComponent(params.id)}/layouts`, {
    headers: { Authorization: `Bearer ${at}` },
    cache: 'no-store',
  });

  return new Response(await res.text(), { status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' } });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) return new Response('Unauthorized', { status: 401 });

  // form-data: file, name?, active?, config? (string JSON)
  const form = await req.formData();
  const res = await fetch(`${API}/campaigns/${encodeURIComponent(params.id)}/layouts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${at}` },
    body: form,
    cache: 'no-store',
  });

  return new Response(await res.text(), { status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' } });
}
