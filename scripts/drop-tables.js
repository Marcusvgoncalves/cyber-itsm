require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('DROP TABLE IF EXISTS "qa_results" CASCADE');
  await client.query('DROP TABLE IF EXISTS "qa_projects" CASCADE');
  const t = await client.query(
    "select table_name from information_schema.tables where table_schema='public' and table_name in ('qa_results','qa_projects')"
  );
  console.log("remaining:", JSON.stringify(t.rows));
  await client.end();
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });