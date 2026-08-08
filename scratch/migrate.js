const { Client } = require('pg');
require('dotenv').config({ path: './.env.local' });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DIRECT_URL or DATABASE_URL not found in environment.");
  process.exit(1);
}

const client = new Client({
  connectionString: connectionString,
});

async function main() {
  await client.connect();
  console.log("Conectado ao PostgreSQL...");
  
  await client.query("ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS attachment_name TEXT;");
  await client.query("ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS attachment_url TEXT;");
  
  console.log("Tabela public.tickets alterada com sucesso!");
}

main()
  .catch(console.error)
  .finally(() => client.end());
