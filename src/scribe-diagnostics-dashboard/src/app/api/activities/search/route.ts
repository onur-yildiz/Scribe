import { NextResponse } from "next/server"

import type { ActivitySearchRequest } from "@/lib/api-types"
import { DiagnosticsApiError, searchActivities } from "@/lib/diagnostics-api"

export async function POST(request: Request) {
  let body: ActivitySearchRequest

  try {
    body = (await request.json()) as ActivitySearchRequest
  } catch {
    return NextResponse.json(
      { message: "Invalid search payload." },
      { status: 400 },
    )
  }

  try {
    const result = await searchActivities(body)
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
