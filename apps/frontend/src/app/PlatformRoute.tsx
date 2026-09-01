import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/api';
export function PlatformRoute() { const { user, isLoading } = useAuth(); if (isLoading) return null; return user?.platformRole === 'SUPERADMIN' ? <Outlet /> : <Navigate to="/platform/login" replace />; }
