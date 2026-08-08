import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL;

async function main() {
  if (!connectionString) {
    console.error("DATABASE_URL não configurado.");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString });
  console.log("Conectando ao banco de dados...");
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.llm_call_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          route TEXT NOT NULL,
          status TEXT NOT NULL,
          latency_ms INTEGER NOT NULL,
          tokens_used INTEGER,
          cost_est DECIMAL(10,6),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS llm_call_logs_provider_idx ON public.llm_call_logs(provider);
      CREATE INDEX IF NOT EXISTS llm_call_logs_created_at_idx ON public.llm_call_logs(created_at DESC);
    `);
    console.log("Tabela public.llm_call_logs criada com sucesso no Supabase!");
  } catch (err) {
    console.error("Erro ao criar tabela:", err);
  } finally {
    await pool.end();
  }
}

main();
