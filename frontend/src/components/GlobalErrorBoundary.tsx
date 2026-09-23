import { useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'

export default function GlobalErrorBoundary() {
  const error = useRouteError() as any
  console.error("Caught in GlobalErrorBoundary:", error)

  let errorMessage = "An unexpected error occurred."
  
  if (isRouteErrorResponse(error)) {
    errorMessage = error.data?.message || error.statusText
  } else if (error instanceof Error) {
    errorMessage = error.message
  } else if (typeof error === 'string') {
    errorMessage = error
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-[2rem] border border-border shadow-sm p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-foreground tracking-tight">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            {errorMessage}
          </p>
        </div>

        {import.meta.env.DEV && (
          <div className="bg-muted/50 p-4 rounded-xl text-left overflow-auto max-h-48 text-xs font-mono text-muted-foreground border border-border/50">
            {error?.stack ? error.stack : "No stack trace available."}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button 
            onClick={() => window.location.reload()}
            className="flex-1 bg-primary text-primary-foreground font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </button>
          <button 
            onClick={() => window.location.href = '/'}
            className="flex-1 bg-muted text-foreground font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-muted/80 transition-colors"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
