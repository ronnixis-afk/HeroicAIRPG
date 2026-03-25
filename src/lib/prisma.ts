// lib/prisma.ts
// Shared Prisma singleton — prevents connection pool exhaustion in serverless environments.
// All API routes must import from here instead of creating their own PrismaClient.

import { PrismaClient } from '../generated/prisma';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as {
    __prisma?: PrismaClient;
    __pgPool?: Pool;
};

if (!globalForPrisma.__pgPool) {
    globalForPrisma.__pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
}

if (!globalForPrisma.__prisma) {
    const adapter = new PrismaPg(globalForPrisma.__pgPool);
    globalForPrisma.__prisma = new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.__prisma;
