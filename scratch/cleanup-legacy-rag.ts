import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma/client';

dotenv.config({ path: '.env.local' });

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('[DB] Removendo artigos legados VIVO.SEGURA...');
  const deleted = await prisma.$executeRawUnsafe(`DELETE FROM knowledge_articles WHERE title LIKE 'VIVO.SEGURA%'`);
  console.log(`[DB] ${deleted} registro(s) legados removidos com sucesso!`);

  const count: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as total FROM knowledge_articles`);
  console.log(`[DB] Total de artigos ativos em knowledge_articles: ${count[0].total}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
