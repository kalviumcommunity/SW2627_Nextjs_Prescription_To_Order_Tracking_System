import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Perform a minimal, safe query to check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    return apiSuccess(
      { status: 'ok', database: 'connected' },
      200
    );
  } catch (error) {
    // Log the actual error for internal tracking
    console.error('Database health check failed:', error);

    // Return a generic error message to avoid leaking sensitive information
    return NextResponse.json(
      {
        status: 'unhealthy',
        db: 'disconnected',
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Unable to connect to the database.',
        },
      },
      { status: 503 }
    );
  }
}
