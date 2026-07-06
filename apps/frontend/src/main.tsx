/**
 * Application Entry Point
 * 
 * Sets up the React app with:
 * - AuthProvider for authentication state
 * - RouterProvider for routing
 * - Global styles
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/lib/api';
import { router } from '@/app';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>
);
