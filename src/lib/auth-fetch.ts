import { getToken } from "next-auth/jwt"
import { cookies, headers } from "next/headers"

export async function authFetch(input: RequestInfo, init?: RequestInit) {
  // Reusa cookie/header da requisição atual p/ ler o token do NextAuth
  const token = await getToken({
    req: { headers: headers(), cookies: cookies() } as any,
  })

  const headersInit = new Headers(init?.headers)
  if ((token as any)?.accessToken) {
    headersInit.set("Authorization", `Bearer ${(token as any).accessToken}`)
  }
  headersInit.set("Content-Type", "application/json")

  return fetch(input, { ...init, headers: headersInit })
}
