import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL!;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> } // <- note que é Promise
) {
  try {
    const { id } = await ctx.params; // <- precisa dar await

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const accessToken = (token as any)?.accessToken;
    if (!accessToken) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const response = await fetch(`${API}/profiles/${id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.message || 'Erro ao buscar usuário' },
        { status: response.status }
      );
    }

    const data = await response.json();

    console.log(data);
    
    return NextResponse.json(data);
  } catch (err) {
    console.error('Erro ao buscar usuário:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
