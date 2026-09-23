import { useLocation } from "react-router-dom"
import { useEffect } from "react"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  useEffect(() => {
    // Save the current route to localStorage so the app can resume exactly where it was left off
    if (location.pathname !== '/' && location.pathname !== '/login') {
      localStorage.setItem('df_last_route', location.pathname + location.search)
    }
  }, [location])

  return <>{children}</>
}
