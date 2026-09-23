import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import './index.css'
import DashboardLayout from './layouts/DashboardLayout.tsx'
import App from './App.tsx'
import { lazy, Suspense } from 'react'
import GlobalErrorBoundary from './components/GlobalErrorBoundary.tsx'
import { ToastProvider } from './components/ui/ToastProvider.tsx'
import { ProtectedRoute } from './components/ProtectedRoute.tsx'
import { AppInitializer } from './components/AppInitializer.tsx'
import { useUIStore } from './store/uiStore.ts'
const Dashboard = lazy(() => import('./pages/Dashboard.tsx'))
const POS = lazy(() => import('./pages/POS.tsx'))
const Orders = lazy(() => import('./pages/Orders.tsx'))
const Products = lazy(() => import('./pages/Products.tsx'))
const Customers = lazy(() => import('./pages/Customers.tsx'))
const Settings = lazy(() => import('./pages/Settings.tsx'))
const NotificationCenter = lazy(() => import('./pages/NotificationCenter.tsx'))
const ReceiptPreview = lazy(() => import('./pages/ReceiptPreview.tsx'))
const TablesManagement = lazy(() => import('./pages/TablesManagement.tsx'))

// Initialize theme on app load
useUIStore.getState()

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="flex h-full items-center justify-center p-8"><div className="animate-pulse flex flex-col items-center gap-4"><div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div><p className="text-muted-foreground">Loading module...</p></div></div>}>
    {children}
  </Suspense>
)

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AppInitializer>
        <ProtectedRoute>
          <App />
        </ProtectedRoute>
      </AppInitializer>
    ),
    errorElement: <GlobalErrorBoundary />,
    children: [
      {
        path: "/",
        element: <DashboardLayout />,
        children: [
          { path: "/", element: <SuspenseWrapper><Dashboard /></SuspenseWrapper> },
          { path: "/dashboard", element: <SuspenseWrapper><Dashboard /></SuspenseWrapper> },
          { path: "/pos", element: <SuspenseWrapper><POS /></SuspenseWrapper> },
          { path: "/orders", element: <SuspenseWrapper><Orders /></SuspenseWrapper> },
          { path: "/products", element: <SuspenseWrapper><Products /></SuspenseWrapper> },
          { path: "/customers", element: <SuspenseWrapper><Customers /></SuspenseWrapper> },
          { path: "/settings", element: <SuspenseWrapper><Settings /></SuspenseWrapper> },
          { path: "/notifications", element: <SuspenseWrapper><NotificationCenter /></SuspenseWrapper> },
          { path: "/receipt", element: <SuspenseWrapper><ReceiptPreview /></SuspenseWrapper> },
          { path: "/tables", element: <SuspenseWrapper><TablesManagement /></SuspenseWrapper> },
        ],
      }
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <ToastProvider />
  </StrictMode>,
)
