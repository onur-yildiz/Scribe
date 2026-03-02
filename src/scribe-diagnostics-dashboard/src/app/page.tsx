import Link from "next/link"
import type { ReactNode } from "react"

import type { ActivitySearchResponse } from "@/lib/api-types"
import {
  buildActivitySearchHref,
  buildActivitySearchRequest,
  buildTraceDetailsHref,
  createPresetSearchHref,
  normalizeActivitySearchState,
  type SearchParamRecord,
} from "@/lib/activity-search"
import { DiagnosticsApiError, searchActivities } from "@/lib/diagnostics-api"
import {
  formatDuration,
  formatUtcTimestamp,
  parseUtcDateTimeInput,
} from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type HomePageProps = {
  searchParams?: Promise<SearchParamRecord>
}

function getStatusClasses(status: string): string {
  const normalized = status.trim().toLowerCase()

  if (
    normalized.includes("error") ||
    normalized.includes("fail") ||
    normalized.includes("exception")
  ) {
    return "border-red-500/30 bg-red-500/10 text-red-200"
  }

  if (normalized.includes("warn") || normalized.includes("degrad")) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100"
  }

  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
}

function renderPagerButton(
  href: string | null,
  label: string,
  variant: "outline" | "default",
) {
  if (!href) {
    return (
      <Button
        type="button"
        variant={variant}
        disabled
        className="border-white/10 bg-slate-950/60 text-slate-400"
      >
        {label}
      </Button>
    )
  }

  return (
    <Button
      asChild
      variant={variant}
      className="border-white/10 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
    >
      <Link href={href}>{label}</Link>
    </Button>
  )
}

