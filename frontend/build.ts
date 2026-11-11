import tailwind from "bun-plugin-tailwind";
import { rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function loadLocalEnv() {
  const values: Record<string, string> = {};
  for (const file of [".env", ".env.local"]) {
    const envFile = Bun.file(file);
    if (!(await envFile.exists())) {
      continue;
    }
    const text = await envFile.text();
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([^#=]+)=(.*)\s*$/);
      if (match) {
        const key = match[1];
        const value = match[2];
        if (key !== undefined && value !== undefined) {
          values[key.trim()] = value.trim().replace(/^"(.*)"$/, "$1");
        }
      }
    }
  }
  return values;
}

const localEnv = await loadLocalEnv();
const publicEnv = (name: string, fallback = "") => process.env[name] ?? localEnv[name] ?? fallback;
const supabaseUrl = publicEnv("BUN_PUBLIC_VITE_SUPABASE_URL");
const supabaseKey = publicEnv("BUN_PUBLIC_VITE_SUPABASE_PUBLISHABLE_KEY");
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing BUN_PUBLIC_VITE_SUPABASE_URL or BUN_PUBLIC_VITE_SUPABASE_PUBLISHABLE_KEY. " +
      "Add both variables to Vercel and run the build again.",
  );
}
const outdir = path.join(process.cwd(), "dist");
await rm(outdir, { recursive: true, force: true });

const entrypoints = [...new Bun.Glob("src/**/*.html").scanSync()];

const result = await Bun.build({
  entrypoints,
  outdir,
  plugins: [tailwind],
  minify: true,
  target: "browser",
  sourcemap: "linked",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env.npm_package_name": JSON.stringify("witty-frontend"),
  },
});

for (const output of result.outputs) {
  console.log(` ${path.relative(process.cwd(), output.path)}  ${(output.size / 1024).toFixed(1)} KB`);
}

const indexPath = path.join(outdir, "index.html");
let indexHtml = await readFile(indexPath, "utf8");
const runtimeConfig = JSON.stringify({
  BUN_PUBLIC_VITE_SUPABASE_URL: supabaseUrl,
  BUN_PUBLIC_VITE_SUPABASE_PUBLISHABLE_KEY: supabaseKey,
  BUN_PUBLIC_BACKEND_URL: publicEnv("BUN_PUBLIC_BACKEND_URL", "http://localhost:3000"),
});
indexHtml = indexHtml.replace(
  "<head>",
  `<head><script>globalThis.__WITTY_ENV__=${runtimeConfig};</script>`,
);
await writeFile(indexPath, indexHtml.replace("<title>Bun + React</title>", "<title>Witty</title>"));
