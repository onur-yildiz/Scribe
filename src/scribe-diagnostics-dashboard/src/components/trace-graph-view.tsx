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
  Clock,
  Layers,
  GitBranch
} from "lucide-react"
import type { TraceDetailsDto, ActivitySpanDto } from "@/lib/api-types"
import { formatDuration } from "@/lib/format"
import { cn } from "@/lib/utils"

interface TraceGraphViewProps {
  trace: TraceDetailsDto
  onSpanSelect: (spanId: string, openDetails?: boolean) => void
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

function NodeHoverCard({ span }: { span: ActivitySpanDto }) {
  return (
    <div className="w-80 p-5 rounded-2xl bg-slate-900/98 border border-cyan-500/40 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-bold font-mono text-cyan-400 uppercase tracking-widest bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">{span.serviceName}</span>
        <Badge className="text-[10px] px-2 py-0.5 border-cyan-500/30 text-cyan-200 bg-cyan-500/20 font-bold">
          {span.status || "OK"}
        </Badge>
      </div>
      <h4 className="text-base font-bold text-white mb-2 leading-tight">{span.operation}</h4>
      <div className="flex items-center gap-3 text-slate-400 text-xs mb-4">
        <div className="flex items-center gap-1.5">
          <Clock className="size-3.5 text-cyan-400" />
          <span className="font-mono">{formatDuration(span.durationMs)}</span>
        </div>
        <div className="w-1 h-1 rounded-full bg-slate-700" />
        <div className="flex items-center gap-1.5">
          <Layers className="size-3.5 text-cyan-400" />
          <span>{Object.keys(span.tags).length} tags</span>
        </div>
      </div>
      
      <div className="space-y-2 border-t border-white/5 pt-4">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Primary Tags</p>
        {Object.entries(span.tags).slice(0, 6).map(([key, value]) => (
          <div key={key} className="flex flex-col gap-0.5">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-tight">{key}</span>
            <span className="text-[11px] font-mono text-slate-200 break-words leading-relaxed">{value}</span>
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
  const [offset, setOffset] = useState({ x: 50, y: 150 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hoveredSpanId, setHoveredSpanId] = useState<string | null>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, spanId: string } | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  const traceStart = useMemo(() => new Date(trace.summary.startTimeUtc).getTime(), [trace.summary.startTimeUtc])
  const totalDuration = trace.summary.totalDurationMs

  const triggerAnimation = () => {
    setIsAnimating(true)
    window.setTimeout(() => setIsAnimating(false), 500)
  }

  const baseTimeScale = useMemo(() => {
    // Target ~2500px width for the whole trace at 100% zoom
    // Keep it between 0.001 and 20 pixels per ms
    return Math.min(20, Math.max(0.001, 2500 / Math.max(totalDuration, 1)))
  }, [totalDuration])

  const jumpToNode = (spanId: string) => {
    const pos = spansWithPositions[spanId]
    if (!pos) return

    const containerWidth = containerRef.current?.clientWidth || 1000
    const containerHeight = containerRef.current?.clientHeight || 600

    triggerAnimation()
    setOffset({
      x: (containerWidth / 2) - (pos.x * zoom) - (pos.width * zoom / 4),
      y: (containerHeight / 2) - (pos.y * zoom)
    })
    onSpanSelect(spanId, false)
    setContextMenu(null)
  }

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

    const finalPositions: Record<string, { x: number, y: number, depth: number, width: number }> = {}
    let nextY = 0

    const layoutSubtree = (spanId: string, depth: number) => {
      const span = byId.get(spanId)!
      const startTime = new Date(span.startTimeUtc).getTime()
      const x = (startTime - traceStart) * baseTimeScale
      
      // Calculate dynamic width based on duration
      const durationWidth = span.durationMs * baseTimeScale
      const minWidth = 240 // Minimum width to fit basic info
      const width = Math.max(minWidth, durationWidth)

      const children = childrenMap.get(spanId) || []
      
      finalPositions[spanId] = { x, y: nextY * 140, depth, width }
      nextY++

      children.forEach(childId => {
        layoutSubtree(childId, depth + 1)
      })
    }

    const rootSpans = spans.filter(s => !s.parentSpanId || !byId.has(s.parentSpanId!))
    rootSpans.forEach(root => layoutSubtree(root.spanId, 0))

    return finalPositions
  }, [trace.spans, traceStart, baseTimeScale])

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
        
        const rect = container.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        const zoomFactor = 1.1
        const delta = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor
        const newZoom = Math.min(Math.max(zoom * delta, 0.05), 10)
        
        const actualDelta = newZoom / zoom
        
        setZoom(newZoom)
        setOffset(prev => ({
          x: mouseX - (mouseX - prev.x) * actualDelta,
          y: mouseY - (mouseY - prev.y) * actualDelta
        }))
      } else {
        setOffset(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY
        }))
      }
    }

    container.addEventListener('wheel', handleNativeWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleNativeWheel)
  }, [zoom]) // Re-bind when zoom changes to capture correct value in closure if needed

  const resetZoom = () => {
    triggerAnimation()
    setZoom(1)
    setOffset({ x: 50, y: 150 })
  }

  const handleMinimapClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = x / rect.width
    const targetTime = percent * totalDuration
    
    // Center targetTime in the view
    const containerWidth = containerRef.current?.clientWidth || 1000
    triggerAnimation()
    setOffset(prev => ({
      ...prev,
      x: (containerWidth / 2) - (targetTime * baseTimeScale * zoom)
    }))
  }

  const viewportWidth = containerRef.current?.clientWidth || 1000

  // Calculate minimap viewport box
  const minimapViewport = useMemo(() => {
    const visibleTimeWidth = viewportWidth / (zoom * baseTimeScale)
    const visibleTimeStart = -offset.x / (zoom * baseTimeScale)
    
    const left = (visibleTimeStart / totalDuration) * 100
    const width = (visibleTimeWidth / totalDuration) * 100
    
    return { left, width }
  }, [offset.x, zoom, totalDuration, viewportWidth, baseTimeScale])

  // Generate vertical guide lines with dynamic steps
  const guideLines = useMemo(() => {
    const targetPx = 150 // Target spacing between lines in pixels
    const rawStep = targetPx / (zoom * baseTimeScale)
    
    // Find nearest "nice" step
    const niceSteps = [0.1, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000]
    let step = niceSteps[0]
    for (const s of niceSteps) {
      step = s
      if (s >= rawStep) break
    }

    const lines = []
    // Add lines slightly beyond totalDuration to fill the view
    for (let t = 0; t <= totalDuration + step; t += step) {
      lines.push(t)
    }
    return lines
  }, [totalDuration, zoom, baseTimeScale])

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [])

  const hoveredSpan = trace.spans.find(s => s.spanId === hoveredSpanId)
  const contextSpan = trace.spans.find(s => s.spanId === contextMenu?.spanId)
  const childrenOfContext = contextSpan ? trace.spans.filter(s => s.parentSpanId === contextSpan.spanId) : []
  const parentOfContext = contextSpan ? trace.spans.find(s => s.spanId === contextSpan.parentSpanId) : null

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
          className={cn(
            "relative h-full",
            isAnimating && "transition-transform duration-500 ease-in-out"
          )}
          style={{
            transform: `translateX(${offset.x}px)`,
            transformOrigin: '0 0'
          }}
        >
          {guideLines.map(t => (
            <div 
              key={`guide-label-${t}`}
              className="absolute top-0 bottom-0 border-l border-cyan-500/10 flex items-center"
              style={{ left: t * baseTimeScale * zoom }}
            >
              <span className="ml-2 text-[10px] font-mono text-cyan-500/40">{t}ms</span>
            </div>
          ))}
        </div>
      </div>

      {/* Control Overlays */}
      <div className="absolute top-14 right-8 z-30 flex gap-2">
         <button 
          onClick={() => {
            const containerWidth = containerRef.current?.clientWidth || 1000
            const containerHeight = containerRef.current?.clientHeight || 600
            const nextZoom = Math.min(zoom * 1.2, 10)
            const actualDelta = nextZoom / zoom
            triggerAnimation()
            setZoom(nextZoom)
            setOffset(prev => ({
              x: (containerWidth / 2) - ((containerWidth / 2) - prev.x) * actualDelta,
              y: (containerHeight / 2) - ((containerHeight / 2) - prev.y) * actualDelta
            }))
          }}
          className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-400/30 transition-all backdrop-blur-md"
          title="Zoom In"
        >
          <Maximize2 className="size-4" />
        </button>
        <button 
          onClick={() => {
            const containerWidth = containerRef.current?.clientWidth || 1000
            const containerHeight = containerRef.current?.clientHeight || 600
            const nextZoom = Math.max(zoom / 1.2, 0.05)
            const actualDelta = nextZoom / zoom
            triggerAnimation()
            setZoom(nextZoom)
            setOffset(prev => ({
              x: (containerWidth / 2) - ((containerWidth / 2) - prev.x) * actualDelta,
              y: (containerHeight / 2) - ((containerHeight / 2) - prev.y) * actualDelta
            }))
          }}
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
        className={cn(
          "absolute inset-0",
          isAnimating && "transition-transform duration-500 ease-in-out"
        )}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        {/* Guide Lines (Lines only) */}
        {guideLines.map(t => (
          <div 
            key={`guide-line-${t}`}
            className="absolute top-[-5000px] bottom-[-5000px] border-l border-cyan-500/5"
            style={{ left: t * baseTimeScale }}
          />
        ))}

        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
          {trace.spans.map(span => {
            if (!span.parentSpanId) return null
            const parentPos = spansWithPositions[span.parentSpanId]
            const childPos = spansWithPositions[span.spanId]
            if (!parentPos || !childPos) return null

            const yOffset = 50 
            
            const x1 = parentPos.x + 40
            const y1 = parentPos.y + yOffset
            const x2 = childPos.x 
            const y2 = childPos.y + yOffset

            const horizontalStretch = Math.min(Math.abs(x2 - x1) * 0.6, 120)
            
            const isHovered = hoveredSpanId === span.spanId || hoveredSpanId === span.parentSpanId
            const isSelected = selectedSpanId === span.spanId || selectedSpanId === span.parentSpanId
            const isHighlighted = hoveredSpanId ? isHovered : isSelected

            return (
              <path
                key={`line-${span.spanId}`}
                d={`M ${x1} ${y1} C ${x1 + horizontalStretch} ${y1}, ${x2 - horizontalStretch} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={isHighlighted ? "rgba(34,211,238,0.6)" : "rgba(34,211,238,0.15)"}
                strokeWidth={isHighlighted ? 2 / zoom : 1 / zoom}
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

          // Content coordinate of the left edge of the viewport
          const viewportLeft = -offset.x / zoom
          
          // Sticky header logic
          const stickyThreshold = 20
          const headerX = Math.max(0, Math.min(pos.width - 240, viewportLeft - pos.x + stickyThreshold))

          return (
            <div
              key={span.spanId}
              onClick={(e) => {
                e.stopPropagation()
                onSpanSelect(span.spanId)
              }}
              onMouseEnter={() => setHoveredSpanId(span.spanId)}
              onMouseLeave={() => setHoveredSpanId(null)}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setContextMenu({ x: e.clientX, y: e.clientY, spanId: span.spanId })
              }}
              className={cn(
                "absolute cursor-pointer transition-all duration-200 group flex flex-col items-start",
                isSelected ? "z-30" : "z-20"
              )}
              style={{
                left: pos.x,
                top: pos.y,
                width: pos.width
              }}
            >
              <div 
                className="mb-2 px-2.5 py-0.5 rounded-lg bg-slate-900/90 border border-white/10 backdrop-blur-md shadow-sm transition-transform"
                style={{ transform: `translateX(${headerX}px)` }}
              >
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-[0.15em] whitespace-nowrap">
                  {span.serviceName}
                </span>
              </div>

              <div className={cn(
                "flex flex-col w-full min-h-[80px] rounded-3xl border backdrop-blur-xl transition-all overflow-hidden",
                isSelected 
                  ? "bg-cyan-500/20 border-cyan-400 shadow-[0_10px_40px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400/40" 
                  : "bg-[#0f172a]/70 border-white/10 hover:border-white/25 hover:bg-[#1e293b]/80 shadow-lg",
                hasError && !isSelected && "border-red-500/40 bg-red-500/5"
              )}>
                {/* Fixed part of the node (Title & Duration) */}
                <div 
                  className="flex items-center gap-4 px-4 py-3 min-w-[240px]"
                  style={{ transform: `translateX(${headerX}px)` }}
                >
                  <div className={cn(
                    "p-2.5 rounded-xl shrink-0 transition-colors",
                    hasError ? "bg-red-500/20 text-red-400" : "bg-cyan-500/20 text-cyan-400"
                  )}>
                    {icon}
                  </div>
                  
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-bold text-white tracking-tight leading-tight">
                      {span.operation}
                    </span>
                    <span className={cn(
                      "text-[10px] font-mono font-bold mt-0.5",
                      hasError ? "text-red-400" : "text-cyan-400/70"
                    )}>
                      {formatDuration(span.durationMs)}
                    </span>
                  </div>
                </div>

                {/* Extended info shown if node is wide enough */}
                {pos.width > 500 && (
                  <div className="px-5 pb-4 grid grid-cols-2 gap-6 border-t border-white/5 pt-3 mt-auto">
                    <div className="space-y-2">
                      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Metadata</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(span.tags).slice(0, 2).map(([k, v]) => (
                          <div key={k} className="px-2 py-1 rounded bg-white/5 border border-white/5 text-[10px] font-mono text-slate-300">
                            <span className="text-cyan-500/50 mr-1">{k}:</span>{v}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Temporal</p>
                      <p className="text-[10px] font-mono text-slate-400">
                        Offset: {formatDuration(new Date(span.startTimeUtc).getTime() - traceStart)}
                      </p>
                    </div>
                  </div>
                )}

                {hasError && (
                  <div className="absolute top-3 right-3 animate-pulse">
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
            left: Math.min(hoverPos.x + 20, viewportWidth - 340), 
            top: hoverPos.y + 20 
          }}
        >
          <NodeHoverCard span={hoveredSpan} />
        </div>
      )}

      {/* Context Menu Overlay */}
      {contextMenu && (
        <div 
          className="fixed z-50 w-64 bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl py-2 animate-in fade-in zoom-in-95 duration-150"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2 border-b border-white/5 mb-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Navigation</p>
          </div>
          
          {parentOfContext && (
            <button 
              onClick={() => jumpToNode(parentOfContext.spanId)}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-300 transition flex items-center gap-3"
            >
              <GitBranch className="size-4 rotate-180" />
              <span className="truncate">Jump to Parent: {parentOfContext.operation}</span>
            </button>
          )}

          {childrenOfContext.length > 0 && childrenOfContext.map(child => (
            <button 
              key={child.spanId}
              onClick={() => jumpToNode(child.spanId)}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-300 transition flex items-center gap-3"
            >
              <GitBranch className="size-4" />
              <span className="truncate">Jump to Child: {child.operation}</span>
            </button>
          ))}

          {childrenOfContext.length === 0 && !parentOfContext && (
            <div className="px-4 py-3 text-xs text-slate-500 italic">
              No connected activities
            </div>
          )}
        </div>
      )}

      {/* Minimap/Timeline at bottom */}
      <div 
        className="absolute bottom-10 inset-x-12 h-16 bg-slate-950/80 backdrop-blur-2xl rounded-2xl border border-white/10 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] cursor-pointer"
        onClick={handleMinimapClick}
      >
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
                <React.Fragment key={`mini-group-${span.spanId}`}>
                  {/* Start Pin */}
                  <div 
                    className="absolute top-[-4px] bottom-[-4px] w-px bg-white/20 z-0"
                    style={{ left: `${left}%` }}
                  />
                  {/* Activity Bar */}
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
                </React.Fragment>
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
