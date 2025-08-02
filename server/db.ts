import {Pool} from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import ws from 'ws'
import * as schema from '../shared/schema'

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set, ensure the database is provisioned')
    }

    export const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    export const db = drizzle({client: pool, schema});



