import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = new URL(`${API}/sponsors`);
    searchParams.forEach((v, k) => url.searchParams.set(k, v));

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    const res = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        ...(token?.accessToken ? { Authorization: `Bearer ${token.accessToken as string}` } : {}),
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Falha na listagem de padrinhos.');
      return NextResponse.json({ error: text }, { status: res.status || 500 });
    }

    const json = await res.json();
    return NextResponse.json(json, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro inesperado.' }, { status: 500 });
  }
}
