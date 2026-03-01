import Link from "next/link"

import { buildBackToSearchHref, type SearchParamRecord } from "@/lib/activity-search"
import { DiagnosticsApiError, getTraceDetails } from "@/lib/diagnostics-api"
import { formatDuration, formatUtcTimestamp } from "@/lib/format"
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#0f344320,transparent_30%),linear-gradient(180deg,#020617_0%,#020617_35%,#111827_100%)] text-slate-100">
      <div className="flex w-full flex-col gap-8 px-3 py-6 sm:px-4 lg:px-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Button
              asChild
              variant="outline"
              className="border-white/10 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
            >
              <Link href={backHref}>Back to results</Link>
            </Button>
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                Trace Details
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {trace.summary.rootOperation}
              </h1>
              <p className="mt-2 font-mono text-xs text-slate-400 sm:text-sm">
                Trace ID: {trace.summary.traceId}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TraceSummaryTile
              label="Trace Window"
              value={`${formatUtcTimestamp(trace.summary.startTimeUtc)} -> ${formatUtcTimestamp(trace.summary.endTimeUtc)}`}
            />
            <TraceSummaryTile
              label="Duration"
              value={formatDuration(trace.summary.totalDurationMs)}
            />
          </div>
        </header>

        <TraceDetailsView trace={trace} />
      </div>
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#0f344320,transparent_30%),linear-gradient(180deg,#020617_0%,#020617_35%,#111827_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-4 py-8 sm:px-6">
        <Button
          asChild
          variant="outline"
          className="w-fit border-white/10 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
        >
          <Link href={backHref}>Back to results</Link>
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

function TraceSummaryTile({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-900/70 px-4 py-3">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-medium text-slate-100">
        {value}
      </p>
    </div>
  )
}
