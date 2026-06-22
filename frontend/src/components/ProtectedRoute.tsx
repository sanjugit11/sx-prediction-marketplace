import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAccount } from '../hooks/useWeb3';
import { Layout } from './Layout';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRegistration?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireRegistration = true 
}) => {
  const { isConnected, isRegistered } = useAccount();

  if (!isConnected) {
    // Redirect to Wallet Connect
    return <Navigate to="/wallet-connect" replace />;
  }

  if (requireRegistration && !isRegistered) {
    // Redirect to Enclave Registration wizard
    return <Navigate to="/register" replace />;
  }

  return <Layout>{children}</Layout>;
};
