import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { ApiClient } from '../services/api.js';

interface ProtectedRouteProps {
  allowedRoles?: string[];
  children?: React.ReactNode;
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const location = useLocation();
  const token = ApiClient.getToken();
  const user = ApiClient.getUser();

  // If unauthenticated, redirect to the real OTP login page
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If role check is specified and user does not match
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to their default landing page
    if (user.role === 'GUARD') {
      return <Navigate to="/guard" replace />;
    } else if (user.role === 'COMMITTEE') {
      return <Navigate to="/committee" replace />;
    } else if (user.role === 'ACCOUNTS' || user.role === 'HELPDESK') {
      return <Navigate to="/staff/complaints" replace />;
    } else {
      return <Navigate to="/resident" replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
}

