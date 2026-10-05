import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Plugin, ViteDevServer } from 'vite';

/**
 * Acme Store's own backend: a small product API served by the Vite dev server.
 * It has nothing to do with telemetry. It is here so the store makes real
 * network requests of its own, some slow and some failing, the way a
 * customer's app does.
 *
 * Routes
 *   GET  /api/catalog/products        the product list
 *   GET  /api/catalog/products/:sku   one product, 404 when unknown
 *   GET  /api/catalog/stock/:sku      units in stock for one product
 *   GET  /api/catalog/controls        current latency and failure settings
 *   POST /api/catalog/controls        { failureRate, latencyMs }
 */

export interface CatalogProduct {
  sku: string;
  name: string;
  price: number;
  description: string;
}

export interface CatalogControls {
  /** Fraction of catalog requests that answer 503, 0..1. */
  failureRate: number;
  /** Artificial delay before responding, in milliseconds. */
  latencyMs: number;
}

const PRODUCTS: CatalogProduct[] = [
  {
    sku: 'GC-TSHIRT',
    name: 'Observability T-shirt',
    price: 24,
    description: 'Soft cotton, printed with a flame graph that never ends.',
  },
  {
    sku: 'GC-MUG',
    name: 'Trace-colored Mug',
    price: 12,
    description: 'Holds 350 ml of coffee and one very long span.',
  },
  {
    sku: 'GC-HOODIE',
    name: 'p99 Hoodie',
    price: 68,
    description: 'For the tail latency nobody else wants to look at.',
  },
];

const controls: CatalogControls = { failureRate: 0, latencyMs: 0 };

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      raw += chunk;
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Stock moves a little on every read, so the widget has something to show. */
function stockFor(sku: string): number {
  let base = 0;
  for (let index = 0; index < sku.length; index += 1) {
    base += sku.charCodeAt(index);
  }
  base %= 40;
  return Math.max(0, base - 5 + Math.floor(Math.random() * 10));
}

async function handleControls(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method === 'POST') {
    let patch: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(await readBody(req));
      if (typeof parsed === 'object' && parsed !== null) {
        patch = parsed as Record<string, unknown>;
      }
    } catch {
      sendJson(res, 400, { ok: false, error: 'body is not valid JSON' });
      return;
    }
    if (typeof patch.failureRate === 'number') {
      controls.failureRate = Math.min(1, Math.max(0, patch.failureRate));
    }
    if (typeof patch.latencyMs === 'number') {
      controls.latencyMs = Math.min(10_000, Math.max(0, patch.latencyMs));
    }
  }
  sendJson(res, 200, { ok: true, controls });
}

async function handleCatalog(
  path: string,
  res: ServerResponse,
): Promise<boolean> {
  const product = /^\/api\/catalog\/products\/([^/]+)$/.exec(path);
  const stock = /^\/api\/catalog\/stock\/([^/]+)$/.exec(path);
  if (path !== '/api/catalog/products' && !product && !stock) return false;

  if (controls.latencyMs > 0) await sleep(controls.latencyMs);
  if (Math.random() < controls.failureRate) {
    sendJson(res, 503, { ok: false, error: 'catalog unavailable' });
    return true;
  }

  if (path === '/api/catalog/products') {
    sendJson(res, 200, { ok: true, products: PRODUCTS });
    return true;
  }

  const sku = decodeURIComponent((product ?? stock)?.[1] ?? '').toUpperCase();
  const match = PRODUCTS.find((candidate) => candidate.sku === sku);
  if (!match) {
    sendJson(res, 404, { ok: false, error: `no product ${sku}` });
    return true;
  }
  if (product) sendJson(res, 200, { ok: true, product: match });
  else sendJson(res, 200, { ok: true, sku, inStock: stockFor(sku) });
  return true;
}

function attach(
  server: ViteDevServer | { middlewares: ViteDevServer['middlewares'] },
): void {
  server.middlewares.use(async (req, res, next) => {
    const path = (req.url ?? '').split('?')[0];
    try {
      if (path === '/api/catalog/controls') {
        await handleControls(req, res);
        return;
      }
      if (req.method === 'GET' && (await handleCatalog(path, res))) return;
    } catch (error) {
      sendJson(res, 500, { ok: false, error: String(error) });
      return;
    }
    next();
  });
}

export function mockCatalog(): Plugin {
  return {
    name: 'mock-catalog',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
