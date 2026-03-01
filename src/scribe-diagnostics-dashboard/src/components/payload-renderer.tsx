"use client"

import type { DumpValue } from "@/lib/api-types"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type DumpObject = { [key: string]: DumpValue }

function isPrimitive(value: DumpValue | undefined): value is string | number | boolean | null {
  return value === null || ["string", "number", "boolean"].includes(typeof value)
}

function isObject(value: DumpValue): value is DumpObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isObjectArray(value: DumpValue[]): value is DumpObject[] {
  return value.length > 0 && value.every((item) => isObject(item))
}

function isPrimitiveArray(value: DumpValue[]): boolean {
  return value.every((item) => isPrimitive(item))
}

function formatPrimitive(value: DumpValue | undefined): string {
  if (value === undefined) {
    return "not set"
  }

  if (value === null) {
    return "null"
  }

  if (typeof value === "string") {
    return value
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  return JSON.stringify(value)
}

function renderCompactValue(value: DumpValue | undefined): string {
  if (isPrimitive(value)) {
    return formatPrimitive(value)
  }

  return JSON.stringify(value)
}

function PrimitiveRow({
  label,
  value,
}: {
  label: string
  value: DumpValue
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-white/8 bg-slate-950/70 px-4 py-3 md:grid-cols-[14rem_minmax(0,1fr)]">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
        {label}
      </p>
      <p className="break-all font-mono text-sm text-slate-100">
        {formatPrimitive(value)}
      </p>
    </div>
  )
}

function ObjectSection({
  label,
  value,
  depth,
}: {
  label: string
  value: DumpObject
  depth: number
}) {
  const entries = Object.entries(value)

  return (
    <section
      className={`rounded-2xl border border-white/8 bg-slate-950/60 ${
        depth > 0 ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 px-4 py-3">
        <p className="font-mono text-sm font-semibold text-slate-100">{label}</p>
        <Badge variant="outline" className="border-white/10 text-slate-300">
          {entries.length} field{entries.length === 1 ? "" : "s"}
        </Badge>
      </div>
      <div className="space-y-3 p-4">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-400">Empty object.</p>
        ) : (
          entries.map(([childKey, childValue]) => (
            <RenderValue
              key={childKey}
              label={childKey}
              value={childValue}
              depth={depth + 1}
            />
          ))
        )}
      </div>
    </section>
  )
}

function ObjectArraySection({
  label,
  value,
}: {
  label: string
  value: DumpObject[]
}) {
  const columns = Array.from(
    new Set(value.flatMap((row) => Object.keys(row))),
  )

  return (
    <section className="rounded-2xl border border-white/8 bg-slate-950/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 px-4 py-3">
        <p className="font-mono text-sm font-semibold text-slate-100">{label}</p>
        <Badge variant="outline" className="border-white/10 text-slate-300">
          {value.length} row{value.length === 1 ? "" : "s"}
        </Badge>
      </div>
      <Table className="min-w-full">
        <TableHeader>
          <TableRow className="border-white/8">
            {columns.map((column) => (
              <TableHead key={column} className="text-slate-300">
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {value.map((row, rowIndex) => (
            <TableRow key={`${label}-${rowIndex}`} className="border-white/6">
              {columns.map((column) => (
                <TableCell
                  key={`${rowIndex}-${column}`}
                  className="max-w-72 whitespace-normal font-mono text-xs text-slate-100"
                >
                  {renderCompactValue(row[column])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}

function PrimitiveArraySection({
  label,
  value,
}: {
  label: string
  value: DumpValue[]
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-slate-950/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 px-4 py-3">
        <p className="font-mono text-sm font-semibold text-slate-100">{label}</p>
        <Badge variant="outline" className="border-white/10 text-slate-300">
          {value.length} item{value.length === 1 ? "" : "s"}
        </Badge>
      </div>
      <Table className="min-w-full">
        <TableHeader>
          <TableRow className="border-white/8">
            <TableHead className="w-20 text-slate-300">Index</TableHead>
            <TableHead className="text-slate-300">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {value.map((item, index) => (
            <TableRow key={`${label}-${index}`} className="border-white/6">
              <TableCell className="font-mono text-xs text-slate-400">
                {index}
              </TableCell>
              <TableCell className="max-w-72 whitespace-normal font-mono text-xs text-slate-100">
                {formatPrimitive(item)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}

function ArrayFallback({
  label,
  value,
}: {
  label: string
  value: DumpValue[]
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-slate-950/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 px-4 py-3">
        <p className="font-mono text-sm font-semibold text-slate-100">{label}</p>
        <Badge variant="outline" className="border-white/10 text-slate-300">
          Mixed array
        </Badge>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-6 text-slate-200">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  )
}

function RenderValue({
  label,
  value,
  depth,
}: {
  label: string
  value: DumpValue
  depth: number
}) {
  if (isPrimitive(value)) {
    return <PrimitiveRow label={label} value={value} />
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <section className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-sm font-semibold text-slate-100">
              {label}
            </p>
            <Badge variant="outline" className="border-white/10 text-slate-300">
              Empty array
            </Badge>
          </div>
        </section>
      )
    }

    if (isObjectArray(value)) {
      return <ObjectArraySection label={label} value={value} />
    }

    if (isPrimitiveArray(value)) {
      return <PrimitiveArraySection label={label} value={value} />
    }

    return <ArrayFallback label={label} value={value} />
  }

  return <ObjectSection label={label} value={value} depth={depth} />
}

export function PayloadRenderer({ data }: { data: Record<string, DumpValue> }) {
  const entries = Object.entries(data)

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-6 text-sm text-slate-400">
        No dump payload captured for this activity.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {entries.map(([key, value]) => (
        <RenderValue key={key} label={key} value={value} depth={0} />
      ))}
    </div>
  )
}
