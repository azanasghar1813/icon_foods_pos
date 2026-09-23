import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Check, ChevronRight, Plus } from 'lucide-react';
import { usePosStore } from '../store/posStore';

interface DealConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: any;
  onConfirm: (configuredDeal: any) => void;
  availableProducts: any[];
}

export function DealConfigurationModal({ isOpen, onClose, deal, onConfirm, availableProducts }: DealConfigurationModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, any[]>>({});
  const [keyboardIndex, setKeyboardIndex] = useState(0);

  useEffect(() => {
    if (isOpen && deal) {
      setCurrentStep(0);
      setSelections({});
      setKeyboardIndex(0);
      // Explicitly blur any focused element (like search input) so window keyboard events work
      (document.activeElement as HTMLElement)?.blur();
    }
  }, [isOpen, deal]);

  const { configurableComponents, autoComponents } = useMemo(() => {
    if (!deal || !deal.components) return { configurableComponents: [], autoComponents: [] };
    const conf: any[] = [];
    const auto: any[] = [];
    
    for (const comp of deal.components) {
      let allowedProducts = availableProducts;
      if (comp.component_type === 'FIXED_PRODUCT') {
        const p = availableProducts.find(prod => prod.id === comp.product_id);
        allowedProducts = p ? [p] : [];
      } else {
        if (comp.target_category_id) {
          allowedProducts = allowedProducts.filter(p => p.category_id === comp.target_category_id);
        }
        if (comp.allowed_product_ids) {
          const ids = comp.allowed_product_ids.split(',');
          allowedProducts = allowedProducts.filter(p => ids.includes(p.id));
        }
      }

      const isPizza = comp.name?.toLowerCase().includes('pizza');

      if (isPizza && (allowedProducts.length > 1 || (allowedProducts.length === 1 && allowedProducts[0].variants?.length > 0 && !comp.target_variant_name))) {
        conf.push(comp);
      } else {
        const p = allowedProducts.length === 1 ? allowedProducts[0] : {
          id: 'dummy-' + comp.id,
          name: comp.name,
          product_name_snapshot: comp.name,
          variant_snapshot: comp.target_variant_name || '',
          is_dummy: true,
          price: 0
        };
        auto.push({
          component_id: comp.id,
          product_id: p.id,
          product_name_snapshot: p.name || p.product_name_snapshot,
          variant_snapshot: comp.target_variant_name || p.variant_snapshot || null,
          price_adjustment: comp.price_adjustment || 0,
          quantity: comp.quantity || 1,
          is_dummy: !!p.is_dummy
        });
      }
    }
    return { configurableComponents: conf, autoComponents: auto };
  }, [deal, availableProducts]);

  const components = configurableComponents;
  const currentComponent = components[currentStep];

  useEffect(() => {
    setKeyboardIndex(0);
  }, [currentStep, isOpen]);



  // Derive which products are allowed for this step
  const allowedProducts = useMemo(() => {
    if (!currentComponent) return [];
    
    // Fixed product case
    if (currentComponent.component_type === 'FIXED_PRODUCT') {
      const p = availableProducts.find(prod => prod.id === currentComponent.product_id);
      return p ? [p] : [];
    }

    // Category Choice Case
    let filtered = availableProducts;
    
    if (currentComponent.target_category_id) {
      filtered = filtered.filter(p => p.category_id === currentComponent.target_category_id);
    }
    
    if (currentComponent.allowed_product_ids) {
      const ids = currentComponent.allowed_product_ids.split(',');
      filtered = filtered.filter(p => ids.includes(p.id));
    }
    
    // Fallback heuristic if seeding mismatched categories
    if (filtered.length === 0 && currentComponent.name) {
      const compName = currentComponent.name.toLowerCase();
      if (compName.includes('pizza')) {
        filtered = availableProducts.filter(p => p.category?.toLowerCase().includes('pizza'));
      } else if (compName.includes('burger')) {
        filtered = availableProducts.filter(p => p.category?.toLowerCase().includes('burger'));
      } else if (compName.includes('drink') || compName.includes('beverage')) {
        filtered = availableProducts.filter(p => p.category?.toLowerCase().includes('drink') || p.category?.toLowerCase().includes('beverage'));
      }
    }

    return filtered;
  }, [currentComponent, availableProducts]);
  const currentSelection = selections[currentComponent?.id] || [];
  const itemsRemaining = currentComponent ? currentComponent.quantity - currentSelection.length : 0;

  const [selectingVariantProduct, setSelectingVariantProduct] = useState<{product: any, fillQuantity: boolean} | null>(null);

  const handleSelect = (product: any, fillQuantity = false, selectedVariantName?: string) => {
    if (!currentComponent) return;

    if (product.variants && product.variants.length > 0 && !currentComponent.target_variant_name && !selectedVariantName) {
      setSelectingVariantProduct({ product, fillQuantity });
      return;
    }

    const productToStore = {
       ...product,
       selected_variant_name: selectedVariantName || product.selected_variant_name || null
    };

    setSelections(prev => {
      const current = prev[currentComponent.id] || [];
      const remaining = currentComponent.quantity - current.length;
      if (remaining > 0) {
        const added = fillQuantity ? Array(remaining).fill(productToStore) : [productToStore];
        return { ...prev, [currentComponent.id]: [...current, ...added] };
      }
      return prev;
    });
  };

  const handleRemove = (index: number) => {
    if (!currentComponent) return;
    setSelections(prev => {
      const current = [...(prev[currentComponent.id] || [])];
      current.splice(index, 1);
      return { ...prev, [currentComponent.id]: current };
    });
  };

  const handleNext = () => {
    if (currentStep < components.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      // Process selections and confirm once
      const combo_components: any[] = [];
      for (const comp of components) {
        const picked = selections[comp.id] || [];
        
        // Group identical products
        const grouped = picked.reduce((acc: any, p: any) => {
          const variantToUse = p.selected_variant_name || comp.target_variant_name || '';
          const key = p.id + '_' + variantToUse;
          if (!acc[key]) {
            acc[key] = {
              component_id: comp.id,
              product_id: p.id,
              product_name_snapshot: p.name,
              variant_snapshot: variantToUse || null,
              price_adjustment: comp.price_adjustment || 0,
              quantity: 0,
              is_dummy: !!p.is_dummy
            };
          }
          acc[key].quantity += 1;
          return acc;
        }, {});
        
        combo_components.push(...Object.values(grouped));
      }
      
      // Add automatically resolved components
      combo_components.push(...autoComponents);
      onConfirm({ ...deal, combo_components });
    }
  };


  
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT' || !!t?.isContentEditable
      if (typing && e.key !== 'Escape') return
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      
      const cols = window.innerWidth >= 768 ? 3 : 2;
      const itemsCount = allowedProducts.length;

      if (itemsCount > 0 && itemsRemaining > 0) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          setKeyboardIndex(prev => (prev + 1) % itemsCount);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          setKeyboardIndex(prev => (prev - 1 + itemsCount) % itemsCount);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          setKeyboardIndex(prev => Math.min(prev + cols, itemsCount - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          setKeyboardIndex(prev => Math.max(prev - cols, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopImmediatePropagation();
          handleSelect(allowedProducts[keyboardIndex], true);
        }
      } else {
        // If items remaining is 0 or allowedProducts is empty
        if (e.key === 'Enter') {
           e.preventDefault();
           e.stopImmediatePropagation();
           if (itemsRemaining === 0) {
             handleNext();
           } else if (allowedProducts.length === 0 && currentComponent) {
             handleSelect({ 
               id: 'dummy-' + currentComponent.id, 
               name: currentComponent.name, 
               product_name_snapshot: currentComponent.name,
               variant_snapshot: currentComponent.target_variant_name || '',
               is_dummy: true, 
               price: 0 
             }, true);
           }
        }
      }
    };
    
    // Use capture phase to intercept before React synthetic events
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, allowedProducts, keyboardIndex, itemsRemaining, onClose, currentComponent]);


  if (!isOpen || !deal) return null;

  if (components.length === 0) {
    // If modal was opened but there are no configurable components, just render null
    // It should have been handled by POS.tsx anyway
    return null;
  }
  
  if (components.length === 0) {
    // Should theoretically not happen, but safe fallback
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-card w-full max-w-md rounded-2xl p-6 text-center shadow-2xl border border-border">
          <h2 className="text-xl font-bold mb-4">Error</h2>
          <p>This deal has no configured components.</p>
          <button onClick={onClose} className="mt-6 w-full py-3 bg-secondary text-foreground font-bold rounded-xl">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-card w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-border flex flex-col max-h-[90vh]"
      >
        <div className="p-6 bg-secondary/30 border-b border-border flex justify-between items-center relative">
          <div>
            <h2 className="text-2xl font-black text-foreground">{deal.name}</h2>
            <p className="text-muted-foreground mt-1 font-medium text-sm">Step {currentStep + 1} of {components.length}</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-background custom-scrollbar">
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-1">
              {currentComponent.name || 'Select Item'}
              {currentComponent.target_variant_name && <span className="ml-2 text-sm text-orange-500 font-semibold uppercase tracking-wider">({currentComponent.target_variant_name})</span>}
            </h3>
            <p className="text-muted-foreground">Please select {currentComponent.quantity} item{currentComponent.quantity > 1 ? 's' : ''}.</p>
          </div>

          {/* Current Selection Visualizer */}
          <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: currentComponent.quantity }).map((_, idx) => {
              const selectedItem = currentSelection[idx];
              return (
                <div 
                  key={idx} 
                  className={`border-2 rounded-xl h-24 flex items-center justify-center p-3 text-center transition-colors ${selectedItem ? 'border-orange-500 bg-orange-500/10' : 'border-dashed border-border bg-secondary/50'}`}
                  onClick={() => selectedItem && handleRemove(idx)}
                >
                  {selectedItem ? (
                    <span className="font-bold text-sm line-clamp-2">{selectedItem.name}</span>
                  ) : (
                    <span className="text-muted-foreground font-semibold text-sm">Empty</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Options */}
          {itemsRemaining > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {allowedProducts.map((prod, idx) => (
                <button
                  key={prod.id}
                  onClick={() => handleSelect(prod, false)}
                  className={`p-4 rounded-2xl border bg-card transition-all text-left flex items-center justify-between group active:scale-95 ${idx === keyboardIndex ? 'border-orange-500 ring-4 ring-orange-500/20' : 'border-border hover:border-orange-500'}`}
                >
                  <span className="font-bold">{prod.name}</span>
                  <Plus className={`w-5 h-5 transition-colors ${idx === keyboardIndex ? 'text-orange-500' : 'text-muted-foreground group-hover:text-orange-500'}`} />
                </button>
              ))}
            </div>
          )}
          
          {itemsRemaining > 0 && allowedProducts.length === 0 && (
             <div className="p-8 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
               <p className="mb-4">No options available for this component. You can add it as is.</p>
               <button 
                 onClick={() => handleSelect({ 
                   id: 'dummy-' + currentComponent.id, 
                   name: currentComponent.name, 
                   product_name_snapshot: currentComponent.name,
                   variant_snapshot: currentComponent.target_variant_name || '',
                   is_dummy: true, 
                   price: 0 
                 }, true)}
                 className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl"
               >
                 Add As Is
               </button>
             </div>
          )}
        </div>

        <div className="p-6 bg-card border-t border-border flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-6 py-3 rounded-xl font-bold text-muted-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button 
            disabled={itemsRemaining > 0}
            onClick={handleNext}
            className={`px-8 py-3 rounded-xl font-black uppercase tracking-wider transition-all flex items-center gap-2
              ${itemsRemaining > 0 ? 'bg-secondary text-muted-foreground cursor-not-allowed' : 'bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:bg-orange-600'}`}
          >
            {currentStep < components.length - 1 ? (
              <>Next Step <ChevronRight className="w-5 h-5" /></>
            ) : (
              <>Add Deal <Check className="w-5 h-5" /></>
            )}
          </button>
        </div>
        {/* Variant Selection Overlay */}
        <AnimatePresence>
          {selectingVariantProduct && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-50 bg-card rounded-3xl flex flex-col p-6 overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
                <h2 className="text-2xl font-black text-foreground">Select {selectingVariantProduct.product.name} Variant</h2>
                <button onClick={() => setSelectingVariantProduct(null)} className="p-3 hover:bg-secondary rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {selectingVariantProduct.product.variants.filter((v: any, i: number, arr: any[]) => {
                  const name = String(v.name || '').trim().toLowerCase()
                  if (!name) return false
                  return arr.findIndex((x: any) => String(x.name || '').trim().toLowerCase() === name) === i
                }).map((v: any) => (
                  <button 
                    key={v.id}
                    onClick={() => {
                      handleSelect(selectingVariantProduct.product, selectingVariantProduct.fillQuantity, v.name);
                      setSelectingVariantProduct(null);
                    }}
                    className="p-6 bg-secondary hover:bg-orange-500/20 hover:text-orange-500 hover:border-orange-500 border border-transparent rounded-2xl font-bold text-center transition-all"
                  >
                    <div className="text-xl mb-2">{v.name}</div>
                    <div className="text-sm opacity-70">Base Price: Rs {v.price}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
