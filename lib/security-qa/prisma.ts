/**
 * Centro de Security QA — PrismaClient Singleton (server-only).
 *
 * Prisma 7 usa a API de driver adapters + o novo provider "prisma-client".
 * O client gerado vive em lib/generated/prisma (gitignored). Nunca importar
 * em componentes client (Bounded Context isolado do ITSM).
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaPg(connectionString);
  return new PrismaClient({ adapter });
}

// Hot reload no dev: reutiliza a instância em `globalThis` para não estourar
// o pool de conexões do Supabase durante a recarga a cada edição.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type Prisma = typeof prisma;