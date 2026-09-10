import { useState } from 'react';
import { Button } from '../components/button';
import { Description, Field, Label } from '../components/fieldset';
import { Input } from '../components/input';
import { init, shutdown } from '../sdk';
import type { TelemetryConfig } from '../sdk/types';
import { DEMO_API_KEY, INGEST_PATH } from './constants';
import { Panel } from './panel';

/** Mirrors the defaults documented on `TelemetryConfig`. */
const INITIAL_CONFIG = {
  apiKey: DEMO_API_KEY,
  endpoint: INGEST_PATH,
  batchSize: 10,
  flushIntervalMs: 5000,
  maxQueueSize: 100,
  maxRetries: 3,
  retryBaseDelayMs: 500,
  sampleRate: 1,
  captureErrors: false,
};

type DemoConfig = typeof INITIAL_CONFIG;

function NumberField({
  label,
  description,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field>
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {description ? <Description>{description}</Description> : null}
    </Field>
  );
}

export function SdkConfigPanel({ initialized }: { initialized: boolean }) {
  const [config, setConfig] = useState<DemoConfig>(INITIAL_CONFIG);

  const patch = <K extends keyof DemoConfig>(key: K, value: DemoConfig[K]) =>
    setConfig((current) => ({ ...current, [key]: value }));

  const handleInit = () => {
    const telemetryConfig: TelemetryConfig = { ...config };
    init(telemetryConfig);
  };

  return (
    <Panel
      title="SDK configuration"
      description="Passed straight to init(). Change a value and re-initialize to see how the SDK behaves."
      actions={
        <>
          <Button outline onClick={() => void shutdown()}>
            Shutdown
          </Button>
          <Button color="indigo" onClick={handleInit}>
            {initialized ? 'Re-initialize' : 'Initialize SDK'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <Label>API key</Label>
          <Input
            value={config.apiKey}
            onChange={(event) => patch('apiKey', event.target.value)}
          />
          <Description>
            The ingest server accepts <code>{DEMO_API_KEY}</code> and answers
            401 for anything else.
          </Description>
        </Field>
        <Field className="sm:col-span-2">
          <Label>Endpoint</Label>
          <Input
            value={config.endpoint}
            onChange={(event) => patch('endpoint', event.target.value)}
          />
        </Field>
        <NumberField
          label="Batch size"
          value={config.batchSize}
          min={1}
          onChange={(value) => patch('batchSize', value)}
        />
        <NumberField
          label="Flush interval (ms)"
          value={config.flushIntervalMs}
          min={100}
          step={100}
          onChange={(value) => patch('flushIntervalMs', value)}
        />
        <NumberField
          label="Max queue size"
          value={config.maxQueueSize}
          min={1}
          onChange={(value) => patch('maxQueueSize', value)}
        />
        <NumberField
          label="Max retries"
          value={config.maxRetries}
          min={1}
          onChange={(value) => patch('maxRetries', value)}
        />
        <NumberField
          label="Retry base delay (ms)"
          value={config.retryBaseDelayMs}
          min={0}
          step={50}
          onChange={(value) => patch('retryBaseDelayMs', value)}
        />
        <NumberField
          label="Sample rate"
          description="0 drops every session, 1 keeps every session."
          value={config.sampleRate}
          min={0}
          max={1}
          step={0.1}
          onChange={(value) => patch('sampleRate', value)}
        />
        <Field className="sm:col-span-2">
          <label className="flex items-center gap-3 text-sm/6 text-gray-900 dark:text-white">
            <input
              type="checkbox"
              checked={config.captureErrors}
              onChange={(event) => patch('captureErrors', event.target.checked)}
              className="size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 dark:border-white/15 dark:bg-white/5"
            />
            Capture uncaught errors and unhandled rejections automatically
          </label>
        </Field>
      </div>
    </Panel>
  );
}
