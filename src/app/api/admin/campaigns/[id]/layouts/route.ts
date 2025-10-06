// src/app/api/admin/campaigns/[id]/layouts/route.ts
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL!;

const param = (ctx: any, key: string) => {
  const v = ctx.params[key];
  return Array.isArray(v) ? v[0] : v;
};

export async function GET(req: NextRequest, ctx: any) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) return new Response('Unauthorized', { status: 401 });

  const id = param(ctx, 'id');

  const res = await fetch(`${API}/campaigns/${encodeURIComponent(id)}/layouts`, {
    headers: { Authorization: `Bearer ${at}` },
    cache: 'no-store',
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export async function POST(req: NextRequest, ctx: any) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const at = (token as any)?.accessToken as string | undefined;
  if (!at) return new Response('Unauthorized', { status: 401 });

  const id = param(ctx, 'id');

  // form-data: file, name?, active?, config? (string JSON)
  const form = await req.formData();

  const res = await fetch(`${API}/campaigns/${encodeURIComponent(id)}/layouts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${at}` },
    body: form,
    cache: 'no-store',
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
