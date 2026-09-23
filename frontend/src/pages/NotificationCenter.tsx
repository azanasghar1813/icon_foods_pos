import {  Info, AlertTriangle, CheckCircle, X } from "lucide-react"

const NOTIFICATIONS: { id: number, type: string, title: string, message: string, time: string, unread: boolean }[] = []

export default function NotificationCenter() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notification Center</h1>
          <p className="text-muted-foreground text-sm">System alerts and messages.</p>
        </div>
        <button className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg font-medium hover:bg-secondary/80 transition-colors">
          Mark all as read
        </button>
      </div>

      <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-xl overflow-hidden shadow-sm">
        <div className="divide-y divide-border/50">
          {NOTIFICATIONS.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No notifications yet.</div>
          )}
          {NOTIFICATIONS.map((notif) => (
            <div key={notif.id} className={`p-4 flex gap-4 transition-colors hover:bg-secondary/30 ${notif.unread ? "bg-secondary/10" : ""}`}>
              <div className="shrink-0 mt-1">
                {notif.type === "alert" && <div className="p-2 bg-destructive/10 text-destructive rounded-full"><AlertTriangle className="w-5 h-5" /></div>}
                {notif.type === "success" && <div className="p-2 bg-green-500/10 text-green-500 rounded-full"><CheckCircle className="w-5 h-5" /></div>}
                {notif.type === "info" && <div className="p-2 bg-blue-500/10 text-blue-500 rounded-full"><Info className="w-5 h-5" /></div>}
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <h4 className={`font-bold ${notif.unread ? "text-foreground" : "text-muted-foreground"}`}>{notif.title}</h4>
                  <span className="text-xs text-muted-foreground">{notif.time}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{notif.message}</p>
              </div>
              <button className="shrink-0 text-muted-foreground hover:text-foreground self-start p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
