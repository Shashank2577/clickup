/**
 * API Client — centralized fetch wrapper with auth, error handling, and type safety.
 *
 * Usage:
 *   import { api } from '@/lib/api-client'
 *   const tasks = await api.get<Task[]>('/tasks', { params: { listId: '123' } })
 *   const task = await api.post<Task>('/tasks', { body: { title: 'New task', listId: '123' } })
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

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

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('clickup_token')
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

async function request<T>(method: string, path: string, options: MutationOptions = {}): Promise<T> {
  const { params, headers = {}, body, signal } = options

  const res = await fetch(buildUrl(path, params), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
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

  /** Upload file (multipart/form-data) */
  upload: async <T>(path: string, file: File, fieldName = 'file'): Promise<T> => {
    const form = new FormData()
    form.append(fieldName, file)

    const res = await fetch(buildUrl(path), {
      method: 'POST',
      headers: getAuthHeaders(),
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

  /** Set auth token (call after login) */
  setToken: (token: string) => {
    localStorage.setItem('clickup_token', token)
  },

  /** Clear auth token (call on logout) */
  clearToken: () => {
    localStorage.removeItem('clickup_token')
  },
}
