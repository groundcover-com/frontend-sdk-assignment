# Frontend SDK Assignment

## Overview

This is a coding assignment designed to evaluate frontend development skills. You'll be
working with a React + TypeScript application that contains a working demo playground and
a **stubbed-out browser telemetry SDK**. Your task is to implement the SDK: capture events
from the host application, batch them, and deliver them reliably to an ingest endpoint.

Think of the kind of SDK a product embeds on its customers' websites — it has to be
efficient with the network, honest about what it dropped, and above all it must never break
the page it lives on.

## What's already here

| Path | What it is |
| --- | --- |
| `src/sdk/index.ts` | **The public API you implement.** Signatures and contracts are given; the bodies are not. |
| `src/sdk/types.ts` | Public config types and the wire types. The wire types are fixed — the server validates them. |
| `src/demo/` | The playground: the host app, config form, browser-environment toggles, ingest inspector, status bar. Complete; you shouldn't need to change it. |
| `plain.html`, `src/plain/main.ts` | A second consumer of the SDK with no React. Open it to check the SDK has no framework coupling and adds nothing to `window`. |
| `mock-ingest/plugin.ts` | A fake ingest API served by the Vite dev server. Complete. |
| `src/components/` | UI primitives used by the demo. |

Run `pnpm dev` and you'll see the whole loop: the left column calls the SDK, the right
column shows what reached the server. Right now nothing reaches the server — the stubs log
`[sdk] track() is not implemented yet` to the console instead.

## The Task

Implement `src/sdk/index.ts`. Requirements 1–4 are the assignment; 5 and 6 are there if you
have time. Split the SDK into as many modules as you like — the only fixed points are the
public function signatures the demo calls and the wire format the server accepts.

### 1. Initialization and configuration

`init(config)` starts the SDK.

- Apply the documented default for every optional field in `TelemetryConfig` (see the
  JSDoc on each one).
- Reject an unusable config — missing `apiKey` or `endpoint` — **without throwing into the
  host application**. Nothing the SDK does may crash the page.
- Make it idempotent: a second `init()` must not end up with two flush timers or two sets
  of listeners.
- Establish a session: an id and a start time that every batch carries.

### 2. Event capture

- `track(name, attributes)` records a custom event.
- `trackPageView(path)` records a page view; `path` defaults to the current location.
- `captureError(error)` records an error — accept anything a `catch` block can produce and
  pull a message out of it.
- `setUser(user)` attaches a user to subsequent batches; `setUser(null)` detaches.
- Every event needs a unique `id`, a `timestamp` from when it *happened*, and a monotonic
  `seq` within the session.
- All of these must be safe to call before `init()` and after `shutdown()`. Decide what
  should happen in those cases and say so in a comment — dropping is a legitimate answer,
  buffering is another.

### 3. Batching and flushing

Events should not each cost a request.

- Flush when the queue reaches `batchSize`.
- Flush on a `flushIntervalMs` timer while events are waiting.
- Flush on demand via `flush()`, which resolves when the queue has drained or been given
  up on, and never rejects.
- Flush when the page is going away. A normal `fetch` gets cancelled on unload —
  `navigator.sendBeacon` is the tool for this, which is why `apiKey` travels in the body
  rather than a header.
- Bound the queue at `maxQueueSize` and pick a drop policy (oldest? newest?). Count what
  you dropped.
- Keep one request in flight at a time; batches should not overtake each other.

### 4. Delivery: transport and retries

- `POST` the batch as JSON to `config.endpoint`. Any 2xx is a success.
- Retry `5xx`, `429` and network failures with exponential backoff and some jitter, up to
  `maxRetries` attempts including the first.
- Do **not** retry `400` or `401` — the payload or the key is wrong and a retry cannot fix
  it. Drop those events and record the reason.
- Do not lose events across a retry, and do not send the same event twice. The inspector
  flags any event id the server has already accepted, so double-sends are visible.
- Report the attempt number in the batch's `attempt` field, starting at 1.

### 5. Sampling, session lifetime and persistence *(stretch)*

- `sampleRate` is a **per-session** decision, not a per-event coin flip: a sampled-out
  session sends nothing at all.
- Expire a session after 30 minutes of inactivity and start a new one.
- Survive a reload: persist the session and any unsent events (`sessionStorage` or
  `localStorage`), and pick them back up on `init()`.

### 6. Diagnostics, auto-capture and teardown *(stretch)*

