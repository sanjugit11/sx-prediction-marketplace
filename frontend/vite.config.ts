import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '..',
  envPrefix: [
    'VITE_',
    'HOODI_',
    'BASE_SEPOLIA_',
    'USDC_',
    'SXUA_',
    'PREDICTION_',
    'LEADERBOARD_',
    'RESOLUTION_',
    'RESELLING_',
    'VERIFICATION_',
  ],
})
