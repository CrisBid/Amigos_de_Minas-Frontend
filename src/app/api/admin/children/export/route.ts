import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL;

/**
 * Query params aceitos:
 * - level: general | city | community | selection
 * - bind: all | sponsored | unsponsored
 * - cityId, communityId
 * - ids (quando level=selection) — separados por vírgula/linha/espaço
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = new URL(`${API}/admin/children/export`);
    searchParams.forEach((v, k) => url.searchParams.set(k, v));

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ...(token?.accessToken ? { Authorization: `Bearer ${token.accessToken as string}` } : {}),
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => 'Erro ao exportar crianças.');
      return NextResponse.json({ error: msg }, { status: res.status || 500 });
    }

    const arrayBuffer = await res.arrayBuffer();
    const filename = `criancas-${searchParams.get('bind') || 'all'}-${searchParams.get('level') || 'general'}.xlsx`;

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro inesperado.' }, { status: 500 });
  }
}
