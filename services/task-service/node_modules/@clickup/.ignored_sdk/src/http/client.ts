import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { ErrorCode } from '@clickup/contracts'
import { AppError } from '../errors/AppError.js'
import { logger } from '../logging/logger.js'

// ============================================================
// Internal HTTP client for service-to-service calls
// Includes: retry, timeout, correlation ID forwarding, error normalization
// ============================================================

const DEFAULT_TIMEOUT_MS = 10_000
const MAX_RETRIES = 3
const RETRYABLE_STATUS_CODES = [429, 502, 503, 504]

export function createServiceClient(
  baseURL: string,
  options: { timeoutMs?: number; traceId?: string } = {},
): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      ...(options.traceId !== undefined && { 'x-trace-id': options.traceId }),
      'x-internal': 'true',
    },
  })

  // Retry interceptor
  client.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (!axios.isAxiosError(error)) throw error

      const config = error.config as AxiosRequestConfig & { _retryCount?: number }
      const status = error.response?.status ?? 0

      config._retryCount = config._retryCount ?? 0

      if (
        config._retryCount < MAX_RETRIES &&
        RETRYABLE_STATUS_CODES.includes(status)
      ) {
        config._retryCount++
        const delay = Math.min(config._retryCount * 500, 2000)
        await sleep(delay)
        logger.warn({ status, attempt: config._retryCount, baseURL }, 'Retrying request')
        return client.request(config)
      }

      // Normalize to AppError
      const errorData = error.response?.data as { error?: { code?: string; message?: string } } | undefined
      const code = (errorData?.error?.code as ErrorCode | undefined) ?? ErrorCode.SYSTEM_SERVICE_UNAVAILABLE
      const message = errorData?.error?.message ?? 'Service call failed'

      throw new AppError(code, message)
    },
  )

  return client
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
