import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = (process.env.NEST_API_URL ?? process.env.NEXT_PUBLIC_NEST_API_URL)!;

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const accessToken = (token as any)?.accessToken;
    if (!accessToken) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // repassa todos os query params (query, roles, etc.)
    const url = new URL(req.url);
    const qs = url.searchParams.toString();

    const res = await fetch(`${API}/users${qs ? `?${qs}` : ''}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const text = await res.text(); // mantém body integral
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (err) {
    console.error('Erro proxy GET /api/admin/users:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
