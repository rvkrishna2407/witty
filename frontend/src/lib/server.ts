import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'

const env = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env ?? {};

export function createClient(request: Request) {
  const headers = new Headers()

  const supabase = createServerClient(
    env.BUN_PUBLIC_VITE_SUPABASE_URL ?? "",
    env.BUN_PUBLIC_VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get('Cookie') ?? '') as {
            name: string
            value: string
          }[]
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            headers.append('Set-Cookie', serializeCookieHeader(name, value, options))
          )
        },
      },
    }
  )

  return { supabase, headers }
}
