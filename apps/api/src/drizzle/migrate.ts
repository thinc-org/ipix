import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from '@repo/rdb/schema';

const db = drizzle({
  schema,
  casing: 'snake_case',
  connection: {
    connectionString: process.env.DATABASE_URL!,
  },
});

async function main() {
  console.log('Running migrations...');
  
  await migrate(db, { 
    migrationsFolder: './packages/rdb/drizzle' 
  });
  
  console.log('Migrations completed!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});