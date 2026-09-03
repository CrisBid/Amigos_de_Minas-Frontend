import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_NEST_API_URL;

export async function GET(req: NextRequest) {

  const url = new URL(`${API}/children/stats/all`);
  const campaignId = req.nextUrl.searchParams.get('campaignId');
  if (campaignId) url.searchParams.set('campaignId', campaignId);

  const res = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    return NextResponse.json({ total: 0, active: 0, pending: 0, available: 0, sponsorshipRate: 0 }, { status: 200 });
  }

  const json = await res.json();
  return NextResponse.json(json, { status: 200 });
}
