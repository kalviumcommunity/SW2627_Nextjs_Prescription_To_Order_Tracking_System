export interface ApiErrorEnvelope {
  error?: string | {
    code?: string;
    message?: string;
  };
}

export function getApiErrorMessage(
  body: unknown,
  fallback = 'We could not complete that request. Please try again.'
): string {
  if (!body || typeof body !== 'object') return fallback;

  const error = (body as ApiErrorEnvelope).error;
  if (typeof error === 'string') return error;

  if (error?.code === 'UNAUTHENTICATED') {
    return 'Your session has expired. Please sign in again.';
  }

  if (error?.code === 'FORBIDDEN') {
    return 'You do not have permission to perform this action.';
  }

  return error?.message || fallback;
}
