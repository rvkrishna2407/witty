import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const envFile = readFileSync(resolve(".env"), "utf8");
  const databaseLine = envFile
    .split(/\r?\n/)
    .find((line) => line.trimStart().startsWith("DATABASE_URL="));

  if (!databaseLine) {
    throw new Error("DATABASE_URL is missing from .env");
  }

  return databaseLine.slice(databaseLine.indexOf("=") + 1).trim().replace(/^"(.*)"$/, "$1");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: getDatabaseUrl(),
  },
});
