// Sentry init for the React front-end.
//
// DSN comes from VITE_SENTRY_DSN, baked at build time by Cloud Build
// (build-arg from Secret Manager). If absent, Sentry is a no-op — the app
// still works, errors just don't get reported.
//
// Why this file:
//   - Centraliza config para nao duplicar entre main.tsx e ErrorBoundary
//   - Permite skip em dev local sem ENV setada
//   - Filtra ruido conhecido (ResizeObserver) antes de gastar quota

import * as Sentry from '@sentry/react'

let initialized = false

export function initSentry() {
  if (initialized) return
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) {
    // Em dev local e CI builds sem DSN, manter no-op silencioso.
    if (import.meta.env.MODE !== 'production') {
      console.info('[sentry] DSN ausente — Sentry desativado neste build.')
    }
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'unknown',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    beforeSend(event) {
      // ResizeObserver loop limit warning aparece em libs UI (Radix popovers)
      // e nao e acionavel — Chrome ja parou de tratar como erro. Ignorar.
      if (event.message?.includes('ResizeObserver loop')) return null
      return event
    },
  })
  initialized = true
}

// Re-export para usar em ErrorBoundary e handlers globais.
export { Sentry }
