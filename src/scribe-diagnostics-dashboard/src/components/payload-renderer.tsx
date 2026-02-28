import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function isObjectArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => item && typeof item === "object" && !Array.isArray(item));
}

function PrimitiveRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[10rem,1fr] gap-3 border-b border-border/60 px-3 py-2 text-sm last:border-b-0">
      <p className="font-mono text-sky-400">{label}</p>
      <p className="font-mono text-slate-200 break-all">{value}</p>
    </div>
  );
}

export function PayloadRenderer({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      {Object.entries(data).map(([key, value]) => {
        if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
          return <PrimitiveRow key={key} label={key} value={formatValue(value)} />;
        }

        if (isObjectArray(value)) {
          const columns = Array.from(new Set(value.flatMap((row) => Object.keys(row))));
          return (
            <section key={key} className="rounded-md border border-border/70 bg-slate-950/30">
              <div className="flex items-center justify-between px-3 py-2">
                <p className="font-mono text-sm text-slate-100">{key}</p>
                <Badge variant="secondary">{value.length} rows</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead key={column}>{column}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {value.map((row, index) => (
                    <TableRow key={index}>
                      {columns.map((column) => (
                        <TableCell key={column} className="font-mono text-xs">
                          {formatValue(row[column])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          );
        }

        return (
          <section key={key} className="rounded-md border border-border/70 bg-slate-950/30 p-3">
            <p className="mb-2 font-mono text-sm text-slate-100">{key}</p>
            <pre className="overflow-x-auto rounded bg-slate-950/70 p-3 font-mono text-xs text-slate-200">
              {JSON.stringify(value, null, 2)}
            </pre>
          </section>
        );
      })}
    </div>
  );
}
