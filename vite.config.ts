import { defineConfig, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import autoprefixer from 'autoprefixer'
import tailwindcss from 'tailwindcss'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DEV_STATIC_ROUTE_REWRITES: Record<string, string> = {
  '/landing': '/landing/index.html',
  '/landing/': '/landing/index.html',
  '/privacy': '/privacy/index.html',
  '/privacy/': '/privacy/index.html',
  '/cookie-policy': '/cookie-policy/index.html',
  '/cookie-policy/': '/cookie-policy/index.html',
}

const LANDING_APP_PATH_PREFIX = "/app";
const ACCESS_COOKIE_TOKEN = "br_app_access=1";
const IS_LANDING_DEV_SERVER = Boolean(process.env.VITE_API_PROXY_TARGET);

const devRoutingPlugin = () => ({
  name: 'where2beach-dev-routing',
  configureServer(server: ViteDevServer) {
    server.middlewares.use((req: IncomingMessage & { url?: string }, res: ServerResponse, next: () => void) => {
      const rawUrl = req.url || '/'
      const [pathname, search = ''] = rawUrl.split('?')
      const isAppPath =
        pathname === LANDING_APP_PATH_PREFIX ||
        pathname.startsWith(`${LANDING_APP_PATH_PREFIX}/`)

      if (IS_LANDING_DEV_SERVER && isAppPath) {
        const cookieHeader = typeof req.headers.cookie === "string" ? req.headers.cookie : "";
        const hasAppAccessCookie = cookieHeader
          .split(";")
          .some((token) => token.trim() === ACCESS_COOKIE_TOKEN);

        if (!hasAppAccessCookie) {
          res.statusCode = 307
          res.setHeader("Location", "/landing/")
          res.end()
          return
        }

        if (pathname === LANDING_APP_PATH_PREFIX) {
          res.statusCode = 307
          res.setHeader("Location", "/app/")
          res.end()
          return
        }
      }

      if (pathname === '/') {
        res.statusCode = 307
        res.setHeader('Location', IS_LANDING_DEV_SERVER ? '/landing/' : '/app/')
        res.end()
        return
      }

      const rewrittenPath = DEV_STATIC_ROUTE_REWRITES[pathname]
      if (rewrittenPath) {
        req.url = search ? `${rewrittenPath}?${search}` : rewrittenPath
      }

      next()
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devRoutingPlugin()],
  server: {
    host: true,
    proxy: {
      "/api": process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:3000",
    },
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          config: path.join(__dirname, 'tailwind.config.cjs'),
        }),
        autoprefixer(),
      ],
    },
  },
  build: {
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("leaflet") || id.includes("react-leaflet")) {
            return "vendor-leaflet";
          }
          if (id.includes("@supabase/supabase-js")) {
            return "vendor-supabase";
          }
          if (id.includes("react") || id.includes("scheduler")) {
            return "vendor-react";
          }
          return "vendor-misc";
        },
      },
    },
  },
})
