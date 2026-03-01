// Seed script for mongosh.
// Usage:
//   use ScribeDiagnostics
//   load("activity-seed-large.js")
//
// Optional override:
//   var seedDbName = "ScribeDiagnostics";
//   load("activity-seed-large.js")

const databaseName =
  typeof seedDbName === "string" && seedDbName ? seedDbName : db.getName();
const database = db.getSiblingDB(databaseName);
const collection = database.getCollection("ScribeActivities");

function utc(base, offsetMilliseconds) {
  return new Date(base.getTime() + offsetMilliseconds);
}

function stringMap(source) {
  const result = {};
  Object.keys(source || {}).forEach(function (key) {
    result[key] = String(source[key]);
  });
  return result;
}

function numberLongFromBigInt(value) {
  return NumberLong(value.toString());
}

function dotNetTicksFromDate(date) {
  const unixEpochTicks = 621355968000000000n;
  return numberLongFromBigInt(BigInt(date.getTime()) * 10000n + unixEpochTicks);
}

function timeSpanStringFromMilliseconds(milliseconds) {
  const negative = milliseconds < 0;
  const ticks = BigInt(Math.round(Math.abs(milliseconds) * 10000));
  const ticksPerDay = 864000000000n;
  const ticksPerHour = 36000000000n;
  const ticksPerMinute = 600000000n;
  const ticksPerSecond = 10000000n;

  let remaining = ticks;
  const days = remaining / ticksPerDay;
  remaining %= ticksPerDay;

  const hours = remaining / ticksPerHour;
  remaining %= ticksPerHour;

  const minutes = remaining / ticksPerMinute;
  remaining %= ticksPerMinute;

  const seconds = remaining / ticksPerSecond;
  remaining %= ticksPerSecond;

  const fraction = remaining.toString().padStart(7, "0");
  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");

  return (
    (negative ? "-" : "") +
    (days > 0n ? days.toString() + "." : "") +
    hh + ":" + mm + ":" + ss + "." + fraction
  );
}

function dateTimeOffsetUtc(date) {
  return {
    DateTime: new Date(date.getTime()),
    Ticks: dotNetTicksFromDate(date),
    Offset: NumberInt(0)
  };
}

function eventRecord(baseTime, offsetMilliseconds, name, tags) {
  return {
    Timestamp: dateTimeOffsetUtc(utc(baseTime, offsetMilliseconds)),
    Name: name,
    Tags: tags || {}
  };
}

function exceptionRecord(type, message, stackTrace, data) {
  return {
    Type: type,
    Message: message,
    StackTrace: stackTrace || null,
    Data: data || {}
  };
}

function activity(options) {
  return {
    _id: ObjectId(),
    TraceId: options.traceId,
    SpanId: options.spanId,
    ParentSpanId: options.parentSpanId || null,
    OperationName: options.operationName,
    StartTimeUtc: utc(options.baseTime, options.startOffsetMs),
    Duration: timeSpanStringFromMilliseconds(options.durationMs),
    Status: options.status || "Ok",
    Tags: stringMap(options.tags),
    Baggage: stringMap(options.baggage),
    Dump: options.dump || {},
    Exceptions: options.exceptions || [],
    Events: options.events || []
  };
}

const checkoutBase = ISODate("2026-02-21T14:32:10.000Z");
const inviteBase = ISODate("2026-02-21T16:05:42.000Z");
const ingestBase = ISODate("2026-02-22T09:11:03.000Z");
const reportBase = ISODate("2026-02-23T06:30:00.000Z");

