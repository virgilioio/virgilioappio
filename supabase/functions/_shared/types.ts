// Global type declarations for Supabase Edge Functions

declare global {
  var EdgeRuntime: {
    waitUntil(promise: Promise<any>): void;
  } | undefined;
}

// Utility function for safe error message extraction
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

export {};