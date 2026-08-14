import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: { port: Number(process.env.PORT ?? 3000), allowedHosts: ['.trycloudflare.com'] },
  plugins: [tanstackStart({ spa: { enabled: true } }), viteReact()],
})
