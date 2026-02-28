"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Copy, Filter, Network, Tag } from "lucide-react";

import { PayloadRenderer } from "@/components/payload-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { payloadDump, traceNodes, traceSummary } from "@/lib/mock-trace";

const laneHeight = 64;

export default function Home() {
  const [selectedNodeId, setSelectedNodeId] = useState("payment");

  const selectedNode = useMemo(
    () => traceNodes.find((node) => node.id === selectedNodeId) ?? traceNodes[0],
    [selectedNodeId],
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <Tabs defaultValue="explorer" className="mx-auto w-full max-w-[1400px]">
        <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/95 px-3 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold sm:text-xl">Scribe Dashboard</p>
              <p className="truncate font-mono text-xs text-slate-400">Trace ID: {traceSummary.traceId}</p>
            </div>
            <TabsList className="bg-slate-900/80">
              <TabsTrigger value="explorer">Explorer</TabsTrigger>
              <TabsTrigger value="payload">Payload</TabsTrigger>
            </TabsList>
          </div>
        </header>

        <TabsContent value="explorer" className="m-0">
          <section className="grid min-h-[calc(100vh-74px)] grid-cols-1 lg:grid-cols-[1fr_360px]">
            <div className="relative overflow-hidden border-r border-slate-800">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2f47_1px,transparent_1px),linear-gradient(to_bottom,#1f2f47_1px,transparent_1px)] bg-[size:100px_40px] opacity-70" />

              <div className="relative z-10 border-b border-slate-800 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h1 className="text-lg font-semibold">{traceSummary.name}</h1>
                    <p className="font-mono text-xs text-slate-400">Trace ID: {traceSummary.traceId.slice(0, 8)}...{traceSummary.traceId.slice(-4)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xl font-semibold">{(traceSummary.totalDurationMs / 1000).toFixed(2)}s</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Total Duration</p>
                  </div>
                </div>
              </div>

              <ScrollArea className="relative z-10 h-[420px] sm:h-[520px] lg:h-[calc(100vh-250px)]">
                <div className="relative min-w-[920px] px-4 pb-8 pt-8">
                  {traceNodes.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`absolute flex h-12 min-w-52 items-center gap-3 rounded-md border px-2 text-left transition ${
                        selectedNode.id === node.id
                          ? "border-cyan-400 bg-slate-800 shadow-[0_0_24px_rgba(34,211,238,0.25)]"
                          : "border-slate-700 bg-slate-900/90 hover:border-cyan-500/70"
                      }`}
                      style={{
                        left: `${node.startOffsetMs + 30}px`,
                        top: `${node.lane * laneHeight + 10}px`,
                      }}
                    >
                      <div className={`h-8 w-1 rounded-full ${node.status === "error" ? "bg-red-500" : "bg-emerald-500"}`} />
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[11px] text-slate-400">{node.service}</p>
                        <p className="truncate text-sm font-medium">{node.operation}</p>
                      </div>
                      <p className={`ml-auto text-xs font-mono ${node.status === "error" ? "text-red-400" : "text-slate-200"}`}>
                        {node.durationMs}ms
                      </p>
                    </button>
                  ))}
                </div>
              </ScrollArea>

              <div className="relative z-10 border-t border-slate-800 bg-slate-900/80 px-4 py-3">
                <div className="mb-2 flex justify-between font-mono text-xs text-slate-400">
                  <span>0ms</span>
                  <span>{traceSummary.totalDurationMs}ms</span>
                </div>
                <div className="h-3 rounded-full bg-slate-800">
                  <div className="h-3 w-1/3 rounded-full bg-cyan-500/70" />
                </div>
              </div>

              <Drawer>
                <DrawerTrigger asChild>
                  <Button className="absolute bottom-5 right-4 z-20 lg:hidden" size="sm">
                    <Filter className="mr-1 size-4" /> Details
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="border-slate-700 bg-slate-900 text-slate-100">
                  <NodeDetails node={selectedNode} />
                </DrawerContent>
              </Drawer>
            </div>

            <aside className="hidden border-l border-slate-800 bg-slate-900/50 lg:block">
              <NodeDetails node={selectedNode} />
            </aside>
          </section>
        </TabsContent>

        <TabsContent value="payload" className="m-0 border-t border-slate-800">
          <section className="grid min-h-[calc(100vh-74px)] grid-cols-1 lg:grid-cols-[250px_1fr]">
            <aside className="border-r border-slate-800 bg-slate-900/40 p-4">
              <p className="mb-4 text-xs uppercase tracking-widest text-slate-400">Structure</p>
              <div className="space-y-2 font-mono text-sm text-slate-300">
                <p className="rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-2">root</p>
                <p className="px-2">metadata</p>
                <p className="px-2">data []</p>
                <p className="px-2">user_profile</p>
              </div>
            </aside>

            <div className="p-4 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300">200 OK</Badge>
                  <span className="font-mono text-sm text-slate-400">Time: 142ms</span>
                </div>
                <Button variant="outline" className="border-slate-700 bg-slate-900 text-slate-100">
                  <Copy className="mr-2 size-4" /> Copy JSON
                </Button>
              </div>

              <Tabs defaultValue="render" className="space-y-4">
                <TabsList className="bg-slate-900">
                  <TabsTrigger value="render">Render</TabsTrigger>
                  <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                </TabsList>
                <TabsContent value="render" className="m-0">
                  <PayloadRenderer data={payloadDump} />
                </TabsContent>
                <TabsContent value="raw" className="m-0">
                  <pre className="overflow-auto rounded-md border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-200">
                    {JSON.stringify(payloadDump, null, 2)}
                  </pre>
                </TabsContent>
              </Tabs>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </main>
  );
}

function NodeDetails({ node }: { node: (typeof traceNodes)[number] }) {
  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xl font-semibold capitalize">{node.service.replace("-", " ")}</p>
          <p className="font-mono text-sm text-slate-400">{node.operation}</p>
        </div>
        <Badge className={node.status === "error" ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}>
          {node.status === "error" ? "FAILED" : "OK"}
        </Badge>
      </div>

      {node.status === "error" && (
        <Card className="border-red-500/30 bg-red-500/10 text-red-100">
          <CardContent className="flex gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 size-4" />
            PaymentGatewayTimeout: upstream request timed out after 5000ms
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-700 bg-slate-900/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-slate-400">Metrics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 font-mono text-sm">
          <Metric label="Duration" value={`${node.durationMs}ms`} />
          <Metric label="Depth" value={`${node.depth}`} />
          <Metric label="Start" value={`${node.startOffsetMs}ms`} />
          <Metric label="Kind" value="Server" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" className="border-slate-700 bg-transparent">
          <Network className="mr-1 size-4" /> Logs
        </Button>
        <Button variant="outline" className="border-slate-700 bg-transparent">
          <Tag className="mr-1 size-4" /> Tags
        </Button>
        <Button variant="outline" className="border-red-500/40 bg-red-500/10 text-red-200">
          <AlertCircle className="mr-1 size-4" /> Stack
        </Button>
      </div>

      <Separator className="bg-slate-800" />

      <div>
        <p className="mb-2 text-xs uppercase tracking-widest text-slate-400">Span attributes</p>
        <div className="rounded border border-slate-800 bg-slate-900/80">
          {Object.entries(node.tags).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-sm last:border-b-0">
              <span className="font-mono text-cyan-400">{key}</span>
              <span className="font-mono text-slate-200">{String(value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/40 p-2">
      <p className="text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-base text-slate-100">{value}</p>
    </div>
  );
}
