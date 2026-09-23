import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, User, Phone, MapPin, StickyNote, Star, X, CheckCircle2, Plus, Heart, Pencil, Trash2 } from "lucide-react"
import { usePosStore } from "../store/posStore"
import { toast } from "../store/toastStore"

import { customerService } from "../services/customerService"

interface CustomerPanelModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function CustomerPanelModal({ isOpen, onClose, onSuccess }: CustomerPanelModalProps) {
  const { setCustomer } = usePosStore()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Create Form State
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newAddress, setNewAddress] = useState("")
  const [newNotes, setNewNotes] = useState("")
  const [isVip, setIsVip] = useState(false)
  const [isFavourite, setIsFavourite] = useState(false)
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [suggestedCustomer, setSuggestedCustomer] = useState<any | null>(null)

  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLTextAreaElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const favouriteRef = useRef<HTMLButtonElement>(null)
  const vipRef = useRef<HTMLButtonElement>(null)
  const saveRef = useRef<HTMLButtonElement>(null)
  
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [activeInput, setActiveInput] = useState<number>(1) // 0: Name, 1: Phone, 2: Address, 3: Notes, 4: Fav, 5: VIP, 6: Save

  const QUICK_ADDRESSES: string[] = []

  const fetchCustomers = async () => {
    try {
      const res: any = await customerService.getCustomers()
      let dataToMap = []
      if (Array.isArray(res)) {
        dataToMap = res
      } else if (res.data && Array.isArray(res.data)) {
        dataToMap = res.data
      }

      const mapped = dataToMap.map((c: any) => ({
        ...c,
        name: c.name || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Guest'
      }))
      setCustomers(mapped)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchCustomers()
      setSearchQuery("")
      
      const currentCustomer = usePosStore.getState().customer
      if (currentCustomer) {
        setNewName(currentCustomer.name && currentCustomer.name !== 'Guest' ? currentCustomer.name : "")
        setNewPhone(currentCustomer.phone || "")
        setNewAddress(currentCustomer.address || "")
        setNewNotes(currentCustomer.notes || "")
        setIsVip(!!(currentCustomer.is_vip || currentCustomer.isVip))
        setIsFavourite(false)
        setEditingCustomerId(currentCustomer.is_temp ? null : currentCustomer.id)
      } else {
        setNewName("")
        setNewPhone("")
        setNewAddress("")
        setNewNotes("")
        setIsVip(false)
        setIsFavourite(true) // Default to true so it saves to DB
        setEditingCustomerId(null)
        setSuggestedCustomer(null)
      }
      
      setSelectedIndex(-1)
      setActiveInput(1)
      setTimeout(() => phoneRef.current?.focus(), 100)
    }
  }, [isOpen])

  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase()
    const nameMatch = (c.name || '').toLowerCase().includes(q)
    const phoneMatch = (c.phone || '').includes(q)
    const addressMatch = (c.address || '').toLowerCase().includes(q)
    const vipMatch = q === 'vip' && (c.is_vip || c.isVip)
    
    return nameMatch || phoneMatch || addressMatch || vipMatch
  })

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT' || !!el?.isContentEditable

      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      // Name / phone / address / notes / search must accept typing, paste, copy, cut
      if (typing) {
        if (e.ctrlKey && e.key.toLowerCase() === 'n' && el !== notesRef.current) {
          e.preventDefault()
          notesRef.current?.focus()
        }
        return
      }

      // Toggle VIP shortcut (only when not typing in a field)
      if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        setIsVip(v => !v)
        return
      }
      
      // Exit on Ctrl+C when not copying from a field
      if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        onClose()
        return
      }

      // Toggle Notes shortcut
      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        notesRef.current?.focus()
        return
      }

      const inSearchOrList = document.activeElement === searchInputRef.current || document.activeElement?.closest('.customer-list-container')
      const inForm = document.activeElement?.closest('.customer-form-container')

      if (e.key === 'Tab') {
        e.preventDefault()
        if (inSearchOrList || document.activeElement === searchInputRef.current) {
          nameRef.current?.focus()
        } else {
          searchInputRef.current?.focus()
        }
        return
      }

      if (inSearchOrList || document.activeElement === searchInputRef.current || document.activeElement === document.body) {
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex(prev => Math.max(0, prev - 1))
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex(prev => Math.min(filteredCustomers.length - 1, prev + 1))
        } else if (e.key === 'ArrowRight' && selectedIndex >= 0) {
          e.preventDefault()
          document.getElementById(`delete-btn-${selectedIndex}`)?.focus()
        } else if (e.key === 'ArrowLeft' && selectedIndex >= 0) {
          e.preventDefault()
          document.getElementById(`edit-btn-${selectedIndex}`)?.focus()
        } else if (e.key === 'Enter') {
          e.preventDefault()
          if (selectedIndex >= 0 && filteredCustomers[selectedIndex]) {
            handleSelect(filteredCustomers[selectedIndex])
          }
        }
      } else if (inForm || document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'BUTTON') {
        const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
        const isInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
        const atStart = isInput && typeof el.selectionStart === 'number' ? el.selectionStart === 0 : true;
        const atEnd = isInput && typeof el.selectionEnd === 'number' ? el.selectionEnd === el.value?.length : true;

        if (e.key === 'ArrowUp') {
          if (el.tagName === 'TEXTAREA' && !atStart) return; // Allow cursor movement inside textarea
          e.preventDefault()
          setActiveInput(prev => {
            let next = prev;
            if (prev === 2) next = 0;
            else if (prev > 0 && prev !== 1) next = prev - 1;
            focusInput(next)
            return next
          })
        } else if (e.key === 'ArrowDown') {
          if (el.tagName === 'TEXTAREA' && !atEnd) return; // Allow cursor movement inside textarea
          e.preventDefault()
          setActiveInput(prev => {
            let next = prev;
            if (prev === 0 || prev === 1) next = 2;
            else if (prev < 6) next = prev + 1;
            focusInput(next)
            return next
          })
        } else if (e.key === 'ArrowRight') {
          if (activeInput === 0) {
            if (isInput && !atEnd) return; // Allow right arrow inside text
            e.preventDefault()
            setActiveInput(1)
            focusInput(1)
          }
        } else if (e.key === 'ArrowLeft') {
          if (activeInput === 1) {
            if (isInput && !atStart) return; // Allow left arrow inside text
            e.preventDefault()
            setActiveInput(0)
            focusInput(0)
          }
        }
      }

      if (e.key === 'Backspace' && searchQuery === '' && document.activeElement === searchInputRef.current) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredCustomers, selectedIndex, searchQuery, onClose])

  const focusInput = (index: number) => {
    if (index === 0) nameRef.current?.focus()
    else if (index === 1) phoneRef.current?.focus()
    else if (index === 2) addressRef.current?.focus()
    else if (index === 3) notesRef.current?.focus()
    else if (index === 4) favouriteRef.current?.focus()
    else if (index === 5) vipRef.current?.focus()
    else if (index === 6) saveRef.current?.focus()
  }

  const handleSelect = (c: any) => {
    setCustomer(c)
    onClose()
    if (onSuccess) onSuccess()
  }

  const resetForm = () => {
    setNewName("")
    setNewPhone("")
    setNewAddress("")
    setNewNotes("")
    setIsVip(false)
    setIsFavourite(true) // Default to true so it saves to DB
    setEditingCustomerId(null)
    setSuggestedCustomer(null)
  }

  const applyQuickAddress = (address: string) => {
    setNewAddress(address)
    const digits = searchQuery.replace(/[^0-9]/g, '')
    if (!newPhone && digits.length >= 3) {
      let val = digits.slice(0, 11)
      if (val.length > 4) val = val.slice(0, 4) + '-' + val.slice(4)
      setNewPhone(val)
    }
    setActiveInput(2)
    setTimeout(() => addressRef.current?.focus(), 50)
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    val = val.slice(0, 11);
    if (val.length > 4) {
      val = val.slice(0, 4) + '-' + val.slice(4);
    }
    setNewPhone(val);

    // Autocomplete logic
    if (val.replace(/[^0-9]/g, '').length >= 3) {
      const match = customers.find(c => c.phone && c.phone.startsWith(val));
      setSuggestedCustomer(match || null);
    } else {
      setSuggestedCustomer(null);
    }
  }

  const acceptSuggestion = () => {
    if (suggestedCustomer) {
      handleSelect(suggestedCustomer);
      setSuggestedCustomer(null);
      toast.success(`Customer selected: ${suggestedCustomer.name || 'Guest'}`, { id: 'customer-found' });
    }
  }

  const handleEditClick = (c: any) => {
    setNewName(c.name || "")
    setNewPhone(c.phone || "")
    setNewAddress(c.address || "")
    setNewNotes(c.notes || "")
    setIsVip(!!(c.is_vip || c.isVip))
    setIsFavourite(true)
    setEditingCustomerId(c.id)
  }

  const handleDeleteClick = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) return
    try {
      await customerService.deleteCustomer(id)
      toast.success("Customer deleted")
      fetchCustomers()
      if (editingCustomerId === id) resetForm()
    } catch (err: any) {
      console.error(err)
      toast.error("Failed to delete customer")
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    // Name is not mandatory, if empty write Guest
    const finalName = newName.trim() === '' ? 'Guest' : newName
    
    const custData: any = {
      first_name: finalName,
      name: finalName, // Keep name for frontend state
      phone: newPhone || null,
      address: newAddress,
      notes: newNotes,
      is_vip: isVip,
    }

    try {
      if (editingCustomerId) {
        const res: any = await customerService.updateCustomer(editingCustomerId, custData)
        toast.success("Customer updated")
        const backendCustomer = res.data || res
        setCustomer({
          ...backendCustomer,
          id: editingCustomerId,
          name: finalName,
          phone: newPhone || null,
          address: newAddress,
          is_vip: isVip
        })
        fetchCustomers()
        resetForm()
        onClose()
        if (onSuccess) onSuccess()
      } else {
        if (isFavourite) {
          const res: any = await customerService.createCustomer(custData)
          if (res.success || res.data?.success || res.id || res.data?.id) {
            const backendCustomer = res.data || res;
            const newCustomer = {
              ...backendCustomer,
              name: backendCustomer.name || [backendCustomer.first_name, backendCustomer.last_name].filter(Boolean).join(' ') || 'Guest'
            };
            setCustomer(newCustomer)
            setCustomers(prev => [newCustomer, ...prev])
            onClose()
            if (onSuccess) onSuccess()
          } else {
            toast.error("Failed to create customer")
          }
        } else {
          // Temp customer for order
          const tempCustomer = {
            ...custData,
            id: `temp-${Date.now()}`,
            is_temp: true
          }
          setCustomer(tempCustomer)
          onClose()
          if (onSuccess) onSuccess()
        }
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err?.response?.data?.error || err?.message || "Error saving customer")
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-card w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex h-[80vh] border border-border"
        >
          {/* Left Panel: Search & List */}
          <div className="customer-list-container w-1/2 border-r border-border flex flex-col bg-background">
            <div className="p-4 border-b border-border bg-card">
              <h2 className="text-lg font-black text-foreground mb-4">Customer Directory</h2>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.stopPropagation()}
                  placeholder="Search by Phone, Name, Address or VIP..."
                  className="w-full h-10 pl-9 pr-4 rounded-xl bg-secondary border-none focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold"
                />
              </div>
              <div className="grid grid-cols-4 gap-1.5 mt-3">
                {QUICK_ADDRESSES.map((addr) => (
                  <button
                    key={addr}
                    type="button"
                    onClick={() => applyQuickAddress(addr)}
                    className={`h-9 px-1 rounded-lg border text-[10px] leading-tight font-black transition-colors ${
                      newAddress === addr
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-secondary border-border text-foreground hover:border-orange-500 hover:text-orange-600'
                    }`}
                    title={addr}
                  >
                    {addr}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {filteredCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                  <User className="w-12 h-12 mb-2" />
                  <p>No customers found</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredCustomers.map((c, i) => (
                    <div 
                      key={c.id || i} 
                      className={`w-full text-left p-3 rounded-xl hover:bg-secondary transition-all flex items-center gap-3 group border-2 ${selectedIndex === i ? 'bg-secondary border-orange-500 shadow-md' : 'border-transparent'}`}
                    >
                      <button onClick={() => handleSelect(c)} className="flex-1 flex items-start gap-3 outline-none">
                        <div className={`w-10 h-10 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${c.is_vip || c.isVip ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' : 'bg-primary/10 text-primary'}`}>
                          {c.is_vip || c.isVip ? <Star className="w-5 h-5 fill-current" /> : <User className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="font-bold text-foreground text-sm group-hover:text-orange-500 transition-colors">{c.name}</p>
                            {(c.is_vip || c.isVip) && <span className="text-[10px] bg-orange-500/10 text-orange-600 border border-orange-500/20 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">VIP</span>}
                          </div>
                          <div className="flex flex-col gap-1">
                            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-foreground/50" /> {c.phone || 'No Phone'}</p>
                            {c.address && <p className="text-[11px] text-muted-foreground/80 flex items-start gap-1.5 pr-2"><MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-foreground/50" /> <span className="line-clamp-2">{c.address}</span></p>}
                            {c.notes && <p className="text-[10px] text-muted-foreground/60 flex items-start gap-1.5 pr-2 italic"><StickyNote className="w-3 h-3 mt-0.5 flex-shrink-0 text-foreground/50" /> <span className="line-clamp-1">{c.notes}</span></p>}
                          </div>
                        </div>
                      </button>
                      <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button id={`edit-btn-${i}`} onClick={(e) => { e.stopPropagation(); handleEditClick(c); }} className="p-2 bg-background hover:bg-orange-500 text-muted-foreground hover:text-white focus:bg-orange-500 focus:text-white shadow-sm border border-border outline-none rounded-lg transition-all"><Pencil className="w-4 h-4" /></button>
                        <button id={`delete-btn-${i}`} onClick={(e) => { e.stopPropagation(); handleDeleteClick(c.id); }} className="p-2 bg-background hover:bg-red-500 text-muted-foreground hover:text-white focus:bg-red-500 focus:text-white shadow-sm border border-border outline-none rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Create / Details */}
          <div className="customer-form-container w-1/2 flex flex-col bg-card">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-black text-foreground">{editingCustomerId ? 'Edit Customer' : 'Quick Create'}</h2>
              <button onClick={onClose} className="p-2 hover:bg-secondary rounded-xl transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 flex flex-col space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Name</label>
                  <div className="relative bg-secondary rounded-xl flex items-center overflow-hidden">
                    <User className="w-4 h-4 absolute left-3 text-muted-foreground z-20" />
                    
                    {suggestedCustomer && !newName && (
                      <div className="absolute inset-0 flex items-center pl-9 pointer-events-none z-10 text-sm font-semibold">
                        <span className="text-orange-500 opacity-80">{suggestedCustomer.name}</span>
                      </div>
                    )}

                    <input ref={nameRef} onFocus={() => setActiveInput(0)} type="text" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(e as any); } }} className="w-full h-10 pl-9 pr-4 rounded-xl bg-transparent border-none focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold relative z-20 text-foreground placeholder:text-muted-foreground/50" placeholder="Guest" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Phone</label>
                  <div className="relative bg-secondary rounded-xl flex items-center">
                    <Phone className="w-4 h-4 absolute left-3 text-muted-foreground z-20" />
                    
                    {suggestedCustomer && suggestedCustomer.phone.startsWith(newPhone) && (
                      <div className="absolute left-0 top-0 bottom-0 flex items-center pl-9 pointer-events-none z-10 text-sm font-semibold whitespace-pre">
                        <span className="opacity-0">{newPhone}</span>
                        <span className="text-orange-500 opacity-80">{suggestedCustomer.phone.slice(newPhone.length)}</span>
                      </div>
                    )}

                    <input 
                      ref={phoneRef} 
                      onFocus={() => setActiveInput(1)} 
                      type="text" 
                      value={newPhone} 
                      onChange={handlePhoneChange} 
                      onKeyDown={(e) => { 
                        if (e.key === 'Tab' || e.key === 'ArrowRight') {
                          if (suggestedCustomer && suggestedCustomer.phone.startsWith(newPhone)) {
                            e.preventDefault();
                            acceptSuggestion();
                            return;
                          }
                        }
                        e.stopPropagation(); 
                        if (e.key === 'Enter' && !e.shiftKey) { 
                          e.preventDefault(); 
                          if (suggestedCustomer && suggestedCustomer.phone.startsWith(newPhone)) {
                            acceptSuggestion();
                          } else {
                            handleSave(e as any); 
                          }
                        } 
                      }} 
                      className="w-full h-10 pl-9 pr-12 rounded-xl bg-transparent border-none focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold relative z-20 text-foreground placeholder:text-muted-foreground/50" 
                      placeholder="03XX-XXXXXXX" 
                      maxLength={12} 
                    />

                    <AnimatePresence>
                      {suggestedCustomer && suggestedCustomer.phone.startsWith(newPhone) && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          type="button"
                          onClick={acceptSuggestion}
                          className="absolute right-2 z-30 p-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-md shadow-sm transition-colors cursor-pointer flex items-center justify-center"
                          title="Accept suggestion (Tab or Right Arrow)"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Address</label>
                <div className="relative bg-secondary rounded-xl overflow-hidden">
                  <MapPin className="w-4 h-4 absolute left-3 top-3 text-muted-foreground z-20" />
                  
                  {suggestedCustomer && !newAddress && (
                    <div className="absolute inset-0 pt-2.5 pl-9 pr-4 pointer-events-none z-10 text-sm font-semibold">
                      <span className="text-orange-500 opacity-80">{suggestedCustomer.address}</span>
                    </div>
                  )}

                  <textarea ref={addressRef} onFocus={() => setActiveInput(2)} value={newAddress} onChange={e => setNewAddress(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(e as any); } }} className="w-full h-20 pl-9 pr-4 pt-2.5 rounded-xl bg-transparent border-none focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold resize-none relative z-20 text-foreground placeholder:text-muted-foreground/50" placeholder="Delivery address..." />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Notes</label>
                <div className="relative bg-secondary rounded-xl overflow-hidden">
                  <StickyNote className="w-4 h-4 absolute left-3 top-3 text-muted-foreground z-20" />
                  
                  {suggestedCustomer && !newNotes && (
                    <div className="absolute inset-0 pt-2.5 pl-9 pr-4 pointer-events-none z-10 text-sm font-semibold">
                      <span className="text-orange-500 opacity-80">{suggestedCustomer.notes}</span>
                    </div>
                  )}

                  <textarea ref={notesRef} onFocus={() => setActiveInput(3)} value={newNotes} onChange={e => setNewNotes(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(e as any); } }} className="w-full h-20 pl-9 pr-4 pt-2.5 rounded-xl bg-transparent border-none focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold resize-none relative z-20 text-foreground placeholder:text-muted-foreground/50" placeholder="Allergies, preferences..." />
                </div>
              </div>

              <div className="pt-2 flex-1 flex flex-col gap-2">
                <button 
                  type="button"
                  onClick={() => setIsFavourite(!isFavourite)}
                  className={`w-full p-4 rounded-xl border-2 transition-all flex items-center justify-between ${isFavourite ? 'border-pink-500 bg-pink-500/10' : 'border-border bg-secondary hover:border-pink-500/50'}`}
                >
                  <div className="flex items-center gap-3">
                    <Heart className={`w-5 h-5 ${isFavourite ? 'text-pink-500 fill-pink-500' : 'text-muted-foreground'}`} />
                    <div className="text-left">
                      <p className={`font-bold ${isFavourite ? 'text-pink-500' : 'text-foreground'}`}>Mark as Favourite</p>
                      <p className="text-xs text-muted-foreground">Save to Customer Directory</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isFavourite ? 'border-pink-500 bg-pink-500' : 'border-muted-foreground'}`}>
                    {isFavourite && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                </button>

                <button 
                  type="button"
                  onClick={() => setIsVip(!isVip)}
                  className={`w-full p-4 rounded-xl border-2 transition-all flex items-center justify-between ${isVip ? 'border-orange-500 bg-orange-500/10' : 'border-border bg-secondary hover:border-orange-500/50'}`}
                >
                  <div className="flex items-center gap-3">
                    <Star className={`w-5 h-5 ${isVip ? 'text-orange-500 fill-orange-500' : 'text-muted-foreground'}`} />
                    <div className="text-left">
                      <p className={`font-bold ${isVip ? 'text-orange-500' : 'text-foreground'}`}>VIP Customer <span className="opacity-50 text-[10px] ml-1">(CTRL + V)</span></p>
                      <p className="text-xs text-muted-foreground">Assign priority routing and loyalty benefits</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isVip ? 'border-orange-500 bg-orange-500' : 'border-muted-foreground'}`}>
                    {isVip && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                </button>
              </div>

              <div className="pt-4 mt-auto">
                <button type="submit" className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                  <Plus className="w-5 h-5" /> {editingCustomerId ? 'Update Customer' : (isFavourite ? 'Save & Select' : 'Select for Order')}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
