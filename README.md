# Frontend SDK Assignment

## Overview

You'll build a small browser telemetry SDK, the kind a product embeds on its customers'
websites. It captures events from the host application, batches them, and delivers them
to an ingest endpoint. It has to be careful with the network, honest about what it
dropped, and it must never break the page it lives on.

This is a live session. Use whatever tools you normally use, AI included. Once the base
works, we'll bring you a few change requests and extend your code together.

## What's here

| Path                            | What it is                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `src/sdk/index.ts`              | **The public API you implement.** The signatures are given; the bodies are not.        |
| `src/sdk/types.ts`              | Config types and wire types. The wire types are fixed: the server validates them.      |
| `src/demo/host-telemetry.ts`    | The store's own telemetry setup, the code a customer writes to start your SDK.         |
| `src/demo/`                     | The playground around it: the store, the config form, the inspector and the controls.  |
| `plain.html`                    | The same SDK in a page with no framework, with a check for anything added to `window`. |
| `mock-ingest/`, `mock-catalog/` | Fake servers: the telemetry ingest API, and the store's own product API.               |

Run `pnpm dev`. The store on the left calls the SDK; the inspector on the right shows what
reached the server. Right now nothing does: the stubs only log that they're not implemented.

## The task

Implement the SDK in `src/sdk`. Split it into as many files as you like. The fixed points
are the public signatures and the wire format.

**Initialization**

- `init(config)` applies the documented defaults and rejects a config without `apiKey` or
  `endpoint`, without throwing into the host.
- A second `init()` must not end up with two timers or two sets of listeners.
- Each session gets an id and a start time, carried on every batch.
- `sampleRate` is decided once per session. A sampled-out session sends nothing.

**Capture**

- `track`, `trackPageView`, `captureError` and `setUser` work as their doc comments say.
  `captureError` accepts anything a `catch` block can produce.
- Every event has a unique `id`, a `timestamp` from when it happened, and a `seq` that
  increases within the session.
- With `captureErrors: true`, uncaught errors and unhandled rejections are captured.
- All calls are safe before `init()` and after `shutdown()`. Decide what happens then and
  say so in a comment.

**Batching**

- Flush when the queue reaches `batchSize`, on a `flushIntervalMs` timer, and on `flush()`.
  `flush()` resolves once the queue drains or is given up on, and never rejects.
- Flush when the page goes away. `fetch` gets cancelled on unload; `navigator.sendBeacon`
  is the tool for this, which is why `apiKey` travels in the body.
- Cap the queue at `maxQueueSize`, pick a drop policy, and count what you drop.
- Keep one request in flight at a time.

**Delivery**

- `POST` each batch as JSON to `config.endpoint`. Any 2xx is a success.
- Retry `5xx`, `429` and network failures with exponential backoff and jitter, up to
  `maxRetries` attempts including the first. Report the attempt number in `attempt`.
- Don't retry `400` or `401`. Drop those events and record why.
- Don't lose events across a retry, and don't send any event twice. The inspector flags
  duplicates.

**Shutdown**

- `shutdown()` flushes, then releases timers and listeners. A later `init()` starts again.

`getDiagnostics()` is optional. Fill in whatever helps you see what's going on.

## The wire contract

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
      "type": "custom", // custom | page_view | error
      "name": "add_to_cart",
      "timestamp": 1737550000123,
      "seq": 7,
      "attributes": { "sku": "GC-MUG", "price": 12 },
    },
  ],
  "sentAt": 1737550000456,
  "attempt": 1,
}
```

| Status                | When                                                           | Retryable |
| --------------------- | -------------------------------------------------------------- | --------- |
| `202`                 | accepted, with a count of duplicates                           | —         |
| `400`                 | malformed batch; the body says why, and the inspector shows it | no        |
| `401`                 | wrong `apiKey`                                                 | no        |
| `429` / `500` / `503` | injected failure, per the ingest controls                      | yes       |

## The playground

- **Acme Store** is the host app. It routes client-side, loads products from its own API,
  and reports its own page views. If the SDK throws into it or leaves a promise rejected,
  it crashes visibly, as a customer's app would.
- **SDK configuration** is the object handed to `init()`.
- **Ingest server controls** inject failures and latency into the telemetry endpoint.
- **Store API controls** do the same to the store's own product API.
- **Browser environment** simulates an unreachable ingest host, a background tab with
  throttled timers, and a 1 KB beacon quota.
- **Ingest inspector** lists every batch the server saw: status, attempt, size, duplicate
  ids and the payload.

## Rules

- Keep the public signatures in `src/sdk/index.ts`.
- Don't change the mock servers or the wire types.
- TypeScript throughout: no `any`, no `@ts-ignore`.
- The SDK must not depend on React or on anything in `src/demo`.
- `pnpm check` passes. It covers formatting, lint and types.

## What we're looking for

- **Correctness under failure.** Retries, backoff and an explicit drop policy beat a happy
  path that only works when the server is healthy.
- **A public API that hides its machinery.** The host shouldn't be able to tell how
  queueing works.
- **Resilience.** A telemetry SDK that throws, floods the network or leaks a timer is
  worse than no telemetry.
- **Clear structure and naming**, with comments where you made a judgment call.

## Getting started

You need pnpm. The project pins Node 24 and pnpm 12, and pnpm downloads either one if
yours differs.

```bash
pnpm install
pnpm dev
```

Open the local URL Vite prints, usually `http://localhost:5173`.

The toolchain is [Vite+](https://viteplus.dev): Vite, Vitest, Oxlint, Oxfmt and type
checking behind one `vp` command. It's installed with the project, so a global install
is optional.

| Script       | What it does                                     |
| ------------ | ------------------------------------------------ |
| `pnpm dev`   | Dev server, with both mock servers               |
| `pnpm check` | Formatting, lint and type checks                 |
| `pnpm fix`   | Fix what the formatter and linter can            |
| `pnpm test`  | Vitest. No tests ship; add them if they help you |
| `pnpm build` | Production build                                 |
