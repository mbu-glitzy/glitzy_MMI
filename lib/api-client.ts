/**
 * 외부 API 호출용 클라이언트
 * - 타임아웃 설정
 * - 재시도 로직 (exponential backoff)
 * - 구조화된 로깅
 */

export interface FetchOptions extends RequestInit {
  timeout?: number        // 타임아웃 (ms), 기본 30초
  retries?: number        // 재시도 횟수, 기본 3회
  retryDelay?: number     // 초기 재시도 대기 (ms), 기본 1초
  service?: string        // 서비스 이름 (로깅용)
}

export interface FetchResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  statusCode?: number
  attempts: number
}

// 재시도 가능한 HTTP 상태 코드
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504]

// 재시도 가능한 에러인지 확인
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // 타임아웃, 네트워크 오류
    return error.name === 'AbortError' ||
           error.message.includes('fetch failed') ||
           error.message.includes('network')
  }
  return false
}

// 대기 함수
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 재시도 로직이 포함된 fetch 함수
 */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
    service = 'API',
    ...fetchOptions
  } = options

  let lastError: Error | null = null
  let attempt = 0

  while (attempt <= retries) {
    attempt++
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // 성공 또는 재시도 불가능한 오류
      if (response.ok || !RETRYABLE_STATUS_CODES.includes(response.status)) {
        if (!response.ok) {
          console.warn(`[${service}] Request failed with status ${response.status}`)
        }
        return response
      }

      // 재시도 가능한 오류
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
      console.warn(`[${service}] Attempt ${attempt}/${retries + 1} failed: ${response.status}`)

    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error instanceof Error ? error : new Error(String(error))

      if (!isRetryableError(error)) {
        throw lastError
      }

      console.warn(`[${service}] Attempt ${attempt}/${retries + 1} failed: ${lastError.message}`)
    }

    // 마지막 시도가 아니면 대기 후 재시도
    if (attempt <= retries) {
      const waitTime = retryDelay * Math.pow(2, attempt - 1) // exponential backoff
      console.log(`[${service}] Retrying in ${waitTime}ms...`)
      await delay(waitTime)
    }
  }

  throw lastError || new Error(`[${service}] Request failed after ${retries + 1} attempts`)
}

/**
 * JSON 응답을 파싱하는 fetch 함수
 */
export async function fetchJSON<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult<T>> {
  const service = options.service || 'API'
  let attempts = 0

  try {
    const startTime = Date.now()
    const response = await fetchWithRetry(url, options)
    attempts = 1 // fetchWithRetry 내부에서 재시도 횟수 추적

    const duration = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`[${service}] Request failed: ${response.status} - ${errorText} (${duration}ms)`)
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        statusCode: response.status,
        attempts,
      }
    }

    const data = await response.json() as T
    console.log(`[${service}] Request successful (${duration}ms)`)

    return {
      success: true,
      data,
      statusCode: response.status,
      attempts,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[${service}] Request error: ${message}`)
    return {
      success: false,
      error: message,
      attempts,
    }
  }
}

/**
 * 구조화된 로깅 헬퍼
 */
export function logServiceCall(
  service: string,
  action: string,
  details: Record<string, unknown> = {}
): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    service,
    action,
    ...details,
  }))
}
