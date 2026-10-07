import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { resolveApiBaseUrl } from './src/config/apiUrl'
import { checkCspForBuild } from './src/config/cspGuard'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Fail the BUILD, not the first page load, if a production bundle would not know where the API is
  // (or would point at localhost). `loadEnv` also reads VITE_* variables from the real environment,
  // which is how Netlify provides them.
  if (command === 'build' && mode === 'production') {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const apiUrl = resolveApiBaseUrl({
      VITE_API_URL: env.VITE_API_URL,
      VITE_ALLOW_LOCAL_API: env.VITE_ALLOW_LOCAL_API,
      PROD: true,
    })

    // The CSP in netlify.toml carries a placeholder for the API origin. Do not let a build that would
    // be blocked from calling its own API (placeholder left in, or connect-src without the API origin)
    // go out. Opt out for a local verification build with VITE_ALLOW_CSP_PLACEHOLDER=true.
    let cspFileText: string | undefined
    try {
      cspFileText = fs.readFileSync(path.resolve(__dirname, 'netlify.toml'), 'utf8')
    } catch {
      cspFileText = undefined
    }
    const csp = checkCspForBuild({
      cspFileText,
      cspFileName: 'netlify.toml',
      apiUrl,
      allowPlaceholder: env.VITE_ALLOW_CSP_PLACEHOLDER,
    })
    csp.warnings.forEach((warning) => console.warn(warning))
    if (csp.errors.length > 0) throw new Error(csp.errors.join('\n'))
  }

  return {
    plugins: [react()],
    // Production only: drop console.log/debug/info calls (they have printed business data such as
    // payer names and receipt numbers). console.error and console.warn are kept for real failures.
    ...(command === 'build'
      ? { esbuild: { pure: ['console.log', 'console.debug', 'console.info'] } }
      : {}),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      // Dev convenience only: the app calls the absolute API URL, so this is used only if a request
      // is made to a relative /api path. Keep the port in step with DEV_API_URL (src/config/apiUrl.ts).
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
  }
})
