import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './lib/auth';
import ThemedApp from './ThemedApp';
import './i18n';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemedApp>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemedApp>
  </StrictMode>,
);
