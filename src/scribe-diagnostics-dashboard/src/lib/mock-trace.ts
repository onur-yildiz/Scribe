export type TraceNode = {
  id: string;
  service: string;
  operation: string;
  durationMs: number;
  startOffsetMs: number;
  lane: number;
  depth: number;
  status: "ok" | "error";
  parentId?: string;
  tags: Record<string, string | number | boolean>;
};

export const traceSummary = {
  name: "POST /checkout",
  traceId: "8a3c7b91d2e5f192f",
  totalDurationMs: 1240,
  statusCode: 500,
};

export const traceNodes: TraceNode[] = [
  {
    id: "root",
    service: "api-gateway",
    operation: "POST /checkout",
    durationMs: 1240,
    startOffsetMs: 0,
    lane: 0,
    depth: 1,
    status: "ok",
    tags: { "http.method": "POST", region: "eu-west" },
  },
  {
    id: "auth",
    parentId: "root",
    service: "auth-svc",
    operation: "verify-token",
    durationMs: 45,
    startOffsetMs: 200,
    lane: 1,
    depth: 2,
    status: "ok",
    tags: { "http.status_code": 200, cache: "miss" },
  },
  {
    id: "payment",
    parentId: "root",
    service: "payment-svc",
    operation: "charge_card",
    durationMs: 800,
    startOffsetMs: 360,
    lane: 2,
    depth: 3,
    status: "error",
    tags: { "http.status_code": 500, "peer.ipv4": "10.0.42.12" },
  },
  {
    id: "db",
    parentId: "auth",
    service: "postgres",
    operation: "UPDATE users",
    durationMs: 12,
    startOffsetMs: 420,
    lane: 3,
    depth: 3,
    status: "ok",
    tags: { table: "users", statement: "UPDATE" },
  },
  {
    id: "stripe",
    parentId: "payment",
    service: "stripe-api",
    operation: "POST /v1/charges",
    durationMs: 240,
    startOffsetMs: 560,
    lane: 4,
    depth: 4,
    status: "ok",
    tags: { provider: "stripe", retries: 2 },
  },
];

export const payloadDump = {
  status: "success",
  metadata: {
    request_id: "req_98234-az-09",
    is_cached: false,
    retries: 0,
  },
  data: [
    { sku: "PRO-SUBSCRIPTION-1Y", qty: 1, amount: 99.5, discount_applied: false },
    { sku: "TAX-CA", qty: 1, amount: 7.96, discount_applied: false },
  ],
  user_profile: {
    id: 4209,
    is_active: true,
    preferences: { currency: "USD", locale: "en-US", notifications: true },
  },
};
