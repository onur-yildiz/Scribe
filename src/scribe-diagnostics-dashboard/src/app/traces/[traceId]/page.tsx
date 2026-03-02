import Link from "next/link"

import { buildBackToSearchHref, type SearchParamRecord } from "@/lib/activity-search"
import { DiagnosticsApiError, getTraceDetails } from "@/lib/diagnostics-api"
import { TraceDetailsView } from "@/components/trace-details-view"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type TracePageProps = {
  params: Promise<{
    traceId: string
  }>
  searchParams?: Promise<SearchParamRecord>
}

export default async function TracePage({
  params,
  searchParams,
}: TracePageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const backHref = buildBackToSearchHref(resolvedSearchParams ?? {})
  let trace = null as Awaited<ReturnType<typeof getTraceDetails>>
  let stateTitle: string | null = null
  let stateDescription: string | null = null

  try {
    trace = await getTraceDetails(resolvedParams.traceId)

    if (!trace) {
      stateTitle = "Trace not found"
      stateDescription = `No activity trace with ID ${resolvedParams.traceId} was returned by the diagnostics API.`
    }
  } catch (error) {
    if (error instanceof DiagnosticsApiError && error.status === 404) {
      stateTitle = "Trace not found"
      stateDescription = `No activity trace with ID ${resolvedParams.traceId} was returned by the diagnostics API.`
    }
    else
    {
      stateTitle = "Unable to load trace"
      stateDescription =
        error instanceof DiagnosticsApiError
          ? `${error.message} Verify that SCRIBE_API_BASE_URL points to the running API.`
          : "The dashboard could not load this trace from the diagnostics API."
    }
  }

  if (!trace || stateTitle || stateDescription) {
    return (
      <TraceStateShell
        title={stateTitle ?? "Unable to load trace"}
        description={
          stateDescription ??
          "The dashboard could not load this trace from the diagnostics API."
        }
        backHref={backHref}
      />
    )
  }

  return (
    <main className="h-screen overflow-hidden bg-[#020617] text-slate-100">
      <TraceDetailsView trace={trace} backHref={backHref} />
    </main>
  )
}

function TraceStateShell({
  title,
  description,
  backHref,
}: {
  title: string
  description: string
  backHref: string
}) {
  return (
    <main className="min-h-screen bg-[#020617] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-4 py-8 sm:px-6">
        <Button
          asChild
          variant="outline"
          className="w-fit border-white/10 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
        >
          <Link href={backHref}>Back</Link>
        </Button>

        <Card className="border-white/10 bg-slate-950/70 py-0">
          <CardHeader className="border-b border-white/8 py-5">
            <CardTitle className="text-xl text-slate-100">{title}</CardTitle>
          </CardHeader>
          <CardContent className="py-5 text-sm text-slate-300">
            {description}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
