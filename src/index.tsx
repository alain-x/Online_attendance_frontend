import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

const origWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('The width(') && args[0].includes('should be greater than 0')) return;
  origWarn.apply(console, args);
};

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
