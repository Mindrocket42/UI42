import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'node:path' // Use node: prefix
import { fileURLToPath } from 'node:url'; // Helper to convert URL to path

// Get current directory path in ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      // Use derived __dirname
      $lib: path.resolve(__dirname, './src/lib')
    }
  }
})
