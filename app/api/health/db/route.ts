import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Assumes alias @/lib, will check if it works or use relative path

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Perform a minimal, safe query to check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json(
      { status: 'healthy', db: 'connected' },
      { status: 200 }
    );
  } catch (error) {
    // Log the actual error for internal tracking (optional, but good practice)
    console.error('Database health check failed:', error);

    // Return a generic error message to avoid leaking sensitive information
    return NextResponse.json(
      { status: 'unhealthy', db: 'disconnected', message: 'Unable to connect to the database.' },
      { status: 503 }
    );
  }
}
