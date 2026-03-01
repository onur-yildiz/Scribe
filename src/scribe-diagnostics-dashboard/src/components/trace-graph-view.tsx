"use client"

import React, { useMemo, useRef, useState } from "react"
import { 
  Network, 
  ShieldCheck, 
  CreditCard, 
  Database, 
  Cloud, 
  Zap, 
  AlertCircle,
  Maximize2,
  Minimize2
} from "lucide-react"
import type { TraceDetailsDto } from "@/lib/api-types"
import { formatDuration } from "@/lib/format"
import { cn } from "@/lib/utils"

interface TraceGraphViewProps {
  trace: TraceDetailsDto
  onSpanSelect: (spanId: string) => void
  selectedSpanId?: string
}

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  "api-gateway": <Network className="size-3" />,
  "auth-svc": <ShieldCheck className="size-3" />,
  "payment-svc": <CreditCard className="size-3" />,
  "postgres": <Database className="size-3" />,
  "stripe-api": <Cloud className="size-3" />,
}

const getServiceIcon = (serviceName: string) => {
  const lower = serviceName.toLowerCase()
  for (const [key, icon] of Object.entries(SERVICE_ICONS)) {
    if (lower.includes(key)) return icon
  }
  return <Zap className="size-3" />
}

const TIME_SCALE = 0.5 // pixels per ms at 100% zoom

