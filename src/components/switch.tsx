import * as Headless from '@headlessui/react';
import clsx from 'clsx';
import type React from 'react';

export function SwitchGroup({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      data-slot="control"
      className={clsx(
        className,
        // Basic groups
        'space-y-3',
        // With descriptions
        'has-data-[slot=description]:space-y-6 has-data-[slot=description]:**:data-[slot=label]:font-medium',
      )}
    />
  );
}

export function SwitchField({
  className,
  ...props
}: { className?: string } & Omit<Headless.FieldProps, 'as' | 'className'>) {
  return (
    <Headless.Field
      data-slot="field"
      {...props}
      className={clsx(
        className,
        // Base layout
        'grid grid-cols-[1fr_auto] items-center gap-x-8 gap-y-1 sm:grid-cols-[1fr_auto]',
        // Control layout
        '*:data-[slot=control]:col-start-2 *:data-[slot=control]:self-center',
        // Label layout
        '*:data-[slot=label]:col-start-1 *:data-[slot=label]:row-start-1',
        // Description layout
        '*:data-[slot=description]:col-start-1 *:data-[slot=description]:row-start-2',
        // With descriptions
        'has-data-[slot=description]:**:data-[slot=label]:font-medium',
      )}
    />
  );
}

const styles = {
  base: [
    // Base
    'group relative isolate inline-flex h-6 w-10 cursor-default rounded-full p-[3px] sm:h-5 sm:w-8',
    // Transitions
    'transition duration-0 ease-in-out data-changing:duration-200',
    // Unchecked
    'bg-zinc-200 ring-1 ring-black/5 ring-inset dark:bg-white/5 dark:ring-white/15',
    // Checked
    'data-checked:bg-(--switch-bg) data-checked:ring-(--switch-bg-ring) dark:data-checked:bg-(--switch-bg) dark:data-checked:ring-(--switch-bg-ring)',
    // Focus
    'focus:not-data-focus:outline-hidden data-focus:outline-2 data-focus:outline-offset-2 data-focus:outline-blue-500',
    // Hover
    'data-hover:ring-black/15 data-hover:data-checked:ring-(--switch-bg-ring)',
    'dark:data-hover:ring-white/25 dark:data-hover:data-checked:ring-(--switch-bg-ring)',
    // Disabled
    'data-disabled:bg-zinc-200 data-disabled:opacity-50 data-disabled:data-checked:bg-zinc-200',
    'dark:data-disabled:bg-white/15 dark:data-disabled:data-checked:bg-white/15',
    // Forced colors
    'forced-colors:outline forced-colors:[--switch-bg:Highlight]',
  ],
  colors: {
    'dark/zinc': [
      '[--switch-bg:var(--color-zinc-900)] [--switch-bg-ring:transparent] dark:[--switch-bg:var(--color-white)]',
      '[--switch-shadow:var(--color-black)]/10 [--switch:white] [--switch-ring:var(--color-zinc-950)]/90',
      'dark:[--switch-ring:transparent] dark:[--switch:var(--color-zinc-900)]',
    ],
    blue: [
      '[--switch-bg:var(--color-blue-600)] [--switch-bg-ring:transparent]',
      '[--switch-shadow:var(--color-blue-900)]/20 [--switch:white] [--switch-ring:var(--color-blue-700)]/90',
    ],
    amber: [
      '[--switch-bg:var(--color-amber-400)] [--switch-bg-ring:transparent]',
      '[--switch-shadow:var(--color-amber-900)]/20 [--switch:var(--color-amber-950)] [--switch-ring:transparent]',
    ],
    red: [
      '[--switch-bg:var(--color-red-600)] [--switch-bg-ring:transparent]',
      '[--switch-shadow:var(--color-red-900)]/20 [--switch:white] [--switch-ring:var(--color-red-700)]/90',
    ],
    emerald: [
      '[--switch-bg:var(--color-emerald-600)] [--switch-bg-ring:transparent]',
      '[--switch-shadow:var(--color-emerald-900)]/20 [--switch:white] [--switch-ring:var(--color-emerald-700)]/90',
    ],
  },
};

type SwitchColor = keyof typeof styles.colors;

export function Switch({
  color = 'dark/zinc',
  className,
  ...props
}: {
  color?: SwitchColor;
  className?: string;
} & Omit<Headless.SwitchProps, 'as' | 'className' | 'children'>) {
  return (
    <Headless.Switch
      data-slot="control"
      {...props}
      className={clsx(className, styles.base, styles.colors[color])}
    >
      <span
        aria-hidden="true"
        className={clsx(
          // Basic layout
          'pointer-events-none relative inline-block size-[1.125rem] rounded-full sm:size-3.5',
          // Transition
          'translate-x-0 transition duration-200 ease-in-out',
          // Invisible border so the switch is still visible in forced-colors mode
          'border border-transparent',
          // Unchecked
          'bg-white ring-1 shadow-sm ring-black/5',
          // Checked
          'group-data-checked:bg-(--switch) group-data-checked:shadow-(--switch-shadow) group-data-checked:ring-(--switch-ring)',
          'group-data-checked:translate-x-4 sm:group-data-checked:translate-x-3',
        )}
      />
    </Headless.Switch>
  );
}
