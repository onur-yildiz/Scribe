export type DumpPrimitive = string | number | boolean | null

export type DumpValue = DumpPrimitive | DumpValue[] | { [key: string]: DumpValue }

export type ActivitySearchRequest = {
  traceId?: string
  status?: string
  serviceName?: string
  operationName?: string
  startFromUtc?: string
  startToUtc?: string
  rootOnly?: boolean
  page?: number
  pageSize?: number
}

export type ActivitySearchResponse = {
  page: number
  pageSize: number
  totalCount: number
  items: TraceSummaryDto[]
}

export type TraceSummaryDto = {
  traceId: string
  rootSpanId: string
  rootService: string
  totalDurationMs: number
  rootOperation: string
  status: string
  startTimeUtc: string
  endTimeUtc: string
  spanCount: number
}

export type TraceDetailsDto = {
  summary: TraceSummaryDto
  spans: ActivitySpanDto[]
}

export type ActivitySpanDto = {
  spanId: string
  parentSpanId?: string | null
  serviceName: string
  operation: string
  startTimeUtc: string
  durationMs: number
  status: string
  tags: Record<string, string>
  dump: Record<string, DumpValue>
  events: ActivityEventDto[]
  exceptions: ActivityExceptionDto[]
}

export type ActivityEventDto = {
  name: string
  timestamp: string
  tags: Record<string, string>
}

export type ActivityExceptionDto = {
  type: string
  message: string
  stackTrace?: string | null
  data: Record<string, string>
}

export type ApiErrorResponse = {
  message?: string
  details?: unknown
}
