import { useState, useEffect } from "react"
import { Plus,  Filter,  Loader2 } from "lucide-react"
import { expenseService } from "../services/expenseService"

export default function Expenses() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await expenseService.getExpenses()
        setExpenses(response.data || response)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center min-h-[calc(100vh-100px)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground text-sm">Track restaurant operating expenses.</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg font-medium hover:bg-secondary/80 transition-colors flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filter
          </button>
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-1">Total Expenses (This Month)</p>
          <p className="text-2xl font-bold">Rs 2,200.50</p>
        </div>
        <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-1">Pending Payments</p>
          <p className="text-2xl font-bold text-orange-500">Rs 350.00</p>
        </div>
        <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-1">Largest Category</p>
          <p className="text-2xl font-bold">Inventory</p>
        </div>
      </div>

      <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-secondary/50 text-muted-foreground border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">ID</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Description</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {expenses.map((expense) => {
                const amount = Number(expense.amount) || 0;
                return (
                <tr key={expense.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-6 py-4 font-medium">{expense.id.substring(0, 8)}...</td>
                  <td className="px-6 py-4">{new Date(expense.expense_date || expense.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span className="bg-secondary px-2.5 py-1 rounded-full text-xs font-medium border border-border/50">{expense.category}</span>
                  </td>
                  <td className="px-6 py-4 font-medium">{expense.description}</td>
                  <td className="px-6 py-4 font-bold">${amount.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-green-500/10 text-green-500 border-green-500/20">
                      Recorded
                    </span>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
