import { useState, useEffect } from "react"
import { Search, AlertTriangle, Plus, Download, Loader2 } from "lucide-react"
import { inventoryService } from "../services/inventoryService"

export default function Inventory() {
  const [inventory, setInventory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await inventoryService.getInventory()
        setInventory(response.data || response)
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
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground text-sm">Track raw ingredients and stock levels.</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg font-medium hover:bg-secondary/80 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
          </button>
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" /> Receive Stock
          </button>
        </div>
      </div>

      <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search ingredients..."
              className="w-full h-10 pl-9 pr-4 rounded-lg bg-secondary/50 border border-border/50 focus:outline-none focus:border-primary/50 text-sm transition-colors"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-secondary/50 text-muted-foreground border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">SKU</th>
                <th className="px-6 py-4 font-medium">Ingredient</th>
                <th className="px-6 py-4 font-medium">In Stock</th>
                <th className="px-6 py-4 font-medium">Unit Cost</th>
                <th className="px-6 py-4 font-medium">Total Value</th>
                <th className="px-6 py-4 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {inventory.map((item) => {
                const isLowStock = item.quantity <= item.min_stock_level
                const inStockValue = Number(item.quantity) || 0;
                const costPerUnit = Number(item.unit_cost) || 0;
                return (
                  <tr key={item.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4 font-medium">{item.sku || item.id}</td>
                    <td className="px-6 py-4 font-bold">{item.name}</td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${isLowStock ? "text-destructive" : ""}`}>
                        {inStockValue} {item.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4">${costPerUnit.toFixed(2)}</td>
                    <td className="px-6 py-4 text-primary font-medium">${(inStockValue * costPerUnit).toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      {isLowStock ? (
                        <div className="flex items-center justify-end gap-1.5 text-destructive bg-destructive/10 px-3 py-1 rounded-full w-fit ml-auto border border-destructive/20">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold uppercase tracking-wider">Low Stock</span>
                        </div>
                      ) : (
                        <div className="text-green-500 bg-green-500/10 px-3 py-1 rounded-full w-fit ml-auto border border-green-500/20">
                          <span className="text-xs font-bold uppercase tracking-wider">Adequate</span>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
