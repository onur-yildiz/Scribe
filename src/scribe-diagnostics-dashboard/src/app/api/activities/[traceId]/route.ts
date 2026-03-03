import { NextResponse } from "next/server"

import { DiagnosticsApiError, fetchTraceDetails } from "@/lib/diagnostics-api"
import { seedTraceIds } from "@/lib/preview-data"

export function generateStaticParams() {
  if (process.env.NEXT_PUBLIC_PREVIEW_MODE !== "true") return []
  return seedTraceIds.map((traceId) => ({ traceId }))
}

type RouteProps = {
  params: Promise<{
    traceId: string
  }>
}

export async function GET(_: Request, { params }: RouteProps) {
  const { traceId } = await params

  try {
    const result = await fetchTraceDetails(traceId)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof DiagnosticsApiError) {
      return NextResponse.json(
        {
          message: error.message,
          details: error.details,
        },
        { status: error.status },
      )
    }

    return NextResponse.json(
      { message: "Unexpected dashboard proxy failure." },
      { status: 500 },
    )
  }
}
