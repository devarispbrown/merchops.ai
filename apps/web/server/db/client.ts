/**
 * Prisma Client Singleton
 *
 * Ensures a single Prisma Client instance across the application
 * Prevents connection pool exhaustion in development hot-reload
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Graceful shutdown handler
 * Ensures Prisma disconnects cleanly on process termination
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
}

process.on('beforeExit', async () => {
  await disconnectPrisma();
});
