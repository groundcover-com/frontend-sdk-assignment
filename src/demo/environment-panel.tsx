import { useEffect, useState } from 'react';

import { Button } from '../components/button';
import { Description, Label } from '../components/fieldset';
import { Switch, SwitchField } from '../components/switch';
import type { HostileEnv } from './hostile-env';
import { resetHostileEnv, setHostileEnv, useHostileEnv } from './hostile-env';
import { Panel } from './panel';

interface Toggle {
  key: keyof HostileEnv;
  label: string;
  description: string;
  apply: (on: boolean) => void;
}

const TOGGLES: Toggle[] = [
  {
    key: 'offline',
    label: 'Ingest host unreachable',
    description:
      'navigator.onLine reads false, fetch to the ingest endpoint fails with a TypeError, and sendBeacon returns true while dropping the payload.',
    apply: (on) => setHostileEnv({ offline: on }),
  },
  {
    key: 'backgroundTab',
    label: 'Background tab',
    description:
      'The document reports hidden and every timer wakes at most once a minute, the way Chrome throttles a tab you switched away from.',
    apply: (on) => setHostileEnv({ backgroundTab: on }),
  },
  {
    key: 'tinyBeaconQuota',
    label: '1 KB beacon quota',
    description:
      'sendBeacon refuses a body over 1 KB and a keepalive fetch of one fails, the way a browser turns down a beacon over its quota.',
    apply: (on) => setHostileEnv({ tinyBeaconQuota: on }),
  },
];

interface Readouts {
  onLine: boolean;
  visibility: string;
}

function readEnvironment(): Readouts {
  return {
    onLine: navigator.onLine,
    visibility: document.visibilityState,
  };
}

function Readout({
  label,
  value,
  bad,
}: {
  label: string;
  value: string;
  bad: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-gray-500 dark:text-gray-400">
      {label}
      <span
        className={
          bad
            ? 'rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-800 ring-1 ring-amber-600/20 ring-inset dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20'
            : 'rounded-md bg-gray-50 px-1.5 py-0.5 text-gray-600 ring-1 ring-gray-500/10 ring-inset dark:bg-white/5 dark:text-gray-400 dark:ring-white/10'
        }
      >
        {value}
      </span>
    </span>
  );
}

/**
 * The conditions a real page throws at an SDK, as switches. Everything here
 * patches the browser APIs themselves — the SDK is not told any of it.
 */
export function EnvironmentPanel() {
  const env = useHostileEnv();
  const [readouts, setReadouts] = useState<Readouts>(readEnvironment);

  useEffect(() => {
    const update = () => setReadouts(readEnvironment());
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return (
    <Panel
      title="Browser environment"
      description="Simulated conditions a real page throws at an SDK. Flip them while events are flowing."
      actions={
        <>
          <Button outline onClick={() => resetHostileEnv()}>
            Reset environment
          </Button>
          <Button
            outline
            onClick={() => window.open(location.href, '_blank', 'noopener')}
          >
            Open a second tab
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {TOGGLES.map((toggle) => (
          <SwitchField key={toggle.key}>
            <Label>{toggle.label}</Label>
            <Description>{toggle.description}</Description>
            <Switch
              color="amber"
              checked={env[toggle.key]}
              onChange={toggle.apply}
            />
          </SwitchField>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-900/5 pt-4 dark:border-white/10">
        <Readout
          label="navigator.onLine"
          value={String(readouts.onLine)}
          bad={!readouts.onLine}
        />
        <Readout
          label="document.visibilityState"
          value={readouts.visibility}
          bad={readouts.visibility !== 'visible'}
        />
      </div>
    </Panel>
  );
}
