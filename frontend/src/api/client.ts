// Thin fetch wrapper over the REST contract (add-frontend-mvp design D3).
// Base URL comes from VITE_API_BASE_URL (docs/deployment/docker-compose.md §5),
// matching api.md §2.1.

const BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

// Typed twin of api.md §2.5's error envelope.
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!response.ok) {
    let code = 'INTERNAL_ERROR';
    let message = response.statusText;
    try {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      // Non-JSON error body — keep the HTTP fallback values.
    }
    throw new ApiError(response.status, code, message);
  }

  return response.json() as Promise<T>;
}
