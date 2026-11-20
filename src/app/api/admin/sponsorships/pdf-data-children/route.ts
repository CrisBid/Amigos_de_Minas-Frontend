import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/admin/sponsorships/pdf-data-children -> { campaignId, childIds: string[] }
// crianças sem padrinho no mesmo formato do pdf-data (com a imagem da campanha), para o PDF de cartões
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const accessToken = (token as any)?.accessToken as string | undefined;
  if (!accessToken) return new Response('Unauthorized', { status: 401 });

  const upstream = await fetch(`${API}/sponsorships/pdf-data-children`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: await req.text(),
    cache: 'no-store',
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}
