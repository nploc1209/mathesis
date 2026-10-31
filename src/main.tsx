import React from 'react';
import ReactDOM from 'react-dom/client';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import App from './App';
import './index.css';

// Make KaTeX globally available for JSXGraph label parsing
(window as any).katex = katex;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
