import { createBrowserClient } from '@supabase/ssr'

const runtimeEnv = (globalThis as typeof globalThis & {
  __WITTY_ENV__?: Record<string, string | undefined>;
}).__WITTY_ENV__ ?? {};

export function createClient() {
  return createBrowserClient(
    runtimeEnv.BUN_PUBLIC_SUPABASE_URL ?? "https://etebtkvcgjvbwtfvgice.supabase.co",
    runtimeEnv.BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""
  )
}
