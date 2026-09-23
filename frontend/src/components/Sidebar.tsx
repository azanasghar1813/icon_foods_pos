import { motion, AnimatePresence } from "framer-motion"
import { useUIStore } from "../store/uiStore"
import { hasPermission } from "../store/authStore"
import { NavLink } from "react-router-dom"
import { 
  LayoutDashboard, 
  ShoppingCart, 
  ClipboardList, 
  UtensilsCrossed, 
  Tags, 
  BarChart3, 
  UserSquare2, 
  Wallet, 
  RefreshCw,
  X,
  ChefHat,
  Printer,
  Building2,
  Database,
  History,
  Shield,
  Menu,
  Grid2X2
} from "lucide-react"

const menuItems = [
  { path: "/dashboard", name: "Dashboard", icon: LayoutDashboard, permission: "VIEW_DASHBOARD" },
  { path: "/pos", name: "POS", icon: ShoppingCart, permission: "VIEW_POS" },
  { path: "/orders", name: "Orders", icon: ClipboardList, permission: "VIEW_ORDERS" },
  { path: "/products", name: "Products", icon: UtensilsCrossed, permission: "VIEW_PRODUCTS" },
  { path: "/customers", name: "Customers", icon: UserSquare2, permission: "VIEW_CUSTOMERS" },
  { path: "/tables", name: "Tables", icon: Grid2X2, permission: "VIEW_TABLES" },
  { path: "/settings", name: "Settings", icon: Building2, permission: "VIEW_SETTINGS" },
]

export default function Sidebar() {
  const { isSidebarOpen, toggleSidebar } = useUIStore()

  return (
    <>
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleSidebar}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-20 md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 180 : 72 }}
        className={`fixed md:relative h-full bg-card border-r border-border/50 flex flex-col z-30 shadow-xl transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="h-16 flex items-center justify-between border-b border-border/50 px-4">
          {isSidebarOpen && (
            <h1 className="text-xl font-bold text-primary truncate">
              Icon Food
            </h1>
          )}
          <button 
            className={`text-muted-foreground hover:text-foreground ${!isSidebarOpen && 'mx-auto'}`}
            onClick={toggleSidebar}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
        
        <div className={`flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-3 ${isSidebarOpen ? 'custom-scrollbar' : 'scrollbar-hide'}`}>
          {menuItems.filter(item => hasPermission(item.permission)).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end
              onClick={() => {
                if (window.innerWidth < 768) {
                  toggleSidebar()
                }
              }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <motion.span
                animate={{ opacity: isSidebarOpen ? 1 : 0, display: isSidebarOpen ? "block" : "none" }}
                className="text-sm font-medium whitespace-nowrap"
              >
                {item.name}
              </motion.span>
            </NavLink>
          ))}
        </div>
      </motion.aside>
    </>
  )
}
