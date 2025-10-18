import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export const dynamic = 'force-dynamic'

const API = process.env.NEXT_PUBLIC_NEST_API_URL
const PAGE_SIZE_DEFAULT = 20

function buildBackendURL(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q = searchParams.get('q') ?? ''
  const active = searchParams.get('active') // 'true' | 'false' | null

  const url = new URL(`${API}/collection-points`)
  if (q) url.searchParams.set('q', q)
  if (active === 'true') url.searchParams.set('active', 'true')
  if (active === 'false') url.searchParams.set('active', 'false')
  return url
}

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    const url = buildBackendURL(req)

    const res = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        ...(token?.accessToken ? { Authorization: `Bearer ${token.accessToken}` } : {}),
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      // retorna payload paginado vazio para não quebrar UI
      return NextResponse.json(
        { items: [], total: 0, page: 1, pageSize: PAGE_SIZE_DEFAULT, pages: 1 },
        { status: 200 },
      )
    }

    // o backend pode devolver array simples ou {items:...}
    const json = await res.json()
    const items: any[] = Array.isArray(json?.items)
      ? json.items
      : Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
      ? json
      : []

    // paginação no proxy
    const sp = req.nextUrl.searchParams
    const page = Math.max(1, Number(sp.get('page') || '1'))
    const pageSize = Math.max(1, Number(sp.get('pageSize') || String(PAGE_SIZE_DEFAULT)))
    const total = items.length
    const pages = Math.max(1, Math.ceil(total / pageSize))
    const start = (page - 1) * pageSize
    const paged = items.slice(start, start + pageSize)

    return NextResponse.json({ items: paged, total, page, pageSize, pages }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json(
      { items: [], total: 0, page: 1, pageSize: PAGE_SIZE_DEFAULT, pages: 1, error: e?.message || 'proxy_error' },
      { status: 200 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req })
    const body = await req.json()

    const res = await fetch(`${API}/collection-points`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...(token?.accessToken ? { Authorization: `Bearer ${token.accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    })

    const text = await res.text()
    const payload = (() => {
      try { return JSON.parse(text) } catch { return { message: text } }
    })()

    return NextResponse.json(payload, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'proxy_error' }, { status: 500 })
  }
}
