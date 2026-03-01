// Seed script for mongosh.
// Select the target database before loading this file, for example:
//   use ScribeDiagnostics
//   load("activity-seed.js")
//
// Optional override:
//   var seedDbName = "ScribeDiagnostics";
//   load("activity-seed.js")
//
// Note: Duration is stored as ticks (100ns) to match the .NET TimeSpan serializer.

const databaseName =
  typeof seedDbName === "string" && seedDbName ? seedDbName : db.getName();
const database = db.getSiblingDB(databaseName);
const collection = database.getCollection("ScribeActivities");

function ticksFromMilliseconds(milliseconds) {
  return NumberLong(String(milliseconds * 10000));
}

function utc(base, offsetMilliseconds) {
  return new Date(base.getTime() + offsetMilliseconds);
}

function activity(options) {
  return {
    _id: ObjectId(),
    TraceId: options.traceId,
    SpanId: options.spanId,
    ParentSpanId: options.parentSpanId || null,
    OperationName: options.operationName,
    StartTimeUtc: utc(options.baseTime, options.startOffsetMs),
    Duration: ticksFromMilliseconds(options.durationMs),
    Status: options.status || "Ok",
    Tags: options.tags || {},
    Baggage: options.baggage || {},
    Dump: options.dump || {},
    Exceptions: options.exceptions || [],
    Events: options.events || []
  };
}

function eventRecord(baseTime, offsetMilliseconds, name, tags) {
  return {
    Timestamp: utc(baseTime, offsetMilliseconds),
    Name: name,
    Tags: tags || {}
  };
}

const checkoutBase = ISODate("2026-02-21T14:32:10.000Z");
const inviteBase = ISODate("2026-02-21T16:05:42.000Z");

