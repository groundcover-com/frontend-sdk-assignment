/**
 * The store's client for its own product API (`mock-catalog/plugin.ts`).
 * Ordinary application code: it knows nothing about telemetry.
 */

export interface CatalogProduct {
  sku: string;
  name: string;
  price: number;
  description: string;
}

export interface CatalogControls {
  failureRate: number;
  latencyMs: number;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchProducts(
  signal?: AbortSignal,
): Promise<CatalogProduct[]> {
  const body = await getJson<{ products: CatalogProduct[] }>(
    '/api/catalog/products',
    signal,
  );
  return body.products;
}

/** Resolves to null when the store no longer carries the product. */
export async function fetchProduct(
  sku: string,
  signal?: AbortSignal,
): Promise<CatalogProduct | null> {
  const url = `/api/catalog/products/${encodeURIComponent(sku)}`;
  const response = await fetch(url, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  const body = (await response.json()) as { product: CatalogProduct };
  return body.product;
}

/**
 * The stock widget predates the move to fetch and still talks
 * XMLHttpRequest. Nobody has had a reason to rewrite it.
 */
export function fetchStock(sku: string): {
  done: Promise<number>;
  abort: () => void;
} {
  const xhr = new XMLHttpRequest();
  const done = new Promise<number>((resolve, reject) => {
    xhr.open('GET', `/api/catalog/stock/${encodeURIComponent(sku)}`);
    xhr.responseType = 'json';
    xhr.onload = () => {
      const body = xhr.response as { inStock?: number } | null;
      if (xhr.status === 200 && typeof body?.inStock === 'number') {
        resolve(body.inStock);
      } else {
        reject(new Error(`stock request answered ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('stock request failed'));
    xhr.onabort = () => reject(new Error('stock request aborted'));
    xhr.send();
  });
  return { done, abort: () => xhr.abort() };
}

export async function getCatalogControls(): Promise<CatalogControls> {
  const body = await getJson<{ controls: CatalogControls }>(
    '/api/catalog/controls',
  );
  return body.controls;
}

export async function updateCatalogControls(
  patch: Partial<CatalogControls>,
): Promise<CatalogControls> {
  const response = await fetch('/api/catalog/controls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const body = (await response.json()) as { controls: CatalogControls };
  return body.controls;
}
