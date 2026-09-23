import axios from 'axios'
import { handleApiError } from './errorHandler'
import { useAuthStore } from '../store/authStore'
import { useLoadingStore } from '../store/loadingStore'

// 1. If Vercel/Cloud injected a remote API URL (like Render), use it (Online Mode).
let baseURL = import.meta.env.VITE_API_URL;

// 2. If it's undefined, or if the baked-in URL is a local/LAN IP (which might have the wrong port like 5000 instead of 5055),
// we force dynamic routing to match the exact host and port serving the frontend.
if (!baseURL || baseURL.includes('localhost') || baseURL.includes('192.168.') || baseURL.includes('127.0.0.1') || baseURL.includes('10.')) {
  if (typeof window !== 'undefined' && window.location.port !== '5173') {
    // This will correctly point to localhost:5055 in Electron, or 192.168.x.x:5055 on Tablets
    baseURL = `${window.location.protocol}//${window.location.host}/api/v1`;
  } else {
    baseURL = 'http://localhost:5000/api/v1'; // Dev Vite fallback
  }
}

export const apiClient = axios.create({
  baseURL,
  timeout: 10000, // 10 seconds default timeout
  headers: {
    'Content-Type': 'application/json'
  }
})

// ----------------------------------------------------
// Request Interceptor
// ----------------------------------------------------
apiClient.interceptors.request.use(
  (config) => {
    // 1. Start global loading indicator
    useLoadingStore.getState().startLoading()

    // 2. Attach Authorization Header if token exists
    const { token, user, cashierSessionId } = useAuthStore.getState()
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    if (user?.id && config.headers) {
      config.headers['x-user-id'] = user.id
    }
    if (cashierSessionId && config.headers) {
      config.headers['x-cashier-session-id'] = cashierSessionId
    }

    // 3. Attach Device Identity Headers
    if (config.headers) {
      let terminalId = localStorage.getItem('terminal_id');
      if (!terminalId) {
        terminalId = 'TERM-' + Math.random().toString(36).substring(2, 9).toUpperCase();
        localStorage.setItem('terminal_id', terminalId);
      }
      
      let deviceName = localStorage.getItem('device_name');
      if (!deviceName) {
        const isElectron = /electron/i.test(navigator.userAgent);
        const platform = isElectron ? 'Server PC' : (navigator.maxTouchPoints > 0 ? 'Tablet' : 'Browser');
        deviceName = `${platform} - ${terminalId.substring(5)}`;
        localStorage.setItem('device_name', deviceName);
      }

      config.headers['x-terminal-id'] = terminalId;
      config.headers['x-device-name'] = deviceName;
    }
    
    return config
  },
  (error) => {
    useLoadingStore.getState().stopLoading()
    return Promise.reject(error)
  }
)

// ----------------------------------------------------
// Response Interceptor
// ----------------------------------------------------
apiClient.interceptors.response.use(
  (response) => {
    // 1. Stop global loading indicator
    useLoadingStore.getState().stopLoading()

    // 2. Return data directly (unwrap Axios response)
    // Most of our APIs return { success: true, data: { ... } }
    return response.data
  },
  (error) => {
    // 1. Stop global loading indicator
    useLoadingStore.getState().stopLoading()

    // 2. Pass to global error handler
    handleApiError(error)

    // 3. Reject promise so caller can handle it if needed
    return Promise.reject(error)
  }
)