const traces = [
  {
    traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
    spans: [
      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "b9a6d3e4c5f61728",
        parentSpanId: null,
        operationName: "checkout.submit",
        baseTime: checkoutBase,
        startOffsetMs: 0,
        durationMs: 1850,
        status: "Ok",
        tags: {
          "service.name": "storefront-web",
          "app.name": "shop-ui",
          "app.domain": "commerce.web",
          "http.method": "POST",
          "http.route": "/checkout",
          "http.host": "shop.acme.test",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-retail",
          region: "us-east-1",
          sessionId: "sess_8f12bc91",
          customerId: "cust_100045"
        },
        dump: {
          request: {
            cartId: "cart_2048",
            couponCode: "SPRING25",
            currency: "USD",
            itemCount: 3
          },
          cartLines: [
            { sku: "sku_keyboard_01", quantity: 1, unitPrice: 89.99 },
            { sku: "sku_wristrest_02", quantity: 1, unitPrice: 24.99 },
            { sku: "sku_support_03", quantity: 1, unitPrice: 14.99 }
          ],
          validationSteps: [
            "cart-loaded",
            "inventory-verified",
            "shipping-quoted"
          ],
          totals: {
            subtotal: 129.97,
            tax: 10.4,
            shipping: 0,
            grandTotal: 140.37
          }
        },
        events: [
          eventRecord(checkoutBase, 6, "ui.validation.completed", {
            stepCount: 3,
            hasBlockingIssues: false
          }),
          eventRecord(checkoutBase, 12, "ui.submit.dispatched", {
            channel: "web"
          })
        ]
      }),
      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "1fa2b3c4d5e6f701",
        parentSpanId: "b9a6d3e4c5f61728",
        operationName: "POST /api/checkout",
        baseTime: checkoutBase,
        startOffsetMs: 18,
        durationMs: 1760,
        status: "Ok",
        tags: {
          "service.name": "edge-gateway",
          "app.name": "public-api",
          "app.domain": "commerce.api",
          "http.method": "POST",
          "http.route": "/api/checkout",
          "net.peer.ip": "10.4.2.18",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-retail",
          region: "us-east-1",
          requestId: "req_01_checkout"
        },
        events: [
          eventRecord(checkoutBase, 22, "gateway.request.forwarded", {
            upstream: "orders-api",
            protocol: "http"
          }),
          eventRecord(checkoutBase, 1768, "gateway.response.completed", {
            statusCode: 200
          })
        ]
      }),
      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "2ab3cd4ef5a60718",
        parentSpanId: "1fa2b3c4d5e6f701",
        operationName: "identity.session.resolve",
        baseTime: checkoutBase,
        startOffsetMs: 40,
        durationMs: 72,
        status: "Ok",
        tags: {
          "service.name": "identity-api",
          "app.name": "auth-core",
          "app.domain": "identity",
          "http.route": "/sessions/resolve",
          "peer.service": "redis-session-cache",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-retail",
          customerId: "cust_100045"
        },
        dump: {
          session: {
            authenticated: true,
            mfaSatisfied: true,
            authMethod: "passwordless"
          }
        }
      }),
      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "3bc4de5fa6071829",
        parentSpanId: "1fa2b3c4d5e6f701",
        operationName: "pricing.quote.calculate",
        baseTime: checkoutBase,
        startOffsetMs: 125,
        durationMs: 210,
        status: "Warn",
        tags: {
          "service.name": "pricing-engine",
          "app.name": "pricing-core",
          "app.domain": "commerce.pricing",
          "cache.status": "miss",
          "peer.service": "catalog-cache",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-retail",
          quoteId: "quote_7781"
        },
        dump: {
          cache: {
            tier: "redis",
            hit: false
          },
          candidateRules: [
            "seasonal-spring",
            "vip-tier-silver",
            "free-shipping-threshold"
          ],
          lineItems: [
            { sku: "sku_keyboard_01", discountedPrice: 79.99 },
            { sku: "sku_wristrest_02", discountedPrice: 24.99 },
            { sku: "sku_support_03", discountedPrice: 14.99 }
          ],
          inputs: {
            zipCode: "10001",
            country: "US",
            itemCount: 3
          }
        },
        events: [
          eventRecord(checkoutBase, 138, "cache.lookup.completed", {
            cacheHit: false,
            latencyMs: 9
          }),
          eventRecord(checkoutBase, 305, "pricing.rules.applied", {
            appliedCount: 2
          })
        ]
      }),
      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "4cd5ef60718293aa",
        parentSpanId: "1fa2b3c4d5e6f701",
        operationName: "order.write",
        baseTime: checkoutBase,
        startOffsetMs: 390,
        durationMs: 940,
        status: "Ok",
        tags: {
          "service.name": "orders-api",
          "app.name": "orders-core",
          "app.domain": "commerce.orders",
          "db.system": "mongodb",
          "db.name": "orders_test",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-retail",
          orderId: "ord_900021"
        },
        dump: {
          order: {
            orderId: "ord_900021",
            source: "web",
            paymentMethod: "card"
          },
          reservedInventory: [
            { sku: "sku_keyboard_01", warehouse: "ewr-1", quantity: 1 },
            { sku: "sku_wristrest_02", warehouse: "ewr-1", quantity: 1 },
            { sku: "sku_support_03", warehouse: "dfw-2", quantity: 1 }
          ]
        }
      }),
      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "5de6f718293a4bb1",
        parentSpanId: "4cd5ef60718293aa",
        operationName: "payment.authorize",
        baseTime: checkoutBase,
        startOffsetMs: 520,
        durationMs: 560,
        status: "Ok",
        tags: {
          "service.name": "payments-api",
          "app.name": "billing-core",
          "app.domain": "commerce.payments",
          "payment.provider": "stripe",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-retail",
          orderId: "ord_900021",
          paymentIntentId: "pi_001_test_checkout"
        },
        dump: {
          authorization: {
            amount: 140.37,
            currency: "USD",
            captureMode: "automatic"
          },
          fraudChecks: [
            { name: "avs", result: "pass" },
            { name: "cvc", result: "pass" },
            { name: "device-fingerprint", result: "pass" }
          ]
        },
        events: [
          eventRecord(checkoutBase, 548, "payment.risk.evaluated", {
            score: 12,
            action: "allow"
          }),
          eventRecord(checkoutBase, 1048, "payment.authorization.received", {
            approved: true
          })
        ]
      }),
      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "6ef718293a4bc5c2",
        parentSpanId: "5de6f718293a4bb1",
        operationName: "stripe.charge.create",
        baseTime: checkoutBase,
        startOffsetMs: 590,
        durationMs: 305,
        status: "Ok",
        tags: {
          "service.name": "stripe-adapter",
          "app.name": "external-connectors",
          "app.domain": "commerce.integrations",
          "http.method": "POST",
          "http.host": "api.stripe.test",
          "peer.service": "stripe",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-retail",
          orderId: "ord_900021",
          providerTraceId: "stripe_req_4471"
        },
        dump: {
          providerResponse: {
            chargeId: "ch_test_2048",
            approved: true,
            riskLevel: "normal"
          },
          responseChecks: [
            "idempotency-key-validated",
            "provider-signature-verified"
          ]
        },
        events: [
          eventRecord(checkoutBase, 602, "provider.request.sent", {
            provider: "stripe"
          }),
          eventRecord(checkoutBase, 884, "provider.response.received", {
            provider: "stripe",
            statusCode: 200
          })
        ]
      }),
      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "7f18293a4bc5d6d3",
        parentSpanId: "4cd5ef60718293aa",
        operationName: "email.receipt.enqueue",
        baseTime: checkoutBase,
        startOffsetMs: 1180,
        durationMs: 95,
        status: "Ok",
        tags: {
          "service.name": "notifications-worker",
          "app.name": "customer-messaging",
          "app.domain": "commerce.notifications",
          "messaging.system": "rabbitmq",
          "messaging.destination.name": "receipt-email",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-retail",
          orderId: "ord_900021"
        },
        dump: {
          message: {
            template: "order-receipt",
            channel: "email",
            recipient: "qa-buyer@acme.test"
          },
          recipients: [
            "qa-buyer@acme.test"
          ]
        }
      })
    ]
  },
  {
    traceId: "9a2d0f4b6c7e8d1091aa22bb33cc44dd",
    spans: [
      activity({
        traceId: "9a2d0f4b6c7e8d1091aa22bb33cc44dd",
        spanId: "8a91b2c3d4e5f601",
        parentSpanId: null,
        operationName: "workspace.invite.accept",
        baseTime: inviteBase,
        startOffsetMs: 0,
        durationMs: 1320,
        status: "Error",
        tags: {
          "service.name": "admin-portal",
          "app.name": "workspace-console",
          "app.domain": "b2b.admin",
          "http.method": "POST",
          "http.route": "/invites/accept",
          "http.host": "admin.acme.test",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-b2b",
          workspaceId: "ws_4401",
          inviteId: "inv_1099",
          userId: "usr_991"
        },
        dump: {
          request: {
            inviteToken: "masked_invite_token",
            acceptedFromIp: "192.168.10.25"
          },
          acceptedScopes: [
            "workspace.read",
            "workspace.write",
            "reports.view"
          ]
        },
        events: [
          eventRecord(inviteBase, 4, "invite.token.validated", {
            tokenState: "valid"
          }),
          eventRecord(inviteBase, 11, "invite.acceptance.started", {
            workspaceId: "ws_4401"
          })
        ]
      }),
      activity({
        traceId: "9a2d0f4b6c7e8d1091aa22bb33cc44dd",
        spanId: "9b02c3d4e5f61712",
        parentSpanId: "8a91b2c3d4e5f601",
        operationName: "POST /api/workspaces/invite/accept",
        baseTime: inviteBase,
        startOffsetMs: 14,
        durationMs: 1270,
        status: "Error",
        tags: {
          "service.name": "edge-gateway",
          "app.name": "public-api",
          "app.domain": "b2b.api",
          "http.method": "POST",
          "http.route": "/api/workspaces/invite/accept",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-b2b",
          requestId: "req_02_invite_accept"
        }
      }),
      activity({
        traceId: "9a2d0f4b6c7e8d1091aa22bb33cc44dd",
        spanId: "ac13d4e5f6172833",
        parentSpanId: "9b02c3d4e5f61712",
        operationName: "accounts.membership.activate",
        baseTime: inviteBase,
        startOffsetMs: 55,
        durationMs: 340,
        status: "Ok",
        tags: {
          "service.name": "accounts-api",
          "app.name": "accounts-core",
          "app.domain": "b2b.accounts",
          "db.system": "mongodb",
          "db.name": "accounts_test",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-b2b",
          workspaceId: "ws_4401",
          membershipId: "m_7831"
        },
        dump: {
          membership: {
            role: "Analyst",
            status: "Active"
          },
          grantedPermissions: [
            "dashboards.view",
            "exports.run",
            "reports.share"
          ]
        }
      }),
      activity({
        traceId: "9a2d0f4b6c7e8d1091aa22bb33cc44dd",
        spanId: "bd24e5f617283944",
        parentSpanId: "9b02c3d4e5f61712",
        operationName: "crm.contact.upsert",
        baseTime: inviteBase,
        startOffsetMs: 420,
        durationMs: 780,
        status: "Error",
        tags: {
          "service.name": "crm-sync",
          "app.name": "crm-bridge",
          "app.domain": "b2b.integrations",
          "peer.service": "salesforce-adapter",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-b2b",
          workspaceId: "ws_4401",
          crmContactId: "crm_5542"
        },
        dump: {
          syncAttempt: {
            provider: "salesforce",
            retryCount: 2,
            lastBackoffMs: 400
          },
          retryScheduleMs: [
            100,
            250,
            400
          ]
        },
        exceptions: [
          {
            Type: "System.TimeoutException",
            Message: "CRM sync timed out after waiting for the provider response window.",
            StackTrace: "at CrmSyncService.UpsertContact()\nat InviteAcceptanceWorkflow.Run()",
            Data: {
              provider: "salesforce",
              timeoutMs: 3000,
              retryable: true
            }
          }
        ],
        events: [
          eventRecord(inviteBase, 455, "crm.retry.scheduled", {
            retryNumber: 3,
            backoffMs: 400
          }),
          eventRecord(inviteBase, 1188, "crm.sync.failed", {
            failureType: "timeout"
          })
        ]
      }),
      activity({
        traceId: "9a2d0f4b6c7e8d1091aa22bb33cc44dd",
        spanId: "ce35f61728394a55",
        parentSpanId: "bd24e5f617283944",
        operationName: "salesforce.contacts.patch",
        baseTime: inviteBase,
        startOffsetMs: 470,
        durationMs: 610,
        status: "Error",
        tags: {
          "service.name": "salesforce-adapter",
          "app.name": "external-connectors",
          "app.domain": "b2b.integrations",
          "http.method": "PATCH",
          "http.host": "api.salesforce.test",
          "http.status_code": "429",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-b2b",
          workspaceId: "ws_4401",
          providerTraceId: "sf_req_88231"
        },
        dump: {
          providerResponse: {
            statusCode: 429,
            errorCode: "REQUEST_LIMIT_EXCEEDED",
            requestId: "sf_req_88231"
          },
          rateLimitWindows: [
            { bucket: "minute", remaining: 0 },
            { bucket: "hour", remaining: 12 }
          ]
        },
        exceptions: [
          {
            Type: "System.InvalidOperationException",
            Message: "Salesforce rate limit exceeded while updating the contact record.",
            StackTrace: "at SalesforceClient.PatchContact()\nat CrmConnector.Upsert()",
            Data: {
              statusCode: 429,
              provider: "salesforce",
              requestId: "sf_req_88231"
            }
          }
        ],
        events: [
          eventRecord(inviteBase, 492, "provider.rate_limit.hit", {
            statusCode: 429,
            retryable: true
          })
        ]
      }),
      activity({
        traceId: "9a2d0f4b6c7e8d1091aa22bb33cc44dd",
        spanId: "df461728394a5b66",
        parentSpanId: "9b02c3d4e5f61712",
        operationName: "audit.activity.append",
        baseTime: inviteBase,
        startOffsetMs: 1110,
        durationMs: 88,
        status: "Ok",
        tags: {
          "service.name": "audit-log",
          "app.name": "compliance-events",
          "app.domain": "b2b.audit",
          "db.system": "mongodb",
          "db.name": "audit_test",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-b2b",
          workspaceId: "ws_4401"
        },
        dump: {
          auditRecord: {
            action: "InviteAccepted",
            actorId: "usr_991",
            persisted: true
          },
          tagsSnapshot: [
            "invite",
            "workspace",
            "membership"
          ]
        },
        events: [
          eventRecord(inviteBase, 1174, "audit.document.inserted", {
            collection: "workspace_audit"
          })
        ]
      })
    ]
  }
];

const traceIds = traces.map(function (trace) {
  return trace.traceId;
});

const records = traces.reduce(function (all, trace) {
  return all.concat(trace.spans);
}, []);

const deleteResult = collection.deleteMany({
  TraceId: { $in: traceIds }
});

const insertResult = collection.insertMany(records, { ordered: true });
const insertedCount = Object.keys(insertResult.insertedIds).length;

print("Seeded ScribeActivities");
print("Database: " + database.getName());
print("Removed existing records: " + deleteResult.deletedCount);
print("Inserted records: " + insertedCount);
print("TraceIds: " + traceIds.join(", "));
