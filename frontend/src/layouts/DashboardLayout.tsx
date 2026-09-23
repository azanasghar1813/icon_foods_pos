import { Outlet, useLocation } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import TopNavbar from "../components/TopNavbar"

export default function DashboardLayout() {
  const location = useLocation()
  const isPOS = location.pathname === "/pos"

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopNavbar />
        <main className={`flex-1 ${isPOS ? 'overflow-hidden' : 'overflow-y-auto p-4 md:p-6'} bg-background/95 backdrop-blur-sm`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
