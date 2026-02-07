import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/jam-genie/' : '/',
  plugins: [svelte()],
  server: {
    proxy: {
      '/api/v0': {
        target: 'https://beta.strummachine.com',
        changeOrigin: true,
      },
    },
  },
})
