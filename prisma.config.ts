// Configuração do Prisma CLI (Prisma 7 — "Prisma Development Kit").
// Carrega o .env.local (mesmo arquivo do Next.js) antes do .env, para que o
// CLI (generate/migrate) use a DATABASE_URL correta com senha URL-encoded.
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });
config({ path: ".env", override: false });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrações rodam na conexão DIRETA (5432). A Transaction Pooler (6543)
    // trava o `migrate deploy` (pgbouncer transaction mode não suporta
    // as operações de sessão do Prisma). O runtime da app continua usando a
    // DATABASE_URL (pooler) via lib/security-qa/prisma.ts.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
