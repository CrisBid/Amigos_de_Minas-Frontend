import { getToken } from 'next-auth/jwt';
import { cookies } from 'next/headers';

const API = process.env.NEXT_PUBLIC_NEST_API_URL!;

type Params = { id: string }; // a pasta é [id]; se quiser [pid], renomeie a pasta e troque aqui

export async function POST(
  req: Request,
  context: { params: Promise<Params> } // Next 15.4.x tipa params como Promise
) {
  const { id } = await context.params; // await no params

  // next-auth v4: passe apenas o header Cookie
  const token = await getToken({
    req: { headers: { cookie: cookies().toString() } } as any,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const accessToken = (token as any)?.accessToken as string | undefined;
  if (!accessToken) return new Response('Unauthorized', { status: 401 });

  const form = await req.formData();

  const res = await fetch(`${API}/children/${encodeURIComponent(id)}/photo`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // não defina 'content-type' com FormData; o fetch cuida do boundary
    },
    body: form,
    cache: 'no-store',
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
