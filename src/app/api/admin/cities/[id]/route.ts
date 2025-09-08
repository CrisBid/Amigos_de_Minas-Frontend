import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const API = process.env.NEXT_PUBLIC_NEST_API_URL!

async function requireAccessToken(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const accessToken = (token as any)?.accessToken as string | undefined
  if (!accessToken) throw new Response('Unauthorized', { status: 401 })
  return accessToken
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const accessToken = await requireAccessToken(req) as unknown as string
  const res = await fetch(`${API}/cities/${params.id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const accessToken = await requireAccessToken(req) as unknown as string
  const body = await req.text()
  const res = await fetch(`${API}/cities/${params.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body,
  })
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const accessToken = await requireAccessToken(req) as unknown as string
  const res = await fetch(`${API}/cities/${params.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  })
}
