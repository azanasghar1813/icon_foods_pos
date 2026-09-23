import { useState, useRef, useEffect } from "react"
import { useUIStore } from "../store/uiStore"
import { useAuthStore } from "../store/authStore"
import { authService } from "../services/authService"
import { usePrinterStore } from "../store/printerStore"
import { apiClient } from "../api/client"
import { Bell,  LogOut, Users, X, ChevronDown, Lock, User as UserIcon, Wifi, WifiOff, Printer, Clock, RefreshCw, Calendar, Search, Settings, Sun, Moon, Minus, Square, Loader2, Menu } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"

export default function TopNavbar() {
  const { toggleSidebar } = useUIStore()
  const { user, logout, setSession } = useAuthStore()
  const navigate = useNavigate()
  
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false)
  
  // Switch Cashier State
  const [cashiers, setCashiers] = useState<{ id: string, name: string, username: string, role: string }[]>([])
  const [selectedCashier, setSelectedCashier] = useState<any>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [isLoadingSwitch, setIsLoadingSwitch] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // Status Indicators State
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isServerOnline, setIsServerOnline] = useState(true)
  const [isCheckingServer, setIsCheckingServer] = useState(false)
  const [deviceRole, setDeviceRole] = useState<string>('HUB')
  const [isHubOnline, setIsHubOnline] = useState(true)
  const printers = usePrinterStore((state) => state.printers)
  const activePrintersCount = printers.filter(p => p.status === 'Online' || p.current_status === 'ONLINE').length

  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Network status
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Global refresh shortcut
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        window.location.reload();
      }
    };
    window.addEventListener('keydown', handleGlobalKeydown);

    // Initial server check
    checkServerHealth()
    
    // Server polling every 30 seconds
    const serverCheckInterval = setInterval(checkServerHealth, 30000)
    
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('keydown', handleGlobalKeydown)
      clearInterval(serverCheckInterval)
      clearInterval(timer)
    }
  }, [])

  const checkServerHealth = async () => {
    setIsCheckingServer(true)
    try {
      const res: any = await apiClient.get('/health')
      setIsServerOnline(true)
      const role = res?.data?.device_role || res?.device_role || 'HUB'
      setDeviceRole(role)

      if (role === 'TERMINAL') {
        const hubIp = res?.data?.hub_ip || res?.hub_ip
        const hubPort = res?.data?.hub_port || res?.hub_port || 5000
        if (hubIp) {
          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 2000)
            await fetch(`http://${hubIp}:${hubPort}/api/v1/health`, { signal: controller.signal })
            clearTimeout(timeoutId)
            setIsHubOnline(true)
          } catch {
            setIsHubOnline(false)
          }
        }
      } else {
        setIsHubOnline(true)
      }
    } catch (e) {
      setIsServerOnline(false)
    } finally {
      setIsCheckingServer(false)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const handleSwitchCashier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCashier) return
    setIsLoadingSwitch(true)
    setError("")
    try {
      const response = await authService.login({ username: selectedCashier.username, pin })
      if (response.success && response.data) {
        setSession(response.data.user as any, response.data.token, response.data.cashierSessionId)
        setIsSwitchModalOpen(false)
        navigate('/dashboard')
      }
    } catch (e: any) {
      setError(e.response?.data?.message || "Invalid PIN")
    } finally {
      setIsLoadingSwitch(false)
    }
  }

  const openSwitchModal = async () => {
    setIsProfileOpen(false)
    setIsSwitchModalOpen(true)
    setPin("")
    setError("")
    setIsLoadingSwitch(true)
    try {
      const res = await authService.getUsers()
      if (res.data) {
        const users = (res.data as any).map((u: any) => ({
          id: u.id,
          username: u.username,
          role: u.role_name || u.role?.name || u.role || 'Cashier',
          name: `${u.first_name || u.firstName || u.username} ${u.last_name || u.lastName || ''}`.trim()
        }))
        setCashiers(users)
        if (users.length > 0) setSelectedCashier(users[0])
      }
    } catch (e: any) {
      setError("Failed to load users.")
    } finally {
      setIsLoadingSwitch(false)
    }
  }

  const handleWindowControl = (action: string) => {
    const api = window.electronAPI;
    if (!api) return;
    if (action === 'window-minimize') api.windowMinimize();
    else if (action === 'window-maximize') api.windowMaximize();
    else if (action === 'window-close') api.windowClose();
  };

  return (
    <div className="flex flex-col z-50">
      {/* TEMP Ticket Warning Banner */}
      {deviceRole === 'TERMINAL' && !isHubOnline && (
        <div className="bg-red-500 text-white text-xs font-bold text-center py-1.5 px-4 shadow-sm relative z-50 animate-pulse">
          ⚠️ WARNING: Hub Connection Lost. Orders will use TEMP tickets and will NOT appear on Kitchen Displays.
        </div>
      )}
      <header 
        className="h-16 bg-card/80 backdrop-blur-md border-b border-border/50 flex items-center justify-between px-4 z-10 sticky top-0 shadow-sm"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-2 sm:gap-4 flex-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button 
            onClick={toggleSidebar}
            className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          
        </div>

        <div className="flex items-center gap-2 sm:gap-4" style={{ WebkitAppRegion: 'no-drag' } as any}>
          {/* Status Indicators */}
          <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 border-r border-border/50 text-muted-foreground">
            <button 
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors" 
              title="Refresh Application (Ctrl + Shift + R)"
            >
              <RefreshCw className={`w-4 h-4 ${isServerOnline ? 'text-blue-500' : 'text-red-500'} ${isCheckingServer ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex items-center" title="LAN Sync Status">
              {deviceRole === 'HUB' ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  HUB
                </span>
              ) : isServerOnline ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  LAN OK
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse">
                  ISOLATED
                </span>
              )}
            </div>
            <div title={isOnline ? "Internet Connected" : "No Internet Connection"}>
              {isOnline ? (
                <Wifi className="w-4 h-4 text-emerald-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
            </div>
            <div title={`${activePrintersCount} Printer(s) Online`}>
              <Printer className={`w-4 h-4 ${activePrintersCount > 0 ? 'text-emerald-500' : 'text-amber-500'}`} />
            </div>
            <div className="flex flex-col items-end justify-center px-4 py-1 border-r border-border/50">
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                <Calendar className="w-3.5 h-3.5" />
                {currentTime.toLocaleDateString()}
              </div>
              <div className="flex items-center gap-1.5 text-sm font-black text-foreground">
                <Clock className="w-4 h-4 text-orange-500" />
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              const root = document.documentElement;
              if (root.classList.contains('dark')) root.classList.remove('dark');
              else root.classList.add('dark');
            }}
            className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sun className="w-5 h-5 hidden dark:block" />
            <Moon className="w-5 h-5 block dark:hidden" />
          </button>

          <Link
            to="/settings"
            className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="w-5 h-5" />
          </Link>

          <Link
            to="/notifications"
            className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border border-card" />
          </Link>

          {/* Window Controls (Electron Native) */}
          <div className="hidden lg:flex items-center border-l border-border/50 ml-2 pl-2 gap-1">
            <button 
              onClick={() => handleWindowControl('window-minimize')}
              className="p-2 hover:bg-secondary rounded transition-colors text-muted-foreground"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button 
              onClick={() => handleWindowControl('window-maximize')}
              className="p-2 hover:bg-secondary rounded transition-colors text-muted-foreground"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => handleWindowControl('window-close')}
              className="p-2 hover:bg-destructive hover:text-destructive-foreground rounded transition-colors text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Switch Cashier Modal */}
      <AnimatePresence>
        {isSwitchModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSwitchModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-card border border-border shadow-2xl rounded-2xl p-6 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-orange-400" />
              
              <button 
                onClick={() => setIsSwitchModalOpen(false)}
                className="absolute top-4 right-4 p-1 rounded-full hover:bg-secondary text-muted-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold">Switch Cashier</h2>
                <p className="text-sm text-muted-foreground">Select a cashier and enter PIN.</p>
              </div>

              <form onSubmit={handleSwitchCashier} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground ml-1">Cashier</label>
                  <div className="relative">
                    <div 
                      className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 flex items-center justify-between cursor-pointer hover:bg-secondary transition-colors"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <UserIcon className="w-4 h-4" />
                      </div>
                      <span className="font-bold">{selectedCashier?.name || "Loading..."}</span>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                    
                    {isDropdownOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute top-full left-0 w-full mt-1 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
                      >
                        {cashiers.map(cashier => (
                          <div 
                            key={cashier.id}
                            onClick={() => {
                              setSelectedCashier(cashier)
                              setIsDropdownOpen(false)
                            }}
                            className={`px-4 py-2 text-sm cursor-pointer hover:bg-secondary transition-colors font-bold ${selectedCashier?.id === cashier.id ? 'bg-primary/10 text-primary' : ''}`}
                          >
                            {cashier.name} ({cashier.role})
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground ml-1">PIN</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 focus:outline-none focus:border-primary focus:bg-background transition-all text-lg font-black tracking-widest"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-destructive text-xs font-medium text-center">{error}</p>
                )}

                <button 
                  type="submit" 
                  disabled={pin.length < 4 || isLoadingSwitch}
                  className="w-full h-12 mt-2 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingSwitch ? <Loader2 className="w-5 h-5 animate-spin" /> : "Switch Session"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
