import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
const API = process.env.NEXT_PUBLIC_NEST_API_URL;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {

  const { id } = await ctx.params;
  const qs = req.nextUrl.searchParams.toString();
  const url = `${API}/children/${encodeURIComponent(id)}/render${qs ? `?${qs}` : ''}`;

  const r = await fetch(url, {
    cache: 'no-store',
  });

  // repassa o binário sem tocar
  const body = await r.arrayBuffer();
  const ct = r.headers.get('content-type') ?? 'image/webp';
  return new Response(body, { status: r.status, headers: { 'content-type': ct } });
}
