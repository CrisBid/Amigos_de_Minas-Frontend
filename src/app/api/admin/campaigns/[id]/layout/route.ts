import { getToken } from 'next-auth/jwt';
import { cookies } from 'next/headers';

const API = process.env.NEXT_PUBLIC_NEST_API_URL;

type Params = { id: string };

export async function POST(
  req: Request,
  context: { params: Promise<Params> } // <- params agora é Promise no Next 15.4.x
) {
  const { id } = await context.params; // <- await aqui

  // next-auth v4: fornecer apenas o header Cookie
  const token = await getToken({
    req: { headers: { cookie: cookies().toString() } } as any,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const accessToken = (token as any)?.accessToken as string | undefined;
  if (!accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const form = await req.formData();

  const upstream = await fetch(`${API}/campaigns/${encodeURIComponent(id)}/layout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form, // não defina manualmente content-type com FormData
    cache: 'no-store',
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });
}
