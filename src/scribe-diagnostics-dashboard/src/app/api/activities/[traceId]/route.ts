import { NextResponse } from "next/server"

import { DiagnosticsApiError, fetchTraceDetails } from "@/lib/diagnostics-api"

export const dynamic = "force-dynamic"

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
