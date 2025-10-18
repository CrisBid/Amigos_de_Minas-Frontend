import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export const dynamic = 'force-dynamic'

const API = process.env.NEXT_PUBLIC_NEST_API_URL

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const res = await fetch(`${API}/collection-points/${id}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
    const text = await res.text()
    const payload = (() => { try { return JSON.parse(text) } catch { return { message: text } } })()
    return NextResponse.json(payload, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'proxy_error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const token = await getToken({ req })
    const body = await req.json()
    const res = await fetch(`${API}/collection-points/${id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...(token?.accessToken ? { Authorization: `Bearer ${token.accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    const payload = (() => { try { return JSON.parse(text) } catch { return { message: text } } })()
    return NextResponse.json(payload, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'proxy_error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const token = await getToken({ req })
    const res = await fetch(`${API}/collection-points/${id}`, {
      method: 'DELETE',
      headers: {
        accept: 'application/json',
        ...(token?.accessToken ? { Authorization: `Bearer ${token.accessToken}` } : {}),
      },
    })
    const text = await res.text()
    const payload = (() => { try { return JSON.parse(text) } catch { return { message: text } } })()
    return NextResponse.json(payload, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'proxy_error' }, { status: 500 })
  }
}
