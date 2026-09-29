import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // host: true lets you open the app on your phone over the same Wi-Fi
  // PORT lets the Claude preview run on a spare port; you still get 5190 by default
  server: { port: Number(process.env.PORT) || 5190, host: true },
})
