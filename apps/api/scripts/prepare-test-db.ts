import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function runDbCheck(client: Client, targetDbName: string) {
  const checkRes = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [targetDbName],
  );

  if (checkRes.rowCount === 0) {
    console.log(`[prepare-test-db] Database "${targetDbName}" does not exist. Creating...`);
    const safeDbName = targetDbName.replace(/"/g, '""');
    await client.query(`CREATE DATABASE "${safeDbName}"`);
    console.log(`[prepare-test-db] Database "${targetDbName}" created successfully.`);
  } else {
    console.log(`[prepare-test-db] Database "${targetDbName}" already exists.`);
  }
}

function runMigrations(testUrl: string, targetDbName: string) {
  console.log(`[prepare-test-db] Running prisma migrate deploy on "${targetDbName}"...`);
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: testUrl,
    },
  });
  console.log(`[prepare-test-db] Test database migrations applied successfully.`);
}

async function prepareTestDb() {
  const testUrl =
    process.env.DATABASE_URL_TEST ||
    'postgresql://logix:logix_secret_dev@localhost:5432/logix3d_test?schema=public';

  const url = new URL(testUrl);
  const targetDbName = url.pathname.replace(/^\//, '').split('?')[0];

  let client: Client;
  try {
    client = new Client({
      host: url.hostname || 'localhost',
      port: parseInt(url.port || '5432', 10),
      user: decodeURIComponent(url.username || 'logix'),
      password: decodeURIComponent(url.password || 'logix_secret_dev'),
      database: 'postgres',
    });
    await client.connect();
  } catch {
    client = new Client({
      host: url.hostname || 'localhost',
      port: parseInt(url.port || '5432', 10),
      user: decodeURIComponent(url.username || 'logix'),
      password: decodeURIComponent(url.password || 'logix_secret_dev'),
      database: 'logix3d_db',
    });
    await client.connect();
  }

  try {
    await runDbCheck(client, targetDbName);
  } finally {
    await client.end();
  }

  runMigrations(testUrl, targetDbName);
}

prepareTestDb().catch((err) => {
  console.error('[prepare-test-db] Failed to prepare test database:', err);
  process.exit(1);
});
