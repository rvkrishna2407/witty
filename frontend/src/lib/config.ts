const runtimeEnv = (globalThis as typeof globalThis & {
    __WITTY_ENV__?: Record<string, string | undefined>;
}).__WITTY_ENV__ ?? {};

export const BACKEND_URL = runtimeEnv.BUN_PUBLIC_BACKEND_URL ?? "http://localhost:3000";