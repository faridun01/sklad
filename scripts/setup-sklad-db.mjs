import dotenv from 'dotenv';
import pg from 'pg';
import { execSync } from 'node:child_process';

dotenv.config();

const { Client } = pg;

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  const dbUrl = new URL(process.env.DATABASE_URL);
  const dbName = dbUrl.pathname.slice(1);

  if (!dbName) {
    throw new Error('Database name is missing in DATABASE_URL');
  }

  dbUrl.pathname = '/postgres';

  const client = new Client({
    connectionString: dbUrl.toString(),
  });

  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${dbName}"`);
  await client.end();

  execSync('npx.cmd prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });

  execSync('npm.cmd run -s seed:demo', {
    stdio: 'inherit',
    env: process.env,
  });
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