const traces = [
  {
    traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
    spans: [
      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "a1e7b31c4d5e6f70",
        operationName: "checkout.submit",
        baseTime: checkoutBase,
        startOffsetMs: 0,
        durationMs: 2340,
        status: "Ok",
        tags: {
          "service.name": "storefront-web",
          "app.name": "shop-ui",
          "app.domain": "commerce.web",
          "http.method": "POST",
          "http.route": "/checkout",
          "http.host": "shop.acme.test",
          "deployment.environment": "test",
          "feature.checkout.v2": "true"
        },
        baggage: {
          tenant: "acme-retail",
          region: "us-east-1",
          sessionId: "sess_8f12bc91",
          customerId: "cust_100045",
          cartId: "cart_2048"
        },
        dump: {
          request: {
            correlation: {
              requestId: "req_01_checkout",
              clientTraceSource: "browser",
              flowId: "flow_checkout_primary",
              replaySafe: true
            },
            route: {
              path: "/checkout",
              locale: "en-US",
              experimentBucket: "exp_checkout_button_blue"
            },
            actor: {
              customerId: "cust_100045",
              authenticated: true,
              loyaltyTier: "silver",
              segment: "returning-buyer"
            },
            paymentIntentPreview: {
              method: "card",
              provider: "stripe",
              captureMode: "automatic",
              installments: 1
            }
          },
          cart: {
            id: "cart_2048",
            currency: "USD",
            couponCode: "SPRING25",
            source: "web",
            summary: {
              itemCount: 3,
              shippableCount: 2,
              digitalCount: 1
            },
            lines: [
              {
                sku: "sku_keyboard_01",
                quantity: 1,
                unitPrice: 89.99,
                catalog: {
                  category: "peripherals",
                  family: "keyboard",
                  attributes: {
                    switchType: "tactile",
                    layout: "ansi",
                    connectivity: ["usb-c", "bluetooth"]
                  }
                }
              },
              {
                sku: "sku_wristrest_02",
                quantity: 1,
                unitPrice: 24.99,
                catalog: {
                  category: "accessories",
                  family: "ergonomics",
                  attributes: {
                    material: "memory-foam",
                    washableCover: true
                  }
                }
              },
              {
                sku: "sku_support_03",
                quantity: 1,
                unitPrice: 14.99,
                catalog: {
                  category: "services",
                  family: "support-plan",
                  attributes: {
                    termMonths: 12,
                    activationWindowDays: 30
                  }
                }
              }
            ]
          },
          diagnostics: {
            browser: {
              name: "Chrome",
              version: "145.0.0.0",
              platform: "Windows",
              viewport: {
                width: 1728,
                height: 1017
              }
            },
            flags: {
              checkoutV2: true,
              stickyPaymentPanel: true,
              addressValidationProvider: "lob-test"
            },
            checkpoints: [
              {
                name: "cart-loaded",
                passed: true,
                details: {
                  source: "cart-api",
                  freshnessMs: 91
                }
              },
              {
                name: "inventory-verified",
                passed: true,
                details: {
                  strategy: "soft-reserve-preview",
                  warehousesChecked: ["ewr-1", "dfw-2"]
                }
              },
              {
                name: "shipping-quoted",
                passed: true,
                details: {
                  quoteProvider: "ship-core",
                  quoteAgeMs: 48
                }
              }
            ]
          },
          totals: {
            subtotal: 129.97,
            discount: 10.0,
            tax: 10.4,
            shipping: 0.0,
            grandTotal: 130.37
          }
        },
        events: [
          eventRecord(checkoutBase, 5, "ui.validation.completed", {
            stepCount: 3,
            hasBlockingIssues: false,
            channel: "web"
          }),
          eventRecord(checkoutBase, 16, "ui.submit.dispatched", {
            payloadBytes: 4812,
            optimisticLockPresent: true
          })
        ]
      }),

      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "a1e7b31c4d5e6f71",
        parentSpanId: "a1e7b31c4d5e6f70",
        operationName: "POST /api/checkout",
        baseTime: checkoutBase,
        startOffsetMs: 18,
        durationMs: 2260,
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
        dump: {
          ingress: {
            remoteIp: "10.4.2.18",
            forwardedFor: ["192.168.10.25"],
            tls: {
              protocol: "TLS1.3",
              cipher: "TLS_AES_256_GCM_SHA384",
              clientCertificatePresented: false
            }
          },
          routing: {
            selectedCluster: "commerce-primary",
            upstreamService: "orders-api",
            policy: {
              timeoutMs: 5000,
              retry: {
                enabled: false,
                reason: "unsafe-non-idempotent"
              },
              circuitBreaker: {
                state: "closed",
                consecutiveFailures: 0
              }
            }
          },
          headersSnapshot: {
            tracked: {
              "x-request-id": "req_01_checkout",
              "x-tenant": "acme-retail",
              "x-region": "us-east-1",
              "user-agent": "shop-ui/2026.2.21"
            },
            redacted: ["authorization", "cookie"]
          }
        },
        events: [
          eventRecord(checkoutBase, 24, "gateway.request.forwarded", {
            upstream: "orders-api",
            queueDepth: 0,
            protocol: "http"
          }),
          eventRecord(checkoutBase, 2274, "gateway.response.completed", {
            statusCode: 200,
            responseBytes: 1786
          })
        ]
      }),

      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "a1e7b31c4d5e6f72",
        parentSpanId: "a1e7b31c4d5e6f71",
        operationName: "identity.session.resolve",
        baseTime: checkoutBase,
        startOffsetMs: 42,
        durationMs: 74,
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
          customerId: "cust_100045",
          sessionId: "sess_8f12bc91"
        },
        dump: {
          session: {
            authenticated: true,
            mfaSatisfied: true,
            authMethod: "passwordless",
            sessionStrength: "high"
          },
          claims: {
            subject: "cust_100045",
            scopes: ["checkout", "profile.read", "orders.read"],
            issuedAtUnix: 1771684250,
            expiresAtUnix: 1771687850
          },
          cache: {
            layer: "redis",
            hit: true,
            key: "sess:sess_8f12bc91",
            valueShape: {
              version: 4,
              envelope: {
                compression: "none",
                encryption: "app-managed"
              }
            }
          }
        }
      }),

      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "a1e7b31c4d5e6f73",
        parentSpanId: "a1e7b31c4d5e6f71",
        operationName: "pricing.quote.calculate",
        baseTime: checkoutBase,
        startOffsetMs: 128,
        durationMs: 310,
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
          quoteId: "quote_7781",
          priceListId: "retail_usd_default"
        },
        dump: {
          cache: {
            tier: "redis",
            hit: false,
            lookup: {
              quoteKey: "quote:cart_2048:price:v3",
              reason: "cart-lines-metadata-changed"
            }
          },
          inputs: {
            geo: {
              country: "US",
              region: "NY",
              zipCode: "10001"
            },
            itemCount: 3,
            customer: {
              loyaltyTier: "silver",
              firstOrder: false,
              riskSegment: "normal"
            }
          },
          rules: {
            candidates: [
              "seasonal-spring",
              "vip-tier-silver",
              "free-shipping-threshold",
              "bundle-keyboard-wristrest"
            ],
            applied: [
              {
                name: "seasonal-spring",
                effect: {
                  type: "percentage",
                  value: 10
                }
              },
              {
                name: "free-shipping-threshold",
                effect: {
                  type: "shipping-flat",
                  value: 0
                }
              }
            ],
            rejected: [
              {
                name: "bundle-keyboard-wristrest",
                reason: "minimum-quantity-not-met"
              }
            ]
          },
          outputs: {
            lines: [
              {
                sku: "sku_keyboard_01",
                basePrice: 89.99,
                discountedPrice: 80.99
              },
              {
                sku: "sku_wristrest_02",
                basePrice: 24.99,
                discountedPrice: 24.99
              },
              {
                sku: "sku_support_03",
                basePrice: 14.99,
                discountedPrice: 14.99
              }
            ],
            summary: {
              preDiscountTotal: 129.97,
              postDiscountTotal: 120.97
            }
          }
        },
        events: [
          eventRecord(checkoutBase, 138, "cache.lookup.completed", {
            cacheHit: false,
            latencyMs: 8
          }),
          eventRecord(checkoutBase, 291, "pricing.rules.applied", {
            appliedCount: 2,
            rejectedCount: 1
          })
        ]
      }),

      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "a1e7b31c4d5e6f74",
        parentSpanId: "a1e7b31c4d5e6f73",
        operationName: "promotions.evaluate",
        baseTime: checkoutBase,
        startOffsetMs: 170,
        durationMs: 118,
        status: "Ok",
        tags: {
          "service.name": "pricing-engine",
          "app.name": "promotions-module",
          "app.domain": "commerce.pricing",
          "deployment.environment": "test",
          "rule.source": "promotion-registry"
        },
        baggage: {
          tenant: "acme-retail",
          quoteId: "quote_7781",
          campaignId: "campaign_spring_2026"
        },
        dump: {
          registrySnapshot: {
            version: "2026.02.21.3",
            publishedBy: "pricing-ops",
            activeCampaigns: 17
          },
          evaluationTree: {
            root: {
              node: "and",
              children: [
                { node: "market", operator: "equals", value: "US" },
                { node: "date-window", operator: "contains", value: "2026-02-21" },
                {
                  node: "cart-threshold",
                  operator: "gte",
                  value: 100
                }
              ]
            }
          },
          matchedCampaigns: [
            {
              id: "campaign_spring_2026",
              code: "SPRING25",
              effect: {
                type: "percentage",
                value: 10
              }
            }
          ]
        }
      }),

      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "a1e7b31c4d5e6f75",
        parentSpanId: "a1e7b31c4d5e6f71",
        operationName: "inventory.reserve",
        baseTime: checkoutBase,
        startOffsetMs: 412,
        durationMs: 264,
        status: "Ok",
        tags: {
          "service.name": "inventory-api",
          "app.name": "fulfillment-core",
          "app.domain": "commerce.inventory",
          "db.system": "mongodb",
          "db.name": "inventory_test",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-retail",
          reservationId: "res_44127",
          warehouseStrategy: "best-available"
        },
        dump: {
          planner: {
            strategy: "best-available",
            allowSplitShipment: true,
            preferenceOrder: ["ewr-1", "ord-1", "dfw-2"]
          },
          candidates: [
            {
              sku: "sku_keyboard_01",
              sources: [
                { warehouse: "ewr-1", available: 12 },
                { warehouse: "dfw-2", available: 7 }
              ]
            },
            {
              sku: "sku_wristrest_02",
              sources: [
                { warehouse: "ewr-1", available: 33 }
              ]
            }
          ],
          decision: {
            reservationId: "res_44127",
            lines: [
              { sku: "sku_keyboard_01", warehouse: "ewr-1", reserved: 1 },
              { sku: "sku_wristrest_02", warehouse: "ewr-1", reserved: 1 }
            ],
            skipped: [
              {
                sku: "sku_support_03",
                reason: "non-physical-item"
              }
            ]
          }
        },
        events: [
          eventRecord(checkoutBase, 468, "inventory.lock.acquired", {
            shard: "inventory-02",
            lockWaitMs: 3
          }),
          eventRecord(checkoutBase, 648, "inventory.reservation.created", {
            reservedLineCount: 2,
            skippedLineCount: 1
          })
        ]
      }),

      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "a1e7b31c4d5e6f76",
        parentSpanId: "a1e7b31c4d5e6f71",
        operationName: "order.write",
        baseTime: checkoutBase,
        startOffsetMs: 700,
        durationMs: 980,
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
          orderId: "ord_900021",
          reservationId: "res_44127"
        },
        dump: {
          order: {
            orderId: "ord_900021",
            source: "web",
            state: "PendingPayment",
            fulfillmentMode: "ship",
            buyer: {
              customerId: "cust_100045",
              email: "qa-buyer@acme.test"
            }
          },
          persistence: {
            collection: "orders",
            writeConcern: {
              w: "majority",
              journal: true,
              wtimeoutMs: 0
            },
            documentShape: {
              version: 9,
              sections: [
                "header",
                "buyer",
                "lines",
                "pricing",
                "fulfillment",
                "audit"
              ]
            }
          },
          materializedDocument: {
            header: {
              tenant: "acme-retail",
              region: "us-east-1"
            },
            lines: [
              {
                sku: "sku_keyboard_01",
                quantity: 1,
                price: 80.99,
                fulfillment: {
                  warehouse: "ewr-1",
                  reserveId: "res_44127"
                }
              },
              {
                sku: "sku_wristrest_02",
                quantity: 1,
                price: 24.99,
                fulfillment: {
                  warehouse: "ewr-1",
                  reserveId: "res_44127"
                }
              },
              {
                sku: "sku_support_03",
                quantity: 1,
                price: 14.99,
                fulfillment: {
                  activation: "deferred-digital"
                }
              }
            ],
            totals: {
              subtotal: 120.97,
              tax: 9.4,
              shipping: 0,
              grandTotal: 130.37
            }
          }
        }
      }),

      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "a1e7b31c4d5e6f77",
        parentSpanId: "a1e7b31c4d5e6f76",
        operationName: "payment.authorize",
        baseTime: checkoutBase,
        startOffsetMs: 840,
        durationMs: 602,
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
            amount: 130.37,
            currency: "USD",
            captureMode: "automatic",
            statementDescriptor: "ACME TEST STORE"
          },
          fraud: {
            checks: [
              { name: "avs", result: "pass" },
              { name: "cvc", result: "pass" },
              { name: "device-fingerprint", result: "pass" }
            ],
            model: {
              version: "risk-2026-02",
              score: 12,
              disposition: "allow",
              topSignals: [
                "known-device",
                "returning-customer",
                "low-charge-velocity"
              ]
            }
          },
          idempotency: {
            key: "pay_ord_900021_v1",
            firstSeenUtc: ISODate("2026-02-21T14:32:10.840Z")
          }
        },
        events: [
          eventRecord(checkoutBase, 910, "payment.risk.evaluated", {
            score: 12,
            action: "allow",
            manualReview: false
          }),
          eventRecord(checkoutBase, 1400, "payment.authorization.received", {
            approved: true,
            responseCode: "00"
          })
        ]
      }),

      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "a1e7b31c4d5e6f78",
        parentSpanId: "a1e7b31c4d5e6f77",
        operationName: "stripe.charge.create",
        baseTime: checkoutBase,
        startOffsetMs: 932,
        durationMs: 338,
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
          request: {
            endpoint: "/v1/payment_intents/pi_001_test_checkout/confirm",
            headers: {
              idempotencyKey: "pay_ord_900021_v1",
              stripeAccount: "acct_test_001"
            },
            payload: {
              amountMinor: 13037,
              currency: "usd",
              confirmationMethod: "automatic"
            }
          },
          providerResponse: {
            chargeId: "ch_test_2048",
            approved: true,
            status: "succeeded",
            network: {
              brand: "visa",
              last4: "4242"
            }
          },
          responseChecks: [
            "idempotency-key-validated",
            "provider-signature-verified",
            "amount-matches-order-total"
          ]
        },
        events: [
          eventRecord(checkoutBase, 948, "provider.request.sent", {
            provider: "stripe",
            payloadBytes: 742
          }),
          eventRecord(checkoutBase, 1252, "provider.response.received", {
            provider: "stripe",
            statusCode: 200
          })
        ]
      }),

      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "a1e7b31c4d5e6f79",
        parentSpanId: "a1e7b31c4d5e6f76",
        operationName: "ledger.entry.append",
        baseTime: checkoutBase,
        startOffsetMs: 1468,
        durationMs: 122,
        status: "Ok",
        tags: {
          "service.name": "ledger-service",
          "app.name": "finance-core",
          "app.domain": "commerce.finance",
          "db.system": "mongodb",
          "db.name": "ledger_test",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-retail",
          orderId: "ord_900021",
          ledgerBatchId: "batch_20260221_1432_01"
        },
        dump: {
          batch: {
            id: "batch_20260221_1432_01",
            mode: "append-only",
            partitionKey: "2026-02-21"
          },
          entries: [
            {
              side: "debit",
              account: "AccountsReceivable",
              amount: 130.37,
              currency: "USD"
            },
            {
              side: "credit",
              account: "DeferredRevenue",
              amount: 130.37,
              currency: "USD"
            }
          ]
        }
      }),

      activity({
        traceId: "7c14be3f1d7f4fa4a8fd9c3b2a71ee01",
        spanId: "a1e7b31c4d5e6f7a",
        parentSpanId: "a1e7b31c4d5e6f76",
        operationName: "email.receipt.enqueue",
        baseTime: checkoutBase,
        startOffsetMs: 1675,
        durationMs: 108,
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
            recipient: "qa-buyer@acme.test",
            locale: "en-US"
          },
          contentModel: {
            sections: ["summary", "line-items", "payment", "support"],
            preview: {
              subject: "Your ACME order ord_900021",
              personalizationKeys: ["firstName", "orderId", "grandTotal"]
            }
          }
        },
        events: [
          eventRecord(checkoutBase, 1710, "notification.message.published", {
            exchange: "customer-events",
            routeKey: "email.receipt"
          })
        ]
      })
    ]
  },

  {
    traceId: "9a2d0f4b6c7e8d1091aa22bb33cc44dd",
    spans: [
      activity({
        traceId: "9a2d0f4b6c7e8d1091aa22bb33cc44dd",
        spanId: "b2f8c42d5e6f7081",
        operationName: "workspace.invite.accept",
        baseTime: inviteBase,
        startOffsetMs: 0,
        durationMs: 1540,
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
            acceptedFromIp: "192.168.10.25",
            userAgent: "workspace-console/2026.2.21",
            acceptedScopes: [
              "workspace.read",
              "workspace.write",
              "reports.view"
            ]
          },
          workspace: {
            id: "ws_4401",
            name: "Acme Growth Ops",
            billingPlan: "enterprise-test",
            settings: {
              ssoRequired: false,
              dataResidency: "us",
              crmSyncEnabled: true
            }
          },
          orchestration: {
            steps: [
              "token-validate",
              "membership-activate",
              "policy-evaluate",
              "crm-upsert",
              "audit-append",
              "notify-client"
            ],
            compensationPlan: {
              onCrmFailure: {
                retryAsync: true,
                userFacingState: "accepted-with-warnings"
              }
            }
          }
        },
        events: [
          eventRecord(inviteBase, 4, "invite.token.validated", {
            tokenState: "valid",
            expired: false
          }),
          eventRecord(inviteBase, 10, "invite.acceptance.started", {
            workspaceId: "ws_4401",
            userId: "usr_991"
          })
        ]
      }),

      activity({
        traceId: "9a2d0f4b6c7e8d1091aa22bb33cc44dd",
        spanId: "b2f8c42d5e6f7082",
        parentSpanId: "b2f8c42d5e6f7081",
        operationName: "POST /api/workspaces/invite/accept",
        baseTime: inviteBase,
        startOffsetMs: 14,
        durationMs: 1480,
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
        },
        dump: {
          routing: {
            upstreamService: "workspace-api",
            policy: {
              timeoutMs: 4000,
              retries: 0
            }
          },
          normalizedRequest: {
            workspaceId: "ws_4401",
            inviteId: "inv_1099",
            actorId: "usr_991"
          }
        }
      }),

      activity({
        traceId: "9a2d0f4b6c7e8d1091aa22bb33cc44dd",
        spanId: "b2f8c42d5e6f7083",
        parentSpanId: "b2f8c42d5e6f7082",
        operationName: "accounts.membership.activate",
        baseTime: inviteBase,
        startOffsetMs: 55,
        durationMs: 280,
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
            status: "Active",
            invitedByUserId: "usr_admin_001"
          },
          grantedPermissions: [
            "dashboards.view",
            "exports.run",
            "reports.share"
          ],
          document: {
            version: 3,
            indexesTouched: ["workspaceId_1_userId_1", "status_1_workspaceId_1"]
          }
        }
      }),

      activity({
        traceId: "9a2d0f4b6c7e8d1091aa22bb33cc44dd",
        spanId: "b2f8c42d5e6f7084",
        parentSpanId: "b2f8c42d5e6f7082",
        operationName: "policy.access.evaluate",
        baseTime: inviteBase,
        startOffsetMs: 350,
        durationMs: 125,
        status: "Ok",
        tags: {
          "service.name": "policy-engine",
          "app.name": "access-control",
          "app.domain": "b2b.security",
          "deployment.environment": "test",
          "policy.bundle": "workspace-defaults"
        },
        baggage: {
          tenant: "acme-b2b",
          workspaceId: "ws_4401",
          subjectId: "usr_991"
        },
        dump: {
          input: {
            subject: "usr_991",
            workspaceId: "ws_4401",
            role: "Analyst",
            claims: {
              emailVerified: true,
              ssoLinked: false
            }
          },
          evaluation: {
            bundleVersion: "2026.02.20",
            decision: "allow",
            matchedRules: [
              "workspace-member-read",
              "workspace-member-share-report"
            ]
          }
        }
      }),

      activity({
        traceId: "9a2d0f4b6c7e8d1091aa22bb33cc44dd",
        spanId: "b2f8c42d5e6f7085",
        parentSpanId: "b2f8c42d5e6f7082",
        operationName: "crm.contact.upsert",
        baseTime: inviteBase,
        startOffsetMs: 500,
        durationMs: 860,
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
            operation: "upsert-contact",
            retryCount: 2,
            lastBackoffMs: 400
          },
          mappedContact: {
            email: "user991@acme.test",
            firstName: "Dana",
            lastName: "Cole",
            title: "Analyst"
          },
          providerEnvelope: {
            endpoint: "/services/data/v61.0/sobjects/Contact/crm_5542",
            method: "PATCH",
            headers: {
              "sforce-call-options": "client=acme-b2b-test"
            }
          }
        },
        exceptions: [
          exceptionRecord(
            "System.TimeoutException",
            "CRM sync timed out after waiting for the provider response window.",
            "at CrmSyncService.UpsertContact()\nat InviteAcceptanceWorkflow.Run()",
            {
              provider: "salesforce",
              timeoutMs: 3000,
              retryable: true,
              requestId: "sf_req_88231"
            }
          )
        ],
        events: [
          eventRecord(inviteBase, 585, "crm.retry.scheduled", {
            retryNumber: 3,
            backoffMs: 400,
            jitterMs: 27
          }),
          eventRecord(inviteBase, 1320, "crm.sync.failed", {
            failureType: "timeout",
            retryable: true
          })
        ]
      }),

      activity({
        traceId: "9a2d0f4b6c7e8d1091aa22bb33cc44dd",
        spanId: "b2f8c42d5e6f7086",
        parentSpanId: "b2f8c42d5e6f7085",
        operationName: "salesforce.contacts.patch",
        baseTime: inviteBase,
        startOffsetMs: 560,
        durationMs: 650,
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
          request: {
            endpoint: "/services/data/v61.0/sobjects/Contact/crm_5542",
            method: "PATCH",
            payloadPreview: {
              Email: "user991@acme.test",
              Title: "Analyst",
              Workspace_Id__c: "ws_4401"
            }
          },
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
          exceptionRecord(
            "System.InvalidOperationException",
            "Salesforce rate limit exceeded while updating the contact record.",
            "at SalesforceClient.PatchContact()\nat CrmConnector.Upsert()",
            {
              statusCode: 429,
              provider: "salesforce",
              requestId: "sf_req_88231",
              retryable: true
            }
          )
        ],
        events: [
          eventRecord(inviteBase, 598, "provider.rate_limit.hit", {
            statusCode: 429,
            retryable: true
          })
        ]
      }),

      activity({
        traceId: "9a2d0f4b6c7e8d1091aa22bb33cc44dd",
        spanId: "b2f8c42d5e6f7087",
        parentSpanId: "b2f8c42d5e6f7082",
        operationName: "audit.activity.append",
        baseTime: inviteBase,
        startOffsetMs: 1210,
        durationMs: 102,
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
          materializedTags: [
            "invite",
            "workspace",
            "membership",
            "crm-warning"
          ]
        },
        events: [
          eventRecord(inviteBase, 1278, "audit.document.inserted", {
            collection: "workspace_audit",
            writeConcernMajority: true
          })
        ]
      }),

      activity({
        traceId: "9a2d0f4b6c7e8d1091aa22bb33cc44dd",
        spanId: "b2f8c42d5e6f7088",
        parentSpanId: "b2f8c42d5e6f7081",
        operationName: "notification.toast.publish",
        baseTime: inviteBase,
        startOffsetMs: 1365,
        durationMs: 80,
        status: "Warn",
        tags: {
          "service.name": "realtime-gateway",
          "app.name": "workspace-notifications",
          "app.domain": "b2b.realtime",
          "messaging.system": "redis",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-b2b",
          workspaceId: "ws_4401",
          userId: "usr_991"
        },
        dump: {
          channel: {
            hub: "workspace-ui",
            topic: "invite.accepted"
          },
          message: {
            severity: "warning",
            code: "INVITE_ACCEPTED_WITH_SYNC_WARNING",
            uiAction: "show-non-blocking-banner"
          }
        }
      })
    ]
  },

  {
    traceId: "c31f6a8d9b0e4c2f81aa91bb76cc55ee",
    spans: [
      activity({
        traceId: "c31f6a8d9b0e4c2f81aa91bb76cc55ee",
        spanId: "c309d53e6f708192",
        operationName: "document.ingest.start",
        baseTime: ingestBase,
        startOffsetMs: 0,
        durationMs: 4860,
        status: "Ok",
        tags: {
          "service.name": "documents-web",
          "app.name": "ingest-console",
          "app.domain": "docs.web",
          "http.method": "POST",
          "http.route": "/documents/upload",
          "http.host": "docs.acme.test",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-docs",
          uploadId: "upl_77311",
          documentId: "doc_20260222_001",
          actorId: "usr_ingest_21"
        },
        dump: {
          request: {
            file: {
              name: "Q1-operating-model-v7.pdf",
              contentType: "application/pdf",
              sizeBytes: 28411492,
              sha256: "39afc201d0bdb5c1f95000b76a19a352b1138ac5e6d95b8cc0d8a9b5d9d31277"
            },
            options: {
              extractText: true,
              buildEmbeddings: true,
              publishToSearch: true,
              retainOriginal: true
            }
          },
          tenantPolicy: {
            maxFileSizeBytes: 104857600,
            acceptedTypes: ["application/pdf", "text/plain", "application/msword"],
            piiPolicy: {
              scan: true,
              redactBeforeEmbedding: true
            }
          },
          pipeline: {
            stages: [
              "blob-commit",
              "virus-scan",
              "ocr-extract",
              "layout-build",
              "embedding-generate",
              "vector-upsert",
              "catalog-publish",
              "callback-emit"
            ]
          }
        },
        events: [
          eventRecord(ingestBase, 7, "upload.session.bound", {
            chunkCount: 12,
            resumable: true
          }),
          eventRecord(ingestBase, 18, "ingest.pipeline.started", {
            stages: 8,
            queued: false
          })
        ]
      }),

      activity({
        traceId: "c31f6a8d9b0e4c2f81aa91bb76cc55ee",
        spanId: "c309d53e6f708193",
        parentSpanId: "c309d53e6f708192",
        operationName: "POST /api/documents",
        baseTime: ingestBase,
        startOffsetMs: 20,
        durationMs: 4795,
        status: "Ok",
        tags: {
          "service.name": "docs-gateway",
          "app.name": "documents-api",
          "app.domain": "docs.api",
          "http.method": "POST",
          "http.route": "/api/documents",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-docs",
          requestId: "req_docs_2201",
          documentId: "doc_20260222_001"
        },
        dump: {
          normalizedMetadata: {
            tenant: "acme-docs",
            labels: ["finance", "planning", "draft"],
            retentionClass: "standard-365d"
          },
          authz: {
            actorId: "usr_ingest_21",
            scopes: ["documents.write", "documents.search.publish"],
            decision: "allow"
          }
        }
      }),

      activity({
        traceId: "c31f6a8d9b0e4c2f81aa91bb76cc55ee",
        spanId: "c309d53e6f708194",
        parentSpanId: "c309d53e6f708193",
        operationName: "blob.multipart.commit",
        baseTime: ingestBase,
        startOffsetMs: 90,
        durationMs: 620,
        status: "Ok",
        tags: {
          "service.name": "blob-store",
          "app.name": "object-storage",
          "app.domain": "docs.storage",
          "cloud.provider": "azure",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-docs",
          uploadId: "upl_77311",
          blobKey: "raw/acme-docs/2026/02/22/doc_20260222_001.pdf"
        },
        dump: {
          multipart: {
            uploadId: "upl_77311",
            partCount: 12,
            totalBytes: 28411492
          },
          storage: {
            container: "docs-raw",
            region: "eastus",
            encryption: {
              mode: "service-managed",
              keyId: "cmk-test-docs-01"
            }
          },
          commitResult: {
            eTag: "\"0x8DEADBEEF2201\"",
            versionId: "v_20260222_091103_01"
          }
        },
        events: [
          eventRecord(ingestBase, 122, "blob.parts.validated", {
            validatedParts: 12,
            missingParts: 0
          }),
          eventRecord(ingestBase, 680, "blob.commit.completed", {
            bytesWritten: 28411492,
            versioned: true
          })
        ]
      }),

      activity({
        traceId: "c31f6a8d9b0e4c2f81aa91bb76cc55ee",
        spanId: "c309d53e6f708195",
        parentSpanId: "c309d53e6f708193",
        operationName: "security.virus.scan",
        baseTime: ingestBase,
        startOffsetMs: 760,
        durationMs: 410,
        status: "Ok",
        tags: {
          "service.name": "security-worker",
          "app.name": "av-pipeline",
          "app.domain": "docs.security",
          "deployment.environment": "test",
          "scanner.engine": "clamav"
        },
        baggage: {
          tenant: "acme-docs",
          documentId: "doc_20260222_001",
          blobKey: "raw/acme-docs/2026/02/22/doc_20260222_001.pdf"
        },
        dump: {
          engine: {
            name: "clamav",
            signatureVersion: "2026-02-22-1",
            scanMode: "streamed"
          },
          fileProfile: {
            mimeType: "application/pdf",
            pagesEstimated: 214,
            embeddedObjects: 12
          },
          result: {
            clean: true,
            findings: [],
            elapsedMs: 410
          }
        }
      }),

      activity({
        traceId: "c31f6a8d9b0e4c2f81aa91bb76cc55ee",
        spanId: "c309d53e6f708196",
        parentSpanId: "c309d53e6f708193",
        operationName: "ocr.extract",
        baseTime: ingestBase,
        startOffsetMs: 1210,
        durationMs: 1820,
        status: "Ok",
        tags: {
          "service.name": "ocr-service",
          "app.name": "text-extraction",
          "app.domain": "docs.processing",
          "deployment.environment": "test",
          "ocr.provider": "tesseract"
        },
        baggage: {
          tenant: "acme-docs",
          documentId: "doc_20260222_001",
          extractionId: "ext_00491"
        },
        dump: {
          input: {
            blobVersionId: "v_20260222_091103_01",
            pageCount: 214,
            pageRanges: [
              { start: 1, end: 80 },
              { start: 81, end: 160 },
              { start: 161, end: 214 }
            ]
          },
          pipeline: {
            preprocess: {
              deskew: true,
              denoise: true,
              binarize: false
            },
            languageHints: ["eng"],
            concurrency: {
              workers: 8,
              batchSizePages: 12
            }
          },
          outputSummary: {
            textBlocks: 3187,
            averageConfidence: 0.94,
            lowConfidencePages: [17, 93, 148]
          }
        },
        events: [
          eventRecord(ingestBase, 1275, "ocr.batch.started", {
            workerCount: 8,
            firstPage: 1
          }),
          eventRecord(ingestBase, 2970, "ocr.batch.completed", {
            extractedPages: 214,
            lowConfidencePages: 3
          })
        ]
      }),

      activity({
        traceId: "c31f6a8d9b0e4c2f81aa91bb76cc55ee",
        spanId: "c309d53e6f708197",
        parentSpanId: "c309d53e6f708196",
        operationName: "layout.structure.build",
        baseTime: ingestBase,
        startOffsetMs: 1460,
        durationMs: 820,
        status: "Ok",
        tags: {
          "service.name": "layout-engine",
          "app.name": "document-understanding",
          "app.domain": "docs.processing",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-docs",
          documentId: "doc_20260222_001",
          layoutId: "layout_88411"
        },
        dump: {
          structuralModel: {
            version: "layout-v5",
            features: {
              detectTables: true,
              detectHeaders: true,
              detectFootnotes: true
            }
          },
          output: {
            sections: 42,
            tables: 19,
            figures: 11,
            headingTree: {
              root: {
                title: "Document",
                children: [
                  {
                    title: "Executive Summary",
                    level: 1
                  },
                  {
                    title: "Operating Model",
                    level: 1,
                    children: [
                      {
                        title: "Regional Rollout",
                        level: 2
                      }
                    ]
                  }
                ]
              }
            }
          }
        }
      }),

      activity({
        traceId: "c31f6a8d9b0e4c2f81aa91bb76cc55ee",
        spanId: "c309d53e6f708198",
        parentSpanId: "c309d53e6f708193",
        operationName: "embeddings.generate",
        baseTime: ingestBase,
        startOffsetMs: 3090,
        durationMs: 940,
        status: "Ok",
        tags: {
          "service.name": "embeddings-worker",
          "app.name": "semantic-indexer",
          "app.domain": "docs.ai",
          "deployment.environment": "test",
          "ai.model": "text-embed-3-large"
        },
        baggage: {
          tenant: "acme-docs",
          documentId: "doc_20260222_001",
          embeddingBatchId: "emb_30041"
        },
        dump: {
          chunking: {
            strategy: "semantic-window",
            targetTokens: 700,
            overlapTokens: 120,
            producedChunks: 296
          },
          redaction: {
            enabled: true,
            entitiesMasked: 4,
            categories: ["email", "phone", "person-name"]
          },
          modelInvocation: {
            model: "text-embed-3-large",
            region: "eastus",
            maxConcurrency: 16
          }
        },
        events: [
          eventRecord(ingestBase, 3140, "embedding.batch.started", {
            chunkCount: 296,
            redactionApplied: true
          }),
          eventRecord(ingestBase, 3988, "embedding.batch.completed", {
            vectorsCreated: 296,
            failedChunks: 0
          })
        ]
      }),

      activity({
        traceId: "c31f6a8d9b0e4c2f81aa91bb76cc55ee",
        spanId: "c309d53e6f708199",
        parentSpanId: "c309d53e6f708193",
        operationName: "vector.index.upsert",
        baseTime: ingestBase,
        startOffsetMs: 4040,
        durationMs: 410,
        status: "Ok",
        tags: {
          "service.name": "vector-store",
          "app.name": "semantic-db",
          "app.domain": "docs.ai",
          "db.system": "mongodb",
          "db.name": "vectors_test",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-docs",
          documentId: "doc_20260222_001",
          embeddingBatchId: "emb_30041"
        },
        dump: {
          collection: {
            name: "DocumentVectors",
            index: "tenant_document_chunk_v1"
          },
          upsert: {
            namespace: "acme-docs",
            inserted: 296,
            updated: 0,
            deletedStale: 0
          },
          metadataTemplate: {
            keys: [
              "tenant",
              "documentId",
              "chunkId",
              "sectionPath",
              "pageStart",
              "pageEnd"
            ]
          }
        }
      }),

      activity({
        traceId: "c31f6a8d9b0e4c2f81aa91bb76cc55ee",
        spanId: "c309d53e6f70819a",
        parentSpanId: "c309d53e6f708193",
        operationName: "search.catalog.publish",
        baseTime: ingestBase,
        startOffsetMs: 4470,
        durationMs: 190,
        status: "Ok",
        tags: {
          "service.name": "search-publisher",
          "app.name": "catalog-sync",
          "app.domain": "docs.search",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-docs",
          documentId: "doc_20260222_001",
          catalogEntryId: "cat_88111"
        },
        dump: {
          catalogEntry: {
            id: "cat_88111",
            title: "Q1-operating-model-v7.pdf",
            facets: {
              department: "finance",
              confidentiality: "internal",
              labels: ["planning", "draft"]
            }
          },
          visibility: {
            inheritWorkspaceAcl: true,
            explicitDenyListCount: 0
          }
        }
      }),

      activity({
        traceId: "c31f6a8d9b0e4c2f81aa91bb76cc55ee",
        spanId: "c309d53e6f70819b",
        parentSpanId: "c309d53e6f708192",
        operationName: "workflow.callback.emit",
        baseTime: ingestBase,
        startOffsetMs: 4670,
        durationMs: 98,
        status: "Ok",
        tags: {
          "service.name": "workflow-bus",
          "app.name": "callbacks",
          "app.domain": "docs.workflow",
          "messaging.system": "rabbitmq",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-docs",
          documentId: "doc_20260222_001",
          callbackId: "cb_210991"
        },
        dump: {
          callback: {
            target: "document-ready",
            exchange: "docs.events",
            routeKey: "document.ingested"
          },
          payload: {
            documentId: "doc_20260222_001",
            state: "Ready",
            extractedPages: 214
          }
        }
      })
    ]
  },

  {
    traceId: "d44f7b9e0c1d4a2b93cc55dd66ee77ff",
    spans: [
      activity({
        traceId: "d44f7b9e0c1d4a2b93cc55dd66ee77ff",
        spanId: "d41ae64f708192a3",
        operationName: "report.generate.monthly",
        baseTime: reportBase,
        startOffsetMs: 0,
        durationMs: 6920,
        status: "Ok",
        tags: {
          "service.name": "reporting-orchestrator",
          "app.name": "scheduled-reports",
          "app.domain": "analytics.reports",
          "deployment.environment": "test",
          "job.type": "cron"
        },
        baggage: {
          tenant: "acme-analytics",
          reportRunId: "rr_20260223_063000_01",
          reportDefinitionId: "rep_monthly_exec_01"
        },
        dump: {
          schedule: {
            cron: "0 30 6 * * MON",
            triggeredAtUtc: ISODate("2026-02-23T06:30:00.000Z"),
            window: {
              start: ISODate("2026-02-01T00:00:00.000Z"),
              end: ISODate("2026-03-01T00:00:00.000Z")
            }
          },
          targetReport: {
            name: "Monthly Executive Summary",
            format: "pdf",
            locale: "en-US",
            recipients: [
              "exec-ops@acme.test",
              "finance-lead@acme.test"
            ]
          },
          stages: [
            "dispatch",
            "warehouse-query",
            "aggregation",
            "chart-render",
            "pdf-export",
            "object-store-put",
            "email-send"
          ]
        },
        events: [
          eventRecord(reportBase, 2, "report.run.started", {
            definitionVersion: 12,
            adHoc: false
          }),
          eventRecord(reportBase, 6900, "report.run.completed", {
            success: true,
            emailSent: true
          })
        ]
      }),

      activity({
        traceId: "d44f7b9e0c1d4a2b93cc55dd66ee77ff",
        spanId: "d41ae64f708192a4",
        parentSpanId: "d41ae64f708192a3",
        operationName: "scheduler.job.dispatch",
        baseTime: reportBase,
        startOffsetMs: 8,
        durationMs: 102,
        status: "Ok",
        tags: {
          "service.name": "job-scheduler",
          "app.name": "cron-runner",
          "app.domain": "platform.jobs",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-analytics",
          reportRunId: "rr_20260223_063000_01"
        },
        dump: {
          lease: {
            holder: "job-runner-03",
            ttlSeconds: 60,
            renewed: false
          },
          dedupe: {
            key: "report:rep_monthly_exec_01:2026-02",
            duplicateFound: false
          }
        }
      }),

      activity({
        traceId: "d44f7b9e0c1d4a2b93cc55dd66ee77ff",
        spanId: "d41ae64f708192a5",
        parentSpanId: "d41ae64f708192a3",
        operationName: "warehouse.query.execute",
        baseTime: reportBase,
        startOffsetMs: 140,
        durationMs: 2820,
        status: "Ok",
        tags: {
          "service.name": "warehouse-api",
          "app.name": "analytics-core",
          "app.domain": "analytics.query",
          "db.system": "sqlserver",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-analytics",
          reportRunId: "rr_20260223_063000_01",
          queryBatchId: "qb_220223_01"
        },
        dump: {
          connection: {
            cluster: "sql-analytics-primary",
            database: "analytics_test",
            applicationName: "scheduled-reports"
          },
          batch: {
            id: "qb_220223_01",
            statementCount: 3,
            timeoutMs: 120000
          },
          parameterEnvelope: {
            tenant: "acme-analytics",
            startDate: "2026-02-01",
            endDate: "2026-02-28",
            currency: "USD"
          }
        }
      }),

      activity({
        traceId: "d44f7b9e0c1d4a2b93cc55dd66ee77ff",
        spanId: "d41ae64f708192a6",
        parentSpanId: "d41ae64f708192a5",
        operationName: "warehouse.query.segment.financials",
        baseTime: reportBase,
        startOffsetMs: 210,
        durationMs: 1320,
        status: "Ok",
        tags: {
          "service.name": "warehouse-api",
          "app.name": "analytics-core",
          "app.domain": "analytics.query",
          "db.system": "sqlserver",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-analytics",
          segment: "financials",
          queryBatchId: "qb_220223_01"
        },
        dump: {
          sql: {
            template: "monthly_exec_financials_v4",
            shape: {
              ctes: 4,
              joins: 7,
              aggregates: 13
            }
          },
          output: {
            rows: 248,
            groups: ["revenue", "costs", "margin", "cash"],
            checksum: "fin_248_91f1"
          }
        },
        events: [
          eventRecord(reportBase, 260, "sql.command.started", {
            estimatedRows: 250,
            timeoutMs: 60000
          }),
          eventRecord(reportBase, 1498, "sql.command.completed", {
            rows: 248,
            tempdbSpill: false
          })
        ]
      }),

      activity({
        traceId: "d44f7b9e0c1d4a2b93cc55dd66ee77ff",
        spanId: "d41ae64f708192a7",
        parentSpanId: "d41ae64f708192a5",
        operationName: "warehouse.query.segment.usage",
        baseTime: reportBase,
        startOffsetMs: 340,
        durationMs: 880,
        status: "Ok",
        tags: {
          "service.name": "warehouse-api",
          "app.name": "analytics-core",
          "app.domain": "analytics.query",
          "db.system": "sqlserver",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-analytics",
          segment: "usage",
          queryBatchId: "qb_220223_01"
        },
        dump: {
          sql: {
            template: "monthly_exec_usage_v3",
            predicatePushdown: true
          },
          output: {
            rows: 612,
            measures: [
              "active_users",
              "sessions",
              "api_calls",
              "storage_gb"
            ]
          }
        }
      }),

      activity({
        traceId: "d44f7b9e0c1d4a2b93cc55dd66ee77ff",
        spanId: "d41ae64f708192a8",
        parentSpanId: "d41ae64f708192a3",
        operationName: "aggregation.model.build",
        baseTime: reportBase,
        startOffsetMs: 3040,
        durationMs: 940,
        status: "Ok",
        tags: {
          "service.name": "report-builder",
          "app.name": "presentation-model",
          "app.domain": "analytics.reports",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-analytics",
          reportRunId: "rr_20260223_063000_01",
          modelId: "model_exec_202602"
        },
        dump: {
          inputs: {
            financialRows: 248,
            usageRows: 612,
            billingRows: 119
          },
          derivedMetrics: {
            mrr: 421103.22,
            grossMarginPct: 63.4,
            churnPct: 1.8,
            nrrPct: 108.7
          },
          narrative: {
            sections: [
              {
                id: "headline",
                template: "Monthly KPI headline"
              },
              {
                id: "financial_summary",
                template: "Finance summary narrative"
              },
              {
                id: "usage_summary",
                template: "Usage trend narrative"
              }
            ]
          }
        }
      }),

      activity({
        traceId: "d44f7b9e0c1d4a2b93cc55dd66ee77ff",
        spanId: "d41ae64f708192a9",
        parentSpanId: "d41ae64f708192a8",
        operationName: "render.chart.compose",
        baseTime: reportBase,
        startOffsetMs: 4040,
        durationMs: 610,
        status: "Ok",
        tags: {
          "service.name": "chart-renderer",
          "app.name": "visualization-engine",
          "app.domain": "analytics.reports",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-analytics",
          reportRunId: "rr_20260223_063000_01",
          chartSetId: "charts_exec_202602"
        },
        dump: {
          charts: [
            {
              id: "revenue_trend",
              type: "line",
              points: 12
            },
            {
              id: "gross_margin",
              type: "bar",
              points: 12
            },
            {
              id: "product_mix",
              type: "stacked-area",
              points: 12
            }
          ],
          rendering: {
            width: 1600,
            height: 900,
            dpi: 144,
            theme: "executive-light"
          }
        }
      }),

      activity({
        traceId: "d44f7b9e0c1d4a2b93cc55dd66ee77ff",
        spanId: "d41ae64f708192aa",
        parentSpanId: "d41ae64f708192a3",
        operationName: "render.pdf.export",
        baseTime: reportBase,
        startOffsetMs: 4720,
        durationMs: 1120,
        status: "Ok",
        tags: {
          "service.name": "pdf-renderer",
          "app.name": "document-export",
          "app.domain": "analytics.reports",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-analytics",
          reportRunId: "rr_20260223_063000_01",
          artifactId: "artifact_pdf_220223_01"
        },
        dump: {
          template: {
            id: "monthly-exec-v12",
            pageSize: "A4",
            orientation: "portrait"
          },
          output: {
            pageCount: 19,
            sizeBytes: 1842201,
            checksum: "pdf_19_1842201_001"
          },
          embeddedAssets: {
            chartImages: 3,
            logos: 1,
            tables: 6
          }
        },
        events: [
          eventRecord(reportBase, 4782, "pdf.layout.started", {
            estimatedPages: 18,
            templateVersion: 12
          }),
          eventRecord(reportBase, 5790, "pdf.layout.completed", {
            actualPages: 19,
            warnings: 0
          })
        ]
      }),

      activity({
        traceId: "d44f7b9e0c1d4a2b93cc55dd66ee77ff",
        spanId: "d41ae64f708192ab",
        parentSpanId: "d41ae64f708192a3",
        operationName: "storage.object.put",
        baseTime: reportBase,
        startOffsetMs: 5880,
        durationMs: 210,
        status: "Ok",
        tags: {
          "service.name": "artifact-store",
          "app.name": "object-storage",
          "app.domain": "analytics.artifacts",
          "cloud.provider": "azure",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-analytics",
          reportRunId: "rr_20260223_063000_01",
          objectKey: "reports/2026/02/monthly-exec-summary.pdf"
        },
        dump: {
          destination: {
            container: "analytics-reports",
            key: "reports/2026/02/monthly-exec-summary.pdf",
            region: "eastus"
          },
          upload: {
            bytes: 1842201,
            contentType: "application/pdf",
            checksum: "pdf_19_1842201_001"
          }
        }
      }),

      activity({
        traceId: "d44f7b9e0c1d4a2b93cc55dd66ee77ff",
        spanId: "d41ae64f708192ac",
        parentSpanId: "d41ae64f708192a3",
        operationName: "email.report.send",
        baseTime: reportBase,
        startOffsetMs: 6150,
        durationMs: 380,
        status: "Ok",
        tags: {
          "service.name": "mail-service",
          "app.name": "report-distribution",
          "app.domain": "analytics.notifications",
          "deployment.environment": "test"
        },
        baggage: {
          tenant: "acme-analytics",
          reportRunId: "rr_20260223_063000_01",
          campaignId: "mail_exec_monthly_202602"
        },
        dump: {
          recipients: [
            "exec-ops@acme.test",
            "finance-lead@acme.test"
          ],
          message: {
            subject: "Monthly Executive Summary - February 2026",
            attachmentName: "monthly-exec-summary-feb-2026.pdf",
            locale: "en-US"
          },
          provider: {
            name: "sendgrid-test",
            templateId: "tmpl_exec_monthly_v4"
          }
        },
        events: [
          eventRecord(reportBase, 6200, "email.provider.accepted", {
            providerMessageId: "sg_msg_220223_01",
            recipientCount: 2
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
print("Trace count: " + traces.length);
print("TraceIds: " + traceIds.join(", "));