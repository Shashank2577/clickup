import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'clickup',
  user: process.env.POSTGRES_USER || 'clickup',
  password: process.env.POSTGRES_PASSWORD || 'clickup_dev',
};

async function runMigrations() {
  const client = new Client(config);
  try {
    await client.connect();
    console.log('Connected to database for migrations');

    const migrationsDir = __dirname;
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      console.log(`Processing migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      // Execute each statement individually to handle "already exists" errors
      const statements = sql.split(';').filter(s => s.trim().length > 0);
      
      for (let statement of statements) {
        try {
          await client.query(statement + ';');
        } catch (err: any) {
          if (err.message.includes('already exists') || err.message.includes('already a column')) {
            // console.log(`  ℹ Skipping existing: ${statement.trim().slice(0, 50)}...`);
          } else {
            console.warn(`  ⚠ Error in statement: ${statement.trim().slice(0, 100)}`);
            console.warn(`    Message: ${err.message}`);
          }
        }
      }
    }

    console.log('All migrations processed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
