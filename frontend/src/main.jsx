import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import { AuthProvider } from './lib/auth.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: 'rgb(var(--c-surface))', color: 'rgb(var(--c-text))', border: '1px solid rgb(var(--c-gold) / 0.55)', borderRadius: '12px', boxShadow: '0 12px 30px -10px rgb(0 0 0 / 0.6)' },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
