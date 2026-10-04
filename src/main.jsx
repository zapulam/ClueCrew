import React from 'react';
import ReactDOM from 'react-dom/client';
import './tailwind.css';  // Use the new Tailwind v4 CSS file
import './styles/fx.css';

import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);