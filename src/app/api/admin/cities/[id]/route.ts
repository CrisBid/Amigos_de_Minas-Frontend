// src/app/api/admin/cities/[id]/route.ts
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL!;

async function requireAccessToken(request: Request) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const accessToken = (token as any)?.accessToken as string | undefined;
  if (!accessToken) throw new Response('Unauthorized', { status: 401 });
  return accessToken;
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const accessToken = await requireAccessToken(request);
  const res = await fetch(`${API}/cities/${params.id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const accessToken = await requireAccessToken(request);
  const body = await request.text();
  const res = await fetch(`${API}/cities/${params.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body,
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const accessToken = await requireAccessToken(request);
  const res = await fetch(`${API}/cities/${params.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
