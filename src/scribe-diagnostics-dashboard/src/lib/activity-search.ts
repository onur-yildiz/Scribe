import type { ActivitySearchRequest } from "@/lib/api-types"
import { parseUtcDateTimeInput, toUtcDateTimeInputValue } from "@/lib/format"

export type SearchParamValue = string | string[] | undefined

export type SearchParamRecord = Record<string, SearchParamValue>

export type ActivitySearchState = {
  from: string
  to: string
  rootOperation: string
  service: string
  status: string
  page: number
  pageSize: number
  rootOnly: boolean
}

const DEFAULT_PAGE_SIZE = 25
const DEFAULT_RANGE_HOURS = 24

function firstValue(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

function normalizePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function normalizePageSize(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? String(DEFAULT_PAGE_SIZE), 10)

  if (!Number.isFinite(parsed)) {
    return DEFAULT_PAGE_SIZE
  }

  return Math.min(Math.max(parsed, 1), 100)
}

// In preview mode the seed data covers 2026-02-21 – 2026-02-23, so widen
// the default window to show everything without requiring manual filter input.
const PREVIEW_DEFAULT_FROM = new Date("2026-02-21T00:00:00.000Z")
const PREVIEW_DEFAULT_TO = new Date("2026-02-24T00:00:00.000Z")
const IS_PREVIEW_MODE = process.env.NEXT_PUBLIC_PREVIEW_MODE === "true"

export function normalizeActivitySearchState(
  raw: SearchParamRecord,
  now: Date = new Date(),
): ActivitySearchState {
  const fallbackTo = IS_PREVIEW_MODE ? PREVIEW_DEFAULT_TO : new Date(now)
  const fallbackFrom = IS_PREVIEW_MODE
    ? PREVIEW_DEFAULT_FROM
    : new Date(now.getTime() - DEFAULT_RANGE_HOURS * 60 * 60 * 1000)

  let from = parseUtcDateTimeInput(firstValue(raw.from)) ?? fallbackFrom
  let to = parseUtcDateTimeInput(firstValue(raw.to)) ?? fallbackTo

  if (from.getTime() > to.getTime()) {
    const swap = from
    from = to
    to = swap
  }

  return {
    from: toUtcDateTimeInputValue(from),
    to: toUtcDateTimeInputValue(to),
    rootOperation: firstValue(raw.root) ?? "",
    service: firstValue(raw.service) ?? "",
    status: firstValue(raw.status) ?? "",
    page: normalizePage(firstValue(raw.page)),
    pageSize: normalizePageSize(firstValue(raw.pageSize)),
    rootOnly: firstValue(raw.rootOnly) !== "false",
  }
}

export function buildActivitySearchRequest(
  state: ActivitySearchState,
): ActivitySearchRequest {
  const from = parseUtcDateTimeInput(state.from)
  const to = parseUtcDateTimeInput(state.to)

  return {
    operationName: state.rootOperation || undefined,
    serviceName: state.service || undefined,
    status: state.status || undefined,
    startFromUtc: from?.toISOString(),
    startToUtc: to?.toISOString(),
    rootOnly: state.rootOnly,
    page: state.page,
    pageSize: state.pageSize,
  }
}

export function buildActivitySearchHref(
  state: ActivitySearchState,
  overrides: Partial<ActivitySearchState> = {},
): string {
  const nextState = { ...state, ...overrides }
  const params = new URLSearchParams()

  params.set("from", nextState.from)
  params.set("to", nextState.to)

  if (nextState.rootOperation) {
    params.set("root", nextState.rootOperation)
  }

  if (nextState.service) {
    params.set("service", nextState.service)
  }

  if (nextState.status) {
    params.set("status", nextState.status)
  }

  if (nextState.page > 1) {
    params.set("page", String(nextState.page))
  }

  if (nextState.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(nextState.pageSize))
  }

  if (!nextState.rootOnly) {
    params.set("rootOnly", "false")
  }

  const query = params.toString()
  return query ? `/?${query}` : "/"
}

export function createPresetSearchHref(
  state: ActivitySearchState,
  hours: number,
  now: Date = new Date(),
): string {
  const to = new Date(now)
  const from = new Date(now.getTime() - hours * 60 * 60 * 1000)

  return buildActivitySearchHref(state, {
    from: toUtcDateTimeInputValue(from),
    to: toUtcDateTimeInputValue(to),
    page: 1,
  })
}

export function buildTraceDetailsHref(
  traceId: string,
  state: ActivitySearchState,
): string {
  const searchHref = buildActivitySearchHref(state)
  const queryIndex = searchHref.indexOf("?")
  const query = queryIndex >= 0 ? searchHref.slice(queryIndex) : ""

  return `/traces/${encodeURIComponent(traceId)}${query}`
}

export function buildBackToSearchHref(raw: SearchParamRecord): string {
  const params = new URLSearchParams()

  const keys = ["from", "to", "root", "service", "status", "page", "pageSize", "rootOnly"] as const

  for (const key of keys) {
    const value = firstValue(raw[key])
    if (value) {
      params.set(key, value)
    }
  }

  const query = params.toString()
  return query ? `/?${query}` : "/"
}
