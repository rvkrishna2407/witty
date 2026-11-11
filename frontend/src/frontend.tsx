/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const elem = document.getElementById("root")!;
const runtimeEnv = (globalThis as typeof globalThis & {
  __WITTY_ENV__?: Record<string, string | undefined>;
}).__WITTY_ENV__;

if (!runtimeEnv?.BUN_PUBLIC_VITE_SUPABASE_URL || !runtimeEnv.BUN_PUBLIC_VITE_SUPABASE_PUBLISHABLE_KEY) {
  elem.textContent = "Frontend configuration is missing. Add the Supabase variables in Vercel.";
} else {
  const app = (
    <StrictMode>
      <App />
    </StrictMode>
  );

  const root = createRoot(elem);
  root.render(app);
}
