import { useState, useEffect } from "react"
import { Search, Plus, Edit2, Trash2, Loader2, Save, X, EyeOff, ShieldAlert } from "lucide-react"
import { menuService } from "../services/menuService"
import { useAuthStore } from "../store/authStore"
import { toast } from "../store/toastStore"
import { motion, AnimatePresence } from "framer-motion"

export default function Categories() {
  const { user } = useAuthStore()
  const canManageProducts = true;

  const [categories, setCategories] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<"add" | "edit">("add")
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null)
  
  const [formData, setFormData] = useState({
    name: "",
    display_order: 0,
    lifecycle_state: "ACTIVE",
    visibility: "VISIBLE",
    parent_id: "" as string | null,
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchCategories = async () => {
    try {
      setIsLoading(true)
      const result = await menuService.getCategories()
      if (result) {
        setCategories(result.data)
      } else {
        toast.error("Failed to fetch categories")
      }
    } catch (error) {
      toast.error("Error connecting to server")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleOpenAdd = () => {
    setDrawerMode("add")
    setSelectedCategory(null)
    setFormData({
      name: "",
      display_order: 0,
      lifecycle_state: "ACTIVE",
      visibility: "VISIBLE",
      parent_id: null,
    })
    setIsDrawerOpen(true)
  }

  const handleOpenEdit = (category: any) => {
    setDrawerMode("edit")
    setSelectedCategory(category)
    setFormData({
      name: category.name,
      display_order: category.display_order || 0,
      lifecycle_state: category.lifecycle_state || "ACTIVE",
      visibility: category.visibility || "VISIBLE",
      parent_id: category.parent_id || null,
    })
    setIsDrawerOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManageProducts) {
      toast.error("You do not have permission to manage categories")
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        name: formData.name.trim(),
        display_order: Number(formData.display_order) || 0,
        lifecycle_state: formData.lifecycle_state || 'ACTIVE',
        visibility: formData.visibility || 'VISIBLE',
        parent_id: formData.parent_id || null,
      }
      if (drawerMode === "add") {
        await menuService.createCategory(payload)
        toast.success("Category created successfully")
      } else {
        await menuService.updateCategory(selectedCategory.id, payload)
        toast.success("Category updated successfully")
      }
      setIsDrawerOpen(false)
      fetchCategories()
    } catch (error: any) {
      const details = error.response?.data?.errors?.map((e: any) => e.message).join(', ')
      toast.error(error.response?.data?.message || details || error.response?.data?.error || "Failed to save category")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!canManageProducts) {
      toast.error("You do not have permission to delete categories")
      return
    }

    if (!window.confirm("Are you sure you want to delete this category?")) return

    try {
      await menuService.deleteCategory(id)
      toast.success("Category deleted successfully")
      fetchCategories()
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to delete category")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground text-sm">Organize your menu into categories.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-lg bg-card/60 backdrop-blur-md border border-border/50 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          {canManageProducts && (
            <button 
              onClick={handleOpenAdd}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 whitespace-nowrap shadow-md shadow-primary/20"
            >
              <Plus className="w-4 h-4" /> Add Category
            </button>
          )}
        </div>
      </div>

      {!canManageProducts && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 p-4 rounded-xl flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold">View Only Mode</h4>
            <p className="text-sm opacity-90">Your current role does not have permission to manage the catalog. You can view categories but cannot make changes.</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="h-full flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCategories.map((cat) => (
            <div key={cat.id} className="bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-5 hover:border-primary/50 transition-colors group shadow-sm flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{cat.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {cat.products?.length || 0} items attached
                  </p>
                </div>
                {cat.visibility === "HIDDEN" && (
                  <EyeOff className="w-5 h-5 text-muted-foreground" />
                )}
              </div>

              {cat.sub_categories && cat.sub_categories.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-muted-foreground mb-2 uppercase">Subcategories</h4>
                  <div className="flex flex-wrap gap-2">
                    {cat.sub_categories.map((sub: any) => (
                      <div key={sub.id} className="bg-secondary/50 border border-border rounded-lg px-3 py-1.5 flex items-center gap-2 group/sub">
                        <span className="text-sm font-semibold">{sub.name}</span>
                        {canManageProducts && (
                          <div className="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity ml-1">
                            <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(sub) }} className="text-muted-foreground hover:text-foreground">
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(sub.id) }} className="text-red-500/70 hover:text-red-500">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-auto flex justify-between items-center pt-4 border-t border-border/30">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                  cat.lifecycle_state === "ACTIVE" ? "bg-green-500/10 text-green-500 border-green-500/20" : 
                  cat.lifecycle_state === "UNAVAILABLE" ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                  "bg-destructive/10 text-destructive border-destructive/20"
                }`}>
                  {cat.lifecycle_state}
                </span>
                
                {canManageProducts && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setDrawerMode("add");
                        setSelectedCategory(null);
                        setFormData({
                          name: "",
                          display_order: 0,
                          lifecycle_state: "ACTIVE",
                          visibility: "VISIBLE",
                          parent_id: cat.id,
                        });
                        setIsDrawerOpen(true);
                      }}
                      className="p-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-lg transition-colors flex items-center gap-1"
                      title="Add Subcategory"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase hidden sm:block">Subcategory</span>
                    </button>
                    <button 
                      onClick={() => handleOpenEdit(cat)}
                      className="p-2 bg-secondary text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(cat.id)}
                      className="p-2 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {filteredCategories.length === 0 && !isLoading && (
             <div className="col-span-full py-12 text-center text-muted-foreground">
               <p>No categories found.</p>
             </div>
          )}
        </div>
      )}

      {/* Slide-over Drawer for Add/Edit Category */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border/50 shadow-2xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-border/50">
                <h2 className="text-xl font-bold">
                  {drawerMode === "add" ? "Create Category" : "Edit Category"}
                </h2>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 rounded-full hover:bg-secondary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <form id="category-form" onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category Name <span className="text-destructive">*</span></label>
                    <input
                      required
                      autoFocus
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full h-10 px-3 rounded-md bg-secondary/50 border border-border/50 focus:border-primary/50 focus:outline-none transition-colors"
                      placeholder="e.g. Premium Pizza"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Section / Parent</label>
                    <select
                      value={formData.parent_id || ""}
                      onChange={e => setFormData({ ...formData, parent_id: e.target.value || null })}
                      className="w-full h-10 px-3 rounded-md bg-secondary/50 border border-border/50 focus:border-primary/50 focus:outline-none transition-colors"
                    >
                      <option value="">None (Top Level — Restaurant / Fast Food / Deals)</option>
                      {categories
                        .filter((c) => !c.parent_id && c.id !== selectedCategory?.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">To move a subcategory, pick Restaurant or Fast Food here, then Save.</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Display Order</label>
                    <input
                      type="number"
                      value={formData.display_order}
                      onChange={e => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                      className="w-full h-10 px-3 rounded-md bg-secondary/50 border border-border/50 focus:border-primary/50 focus:outline-none transition-colors"
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">Lower numbers appear first on the POS menu.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Lifecycle State</label>
                    <select
                      value={formData.lifecycle_state}
                      onChange={e => setFormData({ ...formData, lifecycle_state: e.target.value })}
                      className="w-full h-10 px-3 rounded-md bg-secondary/50 border border-border/50 focus:border-primary/50 focus:outline-none transition-colors"
                    >
                      <option value="ACTIVE">Active (Available)</option>
                      <option value="UNAVAILABLE">Unavailable (Sold Out)</option>
                      <option value="DRAFT">Draft</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Visibility on POS</label>
                    <select
                      value={formData.visibility}
                      onChange={e => setFormData({ ...formData, visibility: e.target.value })}
                      className="w-full h-10 px-3 rounded-md bg-secondary/50 border border-border/50 focus:border-primary/50 focus:outline-none transition-colors"
                    >
                      <option value="VISIBLE">Visible</option>
                      <option value="HIDDEN">Hidden</option>
                    </select>
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-border/50 bg-secondary/20 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="px-4 py-2 rounded-lg font-medium hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="category-form"
                  disabled={isSubmitting}
                  className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {drawerMode === "add" ? "Create" : "Save Changes"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
