import { prisma } from '@/lib/prisma'; // Assumes alias @/lib, will check if it works or use relative path
import { apiError, apiSuccess, ApplicationError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Perform a minimal, safe query to check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    return apiSuccess({ status: 'ok', database: 'connected' });
  } catch {
    return apiError(
      new ApplicationError(
        'INTERNAL_SERVER_ERROR',
        'Unable to connect to the database.',
        503
      )
    );
  }
}
