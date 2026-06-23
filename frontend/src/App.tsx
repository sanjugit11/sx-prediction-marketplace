import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Route Guards
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import { Landing } from './pages/Landing';
import { WalletConnect } from './pages/WalletConnect';
import { Registration } from './pages/Registration';
import { Dashboard } from './pages/Dashboard';
import { Deposit } from './pages/Deposit';
import { Withdraw } from './pages/Withdraw';
import { MarketList } from './pages/MarketList';
import { MarketDetails } from './pages/MarketDetails';
import { CreateMarket } from './pages/CreateMarket';
import { AdminResolution } from './pages/AdminResolution';
import { ClaimPayout } from './pages/ClaimPayout';
import { Leaderboard } from './pages/Leaderboard';
import { Rewards } from './pages/Rewards';
import { MyPositions } from './pages/MyPositions';
import { MarketplaceListings } from './pages/MarketplaceListings';
import { EventExplorer } from './pages/EventExplorer';
import { VerificationDashboard } from './pages/VerificationDashboard';
import { SecurityDashboard } from './pages/SecurityDashboard';
import { Architecture } from './pages/Architecture';
import { AIChatSupport } from './pages/AIChatSupport';
import { DatabaseDashboard } from './pages/DatabaseDashboard';

// Create React Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/wallet-connect" element={<WalletConnect />} />

          {/* Registration Route (Only requires wallet connection, not full attestation registration) */}
          <Route 
            path="/register" 
            element={
              <ProtectedRoute requireRegistration={false}>
                <Registration />
              </ProtectedRoute>
            } 
          />

          {/* Protected Routes (Require wallet connection AND enclave attestation key registration) */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/deposit" 
            element={
              <ProtectedRoute>
                <Deposit />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/withdraw" 
            element={
              <ProtectedRoute>
                <Withdraw />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/markets" 
            element={
              <ProtectedRoute>
                <MarketList />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/markets/:id" 
            element={
              <ProtectedRoute>
                <MarketDetails />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/create-market" 
            element={
              <ProtectedRoute>
                <CreateMarket />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin-resolution" 
            element={
              <ProtectedRoute>
                <AdminResolution />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/claim-payout" 
            element={
              <ProtectedRoute>
                <ClaimPayout />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/leaderboard" 
            element={
              <ProtectedRoute>
                <Leaderboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/rewards" 
            element={
              <ProtectedRoute>
                <Rewards />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/positions" 
            element={
              <ProtectedRoute>
                <MyPositions />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/marketplace" 
            element={
              <ProtectedRoute>
                <MarketplaceListings />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/events" 
            element={
              <ProtectedRoute>
                <EventExplorer />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/verification" 
            element={
              <ProtectedRoute>
                <VerificationDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/security" 
            element={
              <ProtectedRoute>
                <SecurityDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/architecture" 
            element={
              <ProtectedRoute>
                <Architecture />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/support" 
            element={
              <ProtectedRoute>
                <AIChatSupport />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/database" 
            element={
              <ProtectedRoute>
                <DatabaseDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Catch-all fallback redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
