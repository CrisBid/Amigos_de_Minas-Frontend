// app/api/admin/sponsorships/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL;

/**
 * Proxy para exportar Excel de apadrinhamentos.
 * Aceita query params: level, cityId, communityId, sponsorId, ids, status, method
 * Ex.: /api/admin/sponsorships/export?level=city&cityId=...
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = new URL(`${API}/admin/sponsorships/export`);
    // Copia todos os query params
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
      const msg = await res.text().catch(() => 'Erro ao exportar.');
      return NextResponse.json({ error: msg }, { status: res.status || 500 });
    }

    // Lê o binário e repassa com headers de download
    const arrayBuffer = await res.arrayBuffer();

    // Define um nome padrão baseado no level
    const level = searchParams.get('level') || 'general';
    const filename = `apadrinhamentos-${level}.xlsx`;

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
