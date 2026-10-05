// First import on purpose: the browser-environment patches must be in place
// before the SDK module is evaluated, so an SDK that grabs `fetch` or
// `sendBeacon` at module scope still gets the simulated ones.
import './demo/hostile-env';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './app.tsx';

import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root container');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
