const env = (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
}).env ?? {};

export const BACKEND_URL = env.BUN_PUBLIC_BACKEND_URL ?? "http://localhost:3000";