- Fill in `getDiagnostics()` — the status bar at the top of the page renders it directly.
- With `captureErrors: true`, capture `error` and `unhandledrejection` events
  automatically. The demo has buttons for both.
- With `autoPageViews: true`, emit a `page_view` on `init()` and on every client-side
  navigation in the store. Acme Store is a single-page app: it never reloads, and it
  never calls `trackPageView()` on a route change — that one is yours.
- `shutdown()` flushes, then releases timers and listeners, leaving the SDK ready for a
  later `init()`.

## The wire contract

The ingest server validates every batch and answers `400` with the exact reason when
something doesn't fit — the inspector shows you that message verbatim, so use it. A batch
looks like this:

```jsonc
{
  "apiKey": "gc_demo_key",
  "sdk": { "name": "gc-browser", "version": "0.1.0" },
  "session": { "id": "5f3c…", "startedAt": 1737550000000 },
  "user": { "id": "usr_4812", "email": "jane@example.com" },
  "context": { "url": "http://localhost:5173/", "userAgent": "…" },
  "events": [
    {
      "id": "e1a2…",
      "type": "custom",            // custom | page_view | error
      "name": "add_to_cart",
      "timestamp": 1737550000123,
      "seq": 7,
      "attributes": { "sku": "GC-MUG", "price": 12 }
    }
  ],
  "sentAt": 1737550000456,
  "attempt": 1
}
```

The server requires `apiKey`, `session.id`, a non-empty `events` array, and on each event
an `id`, `name`, numeric `timestamp` and a known `type`. It answers:

| Status | When | Retryable |
| --- | --- | --- |
| `202` | accepted (reports how many were duplicates) | — |
| `400` | malformed batch, with the reason | no |
| `401` | wrong `apiKey` | no |
| `429` / `500` / `503` | failure injection, per the controls panel | yes |

## The playground

- **Acme Store** — the host application. A single-page store with its own client-side
  routing that only ever calls the SDK's public API. It is a real app, not a button
  board: if the SDK throws into it or leaves a promise rejected, the store crashes
  visibly, exactly as a customer's app would.
- **SDK configuration** — the object handed to `init()`. Shrink `batchSize`, shorten
  `flushIntervalMs`, or set `sampleRate` to 0 to see the edges.
- **Ingest server controls** — failure injection. Set the failure rate to 1 and watch your
  retry logic; add latency to see what happens while a request is in flight.
- **Ingest inspector** — every batch the server saw, newest first: status, attempt
  number, payload size, duplicate ids and the exact payload.
- **Status bar** — whatever `getDiagnostics()` returns.
- **Browser environment** — the conditions a real page puts an SDK in, as switches:
  storage that throws on every call, the ingest host unreachable with
  `navigator.onLine === false`, a background tab (hidden document, timers throttled
  to one wake-up a minute), and a 1 KB beacon quota. Flip them while events are in
  flight.
- **Plain-JS consumer** (`/plain.html`) — the same SDK in a page with no framework,
  next to a live diff of everything it added to `window`.

## Technical Requirements

- Implement the SDK inside `src/sdk`; keep the public signatures the demo imports.
- Don't change `mock-ingest/plugin.ts` or the wire types — they stand in for a server you
  don't control.
- Use TypeScript with proper type definitions; no `any`, no `@ts-ignore`.
- The SDK must not depend on React or on anything in `src/demo`.
- `pnpm build` (typecheck included) and `pnpm lint` should pass when you're done.
- No test suite ships with this repo. Add tests if you find them useful — you won't be
  penalized either way.

## What we're looking for

- **Correctness under failure.** Retries, backoff, and an explicit drop policy beat a happy
  path that only works when the server is healthy.
- **A public API that hides its machinery.** The host app should not be able to tell how
  queueing works.
- **Resilience.** A telemetry SDK that throws, floods the network, or leaks a timer is worse
  than no telemetry.
- **Clear structure and naming**, and comments where you made a judgment call.

We'd rather see requirements 1–4 done well than all six done halfway.

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start the development server:
   ```bash
   pnpm dev
   ```

3. Open your browser to the local development URL (typically `http://localhost:5173`)

4. Begin implementing in `src/sdk/index.ts`

## Available Scripts

- `pnpm dev` - Start the development server (app + mock ingest API)
- `pnpm build` - Typecheck and build for production
- `pnpm lint` - Run the linter (Biome)
- `pnpm preview` - Preview the production build

Good luck!
