import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import pg from "pg";

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Erro: DIRECT_URL ou DATABASE_URL não configurado no ambiente.");
    process.exit(1);
  }

  console.log("Conectando ao banco de dados para criar a tabela 'knowledge_articles'...");
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    
    // 1. Ativar extensão pgvector
    console.log("Garantindo extensão pgvector...");
    await client.query("CREATE EXTENSION IF NOT EXISTS vector;");
    
    // 2. Criar a tabela (sem index HNSW devido ao limite de 2000 dimensões para HNSW/IVFFlat no pgvector do Supabase)
    console.log("Criando tabela knowledge_articles...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.knowledge_articles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        source TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding vector(3072),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);
    
    console.log("Tabela 'knowledge_articles' criada com sucesso!");
  } catch (error) {
    console.error("Erro ao configurar tabela de RAG:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
