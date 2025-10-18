import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL; // ex.: https://api.seu-dominio.com/api

export const dynamic = 'force-dynamic'; // sem cache
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // 1) Auth via next-auth
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const accessToken = (token as any)?.accessToken as string | undefined;
  if (!accessToken) return new Response('Unauthorized', { status: 401 });

  // 2) Body (espera: { sponsorshipIds: string[], toSponsorId: string })
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  // 3) (Opcional) validação mínima
  const { sponsorshipIds, toSponsorId } = (body as any) ?? {};
  if (!Array.isArray(sponsorshipIds) || !toSponsorId) {
    return new Response('sponsorshipIds[] and toSponsorId are required', { status: 400 });
  }

  // 4) Proxy → backend
  const url = `${API}/sponsorships/transfer`;
  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ sponsorshipIds, toSponsorId }),
    cache: 'no-store',
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });
}

// (opcional) habilite o preflight se precisar chamar esse endpoint de outro domínio
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-origin': '*',
    },
  });
}
