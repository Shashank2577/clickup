import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

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

    const migrationsDir = path.join(__dirname);
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
    }

    console.log('All migrations completed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
