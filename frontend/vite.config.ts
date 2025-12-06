import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        // Allow the dev server to be reachable using custom hostnames (e.g. http://aish)
        // `host: true` binds to all addresses and accepts requests for other hostnames
        // without rejecting the Host header.
        host: true,
        fs: {
            strict: false,
        },
    },
})
