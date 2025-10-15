import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL;

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req });
    const res = await fetch(`${API}/children/stats/overview`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...(token?.accessToken ? { Authorization: `Bearer ${token.accessToken as string}` } : {}),
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      // Fallback vazio mas com estrutura esperada pela tela
      return NextResponse.json(
        {
          general: { total: 0, active: 0, pending: 0, in_progress: 0, available: 0, sponsorshipRate: 0 },
          byCity: [],
          byCommunity: [],
          generatedAt: new Date().toISOString(),
        },
        { status: 200 },
      );
    }

    const json = await res.json();
    return NextResponse.json(json, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      {
        general: { total: 0, active: 0, pending: 0, in_progress: 0, available: 0, sponsorshipRate: 0 },
        byCity: [],
        byCommunity: [],
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
