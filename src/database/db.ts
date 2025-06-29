import { drizzle } from 'drizzle-orm/libsql';
import 'dotenv/config';
import { createClient } from '@libsql/client';
import * as schema from './schema';

export const client = createClient({ url: process.env.DB_FILE_NAME! });
export const db = drizzle({ client, schema });
