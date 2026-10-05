import clsx from 'clsx';
import type React from 'react';
import { Fragment, useEffect, useRef, useState } from 'react';

import { Button } from '../components/button';
import { Input } from '../components/input';
import { captureError, flush, setUser, track, trackPageView } from '../sdk';
import {
  type CatalogProduct,
  fetchProduct,
  fetchProducts,
  fetchStock,
} from './catalog-api';
import {
  callSdk,
  clearHostFailures,
  useHostCrashCount,
  useHostFailures,
} from './host-health';
import { Panel } from './panel';
import { navigate, useRoute } from './router';
import { StoreCrash } from './store-crash';
import { type ClipPlayer, createClipPlayer } from './vendor/clip-player';

const DEMO_USER = {
  id: 'usr_4812',
  email: 'jane@example.com',
  attributes: { plan: 'pro' },
};

/** Order numbers continue from the store's existing order history. */
const FIRST_ORDER_ID = 88231;

interface CartItem {
  sku: string;
  name: string;
  price: number;
}

interface Order {
  id: number;
  total: number;
  items: number;
  email: string | null;
}

type Route =
  | { name: 'catalog' }
  | { name: 'product'; sku: string }
  | { name: 'cart' }
  | { name: 'checkout' }
  | { name: 'order'; id: number }
  | { name: 'unknown' };

const productPath = (sku: string) => `/products/${sku.toLowerCase()}`;
const orderPath = (id: number) => `/account/orders/${id}`;

function parseRoute(path: string): Route {
  if (path === '/') return { name: 'catalog' };
  if (path === '/cart') return { name: 'cart' };
  if (path === '/checkout') return { name: 'checkout' };
  const product = /^\/products\/([^/]+)\/?$/.exec(path);
  if (product) return { name: 'product', sku: product[1].toUpperCase() };
  const order = /^\/account\/orders\/(\d+)\/?$/.exec(path);
  if (order) return { name: 'order', id: Number(order[1]) };
  return { name: 'unknown' };
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

type Loadable<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; value: T };

/**
 * Loads once per mount and aborts if the component goes away first. To load
 * again, remount: see `Reloadable`.
 */
function useLoadOnMount<T>(
  load: (signal: AbortSignal) => Promise<T>,
): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ status: 'loading' });
  const loadRef = useRef(load);

  useEffect(() => {
    const controller = new AbortController();
    loadRef.current(controller.signal).then(
      (value) => setState({ status: 'ready', value }),
      (error: unknown) => {
        if (!isAbort(error)) setState({ status: 'error' });
      },
    );
    return () => controller.abort();
  }, []);

  return state;
}

/** Remounts what it renders on retry, so every attempt starts from a clean load. */
function Reloadable({
  render,
}: {
  render: (retry: () => void) => React.ReactNode;
}) {
  const [attempt, setAttempt] = useState(0);
  return (
    <Fragment key={attempt}>
      {render(() => setAttempt((count) => count + 1))}
    </Fragment>
  );
}

