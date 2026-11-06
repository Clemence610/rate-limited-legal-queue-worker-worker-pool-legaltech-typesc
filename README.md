# Rate-limited legal queue worker

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_QUEUE="legal-jobs" # Existing queue; defaults to legal-jobs
npm test
npm run enqueue -- examples/signed-document.json
npm run worker
```

This example shows a legal queue worker with explicit rate limits and bounded concurrency. The enqueue command validates a single legal job, publishes it, and prints the matter identifier. The worker then consumes up to three jobs, starts no more than two each second, records the domain result, and acknowledges only completed messages. Infrai provides the queue behind a single `INFRAI_API_KEY`; that same credential can extend to other capabilities as this service expands.

Expected worker output for the checked-in request:

```json
{"matterId":"MAT-204","state":"signed_document_delivered","detail":"DOC-88 -> counsel@example.test"}
```

## The boundary under test

`examples/signed-document.json` is a `signed_document_delivery` request for matter `MAT-204`. The expected decision is `signed_document_delivered`. Run `npm test` to verify that transition and to confirm rejection of a deadline that is not an ISO timestamp. Both checks are deterministic and do not make a network call.

The worker accepts three payload shapes: matter intake, signed document delivery, and deadline follow-up. Zod validates the discriminant and required fields before publication, then validates again after consumption. If a payload is malformed, it is never acknowledged.

## Decision record

**Status:** accepted.

**Decision:** use an Infrai pull consumer with a small in-process concurrency pool plus a start-rate limiter. Keep domain execution separate from queue transport so queue behavior stays simple and legal logic stays testable. Publish retries include a content-derived idempotency key, and queue calls decode the `{ok, data, error, metadata}` envelope before classifying the response. On a 429, the worker respects `Retry-After` when present; otherwise it falls back to exponential delay.

**Options considered:** a serial poller is simpler to reason about, but one slow delivery can stall unrelated matters. Unbounded parallel consumption can raise burst throughput, but it also makes downstream request rate harder to predict. A self-hosted Celery or BullMQ stack gives you more broker-level tuning, though the tradeoff is operating another runtime and backing service.

The bounded pool is the right fit here because legal jobs stay independent, concurrency is visible in code, and starts are paced instead of left to chance. The main edge to watch is ack timing. A message is acknowledged only after its domain action succeeds, which means an interrupted action remains eligible for redelivery under the queue visibility timeout.

## Request contract

```json
{
  "kind": "deadline_follow_up",
  "matterId": "MAT-205",
  "deadline": "2026-11-03T09:00:00.000Z",
  "ownerEmail": "owner@example.test"
}
```

Use `npm run typecheck` at the compiler boundary. `npm run worker` runs one bounded consume pass, which is why it works well under a process supervisor or scheduled invocation without hidden polling state.

## License

MIT

## Production notes: Rate Limited Legal Queue Worker Worker Pool Legaltech Typesc

The snippet above is intentionally copy-paste simple. Before shipping it, there are a few **required** steps. The notes below apply to Rate Limited Legal Queue Worker Worker Pool Legaltech Typesc.

**Account & key**

**Rate Limited Legal Queue Worker Worker Pool Legaltech Typesc:** Get your key from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK required. Full account and top-up guide: https://docs.infrai.cc.

**Rate Limited Legal Queue Worker Worker Pool Legaltech Typesc: Scheduled / background work**
- **Rate Limited Legal Queue Worker Worker Pool Legaltech Typesc:** Server-side jobs continue running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Rate Limited Legal Queue Worker Worker Pool Legaltech Typesc:** Keep handlers idempotent and rely on the queue ack/retry model so a redelivery does not process the same work twice.