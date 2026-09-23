import { toast } from '../store/toastStore'
import { useAuthStore } from '../store/authStore'

export interface ApiError {
  status: number
  message: string
  code?: string
  details?: any
}

/**
 * Centralized error normalization.
 * Takes any caught exception or Axios error and translates it into a standard format.
 */
export const normalizeError = (error: any): ApiError => {
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    return {
      status: error.response.status,
      message: error.response.data?.error || error.response.data?.message || error.message || 'Server Error',
      code: error.response.data?.code || 'UNKNOWN_ERROR',
      details: error.response.data?.details
    }
  } else if (error.request) {
    // The request was made but no response was received
    return {
      status: 0,
      message: 'Network error. Please check your connection.',
      code: 'NETWORK_ERROR'
    }
  } else {
    // Something happened in setting up the request that triggered an Error
    return {
      status: 0,
      message: error.message || 'An unexpected error occurred.',
      code: 'UNKNOWN_ERROR'
    }
  }
}

/**
 * Global handler for displaying errors via the Toast system and handling 401s.
 */
export const handleApiError = (error: any, customMessage?: string) => {
  const normalized = normalizeError(error)

  const isValidateEndpoint = error?.config?.url?.includes('/auth/validate')

  if (normalized.status === 401) {
    if (!isValidateEndpoint) {
      toast.error('Session Expired', 'Please log in again.')
    }
    useAuthStore.getState().logout()
    return normalized
  }

  if (normalized.status === 403) {
    toast.error('Access Denied', 'You do not have permission to perform this action.')
    return normalized
  }
  
  if (normalized.code === 'SQLITE_CONSTRAINT') {
    toast.error('Database Conflict', customMessage || 'This record cannot be modified or deleted because it is in use.')
    return normalized
  }

  // General fallback
  toast.error(customMessage || 'Operation Failed', normalized.message)
  return normalized
}
