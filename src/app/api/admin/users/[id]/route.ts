import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = (process.env.NEST_API_URL ?? process.env.NEXT_PUBLIC_NEST_API_URL)!;

// helper p/ suportar projetos onde ctx.params é Promise
async function resolveParams<T>(p: T | Promise<T>): Promise<T> {
  return p instanceof Promise ? await p : (p as T);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await resolveParams(ctx.params as any);

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const accessToken = (token as any)?.accessToken;
    if (!accessToken) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await req.text(); // preserva JSON original

    const res = await fetch(`${API}/users/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (err) {
    console.error('Erro proxy PATCH /api/admin/users/[id]:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// (Opcional) Se quiser buscar 1 usuário: GET /api/admin/users/:id -> GET /users/:id
export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await resolveParams(ctx.params as any);

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const accessToken = (token as any)?.accessToken;
    if (!accessToken) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const res = await fetch(`${API}/users/${id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (err) {
    console.error('Erro proxy GET /api/admin/users/[id]:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
