import { createBrowserClient } from '@supabase/ssr'

const env = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env ?? {};

export function createClient() {
  return createBrowserClient(
    env.BUN_PUBLIC_SUPABASE_URL ?? "",
    env.BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""
  )
}