function Row({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span className="text-sm/6 text-gray-700 dark:text-gray-300">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** A real anchor with a real href — the router just keeps the page from reloading. */
function NavLink({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={to}
      onClick={(event) => {
        event.preventDefault();
        navigate(to);
      }}
      className={clsx(
        'rounded-md px-2 py-1 text-sm/6',
        active
          ? 'bg-gray-900/5 font-semibold text-gray-900 dark:bg-white/10 dark:text-white'
          : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white',
      )}
    >
      {children}
    </a>
  );
}

function BackLink({ to, children }: { to: string; children: string }) {
  return (
    <a
      href={to}
      onClick={(event) => {
        event.preventDefault();
        navigate(to);
      }}
      className="text-sm/6 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
    >
      {children}
    </a>
  );
}

function Notice({
  children,
  onRetry,
}: {
  children: React.ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <p className="text-sm/6 text-gray-500 dark:text-gray-400">{children}</p>
      {onRetry ? (
        <Button outline onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The host application: a small single-page store with its own client-side
 * routing and its own backend. It only ever touches the SDK's public API.
 */
export function StorePanel() {
  const path = useRoute();
  const route = parseRoute(path);
  const failures = useHostFailures();
  const crashCount = useHostCrashCount();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribed, setSubscribed] = useState<string | null>(null);

  // The store reports its own page views: the router owns navigation, so the
  // router's caller is the one that knows a page changed. The ref keeps
  // StrictMode's double-run effect from reporting the same page twice.
  const lastReportedPath = useRef<string | null>(null);
  useEffect(() => {
    if (lastReportedPath.current === path) return;
    lastReportedPath.current = path;
    callSdk('trackPageView()', () => trackPageView());
  }, [path]);

  const total = cart.reduce((sum, item) => sum + item.price, 0);

  const lines = [...new Set(cart.map((item) => item.sku))].map((sku) => {
    const items = cart.filter((item) => item.sku === sku);
    return { ...items[0], quantity: items.length };
  });

  const addToCart = (product: CatalogProduct) => {
    setCart((current) => [
      ...current,
      { sku: product.sku, name: product.name, price: product.price },
    ]);
    callSdk("track('add_to_cart')", () =>
      track('add_to_cart', {
        sku: product.sku,
        price: product.price,
        cart_size: cart.length + 1,
      }),
    );
  };

  const placeOrder = () => {
    const order: Order = {
      id: FIRST_ORDER_ID + orders.length,
      total,
      items: cart.length,
      email: signedIn ? DEMO_USER.email : null,
    };
    setOrders((current) => [...current, order]);
    callSdk("track('checkout_completed')", () =>
      track('checkout_completed', {
        order_id: order.id,
        total: order.total,
        items: order.items,
      }),
    );
    setCart([]);
    navigate(orderPath(order.id));
  };

  const toggleUser = () => {
    if (signedIn) {
      callSdk("track('sign_out')", () => track('sign_out'));
      callSdk('setUser(null)', () => setUser(null));
    } else {
      callSdk('setUser(user)', () => setUser(DEMO_USER));
      callSdk("track('sign_in')", () =>
        track('sign_in', { method: 'password' }),
      );
    }
    setSignedIn(!signedIn);
  };

  const subscribe = () => {
    const email = newsletterEmail.trim();
    if (!email.includes('@')) return;
    callSdk("track('newsletter_signup')", () =>
      track('newsletter_signup', { email, source: 'store_footer' }),
    );
    setSubscribed(email);
    setNewsletterEmail('');
  };

  const reloadStore = () => {
    clearHostFailures();
    setCart([]);
    navigate('/');
  };

  const order =
    route.name === 'order'
      ? orders.find((candidate) => candidate.id === route.id)
      : undefined;

  return (
    <Panel
      title="Acme Store (the host app)"
      description="A real host application: it routes client-side, calls its own product API and only ever calls the SDK's public API. If the SDK throws into it or leaves a promise rejected, the store breaks — exactly as a customer's app would."
    >
      {failures.length > 0 ? (
        <StoreCrash
          failures={failures}
          crashCount={crashCount}
          onReload={reloadStore}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <nav className="flex flex-wrap items-center gap-1 border-b border-gray-900/5 pb-3 dark:border-white/10">
            <NavLink to="/" active={route.name === 'catalog'}>
              Catalog
            </NavLink>
            <NavLink to="/cart" active={route.name === 'cart'}>
              Cart ({cart.length})
            </NavLink>
            <NavLink to="/checkout" active={route.name === 'checkout'}>
              Checkout
            </NavLink>
            <span className="ml-auto font-mono text-xs text-gray-500 dark:text-gray-400">
              {path}
            </span>
          </nav>

          {route.name === 'catalog' ? (
            <Reloadable
              render={(retry) => (
                <CatalogList onAddToCart={addToCart} onRetry={retry} />
              )}
            />
          ) : null}

          {route.name === 'product' ? (
            <Reloadable
              key={route.sku}
              render={(retry) => (
                <ProductDetail
                  sku={route.sku}
                  onAddToCart={addToCart}
                  onRetry={retry}
                />
              )}
            />
          ) : null}

          {route.name === 'cart' ? (
            <div className="flex flex-col gap-3">
              {lines.length === 0 ? (
                <p className="py-3 text-sm/6 text-gray-500 dark:text-gray-400">
                  Your cart is empty.
                </p>
              ) : (
                <div className="divide-y divide-gray-900/5 dark:divide-white/10">
                  {lines.map((line) => (
                    <Row
                      key={line.sku}
                      label={`${line.name} × ${line.quantity}`}
                    >
                      <span className="font-mono text-sm/6 text-gray-700 tabular-nums dark:text-gray-300">
                        ${line.price * line.quantity}
                      </span>
                    </Row>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm/6 font-semibold text-gray-900 dark:text-white">
                  Total ${total}
                </span>
                <Button
                  color="indigo"
                  disabled={cart.length === 0}
                  onClick={() => navigate('/checkout')}
                >
                  Checkout
                </Button>
              </div>
            </div>
          ) : null}

          {route.name === 'checkout' ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm/6 text-gray-700 dark:text-gray-300">
                {cart.length === 0
                  ? 'Nothing to order yet.'
                  : `${cart.length} item(s) · $${total} · paying as ${
                      signedIn ? DEMO_USER.email : 'a guest'
                    }`}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <BackLink to="/cart">Back to cart</BackLink>
                <Button
                  color="indigo"
                  disabled={cart.length === 0}
                  onClick={placeOrder}
                >
                  Place order
                </Button>
              </div>
            </div>
          ) : null}

          {route.name === 'order' ? (
            <div className="flex flex-col gap-3">
              {order ? (
                <>
                  <h3 className="text-sm/6 font-semibold text-gray-900 dark:text-white">
                    Order #{order.id} confirmed
                  </h3>
                  <p className="text-sm/6 text-gray-700 dark:text-gray-300">
                    {order.items} item(s) · ${order.total} · receipt sent to{' '}
                    {order.email ?? 'the address you gave us'}
                  </p>
                </>
              ) : (
                <p className="py-3 text-sm/6 text-gray-700 dark:text-gray-300">
                  We couldn't find order #{route.id}.
                </p>
              )}
              <div>
                <BackLink to="/">Continue shopping</BackLink>
              </div>
            </div>
          ) : null}

          {route.name === 'unknown' ? (
            <div className="flex flex-col gap-3 py-3">
              <p className="text-sm/6 text-gray-700 dark:text-gray-300">
                No such page: <code className="font-mono text-xs">{path}</code>
              </p>
              <div>
                <Button outline onClick={() => navigate('/')}>
                  Back to catalog
                </Button>
              </div>
            </div>
          ) : null}

          <div className="divide-y divide-gray-900/5 border-t border-gray-900/5 dark:divide-white/10 dark:border-white/10">
            <Row
              label={
                signedIn
                  ? `Signed in as ${DEMO_USER.email}`
                  : 'Anonymous visitor'
              }
            >
              <Button outline onClick={toggleUser}>
                {signedIn ? 'Sign out' : 'Sign in'}
              </Button>
            </Row>

            <Row
              label={
                subscribed
                  ? `Newsletter · subscribed ${subscribed}`
                  : 'Newsletter'
              }
            >
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  subscribe();
                }}
              >
                <div className="w-48">
                  <Input
                    type="email"
                    aria-label="Email for the newsletter"
                    placeholder="you@example.com"
                    value={newsletterEmail}
                    onChange={(event) => setNewsletterEmail(event.target.value)}
                  />
                </div>
                <Button outline type="submit">
                  Subscribe
                </Button>
              </form>
            </Row>

            <Row label="Traffic burst · 25 events at once">
              <Button
                outline
                onClick={() => {
                  for (let index = 0; index < 25; index += 1) {
                    callSdk("track('scroll_depth')", () =>
                      track('scroll_depth', { percent: index * 4 }),
                    );
                  }
                }}
              >
                Fire 25 events
              </Button>
            </Row>

            <Row label="Errors">
              <Button
                outline
                onClick={() =>
                  callSdk('captureError(error)', () =>
                    captureError(new Error('Payment declined'), {
                      gateway: 'stripe',
                    }),
                  )
                }
              >
                Handled error
              </Button>
              <Button
                outline
                onClick={() => {
                  // Thrown by the store itself, not by the SDK: this is the
                  // material `captureErrors: true` is supposed to pick up, and
                  // it must never be blamed on the SDK.
                  setTimeout(() => {
                    throw new Error('Uncaught render failure');
                  }, 0);
                }}
              >
                Uncaught error
              </Button>
              <Button
                outline
                onClick={() => {
                  void Promise.reject(
                    new Error('Unhandled rejection in checkout'),
                  );
                }}
              >
                Unhandled rejection
              </Button>
            </Row>

            <Row label="Send everything queued now">
              <Button
                color="dark/zinc"
                onClick={() => void callSdk('flush()', () => flush())}
              >
                flush()
              </Button>
            </Row>
          </div>
        </div>
      )}
    </Panel>
  );
}

function CatalogList({
  onAddToCart,
  onRetry,
}: {
  onAddToCart: (product: CatalogProduct) => void;
  onRetry: () => void;
}) {
  const products = useLoadOnMount((signal) => fetchProducts(signal));

  if (products.status === 'loading') return <Notice>Loading products…</Notice>;
  if (products.status === 'error') {
    return <Notice onRetry={onRetry}>The catalog didn't load.</Notice>;
  }

  return (
    <div className="divide-y divide-gray-900/5 dark:divide-white/10">
      {products.value.map((product) => (
        <Row key={product.sku} label={`${product.name} · $${product.price}`}>
          <Button plain onClick={() => navigate(productPath(product.sku))}>
            View
          </Button>
          <Button outline onClick={() => onAddToCart(product)}>
            Add to cart
          </Button>
        </Row>
      ))}
    </div>
  );
}

function ProductDetail({
  sku,
  onAddToCart,
  onRetry,
}: {
  sku: string;
  onAddToCart: (product: CatalogProduct) => void;
  onRetry: () => void;
}) {
  const product = useLoadOnMount((signal) => fetchProduct(sku, signal));

  if (product.status === 'loading') return <Notice>Loading product…</Notice>;
  if (product.status === 'error') {
    return <Notice onRetry={onRetry}>This product didn't load.</Notice>;
  }

  const item = product.value;
  if (!item) {
    return (
      <div className="flex flex-col gap-3 py-3">
        <p className="text-sm/6 text-gray-700 dark:text-gray-300">
          We no longer carry <code className="font-mono text-xs">{sku}</code>.
        </p>
        <div>
          <Button outline onClick={() => navigate('/')}>
            Back to catalog
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-1">
      <div>
        <h3 className="text-sm/6 font-semibold text-gray-900 dark:text-white">
          {item.name}
        </h3>
        <p className="font-mono text-sm/6 text-gray-500 dark:text-gray-400">
          ${item.price} · {item.sku} · <StockBadge sku={item.sku} />
        </p>
        <p className="mt-1 text-sm/6 text-gray-700 dark:text-gray-300">
          {item.description}
        </p>
      </div>
      <ProductVideo />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink to="/">Back to catalog</BackLink>
        <Button outline onClick={() => onAddToCart(item)}>
          Add to cart
        </Button>
      </div>
    </div>
  );
}

/** Live stock level, from the widget that still uses XMLHttpRequest. */
function StockBadge({ sku }: { sku: string }) {
  const [stock, setStock] = useState<Loadable<number>>({ status: 'loading' });

  useEffect(() => {
    const request = fetchStock(sku);
    let active = true;
    request.done.then(
      (value) => {
        if (active) setStock({ status: 'ready', value });
      },
      () => {
        if (active) setStock({ status: 'error' });
      },
    );
    return () => {
      active = false;
      request.abort();
    };
  }, [sku]);

  if (stock.status === 'loading') return <span>checking stock…</span>;
  if (stock.status === 'error') return <span>stock unavailable</span>;
  return (
    <span>
      {stock.value === 0 ? 'out of stock' : `${stock.value} in stock`}
    </span>
  );
}

/** The product video, played by the vendor player the store embeds. */
function ProductVideo() {
  const playerRef = useRef<ClipPlayer | null>(null);
  const [view, setView] = useState<{
    state: ClipPlayer['state'];
    progress: number;
  }>({ state: 'idle', progress: 0 });

  useEffect(() => {
    const player = createClipPlayer({ duration: 20 });
    playerRef.current = player;
    const sync = () =>
      setView({
        state: player.state,
        progress: player.currentTime / player.duration,
      });
    const events = [
      'play',
      'pause',
      'buffering',
      'playing',
      'timeupdate',
      'ended',
    ] as const;
    for (const event of events) player.on(event, sync);
    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, []);

  const playing = view.state === 'playing' || view.state === 'buffering';

  return (
    <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 ring-1 ring-gray-900/5 ring-inset dark:bg-white/5 dark:ring-white/10">
      <Button
        outline
        onClick={() =>
          playing ? playerRef.current?.pause() : playerRef.current?.play()
        }
      >
        {playing ? 'Pause' : view.state === 'ended' ? 'Replay' : 'Play'}
      </Button>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
        <div
          className="h-full bg-indigo-600 dark:bg-indigo-400"
          style={{ width: `${Math.round(view.progress * 100)}%` }}
        />
      </div>
      <span className="w-20 text-right font-mono text-xs text-gray-500 dark:text-gray-400">
        {view.state === 'buffering' ? 'buffering…' : 'product video'}
      </span>
    </div>
  );
}
