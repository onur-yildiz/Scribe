"use client"

import React, { useMemo, useRef, useState, useEffect } from "react"
import { 
  Network, 
  ShieldCheck, 
  CreditCard, 
  Database, 
  Cloud, 
  Zap, 
  AlertCircle,
  Maximize2,
  Minimize2,
  RotateCcw,
  Clock
} from "lucide-react"
import type { TraceDetailsDto, ActivitySpanDto } from "@/lib/api-types"
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

function NodeHoverCard({ span }: { span: ActivitySpanDto }) {
  return (
    <div className="w-64 p-4 rounded-2xl bg-slate-900/95 border border-cyan-500/30 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">{span.serviceName}</span>
        <Badge className="text-[10px] px-1.5 py-0 border-cyan-500/30 text-cyan-300 bg-cyan-500/10">
          {span.status || "OK"}
        </Badge>
      </div>
      <h4 className="text-sm font-bold text-white mb-1 truncate">{span.operation}</h4>
      <div className="flex items-center gap-2 text-slate-400 text-[11px] mb-3">
        <Clock className="size-3" />
        <span>{formatDuration(span.durationMs)}</span>
        <div className="w-1 h-1 rounded-full bg-slate-600" />
        <span>{Object.keys(span.tags).length} tags</span>
      </div>
      <div className="space-y-1.5">
        {Object.entries(span.tags).slice(0, 3).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono text-slate-500 uppercase truncate max-w-[80px]">{key}</span>
            <span className="text-[10px] font-mono text-slate-300 truncate text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", className)}>{children}</div>
}

export function TraceGraphView({ trace, onSpanSelect, selectedSpanId }: TraceGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 50, y: 120 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hoveredSpanId, setHoveredSpanId] = useState<string | null>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })

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
      finalPositions[spanId] = { x, y: nextY * 100, depth }
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
    // Support left click (0) and middle click (1)
    if (e.button === 0 || e.button === 1) {
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
    
    if (hoveredSpanId) {
      setHoverPos({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        const zoomDelta = -e.deltaY * 0.001
        setZoom(prev => Math.min(Math.max(prev + zoomDelta, 0.1), 5))
      } else {
        setOffset(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY
        }))
      }
    }

    container.addEventListener('wheel', handleNativeWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleNativeWheel)
  }, [])

  const resetZoom = () => {
    setZoom(1)
    setOffset({ x: 50, y: 120 })
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

  const hoveredSpan = trace.spans.find(s => s.spanId === hoveredSpanId)

  return (
    <div 
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#020617] cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
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

      {/* Fixed Time Labels Layer */}
      <div className="absolute top-0 inset-x-0 h-10 z-20 pointer-events-none bg-[#020617] border-b border-white/5 overflow-hidden">
        <div 
          className="relative h-full"
          style={{
            transform: `translateX(${offset.x}px) scaleX(${zoom})`,
            transformOrigin: '0 0'
          }}
        >
          {guideLines.map(t => (
            <div 
              key={`guide-label-${t}`}
              className="absolute top-0 bottom-0 border-l border-cyan-500/10 flex items-center"
              style={{ left: t * TIME_SCALE }}
            >
              <span className="ml-2 text-[10px] font-mono text-cyan-500/40" style={{ transform: `scaleX(${1/zoom})`, transformOrigin: '0 50%' }}>{t}ms</span>
            </div>
          ))}
        </div>
      </div>

      {/* Control Overlays */}
      <div className="absolute top-14 right-8 z-30 flex gap-2">
         <button 
          onClick={() => setZoom(z => Math.min(z + 0.2, 5))}
          className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-400/30 transition-all backdrop-blur-md"
          title="Zoom In"
        >
          <Maximize2 className="size-4" />
        </button>
        <button 
          onClick={() => setZoom(z => Math.max(z - 0.2, 0.1))}
          className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-400/30 transition-all backdrop-blur-md"
          title="Zoom Out"
        >
          <Minimize2 className="size-4" />
        </button>
        <button 
          onClick={resetZoom}
          className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-400/30 transition-all backdrop-blur-md"
          title="Reset Zoom"
        >
          <RotateCcw className="size-4" />
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
        {/* Guide Lines (Lines only) */}
        {guideLines.map(t => (
          <div 
            key={`guide-line-${t}`}
            className="absolute top-[-2000px] bottom-[-2000px] border-l border-cyan-500/5"
            style={{ left: t * TIME_SCALE }}
          />
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

      {/* Hover Overview Card Overlay */}
      {hoveredSpan && (
        <div 
          className="fixed z-50 pointer-events-none"
          style={{ 
            left: hoverPos.x + 20, 
            top: hoverPos.y + 20 
          }}
        >
          <NodeHoverCard span={hoveredSpan} />
        </div>
      )}

      {/* Minimap/Timeline at bottom */}
      <div className="absolute bottom-10 inset-x-12 h-16 bg-slate-950/80 backdrop-blur-2xl rounded-2xl border border-white/10 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="relative h-full w-full px-4 py-4">
          <div className="absolute top-1.5 left-4 text-[7px] font-mono text-slate-500 uppercase tracking-[0.2em] opacity-70">0ms</div>
          <div className="absolute top-1.5 right-4 text-[7px] font-mono text-slate-500 uppercase tracking-[0.2em] opacity-70">{formatDuration(totalDuration)}</div>
          
          <div className="relative w-full h-full flex items-center">
            {trace.spans.map(span => {
              const start = new Date(span.startTimeUtc).getTime() - traceStart
              const duration = span.durationMs
              const left = (start / totalDuration) * 100
              const width = Math.max((duration / totalDuration) * 100, 0.4)
              const hasError = span.status.toLowerCase().includes('fail') || span.status.toLowerCase().includes('error') || span.exceptions.length > 0

              return (
                <div 
                  key={`mini-${span.spanId}`}
                  className={cn(
                    "absolute h-3 rounded-full transition-all duration-300",
                    hasError 
                      ? "bg-red-600 z-10 shadow-[0_0_12px_rgba(220,38,38,0.6)]" 
                      : "bg-blue-600/40 hover:bg-blue-600/60 transition-colors"
                  )}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                  }}
                />
              )
            })}
          </div>
          
          {/* Viewport indicator (Inner Bar) */}
          <div 
            className="absolute h-full top-0 border-2 border-blue-400/40 rounded-xl bg-blue-100/15 transition-all pointer-events-none z-20 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]"
            style={{
              left: `${minimapViewport.left}%`,
              width: `${minimapViewport.width}%`,
            }}
          >
            <div className="absolute inset-0 border-[1px] border-white/5 rounded-xl" />
            <div className="absolute inset-x-0 -top-1 h-1 bg-blue-400/20 blur-[2px]" />
            <div className="absolute inset-x-0 -bottom-1 h-1 bg-blue-400/20 blur-[2px]" />
          </div>
        </div>
      </div>
    </div>
  )
}
