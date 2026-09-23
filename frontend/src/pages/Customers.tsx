import { useState, useEffect } from "react"
import { UserPlus, Phone, Mail, Loader2, Trash2 } from "lucide-react"
import { customerService } from "../services/customerService"

export default function Customers() {
  const [customers, setCustomers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCust, setEditingCust] = useState<any>(null)
  const [formData, setFormData] = useState({ first_name: '', last_name: '', phone: '', email: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchCustomers = async () => {
    try {
      const response = await customerService.getCustomers()
      setCustomers(response.data || response)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  const handleOpenModal = (cust?: any) => {
    if (cust) {
      setEditingCust(cust)
      setFormData({ first_name: cust.first_name || '', last_name: cust.last_name || '', phone: cust.phone || '', email: cust.email || '' })
    } else {
      setEditingCust(null)
      setFormData({ first_name: '', last_name: '', phone: '', email: '' })
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      if (editingCust) {
        await customerService.updateCustomer(editingCust.id, formData)
      } else {
        await customerService.createCustomer(formData)
      }
      setIsModalOpen(false)
      fetchCustomers()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteAll = async () => {
    if (!window.confirm("Are you absolutely SURE you want to delete ALL customers? This cannot be undone.")) return
    setIsSubmitting(true)
    try {
      await customerService.deleteAllCustomers()
      fetchCustomers()
    } catch (err) {
      console.error(err)
      alert("Failed to delete all customers")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center min-h-[calc(100vh-100px)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground text-sm">CRM and loyalty program management.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDeleteAll} disabled={isSubmitting} className="bg-red-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center gap-2 shadow-md shadow-red-500/20 w-fit">
            <Trash2 className="w-4 h-4" /> Remove All
          </button>
          <button onClick={() => handleOpenModal()} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-md shadow-primary/20 w-fit">
            <UserPlus className="w-4 h-4" /> New Customer
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {customers.map((cust) => {
          const totalSpent = Number(cust.totalSpent) || 0;
          const points = cust.loyaltyPoints || cust.points || 0;
          return (
          <div key={cust.id} onClick={() => handleOpenModal(cust)} className="cursor-pointer bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-5 hover:border-primary/50 transition-colors shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg">
                {(cust.first_name || cust.name || "?").charAt(0)}
              </div>
              <div>
                <h3 className="font-bold">{cust.first_name} {cust.last_name}</h3>
                <p className="text-xs text-muted-foreground">{cust.id}</p>
              </div>
            </div>
            
            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4" /> {cust.phone}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" /> {cust.email}
              </div>
            </div>

            <div className="flex justify-between items-end border-t border-border/50 pt-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Spent</p>
                <p className="font-bold text-lg">${totalSpent.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Loyalty Pts</p>
                <p className="font-bold text-primary text-lg">{points}</p>
              </div>
            </div>
          </div>
        )})}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">{editingCust ? 'Edit Customer' : 'Add Customer'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">First Name</label>
                  <input required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className="w-full p-2 rounded bg-background border border-border" />
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name</label>
                  <input value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className="w-full p-2 rounded bg-background border border-border" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Phone Number</label>
                <input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2 rounded bg-background border border-border" />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-2 rounded bg-background border border-border" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded hover:bg-accent transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors flex items-center gap-2">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
