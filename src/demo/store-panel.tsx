import type React from 'react';
import { useState } from 'react';
import { Button } from '../components/button';
import { captureError, flush, setUser, track, trackPageView } from '../sdk';
import { Panel } from './panel';

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

/**
 * A stand-in for the host application. Every button below is a call into the
 * SDK's public surface — nothing here knows how events are queued or sent.
 */
export function StorePanel() {
  const [cart, setCart] = useState<string[]>([]);
  const [signedIn, setSignedIn] = useState(false);

  const addToCart = (sku: string, price: number) => {
    setCart((current) => [...current, sku]);
    track('add_to_cart', { sku, price, cart_size: cart.length + 1 });
  };

  const checkout = () => {
    const total = cart.reduce(
      (sum, sku) => sum + (PRODUCTS.find((p) => p.sku === sku)?.price ?? 0),
      0,
    );
    track('checkout_completed', { total, items: cart.length });
    setCart([]);
  };

  const toggleUser = () => {
    if (signedIn) {
      track('sign_out');
      setUser(null);
    } else {
      setUser(DEMO_USER);
      track('sign_in', { method: 'password' });
    }
    setSignedIn(!signedIn);
  };

  return (
    <Panel
      title="Acme Store (the host app)"
      description="Ordinary product interactions. Each one calls track(), trackPageView() or setUser()."
    >
      <div className="divide-y divide-gray-900/5 dark:divide-white/10">
        {PRODUCTS.map((product) => (
          <Row key={product.sku} label={`${product.name} · $${product.price}`}>
            <Button
              plain
              onClick={() =>
                trackPageView(`/products/${product.sku.toLowerCase()}`, {
                  sku: product.sku,
                })
              }
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

        <Row label={`Cart · ${cart.length} item(s)`}>
          <Button
            color="indigo"
            disabled={cart.length === 0}
            onClick={checkout}
          >
            Checkout
          </Button>
        </Row>

        <Row
          label={
            signedIn ? `Signed in as ${DEMO_USER.email}` : 'Anonymous visitor'
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
                track('scroll_depth', { percent: index * 4 });
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
              captureError(new Error('Payment declined'), {
                gateway: 'stripe',
              })
            }
          >
            Handled error
          </Button>
          <Button
            outline
            onClick={() => {
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
              void Promise.reject(new Error('Unhandled rejection in checkout'));
            }}
          >
            Unhandled rejection
          </Button>
        </Row>

        <Row label="Send whatever is queued right now">
          <Button color="dark/zinc" onClick={() => void flush()}>
            flush()
          </Button>
        </Row>
      </div>
    </Panel>
  );
}
