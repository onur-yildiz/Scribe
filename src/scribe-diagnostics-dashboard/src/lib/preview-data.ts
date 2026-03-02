import type { ActivitySearchRequest, ActivitySearchResponse, TraceDetailsDto } from "@/lib/api-types"
import seedData from "@/lib/preview-seed.json"

const { searchResponse, traceDetails } = seedData as unknown as {
  searchResponse: ActivitySearchResponse
  traceDetails: Record<string, TraceDetailsDto>
}

export function searchActivitiesFromSeed(
  request: ActivitySearchRequest,
): ActivitySearchResponse {
  let items = searchResponse.items.slice()

  if (request.operationName) {
    const op = request.operationName.toLowerCase()
    items = items.filter((i) => i.rootOperation.toLowerCase().includes(op))
  }

  if (request.serviceName) {
    const svc = request.serviceName.toLowerCase()
    items = items.filter((i) => i.rootService.toLowerCase().includes(svc))
  }

  if (request.status) {
    items = items.filter((i) => i.status === request.status)
  }

  if (request.startFromUtc) {
    const from = new Date(request.startFromUtc).getTime()
    items = items.filter((i) => new Date(i.startTimeUtc).getTime() >= from)
  }

  if (request.startToUtc) {
    const to = new Date(request.startToUtc).getTime()
    items = items.filter((i) => new Date(i.startTimeUtc).getTime() <= to)
  }

  const page = request.page ?? 1
  const pageSize = request.pageSize ?? 25
  const totalCount = items.length
  const start = (page - 1) * pageSize
  const paged = items.slice(start, start + pageSize)

  return { page, pageSize, totalCount, items: paged }
}

export function getTraceDetailsFromSeed(traceId: string): TraceDetailsDto | null {
  return traceDetails[traceId] ?? null
}

export const seedTraceIds = Object.keys(traceDetails)
