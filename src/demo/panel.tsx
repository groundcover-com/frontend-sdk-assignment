import type React from 'react';

/** Card shell shared by the demo panels. */
export function Panel({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white shadow-xs outline outline-gray-900/5 sm:rounded-xl dark:bg-gray-800/50 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10">
      <header className="flex items-start justify-between gap-4 border-b border-gray-900/5 px-4 py-4 sm:px-6 dark:border-white/10">
        <div>
          <h2 className="text-sm/6 font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm/6 text-gray-500 dark:text-gray-400">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </header>
      <div className="px-4 py-4 sm:px-6">{children}</div>
    </section>
  );
}
