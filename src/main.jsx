import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './tailwind.css';  // Use the new Tailwind v4 CSS file
import './styles/fx.css';

// A ?room= link (from the QR code) opens the codemaster's phone view instead of the board.
// Each page is loaded on its own, so phones don't download the board and vice versa.
const room = new URLSearchParams(window.location.search).get('room');
const App = lazy(() => import('./App'));
const CodemasterPhone = lazy(() => import('./phone/CodemasterPhone'));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={<div className="min-h-dvh bg-gray-900" />}>
      {room !== null ? <CodemasterPhone initialRoom={room} /> : <App />}
    </Suspense>
  </React.StrictMode>
);
