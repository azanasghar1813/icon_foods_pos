import { apiClient } from '../api/client'

// Domain specific types can be imported or defined here
export interface LoginCredentials {
  username: string
  pin: string
}

export interface AuthResponse {
  success: boolean
  data: {
    token: string
    cashierSessionId?: string | null
    user: {
      id: string
      name: string
      username?: string
      firstName?: string
      lastName?: string
      role: string
      permissions: string[]
    }
  }
}

export const authService = {
  /**
   * Authenticate a user via PIN and receive a JWT token.
   */
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    return apiClient.post('/auth/login', credentials)
  },

  /**
   * Validate the current session token.
   * Useful for app startup or re-hydrating state.
   */
  validateSession: async (): Promise<AuthResponse> => {
    return apiClient.get('/auth/validate')
  },

  /**
   * Fetch active users for the login screen dropdown.
   */
  getUsers: async (): Promise<{ data: { id: string, username: string, firstName: string, lastName: string, role_name?: string }[] }> => {
    return apiClient.get('/auth/users')
  },

  verifyManagerPin: async (pin: string): Promise<boolean> => {
    try {
      const res: any = await apiClient.post('/auth/verify-manager-pin', { pin })
      return !!(res?.success || res?.data?.verified)
    } catch {
      return false
    }
  }
}
