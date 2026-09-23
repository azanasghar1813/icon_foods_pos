import { motion, AnimatePresence } from "framer-motion"
import { X, Command } from "lucide-react"

interface Props {
  isOpen: boolean
  onClose: () => void
}

type ShortcutCategory = {
  category: string;
  shortcuts: { key: string; desc: string; detail: string }[];
};

const SHORTCUT_GROUPS: ShortcutCategory[] = [
  {
    category: "Global Application",
    shortcuts: [
      { key: "Ctrl + \\", desc: "Show Keyboard Shortcuts Help", detail: "Opens this menu from anywhere. Never blocks typing in a field." },
      { key: "F12", desc: "Toggle Kitchen Display (KDS)", detail: "Open or close the kitchen display overlay." },
      { key: "Ctrl + Shift + P", desc: "Printer Settings", detail: "Open printer management." },
      { key: "Esc", desc: "Close Modals", detail: "Closes the top popup. Does not wipe text you are typing." },
    ]
  },
  {
    category: "POS — Menu",
    shortcuts: [
      { key: "F1 / F2 / F3", desc: "Fast Food / Restaurant / Deals", detail: "Switch the menu section." },
      { key: "F5", desc: "Focus Product Search", detail: "Jump to the search box." },
      { key: "Ctrl + ↑/↓", desc: "Cycle Categories", detail: "Move between categories in the current section." },
      { key: "Ctrl + Shift + Tab", desc: "Cycle Menu Section", detail: "Fast Food → Restaurant → Deals." },
      { key: "Arrow Keys", desc: "Move on the Product Grid", detail: "Only when you are not typing in a box." },
      { key: "Enter", desc: "Add Highlighted Item", detail: "Adds the selected product (or opens size/deal picker)." },
      { key: "Tab", desc: "Toggle Cart Mode", detail: "Switch keyboard control between menu and cart." },
    ]
  },
  {
    category: "POS — Order & Pay",
    shortcuts: [
      { key: "F6 or Ctrl + Enter", desc: "Proceed to Pay", detail: "Opens checkout. Ctrl+Enter in checkout confirms." },
      { key: "F7 / F8 / F9", desc: "Dine In / Takeaway / Delivery", detail: "Set order type." },
      { key: "Ctrl + Tab", desc: "Cycle Order Type", detail: "Dine In → Takeaway → Delivery." },
      { key: "Ctrl + K", desc: "Send Kitchen Ticket (KOT)", detail: "Print kitchen ticket for the current cart." },
      { key: "Ctrl + P", desc: "Paid Stamp On Receipt", detail: "Toggle Paid/Unpaid on the next receipt print." },
      { key: "Ctrl + S", desc: "Toggle Service Charge", detail: "Dine-in service charge on/off." },
      { key: "Ctrl + D", desc: "Jump to Delivery", detail: "Sets Delivery and focuses delivery charges." },
      { key: "Ctrl + N", desc: "Order Notes", detail: "Focus the order notes box." },
      { key: "Ctrl + C", desc: "Customer", detail: "Open customer panel (not used while you are typing)." },
      { key: "Ctrl + W", desc: "Waiter / Rider", detail: "Waiter for dine-in, rider for delivery." },
      { key: "Ctrl + E or F4", desc: "Recent / Active Orders", detail: "Open the active orders sidebar." },
      { key: "Ctrl + V", desc: "VIP Order", detail: "Toggle VIP — disabled while typing so paste still works." },
    ]
  },
  {
    category: "POS — Cart",
    shortcuts: [
      { key: "Backspace / −", desc: "Reduce Top Item", detail: "In menu mode, lowers qty of the last item. Not used while typing." },
      { key: "Delete", desc: "Clear Cart", detail: "Only when you are not in a text field." },
      { key: "← / → in Cart Mode", desc: "Change Quantity", detail: "Tab into cart first, then arrows change qty." },
    ]
  },
  {
    category: "Cashier & History",
    shortcuts: [
      { key: "F2", desc: "Focus Search", detail: "History and Cashier pages — jump to the search box." },
      { key: "F4", desc: "Cash Drop", detail: "Cashier page only." },
      { key: "F5", desc: "Refresh", detail: "Cashier page refresh." },
      { key: "F6", desc: "Print Shift Report", detail: "Cashier page only." },
      { key: "F8", desc: "Close Shift", detail: "Cashier page only." },
    ]
  }
];

export function KeyboardShortcutsModal({ isOpen, onClose }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="bg-card w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-border bg-secondary/30 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 text-primary rounded-lg">
                  <Command className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-foreground">Global Keyboard Shortcuts</h2>
                  <p className="text-xs text-muted-foreground font-bold">Typing in a box is never blocked — copy, paste, and backspace always work</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-secondary rounded-xl transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8">
              {SHORTCUT_GROUPS.map((group, gIdx) => (
                <div key={gIdx} className="space-y-3">
                  <h3 className="text-sm font-black uppercase tracking-widest text-primary/80 border-b border-border/50 pb-2">{group.category}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.shortcuts.map((s, idx) => (
                      <div key={idx} className="flex flex-col p-3 rounded-xl bg-secondary/50 border border-border/50 hover:bg-secondary transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-foreground">{s.desc}</span>
                          <span className="px-2 py-1 bg-background border border-border rounded-md text-xs font-black shadow-sm">{s.key}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{s.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-primary/10 border-t border-primary/20 text-center shrink-0">
              <p className="text-xs font-bold text-primary">Pro Tip: Use the keyboard to navigate the entire application without a mouse.</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
