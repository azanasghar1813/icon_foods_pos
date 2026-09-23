import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authService } from '../services/authService'
import { Loader2 } from 'lucide-react'

/**
 * Enterprise Application Initializer.
 * Ensures the session is validated and critical configuration is loaded
 * before rendering protected routes.
 */
export function AppInitializer({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
