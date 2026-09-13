import clsx from 'clsx';
import type React from 'react';
import { useState } from 'react';
import { Button } from '../components/button';
import { captureError, flush, setUser, track, trackPageView } from '../sdk';
import {
  callSdk,
  clearHostFailures,
  useHostCrashCount,
  useHostFailures,
} from './host-health';
import { Panel } from './panel';
import { navigate, useRoute } from './router';
import { StoreCrash } from './store-crash';

const PRODUCTS = [
  { sku: 'GC-TSHIRT', name: 'Observability T-shirt', price: 24 },
  { sku: 'GC-MUG', name: 'Trace-colored Mug', price: 12 },
  { sku: 'GC-HOODIE', name: 'p99 Hoodie', price: 68 },
];

const DEMO_USER = {
  id: 'usr_4812',
  email: 'jane@example.com',
  attributes: { plan: 'pro' },
};

type Route =
  | { name: 'catalog' }
  | { name: 'product'; sku: string }
  | { name: 'cart' }
  | { name: 'checkout' }
  | { name: 'unknown' };

const productPath = (sku: string) => `/products/${sku.toLowerCase()}`;

function parseRoute(path: string): Route {
  if (path === '/') return { name: 'catalog' };
  if (path === '/cart') return { name: 'cart' };
  if (path === '/checkout') return { name: 'checkout' };
  const product = /^\/products\/([^/]+)\/?$/.exec(path);
  if (product) return { name: 'product', sku: product[1].toUpperCase() };
  return { name: 'unknown' };
}

function Row({
  label,
  children,
}: {
  label: string;
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

/**
 * The host application: a small single-page store that routes client-side and
 * only ever touches the SDK's public API.
 */
export function StorePanel() {
  // The router owns navigation; telemetry does not. Nothing in this store calls
  // trackPageView() when the route changes — with `autoPageViews: true` that is
  // the SDK's job: it has to notice the navigation itself and emit the
  // page_view. The trackPageView() button under "Manual calls" only keeps the
  // explicit API exercised.
  const path = useRoute();
  const route = parseRoute(path);
  const failures = useHostFailures();
  const crashCount = useHostCrashCount();
  const [cart, setCart] = useState<string[]>([]);
  const [signedIn, setSignedIn] = useState(false);

  const total = cart.reduce(
    (sum, sku) => sum + (PRODUCTS.find((p) => p.sku === sku)?.price ?? 0),
    0,
  );

  const lines = PRODUCTS.filter((product) => cart.includes(product.sku)).map(
    (product) => ({
      ...product,
      quantity: cart.filter((sku) => sku === product.sku).length,
    }),
  );

  const addToCart = (sku: string, price: number) => {
    setCart((current) => [...current, sku]);
    callSdk("track('add_to_cart')", () =>
      track('add_to_cart', { sku, price, cart_size: cart.length + 1 }),
    );
  };

  const placeOrder = () => {
    callSdk("track('checkout_completed')", () =>
      track('checkout_completed', { total, items: cart.length }),
    );
    setCart([]);
    navigate('/');
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

  const reloadStore = () => {
    clearHostFailures();
    setCart([]);
    navigate('/');
  };

  return (
    <Panel
      title="Acme Store (the host app)"
      description="A real host application: it routes client-side and only ever calls the SDK's public API. If the SDK throws into it or leaves a promise rejected, the store breaks — exactly as a customer's app would."
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
            <div className="divide-y divide-gray-900/5 dark:divide-white/10">
              {PRODUCTS.map((product) => (
                <Row
                  key={product.sku}
                  label={`${product.name} · $${product.price}`}
                >
                  <Button
                    plain
                    onClick={() => navigate(productPath(product.sku))}
                  >
                    View
                  </Button>
                  <Button
                    outline
                    onClick={() => addToCart(product.sku, product.price)}
                  >
                    Add to cart
                  </Button>
                </Row>
              ))}
            </div>
          ) : null}

          {route.name === 'product' ? (
            <ProductDetail sku={route.sku} onAddToCart={addToCart} />
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
                <a
                  href="/cart"
                  onClick={(event) => {
                    event.preventDefault();
                    navigate('/cart');
                  }}
                  className="text-sm/6 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  Back to cart
                </a>
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

            <Row label="Manual calls · the explicit API, unrelated to routing">
              <Button
                outline
                onClick={() =>
                  callSdk('trackPageView()', () => trackPageView())
                }
              >
                trackPageView()
              </Button>
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

function ProductDetail({
  sku,
  onAddToCart,
}: {
  sku: string;
  onAddToCart: (sku: string, price: number) => void;
}) {
  const product = PRODUCTS.find((candidate) => candidate.sku === sku);

  if (!product) {
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
    <div className="flex flex-col gap-3 py-1">
      <div>
        <h3 className="text-sm/6 font-semibold text-gray-900 dark:text-white">
          {product.name}
        </h3>
        <p className="font-mono text-sm/6 text-gray-500 dark:text-gray-400">
          ${product.price} · {product.sku}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate('/');
          }}
          className="text-sm/6 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          Back to catalog
        </a>
        <Button outline onClick={() => onAddToCart(product.sku, product.price)}>
          Add to cart
        </Button>
      </div>
    </div>
  );
}
