/**
 * API Client — centralized fetch wrapper with auth, error handling, and type safety.
 * Auth is handled via Clerk session cookies (set automatically by Clerk, sent via credentials: 'include').
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
  signal?: AbortSignal
}

interface MutationOptions extends RequestOptions {
  body?: unknown
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(`${API_BASE}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

async function request<T>(method: string, path: string, options: MutationOptions = {}): Promise<T> {
  const { params, headers = {}, body, signal } = options

  const res = await fetch(buildUrl(path, params), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
    credentials: 'include',
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ code: 'UNKNOWN', message: res.statusText }))
    throw new ApiError(res.status, error.code ?? 'UNKNOWN', error.message ?? res.statusText, error.details)
  }

  if (res.status === 204) return undefined as T

  const json = await res.json()
  return json.data !== undefined ? json.data : json
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, options?: MutationOptions) => request<T>('POST', path, options),
  patch: <T>(path: string, options?: MutationOptions) => request<T>('PATCH', path, options),
  put: <T>(path: string, options?: MutationOptions) => request<T>('PUT', path, options),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),

  upload: async <T>(path: string, file: File, fieldName = 'file'): Promise<T> => {
    const form = new FormData()
    form.append(fieldName, file)

    const res = await fetch(buildUrl(path), {
      method: 'POST',
      body: form,
      credentials: 'include',
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ code: 'UNKNOWN', message: res.statusText }))
      throw new ApiError(res.status, error.code, error.message, error.details)
    }

    const json = await res.json()
    return json.data !== undefined ? json.data : json
  },
}
