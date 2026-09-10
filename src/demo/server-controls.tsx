import { Button } from '../components/button';
import { Description, Field, Label } from '../components/fieldset';
import { Input } from '../components/input';
import { Select } from '../components/select';
import type { FailStatus, IngestControls } from './ingest-api';
import { resetInbox, updateControls } from './ingest-api';
import { Panel } from './panel';

/**
 * Failure injection on the mock ingest server. Use it to exercise retries,
 * backoff and drop policy without touching the SDK.
 */
export function ServerControls({
  controls,
  onChanged,
}: {
  controls: IngestControls | null;
  onChanged: () => void;
}) {
  const current: IngestControls = controls ?? {
    failureRate: 0,
    failStatus: 500,
    latencyMs: 0,
  };

  const apply = async (patch: Partial<IngestControls>) => {
    await updateControls(patch);
    onChanged();
  };

  return (
    <Panel
      title="Ingest server controls"
      description="The mock server rejects this share of batches so you can watch retries happen."
      actions={
        <Button
          outline
          onClick={async () => {
            await resetInbox();
            onChanged();
          }}
        >
          Clear inbox
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-3">
        <Field>
          <Label>Failure rate</Label>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.25}
            value={current.failureRate}
            onChange={(event) =>
              void apply({ failureRate: Number(event.target.value) })
            }
          />
          <Description>0 = healthy, 1 = every batch fails.</Description>
        </Field>
        <Field>
          <Label>Failure status</Label>
          <Select
            value={String(current.failStatus)}
            onChange={(event) =>
              void apply({
                failStatus: Number(event.target.value) as FailStatus,
              })
            }
          >
            <option value="500">500 Internal Server Error</option>
            <option value="503">503 Service Unavailable</option>
            <option value="429">429 Too Many Requests</option>
          </Select>
          <Description>429 comes back with a Retry-After header.</Description>
        </Field>
        <Field>
          <Label>Added latency (ms)</Label>
          <Input
            type="number"
            min={0}
            max={10000}
            step={250}
            value={current.latencyMs}
            onChange={(event) =>
              void apply({ latencyMs: Number(event.target.value) })
            }
          />
          <Description>
            Slow responses, for testing in-flight behavior.
          </Description>
        </Field>
      </div>
    </Panel>
  );
}
