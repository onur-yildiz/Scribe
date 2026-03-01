"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  ChevronRight,
  Clock3,
  Copy,
  Layers3,
  X,
} from "lucide-react"

import type { ActivitySpanDto, TraceDetailsDto } from "@/lib/api-types"
import { formatDuration, formatOffset, formatUtcTimestamp } from "@/lib/format"
import { cn } from "@/lib/utils"
import { PayloadRenderer } from "@/components/payload-renderer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function sortSpans(spans: ActivitySpanDto[]): ActivitySpanDto[] {
  return [...spans].sort((left, right) => {
    const leftTime = new Date(left.startTimeUtc).getTime()
    const rightTime = new Date(right.startTimeUtc).getTime()

    if (leftTime !== rightTime) {
      return leftTime - rightTime
    }

    return left.spanId.localeCompare(right.spanId)
  })
}

function buildDepthMap(spans: ActivitySpanDto[]): Record<string, number> {
  const byId = new Map(spans.map((span) => [span.spanId, span]))
  const cache = new Map<string, number>()

  function resolveDepth(span: ActivitySpanDto, seen: Set<string>): number {
    if (!span.parentSpanId) {
      return 0
    }

    if (cache.has(span.spanId)) {
      return cache.get(span.spanId) ?? 0
    }

    if (seen.has(span.spanId)) {
      return 0
    }

    const parent = byId.get(span.parentSpanId)
    if (!parent) {
      return 0
    }

    const nextSeen = new Set(seen)
    nextSeen.add(span.spanId)

    const depth = resolveDepth(parent, nextSeen) + 1
    cache.set(span.spanId, depth)
    return depth
  }

  const result: Record<string, number> = {}

  for (const span of spans) {
    result[span.spanId] = resolveDepth(span, new Set<string>())
  }

  return result
}

function getStatusClasses(status: string, hasExceptions = false): string {
  const normalized = status.trim().toLowerCase()

  if (
    hasExceptions ||
    normalized.includes("error") ||
    normalized.includes("fail") ||
    normalized.includes("exception")
  ) {
    return "border-red-500/30 bg-red-500/10 text-red-100"
  }

  if (normalized.includes("warn") || normalized.includes("degrad")) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100"
  }

  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
}

