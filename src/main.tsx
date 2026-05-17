/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import ErrorBoundary from './components/ErrorBoundary'
import App from './App.tsx'
import { initSentry, Sentry } from './lib/sentry'
import './main.css'

// Sentry inicia antes do render para capturar erros desde o primeiro paint.
initSentry()

// Promise rejeitada sem catch (fetch que falha, async sem try/catch, etc.).
// React nao captura isso no ErrorBoundary, entao precisa de handler global.
window.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(event.reason)
})

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
