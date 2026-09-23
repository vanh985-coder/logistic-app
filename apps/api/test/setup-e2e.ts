import * as dotenv from 'dotenv';
import * as path from 'path';

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const testDbUrl =
  process.env.DATABASE_URL_TEST ||
  'postgresql://logix:logix_secret_dev@localhost:5432/logix3d_test?schema=public';

if (!testDbUrl.includes('logix3d_test')) {
  throw new Error(
    `[Security Check Failed] E2E tests must point to a dedicated test database containing 'logix3d_test'. Found: ${testDbUrl}`,
  );
}

// Ensure both DATABASE_URL and DATABASE_URL_TEST point strictly to the test database
process.env.DATABASE_URL_TEST = testDbUrl;
process.env.DATABASE_URL = testDbUrl;
process.env.NODE_ENV = 'test';

console.log(`[E2E Test Setup] Verified test environment pointing to: ${testDbUrl}`);
