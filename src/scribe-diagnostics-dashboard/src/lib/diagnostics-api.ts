import "server-only"

import type {
  ActivitySearchRequest,
  ActivitySearchResponse,
  ApiErrorResponse,
  TraceDetailsDto,
} from "@/lib/api-types"

const DEFAULT_API_BASE_URL = "http://localhost:5000"

export class DiagnosticsApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, status: number, details: unknown) {
    super(message)
    this.name = "DiagnosticsApiError"
    this.status = status
    this.details = details
  }
}

function getApiBaseUrl(): string {
  const configured = process.env.SCRIBE_API_BASE_URL?.trim()
  const baseUrl = configured && configured.length > 0 ? configured : DEFAULT_API_BASE_URL

  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
}

function buildApiUrl(path: string): string {
  return new URL(path.replace(/^\//, ""), getApiBaseUrl()).toString()
}

async function parseErrorDetails(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    try {
      return (await response.json()) as ApiErrorResponse
    } catch {
      return null
    }
  }

  try {
    return await response.text()
  } catch {
    return null
  }
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers)

  if (!headers.has("accept")) {
    headers.set("accept", "application/json")
  }

  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json")
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers,
    cache: "no-store",
  })

  if (!response.ok) {
    const details = await parseErrorDetails(response)
    const fallbackMessage = `Diagnostics API request failed with status ${response.status}.`
    const apiError =
      typeof details === "object" && details !== null
        ? (details as ApiErrorResponse)
        : null
    const message =
      apiError && typeof apiError.message === "string"
        ? apiError.message
        : fallbackMessage

    throw new DiagnosticsApiError(message, response.status, details)
  }

  return (await response.json()) as T
}

export async function searchActivities(
  request: ActivitySearchRequest,
): Promise<ActivitySearchResponse> {
  return await requestJson<ActivitySearchResponse>("/api/activities/search", {
    method: "POST",
    body: JSON.stringify(request),
  })
}

export async function fetchTraceDetails(traceId: string): Promise<TraceDetailsDto> {
  return await requestJson<TraceDetailsDto>(
    `/api/activities/${encodeURIComponent(traceId)}`,
    {
      method: "GET",
    },
  )
}

export async function getTraceDetails(
  traceId: string,
): Promise<TraceDetailsDto | null> {
  try {
    return await fetchTraceDetails(traceId)
  } catch (error) {
    if (error instanceof DiagnosticsApiError && error.status === 404) {
      return null
    }

    throw error
  }
}
