import { useEffect } from "react";
import { createClient } from "../lib/client";

const supabase = createClient();

export default function Auth() {
    useEffect(() => {
        async function checkUser() {
            await supabase.auth.signOut();
        }

        checkUser();
    }, []);

    async function login(provider: "github" | "google") {
        await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/auth`,
                ...(provider === "google" ? { queryParams: { prompt: "select_account" } } : {}),
            },
        });
    }

    return (
        <main className="auth-page">
            <section className="auth-card">
                <div className="brand-mark">&lt;/&gt;</div>
                <h1>Witty</h1>
                <p className="auth-subtitle">Clear answers for curious minds.</p>
                <button className="provider-button" onClick={() => login("google")}>
                    <svg className="provider-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M21.35 12.27c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.26Z" />
                        <path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.29v2.53A9.74 9.74 0 0 0 12 21.75Z" />
                        <path fill="#FBBC05" d="M6.53 13.83a5.85 5.85 0 0 1 0-3.66V7.64H3.29a9.75 9.75 0 0 0 0 8.72l3.24-2.53Z" />
                        <path fill="#EA4335" d="M12 6.14c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.22 14.63 2.25 12 2.25a9.74 9.74 0 0 0-8.71 5.39l3.24 2.53C7.3 7.86 9.46 6.14 12 6.14Z" />
                    </svg>
                    <span>Continue with Google</span>
                </button>
                <button className="provider-button" onClick={() => login("github")}>
                    <svg className="provider-icon github-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="currentColor" d="M12 2.25a9.75 9.75 0 0 0-3.08 19c.49.09.67-.21.67-.47v-1.67c-2.73.59-3.31-1.16-3.31-1.16-.45-1.14-1.1-1.44-1.1-1.44-.9-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.82.09-.64.35-1.08.64-1.33-2.18-.25-4.47-1.09-4.47-4.84 0-1.07.38-1.94 1.02-2.62-.1-.25-.44-1.25.1-2.59 0 0 .84-.27 2.68 1a9.3 9.3 0 0 1 4.88 0c1.84-1.25 2.68-1 2.68-1 .54 1.34.2 2.34.1 2.59.64.68 1.02 1.55 1.02 2.62 0 3.76-2.3 4.59-4.49 4.83.36.31.68.92.68 1.86v2.76c0 .27.18.57.68.47A9.75 9.75 0 0 0 12 2.25Z" />
                    </svg>
                    <span>Continue with GitHub</span>
                </button>
            </section>
        </main>
    );
}