function getStatusBadgeClasses(status: string, hasExceptions = false): string {
  const normalized = status.trim().toLowerCase()

  if (
    hasExceptions ||
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

function getServiceTone(serviceName: string): {
  bar: string
  edge: string
  icon: string
} {
  const tones = [
    {
      bar: "bg-cyan-500/30 text-cyan-100",
      edge: "border-cyan-400/60 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]",
      icon: "text-cyan-300",
    },
    {
      bar: "bg-violet-500/25 text-violet-100",
      edge: "border-violet-400/60 shadow-[0_0_0_1px_rgba(167,139,250,0.16)]",
      icon: "text-violet-300",
    },
    {
      bar: "bg-amber-500/25 text-amber-100",
      edge: "border-amber-400/60 shadow-[0_0_0_1px_rgba(251,191,36,0.16)]",
      icon: "text-amber-300",
    },
    {
      bar: "bg-emerald-500/25 text-emerald-100",
      edge: "border-emerald-400/60 shadow-[0_0_0_1px_rgba(52,211,153,0.16)]",
      icon: "text-emerald-300",
    },
  ]

  const hash = [...serviceName].reduce((total, char) => total + char.charCodeAt(0), 0)
  return tones[hash % tones.length]
}

function CopyJsonButton({
  label,
  value,
}: {
  label: string
  value: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="border-white/10 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
      onClick={handleCopy}
    >
      <Copy className="size-4" />
      {copied ? "Copied" : label}
    </Button>
  )
}

function EmptyPanel({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-8 text-center">
      <p className="text-base font-semibold text-slate-100">{title}</p>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  )
}

function SummaryMetric({
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
      <p className="mt-2 break-all text-sm font-medium text-slate-100">{value}</p>
    </div>
  )
}

function ActivityOverviewCard({
  span,
  traceStart,
  onShowDetails,
}: {
  span: ActivitySpanDto
  traceStart: number
  onShowDetails: () => void
}) {
  const startOffsetMs = new Date(span.startTimeUtc).getTime() - traceStart
  const tagEntries = Object.entries(span.tags).slice(0, 4)

  return (
    <div className="rounded-3xl border border-cyan-400/20 bg-slate-950/95 p-5 shadow-[0_20px_80px_rgba(2,6,23,0.65)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">
            {span.serviceName}
          </p>
          <p className="text-lg font-semibold text-slate-100">{span.operation}</p>
          <p className="font-mono text-xs text-slate-400">Span ID: {span.spanId}</p>
        </div>
        <Badge
          variant="outline"
          className={getStatusBadgeClasses(span.status, span.exceptions.length > 0)}
        >
          {span.status || "Unset"}
        </Badge>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric label="Start Offset" value={formatOffset(startOffsetMs)} />
        <SummaryMetric label="Duration" value={formatDuration(span.durationMs)} />
        <SummaryMetric label="Events" value={String(span.events.length)} />
        <SummaryMetric label="Exceptions" value={String(span.exceptions.length)} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="rounded-2xl border border-white/8 bg-slate-900/70 p-4">
          <p className="text-sm font-semibold text-slate-100">Quick Overview</p>
          <div className="mt-3 grid gap-3">
            <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)]">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-400">
                Started
              </p>
              <p className="break-all font-mono text-sm text-slate-100">
                {formatUtcTimestamp(span.startTimeUtc)}
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)]">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-400">
                Parent
              </p>
              <p className="break-all font-mono text-sm text-slate-100">
                {span.parentSpanId || "Root activity"}
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)]">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-400">
                Dump Fields
              </p>
              <p className="break-all font-mono text-sm text-slate-100">
                {Object.keys(span.dump).length}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-sm font-semibold text-slate-100">Tag Snapshot</p>
            {tagEntries.length === 0 ? (
              <p className="text-sm text-slate-400">No tags were recorded for this activity.</p>
            ) : (
              tagEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="grid gap-2 rounded-xl border border-white/8 bg-slate-950/60 px-3 py-2 md:grid-cols-[10rem_minmax(0,1fr)]"
                >
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-300">
                    {key}
                  </p>
                  <p className="break-all font-mono text-xs text-slate-100">{value}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/8 bg-slate-900/70 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-100">Inspect activity</p>
            <p className="mt-2 text-sm text-slate-400">
              Open the full-screen view to inspect tags, events, exceptions, dumps, and the raw payload.
            </p>
          </div>

          <Button
            type="button"
            className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            onClick={onShowDetails}
          >
            Show Details
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function ActivityDetailTabs({
  span,
  traceStart,
}: {
  span: ActivitySpanDto
  traceStart: number
}) {
  const spanJson = JSON.stringify(span, null, 2)
  const dumpJson = JSON.stringify(span.dump, null, 2)

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="h-auto flex-wrap rounded-2xl bg-slate-900/80 p-1">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="events">Events</TabsTrigger>
        <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
        <TabsTrigger value="dump">Dump</TabsTrigger>
        <TabsTrigger value="raw">Raw Activity JSON</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        {span.exceptions.length > 0 ? (
          <div
            className={`rounded-2xl border px-4 py-4 ${getStatusClasses(span.status, true)}`}
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-4" />
              <div>
                <p className="font-semibold">This activity captured an exception.</p>
                <p className="mt-1 text-sm opacity-80">
                  Review the Exceptions tab for stack traces and captured data.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric label="Start Time" value={formatUtcTimestamp(span.startTimeUtc)} />
          <SummaryMetric
            label="Start Offset"
            value={formatOffset(new Date(span.startTimeUtc).getTime() - traceStart)}
          />
          <SummaryMetric label="Duration" value={formatDuration(span.durationMs)} />
          <SummaryMetric label="Parent Span" value={span.parentSpanId || "Root activity"} />
        </div>

        <Card className="border-white/10 bg-slate-950/70 py-0">
          <CardHeader className="border-b border-white/8 py-5">
            <CardTitle className="text-base text-slate-100">Activity Tags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 py-5">
            {Object.entries(span.tags).length === 0 ? (
              <EmptyPanel
                title="No tags recorded"
                description="This activity does not include tag data."
              />
            ) : (
              Object.entries(span.tags).map(([key, value]) => (
                <div
                  key={key}
                  className="grid gap-2 rounded-xl border border-white/8 bg-slate-900/70 px-4 py-3 md:grid-cols-[14rem_minmax(0,1fr)]"
                >
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                    {key}
                  </p>
                  <p className="break-all font-mono text-sm text-slate-100">{value}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="events" className="space-y-4">
        {span.events.length === 0 ? (
          <EmptyPanel
            title="No events captured"
            description="This activity did not record event milestones."
          />
        ) : (
          span.events.map((event, index) => (
            <Card
              key={`${event.timestamp}-${index}`}
              className="border-white/10 bg-slate-950/70 py-0"
            >
              <CardHeader className="border-b border-white/8 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base text-slate-100">{event.name}</CardTitle>
                    <p className="mt-2 font-mono text-xs text-slate-400">
                      {formatUtcTimestamp(event.timestamp)}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-white/10 text-slate-300">
                    {Object.keys(event.tags).length} tag
                    {Object.keys(event.tags).length === 1 ? "" : "s"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 py-5">
                {Object.entries(event.tags).length === 0 ? (
                  <p className="text-sm text-slate-400">No event tags were recorded.</p>
                ) : (
                  Object.entries(event.tags).map(([key, value]) => (
                    <div
                      key={key}
                      className="grid gap-2 rounded-xl border border-white/8 bg-slate-900/70 px-4 py-3 md:grid-cols-[12rem_minmax(0,1fr)]"
                    >
                      <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                        {key}
                      </p>
                      <p className="break-all font-mono text-sm text-slate-100">{value}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>

      <TabsContent value="exceptions" className="space-y-4">
        {span.exceptions.length === 0 ? (
          <EmptyPanel
            title="No exceptions recorded"
            description="This activity completed without captured exceptions."
          />
        ) : (
          span.exceptions.map((exception, index) => (
            <Card
              key={`${exception.type}-${index}`}
              className="border-white/10 bg-slate-950/70 py-0"
            >
              <CardHeader className="border-b border-white/8 py-5">
                <div className="space-y-2">
                  <CardTitle className="text-base text-slate-100">{exception.type}</CardTitle>
                  <p className="text-sm text-slate-300">{exception.message}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 py-5">
                {exception.stackTrace ? (
                  <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
                      <Clock3 className="size-4 text-cyan-300" />
                      Stack Trace
                    </p>
                    <pre className="overflow-x-auto rounded-2xl border border-white/8 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-200">
                      {exception.stackTrace}
                    </pre>
                  </div>
                ) : null}

                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-100">Exception Data</p>
                  {Object.entries(exception.data).length === 0 ? (
                    <p className="text-sm text-slate-400">No exception data was captured.</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(exception.data).map(([key, value]) => (
                        <div
                          key={key}
                          className="grid gap-2 rounded-xl border border-white/8 bg-slate-900/70 px-4 py-3 md:grid-cols-[12rem_minmax(0,1fr)]"
                        >
                          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                            {key}
                          </p>
                          <p className="break-all font-mono text-sm text-slate-100">{value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>

      <TabsContent value="dump" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-100">Dump Viewer</p>
            <p className="text-sm text-slate-400">
              Switch between structured rendering and raw JSON for the selected activity dump.
            </p>
          </div>
          <CopyJsonButton label="Copy Dump JSON" value={JSON.stringify(span.dump, null, 2)} />
        </div>

        <Tabs defaultValue="rendered" className="space-y-4">
          <TabsList className="rounded-2xl bg-slate-900/80 p-1">
            <TabsTrigger value="rendered">Rendered</TabsTrigger>
            <TabsTrigger value="raw">Raw JSON</TabsTrigger>
          </TabsList>
          <TabsContent value="rendered">
            <PayloadRenderer data={span.dump} />
          </TabsContent>
          <TabsContent value="raw">
            <pre className="overflow-x-auto rounded-2xl border border-white/8 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-200">
              {dumpJson}
            </pre>
          </TabsContent>
        </Tabs>
      </TabsContent>

      <TabsContent value="raw" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-100">Raw Activity Payload</p>
            <p className="text-sm text-slate-400">
              Inspect the exact API payload returned for the selected activity.
            </p>
          </div>
          <CopyJsonButton label="Copy Activity JSON" value={spanJson} />
        </div>
        <pre className="overflow-x-auto rounded-2xl border border-white/8 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-200">
          {spanJson}
        </pre>
      </TabsContent>
    </Tabs>
  )
}

function ActivityDetailsModal({
  trace,
  span,
  traceStart,
  onClose,
}: {
  trace: TraceDetailsDto
  span: ActivitySpanDto
  traceStart: number
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div className="flex h-full justify-end">
        <div
          className="flex h-full w-[90vw] max-w-none animate-in slide-in-from-right-full flex-col border-l border-white/10 bg-slate-950/95 duration-300 ease-out shadow-[-24px_0_80px_rgba(2,6,23,0.7)]"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/95 px-4 py-4 sm:px-6">
            <Button
              type="button"
              variant="ghost"
              className="justify-start rounded-2xl px-3 text-slate-100 hover:bg-slate-900"
              onClick={onClose}
            >
              <X className="size-4" />
              Close
            </Button>

            <div className="min-w-0 text-right">
              <p className="truncate font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">
                {span.serviceName}
              </p>
              <p className="truncate text-sm font-semibold text-slate-100">{span.operation}</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-3 py-4 sm:px-4 sm:py-6">
            <div className="w-full space-y-6">
              <Card className="border-white/10 bg-slate-950/70 py-0">
                <CardHeader className="border-b border-white/8 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">
                        Trace {trace.summary.traceId}
                      </p>
                      <CardTitle className="text-2xl text-slate-100">{span.operation}</CardTitle>
                      <p className="font-mono text-xs text-slate-400">Span ID: {span.spanId}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={getStatusBadgeClasses(span.status, span.exceptions.length > 0)}
                    >
                      {span.status || "Unset"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 py-5 sm:grid-cols-2 xl:grid-cols-6">
                  <SummaryMetric label="Root Activity" value={trace.summary.rootOperation} />
                  <SummaryMetric label="Root Service" value={trace.summary.rootService} />
                  <SummaryMetric
                    label="Trace Duration"
                    value={formatDuration(trace.summary.totalDurationMs)}
                  />
                  <SummaryMetric label="Span Count" value={String(trace.summary.spanCount)} />
                  <SummaryMetric
                    label="Started"
                    value={formatUtcTimestamp(trace.summary.startTimeUtc)}
                  />
                  <SummaryMetric
                    label="Completed"
                    value={formatUtcTimestamp(trace.summary.endTimeUtc)}
                  />
                </CardContent>
              </Card>

              <ActivityDetailTabs span={span} traceStart={traceStart} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TraceDetailsView({ trace }: { trace: TraceDetailsDto }) {
  const spans = useMemo(() => sortSpans(trace.spans), [trace.spans])
  const depthBySpanId = useMemo(() => buildDepthMap(spans), [spans])
  const [selectedSpanId, setSelectedSpanId] = useState(
    trace.summary.rootSpanId || spans[0]?.spanId || "",
  )
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    if (!isModalOpen) {
      return
    }

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [isModalOpen])

  const selectedSpan = spans.find((span) => span.spanId === selectedSpanId) ?? spans[0]

  if (!selectedSpan) {
    return (
      <EmptyPanel
        title="No spans were returned"
        description="The trace exists but contains no span records."
      />
    )
  }

  const traceStart = new Date(trace.summary.startTimeUtc).getTime()
  const traceEnd = Math.max(
    new Date(trace.summary.endTimeUtc).getTime(),
    ...spans.map(
      (span) => new Date(span.startTimeUtc).getTime() + Math.max(span.durationMs, 1),
    ),
  )
  const totalDuration = Math.max(traceEnd - traceStart, 1)

  return (
    <>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.22),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(3,7,18,0.9))] shadow-[0_24px_90px_rgba(2,6,23,0.55)]">
          <div className="border-b border-white/8 px-5 py-5 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-3">
                    <Layers3 className="size-5 text-cyan-300" />
                  </div>
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">
                      {trace.summary.rootService}
                    </p>
                    <h2 className="text-2xl font-semibold text-white">
                      {trace.summary.rootOperation}
                    </h2>
                  </div>
                </div>
                <p className="font-mono text-xs text-slate-400">
                  Trace ID: {trace.summary.traceId}
                </p>
              </div>

              <div className="grid gap-3 text-right sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    Total Duration
                  </p>
                  <p className="mt-1 text-xl font-semibold text-white">
                    {formatDuration(trace.summary.totalDurationMs)}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    Activities
                  </p>
                  <p className="mt-1 text-xl font-semibold text-white">
                    {trace.summary.spanCount}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    Started
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-200">
                    {formatUtcTimestamp(trace.summary.startTimeUtc)}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    Status
                  </p>
                  <div className="mt-1 flex justify-end">
                    <Badge
                      variant="outline"
                      className={getStatusBadgeClasses(trace.summary.status)}
                    >
                      {trace.summary.status || "Unset"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-2 py-3 sm:px-3 sm:py-4">
            <div className="overflow-hidden rounded-3xl border border-white/8 bg-slate-950/40">
              <div className="grid gap-4 border-b border-white/8 px-4 py-4 text-xs sm:grid-cols-[18rem_minmax(0,1fr)] sm:px-6">
                <div className="font-mono uppercase tracking-[0.2em] text-slate-500">
                  Activity
                </div>
                <div className="flex items-center justify-between font-mono uppercase tracking-[0.2em] text-slate-500">
                  <span>0ms</span>
                  <span>{formatDuration(totalDuration)}</span>
                </div>
              </div>

              <div
                className="space-y-2 p-3 sm:p-4"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.04) 1px, transparent 1px)",
                  backgroundSize: "96px 100%, 100% 54px",
                }}
              >
                {spans.map((span) => {
                  const isSelected = span.spanId === selectedSpan.spanId
                  const depth = depthBySpanId[span.spanId] ?? 0
                  const barStart = new Date(span.startTimeUtc).getTime() - traceStart
                  const barWidth = Math.max(span.durationMs, totalDuration * 0.01)
                  const leftPercent = (barStart / totalDuration) * 100
                  const widthPercent = (barWidth / totalDuration) * 100
                  const tone = getServiceTone(span.serviceName)

                  return (
                    <div key={span.spanId} className="space-y-2">
                      <div className="grid gap-3 sm:grid-cols-[18rem_minmax(0,1fr)]">
                        <button
                          type="button"
                          onClick={() => setSelectedSpanId(span.spanId)}
                          className={cn(
                            "rounded-2xl border px-4 py-3 text-left transition",
                            isSelected
                              ? "border-cyan-400/50 bg-cyan-500/10"
                              : "border-white/8 bg-slate-950/60 hover:border-cyan-400/25 hover:bg-slate-950/80",
                          )}
                        >
                          <div
                            className="space-y-1"
                            style={{ paddingLeft: `${depth * 0.9}rem` }}
                          >
                            <p
                              className={cn(
                                "font-mono text-[11px] uppercase tracking-[0.2em]",
                                tone.icon,
                              )}
                            >
                              {span.serviceName}
                            </p>
                            <p className="truncate text-sm font-semibold text-slate-100">
                              {span.operation}
                            </p>
                            <p className="font-mono text-xs text-slate-400">
                              {formatDuration(span.durationMs)}
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedSpanId(span.spanId)}
                          className={cn(
                            "relative h-16 rounded-2xl border text-left transition",
                            isSelected
                              ? "border-cyan-400/40 bg-cyan-500/[0.04]"
                              : "border-white/8 bg-slate-950/30 hover:border-cyan-400/20 hover:bg-slate-950/45",
                          )}
                        >
                          <div className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-white/8" />
                          <div
                            className={cn(
                              "absolute top-1/2 h-10 -translate-y-1/2 rounded-xl border px-3 py-2",
                              tone.bar,
                              tone.edge,
                              isSelected && "ring-1 ring-cyan-300/40",
                              span.exceptions.length > 0 &&
                                "border-red-400/60 bg-red-500/20 text-red-100",
                            )}
                            style={{
                              left: `min(calc(${Math.max(leftPercent, 0.2)}% + 0.5rem), calc(100% - 4.75rem))`,
                              width: `max(${Math.min(widthPercent, 100)}%, 4rem)`,
                              maxWidth: "calc(100% - 1rem)",
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate text-sm font-semibold">
                                {span.operation}
                              </span>
                              <span className="shrink-0 font-mono text-xs">
                                {formatDuration(span.durationMs)}
                              </span>
                            </div>
                          </div>
                        </button>
                      </div>

                      {isSelected ? (
                        <div className="grid gap-3 sm:grid-cols-[18rem_minmax(0,1fr)]">
                          <div className="hidden sm:block" />
                          <ActivityOverviewCard
                            span={span}
                            traceStart={traceStart}
                            onShowDetails={() => setIsModalOpen(true)}
                          />
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      </div>

      {isModalOpen ? (
        <ActivityDetailsModal
          trace={trace}
          span={selectedSpan}
          traceStart={traceStart}
          onClose={() => setIsModalOpen(false)}
        />
      ) : null}
    </>
  )
}