export default async function Home({ searchParams }: HomePageProps) {
  const rawSearchParams = searchParams ? await searchParams : {}
  const state = normalizeActivitySearchState(rawSearchParams ?? {})

  let response: ActivitySearchResponse | null = null
  let errorMessage: string | null = null

  try {
    response = await searchActivities(buildActivitySearchRequest(state))
  } catch (error) {
    if (error instanceof DiagnosticsApiError) {
      errorMessage = `${error.message} Set SCRIBE_API_BASE_URL if your API is not running on http://localhost:5000.`
    } else {
      errorMessage = "The dashboard could not reach the diagnostics API."
    }
  }

  const fromDate = parseUtcDateTimeInput(state.from)
  const toDate = parseUtcDateTimeInput(state.to)
  const totalPages = response
    ? Math.max(1, Math.ceil(response.totalCount / response.pageSize))
    : 1
  const previousPageHref =
    response && state.page > 1
      ? buildActivitySearchHref(state, { page: state.page - 1 })
      : null
  const nextPageHref =
    response && state.page < totalPages
      ? buildActivitySearchHref(state, { page: state.page + 1 })
      : null

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#0f344320,transparent_30%),linear-gradient(180deg,#020617_0%,#020617_35%,#111827_100%)] text-slate-100">
      <div className="flex w-full flex-col gap-8 px-3 py-6 sm:px-4 lg:px-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Scribe Diagnostics
            </p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Activity Explorer
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">
                Inspect root activities by time range, review trace summaries, and open full trace details with dump, event, and exception data.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryTile
              label="Window"
              value={
                fromDate && toDate
                  ? `${formatUtcTimestamp(fromDate)} -> ${formatUtcTimestamp(toDate)}`
                  : "Invalid range"
              }
            />
            <SummaryTile
              label="Mode"
              value="Root activities in selected range"
            />
          </div>
        </header>

        <Card className="border-white/10 bg-slate-950/70 py-0">
          <CardHeader className="border-b border-white/8 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-lg text-slate-100">
                  Search Filters
                </CardTitle>
                <p className="mt-2 text-sm text-slate-400">
                  The list below shows traces by root activity start time. All times are entered and filtered in UTC.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="border-white/10 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
                >
                  <Link href={createPresetSearchHref(state, 0.25)}>
                    Last 15m
                  </Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="border-white/10 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
                >
                  <Link href={createPresetSearchHref(state, 1)}>Last 1h</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="border-white/10 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
                >
                  <Link href={createPresetSearchHref(state, 24)}>
                    Last 24h
                  </Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="border-white/10 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
                >
                  <Link href={createPresetSearchHref(state, 24 * 7)}>
                    Last 7d
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="py-6">
            <form method="get" action="/" className="space-y-5">
              <input type="hidden" name="pageSize" value={state.pageSize} />
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
                <Field label="From (UTC)" htmlFor="from">
                  <Input
                    id="from"
                    name="from"
                    type="datetime-local"
                    defaultValue={state.from}
                    className="border-white/10 bg-slate-950/70 text-slate-100"
                  />
                </Field>
                <Field label="To (UTC)" htmlFor="to">
                  <Input
                    id="to"
                    name="to"
                    type="datetime-local"
                    defaultValue={state.to}
                    className="border-white/10 bg-slate-950/70 text-slate-100"
                  />
                </Field>
                <Field label="Root Activity" htmlFor="root">
                  <Input
                    id="root"
                    name="root"
                    type="text"
                    defaultValue={state.rootOperation}
                    placeholder="checkout.submit"
                    className="border-white/10 bg-slate-950/70 text-slate-100"
                  />
                </Field>
                <Field label="Root Service" htmlFor="service">
                  <Input
                    id="service"
                    name="service"
                    type="text"
                    defaultValue={state.service}
                    placeholder="orders-api"
                    className="border-white/10 bg-slate-950/70 text-slate-100"
                  />
                </Field>
                <Field label="Status" htmlFor="status">
                  <select
                    id="status"
                    name="status"
                    defaultValue={state.status}
                    className="h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none ring-0"
                  >
                    <option value="">All statuses</option>
                    <option value="Ok">Ok</option>
                    <option value="Warn">Warn</option>
                    <option value="Error">Error</option>
                  </select>
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit">Apply Filters</Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-white/10 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
                >
                  <Link href="/">Reset</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Trace Results</h2>
              <p className="mt-1 text-sm text-slate-400">
                {response
                  ? `${response.totalCount} matching trace${response.totalCount === 1 ? "" : "s"}`
                  : "Results unavailable"}
              </p>
            </div>

            {response ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-slate-400">
                  Page {response.page} of {totalPages}
                </p>
                {renderPagerButton(previousPageHref, "Previous", "outline")}
                {renderPagerButton(nextPageHref, "Next", "default")}
              </div>
            ) : null}
          </div>

          {errorMessage ? (
            <Card className="border-red-500/30 bg-red-500/10 py-0">
              <CardHeader className="border-b border-red-500/20 py-5">
                <CardTitle className="text-lg text-red-100">
                  Unable to load activities
                </CardTitle>
              </CardHeader>
              <CardContent className="py-5 text-sm text-red-100/90">
                {errorMessage}
              </CardContent>
            </Card>
          ) : null}

          {!errorMessage && response && response.items.length === 0 ? (
            <Card className="border-white/10 bg-slate-950/70 py-0">
              <CardContent className="py-10 text-center">
                <p className="text-lg font-semibold text-slate-100">
                  No root activities matched this range
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Adjust the time window or clear one of the filters to broaden the search.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {!errorMessage && response ? (
            <div className="grid gap-5 xl:grid-cols-2">
              {response.items.map((item) => (
                <Card
                  key={item.traceId}
                  className="border-white/10 bg-slate-950/70 py-0"
                >
                  <CardHeader className="border-b border-white/8 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                          {item.rootService}
                        </p>
                        <CardTitle className="text-lg text-slate-100">
                          {item.rootOperation}
                        </CardTitle>
                        <p className="font-mono text-xs text-slate-400">
                          Trace ID: {item.traceId}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={getStatusClasses(item.status)}
                      >
                        {item.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5 py-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SummaryTile
                        label="Started"
                        value={formatUtcTimestamp(item.startTimeUtc)}
                      />
                      <SummaryTile
                        label="Completed"
                        value={formatUtcTimestamp(item.endTimeUtc)}
                      />
                      <SummaryTile
                        label="Total Duration"
                        value={formatDuration(item.totalDurationMs)}
                      />
                      <SummaryTile
                        label="Span Count"
                        value={String(item.spanCount)}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-slate-400">
                        Root span: {item.rootSpanId}
                      </p>
                      <Button asChild>
                        <Link href={buildTraceDetailsHref(item.traceId, state)}>
                          Open trace
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}

function Field({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode
  htmlFor: string
  label: string
}) {
  return (
    <label htmlFor={htmlFor} className="space-y-2">
      <span className="block font-mono text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  )
}

function SummaryTile({
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
