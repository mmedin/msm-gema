import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import 'leaflet/dist/leaflet.css';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppContent } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);
