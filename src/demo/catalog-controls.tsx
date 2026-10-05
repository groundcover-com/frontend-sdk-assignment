import { useEffect, useState } from 'react';

import { Description, Field, Label } from '../components/fieldset';
import { Input } from '../components/input';
import {
  type CatalogControls,
  getCatalogControls,
  updateCatalogControls,
} from './catalog-api';
import { Panel } from './panel';

/**
 * Failure injection on the store's own backend. Separate from the ingest
 * controls: this is the customer's API misbehaving, not ours.
 */
export function CatalogControlsPanel() {
  const [controls, setControls] = useState<CatalogControls>({
    failureRate: 0,
    latencyMs: 0,
  });

  useEffect(() => {
    getCatalogControls().then(setControls, () => {
      // Keep the defaults; the panel still works once the server answers.
    });
  }, []);

  const apply = (patch: Partial<CatalogControls>) => {
    setControls((current) => ({ ...current, ...patch }));
    updateCatalogControls(patch).then(setControls, () => {
      // The next successful update will resync.
    });
  };

  return (
    <Panel
      title="Store API controls"
      description="The store's own product API, the one its pages and stock widget call. Slow it down or make it fail; the store handles its own errors."
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <Field>
          <Label>Failure rate</Label>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.25}
            value={controls.failureRate}
            onChange={(event) =>
              apply({ failureRate: Number(event.target.value) })
            }
          />
          <Description>Share of requests that answer 503.</Description>
        </Field>
        <Field>
          <Label>Added latency (ms)</Label>
          <Input
            type="number"
            min={0}
            max={10000}
            step={250}
            value={controls.latencyMs}
            onChange={(event) =>
              apply({ latencyMs: Number(event.target.value) })
            }
          />
          <Description>Applies to every catalog request.</Description>
        </Field>
      </div>
    </Panel>
  );
}