export function TraceGraphView({ trace, onSpanSelect, selectedSpanId }: TraceGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 50, y: 50 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hoveredSpanId, setHoveredSpanId] = useState<string | null>(null)

  const traceStart = useMemo(() => new Date(trace.summary.startTimeUtc).getTime(), [trace.summary.startTimeUtc])

  const spansWithPositions = useMemo(() => {
    const spans = trace.spans
    const byId = new Map(spans.map(s => [s.spanId, s]))
    const childrenMap = new Map<string, string[]>()
    
    spans.forEach(s => {
      if (s.parentSpanId) {
        const children = childrenMap.get(s.parentSpanId) || []
        children.push(s.spanId)
        childrenMap.set(s.parentSpanId, children)
      }
    })

    const finalPositions: Record<string, { x: number, y: number, depth: number }> = {}
    let nextY = 0

    const layoutSubtree = (spanId: string, depth: number) => {
      const span = byId.get(spanId)!
      const startTime = new Date(span.startTimeUtc).getTime()
      const x = (startTime - traceStart) * TIME_SCALE
      
      const children = childrenMap.get(spanId) || []
      
      // First, place this node
      finalPositions[spanId] = { x, y: nextY * 80, depth }
      nextY++

      children.forEach(childId => {
        layoutSubtree(childId, depth + 1)
      })
    }

    const rootSpans = spans.filter(s => !s.parentSpanId || !byId.has(s.parentSpanId!))
    rootSpans.forEach(root => layoutSubtree(root.spanId, 0))

    return finalPositions
  }, [trace.spans, traceStart])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      const zoomDelta = -e.deltaY * 0.001
      setZoom(prev => Math.min(Math.max(prev + zoomDelta, 0.1), 5))
      e.preventDefault()
    } else {
      setOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }))
    }
  }

  const totalDuration = trace.summary.totalDurationMs
  const viewportWidth = containerRef.current?.clientWidth || 1000

  // Calculate minimap viewport box
  const minimapViewport = useMemo(() => {
    // container space / (zoom * scale) = time space visible
    const visibleTimeWidth = viewportWidth / (zoom * TIME_SCALE)
    const visibleTimeStart = -offset.x / (zoom * TIME_SCALE)
    
    const left = Math.max(0, Math.min(100, (visibleTimeStart / totalDuration) * 100))
    const width = Math.max(2, Math.min(100 - left, (visibleTimeWidth / totalDuration) * 100))
    
    return { left, width }
  }, [offset.x, zoom, totalDuration, viewportWidth])

  // Generate vertical guide lines
  const guideLines = useMemo(() => {
    const lines = []
    const step = 200 // 200ms steps
    for (let t = 0; t <= totalDuration + step; t += step) {
      lines.push(t)
    }
    return lines
  }, [totalDuration])

  return (
    <div 
      ref={containerRef}
      className="relative h-[650px] w-full overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#020617] cursor-grab active:cursor-grabbing shadow-2xl"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Grid Background */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(56,189,248,0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(56,189,248,0.05) 1px, transparent 1px)
          `,
          backgroundSize: `${60 * zoom}px ${60 * zoom}px`,
          backgroundPosition: `${offset.x}px ${offset.y}px`
        }}
      />

      {/* Header Info */}
      <div className="absolute top-8 left-10 z-10 pointer-events-none">
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-400/20 backdrop-blur-md">
            <Network className="size-6 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-xl tracking-tight">{trace.summary.rootOperation}</h3>
            <p className="text-slate-400 font-mono text-xs mt-0.5">Trace ID: {trace.summary.traceId}</p>
          </div>
        </div>
      </div>

      <div className="absolute top-8 right-10 z-10 text-right pointer-events-none">
        <p className="text-white font-bold text-2xl tracking-tight">{formatDuration(trace.summary.totalDurationMs)}</p>
        <p className="text-slate-500 font-mono text-[10px] uppercase tracking-[0.2em] mt-0.5">Total Duration</p>
      </div>

      <div className="absolute top-8 right-56 z-10 flex gap-2">
         <button 
          onClick={() => setZoom(z => Math.min(z + 0.2, 5))}
          className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-400/30 transition-all backdrop-blur-md"
        >
          <Maximize2 className="size-4" />
        </button>
        <button 
          onClick={() => setZoom(z => Math.max(z - 0.2, 0.1))}
          className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-400/30 transition-all backdrop-blur-md"
        >
          <Minimize2 className="size-4" />
        </button>
      </div>

      {/* Graph Content */}
      <div 
        className="absolute inset-0"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        {/* Guide Lines */}
        {guideLines.map(t => (
          <div 
            key={`guide-${t}`}
            className="absolute top-[-1000px] bottom-[-1000px] border-l border-cyan-500/5 flex flex-col items-start"
            style={{ left: t * TIME_SCALE }}
          >
            <span className="mt-[1000px] ml-2 text-[10px] font-mono text-cyan-500/30">{t}ms</span>
          </div>
        ))}

        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
          {trace.spans.map(span => {
            if (!span.parentSpanId) return null
            const parentPos = spansWithPositions[span.parentSpanId]
            const childPos = spansWithPositions[span.spanId]
            if (!parentPos || !childPos) return null

            const yOffset = 42 
            const parentPillWidth = 180 
            
            const x1 = parentPos.x + parentPillWidth - 20
            const y1 = parentPos.y + yOffset
            const x2 = childPos.x 
            const y2 = childPos.y + yOffset

            const horizontalStretch = Math.min(Math.abs(x2 - x1) * 0.6, 120)
            
            const isHovered = hoveredSpanId === span.spanId || hoveredSpanId === span.parentSpanId
            const isSelected = selectedSpanId === span.spanId || selectedSpanId === span.parentSpanId
            
            // If something is hovered, only highlight the hovered lines.
            // If nothing is hovered, highlight the selected lines.
            const isHighlighted = hoveredSpanId ? isHovered : isSelected

            return (
              <path
                key={`line-${span.spanId}`}
                d={`M ${x1} ${y1} C ${x1 + horizontalStretch} ${y1}, ${x2 - horizontalStretch} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={isHighlighted ? "rgba(34,211,238,0.6)" : "rgba(34,211,238,0.15)"}
                strokeWidth={isHighlighted ? "2.5" : "1.5"}
                className="transition-all duration-300"
                style={{
                  filter: isHighlighted ? "drop-shadow(0 0 4px rgba(34,211,238,0.4))" : "none"
                }}
              />
            )
          })}
        </svg>

        {trace.spans.map(span => {
          const pos = spansWithPositions[span.spanId]
          if (!pos) return null

          const isSelected = selectedSpanId === span.spanId
          const hasError = span.status.toLowerCase().includes('fail') || span.status.toLowerCase().includes('error') || span.exceptions.length > 0
          const icon = getServiceIcon(span.serviceName)

          return (
            <div
              key={span.spanId}
              onClick={(e) => {
                e.stopPropagation()
                onSpanSelect(span.spanId)
              }}
              onMouseEnter={() => setHoveredSpanId(span.spanId)}
              onMouseLeave={() => setHoveredSpanId(null)}
              className={cn(
                "absolute cursor-pointer transition-all duration-200 group flex flex-col items-start",
                isSelected ? "z-30" : "z-20"
              )}
              style={{
                left: pos.x,
                top: pos.y,
              }}
            >
              <div className="mb-1.5 px-2.5 py-0.5 rounded-lg bg-slate-900/90 border border-white/10 backdrop-blur-md shadow-sm">
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-[0.15em] whitespace-nowrap">
                  {span.serviceName}
                </span>
              </div>

              <div className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border backdrop-blur-xl transition-all",
                isSelected 
                  ? "bg-cyan-500/20 border-cyan-400 shadow-[0_10px_40px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400/40" 
                  : "bg-[#0f172a]/70 border-white/10 hover:border-white/25 hover:bg-[#1e293b]/80 shadow-lg",
                hasError && !isSelected && "border-red-500/40 bg-red-500/5"
              )}>
                <div className={cn(
                  "p-2 rounded-xl shrink-0 transition-colors",
                  hasError ? "bg-red-500/20 text-red-400" : "bg-cyan-500/20 text-cyan-400"
                )}>
                  {icon}
                </div>
                
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-sm font-bold text-white tracking-tight truncate max-w-[180px]">
                    {span.operation}
                  </span>
                </div>

                <div className={cn(
                  "ml-1 px-2 py-1 rounded-lg text-[10px] font-bold font-mono shrink-0 shadow-sm",
                  hasError 
                    ? "bg-red-500/20 text-red-100 border border-red-500/30" 
                    : "bg-slate-900/80 text-cyan-400 border border-white/5"
                )}>
                  {formatDuration(span.durationMs)}
                </div>

                {hasError && (
                  <div className="absolute -top-1.5 -right-1.5 animate-pulse">
                    <AlertCircle className="size-5 text-red-500 fill-[#020617]" />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Minimap/Timeline at bottom */}
      <div className="absolute bottom-10 inset-x-12 h-14 bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
        <div className="relative h-full w-full px-4 py-4">
          <div className="absolute top-1 left-4 text-[8px] font-mono text-slate-500 uppercase tracking-widest">0ms</div>
          <div className="absolute top-1 right-4 text-[8px] font-mono text-slate-500 uppercase tracking-widest">{formatDuration(totalDuration)}</div>
          
          <div className="relative w-full h-full flex items-center">
            {trace.spans.map(span => {
              const start = new Date(span.startTimeUtc).getTime() - traceStart
              const duration = span.durationMs
              const left = (start / totalDuration) * 100
              const width = Math.max((duration / totalDuration) * 100, 0.5)
              const hasError = span.status.toLowerCase().includes('fail') || span.status.toLowerCase().includes('error') || span.exceptions.length > 0

              return (
                <div 
                  key={`mini-${span.spanId}`}
                  className={cn(
                    "absolute h-1.5 rounded-full transition-opacity",
                    hasError ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-cyan-500/40"
                  )}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                  }}
                />
              )
            })}
          </div>
          
          {/* Viewport indicator */}
          <div 
            className="absolute h-full top-0 border-2 border-cyan-400/40 rounded-xl bg-cyan-400/5 transition-all pointer-events-none"
            style={{
              left: `${minimapViewport.left}%`,
              width: `${minimapViewport.width}%`,
            }}
          >
            <div className="absolute inset-0 border-[1px] border-white/5 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
