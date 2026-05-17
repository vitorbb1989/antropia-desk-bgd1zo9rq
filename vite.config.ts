/* Vite config for building the frontend react app: https://vite.dev/config/ */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: '::',
    port: 8080,
    allowedHosts: 'all',
  },
  experimental: {
    enableNativePlugin: true
  },
  build: {
    minify: mode !== 'development',
    sourcemap: mode === 'development',
    // Aviso de chunk subiu para 600KB porque ate dividir tudo continua
    // havendo um chunk inicial pesado; o que importa e nao ter UM chunk
    // gigante de 1.5MB+.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
          return
        }
        warn(warning)
      },
      output: {
        // Split por vendor para aproveitar cache entre deploys (mudancas no
        // codigo da app nao invalidam radix/recharts/supabase).
        // Rolldown exige manualChunks como funcao.
        //
        // Matching e feito por NOME DE PACOTE exato (capturado por regex),
        // nao por substring no path. Substring quebra silenciosamente quando:
        //   - pnpm muda o layout (.pnpm/...)
        //   - sobe lib com nome parecido (zod-validation-error, react-hook-...)
        //   - upgrade move codigo de chunk e invalida cache do CDN
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined

          // Captura @scope/pkg ou pkg, tolerando layout pnpm (.pnpm/...)
          const match = id.match(
            /node_modules\/(?:\.pnpm\/)?(@[^/]+\/[^/@]+|[^/@]+)/,
          )
          const pkg = match?.[1]
          if (!pkg) return undefined

          if (pkg.startsWith('@radix-ui/')) return 'radix'
          if (pkg === '@supabase/supabase-js') return 'supabase'
          if (pkg === 'recharts' || pkg.startsWith('d3-')) return 'charts'
          if (
            pkg === 'react-hook-form' ||
            pkg === '@hookform/resolvers' ||
            pkg === 'zod'
          ) return 'forms'
          if (
            pkg === 'react' ||
            pkg === 'react-dom' ||
            pkg === 'react-router' ||
            pkg === 'react-router-dom' ||
            pkg === 'scheduler'
          ) return 'react-vendor'

          return undefined
        },
      },
    },
  },
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode ?? process.env.NODE_ENV ?? 'production'),
  },
  resolve: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
      {
        find: /zod\/v4\/core/,
        replacement: path.resolve(__dirname, 'node_modules', 'zod', 'v4', 'core'),
      }
    ],
  },
}))
