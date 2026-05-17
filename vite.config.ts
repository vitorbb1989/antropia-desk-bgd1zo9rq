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
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@radix-ui')) return 'radix'
          if (id.includes('@supabase/supabase-js')) return 'supabase'
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (
            id.includes('react-hook-form') ||
            id.includes('@hookform') ||
            id.includes('/zod/')
          ) return 'forms'
          if (
            id.includes('react-router') ||
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('scheduler')
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
