import { useState, useEffect } from 'react';
import { useTableStore } from '../store/tableStore';
import { Plus, Edit2, Trash2, Hash, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TablesManagement() {
  const { categories, tables, isLoading, fetchData, createCategory, updateCategory, deleteCategory, createTable, updateTable, deleteTable } = useTableStore();
  
  const [activeTab, setActiveTab] = useState<'tables' | 'categories'>('tables');
  
  // Category Modal
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');

  // Table Modal
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [editTableId, setEditTableId] = useState<string | null>(null);
  const [tableName, setTableName] = useState('');
  const [tableCatId, setTableCatId] = useState('');
  const [tableStatus, setTableStatus] = useState('Available');

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openAddCategory = () => { setEditCatId(null); setCatName(''); setIsCatModalOpen(true); };
  const openEditCategory = (c: any) => { setEditCatId(c.id); setCatName(c.name); setIsCatModalOpen(true); };
  const saveCategory = async () => {
    if (!catName) return;
    if (editCatId) await updateCategory(editCatId, catName);
    else await createCategory(catName);
    setIsCatModalOpen(false);
  };

  const openAddTable = () => { 
    setEditTableId(null); setTableName(''); setTableStatus('Available');
    setTableCatId(categories[0]?.id || ''); 
    setIsTableModalOpen(true); 
  };
  const openEditTable = (t: any) => { 
    setEditTableId(t.id); setTableName(t.name); setTableCatId(t.category_id); setTableStatus(t.status || 'Available');
    setIsTableModalOpen(true); 
  };
  const saveTable = async () => {
    if (!tableName || !tableCatId) return;
    if (editTableId) await updateTable(editTableId, { name: tableName, category_id: tableCatId, status: tableStatus });
    else await createTable(tableName, tableCatId, tableStatus);
    setIsTableModalOpen(false);
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground font-bold">Loading...</div>;

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-6 pb-2 shrink-0 border-b border-border bg-card">
        <h1 className="text-3xl font-black text-foreground mb-4">Table Management</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('tables')}
            className={`px-4 py-2 font-bold rounded-t-lg transition-colors ${activeTab === 'tables' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
          >
            Tables
          </button>
          <button 
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 font-bold rounded-t-lg transition-colors ${activeTab === 'categories' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
          >
            Zones / Categories
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'categories' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Manage Zones</h2>
              <button onClick={openAddCategory} className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg flex items-center gap-2 shadow-md">
                <Plus className="w-5 h-5" /> Add Zone
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(c => (
                <div key={c.id} className="p-4 bg-card border border-border rounded-xl shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{tables.filter(t => t.category_id === c.id).length} tables</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEditCategory(c)} className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => deleteCategory(c.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tables' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Manage Tables</h2>
              <button onClick={openAddTable} className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg flex items-center gap-2 shadow-md">
                <Plus className="w-5 h-5" /> Add Table
              </button>
            </div>
            
            {categories.map(c => {
              const zoneTables = tables.filter(t => t.category_id === c.id);
              if (zoneTables.length === 0) return null;
              return (
                <div key={c.id} className="mb-8">
                  <h3 className="text-lg font-bold text-muted-foreground mb-3">{c.name}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {zoneTables.map(t => (
                      <div key={t.id} className="p-3 bg-card border-2 border-border hover:border-primary/50 rounded-xl shadow-sm relative group transition-colors">
                        <div className="flex flex-col items-center justify-center py-4">
                          <Hash className="w-6 h-6 text-primary/50 mb-1" />
                          <span className="text-lg font-black text-foreground">{t.name}</span>
                        </div>
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button onClick={() => openEditTable(t)} className="p-1.5 bg-blue-500 text-white rounded shadow"><Edit2 className="w-3 h-3" /></button>
                          <button onClick={() => deleteTable(t.id)} className="p-1.5 bg-red-500 text-white rounded shadow"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Category Modal */}
      <AnimatePresence>
        {isCatModalOpen && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-card w-full max-w-sm rounded-2xl p-6 shadow-2xl">
              <h2 className="text-xl font-black mb-4">{editCatId ? 'Edit Zone' : 'New Zone'}</h2>
              <input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Zone Name (e.g. RoofTop)" className="w-full p-3 bg-secondary rounded-xl mb-4 font-bold outline-none focus:ring-2 focus:ring-primary" />
              <div className="flex gap-3">
                <button onClick={() => setIsCatModalOpen(false)} className="flex-1 py-3 bg-secondary hover:bg-secondary/80 font-bold rounded-xl text-muted-foreground">Cancel</button>
                <button onClick={saveCategory} className="flex-1 py-3 bg-primary hover:bg-primary/90 font-bold rounded-xl text-primary-foreground">Save</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table Modal */}
      <AnimatePresence>
        {isTableModalOpen && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-card w-full max-w-sm rounded-2xl p-6 shadow-2xl">
              <h2 className="text-xl font-black mb-4">{editTableId ? 'Edit Table' : 'New Table'}</h2>
              <input value={tableName} onChange={e => setTableName(e.target.value)} placeholder="Table Name (e.g. G1)" className="w-full p-3 bg-secondary rounded-xl mb-3 font-bold outline-none focus:ring-2 focus:ring-primary" />
              <select value={tableCatId} onChange={e => setTableCatId(e.target.value)} className="w-full p-3 bg-secondary rounded-xl mb-4 font-bold outline-none focus:ring-2 focus:ring-primary">
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex gap-3">
                <button onClick={() => setIsTableModalOpen(false)} className="flex-1 py-3 bg-secondary hover:bg-secondary/80 font-bold rounded-xl text-muted-foreground">Cancel</button>
                <button onClick={saveTable} className="flex-1 py-3 bg-primary hover:bg-primary/90 font-bold rounded-xl text-primary-foreground">Save</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
