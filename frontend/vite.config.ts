import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Read .env from the project root (one level up from frontend/)
  envDir: '..',
  // Expose vars with these prefixes to the browser bundle (import.meta.env.*)
  // Deliberately excludes PRIVATE_KEY, ETHERSCAN_API_KEY, DATABASE_URL, etc.
  envPrefix: [
    'VITE_',          // standard Vite vars (kept for compatibility)
    'HOODI_',         // HOODI_RPC_URL, HOODI_CHAIN_ID
    'BASE_SEPOLIA_',  // BASE_SEPOLIA_RPC_URL, BASE_SEPOLIA_CHAIN_ID, BASE_SEPOLIA_*_ADDRESS
    'USDC_',          // USDC_ADDRESS
    'SXUA_',          // SXUA_ADDRESS
    'SX_',            // SX_ACCESS_CONTROL_ADDRESS
    'FEE_',           // FEE_TREASURY_ADDRESS
    'VERIFICATION_',  // VERIFICATION_REGISTRY_ADDRESS
    'PREDICTION_',    // PREDICTION_MARKET_*_ADDRESS
    'LEADERBOARD_',   // LEADERBOARD_ADDRESS
    'RESOLUTION_',    // RESOLUTION_MANAGER_ADDRESS
    'RESELLING_',     // RESELLING_MARKETPLACE_ADDRESS
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
